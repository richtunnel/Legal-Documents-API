import { Database } from "sqlite";
import createApp from "./app";
import { initDatabase } from "./config/database";
import { connectRedis, redisClient, isRedisConnected, disconnectRedis } from "./config/redis";
import { config } from "./env-config";
import { logger } from "./utils/logger";
import { ServerContext } from "./types/types";

const serverContext: ServerContext = {
  db: null,
  server: null,
  redisConnected: false,
};

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  try {
    // Close HTTP server first
    if (serverContext.server) {
      await new Promise<void>((resolve) => {
        serverContext.server.close(() => {
          logger.info("HTTP server closed");
          resolve();
        });
      });
    }

    // Close database connection
    if (serverContext.db) {
      await serverContext.db.close();
      logger.info("Database connection closed");
    }

    // Close Redis connection
    if (serverContext.redisConnected) {
      await disconnectRedis();
      logger.info("Redis connection closed");
    }

    logger.info("Graceful shutdown completed");
    process.exit(0);
  } catch (shutdownError: any) {
    logger.error(`Error during shutdown: ${shutdownError.message}`, {
      stack: shutdownError.stack,
      signal,
    });
    process.exit(1);
  }
}

async function startServer() {
  try {
    logger.info("server initialization...");

    logger.info("Loading environment configuration...");
    const envConfig = await config;
    logger.info(`Environment loaded:`, {
      PORT: envConfig.PORT,
      NODE_ENV: envConfig.NODE_ENV,
      DATABASE_URL: envConfig.DATABASE_URL ? "***configured***" : "not set",
      REDIS_URL: envConfig.REDIS_URL ? "***configured***" : "not set",
    });

    //  Initialize SQLite database
    logger.info("Initializing SQLite database...");
    const db: Database = await initDatabase();
    serverContext.db = db;
    logger.info("SQLite database initialized successfully");

    // Connect to Redis
    logger.info("Connecting to Redis...");
    let redisConnected = false;
    try {
      await connectRedis();
      redisConnected = isRedisConnected();
      serverContext.redisConnected = redisConnected;

      if (redisConnected) {
        logger.info("Redis connected successfully");
      } else {
        logger.warn("Redis connection status buffering");
      }
    } catch (redisError: any) {
      logger.error(`Redis connection failed: ${redisError.message}`, {
        stack: redisError.stack,
        url: envConfig.REDIS_URL ? "***configured***" : "not set",
      });
      logger.warn("Server will continue without Redis)");
      serverContext.redisConnected = false;
    }

    // Create Express app
    logger.info("Creating Express app...");
    const app = await createApp(db);
    logger.info("Express app created successfully");

    // Start HTTP server
    const port = envConfig.PORT || 3000;
    logger.info(`Starting HTTP server on port ${port}...`);

    const server = app.listen(port, () => {
      logger.info(`Server running successfully!`, {
        url: `http://localhost:${port}`,
        port: port,
        environment: envConfig.NODE_ENV,
        redis: redisConnected ? "connected" : "disconnected (using memory stores)",
        apiDocs: `http://localhost:${port}/api-docs`,
        health: `http://localhost:${port}/health`,
      });
    });

    serverContext.server = server;

    // 6. Setup graceful shutdown handlers
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

    // 7. Handle uncaught exceptions and unhandled rejections
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception:", {
        message: error.message,
        stack: error.stack,
      });
      gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      logger.error("Unhandled Rejection:", {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
      });
      gracefulShutdown("unhandledRejection");
    });

    // 8. Monitor Redis connection status
    if (redisConnected) {
      redisClient.on("error", (err) => {
        logger.error(`Redis error: ${err.message}`);
        serverContext.redisConnected = false;
      });

      redisClient.on("disconnect", () => {
        logger.warn("Redis disconnected");
        serverContext.redisConnected = false;
      });

      redisClient.on("reconnecting", () => {
        logger.info("Redis reconnecting...");
      });

      redisClient.on("connect", () => {
        logger.info("Redis reconnected");
        serverContext.redisConnected = true;
      });
    }

    // 9. Log startup summary
    logger.info("Server initialization completed successfully", {
      services: {
        http: "running",
        database: "connected",
        redis: redisConnected ? "connected" : "⚠️ disconnected (fallback active)",
      },
      endpoints: {
        health: `http://localhost:${port}/health`,
        docs: `http://localhost:${port}/api-docs`,
        auth: `http://localhost:${port}/api/v1/auth`,
        documents: `http://localhost:${port}/api/v1/documents`,
        webhooks: `http://localhost:${port}/api/v1/webhooks`,
      },
    });
  } catch (error: any) {
    logger.error("Server startup failed:", {
      message: error.message,
      stack: error.stack,
      context: {
        db: serverContext.db ? "initialized" : "not initialized",
        redis: serverContext.redisConnected ? "connected" : "not connected",
        server: serverContext.server ? "started" : "not started",
      },
    });

    // Attempt cleanup on startup failure
    try {
      if (serverContext.db) {
        await serverContext.db.close();
        logger.info("Database cleaned up after startup failure");
      }
      if (serverContext.redisConnected) {
        await disconnectRedis();
        logger.info("Redis cleaned up after startup failure");
      }
    } catch (cleanupError: any) {
      logger.error(`Cleanup failed: ${cleanupError.message}`);
    }

    throw error;
  }
}

// Start the server with enhanced error handling
startServer().catch((error: any) => {
  logger.error("Fatal error during server startup:", {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  // Force exit after a timeout to prevent hanging
  setTimeout(() => {
    logger.error("Force exiting due to startup failure");
    process.exit(1);
  }, 5000);

  process.exit(1);
});

// Export for testing
export { startServer, gracefulShutdown, serverContext };
