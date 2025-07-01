import { redisClient } from "../config/redis";
import { logger } from "../utils/logger";
import { BaseEvent, EventType } from "../types/events";
import { ServiceDefinition, ServiceHealth } from "../types/types";

export interface IEventPublisher {
  publish<T extends BaseEvent>(event: T): Promise<void>;
  publishBatch<T extends BaseEvent>(events: T[]): Promise<void>;
}

export interface IEventSubscriber {
  subscribe<T extends BaseEvent>(eventType: EventType | string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(eventType: EventType | string, handler: EventHandler<any>): Promise<void>;
}

export type EventHandler<T extends BaseEvent = BaseEvent> = (event: T) => Promise<void>;

export class EventBus implements IEventPublisher, IEventSubscriber {
  private subscribers = new Map<string, Set<EventHandler>>();
  private middleware: EventMiddleware[] = [];
  private publishedEvents: BaseEvent[] = [];

  constructor(private redisClient: any, private logger: any, private options: EventBusOptions = {}) {
    this.setupRedisSubscriber();
  }

  // Publish events
  async publish<T extends BaseEvent>(event: T): Promise<void> {
    try {
      // Apply middleware pipeline
      const processedEvent = await this.applyMiddleware(event);

      // CHECK IF REDIS CLIENT EXISTS BEFORE USING IT
      if (this.redisClient && this.redisClient.publish) {
        await this.redisClient.publish(`events:${processedEvent.type}`, JSON.stringify(processedEvent));
      } else {
        // Redis not available, just log it
        this.logger.warn("Redis client not available, skipping Redis publish");
      }

      // Store for replay/debugging
      this.publishedEvents.push(processedEvent);
      if (this.publishedEvents.length > 1000) {
        this.publishedEvents.shift();
      }

      this.logger.debug("Event published", {
        eventId: processedEvent.id,
        type: processedEvent.type,
        source: processedEvent.source,
      });
    } catch (error) {
      this.logger.error("Failed to publish event", {
        eventId: event.id,
        type: event.type,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async publishBatch<T extends BaseEvent>(events: T[]): Promise<void> {
    if (!this.redisClient || !this.redisClient.pipeline) {
      this.logger.warn("Redis client not available, skipping batch publish");
      return;
    }

    try {
      const pipeline = this.redisClient.pipeline();

      for (const event of events) {
        const processedEvent = await this.applyMiddleware(event);
        pipeline.publish(`events:${processedEvent.type}`, JSON.stringify(processedEvent));
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error("Failed to publish batch events", {
        error: (error as Error).message,
      });
    }
  }

  // Subscribe to events
  async subscribe<T extends BaseEvent>(eventType: EventType | string, handler: EventHandler<T>): Promise<void> {
    const key = eventType.toString();

    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }

    this.subscribers.get(key)!.add(handler as EventHandler);

    this.logger.info(`Subscribed to event: ${eventType}`);
  }

  async unsubscribe(eventType: EventType | string, handler: EventHandler<any>): Promise<void> {
    const key = eventType.toString();
    const handlers = this.subscribers.get(key);

    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscribers.delete(key);
      }
    }
  }

  // Middleware support
  use(middleware: EventMiddleware): void {
    this.middleware.push(middleware);
  }

  // Get published events for debugging/replay
  getPublishedEvents(limit = 100): BaseEvent[] {
    return this.publishedEvents.slice(-limit);
  }

  // Redis subscriber setup
  private setupRedisSubscriber(): void {
    if (!this.redisClient || !this.redisClient.duplicate) {
      this.logger.warn("Redis client not available, skipping Redis subscriber setup");
      return;
    }

    try {
      const subscriber = this.redisClient.duplicate();
      subscriber.pSubscribe("events:*");

      subscriber.on("pmessage", async (pattern: string, channel: string, message: string) => {
        try {
          const event = JSON.parse(message) as BaseEvent;
          const eventType = channel.replace("events:", "");
          await this.handleEvent(eventType, event);
        } catch (error) {
          this.logger.error("Failed to process Redis event", {
            channel,
            error: (error as Error).message,
          });
        }
      });
    } catch (error) {
      this.logger.warn("Failed to setup Redis subscriber", {
        error: (error as Error).message,
      });
    }
  }

  private async handleEvent(eventType: string, event: BaseEvent): Promise<void> {
    // Handle specific event type subscriptions
    const specificHandlers = this.subscribers.get(eventType);
    if (specificHandlers) {
      await this.executeHandlers(specificHandlers, event);
    }

    // Handle wildcard subscriptions (e.g., "document.*")
    for (const [subscribedType, handlers] of this.subscribers) {
      if (subscribedType.endsWith("*")) {
        const prefix = subscribedType.slice(0, -1);
        if (eventType.startsWith(prefix)) {
          await this.executeHandlers(handlers, event);
        }
      }
    }

    // Handle global subscriptions ("*")
    const globalHandlers = this.subscribers.get("*");
    if (globalHandlers) {
      await this.executeHandlers(globalHandlers, event);
    }
  }

  private async executeHandlers(handlers: Set<EventHandler>, event: BaseEvent): Promise<void> {
    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error("Event handler failed", {
          eventId: event.id,
          eventType: event.type,
          error: (error as Error).message,
        });
      }
    });

