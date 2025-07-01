import { Request } from "express";
import { Session, SessionData } from "express-session";
import { RedisClientType } from "redis";
import { Database } from "sqlite";

declare module "express-session" {
  interface SessionData {
    user?: { id: number; email?: string; role?: string };
  }
}

export interface RateLimiterOptions {
  redisClient?: RedisClientType;
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: string;
  current: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export interface User {
  id: number;
  email: string;
  password: string;
  role: string;
  title?: string;
  last_login?: string;
  blob_path?: string;
  created_at?: string;
}

export interface ApiKey {
  id: number;
  user_id: number;
  api_key: string;
  created_at: string;
  token: string;
}

export interface Document {
  id: number;
  user_id: number;
  title: string;
  blob_path: string;
  created_at?: string;
  mimeType?: string;
  mimetype?: string;
  size?: string;
}

export interface Webhook {
  id: number;
  user_id: number;
  url: string;
  event_type: string;
}

export interface ServerContext {
  db: Database | null;
  server: any;
  redisConnected: boolean;
}

export interface AuthResponse {
  token: string;
  user: { id: number; email: string; role: string };
}

export interface ErrorResponse {
  message: string;
  errors?: Array<{ msg: string; param?: string; location?: string }>;
}

export interface CustomRequest extends Request {
  session: Session & Partial<SessionData>;
  file?: Express.Multer.File;
  user?: {
    id: number;
    email?: string;
    role?: string;
    name?: string;
    created_at?: string;
    last_login?: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface RefreshTokenData {
  id: string;
  userId: number;
  token: string;
  expiresAt: string;
  created_at: string;
  isRevoked: boolean;
  deviceInfo?: string;
}

// SOA / EBS types
export interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  endpoint: string;
  port: number;
  capabilities: ServiceCapability[];
  health: ServiceHealth;
  metadata: ServiceMetadata;
  registeredAt?: string;
  lastHeartbeat?: string;
}

export interface ServiceCapability {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  lastChecked: string;
  responseTime: number;
}

export interface HealthCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  output?: string;
  responseTime: number;
}

export interface ServiceMetadata {
  environment: string;
  region?: string;
  owner: string;
  contact?: string;
  tags?: string[];
  description?: string;
}
