import { getUser, searchHikers } from "../services/userService.js";
import { responseError, responseSuccess } from "../utils/response.js";
import { createHiker, getUserFromEmail, getUserById } from "../repositories/userRepository.js";
import { sendPasswordSetupEmail } from "../services/passwordService.js";

const userController = {
    
    searchHikers: async (req, res) => {
        const hikers = await searchHikers(req.query.value.trim());

        return responseSuccess(res, hikers, "Hikers retrieved");
    },

    get: async (req, res) => {
        const user = await getUser(req.params.userId);

        if (!user) return responseError(res, null, "Not found", 404);

        return responseSuccess(res, user, "User retrieved");
    },

    post: async (req, res) => {
        const { email, fullName, phone, notes, emergencyContact } = req.body;
        const existingUser = await getUserFromEmail(email);

        if (existingUser != null) return responseError(res, null, "Another user with this email is already registered", 409);

        const newUserId = await createHiker(fullName, email, phone, notes?.trim() || null, emergencyContact?.trim() || null);
        const newUser = await getUserById(newUserId);

        if (newUser == null) return responseError(res, null, "Error during creation of new user", 500);

        const passwordSetupEmailSent = await sendPasswordSetupEmail(newUser).catch(() => {
            console.error(`Could not send a password setup email for user ${newUserId}.`);
            return false;
        });
        const message = passwordSetupEmailSent
            ? "Hiker created and password setup email sent"
            : "Hiker created. Password setup email delivery failed.";
        return responseSuccess(res, { ...newUser, passwordSetupEmailSent }, message, 201);
    }

};

export default userController;