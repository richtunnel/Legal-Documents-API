"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
// Define log file paths
const logDir = path_1.default.resolve(process.cwd(), "logs");
const errorLogPath = path_1.default.join(logDir, "error.log");
const combinedLogPath = path_1.default.join(logDir, "combined.log");
// Create a Winston logger instance
exports.logger = winston_1.default.createLogger({
    level: "info", // Default log level
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston_1.default.format.errors({ stack: true }), // Include stack traces for errors
    winston_1.default.format.json() // JSON format for structured logs
    ),
    transports: [
        // Write error logs to error.log
        new winston_1.default.transports.File({
            filename: errorLogPath,
            level: "error",
            maxsize: 5 * 1024 * 1024, // 5MB max file size
            maxFiles: 5, // Keep up to 5 rotated files
            tailable: true, // Rotate logs
        }),
        // Write all logs (info and above) to combined.log
        new winston_1.default.transports.File({
            filename: combinedLogPath,
            maxsize: 5 * 1024 * 1024, // 5MB max file size
            maxFiles: 5, // Keep up to 5 rotated files
            tailable: true,
        }),
        // Output logs to console for development
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), // Colorize console output
            winston_1.default.format.simple() // Simple format for console
            ),
        }),
    ],
    // Handle exceptions and uncaught errors
    exceptionHandlers: [new winston_1.default.transports.File({ filename: errorLogPath })],
    // Handle rejections
    rejectionHandlers: [new winston_1.default.transports.File({ filename: errorLogPath })],
});
// Ensure log directory exists
async function ensureLogDirectory() {
    try {
        await Promise.resolve().then(() => __importStar(require("fs/promises"))).then(({ mkdir }) => mkdir(logDir, { recursive: true }));
    }
    catch (error) {
        console.error(`Failed to create log directory at ${logDir}: ${error.message}`);
        process.exit(1);
    }
}
ensureLogDirectory();
