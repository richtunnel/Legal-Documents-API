import dotenv from "dotenv";
import { resolve } from "path";
import { logger } from "./utils/logger";

// Define the expected environment variables with their types
interface EnvConfig {
  PORT: string;
  NODE_ENV: "development" | "production" | "test";
  DATABASE_URL: string;
  REDIS_URL: string;
  SESSION_SECRET: string;
  JWT_SECRET: string;
  BLOB_STORAGE_PATH: string;
  WEBHOOK_TIMEOUT: number;
}

// Validate environment variables and return a typed config object
function loadConfig(): EnvConfig {
  const env = (process.env.NODE_ENV || "development") as "development" | "production" | "test";

  // Load the appropriate .env file based on the environment
  let envFile: string;
  switch (env) {
    case "development":
      envFile = ".env.development";
      break;
    case "production":
      envFile = ".env.production";
      break;
    case "test":
      envFile = ".env";
      break;
    default:
      logger.error(`Unknown environment: ${env}`);
      throw new Error(`Unknown environment: ${env}`);
  }

  const envPath = resolve(process.cwd(), envFile);
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    logger.error(`Failed to load .env file at ${envPath}: ${result.error.message}`);
    throw new Error(`Failed to load .env file: ${result.error.message}`);
  }

  logger.info(`Loaded environment configuration from ${envFile} for NODE_ENV=${env}`);

  // Validate required environment variables
  const requiredVars = ["DATABASE_URL", "REDIS_URL", "SESSION_SECRET", "JWT_SECRET", "BLOB_STORAGE_PATH"];
  for (const key of requiredVars) {
    if (!process.env[key]) {
      logger.error(`Missing required environment variable: ${key}`);
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Validate JWT_SECRET length
  if (process.env.JWT_SECRET!.length < 32) {
    logger.error("JWT_SECRET must be at least 32 characters");
    throw new Error("JWT_SECRET must be at least 32 characters");
  }

  // Validate WEBHOOK_TIMEOUT
  const webhookTimeout = parseInt(process.env.WEBHOOK_TIMEOUT || "5000", 10);
  if (isNaN(webhookTimeout) || webhookTimeout <= 0) {
    logger.error("WEBHOOK_TIMEOUT must be a positive number");
    throw new Error("WEBHOOK_TIMEOUT must be a positive number");
  }

  return {
    PORT: process.env.PORT!,
    NODE_ENV: env,
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    SESSION_SECRET: process.env.SESSION_SECRET!,
    JWT_SECRET: process.env.JWT_SECRET!,
    BLOB_STORAGE_PATH: process.env.BLOB_STORAGE_PATH!,
    WEBHOOK_TIMEOUT: webhookTimeout,
  };
}

// Export the validated config
export const config = loadConfig();
