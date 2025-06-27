"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
exports.connectRedis = connectRedis;
const redis_1 = require("redis");
const logger_1 = require("../utils/logger");
const env_config_1 = require("../env-config");
exports.redisClient = (0, redis_1.createClient)({
    url: env_config_1.config.REDIS_URL,
    socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
            if (retries > 5) {
                logger_1.logger.error("Redis reconnection failed after 5 attempts");
                return new Error("Redis reconnection failed");
            }
            return Math.min(retries * 100, 3000);
        },
    },
});
exports.redisClient.on("error", (err) => logger_1.logger.error(`Redis Client Error: ${err.message}`));
async function connectRedis() {
    try {
        await exports.redisClient.connect();
        logger_1.logger.info("Redis connected successfully");
    }
    catch (error) {
        logger_1.logger.error(`Redis connection failed: ${error.message}`);
        throw new Error(`Redis connection failed: ${error.message}`);
    }
}
