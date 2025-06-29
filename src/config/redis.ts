import { createClient, RedisClientType } from "redis";
import { logger } from "../utils/logger";
import { config } from "../env-config";

export const redisClient: RedisClientType = createClient({
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
redisClient.on("connect", () => logger.info("Redis connected successfully"));
redisClient.on("disconnect", () => logger.warn("Redis disconnected"));
redisClient.on("reconnecting", () => logger.info("Redis reconnecting..."));

let isConnected = false;

export async function connectRedis(): Promise<void> {
  try {
    if (!isConnected) {
      await redisClient.connect();
      isConnected = true;
      logger.info("Redis connected successfully");
    }
  } catch (error) {
    logger.error(`Redis connection failed: ${(error as Error).message}`);
    throw new Error(`Redis connection failed: ${(error as Error).message}`);
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient.isOpen;
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (isConnected) {
      await redisClient.quit();
      isConnected = false;
      logger.info("Redis disconnected successfully");
    }
  } catch (error) {
    logger.error(`Redis disconnection failed: ${(error as Error).message}`);
  }
}
