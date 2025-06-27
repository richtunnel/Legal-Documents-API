import { Request, Response } from "express";
import { Database } from "sqlite";
import { uploadDocument, fetchDocuments, fetchDocument } from "../services/document.services";
import { CustomRequest } from "../types/types";

export async function uploadDocumentController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const { title } = req.body;
    const file = req.file?.buffer;
    if (!file) throw new Error("No file uploaded");
    const document = await uploadDocument(db, userId, title, file);
    res.status(201).json(document);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}

export async function getDocumentsController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const documents = await fetchDocuments(db, userId);
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
    const { document, file } = await fetchDocument(db, userId, documentId);
    res.setHeader("Content-Type", "application/pdf");
    res.send(file);
  } catch (error: any) {
    res.status(404).json({ message: error.message });
  }
}
