import { Request, Response } from "express";
import { Database } from "sqlite";
import { login, register, verifyApiKey } from "../services/auth.services";
import { createApiKey } from "../models/apiKey.model";

export async function loginController(req: Request, res: Response, db: Database) {
  try {
    const { email, password } = req.body;
    const result = await login(db, email, password);
    req.session.user = { id: result.user.id, email: result.user.email, role: result.user.role };
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
}

export async function registerController(req: Request, res: Response, db: Database) {
  try {
    const { email, password } = req.body;
    const result = await register(db, email, password);
    req.session.user = { id: result.user.id, email: result.user.email, role: result.user.role };
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}

export async function generateApiKeyController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const apiKey = await createApiKey(db, userId);
    res.status(201).json(apiKey);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
}
