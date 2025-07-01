import { Request, Response } from "express";
import { Database } from "sqlite";
import { createApiKey } from "../models/apiKey.model";

export async function loginController(req: Request, res: Response, db: Database) {
  try {
    const { email, password } = req.body;

    // Get AuthService from app.locals
    const authService = (req.app as any).locals.services.auth;
    const result = await authService.login(email, password, req.ip, req.get("User-Agent"));

    req.session.user = { id: result.user.id, email: result.user.email, role: result.user.role };
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
}

export async function registerController(req: Request, res: Response, db: Database) {
  try {
    const { email, password } = req.body;

    // Get AuthService from app.locals
    const authService = (req.app as any).locals.services.auth;
    const result = await authService.register(email, password, "");

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
