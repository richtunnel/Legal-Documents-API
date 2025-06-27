import { Database } from "sqlite";
import { createDocument, getDocuments, getDocumentById } from "../models/documents.model";
import { saveToStorage, getFromStorage } from "./storage.services";
import { triggerWebhook } from "./webhooks.services";
import { Document } from "../types/types";
import { logger } from "../utils/logger";

export async function uploadDocument(db: Database, userId: number, title: string, file: Buffer): Promise<Document> {
  try {
    if (!file) {
      throw new Error("File is required");
    }
    const blobPath = await saveToStorage(file, title);
    const document = await createDocument(db, userId, title, blobPath);
    await triggerWebhook(db, userId, "document_uploaded", { documentId: document.id, title }).catch((err) => {
      logger.warn(`Webhook trigger failed: ${err.message}`);
    });
    return document;
  } catch (error) {
    logger.error(`uploadDocument failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function fetchDocuments(db: Database, userId: number): Promise<Document[]> {
  try {
    return await getDocuments(db, userId);
  } catch (error) {
    logger.error(`fetchDocuments failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function fetchDocument(db: Database, userId: number, documentId: number): Promise<{ document: Document; file: Buffer }> {
  try {
    const document = await getDocumentById(db, documentId, userId);
    if (!document) {
      throw new Error("Document not found or unauthorized");
    }
    const file = await getFromStorage(document.blob_path);
    await triggerWebhook(db, userId, "document_fetched", { documentId, title: document.title }).catch((err) => {
      logger.warn(`Webhook trigger failed: ${err.message}`);
    });
    return { document, file };
  } catch (error) {
    logger.error(`fetchDocument failed: ${(error as Error).message}`);
    throw error;
  }
}
