import express from "express";
import passport from "passport";
import userController from "../controllers/userController.js";
import authController from "../controllers/authController.js";
import timeSlotController from "../controllers/timeSlotController.js";
import reservationController from "../controllers/reservationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import wrapController from "../utils/wrapController.js";
import requireRole from "../middlewares/requireRole.js";
import { body, query, param } from "express-validator"
import {validator, checkBodyLength} from "../middlewares/validator.js"

const router = express.Router();

router.get('/users/:id', isAuthenticated, wrapController(userController.get));

// endpoints for the current session and the user registration
router.post('/sessions', passport.authenticate("local"), wrapController(authController.login));
router.get('/sessions/current', isAuthenticated, wrapController(authController.getCurrent));
router.delete('/sessions/current', wrapController(authController.logout));

router.post('/register',
    checkBodyLength(6),
    validator([
        body('email').notEmpty().withMessage('email is required').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('password is required').isString().withMessage('Password must be a string'),
        body('fullName').notEmpty().withMessage('fullName is required').isString().withMessage('Full name must be a string'),
        body('phone').notEmpty().withMessage('phone is required').isString().withMessage('Phone must be a string')
    ]),
    wrapController(authController.register));

// endpoint to retrieve all time slots
// 4 possible call:
// 1: /api/timeslots -> retrieve all time slots in the database
// 2: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots starting from "from"
// 3: /api/timeslots?to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots up to "to"
// 4: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ&to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots from"from" up to "to"
router.get('/timeslots',
    validator([
        query('from').optional().isISO8601().withMessage('Invalid from date format'),
        query('to').optional().isISO8601().withMessage('Invalid to date format')
    ]),
    wrapController(timeSlotController.getAll));

// endpoint to create a timeslot together with its set of tables.
// body: { startDateTime, endDateTime, tables: [{ tableNumber, totalSeats }] } OPTION A
// or: { startDateTime, endDateTime, copyFromTimeSlotId } OPTION B  (exactly one of the two options)
router.post('/timeslots',
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

        // option A
        body('tables').optional()
            .isArray({ min: 1 }).withMessage('tables must contain at least 1 table').bail()
            .custom((tables) => new Set(tables.map((t) => String(t?.tableNumber))).size === tables.length)
            .withMessage('tableNumber must be unique'), // aaa
        body('tables.*.tableNumber').isInt({ min: 1 }).withMessage('tableNumber must be an integer greater than 0').toInt(),
        body('tables.*.totalSeats').isInt({ min: 1 }).withMessage('totalSeats must be an integer grater than 0').toInt(),

        // option B
        body('copyFromTimeSlotId').optional()
            .isInt({ min: 1 }).withMessage('copyFromTimeSlotId must be an integer greater than 0').toInt()
    ]),
    wrapController(timeSlotController.create));

// endpoint to get a time slot givent its start
router.get('/timeslots/:start',
    validator([
        param('start').isISO8601().withMessage('Start parameter must be a valid date')
    ]),
    wrapController(timeSlotController.getByStart));

// endpoint to create a reservation
router.post('/timeslots/reservation', isAuthenticated,
    checkBodyLength(2),
    validator([
        body('timeSlotId').notEmpty().withMessage('timeSlotId is required').isInt().withMessage('timeSlotId must be an integer'),
        body('partySize').notEmpty().withMessage('partySize is required').isInt({ min: 1}).withMessage('partySize must be an integer grater than 0')
    ]),
    wrapController(reservationController.create));

export default router;