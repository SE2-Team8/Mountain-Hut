import express from "express";
import userController from "../controllers/userController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.get('/users/:id', isAuthenticated, wrapController(userController.get));

// TODO: add endpoints for: login, logout, signup, make reservation
// TODO (for later): add endpoints for: adding a timeSlot, with the list of tables...

export default router;