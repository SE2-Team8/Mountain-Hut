import express from "express";
import { query } from "express-validator";
import userController from "../controllers/userController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";
import { validator } from "../middlewares/validator.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.get('/search',
    requireRole("EMPLOYEE", "WARDEN"),
    isAuthenticated,
    validator([
        query('value').isString().withMessage('value must be a string')
            .trim().notEmpty().withMessage('value is required'),
    ]),
    wrapController(userController.searchHikers));

router.get('/:userId', requireRole("EMPLOYEE", "WARDEN"), isAuthenticated, wrapController(userController.get));

export default router;
