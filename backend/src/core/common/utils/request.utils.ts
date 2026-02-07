import { Request } from 'express';

/**
 * Request utilities for extracting common information
 */

/**
 * Get client IP address from request
 * Works with trust proxy enabled (recommended) or falls back to header parsing
 */
export function getClientIp(request: Request | any): string {
  // With 'trust proxy' enabled, request.ip already contains the correct client IP
  // from X-Forwarded-For. We only need manual parsing as fallback.
  if (request.ip && request.ip !== '::1' && request.ip !== '127.0.0.1') {
    return request.ip;
  }

  // Fallback: Manual header parsing (if trust proxy not configured)
  const forwarded = request.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers?.['x-real-ip'];
  if (realIp) {
    return realIp as string;
  }

  // Last resort
  return request.ip || request.socket?.remoteAddress || 'unknown';
}

/**
 * Get user ID from request (after JWT guard has populated request.user)
 * Handles both 'userId' (JWT payload) and 'id' (direct user object) fields
 */
export function getUserId(request: Request | any): string {
  const user = request.user;
  return user?.userId || user?.id || 'anonymous';
}

/**
 * Get user context from request for audit/logging purposes
 */
export function getUserContext(request: Request | any): {
  userId: string;
  role?: string;
  institutionId?: string;
} {
  const user = request.user;
  return {
    userId: user?.userId || user?.id || 'anonymous',
    role: user?.role,
    institutionId: user?.institutionId,
  };
}
