import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional message when limit is exceeded */
  message?: string;
}

/**
 * Rate limit entry for tracking
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * BotThrottleGuard - Rate limiting for bot queries
 *
 * Strategy 6: Rate Limiting & Quotas
 * - Per-user rate limiting (30 requests/minute by default)
 * - Prevents abuse and runaway costs
 * - Returns 429 Too Many Requests when exceeded
 * - In-memory tracking (can be replaced with Redis for distributed systems)
 */
@Injectable()
export class BotThrottleGuard implements CanActivate {
  private readonly logger = new Logger(BotThrottleGuard.name);

  // In-memory rate limit tracking
  private readonly rateLimits: Map<string, RateLimitEntry> = new Map();

  // Default configuration
  private readonly config: RateLimitConfig = {
    maxRequests: 30, // 30 requests
    windowMs: 60 * 1000, // per minute
    message: 'Too many queries. Please wait before trying again.',
  };

  // Cleanup interval (every 5 minutes)
  private cleanupInterval: NodeJS.Timeout;

  constructor(private reflector?: Reflector) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Get user identifier (userId or IP address)
    const userId = this.getUserId(request);

    if (!userId) {
      // No user identifier, allow request (will be caught by auth guards)
      return true;
    }

    // Check and update rate limit
    const isAllowed = this.checkRateLimit(userId);

    if (!isAllowed) {
      const entry = this.rateLimits.get(userId);
      const retryAfter = entry ? Math.ceil((entry.resetAt - Date.now()) / 1000) : 60;

      this.logger.warn(`Rate limit exceeded for user: ${userId}`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: this.config.message,
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers to response
    const response = context.switchToHttp().getResponse();
    const entry = this.rateLimits.get(userId);

    if (entry) {
      response.setHeader('X-RateLimit-Limit', this.config.maxRequests);
      response.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - entry.count));
      response.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    }

    return true;
  }

  /**
   * Check if request is within rate limit
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    let entry = this.rateLimits.get(userId);

    // If no entry or window expired, create new entry
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 1,
        resetAt: now + this.config.windowMs,
      };
      this.rateLimits.set(userId, entry);
      return true;
    }

    // Increment count
    entry.count++;

    // Check if over limit
    if (entry.count > this.config.maxRequests) {
      return false;
    }

    return true;
  }

  /**
   * Get user identifier from request
   */
  private getUserId(request: any): string | null {
    // Try to get user from JWT payload
    if (request.user?.userId) {
      return `user:${request.user.userId}`;
    }

    // Fallback to IP address
    const ip =
      request.ip ||
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.connection?.remoteAddress;

    if (ip) {
      return `ip:${ip}`;
    }

    return null;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, entry] of this.rateLimits.entries()) {
      if (entry.resetAt <= now) {
        this.rateLimits.delete(userId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired rate limit entries`);
    }
  }

  /**
   * Get current rate limit status for a user
   */
  getRateLimitStatus(userId: string): {
    remaining: number;
    limit: number;
    resetAt: number | null;
  } {
    const key = `user:${userId}`;
    const entry = this.rateLimits.get(key);

    if (!entry || entry.resetAt <= Date.now()) {
      return {
        remaining: this.config.maxRequests,
        limit: this.config.maxRequests,
        resetAt: null,
      };
    }

    return {
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      limit: this.config.maxRequests,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Manually reset rate limit for a user (admin function)
   */
  resetRateLimit(userId: string): void {
    const key = `user:${userId}`;
    this.rateLimits.delete(key);
    this.logger.log(`Rate limit reset for user: ${userId}`);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    Object.assign(this.config, config);
    this.logger.log(`Rate limit config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * Get all rate limit entries (for monitoring)
   */
  getAllEntries(): { userId: string; count: number; resetAt: number }[] {
    const entries: { userId: string; count: number; resetAt: number }[] = [];

    for (const [userId, entry] of this.rateLimits.entries()) {
      entries.push({
        userId,
        count: entry.count,
        resetAt: entry.resetAt,
      });
    }

    return entries;
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}
