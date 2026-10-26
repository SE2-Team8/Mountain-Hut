import { responseError } from "../utils/response.js";

function isAuthenticated(req, res, next) {

    /* 
    Write actual isAuthenticated logic here(I wrote `true` temporarily).
    For example, if you are using `passport` package, it would be something like this:
        if (req.isAuthenticated()) return next();
     */
    if (true) return next();

    return responseError(res, null, 'Not Authenticated!', 401);
}

export default isAuthenticated;