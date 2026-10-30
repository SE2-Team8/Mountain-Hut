import express from "express";
import passport from "passport";
import userController from "../controllers/userController.js";
import authController from "../controllers/authController.js";
import timeSlotController from "../controllers/timeSlotController.js";
import reservationController from "../controllers/reservationController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.get('/users/:id', isAuthenticated, wrapController(userController.get));

// endpoints for the current session and the user registration
router.post('/sessions', passport.authenticate("local"), wrapController(authController.login));
router.get('/sessions/current', isAuthenticated, wrapController(authController.getCurrent));
router.delete('/sessions/current', wrapController(authController.logout));
router.post('/register', wrapController(authController.register));

// endpoint to retrieve all time slots
// 4 possible call:
// 1: /api/timeslots -> retrieve all time slots in the database
// 2: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots starting from "from"
// 3: /api/timeslots?to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots up to "to"
// 4: /api/timeslots?from=yyyy-mm-ddThh:mm:ssZ&to=yyyy-mm-ddThh:mm:ssZ -> retrieve all time slots from"from" up to "to"
router.get('/timeslots', wrapController(timeSlotController.getAll));

// endpoint to get a time slot givent its start
router.get('/timeslots/:start', wrapController(timeSlotController.getByStart));

// endpoint to create a reservation
router.post('/timeslots/reservation', isAuthenticated, wrapController(reservationController.create));

export default router;