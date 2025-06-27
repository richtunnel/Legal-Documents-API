import { Database } from "sqlite";
import { Document } from "../types/types";
import { logger } from "../utils/logger";

export async function createDocument(db: Database, userId: number, title: string, blobPath: string): Promise<Document> {
  try {
    if (!userId || typeof userId !== "number") {
      logger.error("Invalid or missing user ID");
      throw new Error("User ID is required and must be a number");
    }
    if (!title || typeof title !== "string") {
      logger.error("Invalid or missing title");
      throw new Error("Title is required and must be a string");
    }
    if (!blobPath || typeof blobPath !== "string") {
      logger.error("Invalid or missing blob path");
      throw new Error("Blob path is required and must be a string");
    }

    const result = await db.run("INSERT INTO documents (user_id, title, blob_path) VALUES (?, ?, ?)", [userId, title, blobPath]);

    if (!result.lastID) {
      logger.error("Failed to insert document into database");
      throw new Error("Document creation failed: no ID returned");
    }

    const document = await db.get<Document>("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE id = ?", [result.lastID]);

    if (!document || !document.id) {
      logger.error("Failed to retrieve created document");
      throw new Error("Document retrieval failed");
    }

    logger.info(`Document created successfully: ${title} for user ${userId}`);
    return document;
  } catch (error) {
    logger.error(`createDocument failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function getDocuments(db: Database, userId: number): Promise<Document[]> {
  try {
    if (!userId || typeof userId !== "number") {
      logger.error("Invalid or missing user ID");
      throw new Error("User ID is required and must be a number");
    }

    const documents = await db.all<Document[]>("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE user_id = ?", [userId]);

    logger.info(`Fetched ${documents.length} documents for user ${userId}`);
    return documents;
  } catch (error) {
    logger.error(`getDocuments failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function getDocumentById(db: Database, documentId: number, userId: number): Promise<Document | null> {
  try {
    if (!documentId || typeof documentId !== "number") {
      logger.error("Invalid or missing document ID");
      throw new Error("Document ID is required and must be a number");
    }
    if (!userId || typeof userId !== "number") {
      logger.error("Invalid or missing user ID");
      throw new Error("User ID is required and must be a number");
    }

    const document = await db.get<Document>("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE id = ? AND user_id = ?", [documentId, userId]);

    if (!document) {
      logger.info(`No document found with ID ${documentId} for user ${userId}`);
      return null;
    }

    return document;
  } catch (error) {
    logger.error(`getDocumentById failed: ${(error as Error).message}`);
    throw error;
  }
}
