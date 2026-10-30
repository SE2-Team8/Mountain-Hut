import { createHiker } from "../repositories/userRepository.js";
import { responseError, responseSuccess } from "../utils/response.js";

const authController = {
    register: async (req, res) => {
        const { psw, fullName, email, phone, notes, emergencyContact } = req.body;
        const newUser = await createHiker(psw, fullName, email, phone, notes, emergencyContact);

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