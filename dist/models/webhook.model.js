"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebhook = createWebhook;
exports.getWebhooksByUser = getWebhooksByUser;
async function createWebhook(db, userId, url, eventType) {
    const result = await db.run("INSERT INTO webhooks (user_id, url, event_type) VALUES (?, ?, ?)", [userId, url, eventType]);
    return { id: result.lastID, user_id: userId, url, event_type: eventType };
}
async function getWebhooksByUser(db, userId, eventType) {
    if (eventType) {
        return db.all("SELECT * FROM webhooks WHERE user_id = ? AND event_type = ?", [userId, eventType]);
    }
    return db.all("SELECT * FROM webhooks WHERE user_id = ?", [userId]);
}
