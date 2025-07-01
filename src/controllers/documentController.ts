import { Request, Response } from "express";
import { Database } from "sqlite";
import { CustomRequest } from "../types/types";

export async function uploadDocumentController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const { title } = req.body;
    const file = req.file?.buffer;
    if (!file) throw new Error("No file uploaded");

    // Get DocumentService from app.locals
    const documentService = (req.app as any).locals.services.documents;
    const correlationId = (req as any).correlationId;
    const document = await documentService.uploadDocument(userId, title, file, correlationId);

    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}

export async function getDocumentsController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");

    // Get DocumentService from app.locals
    const documentService = (req.app as any).locals.services.documents;
    const documents = await documentService.getDocuments(userId);

    res.json(documents);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}

export async function getDocumentController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const documentId = parseInt(req.params.id);

    // Get DocumentService from app.locals
    const documentService = (req.app as any).locals.services.documents;
    const correlationId = (req as any).correlationId;
    const { document, file } = await documentService.getDocument(userId, documentId, correlationId);

    res.setHeader("Content-Type", "application/pdf");
    res.send(file);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
}
