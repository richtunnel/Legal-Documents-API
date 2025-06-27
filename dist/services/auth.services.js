"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.register = register;
exports.verifyApiKey = verifyApiKey;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_config_1 = require("../env-config");
const user_model_1 = require("../models/user.model");
const apiKey_model_1 = require("../models/apiKey.model");
const logger_1 = require("../utils/logger");
async function login(db, email, password) {
    const user = await (0, user_model_1.findUserByEmail)(db, email);
    if (!user || !(await bcrypt_1.default.compare(password, user.password))) {
        throw new Error("Invalid credentials");
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, env_config_1.config.JWT_SECRET, {
        expiresIn: "1h",
    });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
}
async function register(db, email, password) {
    const user = await (0, user_model_1.createUser)(db, email, password);
    const apiKey = await (0, apiKey_model_1.createApiKey)(db, user.id);
    return { user, apiKey };
}
async function verifyApiKey(db, apiKey) {
    console.log(`Verifying API key: ${apiKey} in database: ${env_config_1.config.DATABASE_URL}`);
    const result = await db.get("SELECT user_id FROM api_keys WHERE api_key = ?", [apiKey]);
    if (!result) {
        logger_1.logger.warn(`Invalid API key: ${apiKey}`);
        throw new Error("Invalid API key");
    }
    return result.user_id;
}
