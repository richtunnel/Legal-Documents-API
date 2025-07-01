import { Request, Response, NextFunction } from "express";
import Joi from "joi";

// Validation schemas
const webhookSchema = Joi.object({
  url: Joi.string().uri().required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  name: Joi.string().min(1).max(100).required(),
  secret: Joi.string().min(8).required(),
  active: Joi.boolean().default(true),
});

const documentSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
  type: Joi.string().valid("pdf", "doc", "docx", "txt").required(),
  size: Joi.number().max(10485760),
  metadata: Joi.object().optional(),
});

const legalDocSchema = Joi.object({
  documentId: Joi.string().required(),
  documentType: Joi.string().valid("contract", "agreement", "policy", "amendment").required(),
  status: Joi.string().valid("draft", "pending_review", "approved", "signed", "executed", "cancelled").required(),
  clientId: Joi.string().required(),
  metadata: Joi.object({
    title: Joi.string().required(),
    version: Joi.string(),
    createdAt: Joi.date().iso(),
    lastModified: Joi.date().iso(),
    signatories: Joi.array().items(
      Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        role: Joi.string().required(),
        signedAt: Joi.date().iso().allow(null),
      })
    ),
  }).required(),
  ebsReference: Joi.string().allow(null),
  webhookType: Joi.string().valid("document.created", "document.updated", "document.signed", "document.status_changed").required(),
});

const ebsPayloadSchema = Joi.object({
  transactionId: Joi.string().required(),
  sourceSystem: Joi.string().valid("EBS", "SOA").required(),
  operation: Joi.string().valid("CREATE", "UPDATE", "DELETE", "SYNC").required(),
  entityType: Joi.string().valid("CUSTOMER", "CONTRACT", "INVOICE", "PAYMENT").required(),
  entityId: Joi.string().required(),
  data: Joi.object().required(),
  timestamp: Joi.date().iso().required(),
  correlationId: Joi.string().allow(null),
});

// ✅ CORRECT PATTERN - All middleware functions return void and have proper error typing
export function validate(req: Request, res: Response, next: NextFunction): void {
  try {
    const { error } = webhookSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: "Invalid webhook data",
        details: error.details.map((detail) => detail.message),
      });
      return; // ✅ Return void, NOT return res.status()
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
    return;
  }
}

export function validateDocument(req: Request, res: Response, next: NextFunction): void {
  try {
    const { error } = documentSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: "Invalid document data",
        details: error.details.map((detail) => detail.message),
      });
      return; // ✅ Return void, NOT return res.status()
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
    return;
  }
}

export function validateLegalDoc(req: Request, res: Response, next: NextFunction): void {
  try {
    const { error } = legalDocSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: "Invalid legal document payload",
        details: error.details.map((detail) => detail.message),
      });
      return; // ✅ Return void, NOT return res.status()
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
    return;
  }
}

export function validateEBSPayload(req: Request, res: Response, next: NextFunction): void {
  try {
    const { error } = ebsPayloadSchema.validate(req.body);

    if (error) {
      res.status(400).json({
        error: "Invalid EBS payload",
        details: error.details.map((detail) => detail.message),
      });
      return; // ✅ Return void, NOT return res.status()
    }

    next();
  } catch (error: any) {
    res.status(500).json({
      error: "Validation error",
      details: error.message,
    });
    return;
  }
}
