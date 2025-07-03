import { Router, Request, Response } from "express";
import { Database } from "sqlite";
import { AuthService } from "../services/auth.services";
import { logger } from "../utils/logger";
import { CustomRequest } from "../types/types";

export default function authRoutes(db: Database, authService?: AuthService): Router {
  const router = Router();

  // Get enhanced auth service from app locals if not provided
  const getAuthService = (req: Request): AuthService => {
    return authService || req.app.locals.services.auth;
  };

  // Register endpoint
  router.post("/register", async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password || !name) {
        res.status(400).json({
          success: false,
          message: "Email, password, and name are required",
        });
        return;
      }

      const service = getAuthService(req);
      const result = await service.register(email, password, name);

      // Set refresh token as httpOnly cookie
      res.cookie("refreshToken", result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          apiKey: result.apiKey,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
        message: "User registered successfully",
      });
    } catch (error) {
      logger.error("Registration failed", {
        error: (error as Error).message,
        correlationId: (req as any).correlationId,
      });

      res.status(400).json({
        success: false,
        message: (error as Error).message,
      });
    }
  });

  // Login endpoint
  router.post("/login", async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || "unknown";
      const userAgent = req.get("User-Agent") || "unknown";

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
        return;
      }

      const service = getAuthService(req);
      const result = await service.login(email, password, ipAddress, userAgent);

      // Set refresh token as httpOnly cookie
      res.cookie("refreshToken", result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.tokens.accessToken,
          expiresIn: result.tokens.expiresIn,
        },
        message: "Login successful",
      });
    } catch (error) {
      logger.error("Login failed", {
        error: (error as Error).message,
        correlationId: (req as any).correlationId,
      });

      res.status(401).json({
        success: false,
        message: (error as Error).message,
      });
    }
  });

  // Refresh token endpoint
  router.post("/refresh-token", async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: "Refresh token required",
        });
        return;
      }

      const service = getAuthService(req);
      const tokens = await service.refreshToken(refreshToken);

      // Set new refresh token as httpOnly cookie
      res.cookie("refreshToken", tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          expiresIn: tokens.expiresIn,
        },
        message: "Token refreshed successfully",
      });
    } catch (error) {
      logger.error("Token refresh failed", {
        error: (error as Error).message,
        correlationId: (req as any).correlationId,
      });

      res.status(401).json({
        success: false,
        message: (error as Error).message,
      });
    }
  });

  // Logout endpoint
  router.post("/logout", async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        const service = getAuthService(req);
        await service.revokeToken(refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie("refreshToken");

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout failed", {
        error: (error as Error).message,
        correlationId: (req as any).correlationId,
      });

      res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }
  });

  // Verify API key endpoint
  router.post("/verify-api-key", async (req: Request, res: Response): Promise<void> => {
    try {
      const { apiKey } = req.body;
      const ipAddress = req.ip;

      if (!apiKey) {
        res.status(400).json({
          success: false,
          message: "API key required",
        });
        return;
      }

      const service = getAuthService(req);
      const userId = await service.verifyApiKey(apiKey, ipAddress);

      res.json({
        success: true,
        data: { userId },
        message: "API key verified",
      });
    } catch (error) {
      logger.error("API key verification failed", {
        error: (error as Error).message,
        correlationId: (req as any).correlationId,
      });

      res.status(401).json({
        success: false,
        message: (error as Error).message,
      });
    }
  });

  return router;
}
