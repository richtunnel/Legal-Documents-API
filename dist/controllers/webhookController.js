"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWebhookController = registerWebhookController;
exports.getWebhooksController = getWebhooksController;
const webhook_model_1 = require("../models/webhook.model");
async function registerWebhookController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const { url, eventType } = req.body;
        const webhook = await (0, webhook_model_1.createWebhook)(db, userId, url, eventType);
        res.status(201).json(webhook);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
async function getWebhooksController(req, res, db) {
    try {
        const userId = req.session.user?.id;
        if (!userId)
            throw new Error("Unauthorized");
        const webhooks = await (0, webhook_model_1.getWebhooksByUser)(db, userId);
        res.json(webhooks);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}
