"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_services_1 = require("../services/auth.services");
const env_config_1 = require("../env-config");
const logger_1 = require("../utils/logger");
function authMiddleware(db) {
    return async (req, res, next) => {
        const token = req.headers.authorization?.split(" ")[1];
        const apiKey = req.headers["x-api-key"];
        if (!token && !apiKey) {
            logger_1.logger.warn("No token or API key provided");
            res.status(401).json({ message: "No token or API key provided" });
            return;
        }
        try {
            if (token) {
                logger_1.logger.info(`Verifying JWT token: ${token}`);
                const decoded = jsonwebtoken_1.default.verify(token, env_config_1.config.JWT_SECRET);
                req.session.user = decoded;
                next();
            }
            else if (apiKey) {
                logger_1.logger.info(`Verifying API key: ${apiKey}`);
                const userId = await (0, auth_services_1.verifyApiKey)(db, apiKey);
                logger_1.logger.info(`API key valid, user_id: ${userId}`);
                req.session.user = { id: userId };
                next();
            }
        }
        catch (error) {
            logger_1.logger.error(`Auth error: ${error.message}`);
            res.status(401).json({ message: "Invalid token or API key" });
        }
    };
}
