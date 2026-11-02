import { check, validationResult } from "express-validator";
import { responseError } from "../utils/response.js";
import { response } from "express";

function validator(rules) {
    return async (req, res, next) => {
        await Promise.all(rules.map((rule) => rule.run(req)));

        const errors = validationResult(req);

        if (errors.isEmpty()) return next();

        return responseError(res, errors.array(), "Validation failed", 422);
    };
};

function checkBodyLength(expectedLength){
    return (req, res, next) => {
        const actualLength = Object.keys(req.body).length;
        if (actualLength !== expectedLength){
            return responseError(res, null, `Body must contain exactly ${expectedLength} fields`, 400);
        }
        next();
    }
}

export default {validator, checkBodyLength};