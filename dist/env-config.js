"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = require("path");
const logger_1 = require("./utils/logger");
// Validate environment variables and return a typed config object
function loadConfig() {
    const env = (process.env.NODE_ENV || "development");
    // Load the appropriate .env file based on the environment
    let envFile;
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
            logger_1.logger.error(`Unknown environment: ${env}`);
            throw new Error(`Unknown environment: ${env}`);
    }
    const envPath = (0, path_1.resolve)(process.cwd(), envFile);
    const result = dotenv_1.default.config({ path: envPath });
    if (result.error) {
        logger_1.logger.error(`Failed to load .env file at ${envPath}: ${result.error.message}`);
        throw new Error(`Failed to load .env file: ${result.error.message}`);
    }
    logger_1.logger.info(`Loaded environment configuration from ${envFile} for NODE_ENV=${env}`);
    // Validate required environment variables
    const requiredVars = ["DATABASE_URL", "REDIS_URL", "SESSION_SECRET", "JWT_SECRET", "BLOB_STORAGE_PATH"];
    for (const key of requiredVars) {
        if (!process.env[key]) {
            logger_1.logger.error(`Missing required environment variable: ${key}`);
            throw new Error(`Missing required environment variable: ${key}`);
        }
    }
    // Validate JWT_SECRET length
    if (process.env.JWT_SECRET.length < 32) {
        logger_1.logger.error("JWT_SECRET must be at least 32 characters");
        throw new Error("JWT_SECRET must be at least 32 characters");
    }
    // Validate WEBHOOK_TIMEOUT
    const webhookTimeout = parseInt(process.env.WEBHOOK_TIMEOUT || "5000", 10);
    if (isNaN(webhookTimeout) || webhookTimeout <= 0) {
        logger_1.logger.error("WEBHOOK_TIMEOUT must be a positive number");
        throw new Error("WEBHOOK_TIMEOUT must be a positive number");
    }
    return {
        PORT: process.env.PORT,
        NODE_ENV: env,
        DATABASE_URL: process.env.DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL,
        SESSION_SECRET: process.env.SESSION_SECRET,
        JWT_SECRET: process.env.JWT_SECRET,
        BLOB_STORAGE_PATH: process.env.BLOB_STORAGE_PATH,
        WEBHOOK_TIMEOUT: webhookTimeout,
    };
}
// Export the validated config
exports.config = loadConfig();
