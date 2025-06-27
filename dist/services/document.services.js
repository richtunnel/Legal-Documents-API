"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = uploadDocument;
exports.fetchDocuments = fetchDocuments;
exports.fetchDocument = fetchDocument;
const documents_model_1 = require("../models/documents.model");
const storage_services_1 = require("./storage.services");
const webhooks_services_1 = require("./webhooks.services");
const logger_1 = require("../utils/logger");
async function uploadDocument(db, userId, title, file) {
    try {
        if (!file) {
            throw new Error("File is required");
        }
        const blobPath = await (0, storage_services_1.saveToStorage)(file, title);
        const document = await (0, documents_model_1.createDocument)(db, userId, title, blobPath);
        await (0, webhooks_services_1.triggerWebhook)(db, userId, "document_uploaded", { documentId: document.id, title }).catch((err) => {
            logger_1.logger.warn(`Webhook trigger failed: ${err.message}`);
        });
        return document;
    }
    catch (error) {
        logger_1.logger.error(`uploadDocument failed: ${error.message}`);
        throw error;
    }
}
async function fetchDocuments(db, userId) {
    try {
        return await (0, documents_model_1.getDocuments)(db, userId);
    }
    catch (error) {
        logger_1.logger.error(`fetchDocuments failed: ${error.message}`);
        throw error;
    }
}
async function fetchDocument(db, userId, documentId) {
    try {
        const document = await (0, documents_model_1.getDocumentById)(db, documentId, userId);
        if (!document) {
            throw new Error("Document not found or unauthorized");
        }
        const file = await (0, storage_services_1.getFromStorage)(document.blob_path);
        await (0, webhooks_services_1.triggerWebhook)(db, userId, "document_fetched", { documentId, title: document.title }).catch((err) => {
            logger_1.logger.warn(`Webhook trigger failed: ${err.message}`);
        });
        return { document, file };
    }
    catch (error) {
        logger_1.logger.error(`fetchDocument failed: ${error.message}`);
        throw error;
    }
}
