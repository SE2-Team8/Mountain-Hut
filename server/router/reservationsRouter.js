import express from "express";
import { body } from "express-validator";
import reservationController from "../controllers/reservationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { validator, checkBodyLength } from "../middlewares/validator.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.post('/', isAuthenticated,
    checkBodyLength(2),
    validator([
        body('timeSlotId').notEmpty().withMessage('timeSlotId is required').isInt().withMessage('timeSlotId must be an integer'),
        body('partySize').notEmpty().withMessage('partySize is required').isInt({ min: 1}).withMessage('partySize must be an integer grater than 0')
    ]),
    wrapController(reservationController.create));

export default router;
