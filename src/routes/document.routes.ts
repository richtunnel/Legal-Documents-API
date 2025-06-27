import { Router, Response, NextFunction } from "express";
import { Database } from "sqlite";
import multer from "multer";
import { uploadDocument, fetchDocuments, fetchDocument } from "../services/document.services";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate } from "../middleware/validate";
import { CustomRequest, ErrorResponse } from "../types/types";
import { logger } from "../utils/logger";
import { uploadDocumentController } from "../controllers/documentController";

// Configure multer with memory storage
const upload = multer({ storage: multer.memoryStorage() });

export default function documentRoutes(db: Database) {
  const router = Router();

  // Apply authMiddleware to all routes
  router.use(authMiddleware(db));

  // Upload document route
  router.post("/", upload.single("file"), validateDocument, validate, (req: CustomRequest, res: Response, next: NextFunction) => {
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
