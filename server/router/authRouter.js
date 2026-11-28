import express from "express";
import passport from "passport";
import { body } from "express-validator";
import authController from "../controllers/authController.js";
import isAuthenticated from "../middlewares/isAuthenticated.js";
import { validator, checkAllowedFields } from "../middlewares/validator.js";
import wrapController from "../utils/wrapController.js";

const router = express.Router();

router.post('/login', passport.authenticate("local"), wrapController(authController.login));
router.get('/me', isAuthenticated, wrapController(authController.getCurrent));
router.post('/logout', wrapController(authController.logout));
router.post('/setup-password', checkAllowedFields(["token", "password"]),
    validator([
        body('token').hide().isString().bail().matches(/^[0-9a-f]{64}$/).withMessage('A valid setup token is required'),
        body('password').hide().isString().bail()
            .isLength({ min: 8, max: 32 }).withMessage('Password must be 8 to 32 characters').bail()
            .custom((password) => password.trim().length > 0).withMessage('Password cannot be blank'),
    ]),
    wrapController(authController.setupPassword));
router.post('/register',
    checkAllowedFields(["email", "password", "fullName", "phone", "notes", "emergencyContact"]),
    validator([
        body('email').notEmpty().withMessage('email is required').isEmail().withMessage('Valid email is required'),
        body('password').hide().isString().withMessage("password is required and must be a string").bail()
            .isLength({ min: 8, max: 32 }).withMessage('Password must be 8 to 32 characters').bail()
            .custom((password) => password.trim().length > 0).withMessage('Password cannot be blank'),
        body('fullName').notEmpty().withMessage('fullName is required').isString().withMessage('Full name must be a string'),
        body('phone').notEmpty().withMessage('phone is required').isString().withMessage('Phone must be a string'),
        body('notes').optional( { values: 'null' }).isString().withMessage('notes must be a string'),
        body('emergecnyContact').optional( { values: 'null' }).isString().withMessage('emergencyContact must be a string')
    ]),
    wrapController(authController.register));
router.post('/change-password', isAuthenticated, checkAllowedFields(["currentPassword", "newPassword"]),
    validator([
        body('currentPassword').exists().withMessage('currentPassword id required')
            .isString().withMessage('currentPassword must be a string')
            .notEmpty().withMessage('currentPassword cannot be empty'),
        body('newPassword').hide().isString().withMessage("newPassword is required and must be a string").bail()
            .isLength({ min: 8, max: 32 }).withMessage('newPassword must be 8 to 32 characters').bail()
            .custom((password) => password.trim().length > 0).withMessage('newPassword cannot be blank'),
    ]),
    wrapController(authController.changePassword));
router.post('/forgot-password', checkAllowedFields(["email"]),
    validator([
        body('email').exists().withMessage('email is required')
            .isString().withMessage('email must be a string')
            .isEmail().withMessage('the email must be valid'),
    ]),
    wrapController(authController.forgotPassword));
router.post('/set-new-password', checkAllowedFields(["token", "password"]),
    validator([
        body('token').hide().exists().withMessage('token is required')
            .isString().withMessage('token must be a string').bail()
            .matches(/^[0-9a-f]{64}$/).withMessage('A valid reset token is required'),
        body('password').hide().isString().withMessage('password is required and must be a string').bail()
            .isLength({ min: 8, max: 32 }).withMessage('Password must be 8 to 32 characters').bail()
            .custom((password) => password.trim().length > 0).withMessage('Password cannot be blank'),
    ]),
    wrapController(authController.setNewPassword));

export default router;
