import express from "express";
import { query } from "express-validator";
import userController from "../controllers/userController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import requireRole from "../middlewares/requireRole.js";
import wrapController from "../utils/wrapController.js";
import { validator, checkBodyLength } from "../middlewares/validator.js";
import { body } from "express-validator";

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
router.post('/',
    requireRole("EMPLOYEE", "WARDEN"),
    isAuthenticated,
    checkBodyLength(5),
    validator([
        body('email').notEmpty().withMessage('email is required').isEmail().withMessage('Valid email is required'),
        body('fullName').notEmpty().withMessage('fullName is required').isString().withMessage('Full name must be a string'),
        body('phone').notEmpty().withMessage('phone is required').isString().withMessage('Phone must be a string')
    ]),
    wrapController(userController.post)
);

export default router;
