import { open, Database } from "sqlite";
import sqlite3 from "sqlite3";
import fs from "fs/promises";
import path from "path";
import { config } from "../env-config";
import { logger } from "../utils/logger";

// Define the return type for the database connection
type SQLiteDatabase = Database<sqlite3.Database, sqlite3.Statement>;

// Current schema version - increment when making schema changes
const CURRENT_SCHEMA_VERSION = 2;

export async function initDatabase(): Promise<SQLiteDatabase> {
  try {
    // Resolve DATABASE_URL relative to cwd if it's a relative path, otherwise use default
    const dbPath: string =
      config.DATABASE_URL && !path.isAbsolute(config.DATABASE_URL) ? path.resolve(process.cwd(), config.DATABASE_URL) : config.DATABASE_URL || path.resolve(__dirname, "../db/legal_documents.db");

    logger.info(`Resolved database path: ${dbPath}`);
    console.log("Opening database at:", dbPath);

    // Ensure the directory exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    // Open the database
    const db: SQLiteDatabase = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log("Database connected successfully");

    // Initialize schema version table
    await initSchemaVersion(db);

    // Get current schema version
    const currentVersion = await getSchemaVersion(db);
    console.log(`Current schema version: ${currentVersion}`);

    // Run migrations if needed
    if (currentVersion < CURRENT_SCHEMA_VERSION) {
      await runMigrations(db, currentVersion);
    }

    // Create base tables (existing schema)
    await createBaseTables(db);

    // Create new legal docs and EBS tables
    await createLegalDocsTables(db);

    logger.info("Database tables initialized successfully");
    return db;
  } catch (err: unknown) {
    console.error("Failed to open database:", err);
    throw err;
  }
}

async function initSchemaVersion(db: SQLiteDatabase): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert initial version if not exists
  const existingVersion = await db.get("SELECT version FROM schema_version LIMIT 1");
  if (!existingVersion) {
    await db.run("INSERT INTO schema_version (version) VALUES (?)", [1]);
  }
}

async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const result = await db.get("SELECT version FROM schema_version ORDER BY version DESC LIMIT 1");
  return result?.version || 1;
}

async function updateSchemaVersion(db: SQLiteDatabase, version: number): Promise<void> {
  await db.run("INSERT INTO schema_version (version) VALUES (?)", [version]);
}

async function runMigrations(db: SQLiteDatabase, fromVersion: number): Promise<void> {
  logger.info(`Running migrations from version ${fromVersion} to ${CURRENT_SCHEMA_VERSION}`);

  if (fromVersion < 2) {
    await migrateToVersion2(db);
    await updateSchemaVersion(db, 2);
  }

  // Add more migrations here as needed
  // if (fromVersion < 3) {
  //   await migrateToVersion3(db);
  //   await updateSchemaVersion(db, 3);
  // }
}

async function migrateToVersion2(db: SQLiteDatabase): Promise<void> {
  logger.info("Migrating to version 2: Adding legal docs and EBS support");

  try {
    // Add new columns to existing webhooks table
    await db.exec(`
      ALTER TABLE webhooks ADD COLUMN events TEXT;
      ALTER TABLE webhooks ADD COLUMN name TEXT;
      ALTER TABLE webhooks ADD COLUMN secret TEXT;
      ALTER TABLE webhooks ADD COLUMN active INTEGER DEFAULT 1;
      ALTER TABLE webhooks ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE webhooks ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
    `);

    // Update existing webhooks to have the new format
    await db.exec(`
      UPDATE webhooks 
      SET 
        events = json_array(event_type),
        name = 'Legacy Webhook - ' || id,
        secret = 'legacy-secret-' || id || '-' || substr(url, -8),
        created_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE events IS NULL;
    `);

    logger.info("Webhooks table migration completed");
  } catch (alterErr: unknown) {
    if (alterErr instanceof Error && !alterErr.message.includes("duplicate column name")) {
      console.error("Error migrating webhooks table:", alterErr.message);
    }
  }
}

