"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoutes = webhookRoutes;
const express_1 = require("express");
const webhookController_1 = require("../controllers/webhookController");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
function webhookRoutes(db) {
    const router = (0, express_1.Router)();
    router.use((0, auth_1.authMiddleware)(db));
    router.post("/", validate_1.validate, (req, res) => (0, webhookController_1.registerWebhookController)(req, res, db));
    router.get("/", (req, res) => (0, webhookController_1.getWebhooksController)(req, res, db));
    return router;
}
