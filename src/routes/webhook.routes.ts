import { Router } from "express";
import {
  registerWebhookController,
  getWebhooksController,
  handleLegalDocumentWebhook,
  handleEBSUpdateWebhook,
  processDocumentStatusUpdate,
  syncWithEBSController,
} from "../controllers/webhookController";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate, validateLegalDoc, validateEBSPayload } from "../middleware/validate";
import { Database } from "sqlite";

export function webhookRoutes(db: Database, webhookService?: any) {
  const router = Router();

  // Apply auth middleware to all routes
  router.use(authMiddleware(db));

  // Original webhook endpoints
  router.post("/", validate, async (req, res) => {
    await registerWebhookController(req, res, db);
  });

  router.get("/", async (req, res) => {
    await getWebhooksController(req, res, db);
  });

  // Legal document webhook endpoints
  router.post("/legal-docs", validateLegalDoc, async (req, res) => {
    await handleLegalDocumentWebhook(req, res, db);
  });

  // Handle specific legal document events
  router.post("/legal-docs/status-update", validateLegalDoc, async (req, res) => {
    await processDocumentStatusUpdate(req, res, db);
  });

  // EBS integration endpoints
  router.post("/ebs/update", validateEBSPayload, async (req, res) => {
    await handleEBSUpdateWebhook(req, res, db);
  });

  // Sync data with EBS system
  router.post("/ebs/sync", async (req, res) => {
    await syncWithEBSController(req, res, db);
  });

  // Health check for external systems
  router.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        legalDocsAPI: "available",
        ebsIntegration: "active",
      },
    });
  });

  return router;
}
