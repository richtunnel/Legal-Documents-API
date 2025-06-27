"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const env_config_1 = require("./env-config");
const logger_1 = require("./utils/logger");
async function startServer() {
    try {
        logger_1.logger.info("1. Starting server initialization...");
        // Load environment configuration
        logger_1.logger.info("2. Loading environment configuration...");
        const envConfig = await env_config_1.config;
        logger_1.logger.info(`3. Environment loaded: PORT=${envConfig.PORT}, DATABASE_URL=${envConfig.DATABASE_URL}, REDIS_URL=${envConfig.REDIS_URL}`);
        // Initialize SQLite database
        logger_1.logger.info("4. Initializing SQLite database...");
        const db = await (0, database_1.initDatabase)();
        logger_1.logger.info("5. SQLite database initialized");
        // Connect to Redis
        logger_1.logger.info("6. Connecting to Redis...");
        await (0, redis_1.connectRedis)();
        logger_1.logger.info("7. Redis connected");
        // Create Express app
        logger_1.logger.info("8. Creating Express app...");
        const app = await (0, app_1.default)(db);
        logger_1.logger.info("9. Express app created");
        // Start server
        const port = envConfig.PORT || 3000;
        logger_1.logger.info(`10. Starting server on port ${port}...`);
        const server = app.listen(port, () => {
            logger_1.logger.info(`11. Server running on http://localhost:${port}`);
        });
        // Graceful shutdown
        process.on("SIGTERM", async () => {
            logger_1.logger.info("12. Received SIGTERM, shutting down...");
            try {
                await db.close();
                logger_1.logger.info("13. Database closed");
                await redis_1.redisClient.quit();
                logger_1.logger.info("14. Redis connection closed");
                server.close(() => {
                    logger_1.logger.info("15. Server terminated");
                });
            }
            catch (shutdownError) {
                logger_1.logger.error(`Shutdown error: ${shutdownError.message}`, { stack: shutdownError.stack });
            }
        });
    }
    catch (error) {
        logger_1.logger.error(`Server startup failed: ${error.message}`, { stack: error.stack });
        throw error; // Propagate error to outer catch
    }
}
startServer().catch((error) => {
    logger_1.logger.error(`Unhandled error in startServer: ${error.message}`, { stack: error.stack });
    process.exit(1);
});
