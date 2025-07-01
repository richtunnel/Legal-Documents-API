import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Database } from "sqlite";
import { AuthService } from "../services/auth.services";
import { config } from "../env-config";
import { CustomRequest } from "../types/types";
import { logger } from "../utils/logger";
import { EventBus } from "../infrastructure/eventBus";

export function authMiddleware(db: Database, authService?: AuthService): RequestHandler {
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

        // Initialize session if it doesn't exist
        if (!req.session) {
          req.session = {} as any;
        }
        req.session.user = decoded;

        // Also add user directly to req for easier access
        req.user = decoded;
        next();
        return;
      } else if (apiKey) {
        logger.info(`Verifying API key: ${apiKey}`);
        const authServiceFromApp = (req as any).app?.locals?.services?.auth;

        // Create AuthService instance if not provided
        if (!authServiceFromApp) {
          logger.error("AuthService not available in app.locals");
          res.status(500).json({ message: "Authentication service unavailable" });
          return;
        }

        // Get IP address for the service call
        const ipAddress = req.ip || req.connection.remoteAddress || "unknown";

        // Call the AuthService method with correct parameters
        const userId = await authServiceFromApp.verifyApiKey(apiKey, ipAddress);
        logger.info(`API key valid, user_id: ${userId}`);

        // Fetch user details from database to get email and other info
        const user = await db.get("SELECT id, email, role FROM users WHERE id = ?", [userId]);

        if (!user) {
          logger.error(`User not found for ID: ${userId}`);
          res.status(401).json({ message: "User not found" });
          return;
        }

        // Initialize session if it doesn't exist
        if (!req.session) {
          req.session = {} as any;
        }
        req.session.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };

        // Also add user directly to req for easier access
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
        next();
        return;
      }

      // If neither token nor API key worked
      res.status(401).json({ message: "No valid authentication provided" });
      return;
    } catch (error: any) {
      logger.error(`Auth error: ${error.message}`);
      res.status(401).json({ message: "Invalid token or API key" });
      return;
    }
  };
}
