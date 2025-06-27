import { Database } from "sqlite";
import { getWebhooksByUser } from "../models/webhook.model";
import fetch from "node-fetch";

export async function triggerWebhook(db: Database, userId: number, eventType: string, payload: any) {
  const webhooks = await getWebhooksByUser(db, userId, eventType);
  for (const webhook of webhooks) {
    try {
      await fetch(webhook.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: eventType, data: payload }),
      });
    } catch (error) {
      console.error(`Failed to trigger webhook ${webhook.url}:`, error);
    }
  }
}
