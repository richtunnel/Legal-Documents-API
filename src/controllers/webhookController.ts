import { Request, Response } from "express";
import { Database } from "sqlite";

// Original webhook controllers (updated for your schema)
export const registerWebhookController = async (req: Request, res: Response, db: Database) => {
  try {
    const { url, events, name, secret, active = true } = req.body;
    const userId = (req as any).user?.id; // Assumes authMiddleware sets req.user

    // Support both new format (events array) and legacy format (single event_type)
    const eventsJson = Array.isArray(events) ? JSON.stringify(events) : JSON.stringify([events || "document.updated"]);
    const eventType = Array.isArray(events) ? events[0] : events; // For backward compatibility

    // Insert new webhook registration
    const result = await db.run(
      `
      INSERT INTO webhooks (user_id, url, event_type, events, name, secret, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
      [userId, url, eventType, eventsJson, name, secret, active ? 1 : 0]
    );

    const webhook = await db.get(
      `
      SELECT * FROM webhooks WHERE id = ?
    `,
      [result.lastID]
    );

    res.status(201).json({
      message: "Webhook registered successfully",
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events ? JSON.parse(webhook.events) : [webhook.event_type],
        name: webhook.name,
        active: webhook.active === 1,
        created_at: webhook.created_at,
        user_id: webhook.user_id,
      },
    });
  } catch (error: any) {
    console.error("Error registering webhook:", error);
    res.status(500).json({
      error: "Failed to register webhook",
      details: error.message,
    });
  }
};

export const getWebhooksController = async (req: Request, res: Response, db: Database) => {
  try {
    const { active, limit = 50, offset = 0 } = req.query;
    const userId = (req as any).user?.id; // Assumes authMiddleware sets req.user

    let query = "SELECT * FROM webhooks WHERE user_id = ?";
    const params: any[] = [userId];

    if (active !== undefined) {
      query += " AND active = ?";
      params.push(active === "true" ? 1 : 0);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(Number(limit), Number(offset));

    const webhooks = await db.all(query, params);

    const formattedWebhooks = webhooks.map((webhook) => ({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events ? JSON.parse(webhook.events) : [webhook.event_type],
      name: webhook.name,
      active: webhook.active === 1,
      created_at: webhook.created_at,
      updated_at: webhook.updated_at,
      user_id: webhook.user_id,
    }));

    res.status(200).json({
      webhooks: formattedWebhooks,
      count: formattedWebhooks.length,
    });
  } catch (error: any) {
    console.error("Error fetching webhooks:", error);
    res.status(500).json({
      error: "Failed to fetch webhooks",
      details: error.message,
    });
  }
};

export const handleLegalDocumentWebhook = async (req: Request, res: Response, db: Database) => {
  try {
    const { documentId, documentType, status, clientId, metadata, webhookType, ebsReference } = req.body;
    const userId = (req as any).user?.id; // Get user from auth middleware

    // Store webhook event in database
    await db.run(
      `
      INSERT INTO legal_document_events 
      (document_id, document_type, status, client_id, metadata, webhook_type, ebs_reference, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
      [documentId, documentType, status, clientId, JSON.stringify(metadata), webhookType, ebsReference]
    );

    // Create or update the legal document record
    await db.run(
      `
      INSERT OR REPLACE INTO legal_documents 
      (document_id, document_type, status, client_id, title, metadata, ebs_reference, user_id, created_at, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM legal_documents WHERE document_id = ?), datetime('now')),
        datetime('now'))
    `,
      [documentId, documentType, status, clientId, metadata.title || "Untitled Document", JSON.stringify(metadata), ebsReference, userId, documentId]
    );

    // Process different webhook types
    switch (webhookType) {
      case "document.created":
        await handleDocumentCreated(documentId, clientId, userId, db);
        break;
      case "document.signed":
        await handleDocumentSigned(documentId, metadata, userId, db);
        break;
      case "document.status_changed":
        await handleStatusChange(documentId, status, userId, db);
        break;
    }

    // If EBS reference exists, sync with EBS
    if (ebsReference) {
      await syncDocumentWithEBS(documentId, ebsReference, userId, db);
    }

    res.status(200).json({
      message: "Legal document webhook processed successfully",
      documentId,
      status: "processed",
    });
  } catch (error: any) {
    console.error("Error processing legal document webhook:", error);
    res.status(500).json({
      error: "Failed to process legal document webhook",
      details: error.message,
    });
  }
};

export const handleEBSUpdateWebhook = async (req: Request, res: Response, db: Database) => {
  try {
    const { transactionId, sourceSystem, operation, entityType, entityId, data, timestamp, correlationId } = req.body;

    // Store EBS event in database
    await db.run(
      `
      INSERT INTO ebs_events 
      (transaction_id, source_system, operation, entity_type, entity_id, data, correlation_id, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
      [transactionId, sourceSystem, operation, entityType, entityId, JSON.stringify(data), correlationId]
    );

    // Process based on entity type and operation
    switch (entityType) {
      case "CUSTOMER":
        await processCustomerUpdate(entityId, operation, data, db);
        break;
      case "CONTRACT":
        await processContractUpdate(entityId, operation, data, db);
        break;
      case "INVOICE":
        await processInvoiceUpdate(entityId, operation, data, db);
        break;
    }

    res.status(200).json({
      message: "EBS webhook processed successfully",
      transactionId,
      status: "processed",
    });
  } catch (error: any) {
    console.error("Error processing EBS webhook:", error);
    res.status(500).json({
      error: "Failed to process EBS webhook",
      details: error.message,
    });
  }
};

export const processDocumentStatusUpdate = async (req: Request, res: Response, db: Database) => {
  try {
    const { documentId, status, metadata } = req.body;
    const userId = (req as any).user?.id;

    // Verify user has access to this document
    const existingDoc = await db.get(
      `
      SELECT * FROM legal_documents 
      WHERE document_id = ? AND user_id = ?
    `,
      [documentId, userId]
    );

    if (!existingDoc) {
      return res.status(404).json({
        error: "Document not found or access denied",
      });
    }

    // Update document status in local database
    await db.run(
      `
      UPDATE legal_documents 
      SET status = ?, last_updated = datetime('now'), metadata = ?
      WHERE document_id = ? AND user_id = ?
    `,
      [status, JSON.stringify(metadata), documentId, userId]
    );

    // Trigger any status-specific workflows
    if (status === "signed") {
      await initiatePostSigningWorkflow(documentId, db);
    } else if (status === "executed") {
      await initiateExecutionWorkflow(documentId, db);
    }

    // Trigger user webhooks
    await triggerUserWebhooks(userId, "document.status_changed", { documentId, status, metadata }, db);

    res.status(200).json({
      message: "Document status updated successfully",
      documentId,
      newStatus: status,
      userId,
    });
  } catch (error: any) {
    console.error("Error updating document status:", error);
    res.status(500).json({
      error: "Failed to update document status",
      details: error.message,
    });
  }
};

export const syncWithEBSController = async (req: Request, res: Response, db: Database) => {
  try {
    const { documentIds, forceSync } = req.body;
    const userId = (req as any).user?.id;

    if (!documentIds || !Array.isArray(documentIds)) {
      return res.status(400).json({
        error: "documentIds array is required",
      });
    }

    const results = [];

    // Only sync documents that belong to the authenticated user
    for (const documentId of documentIds) {
      try {
        // Verify user owns this document
        const document = await db.get(
          `
          SELECT * FROM legal_documents 
          WHERE document_id = ? AND user_id = ?
        `,
          [documentId, userId]
        );

        if (!document) {
          results.push({
            documentId,
            status: "failed",
            error: "Document not found or access denied",
          });
          continue;
        }

        const syncResult = await syncDocumentWithEBS(documentId, document.ebs_reference, userId, db, forceSync);
        results.push({ documentId, status: "synced", syncResult });
      } catch (error: any) {
        results.push({ documentId, status: "failed", error: error.message });
      }
    }

    res.status(200).json({
      message: "EBS sync completed",
      results,
      userId,
    });
  } catch (error: any) {
    console.error("Error during EBS sync:", error);
    res.status(500).json({
      error: "Failed to sync with EBS",
      details: error.message,
    });
  }
};

// Helper functions
async function handleDocumentCreated(documentId: string, clientId: string, userId: number, db: Database) {
  // Implementation for handling document creation
  console.log(`Document ${documentId} created for client ${clientId} by user ${userId}`);

  // You could trigger webhooks to other systems here
  await triggerUserWebhooks(userId, "document.created", { documentId, clientId }, db);
}

async function handleDocumentSigned(documentId: string, metadata: any, userId: number, db: Database) {
  // Implementation for handling document signing
  console.log(`Document ${documentId} signed by all parties for user ${userId}`);

  // Mark as processed
  await db.run(
    `
    UPDATE legal_document_events 
    SET processed = 1 
    WHERE document_id = ? AND webhook_type = 'document.signed'
  `,
    [documentId]
  );

  await triggerUserWebhooks(userId, "document.signed", { documentId, metadata }, db);
}

async function handleStatusChange(documentId: string, status: string, userId: number, db: Database) {
  // Implementation for handling status changes
  console.log(`Document ${documentId} status changed to ${status} for user ${userId}`);

  await triggerUserWebhooks(userId, "document.status_changed", { documentId, status }, db);
}

async function syncDocumentWithEBS(documentId: string, ebsReference: string | null, userId: number, db: Database, forceSync = false) {
  // Implementation for EBS synchronization
  console.log(`Syncing document ${documentId} with EBS for user ${userId}`);

  try {
    // Your EBS API integration logic here
    // const ebsResponse = await callEBSAPI(documentId, ebsReference);

    // Update the document with EBS reference if successful
    if (ebsReference) {
      await db.run(
        `
        UPDATE legal_documents 
        SET ebs_reference = ?, last_updated = datetime('now')
        WHERE document_id = ? AND user_id = ?
      `,
        [ebsReference, documentId, userId]
      );
    }

    return { success: true, ebsReference };
  } catch (error: any) {
    console.error(`EBS sync failed for document ${documentId}:`, error);
    throw error;
  }
}

async function processCustomerUpdate(entityId: string, operation: string, data: any, db: Database) {
  // Implementation for customer updates
  console.log(`Processing customer ${operation} for ${entityId}`);

  // You might want to link this to a specific user based on the data
  // const userId = data.userId || data.managedBy;
}

async function processContractUpdate(entityId: string, operation: string, data: any, db: Database) {
  // Implementation for contract updates
  console.log(`Processing contract ${operation} for ${entityId}`);

  // Update corresponding legal document if it exists
  await db.run(
    `
    UPDATE legal_documents 
    SET metadata = json_patch(metadata, ?), last_updated = datetime('now')
    WHERE ebs_reference = ?
  `,
    [JSON.stringify({ ebsUpdate: data, lastEbsSync: new Date().toISOString() }), entityId]
  );
}

async function processInvoiceUpdate(entityId: string, operation: string, data: any, db: Database) {
  // Implementation for invoice updates
  console.log(`Processing invoice ${operation} for ${entityId}`);
}

async function initiatePostSigningWorkflow(documentId: string, db: Database) {
  // Implementation for post-signing workflow
  console.log(`Initiating post-signing workflow for ${documentId}`);

  // Get document details
  const document = await db.get(
    `
    SELECT * FROM legal_documents WHERE document_id = ?
  `,
    [documentId]
  );

  if (document && document.user_id) {
    await triggerUserWebhooks(document.user_id, "workflow.post_signing", { documentId }, db);
  }
}

async function initiateExecutionWorkflow(documentId: string, db: Database) {
  // Implementation for execution workflow
  console.log(`Initiating execution workflow for ${documentId}`);

  const document = await db.get(
    `
    SELECT * FROM legal_documents WHERE document_id = ?
  `,
    [documentId]
  );

  if (document && document.user_id) {
    await triggerUserWebhooks(document.user_id, "workflow.execution", { documentId }, db);
  }
}

// Helper function to trigger user's registered webhooks
async function triggerUserWebhooks(userId: number, eventType: string, payload: any, db: Database) {
  try {
    // Get user's active webhooks that listen for this event type
    const webhooks = await db.all(
      `
      SELECT * FROM webhooks 
      WHERE user_id = ? AND active = 1 
      AND (event_type = ? OR json_extract(events, ') LIKE '%' || ? || '%')
    `,
      [userId, eventType, eventType]
    );

    for (const webhook of webhooks) {
      // Store delivery attempt
      await db.run(
        `
        INSERT INTO webhook_deliveries (webhook_id, event_type, payload, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `,
        [webhook.id, eventType, JSON.stringify(payload)]
      );

      // Here you would make the actual HTTP request to webhook.url
      // For now, just log it
      console.log(`Would trigger webhook ${webhook.id} at ${webhook.url} for event ${eventType}`);
    }
  } catch (error: any) {
    console.error(`Failed to trigger webhooks for user ${userId}:`, error);
  }
}
