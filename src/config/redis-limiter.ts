// import { Request, Response, NextFunction } from "express";
// import { createClient, RedisClientType } from "redis";
// import { RateLimiterOptions, RateLimitStatus, AuthenticatedRequest } from "./types/rateLimiter";

// export class RateLimiter {
//   private redisClient: RedisClientType;
//   private windowMs: number;
//   private max: number;
//   private keyGenerator: (req: Request) => string;
//   private skipSuccessfulRequests: boolean;
//   private skipFailedRequests: boolean;

//   constructor(options: RateLimiterOptions = {}) {
//     this.redisClient = options.redisClient || createClient();
//     this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
//     this.max = options.max || 100; // 100 requests per window default
//     this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
//     this.skipSuccessfulRequests = options.skipSuccessfulRequests || false;
//     this.skipFailedRequests = options.skipFailedRequests || false;

//     // Ensure Redis connection
//     if (!this.redisClient.isOpen) {
//       this.redisClient.connect().catch(console.error);
//     }
//   }

//   private defaultKeyGenerator(req: Request): string {
//     return `rate_limit:${req.ip}:${req.route?.path || req.path}`;
//   }

//   public middleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
//     try {
//       const key = this.keyGenerator(req);
//       const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
//       const windowKey = `${key}:${windowStart}`;

//       // Get current count
//       const current = await this.redisClient.get(windowKey);
//       const currentCount = parseInt(current || "0", 10);

//       // Check if limit exceeded
//       if (currentCount >= this.max) {
//         const resetTime = windowStart + this.windowMs;
//         const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);

//         res.set({
//           "X-RateLimit-Limit": this.max.toString(),
//           "X-RateLimit-Remaining": "0",
//           "X-RateLimit-Reset": new Date(resetTime).toISOString(),
//           "Retry-After": retryAfter.toString(),
//         });

//         res.status(429).json({
//           error: "Too Many Requests",
//           message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
//           retryAfter: retryAfter,
//         });
//         return;
//       }

//       // Increment counter
//       const newCount = currentCount + 1;
//       await this.redisClient.setEx(windowKey, Math.ceil(this.windowMs / 1000), newCount.toString());

//       // Set response headers
//       const resetTime = windowStart + this.windowMs;
//       res.set({
//         "X-RateLimit-Limit": this.max.toString(),
//         "X-RateLimit-Remaining": Math.max(0, this.max - newCount).toString(),
//         "X-RateLimit-Reset": new Date(resetTime).toISOString(),
//       });

//       // Handle response-based rate limiting
//       if (this.skipSuccessfulRequests || this.skipFailedRequests) {
//         const originalEnd = res.end;
//         res.end = async (chunk?: any, encoding?: BufferEncoding): void => {
//           const shouldSkip = (this.skipSuccessfulRequests && res.statusCode < 400) || (this.skipFailedRequests && res.statusCode >= 400);

//           if (shouldSkip) {
//             // Decrement counter if we should skip this request
//             const current = await this.redisClient.get(windowKey);
//             if (current) {
//               const decremented = Math.max(0, parseInt(current, 10) - 1);
//               await this.redisClient.setEx(windowKey, Math.ceil(this.windowMs / 1000), decremented.toString());
//             }
//           }

//           originalEnd.call(res, chunk, encoding);
//         };
//       }

//       next();
//     } catch (error) {
//       console.error("Rate limiter error:", error);
//       // Fail open - allow request if Redis is down
//       next();
//     }
//   };

//   // Reset rate limit for a specific key
//   public async reset(req: Request): Promise<void> {
//     const key = this.keyGenerator(req);
//     const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
//     const windowKey = `${key}:${windowStart}`;

//     await this.redisClient.del(windowKey);
//   }

//   // Get current rate limit status
//   public async getStatus(req: Request): Promise<RateLimitStatus> {
//     const key = this.keyGenerator(req);
//     const windowStart = Math.floor(Date.now() / this.windowMs) * this.windowMs;
//     const windowKey = `${key}:${windowStart}`;

//     const current = await this.redisClient.get(windowKey);
//     const currentCount = parseInt(current || "0", 10);
//     const resetTime = windowStart + this.windowMs;

//     return {
//       limit: this.max,
//       remaining: Math.max(0, this.max - currentCount),
//       reset: new Date(resetTime).toISOString(),
//       current: currentCount,
//     };
//   }

//   public async disconnect(): Promise<void> {
//     await this.redisClient.quit();
//   }
// }
