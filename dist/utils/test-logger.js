"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
logger_1.logger.info("Test info log");
logger_1.logger.error("Test error log", new Error("Test error"));
