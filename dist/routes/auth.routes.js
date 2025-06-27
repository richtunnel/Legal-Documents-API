"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = authRoutes;
const auth_services_1 = require("../services/auth.services");
const logger_1 = require("../utils/logger");
const express_1 = require("express");
const auth_services_2 = require("../services/auth.services");
const router = (0, express_1.Router)();
function authRoutes(db) {
    // Login route
    router.post("/login", async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const result = await (0, auth_services_1.login)(db, email, password);
            res.json(result);
        }
        catch (error) {
            logger_1.logger.error(`Login route failed: ${error.message}`);
            res.status(400).json({ message: error.message });
        }
    });
    // Verify API key route
    router.post("/verify-api-key", async (req, res, next) => {
        try {
            const { apiKey } = req.body;
            const userId = await (0, auth_services_2.verifyApiKey)(db, apiKey);
            res.json({ userId });
        }
        catch (error) {
            logger_1.logger.error(`Verify API key route failed: ${error.message}`);
            res.status(400).json({ message: error.message });
        }
    });
    return router;
}
