import winston from "winston";
import path from "path";

// Define log file paths
const logDir = path.resolve(process.cwd(), "logs");
const errorLogPath = path.join(logDir, "error.log");
const combinedLogPath = path.join(logDir, "combined.log");

// Create a Winston logger instance
export const logger = winston.createLogger({
  level: "info", // Default log level
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }), // Include stack traces for errors
    winston.format.json() // JSON format for structured logs
  ),
  transports: [
    // Write error logs to error.log
    new winston.transports.File({
      filename: errorLogPath,
      level: "error",
      maxsize: 5 * 1024 * 1024, // 5MB max file size
      maxFiles: 5, // Keep up to 5 rotated files
      tailable: true, // Rotate logs
    }),
    // Write all logs (info and above) to combined.log
    new winston.transports.File({
      filename: combinedLogPath,
      maxsize: 5 * 1024 * 1024, // 5MB max file size
      maxFiles: 5, // Keep up to 5 rotated files
      tailable: true,
    }),
    // Output logs to console for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Colorize console output
        winston.format.simple() // Simple format for console
      ),
    }),
  ],
  // Handle exceptions and uncaught errors
  exceptionHandlers: [new winston.transports.File({ filename: errorLogPath })],
  // Handle rejections
  rejectionHandlers: [new winston.transports.File({ filename: errorLogPath })],
});

// Ensure log directory exists
async function ensureLogDirectory() {
  try {
    await import("fs/promises").then(({ mkdir }) => mkdir(logDir, { recursive: true }));
  } catch (error) {
    console.error(`Failed to create log directory at ${logDir}: ${(error as Error).message}`);
    process.exit(1);
  }
}

ensureLogDirectory();
