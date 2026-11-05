import { getUser } from "../services/userService.js";
import { responseError, responseSuccess } from "../utils/response.js";

const userController = {
    get: async (req, res) => {
        const user = await getUser(req.params.id);

        if (!user) return responseError(res, null, "Not found", 404);

        return responseSuccess(res, user, "User retrieved");
    },
};

export default userController;