"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const sqlite3 = require("sqlite3").verbose();
const sqlite_1 = require("sqlite");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const env_config_1 = require("../env-config");
async function initDatabase() {
    try {
        const dbPath = env_config_1.config.DATABASE_URL || path_1.default.resolve(__dirname, "../db/legal_documents.db");
        console.log("Opening database at:", dbPath);
        await promises_1.default.mkdir(path_1.default.dirname(dbPath), { recursive: true });
        const db = await (0, sqlite_1.open)({
            filename: env_config_1.config.DATABASE_URL || "./legal_documents.db",
            driver: sqlite3.Database,
        });
        console.log("Database connected successfully");
        // Create tables
        await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user'
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      blob_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      event_type TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
        return db;
    }
    catch (err) {
        console.error("Failed to open database:", err);
        throw err;
    }
}