    await Promise.allSettled(promises);
  }

  private async applyMiddleware(event: BaseEvent): Promise<BaseEvent> {
    let processedEvent = { ...event };

    for (const middleware of this.middleware) {
      processedEvent = await middleware(processedEvent);
    }

    return processedEvent;
  }
}

export type EventMiddleware = (event: BaseEvent) => Promise<BaseEvent>;

export interface EventBusOptions {
  enableRetries?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

// Event middleware implementations
export const generateEventIdMiddleware: EventMiddleware = async (event) => {
  if (!event.id) {
    event.id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return event;
};

export const timestampMiddleware: EventMiddleware = async (event) => {
  if (!event.timestamp) {
    event.timestamp = new Date().toISOString();
  }
  return event;
};

export const correlationMiddleware: EventMiddleware = async (event) => {
  if (!event.correlationId) {
    event.correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return event;
};

// ============================================
// SERVICE REGISTRY IMPLEMENTATION
// ============================================

// infrastructure/serviceRegistry.ts
export class ServiceRegistry {
  private readonly SERVICE_PREFIX = "services:";
  private readonly HEALTH_PREFIX = "health:";
  private readonly TTL = 60; // seconds

  constructor(private redisClient: any, private eventBus: EventBus, private logger: any) {}

  async register(service: ServiceDefinition): Promise<void> {
    try {
      const serviceKey = `${this.SERVICE_PREFIX}${service.name}:${service.id}`;
      const healthKey = `${this.HEALTH_PREFIX}${service.id}`;

      // Store service definition
      await this.redisClient.setEx(serviceKey, this.TTL, JSON.stringify(service));

      // Store health separately
      await this.redisClient.setEx(healthKey, this.TTL, JSON.stringify(service.health));

      // Add to service name index
      await this.redisClient.sAdd(`service_names:${service.name}`, service.id);

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
        },
      } as BaseEvent);

      this.logger.info(`Service registered: ${service.name}:${service.id}`);
    } catch (error) {
      this.logger.error("Failed to register service", {
        serviceId: service.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async deregister(serviceId: string): Promise<void> {
    try {
      // Find and remove service
      const keys = await this.redisClient.keys(`${this.SERVICE_PREFIX}*:${serviceId}`);

      if (keys.length > 0) {
        const serviceData = await this.redisClient.get(keys[0]);
        if (serviceData) {
          const service = JSON.parse(serviceData) as ServiceDefinition;

          // Remove from Redis
          await Promise.all([this.redisClient.del(keys[0]), this.redisClient.del(`${this.HEALTH_PREFIX}${serviceId}`), this.redisClient.sRem(`service_names:${service.name}`, serviceId)]);

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
          } as BaseEvent);

          this.logger.info(`Service deregistered: ${service.name}:${serviceId}`);
        }
      }
    } catch (error) {
      this.logger.error("Failed to deregister service", {
        serviceId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async discover(serviceName: string): Promise<ServiceDefinition[]> {
    try {
      const serviceIds = await this.redisClient.sMembers(`service_names:${serviceName}`);
      const services: ServiceDefinition[] = [];

      for (const serviceId of serviceIds) {
        const serviceKey = `${this.SERVICE_PREFIX}${serviceName}:${serviceId}`;
        const serviceData = await this.redisClient.get(serviceKey);

        if (serviceData) {
          const service = JSON.parse(serviceData) as ServiceDefinition;

          // Get fresh health data
          const healthData = await this.redisClient.get(`${this.HEALTH_PREFIX}${serviceId}`);
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

  async updateHealth(serviceId: string, health: ServiceHealth): Promise<void> {
    try {
      const healthKey = `${this.HEALTH_PREFIX}${serviceId}`;
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
          health: health.status,
        },
      } as BaseEvent);
    } catch (error) {
      this.logger.error("Failed to update service health", {
        serviceId,
        error: (error as Error).message,
      });
    }
  }

  async getHealthyServices(serviceName: string): Promise<ServiceDefinition[]> {
    const services = await this.discover(serviceName);
    return services.filter((s) => s.health.status === "healthy");
  }
}
