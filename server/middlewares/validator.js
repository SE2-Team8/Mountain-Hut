import { validationResult } from "express-validator";
import { responseError } from "../utils/response.js";

function validator(rules) {
    return async (req, res, next) => {
        await Promise.all(rules.map((rule) => rule.run(req)));

        const errors = validationResult(req);

        if (errors.isEmpty()) return next();

        return responseError(res, errors.array(), "Validation failed", 422);
    };
};

function checkAllowedFields(allowedFields){
    return (req, res, next) => {
        if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)){
            return responseError(res, null, "Request body must be a JSON object", 400);
        }

        const extraFields = Object.keys(req.body).filter((key) => !allowedFields.includes(key));
        if (extraFields.length > 0){
            return responseError(res, null, `Unexpected field(s): ${extraFields.join(", ")}`, 422);
        }

        next();
    };
}

export {validator, checkAllowedFields};