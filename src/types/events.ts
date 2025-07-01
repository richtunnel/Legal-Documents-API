export enum EventType {
  // Document Events
  DOCUMENT_UPLOADED = "document.uploaded",
  DOCUMENT_DOWNLOADED = "document.downloaded",
  DOCUMENT_DELETED = "document.deleted",
  DOCUMENT_PROCESSED = "document.processed",
  DOCUMENT_SHARED = "document.shared",

  // Auth Events
  USER_REGISTERED = "auth.user.registered",
  USER_LOGIN = "auth.user.login",
  USER_LOGOUT = "auth.user.logout",
  TOKEN_REFRESHED = "auth.token.refreshed",
  TOKEN_REVOKED = "auth.token.revoked",

  // System Events
  SERVICE_STARTED = "system.service.started",
  SERVICE_STOPPED = "system.service.stopped",
  SERVICE_HEALTH_CHANGED = "system.service.health_changed",

  SYSTEM_RATE_LIMIT_EXCEEDED = "system.rate_limit.exceeded",

  // Notification Events
  EMAIL_SENT = "notification.email.sent",
  SMS_SENT = "notification.sms.sent",
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: string;
  version: string;
  source: string;
  correlationId: string;
  userId?: number;
  metadata: Record<string, any>;
}

export interface DocumentEvent extends BaseEvent {
  payload: {
    documentId: number;
    userId: number;
    filename: string;
    mimetype: string;
    size: number;
    action: string;
    previousState?: any;
    newState?: any;
  };
}

export interface AuthEvent extends BaseEvent {
  payload: {
    userId: number;
    action: string;
    ipAddress: string;
    userAgent: string;
    tokenId?: string;
    success: boolean;
    reason?: string;
  };
}
