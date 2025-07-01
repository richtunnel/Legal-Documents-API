import { logger } from "../utils/logger";
import { ServiceDefinition, ServiceHealth, HealthCheck } from "../types/types";
import { EventType } from "../types/events";
import { EventBus } from "../infrastructure/eventBus";

export class DocumentServiceRegistry {
  private readonly SERVICE_PREFIX = "doc_services:";
  private readonly HEALTH_PREFIX = "health:";
  private readonly TTL = 60; // 60 seconds

  constructor(private redisClient: any, private eventBus: EventBus, private logger: any) {}

  async registerService(service: ServiceDefinition): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn("Redis not available, skipping service registration");
      return;
    }

    try {
      const serviceKey = `${this.SERVICE_PREFIX}${service.name}:${service.id}`;
      const healthKey = `${this.HEALTH_PREFIX}${service.id}`;

      // Store service definition
      await this.redisClient.setEx(serviceKey, this.TTL, JSON.stringify(service));

      // Store health separately for faster queries
      await this.redisClient.setEx(healthKey, this.TTL, JSON.stringify(service.health));

      // Add to services list
      await this.redisClient.sAdd(`services_list:${service.name}`, service.id);

      // Publish service started event
      await this.eventBus.publish({
        id: "",
        type: EventType.SERVICE_STARTED,
        timestamp: "",
        version: "1.0",
        source: "service-registry",
        correlationId: "",
        metadata: {
          serviceName: service.name,
          serviceId: service.id,
          endpoint: service.endpoint,
          capabilities: service.capabilities,
        },
      });

      this.logger.info(`Service registered: ${service.name}:${service.id}`, {
        endpoint: service.endpoint,
        capabilities: service.capabilities,
      });
    } catch (error) {
      this.logger.error("Failed to register service", {
        serviceId: service.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async discoverServices(serviceName: string): Promise<ServiceDefinition[]> {
    if (!this.redisClient) {
      this.logger.warn("Redis not available, returning empty service list");
      return [];
    }

    try {
      const serviceIds = await this.redisClient.sMembers(`services_list:${serviceName}`);
      const services: ServiceDefinition[] = [];

      for (const serviceId of serviceIds) {
        const serviceKey = `${this.SERVICE_PREFIX}${serviceName}:${serviceId}`;
        const serviceData = await this.redisClient.get(serviceKey);

        if (serviceData) {
          const service = JSON.parse(serviceData) as ServiceDefinition;

          // Get fresh health data
          const healthKey = `${this.HEALTH_PREFIX}${serviceId}`;
          const healthData = await this.redisClient.get(healthKey);

          if (healthData) {
            service.health = JSON.parse(healthData);
          }

          services.push(service);
        }
      }

      return services.filter((s) => s.health.status !== "unhealthy");
    } catch (error) {
      this.logger.error("Failed to discover services", {
        serviceName,
        error: (error as Error).message,
      });
      return [];
    }
  }

  async updateHealth(serviceId: string, status: ServiceHealth["status"], checks: HealthCheck[] = []): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn("Redis not available, skipping health update");
      return;
    }

    try {
      const healthKey = `${this.HEALTH_PREFIX}${serviceId}`;
      const existingHealthData = await this.redisClient.get(healthKey);

      let health: ServiceHealth;
      if (existingHealthData) {
        health = JSON.parse(existingHealthData);
        health.status = status;
        health.lastChecked = new Date().toISOString();
        health.responseTime = checks.reduce((sum, check) => sum + check.responseTime, 0) / (checks.length || 1);
      } else {
        health = {
          status,
          checks,
          lastChecked: new Date().toISOString(),
          responseTime: checks.length > 0 ? checks.reduce((sum, check) => sum + check.responseTime, 0) / checks.length : 0,
        };
      }

      await this.redisClient.setEx(healthKey, this.TTL, JSON.stringify(health));

      // Publish health change event
      await this.eventBus.publish({
        id: "",
        type: EventType.SERVICE_HEALTH_CHANGED,
        timestamp: "",
        version: "1.0",
        source: "service-registry",
        correlationId: "",
        metadata: {
          serviceId,
          previousHealth: existingHealthData ? JSON.parse(existingHealthData).status : "unknown",
          newHealth: status,
        },
      });
    } catch (error) {
      this.logger.error("Failed to update service health", {
        serviceId,
        error: (error as Error).message,
      });
    }
  }

  async deregisterService(serviceId: string): Promise<void> {
    if (!this.redisClient) {
      this.logger.warn("Redis not available, skipping service deregistration");
      return;
    }

    try {
      // Find and remove service
      const keys = await this.redisClient.keys(`${this.SERVICE_PREFIX}*:${serviceId}`);

      if (keys.length > 0) {
        const serviceData = await this.redisClient.get(keys[0]);
        if (serviceData) {
          const service = JSON.parse(serviceData) as ServiceDefinition;

          // Remove from Redis
          await Promise.all([this.redisClient.del(keys[0]), this.redisClient.del(`${this.HEALTH_PREFIX}${serviceId}`), this.redisClient.sRem(`services_list:${service.name}`, serviceId)]);

          // Publish service stopped event
          await this.eventBus.publish({
            id: "",
            type: EventType.SERVICE_STOPPED,
            timestamp: "",
            version: "1.0",
            source: "service-registry",
            correlationId: "",
            metadata: {
              serviceName: service.name,
              serviceId: serviceId,
            },
          });

          this.logger.info(`Service deregistered: ${service.name}:${serviceId}`);
        }
      }
    } catch (error) {
      this.logger.error("Failed to deregister service", {
        serviceId,
        error: (error as Error).message,
      });
    }
  }

  async getHealthyServices(serviceName: string): Promise<ServiceDefinition[]> {
    const services = await this.discoverServices(serviceName);
    return services.filter((s) => s.health.status === "healthy");
  }
}
