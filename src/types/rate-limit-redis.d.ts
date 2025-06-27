import { Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";

declare module "express-rate-limit" {
  interface Store {
    increment?: (key: string) => Promise<{ totalHits: number; resetTime?: Date }>;
    decrement?: (key: string) => Promise<void>;
    resetKey?: (key: string) => Promise<void>;
    get?: (key: string) => Promise<{ totalHits: number; resetTime?: Date } | null>;
    set?: (key: string, value: number, expiry: number) => Promise<void>;
    resetAll?: () => Promise<void>;
  }
}

declare module "rate-limit-redis" {
  interface RedisStore extends Store {}
}
