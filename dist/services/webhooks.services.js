"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerWebhook = triggerWebhook;
const webhook_model_1 = require("../models/webhook.model");
const node_fetch_1 = __importDefault(require("node-fetch"));
async function triggerWebhook(db, userId, eventType, payload) {
    const webhooks = await (0, webhook_model_1.getWebhooksByUser)(db, userId, eventType);
    for (const webhook of webhooks) {
        try {
            await (0, node_fetch_1.default)(webhook.url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ event: eventType, data: payload }),
            });
        }
        catch (error) {
            console.error(`Failed to trigger webhook ${webhook.url}:`, error);
        }
    }
}
