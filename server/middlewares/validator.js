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

export default validator;