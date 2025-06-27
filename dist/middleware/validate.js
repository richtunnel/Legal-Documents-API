"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.validateDocument = void 0;
const express_validator_1 = require("express-validator");
const logger_1 = require("../utils/logger");
// Validation rules for document upload
exports.validateDocument = [(0, express_validator_1.body)("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 255 }).withMessage("Title must be less than 255 characters")];
// Middleware to check validation results
const validate = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const errorResponse = {
            message: "Validation failed",
            errors: errors.array(),
        };
        logger_1.logger.warn(`Validation failed: ${JSON.stringify(errorResponse.errors)}`);
        res.status(400).json(errorResponse);
        return;
    }
    next();
};
exports.validate = validate;
