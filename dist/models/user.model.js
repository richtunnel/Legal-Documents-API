"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("../utils/logger");
async function createUser(db, email, password) {
    try {
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const role = "user"; // Default role
        const result = await db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [email, hashedPassword, role]);
        if (!result.lastID) {
            logger_1.logger.error(`Failed to retrieve lastID for user creation: ${email}`);
            throw new Error("Failed to create user: No ID returned");
        }
        const user = await db.get("SELECT id, email, password, role FROM users WHERE id = ?", [result.lastID]);
        if (!user) {
            logger_1.logger.error(`Failed to fetch user after creation: ${email}`);
            throw new Error("Failed to fetch user after creation");
        }
        logger_1.logger.info(`User created successfully: ${email}`);
        return user;
    }
    catch (error) {
        logger_1.logger.error(`createUser failed: ${error.message}`);
        throw error;
    }
}
async function findUserByEmail(db, email) {
    try {
        const user = await db.get("SELECT id, email, password, role FROM users WHERE email = ?", [email]);
        return user;
    }
    catch (error) {
        logger_1.logger.error(`findUserByEmail failed: ${error.message}`);
        throw error;
    }
}
