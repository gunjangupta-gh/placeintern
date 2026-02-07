import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { getClientIp, getUserId } from '../utils/request.utils';

/**
 * Logging Interceptor
 * - Logs all HTTP requests and responses
 * - Tracks request duration
 * - Includes request ID for tracing
 * - Logs user information for authenticated requests
 * - Logs errors with context
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || 'unknown';
    const clientIp = getClientIp(request);
    const requestId = (request as any).requestId || 'unknown';
    const startTime = Date.now();

    // Log incoming request (user not available yet - JWT guard hasn't run)
    this.logger.log(`[${requestId}] Incoming: ${method} ${url} - IP: ${clientIp}`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        const userId = getUserId(request); // Read after guards have run

        this.logger.log(
          `[${requestId}] ${method} ${url} ${statusCode} ${duration}ms - IP: ${clientIp} - User: ${userId}`,
        );

        if (duration > 1000) {
          this.logger.warn(`[${requestId}] Slow Request: ${method} ${url} took ${duration}ms`);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        const userId = getUserId(request);

        this.logger.error(
          `[${requestId}] ${method} ${url} ${statusCode} ${duration}ms - IP: ${clientIp} - User: ${userId} - Error: ${error.message}`,
          error.stack,
        );

        throw error;
      }),
    );
  }
}
