"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocumentController = uploadDocumentController;
exports.getDocumentsController = getDocumentsController;
exports.getDocumentController = getDocumentController;
const document_services_1 = require("../services/document.services");
async function uploadDocumentController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const { title } = req.body;
        const file = req.file?.buffer;
        if (!file)
            throw new Error("No file uploaded");
        const document = await (0, document_services_1.uploadDocument)(db, userId, title, file);
        res.status(201).json(document);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
async function getDocumentsController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const documents = await (0, document_services_1.fetchDocuments)(db, userId);
        res.json(documents);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
async function getDocumentController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const documentId = parseInt(req.params.id);
        const { document, file } = await (0, document_services_1.fetchDocument)(db, userId, documentId);
        res.setHeader("Content-Type", "application/pdf");
        res.send(file);
    }
    catch (error) {
        res.status(404).json({ message: error.message });
    }
}
