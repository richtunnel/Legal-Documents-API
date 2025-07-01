import express, { Express, Response, Request } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
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
import { ErrorResponse, ServiceCapability } from "./types/types";
import { EventType } from "./types/events";

// SOA/EBS Infrastructure
import { EventBus, generateEventIdMiddleware, timestampMiddleware, correlationMiddleware } from "./infrastructure/eventBus";
import { AuthService } from "./services/auth.services";
import { DocumentServiceRegistry } from "./services/registry.services";
import { AutonomousDocumentService } from "./services/autonomous.docs.services";
import { NotificationService } from "./services/notifications.services";
import { WebhookService } from "./services/webhooks.services";

const serviceCapability: ServiceCapability = {
  name: "AutonomousDocumentService",
  version: "1.0.0",
  description: "AI-powered document processing and analysis service",
  dependencies: ["sqlite", "express", "multer", "joi"],
};

export default async function createApp(db: Database): Promise<Express> {
  const app = express();

  logger.info("Starting Legal Documents API v6 with SOA/EBS...");

  /** SOA/EBS INFRASTRUCTURE INITIALIZATION **/

  // Initialize Event Bus
  const eventBus = new EventBus(redisClient, logger);
  eventBus.use(generateEventIdMiddleware);
  eventBus.use(timestampMiddleware);
  eventBus.use(correlationMiddleware);

  // Initialize Enhanced Services
  const authService = new AuthService(db, eventBus, logger);
  const serviceRegistry = new DocumentServiceRegistry(eventBus, logger);
  const documentService = new AutonomousDocumentService(db, serviceRegistry, eventBus, {} as ServiceCapability);
  const notificationService = new NotificationService(eventBus, serviceRegistry, logger);
  // const webhookService = new WebhookService(db, eventBus, logger);

  // Start Autonomous Services
  try {
    await documentService.start();
    await notificationService.start();
    logger.info("All autonomous services started successfully");
  } catch (error) {
    logger.error("Failed to start autonomous services", { error: (error as Error).message });
    // Continue anyway - services can start later
  }

  // Store services in app locals for route access
  app.locals.services = {
    auth: authService,
    documents: documentService,
    notifications: notificationService,
    // webhooks: webhookService,
    eventBus: eventBus,
    serviceRegistry: serviceRegistry,
  };

  // ============================================
  // SECURITY & MIDDLEWARE
  // ============================================

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

  app.use(compression());
  app.use(cookieParser()); // For refresh token cookies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Correlation ID middleware for distributed tracing
  app.use((req: any, res: Response, next) => {
    req.correlationId = req.headers["x-correlation-id"] || `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader("X-Correlation-ID", req.correlationId);
    next();
  });

  // Request logging middleware
  app.use((req: any, res: Response, next) => {
    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      logger.info("API Request", {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        correlationId: req.correlationId,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
      });
    });

    next();
  });

  // ============================================
  // SESSION MANAGEMENT WITH SOA AWARENESS
  // ============================================

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
      logger.info("✅ Session middleware configured with Redis store");
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
      logger.warn("⚠️ Using memory store for sessions as fallback");
    }
  } else {
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
    logger.warn("⚠️ Redis not connected, using memory store for sessions");
  }

  // ============================================
  // RATE LIMITING WITH SOA AWARENESS
  // ============================================

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
          // Publish rate limit event
          eventBus
            .publish({
              id: "",
              type: EventType.SYSTEM_RATE_LIMIT_EXCEEDED,
              timestamp: "",
              version: "1.0",
              source: "rate-limiter",
              correlationId: (req as any).correlationId || "",
              metadata: {
                ip: req.ip,
                path: req.path,
                userAgent: req.get("User-Agent"),
              },
            })
            .catch((err) => logger.error("Failed to publish rate limit event", err));

          logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
          res.status(options.statusCode).json(options.message);
        },
        onLimitReached: (req, res, options) => {
          logger.warn(`Rate limit reached for IP ${req.ip}`);
        },
        skip: (req) => {
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
    logger.warn(" Redis not connected, using memory store for rate limiting");
  }

  // ============================================
  // API ROUTES (YOUR EXISTING STRUCTURE)
  // ============================================

  // Your existing routes - enhanced with SOA services
  app.use("/api/v1/auth", authRoutes(db, authService));
  app.use("/api/v1/documents", documentRoutes(db, documentService));
  // app.use("/api/v1/webhooks", webhookRoutes(db, webhookService));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // ============================================
  // SOA/EBS MONITORING ENDPOINTS
  // ============================================

  // Enhanced health check with service status
  app.get("/health", async (req: Request, res: Response) => {
    try {
      const redisStatus = isRedisConnected() ? "connected" : "disconnected";

      // Get service registry status
      const documentServices = await serviceRegistry.discoverServices("document-service");
      const notificationServices = await serviceRegistry.discoverServices("notification-service");

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "6.0.0",
        environment: config.NODE_ENV,
        infrastructure: {
          redis: redisStatus,
          database: "connected", // Assume connected if we got here
          eventBus: "running",
        },
        services: {
          document: {
            instances: documentServices.length,
            healthy: documentServices.filter((s) => s.health.status === "healthy").length,
          },
          notification: {
            instances: notificationServices.length,
            healthy: notificationServices.filter((s) => s.health.status === "healthy").length,
          },
        },
      });
    } catch (error) {
      res.status(503).json({
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
      });
    }
  });

  // Service discovery endpoint
  app.get("/api/v1/services", async (req: Request, res: Response) => {
    try {
      const documentServices = await serviceRegistry.discoverServices("document-service");
      const notificationServices = await serviceRegistry.discoverServices("notification-service");

      res.json({
        success: true,
        data: {
          services: {
            "document-service": documentServices,
            "notification-service": notificationServices,
          },
          summary: {
            total: documentServices.length + notificationServices.length,
            healthy: [...documentServices, ...notificationServices].filter((s) => s.health.status === "healthy").length,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get services",
        error: (error as Error).message,
      });
    }
  });

  // Event stream endpoint for debugging
  app.get("/api/v1/events", (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = eventBus.getPublishedEvents(limit);

      res.json({
        success: true,
        data: events,
        total: events.length,
        metadata: {
          limit,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get events",
        error: (error as Error).message,
      });
    }
  });

  // Service metrics endpoint
  app.get("/api/v1/metrics", async (req: Request, res: Response) => {
    try {
      const metrics = {
        requests: {
          total: 0, // You could implement request counting
          successful: 0,
          failed: 0,
        },
        services: {
          registered: await serviceRegistry.discoverServices("document-service").then((s) => s.length),
          healthy: await serviceRegistry.getHealthyServices("document-service").then((s) => s.length),
        },
        events: {
          published: eventBus.getPublishedEvents(1000).length,
          types: eventBus.getPublishedEvents(1000).reduce((acc: any, event) => {
            acc[event.type] = (acc[event.type] || 0) + 1;
            return acc;
          }, {}),
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get metrics",
      });
    }
  });

  //Middleware

  app.use(errorMiddleware);

  // ERROR HANDLING & CLEANUP
  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.path}`,
      timestamp: new Date().toISOString(),
    });
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      // Stop autonomous services
      await documentService.stop();
      logger.info("Document service stopped");

      // Close database
      await db.close();
      logger.info("Database connection closed");

      // Close Redis
      if (isRedisConnected()) {
        await redisClient.quit();
        logger.info("Redis connection closed");
      }

      logger.info("Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("Error during shutdown", { error: (error as Error).message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

  logger.info("✅ Legal Documents API v6 with SOA/EBS initialized successfully");

  return app;
}
