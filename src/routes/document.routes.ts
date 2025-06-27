import { Router, Response, NextFunction } from "express";
import { Database } from "sqlite";
import multer from "multer";
import { uploadDocument, fetchDocuments, fetchDocument } from "../services/document.services";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate } from "../middleware/validate";
import { CustomRequest, ErrorResponse } from "../types/types";
import { logger } from "../utils/logger";
import { uploadDocumentController } from "../controllers/documentController";
import rateLimit from "express-rate-limit";
import { redisClient } from "../config/redis";
import RedisStore from "rate-limit-redis";

// Configure multer with memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Rate limiter for uploads
const uploadRateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: async (...args: string[]) => {
      return redisClient.sendCommand(args);
    },
    prefix: "rate-limit:documents:upload:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per IP
  message: { message: "Too many document uploads, please try again later" } as ErrorResponse,
  handler: (req: CustomRequest, res, next, options) => {
    logger.warn(`Upload rate limit exceeded for IP ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
});

export default function documentRoutes(db: Database) {
  const router = Router();

  // Apply authMiddleware to all routes
  router.use(authMiddleware(db));

  // Upload document route
  router.post("/", uploadRateLimiter, upload.single("file"), validateDocument, validate, (req: CustomRequest, res: Response, next: NextFunction) => {
    uploadDocumentController(req, res, db).catch((error: any) => {
      logger.error(`Upload document failed: ${error.message}`);
      res.status(400).json({ message: error.message } as ErrorResponse);
    });
  });

  // Get all documents route
  router.get("/", async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        logger.warn("Unauthorized access to get documents");
        throw new Error("Unauthorized");
      }
      const documents = await fetchDocuments(db, userId);
      res.json(documents);
    } catch (error: any) {
      logger.error(`Get documents failed: ${error.message}`);
      res.status(400).json({ message: error.message } as ErrorResponse);
    }
  });

  // Get single document route
  router.get("/:id", async (req: CustomRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        logger.warn("Unauthorized access to get document");
        throw new Error("Unauthorized");
      }
      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        logger.error("Invalid document ID");
        throw new Error("Invalid document ID");
      }
      const { document, file } = await fetchDocument(db, userId, documentId);
      res.setHeader("Content-Type", "application/pdf");
      res.send(file);
    } catch (error: any) {
      logger.error(`Get document failed: ${error.message}`);
      res.status(404).json({ message: error.message } as ErrorResponse);
    }
  });

  return router;
}
