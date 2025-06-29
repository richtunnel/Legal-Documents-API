"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = documentRoutes;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const document_services_1 = require("../services/document.services");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const logger_1 = require("../utils/logger");
const documentController_1 = require("../controllers/documentController");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const redis_1 = require("../config/redis");
// Configure multer with memory storage
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const uploadRateLimiter = (0, express_rate_limit_1.default)({
    store: new rate_limit_redis_1.default({
        sendCommand: async (...args) => {
            return redis_1.redisClient.sendCommand(args);
        },
        prefix: "rate-limit:documents:upload:",
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per IP
    message: { message: "Too many document uploads, please try again later" },
    handler: (req, res, next, options) => {
        logger_1.logger.warn(`Upload rate limit exceeded for IP ${req.ip}`);
        res.status(options.statusCode).json(options.message);
    },
});
function documentRoutes(db) {
    const router = (0, express_1.Router)();
    // Apply authMiddleware to all routes
    router.use((0, auth_1.authMiddleware)(db));
    // Upload document route
    router.post("/", uploadRateLimiter, upload.single("file"), validate_1.validateDocument, validate_1.validate, (req, res, next) => {
        (0, documentController_1.uploadDocumentController)(req, res, db).catch((error) => {
            logger_1.logger.error(`Upload document failed: ${error.message}`);
            res.status(400).json({ message: error.message });
        });
    });
    // Get all documents route
    router.get("/", async (req, res, next) => {
        try {
            const userId = req.session.user?.id;
            if (!userId) {
                logger_1.logger.warn("Unauthorized access to get documents");
                throw new Error("Unauthorized");
            }
            const documents = await (0, document_services_1.fetchDocuments)(db, userId);
            res.json(documents);
        }
        catch (error) {
            logger_1.logger.error(`Get documents failed: ${error.message}`);
            res.status(400).json({ message: error.message });
        }
    });
    // Get single document route
    router.get("/:id", async (req, res, next) => {
        try {
            const userId = req.session.user?.id;
            if (!userId) {
                logger_1.logger.warn("Unauthorized access to get document");
                throw new Error("Unauthorized");
            }
            const documentId = parseInt(req.params.id);
            if (isNaN(documentId)) {
                logger_1.logger.error("Invalid document ID");
                throw new Error("Invalid document ID");
            }
            const { document, file } = await (0, document_services_1.fetchDocument)(db, userId, documentId);
            res.setHeader("Content-Type", "application/pdf");
            res.send(file);
        }
        catch (error) {
            logger_1.logger.error(`Get document failed: ${error.message}`);
            res.status(404).json({ message: error.message });
        }
    });
    return router;
}
