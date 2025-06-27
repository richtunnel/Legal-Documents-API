import { Database } from "sqlite";
import createApp from "./app";
import { initDatabase } from "./config/database";
import { connectRedis, redisClient } from "./config/redis";
import { config } from "./env-config";
import { logger } from "./utils/logger";

async function startServer() {
  try {
    logger.info("1. Starting server initialization...");

    // Load environment configuration
    logger.info("2. Loading environment configuration...");
    const envConfig = await config;
    logger.info(`3. Environment loaded: PORT=${envConfig.PORT}, DATABASE_URL=${envConfig.DATABASE_URL}, REDIS_URL=${envConfig.REDIS_URL}`);

    // Initialize SQLite database
    logger.info("4. Initializing SQLite database...");
    const db: Database = await initDatabase();
    logger.info("5. SQLite database initialized");

    // Connect to Redis
    logger.info("6. Connecting to Redis...");
    await connectRedis();
    logger.info("7. Redis connected");

    // Create Express app
    logger.info("8. Creating Express app...");
    const app = await createApp(db);
    logger.info("9. Express app created");

    // Start server
    const port = envConfig.PORT || 3000;
    logger.info(`10. Starting server on port ${port}...`);
    const server = app.listen(port, () => {
      logger.info(`11. Server running on http://localhost:${port}`);
    });

    // Graceful shutdown
    process.on("SIGTERM", async () => {
      logger.info("12. Received SIGTERM, shutting down...");
      try {
        await db.close();
        logger.info("13. Database closed");
        await redisClient.quit();
        logger.info("14. Redis connection closed");
        server.close(() => {
          logger.info("15. Server terminated");
        });
      } catch (shutdownError: any) {
        logger.error(`Shutdown error: ${shutdownError.message}`, { stack: shutdownError.stack });
      }
    });
  } catch (error: any) {
    logger.error(`Server startup failed: ${error.message}`, { stack: error.stack });
    throw error; // Propagate error to outer catch
  }
}

startServer().catch((error: any) => {
  logger.error(`Unhandled error in startServer: ${error.message}`, { stack: error.stack });
  process.exit(1);
});
