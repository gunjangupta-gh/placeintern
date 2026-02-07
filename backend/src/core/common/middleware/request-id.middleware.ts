import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request ID Middleware
 * Generates a unique request ID for each incoming request
 * Used for request tracing, logging, and debugging
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check if request already has an ID (from load balancer/proxy)
    const existingId =
      req.headers['x-request-id'] ||
      req.headers['x-correlation-id'] ||
      req.headers['x-trace-id'];

    // Use existing ID or generate a new one
    const requestId = (existingId as string) || randomUUID();

    // Attach to request for use in logging/handlers
    (req as any).requestId = requestId;

    // Set response header for client-side tracing
    res.setHeader('X-Request-Id', requestId);

    next();
  }
}

/**
 * Helper function to get request ID from request object
 */
export function getRequestId(request: any): string {
  return request?.requestId || 'unknown';
}
