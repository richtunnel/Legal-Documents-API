import { Request, Response, NextFunction } from "express";
import { validationResult, check, body } from "express-validator";
import { CustomRequest, ErrorResponse } from "../types/types";

import { logger } from "../utils/logger";

// Validation rules for document upload
export const validateDocument = [body("title").trim().notEmpty().withMessage("Title is required").isLength({ max: 255 }).withMessage("Title must be less than 255 characters")];

// Middleware to check validation results
export const validate = (req: CustomRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorResponse: ErrorResponse = {
      message: "Validation failed",
      errors: errors.array(),
    };
    logger.warn(`Validation failed: ${JSON.stringify(errorResponse.errors)}`);
    res.status(400).json(errorResponse);
    return;
  }
  next();
};
