import jwt from "jsonwebtoken";
import { Database } from "sqlite";
import bcrypt from "bcrypt";
import { config } from "../env-config";
import { findUserByEmail, createUser } from "../models/user.model";
import { createApiKey, findApiKey } from "../models/apiKey.model";
import { logger } from "../utils/logger";

export async function login(db: Database, email: string, password: string) {
  const user = await findUserByEmail(db, email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid credentials");
  }
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, config.JWT_SECRET, {
    expiresIn: "1h",
  });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function register(db: Database, email: string, password: string) {
  const user = await createUser(db, email, password);
  const apiKey = await createApiKey(db, user.id);
  return { user, apiKey };
}

export async function verifyApiKey(db: Database, apiKey: string): Promise<number> {
  console.log(`Verifying API key: ${apiKey} in database: ${config.DATABASE_URL}`);
  const result = await db.get("SELECT user_id FROM api_keys WHERE api_key = ?", [apiKey]);
  if (!result) {
    logger.warn(`Invalid API key: ${apiKey}`);
    throw new Error("Invalid API key");
  }
  return result.user_id;
}
