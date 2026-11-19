import express from "express";
import { body, param, query } from "express-validator";
import timeSlotController from "../controllers/timeSlotController.js";
import requireRole from "../middlewares/requireRole.js";
import { validator, checkBodyLength } from "../middlewares/validator.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

// List all time slots, optionally filtered by a date range.
router.get('/',
    validator([
        query('from').optional().isISO8601().withMessage('Invalid from date format'),
        query('to').optional().isISO8601().withMessage('Invalid to date format')
    ]),
    wrapController(timeSlotController.getAll));

// Create a time slot with either a table list or another time slot's table list.
router.post('/',
    requireRole("EMPLOYEE", "WARDEN"),
    checkBodyLength(3),
    validator([
        body('startDateTime').isISO8601().withMessage('startDateTime must be a valid ISO date'),
        body('endDateTime').isISO8601().withMessage('endDateTime must be a valid ISO date').bail()
            .custom((end, { req }) => new Date(end) > new Date(req.body.startDateTime))
            .withMessage('endDateTime must be after startDateTime'),

        body('tables').custom((_, { req }) => {
            const hasTables = req.body.tables !== undefined;
            const hasCopy = req.body.copyFromTimeSlotId !== undefined;
            if (hasTables === hasCopy)
                throw new Error('Provide exactly one of the tables or copyFromTimeSlotId');
            return true;
        }),

        // Option A: provide the tables directly.
        body('tables').optional()
            .isArray({ min: 1 }).withMessage('tables must contain at least 1 table').bail()
            .custom((tables) => new Set(tables.map((t) => String(t?.tableNumber))).size === tables.length)
            .withMessage('tableNumber must be unique'),
        body('tables.*.tableNumber').isInt({ min: 1 }).withMessage('tableNumber must be an integer greater than 0').toInt(),
        body('tables.*.totalSeats').isInt({ min: 1 }).withMessage('totalSeats must be an integer grater than 0').toInt(),

        // Option B: copy the tables from another time slot.
        body('copyFromTimeSlotId').optional()
            .isInt({ min: 1 }).withMessage('copyFromTimeSlotId must be an integer greater than 0').toInt()
    ]),
    wrapController(timeSlotController.create));

// Keep the static availability route before /:start so it is matched explicitly.
router.get('/availability',
    validator([
        query('start').isISO8601().withMessage('Start parameter must be a valid date'),
        query('partySize').isInt({ min: 1 }).withMessage('Party Size must be an integer greater than 0').toInt(),
    ]),
    wrapController(timeSlotController.getByStartAndPartySize));

router.get('/:start',
    validator([
        param('start').isISO8601().withMessage('Start parameter must be a valid date')
    ]),
    wrapController(timeSlotController.getByStart));

export default router;
