import { Database } from "sqlite";

export interface Webhook {
  id: number;
  user_id: number;
  url: string;
  event_type: string;
}

export async function createWebhook(db: Database, userId: number, url: string, eventType: string) {
  const result = await db.run("INSERT INTO webhooks (user_id, url, event_type) VALUES (?, ?, ?)", [userId, url, eventType]);
  return { id: result.lastID, user_id: userId, url, event_type: eventType };
}

export async function getWebhooksByUser(db: Database, userId: number, eventType?: string) {
  if (eventType) {
    return db.all<Webhook[]>("SELECT * FROM webhooks WHERE user_id = ? AND event_type = ?", [userId, eventType]);
  }
  return db.all<Webhook[]>("SELECT * FROM webhooks WHERE user_id = ?", [userId]);
}
