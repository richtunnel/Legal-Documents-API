"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginController = loginController;
exports.registerController = registerController;
exports.generateApiKeyController = generateApiKeyController;
const auth_services_1 = require("../services/auth.services");
const apiKey_model_1 = require("../models/apiKey.model");
async function loginController(req, res, db) {
    try {
        const { email, password } = req.body;
        const result = await (0, auth_services_1.login)(db, email, password);
        req.session.user = { id: result.user.id, email: result.user.email, role: result.user.role };
        res.json(result);
    }
    catch (error) {
        res.status(401).json({ message: error.message });
    }
}
async function registerController(req, res, db) {
    try {
        const { email, password } = req.body;
        const result = await (0, auth_services_1.register)(db, email, password);
        req.session.user = { id: result.user.id, email: result.user.email, role: result.user.role };
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
async function generateApiKeyController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const apiKey = await (0, apiKey_model_1.createApiKey)(db, userId);
        res.status(201).json(apiKey);
    }
    catch (error) {
        res.status(401).json({ message: error.message });
    }
}
