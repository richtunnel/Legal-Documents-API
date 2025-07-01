import jwt from "jsonwebtoken";
import { Database } from "sqlite";
import bcrypt from "bcrypt";
import { config } from "../env-config";
import { findUserByEmail, createUser } from "../models/user.model";
import { createApiKey, findApiKey } from "../models/apiKey.model";
import { logger } from "../utils/logger";
import { EventBus } from "../infrastructure/eventBus";
import { TokenPair, User } from "../types/types";
import { AuthEvent, EventType } from "../types/events";

export class AuthService {
  constructor(private db: Database, private eventBus: EventBus, private logger: any) {}

  // Enhanced login with refresh tokens and events
  async login(email: string, password: string, ipAddress: string = "unknown", userAgent: string = "unknown"): Promise<{ user: User; tokens: TokenPair }> {
    try {
      const user = await findUserByEmail(this.db, email);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        // Publish failed login event
        // await this.publishAuthEvent(0, "login", ipAddress, userAgent, false, "Invalid credentials");
        throw new Error("Invalid credentials");
      }

      // Update last login
      await this.db.run("UPDATE users SET last_login = ? WHERE id = ?", [new Date().toISOString(), user.id]);

      // Generate token pair
      const tokens = await this.generateTokenPair(user.id);

      // Publish successful login event
      // await this.publishAuthEvent(user.id, "login", ipAddress, userAgent, true);

      logger.info("User logged in successfully", {
        userId: user.id,
        email: user.email,
        ipAddress,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          title: user.title || "",
          password: user.password || "",
          role: user.role,
          created_at: user.created_at,
          last_login: new Date().toISOString(),
        },
        tokens,
      };
    } catch (error) {
      logger.error("Login failed", { email, error: (error as Error).message });
      throw error;
    }
  }

  // Enhanced register with events
  async register(email: string, password: string, name: string): Promise<{ user: User; apiKey: any; tokens: TokenPair }> {
    try {
      // Check if user exists
      const existingUser = await findUserByEmail(this.db, email);
      if (existingUser) {
        throw new Error("User already exists");
      }

      // Create user (your existing createUser function)
      const user = await createUser(this.db, email, password);

      // Create API key (your existing function)
      const apiKey = await createApiKey(this.db, user.id);

      // Generate tokens
      const tokens = await this.generateTokenPair(user.id);

      // Publish user registered event
      await this.eventBus.publish({
        id: "",
        type: EventType.USER_REGISTERED,
        timestamp: "",
        version: "1.0",
        source: "auth-service",
        correlationId: "",
        userId: user.id,
        payload: {
          userId: user.id,
          action: "register",
          ipAddress: "",
          userAgent: "",
          success: true,
        },
        metadata: {
          email: user.email,
          hasApiKey: !!apiKey,
        },
      } as AuthEvent);

      logger.info("User registered successfully", {
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          title: user.title || "",
          password: user.password,
          role: user.role,
          created_at: user.created_at,
        },
        apiKey,
        tokens,
      };
    } catch (error) {
      logger.error("Registration failed", { email, error: (error as Error).message });
      throw error;
    }
  }

  // Enhanced API key verification with events
  async verifyApiKey(apiKey: string, ipAddress?: string): Promise<number> {
    try {
      logger.debug(`Verifying API key: ${apiKey.substring(0, 8)}...`);

      const result = await findApiKey(this.db, apiKey);
      if (!result) {
        // Publish failed API key event
        // await this.eventBus.publish({
        //   id: "",
        //   type: EventType.USER_LOGIN,
        //   timestamp: "",
        //   version: "1.0",
        //   source: "auth-service",
        //   correlationId: "",
        //   payload: {
        //     userId: 0,
        //     action: "api_key_verification",
        //     ipAddress: ipAddress || "unknown",
        //     userAgent: "api",
        //     success: false,
        //     reason: "Invalid API key",
        //   },
        //   metadata: {
        //     apiKeyPrefix: apiKey.substring(0, 8),
        //   },
        // } as AuthEvent);

        logger.warn(`Invalid API key: ${apiKey.substring(0, 8)}...`);
        throw new Error("Invalid API key");
      }

      // Publish successful API key verification
      // await this.eventBus.publish({
      //   id: "",
      //   type: EventType.USER_LOGIN,
      //   timestamp: "",
      //   version: "1.0",
      //   source: "auth-service",
      //   correlationId: "",
      //   userId: result.user_id,
      //   payload: {
      //     userId: result.user_id,
      //     action: "api_key_verification",
      //     ipAddress: ipAddress || "unknown",
      //     userAgent: "api",
      //     success: true,
      //   },
      //   metadata: {
      //     apiKeyPrefix: apiKey.substring(0, 8),
      //   },
      // } as AuthEvent);

      return result.user_id;
    } catch (error) {
      logger.error("API key verification failed", { error: (error as Error).message });
      throw error;
    }
  }

  // Refresh token functionality
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const tokenData = await this.db.get(
        `
        SELECT rt.*, u.id as user_id
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = ? AND rt.is_revoked = false AND rt.expires_at > ?
      `,
        [refreshToken, new Date().toISOString()]
      );

      if (!tokenData) {
        throw new Error("Invalid refresh token");
      }

      // Revoke old refresh token
      await this.db.run("UPDATE refresh_tokens SET is_revoked = true WHERE id = ?", [tokenData.id]);

      // Generate new token pair
      const tokens = await this.generateTokenPair(tokenData.user_id);

      // Publish token refresh event
      // await this.eventBus.publish({
      //   id: "",
      //   type: EventType.TOKEN_REFRESHED,
      //   timestamp: "",
      //   version: "1.0",
      //   source: "auth-service",
      //   correlationId: "",
      //   userId: tokenData.user_id,
      //   payload: {
      //     userId: tokenData.user_id,
      //     action: "token_refresh",
      //     ipAddress: "",
      //     userAgent: "",
      //     tokenId: tokenData.id,
      //     success: true,
      //   },
      //   metadata: {},
      // } as AuthEvent);

      logger.info("Token refreshed successfully", { userId: tokenData.user_id });
      return tokens;
    } catch (error) {
      logger.error("Token refresh failed", { error: (error as Error).message });
      throw error;
    }
  }

  // Revoke refresh token
  async revokeToken(refreshToken: string): Promise<void> {
    try {
      const result = await this.db.run(
        `
        UPDATE refresh_tokens 
        SET is_revoked = true, revoked_at = ?
        WHERE token = ?
      `,
        [new Date().toISOString(), refreshToken]
      );

      if (result.changes === 0) {
        throw new Error("Token not found");
      }

      // await this.eventBus.publish({
      //   id: "",
      //   type: EventType.TOKEN_REVOKED,
      //   timestamp: "",
      //   version: "1.0",
      //   source: "auth-service",
      //   correlationId: "",
      //   metadata: {
      //     action: "token_revoked",
      //     success: true,
      //   },
      // });

      logger.info("Token revoked successfully");
    } catch (error) {
      logger.error("Token revocation failed", { error: (error as Error).message });
      throw error;
    }
  }

  // Validate access token
  async validateAccessToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;

      const user = await this.db.get(
        `
        SELECT id, email, name, created_at, last_login
        FROM users WHERE id = ?
      `,
        [decoded.id || decoded.userId]
      );

      return user || null;
    } catch (error) {
      return null;
    }
  }

  // Generate access and refresh token pair
  private async generateTokenPair(userId: number): Promise<TokenPair> {
    // Generate access token (15 minutes)
    const accessToken = jwt.sign({ id: userId, userId, type: "access" }, config.JWT_SECRET, { expiresIn: "15m" });

    // Generate refresh token (7 days)
    const refreshTokenValue = jwt.sign({ userId, type: "refresh", random: Math.random() }, config.JWT_REFRESH_SECRET || config.JWT_SECRET, { expiresIn: "7d" });

    // Store refresh token in database
    await this.db.run(
      `
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at, is_revoked)
      VALUES (?, ?, ?, ?, ?, false)
    `,
      [`rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userId, refreshTokenValue, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), new Date().toISOString()]
    );

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: 900, // 15 minutes
      tokenType: "Bearer",
    };
  }

  // Publish authentication events
  private async publishAuthEvent(userId: number, action: string, ipAddress: string, userAgent: string, success: boolean, reason?: string): Promise<void> {
    await this.eventBus.publish({
      id: "",
      type: action === "login" ? EventType.USER_LOGIN : EventType.USER_LOGOUT,
      timestamp: "",
      version: "1.0",
      source: "auth-service",
      correlationId: "",
      userId,
      payload: {
        userId,
        action,
        ipAddress,
        userAgent,
        success,
        reason,
      },
      metadata: {},
    } as AuthEvent);
  }
}
