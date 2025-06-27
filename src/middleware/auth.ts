import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Database } from "sqlite";
import { verifyApiKey } from "../services/auth.services";
import { config } from "../env-config";
import { CustomRequest } from "../types/types";
import { logger } from "../utils/logger";

export function authMiddleware(db: Database): RequestHandler {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.split(" ")[1];
    const apiKey = req.headers["x-api-key"] as string;

    if (!token && !apiKey) {
      logger.warn("No token or API key provided");
      res.status(401).json({ message: "No token or API key provided" });
      return;
    }

    try {
      if (token) {
        logger.info(`Verifying JWT token: ${token}`);
        const decoded = jwt.verify(token, config.JWT_SECRET) as { id: number; email: string; role: string };
        req.session.user = decoded;
        next();
      } else if (apiKey) {
        logger.info(`Verifying API key: ${apiKey}`);
        const userId = await verifyApiKey(db, apiKey);
        logger.info(`API key valid, user_id: ${userId}`);
        req.session.user = { id: userId };
        next();
      }
    } catch (error: any) {
      logger.error(`Auth error: ${error.message}`);
      res.status(401).json({ message: "Invalid token or API key" });
    }
  };
}
