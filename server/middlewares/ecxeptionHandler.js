import { responseError } from "../utils/response.js";

function ecxeptionHandler(error, req, res, next) {
    console.error("Ecxeption Handler:", error.message, error.stack);

    return responseError(res, null, error.message || "Internal Server Error", error.statusCode || 500);
}

export default ecxeptionHandler;