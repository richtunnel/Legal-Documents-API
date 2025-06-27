import { login, register } from "../services/auth.services";
import { CustomRequest, ErrorResponse, AuthResponse } from "../types/types";
import { logger } from "../utils/logger";
import { Database } from "sqlite";
import { Router, Response, NextFunction } from "express";
import { verifyApiKey } from "../services/auth.services";

const router = Router();

export default function authRoutes(db: Database) {
  // Login route
  router.post("/login", async (req: CustomRequest, res: Response<AuthResponse | ErrorResponse>, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await login(db, email, password);
      res.json(result);
    } catch (error) {
      logger.error(`Login route failed: ${(error as Error).message}`);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  // Verify API key route
  router.post("/verify-api-key", async (req: CustomRequest, res: Response<{ userId: number } | ErrorResponse>, next: NextFunction) => {
    try {
      const { apiKey } = req.body;
      const userId = await verifyApiKey(db, apiKey);
      res.json({ userId });
    } catch (error) {
      logger.error(`Verify API key route failed: ${(error as Error).message}`);
      res.status(400).json({ message: (error as Error).message });
    }
  });

  return router;
}
