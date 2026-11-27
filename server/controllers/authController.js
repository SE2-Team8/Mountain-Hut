import { createHiker, getUserById, getUserFromEmail, getUserFromCredentials, updatePassword } from "../repositories/userRepository.js";
import { completePasswordSetup, sendPasswordResetEmail, findPasswordResetToken, 
    discardPasswordResetToken, completePasswordReset } from "../services/passwordService.js";
import { responseError, responseSuccess } from "../utils/response.js";
import { sendTemplateEmail } from "../services/smtpService.js";
import { formatDateTime } from "../utils/dateTimeFormatter.js";

// sends the "your password has been changed" email
async function sendPasswordChangedEmail(user) {
    try {
        await sendTemplateEmail({
            to: user.email,
            subject: "Your password has been changed",
            templateName: "password-changed",
            data: {
                user: { fullName: user.fullName },
                changedAt: formatDateTime(new Date()),
            },
            text: "The password of your Mountain Hut account has been changed.",
        });
    } catch (error) {
        console.error("Password changed, but the notification email could not be sent:", error);
    }
}

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

        // the current password of the logged user must be correct
        const user = await getUserFromCredentials(req.user.email, currentPassword);
        if (!user) return responseError(res, null, "The current password is wrong", 403);

        // business rule: the new password must be different from the current one
        if (newPassword === currentPassword)
            return responseError(res, null, "The new password must be different from the current one", 422);

        await updatePassword(user.userId, newPassword);
        const updatedUser = await getUserById(user.userId);

        await sendPasswordChangedEmail(updatedUser);

        // the session keeps a copy of the user: log in again so that mustChangePassword is up to date
        req.login(updatedUser, (err) => {
            if (err) return responseError(res, null, "Password changed, but the session could not be updated", 500);
            return responseSuccess(res, null, "Password successfully changed");
        });
    },

    forgotPassword: async (req, res) => {
        const user = await getUserFromEmail(req.body.email);

        if (user) {
            try {
                await sendPasswordResetEmail(user);
            } catch (error) {
                console.error("The password reset email could not be sent:", error);
            }
        }

        return responseSuccess(res, null, "If the email is registered, a link to reset the password has been sent");
    },

    // sets a new password using the token received by email
    setNewPassword: async (req, res) => {
        const { token, password } = req.body;

        const resetToken = await findPasswordResetToken(token);
        if (!resetToken)
            return responseError(res, null, "The reset link is not valid or has already been used", 400);

        // business rule: a reset link is valid for 15 minutes
        if (resetToken.expiresAt <= Date.now()) {
            await discardPasswordResetToken(resetToken.userId);
            return responseError(res, null, "The reset link has expired, ask for a new one", 409);
        }

        // if another request has just used the same token, nothing changes
        if (!await completePasswordReset(token, password))
            return responseError(res, null, "The reset link is not valid or has already been used", 400);

        await sendPasswordChangedEmail(await getUserById(resetToken.userId));

        return responseSuccess(res, null, "Password successfully set");
    }
};

export default authController;