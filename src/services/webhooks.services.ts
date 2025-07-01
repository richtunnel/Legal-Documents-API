import { Database } from "sqlite";
import { getWebhooksByUser } from "../models/webhook.model";
import fetch from "node-fetch";
import { EventBus } from "../infrastructure/eventBus";
import { EventType } from "../types/events";
import { logger } from "../utils/logger";

export class WebhookService {
  constructor(private db: Database, private eventBus: EventBus, private logger: any) {}

  async triggerWebhook(userId: number, eventType: string, payload: any): Promise<void> {
    try {
      const webhooks = await getWebhooksByUser(this.db, userId, eventType);

      const results = await Promise.allSettled(webhooks.map((webhook) => this.callWebhook(webhook.url, eventType, payload)));

      // Log results and publish events
      results.forEach((result, index) => {
        const webhook = webhooks[index];

        if (result.status === "fulfilled") {
          logger.info("Webhook called successfully", {
            url: webhook.url,
            eventType,
            userId,
          });
        } else {
          logger.error("Webhook call failed", {
            url: webhook.url,
            eventType,
            userId,
            error: result.reason,
          });
        }
      });

      // Publish webhook events
      await this.eventBus.publish({
        id: "",
        type: EventType.EMAIL_SENT, //create WEBHOOK_TRIGGERED event type
        timestamp: "",
        version: "1.0",
        source: "webhook-service",
        correlationId: "",
        userId,
        metadata: {
          eventType,
          webhookCount: webhooks.length,
          successCount: results.filter((r) => r.status === "fulfilled").length,
          failureCount: results.filter((r) => r.status === "rejected").length,
        },
      });
    } catch (error) {
      logger.error("Webhook triggering failed", {
        userId,
        eventType,
        error: (error as Error).message,
      });
    }
  }

  private async callWebhook(url: string, eventType: string, payload: any): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "DocumentAPI-Webhook/2.0",
        },
        body: JSON.stringify({
          event: eventType,
          data: payload,
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal, // 10 second timeout
      });

      if (response) {
        console.log("Webhook call successfull");
      }

      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.log(`Webhook failed with status`);
    }
  }
}
