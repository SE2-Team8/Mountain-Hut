import { getUser, searchHikers } from "../services/userService.js";
import { responseError, responseSuccess } from "../utils/response.js";

const userController = {
    
    searchHikers: async (req, res) => {
        const hikers = await searchHikers(req.query.value);

        return responseSuccess(res, hikers, "Hikers retrieved");
    },

    get: async (req, res) => {
        const user = await getUser(req.params.userId);

        if (!user) return responseError(res, null, "Not found", 404);

        return responseSuccess(res, user, "User retrieved");
    },

};

export default userController;