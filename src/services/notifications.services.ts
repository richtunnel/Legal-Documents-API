import { EventBus } from "../infrastructure/eventBus";
import { DocumentServiceRegistry } from "./registry.services";

export class NotificationService {
  private isStarted: boolean = false;
  private eventBus: EventBus;
  private serviceRegistry: any;
  private logger: any;

  constructor(eventBus: EventBus, serviceRegistry: any, logger: any) {
    this.eventBus = eventBus;
    this.serviceRegistry = serviceRegistry;
    this.logger = logger;
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    this.logger.info("NotificationService starting...");

    // Subscribe to events that need notifications
    try {
      await this.eventBus.subscribe("user.registered", this.handleUserRegistered.bind(this));
      await this.eventBus.subscribe("document.uploaded", this.handleDocumentUploaded.bind(this));
      await this.eventBus.subscribe("document.signed", this.handleDocumentSigned.bind(this));
      // Add more event subscriptions as needed
    } catch (error: any) {
      this.logger.error("Failed to subscribe to events:", error);
    }

    this.isStarted = true;
    this.logger.info("NotificationService started successfully");
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    this.logger.info("NotificationService stopping...");
    // Add cleanup logic here

    this.isStarted = false;
    this.logger.info("NotificationService stopped");
  }

  async sendNotification(type: string, message: string, recipient?: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error("NotificationService not started. Call start() first.");
    }

    this.logger.info(`Notification [${type}]: ${message}`, recipient ? `to ${recipient}` : "");
    // Add your notification logic here
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error("NotificationService not started. Call start() first.");
    }

    this.logger.info(`Email to ${to}: ${subject}`);
    // Add email sending logic here
  }

  async sendSMS(to: string, message: string): Promise<void> {
    if (!this.isStarted) {
      throw new Error("NotificationService not started. Call start() first.");
    }

    this.logger.info(`SMS to ${to}: ${message}`);
    // Add SMS sending logic here
  }

  // Event handlers
  private async handleUserRegistered(event: any): Promise<void> {
    try {
      this.logger.info("Handling user registered event:", event);
      // Send welcome email, etc.
    } catch (error: any) {
      this.logger.error("Failed to handle user registered event:", error);
    }
  }

  private async handleDocumentUploaded(event: any): Promise<void> {
    try {
      this.logger.info("Handling document uploaded event:", event);
      // Send notification about document upload
    } catch (error: any) {
      this.logger.error("Failed to handle document uploaded event:", error);
    }
  }

  private async handleDocumentSigned(event: any): Promise<void> {
    try {
      this.logger.info("Handling document signed event:", event);
      // Send notification about document signing
    } catch (error: any) {
      this.logger.error("Failed to handle document signed event:", error);
    }
  }

  isRunning(): boolean {
    return this.isStarted;
  }
}

export default NotificationService;
