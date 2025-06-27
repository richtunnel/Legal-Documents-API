import { Database } from "sqlite";
import { v4 as uuidv4 } from "uuid";

export interface ApiKey {
  id: number;
  user_id: number;
  api_key: string;
  created_at: string;
}

export async function createApiKey(db: Database, userId: number) {
  const apiKey = uuidv4();
  const result = await db.run("INSERT INTO api_keys (user_id, api_key) VALUES (?, ?)", [userId, apiKey]);
  return { id: result.lastID, user_id: userId, api_key: apiKey };
}

export async function findApiKey(db: Database, apiKey: string) {
  return db.get<ApiKey>("SELECT * FROM api_keys WHERE api_key = ?", [apiKey]);
}
