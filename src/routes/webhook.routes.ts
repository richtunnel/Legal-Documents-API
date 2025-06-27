import { Router } from "express";
import { registerWebhookController, getWebhooksController } from "../controllers/webhookController";
import { authMiddleware } from "../middleware/auth";
import { validateDocument, validate } from "../middleware/validate";
import { Database } from "sqlite";

export function webhookRoutes(db: Database) {
  const router = Router();

  router.use(authMiddleware(db));
  router.post("/", validate, (req, res) => registerWebhookController(req, res, db));
  router.get("/", (req, res) => getWebhooksController(req, res, db));

  return router;
}
