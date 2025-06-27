import { logger } from "./logger";

logger.info("Test info log");
logger.error("Test error log", new Error("Test error"));
