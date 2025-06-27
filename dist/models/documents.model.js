"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocument = createDocument;
exports.getDocuments = getDocuments;
exports.getDocumentById = getDocumentById;
const logger_1 = require("../utils/logger");
async function createDocument(db, userId, title, blobPath) {
    try {
        if (!userId || typeof userId !== "number") {
            logger_1.logger.error("Invalid or missing user ID");
            throw new Error("User ID is required and must be a number");
        }
        if (!title || typeof title !== "string") {
            logger_1.logger.error("Invalid or missing title");
            throw new Error("Title is required and must be a string");
        }
        if (!blobPath || typeof blobPath !== "string") {
            logger_1.logger.error("Invalid or missing blob path");
            throw new Error("Blob path is required and must be a string");
        }
        const result = await db.run("INSERT INTO documents (user_id, title, blob_path) VALUES (?, ?, ?)", [userId, title, blobPath]);
        if (!result.lastID) {
            logger_1.logger.error("Failed to insert document into database");
            throw new Error("Document creation failed: no ID returned");
        }
        const document = await db.get("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE id = ?", [result.lastID]);
        if (!document || !document.id) {
            logger_1.logger.error("Failed to retrieve created document");
            throw new Error("Document retrieval failed");
        }
        logger_1.logger.info(`Document created successfully: ${title} for user ${userId}`);
        return document;
    }
    catch (error) {
        logger_1.logger.error(`createDocument failed: ${error.message}`);
        throw error;
    }
}
async function getDocuments(db, userId) {
    try {
        if (!userId || typeof userId !== "number") {
            logger_1.logger.error("Invalid or missing user ID");
            throw new Error("User ID is required and must be a number");
        }
        const documents = await db.all("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE user_id = ?", [userId]);
        logger_1.logger.info(`Fetched ${documents.length} documents for user ${userId}`);
        return documents;
    }
    catch (error) {
        logger_1.logger.error(`getDocuments failed: ${error.message}`);
        throw error;
    }
}
async function getDocumentById(db, documentId, userId) {
    try {
        if (!documentId || typeof documentId !== "number") {
            logger_1.logger.error("Invalid or missing document ID");
            throw new Error("Document ID is required and must be a number");
        }
        if (!userId || typeof userId !== "number") {
            logger_1.logger.error("Invalid or missing user ID");
            throw new Error("User ID is required and must be a number");
        }
        const document = await db.get("SELECT id, user_id, title, blob_path, created_at FROM documents WHERE id = ? AND user_id = ?", [documentId, userId]);
        if (!document) {
            logger_1.logger.info(`No document found with ID ${documentId} for user ${userId}`);
            return null;
        }
        return document;
    }
    catch (error) {
        logger_1.logger.error(`getDocumentById failed: ${error.message}`);
        throw error;
    }
}
