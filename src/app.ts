import express, { Express, Response, Request } from "express";
import session from "express-session";
import { redisClient } from "./config/redis";
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

  // Session management
  try {
    app.use(
      session({
        store: new ConnectRedisStore({ client: redisClient }),
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
    logger.info("Session middleware configured successfully");
  } catch (error) {
    logger.error(`Session middleware setup failed: ${(error as Error).message}`);
    throw new Error(`Session setup failed: ${(error as Error).message}`);
  }

  const documentRateLimiter = rateLimit({
    store: new RedisStore({
      sendCommand: async (...args: string[]) => {
        return redisClient.sendCommand(args);
      },
      prefix: "rate-limit:documents:",
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    message: { message: "Too many requests to document endpoints, please try again later" } as ErrorResponse,
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
      res.status(options.statusCode).json(options.message);
    },
  });

  // Routes
  app.use("/api/v1/auth", authRoutes(db));
  app.use("/api/v1/documents", documentRoutes(db));
  app.use("/api/v1/webhooks", webhookRoutes(db));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Error handling
  app.use(errorMiddleware);

  return app;
}
