import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
import {
  THROTTLE_ENABLED,
  shouldSkipThrottle,
  formatThrottleErrorMessage,
} from '../../config/throttle.config';

/**
 * Custom Throttle Guard for rate limiting
 * Tracks requests by IP address or user ID for authenticated requests
 * Uses centralized configuration for skip patterns and error messages
 */
@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  /**
   * Skip throttling for OPTIONS requests (CORS preflight) and configured skip patterns
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if throttling is globally disabled
    if (!THROTTLE_ENABLED) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Skip OPTIONS requests (CORS preflight)
    if (request.method === 'OPTIONS') {
      return true;
    }

    // Skip configured patterns
    const path = request.url || request.path || '';
    if (shouldSkipThrottle(path)) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Get the tracker key for rate limiting
   * Uses user ID for authenticated requests, falls back to IP address
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // If user is authenticated, use user ID for more accurate rate limiting
    if (req.user && req.user.userId) {
      return `user-${req.user.userId}`;
    }

    // Fall back to IP address for unauthenticated requests
    // Handle various proxy scenarios
    const ip =
      req.ip ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      'unknown';

    return `ip-${ip}`;
  }

  /**
   * Override to provide configurable error message
   */
  protected async getErrorMessage(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    const retryAfterSeconds = Math.ceil(throttlerLimitDetail.ttl / 1000);
    return formatThrottleErrorMessage(retryAfterSeconds);
  }
}
