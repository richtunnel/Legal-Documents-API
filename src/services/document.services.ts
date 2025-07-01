import { Database } from "sqlite";
import { createDocument, getDocuments, getDocumentById } from "../models/documents.model";
import { saveToStorage, getFromStorage } from "./storage.services";
import { Document } from "../types/types";
import { EventType, DocumentEvent } from "../types/events";
import { logger } from "../utils/logger";
import { EventBus } from "../infrastructure/eventBus";

export class DocumentService {
  private webhookService: any;

  constructor(private db: Database, private eventBus: EventBus, private storageService: any, webhookService: any = null, private logger: any) {
    this.webhookService = webhookService;
  }

  async uploadDocument(userId: number, title: string, file: Buffer, correlationId?: string): Promise<Document> {
    try {
      if (!file) {
        throw new Error("File is required");
      }

      // Save to storage
      const blobPath = await saveToStorage(file, title);

      // Create document record
      const document = await createDocument(this.db, userId, title, blobPath);

      // Publish document uploaded event
      await this.eventBus.publish({
        id: "",
        type: EventType.DOCUMENT_UPLOADED,
        timestamp: "",
        version: "1.0",
        source: "document-service",
        correlationId: correlationId || "",
        userId,
        payload: {
          documentId: document.id,
          userId,
          filename: title,
          mimetype: "application/pdf",
          size: file.length,
          action: "upload",
          newState: {
            status: "uploaded",
            blobPath: blobPath,
          },
        },
        metadata: {
          originalFilename: title,
          storageLocation: blobPath,
        },
      } as DocumentEvent);

      // Trigger webhooks
      this.triggerWebhookAsync(userId, "document_uploaded", {
        documentId: document.id,
        title,
      });

      logger.info("Document uploaded successfully", {
        documentId: document.id,
        userId,
        title,
        correlationId,
      });

      return document;
    } catch (error) {
      logger.error(`uploadDocument failed: ${(error as Error).message}`, {
        userId,
        title,
        correlationId,
      });
      throw error;
    }
  }

  async fetchDocuments(userId: number): Promise<Document[]> {
    try {
      const documents = await getDocuments(this.db, userId);

      logger.debug("Documents retrieved", {
        count: documents.length,
        userId,
      });

      return documents;
    } catch (error) {
      logger.error(`fetchDocuments failed: ${(error as Error).message}`, { userId });
      throw error;
    }
  }

  async fetchDocument(userId: number, documentId: number, correlationId?: string): Promise<{ document: Document; file: Buffer }> {
    try {
      // Use your existing logic
      const document = await getDocumentById(this.db, documentId, userId);
      if (!document) {
        throw new Error("Document not found or unauthorized");
      }

      const file = await getFromStorage(document.blob_path);

      // Publish document downloaded event
      await this.eventBus.publish({
        id: "",
        type: EventType.DOCUMENT_DOWNLOADED,
        timestamp: "",
        version: "1.0",
        source: "document-service",
        correlationId: correlationId || "",
        userId,
        payload: {
          documentId,
          userId,
          filename: document.title,
          mimetype: "application/pdf",
          size: file.length,
          action: "download",
          newState: {
            lastAccessed: new Date().toISOString(),
          },
        },
        metadata: {
          blobPath: document.blob_path,
        },
      } as DocumentEvent);

      // Trigger webhooks async
      this.triggerWebhookAsync(userId, "document_fetched", {
        documentId,
        title: document.title,
      });

      logger.info("Document retrieved successfully", {
        documentId,
        userId,
        correlationId,
      });

      return { document, file };
    } catch (error) {
      logger.error(`fetchDocument failed: ${(error as Error).message}`, {
        documentId,
        userId,
        correlationId,
      });
      throw error;
    }
  }

  async deleteDocument(userId: number, documentId: number, correlationId?: string): Promise<void> {
    try {
      // Get document info before deletion
      const document = await getDocumentById(this.db, documentId, userId);
      if (!document) {
        throw new Error("Document not found or unauthorized");
      }

      // Delete from database
      const result = await this.db.run("DELETE FROM documents WHERE id = ? AND user_id = ?", [documentId, userId]);

      if (result.changes === 0) {
        throw new Error("Document not found or unauthorized");
      }

      // Publish document deleted event
      await this.eventBus.publish({
        id: "",
        type: EventType.DOCUMENT_DELETED,
        timestamp: "",
        version: "1.0",
        source: "document-service",
        correlationId: correlationId || "",
        userId,
        payload: {
          documentId,
          userId,
          filename: document.title,
          mimetype: "application/pdf",
          size: 0, // We don't have size in deletion
          action: "delete",
          previousState: {
            status: "uploaded",
            blobPath: document.blob_path,
          },
          newState: {
            status: "deleted",
          },
        },
        metadata: {
          deletedAt: new Date().toISOString(),
        },
      } as DocumentEvent);

      // Trigger webhooks async
      this.triggerWebhookAsync(userId, "document_deleted", {
        documentId,
        title: document.title,
      });

      logger.info("Document deleted successfully", {
        documentId,
        userId,
        correlationId,
      });
    } catch (error) {
      logger.error(`deleteDocument failed: ${(error as Error).message}`, {
        documentId,
        userId,
        correlationId,
      });
      throw error;
    }
  }

  // Async webhook triggering to not block main operations
  private async triggerWebhookAsync(userId: number, eventType: string, payload: any): Promise<void> {
    try {
      if (this.webhookService) {
        await this.webhookService.triggerWebhook(userId, eventType, payload);
      } else {
        this.logger.debug("Webhook service not available, skipping webhook trigger");
      }
    } catch (error) {
      this.logger.warn(`Webhook trigger failed: ${(error as Error).message}`, {
        userId,
        eventType,
        payload,
      });
    }
  }
}
