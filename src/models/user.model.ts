import { Database } from "sqlite";
import bcrypt from "bcrypt";
import { User } from "../types/types";
import { logger } from "../utils/logger";

export async function createUser(db: Database, email: string, password: string): Promise<User> {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const role = "user"; // Default role

    const result = await db.run("INSERT INTO users (email, password, role) VALUES (?, ?, ?)", [email, hashedPassword, role]);

    if (!result.lastID) {
      logger.error(`Failed to retrieve lastID for user creation: ${email}`);
      throw new Error("Failed to create user: No ID returned");
    }

    const user = await db.get<User>("SELECT id, email, password, role FROM users WHERE id = ?", [result.lastID]);

    if (!user) {
      logger.error(`Failed to fetch user after creation: ${email}`);
      throw new Error("Failed to fetch user after creation");
    }

    logger.info(`User created successfully: ${email}`);
    return user;
  } catch (error) {
    logger.error(`createUser failed: ${(error as Error).message}`);
    throw error;
  }
}

export async function findUserByEmail(db: Database, email: string): Promise<User | undefined> {
  try {
    const user = await db.get<User>("SELECT id, email, password, role FROM users WHERE email = ?", [email]);
    return user;
  } catch (error) {
    logger.error(`findUserByEmail failed: ${(error as Error).message}`);
    throw error;
  }
}
