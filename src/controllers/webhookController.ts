import { Request, Response } from "express";
import { Database } from "sqlite";
import { createWebhook, getWebhooksByUser } from "../models/webhook.model";
import { ErrorResponse } from "../types/types";

export async function registerWebhookController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const { url, eventType } = req.body;
    const webhook = await createWebhook(db, userId, url, eventType);
    res.status(201).json(webhook);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}

export async function getWebhooksController(req: Request, res: Response, db: Database) {
  try {
    const userId = req.session.user?.id;
    if (!userId) throw new Error("Unauthorized");
    const webhooks = await getWebhooksByUser(db, userId);
    res.json(webhooks);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}
