import { Router, Response, NextFunction } from "express";
import { Database } from "sqlite";
import multer from "multer";
import { uploadDocument, fetchDocuments, fetchDocument } from "../services/document.services";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate } from "../middleware/validate";
import { CustomRequest, ErrorResponse } from "../types/types";
import { logger } from "../utils/logger";
import { uploadDocumentController } from "../controllers/documentController";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Optional: Add file type validation
    const allowedMimeTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/jpeg", "image/png"];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export default function documentRoutes(db: Database) {
  const router = Router();

  // Apply authMiddleware to all routes
  router.use(authMiddleware(db));

  // Upload document route
  router.post("/", upload.single("file"), validateDocument, validate, async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await uploadDocumentController(req, res, db);
    } catch (error: any) {
      logger.error(`Upload document failed: ${error.message}`, {
        userId: req.session.user?.id,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        error: error.stack,
      });

      // Handle specific multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({
          message: "File too large. Maximum size is 10MB.",
        } as ErrorResponse);
        return;
      }

      if (error.message.includes("File type") && error.message.includes("not allowed")) {
        res.status(400).json({
          message: error.message,
        } as ErrorResponse);
        return;
      }

      res.status(400).json({
        message: error.message || "Failed to upload document",
      } as ErrorResponse);
    }
  });

  // Get all documents route
  router.get("/", async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        logger.warn("Unauthorized access to get documents", {
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        });
        res.status(401).json({
          message: "Unauthorized",
        } as ErrorResponse);
        return;
      }

      const documents = await fetchDocuments(db, userId);
      logger.info(`Fetched ${documents.length} documents for user ${userId}`);

      res.json({
        success: true,
        data: documents,
        total: documents.length,
      });
    } catch (error: any) {
      logger.error(`Get documents failed: ${error.message}`, {
        userId: req.session.user?.id,
        error: error.stack,
      });
      res.status(500).json({
        message: "Failed to fetch documents",
      } as ErrorResponse);
    }
  });

  // Get single document route
  router.get("/:id", async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        logger.warn("Unauthorized access to get document", {
          documentId: req.params.id,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        });
        res.status(401).json({
          message: "Unauthorized",
        } as ErrorResponse);
        return;
      }

      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        logger.error("Invalid document ID provided", {
          providedId: req.params.id,
          userId,
        });
        res.status(400).json({
          message: "Invalid document ID",
        } as ErrorResponse);
        return;
      }

      const { document, file } = await fetchDocument(db, userId, documentId);

      logger.info(`Document ${documentId} retrieved successfully`, {
        userId,
        documentTitle: document.title,
        fileSize: file.length,
      });

      // Set proper headers for file download
      res.setHeader("Content-Type", document.mimeType || "application/pdf");
      res.setHeader("Content-Length", file.length);
      res.setHeader("Content-Disposition", `inline; filename="${document.title}"`);
      res.setHeader("Cache-Control", "private, max-age=3600"); // Cache for 1 hour

      res.send(file);
    } catch (error: any) {
      logger.error(`Get document failed: ${error.message}`, {
        documentId: req.params.id,
        userId: req.session.user?.id,
        error: error.stack,
      });

      if (error.message.includes("not found") || error.message.includes("Document not found")) {
        res.status(404).json({
          message: "Document not found",
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        message: "Failed to retrieve document",
      } as ErrorResponse);
    }
  });

  // Optional: Add a route to get document metadata only (without file content)
  router.get("/:id/metadata", async (req: CustomRequest, res: Response): Promise<void> => {
    try {
      const userId = req.session.user?.id;
      if (!userId) {
        res.status(401).json({
          message: "Unauthorized",
        } as ErrorResponse);
        return;
      }

      const documentId = parseInt(req.params.id);
      if (isNaN(documentId)) {
        res.status(400).json({
          message: "Invalid document ID",
        } as ErrorResponse);
        return;
      }

      // Assuming you have a service method to get metadata only
      // If not, you can modify fetchDocument to have an option for metadata only
      const { document } = await fetchDocument(db, userId, documentId);

      // Return only metadata, not the file
      const metadata = {
        id: document.id,
        title: document.title,
        mimeType: document.mimeType,
        size: document.size,
        uploadedAt: document.created_at,
        // Add other metadata fields as needed
      };

      res.json({
        success: true,
        data: metadata,
      });
    } catch (error: any) {
      logger.error(`Get document metadata failed: ${error.message}`, {
        documentId: req.params.id,
        userId: req.session.user?.id,
        error: error.stack,
      });

      if (error.message.includes("not found")) {
        res.status(404).json({
          message: "Document not found",
        } as ErrorResponse);
        return;
      }

      res.status(500).json({
        message: "Failed to retrieve document metadata",
      } as ErrorResponse);
    }
  });

  return router;
}