async function createBaseTables(db: SQLiteDatabase): Promise<void> {
  await db.exec(`
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      last_login TEXT,
      title TEXT,
      blob_path TEXT
    );

    -- Create api_keys table
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create documents table
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      blob_path TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Create enhanced webhooks table (backward compatible)
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER, -- Keep for backward compatibility
      url TEXT NOT NULL,
      event_type TEXT, -- Keep for backward compatibility
      events TEXT, -- New JSON array of events
      name TEXT,
      secret TEXT,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create refresh_tokens table
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_revoked BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Add columns to users table if they don't exist (for migrations)
  try {
    await db.exec(`
      ALTER TABLE users ADD COLUMN last_login TEXT;
      ALTER TABLE users ADD COLUMN title TEXT;
      ALTER TABLE users ADD COLUMN blob_path TEXT;
    `);
  } catch (alterErr: unknown) {
    if (alterErr instanceof Error && !alterErr.message.includes("duplicate column name")) {
      console.error("Error adding columns to users table:", alterErr.message);
    }
  }
}

async function createLegalDocsTables(db: SQLiteDatabase): Promise<void> {
  await db.exec(`
    -- Legal documents table
    CREATE TABLE IF NOT EXISTS legal_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT UNIQUE NOT NULL,
      document_type TEXT NOT NULL,
      status TEXT NOT NULL,
      client_id TEXT NOT NULL,
      title TEXT NOT NULL,
      metadata TEXT, -- JSON metadata
      ebs_reference TEXT,
      user_id INTEGER, -- Link to user who owns/manages this document
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Legal document events table
    CREATE TABLE IF NOT EXISTS legal_document_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL,
      document_type TEXT NOT NULL,
      status TEXT NOT NULL,
      client_id TEXT NOT NULL,
      metadata TEXT, -- JSON metadata
      webhook_type TEXT NOT NULL,
      ebs_reference TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed INTEGER DEFAULT 0, -- 1 if processed, 0 if pending
      FOREIGN KEY (document_id) REFERENCES legal_documents(document_id)
    );

    -- EBS events table
    CREATE TABLE IF NOT EXISTS ebs_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT UNIQUE NOT NULL,
      source_system TEXT NOT NULL,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL, -- JSON data
      correlation_id TEXT,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed INTEGER DEFAULT 0, -- 1 if processed, 0 if pending
      error_message TEXT -- Store any processing errors
    );

    -- Webhook delivery attempts table
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL, -- JSON payload
      response_status INTEGER,
      response_body TEXT,
      attempt_count INTEGER DEFAULT 1,
      delivered_at DATETIME,
      next_retry_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
    );

    -- Indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);
    CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
    CREATE INDEX IF NOT EXISTS idx_legal_documents_client_id ON legal_documents(client_id);
    CREATE INDEX IF NOT EXISTS idx_legal_documents_status ON legal_documents(status);
    CREATE INDEX IF NOT EXISTS idx_legal_documents_user_id ON legal_documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_legal_document_events_document_id ON legal_document_events(document_id);
    CREATE INDEX IF NOT EXISTS idx_legal_document_events_processed ON legal_document_events(processed);
    CREATE INDEX IF NOT EXISTS idx_ebs_events_entity_id ON ebs_events(entity_id);
    CREATE INDEX IF NOT EXISTS idx_ebs_events_processed ON ebs_events(processed);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at);

    -- Triggers to update timestamps
    CREATE TRIGGER IF NOT EXISTS update_webhooks_timestamp 
      AFTER UPDATE ON webhooks 
    BEGIN
      UPDATE webhooks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

    CREATE TRIGGER IF NOT EXISTS update_legal_documents_timestamp 
      AFTER UPDATE ON legal_documents 
    BEGIN
      UPDATE legal_documents SET last_updated = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  `);
}

// Helper function to check database health
export async function checkDatabaseHealth(db: SQLiteDatabase): Promise<boolean> {
  try {
    // Test basic connectivity
    await db.get("SELECT 1");

    // Check if required tables exist
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN (
        'webhooks', 'legal_documents', 'legal_document_events', 
        'ebs_events', 'webhook_deliveries', 'users', 'schema_version'
      )
    `);

    const requiredTables = ["webhooks", "legal_documents", "legal_document_events", "ebs_events", "webhook_deliveries", "users", "schema_version"];
    const existingTables = tables.map((t) => t.name);

    const missingTables = requiredTables.filter((table) => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.error("Missing required tables:", missingTables);
      return false;
    }

    // Check schema version
    const version = await getSchemaVersion(db);
    if (version < CURRENT_SCHEMA_VERSION) {
      console.warn(`Database schema version ${version} is outdated. Current version: ${CURRENT_SCHEMA_VERSION}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

// Utility function to get migration status
export async function getMigrationStatus(db: SQLiteDatabase): Promise<{
  currentVersion: number;
  latestVersion: number;
  needsMigration: boolean;
}> {
  const currentVersion = await getSchemaVersion(db);
  return {
    currentVersion,
    latestVersion: CURRENT_SCHEMA_VERSION,
    needsMigration: currentVersion < CURRENT_SCHEMA_VERSION,
  };
}
