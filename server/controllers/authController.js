import { createHiker, getUserById } from "../repositories/userRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";

const authController = {
    register: async (req, res) => {
        const { email, password, fullName, phone, notes, emergencyContact } = req.body;
        const newUserId = await createHiker(password, fullName, email, phone, notes, emergencyContact);
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
    }
};

export default authController;