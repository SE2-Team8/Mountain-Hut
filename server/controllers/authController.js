import { createHiker, getUserById, getUserFromEmail, getUserFromCredentials, updatePassword } from "../repositories/userRepository.js";
import { completePasswordSetup } from "../services/passwordSetupService.js";
import { responseError, responseSuccess } from "../utils/response.js";
import { sendTemplateEmail } from "../services/smtpService.js";
import { formatDateTime } from "../utils/dateTimeFormatter.js";

const authController = {
    register: async (req, res) => {
        const { email, password, fullName, phone, notes, emergencyContact } = req.body;
		const existingUser = await getUserFromEmail(email);

		if (existingUser != null)
			return responseError(res, null, "Another user with this email is already registered", 409);

        const newUserId = await createHiker(fullName, email, phone, notes?.trim() || null, emergencyContact?.trim() || null, password);
        const newUser = await getUserById(newUserId);

        req.login(newUser, (err) => {
            if (err) throw new Error("Error during automatic login");
            return responseSuccess(res, newUser, "User succesfully registered", 201);
        });
    },

    login: (req, res) => {
        return responseSuccess(res, req.user, "Login succesfull");
    },

    logout: (req, res) => {
        req.logout(() => { responseSuccess(res, null, "Logout succesfull"); });
    },

    getCurrent: (req, res) => {
        if (!req.user) return responseError(res, null, "Not authenticated", 401);
        return responseSuccess(res, req.user, "Current user retrieved");
    },

    setupPassword: async (req, res) => {
        const { token, password } = req.body;
        if (!await completePasswordSetup(token, password)) {
            return responseError(res, null, "This setup link is invalid, expired, or already used.", 400);
        }
        return responseSuccess(res, null, "Password set. You can now log in.");
    },

    changePassword: async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        // business rule: the new password must be different from the current one
        if (newPassword === currentPassword)
            return responseError(res, null, "The new password must be different from the current one", 422);

        // the current password of the logged user must be correct
        const user = await getUserFromCredentials(req.user.email, currentPassword);
        if (!user) return responseError(res, null, "The current password is wrong", 403);

        await updatePassword(user.userId, newPassword);
        const updatedUser = await getUserById(user.userId);

        // notification email: if it cannot be sent, the password is changed anyway
        try {
            await sendTemplateEmail({
                to: updatedUser.email,
                subject: "Your password has been changed",
                templateName: "password-changed",
                data: {
                    user: { fullName: updatedUser.fullName },
                    changedAt: formatDateTime(new Date()),
                },
                text: "The password of your Mountain Hut account has been changed.",
            });
        } catch(error) {
            console.error("Password changed, but the notification email could not be sent:", error);
        }

        // the session keeps a copy of the user: log in again so that mustChangePassword is up to date
        req.login(updatedUser, (err) => {
            if (err) return responseError(res, null, "Password changed, but the session could not be updated", 500);
            return responseSuccess(res, null, "Password successfully changed");
        });
    }
};

export default authController;