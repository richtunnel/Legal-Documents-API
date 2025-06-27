"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createUser(db, email, password) {
    const hashedPassword = await bcrypt_1.default.hash(password, 10);
    const result = await db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [email, hashedPassword, "user"]);
    return { id: result.lastID, email, role: "user" };
}
async function findUserByEmail(db, email) {
    return db.get("SELECT * FROM users WHERE email = ?", [email]);
}
