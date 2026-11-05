import { responseError } from "../utils/response.js";

function isAuthenticated(req, res, next) {

    // using passport request.isAuthenticated()
    if(req.isAuthenticated()) return next();

    return responseError(res, null, 'Not Authenticated!', 401);
}

export default isAuthenticated;