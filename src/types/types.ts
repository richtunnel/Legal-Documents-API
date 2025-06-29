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
}
