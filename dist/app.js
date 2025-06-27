"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createApp;
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const redis_1 = require("./config/redis");
const connect_redis_1 = require("connect-redis");
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./utils/swagger");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const document_routes_1 = __importDefault(require("./routes/document.routes"));
const webhook_routes_1 = require("./routes/webhook.routes");
const errors_1 = require("./middleware/errors");
const logger_1 = require("./utils/logger");
const env_config_1 = require("./env-config");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
function createApp(db) {
    const app = (0, express_1.default)();
    // Security middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
            },
        },
    }));
    // Compression
    app.use((0, compression_1.default)());
    // Body parsing
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // Session management
    try {
        app.use((0, express_session_1.default)({
            store: new connect_redis_1.RedisStore({ client: redis_1.redisClient }),
            secret: env_config_1.config.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: env_config_1.config.NODE_ENV === "production",
                httpOnly: true,
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
            },
        }));
        logger_1.logger.info("Session middleware configured successfully");
    }
    catch (error) {
        logger_1.logger.error(`Session middleware setup failed: ${error.message}`);
        throw new Error(`Session setup failed: ${error.message}`);
    }
    const documentRateLimiter = (0, express_rate_limit_1.default)({
        store: new rate_limit_redis_1.default({
            sendCommand: async (...args) => {
                return redis_1.redisClient.sendCommand(args);
            },
            prefix: "rate-limit:documents:",
        }),
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // 100 requests per IP
        message: { message: "Too many requests to document endpoints, please try again later" },
        handler: (req, res, next, options) => {
            logger_1.logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
            res.status(options.statusCode).json(options.message);
        },
    });
    // Routes
    app.use("/api/v1/auth", (0, auth_routes_1.default)(db));
    app.use("/api/v1/documents", (0, document_routes_1.default)(db));
    app.use("/api/v1/webhooks", (0, webhook_routes_1.webhookRoutes)(db));
    app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
    // Error handling
    app.use(errors_1.errorMiddleware);
    return app;
}
