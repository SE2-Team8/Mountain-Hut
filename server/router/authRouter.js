import express from "express";
import passport from "passport";
import { body } from "express-validator";
import authController from "../controllers/authController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { validator, checkBodyLength } from "../middlewares/validator.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.post('/login', passport.authenticate("local"), wrapController(authController.login));
router.get('/me', isAuthenticated, wrapController(authController.getCurrent));
router.post('/logout', wrapController(authController.logout));
router.post('/setup-password',
    validator([
        body('token').hide().isString().bail().matches(/^[0-9a-f]{64}$/).withMessage('A valid setup token is required'),
        body('password').hide().isString().bail()
            .isLength({ min: 8, max: 32 }).withMessage('Password must be 8 to 32 characters').bail()
            .custom((password) => password.trim().length > 0).withMessage('Password cannot be blank'),
    ]),
    wrapController(authController.setupPassword));
router.post('/register',
    checkBodyLength(6),
    validator([
        body('email').notEmpty().withMessage('email is required').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('password is required').isString().withMessage('Password must be a string'),
        body('fullName').notEmpty().withMessage('fullName is required').isString().withMessage('Full name must be a string'),
        body('phone').notEmpty().withMessage('phone is required').isString().withMessage('Phone must be a string')
    ]),
    wrapController(authController.register));
router.post('/change-password', isAuthenticated,
    validator([
        body().custom((b) => Object.keys(b).every((key) => ["currentPassword", "newPassword"].includes(key)))
            .withMessage('Only currentPassword and newPassword are allowed'),
        body('currentPassword').exists().withMessage('currentPassword id required')
            .isString().withMessage('currentPassword must be a string')
            .notEmpty().withMessage('currentPassword cannot be empty'),
        body('newPassword').exists().withMessage('newPassword is required')
            .isString().withMessage('newPassword must be a string')
            .notEmpty().withMessage("newPassword cannot be empty")
    ]),
    wrapController(authController.changePassword));

export default router;
