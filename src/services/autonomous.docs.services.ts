import { Database } from "sqlite";
import { DocumentServiceRegistry } from "./registry.services";
import { DocumentService } from "./document.services";
import { logger } from "../utils/logger";
import { config } from "../env-config";
import { ServiceDefinition, Document, ServiceCapability, ServiceHealth, HealthCheck } from "../types/types";
import { EventBus } from "../infrastructure/eventBus";

// Define valid service capabilities as ServiceCapability objects
const ServiceCapabilities: Record<string, ServiceCapability> = {
  UPLOAD: {
    name: "document.upload",
    version: "1.0.0",
    description: "Upload a document to the service",
    dependencies: ["database"],
  },
  DOWNLOAD: {
    name: "document.download",
    version: "1.0.0",
    description: "Download a document from the service",
    dependencies: ["database"],
  },
  LIST: {
    name: "document.list",
    version: "1.0.0",
    description: "List all documents for a user",
    dependencies: ["database"],
  },
  DELETE: {
    name: "document.delete",
    version: "1.0.0",
    description: "Delete a document",
    dependencies: ["database"],
  },
  METADATA: {
    name: "document.metadata",
    version: "1.0.0",
    description: "Retrieve document metadata",
    dependencies: ["database"],
  },
} as const;

export class AutonomousDocumentService {
  private serviceId: string;
  private serviceDefinition: ServiceDefinition;
  private healthCheckInterval?: NodeJS.Timeout;
  private documentService: DocumentService;

  constructor(private db: Database, private serviceRegistry: DocumentServiceRegistry, private eventBus: EventBus, private serviceCapability: ServiceCapability) {
    this.serviceId = `doc-service-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.documentService = new DocumentService(
      this.db,
      this.eventBus,
      null, // storage service
      null, // webhook service
      logger
    );
    this.serviceDefinition = this.createServiceDefinition();
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await this.healthCheck();

      // Register with service registry
      await this.serviceRegistry.registerService(this.serviceDefinition);

      // Start health monitoring
      this.startHealthMonitoring();

      logger.info("Enhanced autonomous document service started", {
        serviceId: this.serviceId,
        capabilities: this.serviceDefinition.capabilities.map((cap) => cap.name),
      });
    } catch (error) {
      logger.error("Failed to start autonomous service", { error: (error as Error).message });
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Deregister service
      await this.serviceRegistry.deregisterService(this.serviceId);

      logger.info("Enhanced autonomous document service stopped", { serviceId: this.serviceId });
    } catch (error) {
      logger.error("Failed to stop autonomous service", { error: (error as Error).message });
    }
  }

  async uploadDocument(file: Express.Multer.File, userId: number, correlationId?: string): Promise<Document> {
    try {
      if (!this.canHandleRequest(ServiceCapabilities.UPLOAD)) {
        throw new Error("Service not available for document upload");
      }

      return await this.documentService.uploadDocument(userId, file.originalname, file.buffer, correlationId);
    } catch (error) {
      logger.error("Document upload failed", {
        userId,
        serviceId: this.serviceId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getDocuments(userId: number): Promise<Document[]> {
    try {
      if (!this.canHandleRequest(ServiceCapabilities.LIST)) {
        throw new Error("Service not available for document listing");
      }

      return await this.documentService.fetchDocuments(userId);
    } catch (error) {
      logger.error("Failed to get documents", {
        userId,
        serviceId: this.serviceId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getDocument(userId: number, documentId: number, correlationId?: string): Promise<{ document: Document; file: Buffer }> {
    try {
      if (!this.canHandleRequest(ServiceCapabilities.DOWNLOAD)) {
        throw new Error("Service not available for document download");
      }

      return await this.documentService.fetchDocument(userId, documentId, correlationId);
    } catch (error) {
      logger.error("Failed to get document", {
        documentId,
        userId,
        serviceId: this.serviceId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async deleteDocument(userId: number, documentId: number, correlationId?: string): Promise<void> {
    try {
      if (!this.canHandleRequest(ServiceCapabilities.DELETE)) {
        throw new Error("Service not available for document deletion");
      }

      await this.documentService.deleteDocument(userId, documentId, correlationId);
    } catch (error) {
      logger.error("Failed to delete document", {
        documentId,
        userId,
        serviceId: this.serviceId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  getServiceId(): string {
    return this.serviceId;
  }

  private async healthCheck(): Promise<void> {
    const healthChecks: HealthCheck[] = [];
    try {
      // Test database connection
      const startTime = Date.now();
      await this.db.get("SELECT 1");
      healthChecks.push({
        name: "database",
        status: "pass",
        output: "Database connection successful",
        responseTime: Date.now() - startTime,
      });

      // Update health status with checks
      await this.serviceRegistry.updateHealth(this.serviceId, "healthy", healthChecks);
    } catch (error) {
      healthChecks.push({
        name: "database",
        status: "fail",
        output: `Database connection failed: ${(error as Error).message}`,
        responseTime: 0,
      });
      await this.serviceRegistry.updateHealth(this.serviceId, "unhealthy", healthChecks);
      throw error;
    }
  }

  private canHandleRequest(capability: ServiceCapability): boolean {
    return this.serviceDefinition.capabilities.some((cap) => cap.name === capability.name) && this.serviceDefinition.health.status !== "unhealthy";
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        logger.warn("Health check failed", {
          serviceId: this.serviceId,
          error: (error as Error).message,
        });
      }
    }, 30000); // Every 30 seconds
  }

  private createServiceDefinition(): ServiceDefinition {
    return {
      id: this.serviceId,
      name: "document-service",
      version: "2.0.0",
      endpoint: `http://localhost:${config.PORT}`,
      port: parseInt(config.PORT) || 3000,
      capabilities: [ServiceCapabilities.UPLOAD, ServiceCapabilities.DOWNLOAD, ServiceCapabilities.LIST, ServiceCapabilities.DELETE, ServiceCapabilities.METADATA],
      health: {
        status: "healthy",
        checks: [],
        lastChecked: new Date().toISOString(),
        responseTime: 0,
      },
      metadata: {
        environment: config.NODE_ENV || "development",
        owner: "document-api-team",
        description: "Enhanced document management service with event-driven architecture",
      },
      registeredAt: new Date().toISOString(),
    };
  }
}
