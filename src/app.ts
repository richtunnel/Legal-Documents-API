import express, { Express, Response, Request } from "express";
import session from "express-session";
import { redisClient, isRedisConnected } from "./config/redis";
import { RedisStore as ConnectRedisStore } from "connect-redis";
import helmet from "helmet";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";
import authRoutes from "./routes/auth.routes";
import documentRoutes from "./routes/document.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { errorMiddleware } from "./middleware/errors";
import { Database } from "sqlite";
import { logger } from "./utils/logger";
import { config } from "./env-config";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { ErrorResponse } from "./types/types";

export default function createApp(db: Database): Express {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
        },
      },
    })
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session management - only if Redis is connected
  if (isRedisConnected()) {
    try {
      app.use(
        session({
          store: new ConnectRedisStore({
            client: redisClient,
            prefix: "session:",
          }),
          secret: config.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: config.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
          },
        })
      );
      logger.info("Session middleware configured successfully with Redis store");
    } catch (error) {
      logger.error(`Session middleware setup failed: ${(error as Error).message}`);
      // Fallback to memory store
      app.use(
        session({
          secret: config.SESSION_SECRET,
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: config.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
          },
        })
      );
      logger.warn("Using memory store for sessions as fallback");
    }
  } else {
    // Fallback to memory store if Redis is not connected
    app.use(
      session({
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: config.NODE_ENV === "production",
          httpOnly: true,
          sameSite: "strict",
          maxAge: 24 * 60 * 60 * 1000,
        },
      })
    );
    logger.warn("Redis not connected, using memory store for sessions");
  }

  // Rate limiting - with Redis fallback
  let documentRateLimiter;

  if (isRedisConnected()) {
    try {
      documentRateLimiter = rateLimit({
        store: new RedisStore({
          sendCommand: (...args: string[]) => redisClient.sendCommand(args),
          prefix: "rate-limit:documents:",
        }),
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per IP
        message: {
          message: "Too many requests to document endpoints, please try again later",
        } as ErrorResponse,
        handler: (req, res, next, options) => {
          logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
          res.status(options.statusCode).json(options.message);
        },
        // Add error handling for Redis store
        onLimitReached: (req, res, options) => {
          logger.warn(`Rate limit reached for IP ${req.ip}`);
        },
        skip: (req) => {
          // Skip rate limiting if Redis is down
          if (!isRedisConnected()) {
            logger.warn("Redis disconnected, skipping rate limiting");
            return true;
          }
          return false;
        },
      });
      logger.info("Rate limiter configured with Redis store");
    } catch (error) {
      logger.error(`Redis rate limiter setup failed: ${(error as Error).message}`);
      // Fallback to memory store
      documentRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: {
          message: "Too many requests to document endpoints, please try again later",
        } as ErrorResponse,
        handler: (req, res, next, options) => {
          logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
          res.status(options.statusCode).json(options.message);
        },
      });
      logger.warn("Using memory store for rate limiting as fallback");
    }
  } else {
    // Fallback to memory-based rate limiting
    documentRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        message: "Too many requests to document endpoints, please try again later",
      } as ErrorResponse,
      handler: (req, res, next, options) => {
        logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
        res.status(options.statusCode).json(options.message);
      },
    });
    logger.warn("Redis not connected, using memory store for rate limiting");
  }

  // Routes
  app.use("/api/v1/auth", authRoutes(db));
  app.use("/api/v1/documents", documentRateLimiter, documentRoutes(db));
  app.use("/api/v1/webhooks", webhookRoutes(db));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    const redisStatus = isRedisConnected() ? "connected" : "disconnected";
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      redis: redisStatus,
    });
  });

  // Error handling
  app.use(errorMiddleware);

  return app;
}
