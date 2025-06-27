const sqlite3 = require("sqlite3").verbose();
import { open } from "sqlite";
import fs from "fs/promises";
import path from "path";
import { config } from "../env-config";
import { logger } from "../utils/logger";

export async function initDatabase() {
  try {
    const dbPath = config.DATABASE_URL || path.resolve(__dirname, "../db/legal_documents.db");
    logger.info(`Resolved database path: ${dbPath}`);
    console.log("Opening database at:", dbPath);

    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    const db = await open({
      filename: config.DATABASE_URL || "./legal_documents.db",
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
  } catch (err) {
    console.error("Failed to open database:", err);
    throw err;
  }
}
