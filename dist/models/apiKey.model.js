"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiKey = createApiKey;
exports.findApiKey = findApiKey;
const uuid_1 = require("uuid");
async function createApiKey(db, userId) {
    const apiKey = (0, uuid_1.v4)();
    const result = await db.run("INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)", [userId, apiKey]);
    return { id: result.lastID, user_id: userId, api_key: apiKey };
}
async function findApiKey(db, apiKey) {
    return db.get("SELECT * FROM api_keys WHERE api_key = ?", [apiKey]);
}
