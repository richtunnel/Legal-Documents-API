import { Router, Request, Response, NextFunction } from "express";
import { Database } from "sqlite";
import multer from "multer";
import { AutonomousDocumentService } from "../services/autonomous.docs.services";
import { logger } from "../utils/logger";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate } from "../middleware/validate";
import { CustomRequest } from "../types/types";

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export default function documentRoutes(db: Database, documentService?: AutonomousDocumentService): Router {
  const router = Router();

  // Get document service from app locals if not provided
  const getDocumentService = (req: Request): AutonomousDocumentService => {
    return documentService || req.app.locals.services.documents;
  };

  // Upload document
  router.post("/", upload.single("file"), validateDocument, validate, async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: "No file provided",
        });
        return;
      }

      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const service = getDocumentService(req);
      const correlationId = (req as any).correlationId;

      const document = await service.uploadDocument(req.file, req.user.id, correlationId);

      res.status(201).json({
        success: true,
        data: document,
        metadata: {
          correlationId,
          serviceId: service.getServiceId(),
        },
        message: "Document uploaded successfully",
      });
    } catch (error) {
      logger.error("Document upload failed", {
        error: (error as Error).message,
        userId: req.user?.id,
        correlationId: (req as any).correlationId,
      });

      res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  });

  // Get all documents
  router.get("/", async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const service = getDocumentService(req);
      const documents = await service.getDocuments(req.user.id);

      res.json({
        success: true,
        data: documents,
        total: documents.length,
        metadata: {
          serviceId: service.getServiceId(),
          correlationId: (req as any).correlationId,
        },
      });
    } catch (error) {
      logger.error("Failed to get documents", {
        error: (error as Error).message,
        userId: req.user?.id,
        correlationId: (req as any).correlationId,
      });

      res.status(500).json({
        success: false,
        message: "Failed to fetch documents",
      });
    }
  });

  // Get single document
  router.get("/:id", async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        res.status(400).json({
          success: false,
          message: "Invalid document ID",
        });
        return;
      }

      const service = getDocumentService(req);
      const correlationId = (req as any).correlationId;

      const result = await service.getDocument(req.user.id, documentId, correlationId);

      res.setHeader("Content-Type", result.document.mimetype || "application/pdf");
      res.setHeader("Content-Length", result.file.length);
      res.setHeader("Content-Disposition", `inline; filename="${result.document.title}"`);
      res.setHeader("X-Service-ID", service.getServiceId());
      res.send(result.file);
    } catch (error) {
      logger.error("Failed to get document", {
        error: (error as Error).message,
        documentId: req.params.id,
        userId: req.user?.id,
        correlationId: (req as any).correlationId,
      });

      if ((error as Error).message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: "Document not found",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to retrieve document",
        });
      }
    }
  });

  // Delete document
  router.delete("/:id", async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
        return;
      }

      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        res.status(400).json({
          success: false,
          message: "Invalid document ID",
        });
        return;
      }

      const service = getDocumentService(req);
      const correlationId = (req as any).correlationId;

      await service.deleteDocument(req.user.id, documentId, correlationId);

      res.json({
        success: true,
        message: "Document deleted successfully",
        metadata: {
          serviceId: service.getServiceId(),
          correlationId,
        },
      });
    } catch (error) {
      logger.error("Failed to delete document", {
        error: (error as Error).message,
        documentId: req.params.id,
        userId: req.user?.id,
        correlationId: (req as any).correlationId,
      });

      if ((error as Error).message.includes("not found")) {
        res.status(404).json({
          success: false,
          message: "Document not found",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to delete document",
        });
      }
    }
  });

  return router;
}
