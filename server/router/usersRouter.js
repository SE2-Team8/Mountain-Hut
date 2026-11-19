import express from "express";
import userController from "../controllers/userController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.get('/:userId', requireRole("EMPLOYEE", "WARDEN"), isAuthenticated, wrapController(userController.get));

export default router;
