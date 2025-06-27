import { createClient } from "redis";
import { logger } from "../utils/logger";
import { config } from "../env-config";

export const redisClient = createClient({
  url: config.REDIS_URL,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        logger.error("Redis reconnection failed after 5 attempts");
        return new Error("Redis reconnection failed");
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on("error", (err) => logger.error(`Redis Client Error: ${err.message}`));

export async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info("Redis connected successfully");
  } catch (error) {
    logger.error(`Redis connection failed: ${(error as Error).message}`);
    throw new Error(`Redis connection failed: ${(error as Error).message}`);
  }
}
