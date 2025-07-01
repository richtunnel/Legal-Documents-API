import { initDatabase, checkDatabaseHealth, getMigrationStatus } from "../config/database";

async function runMigration(): Promise<void> {
  try {
    console.log("🚀 Starting database migration...");

    // Initialize database (this will run migrations automatically)
    const db = await initDatabase();

    // Check migration status
    const migrationStatus = await getMigrationStatus(db);
    console.log("Migration Status:", migrationStatus);

    // Verify database health
    const isHealthy = await checkDatabaseHealth(db);

    if (isHealthy) {
      console.log(" Database migration completed successfully!");
      // ... rest of the migration script code from above
    } else {
      console.error("Database health check failed after migration");
      process.exit(1);
    }

    await db.close();
    console.log("Migration completed successfully!");
  } catch (err: unknown) {
    console.error("Error during migration:", err);
    process.exit(1);
  }
}

runMigration();
