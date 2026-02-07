import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { getClientIp, getUserId } from '../utils/request.utils';

/**
 * Global Exception Filter
 * - Catches all exceptions throughout the application
 * - Logs errors with context for debugging
 * - Returns sanitized error responses (hides internal details in production)
 * - Ready for integration with error tracking services (Sentry, etc.)
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get error message
    const message = this.getErrorMessage(exception);

    // Get error details
    const errorDetails = this.getErrorDetails(exception);

    // Get request ID for tracing
    const requestId = (request as any).requestId || 'unknown';

    // Prepare error context for logging
    const errorContext = {
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ip: getClientIp(request),
      user: getUserId(request),
      statusCode: status,
      message,
      stack: exception.stack,
      ...errorDetails,
    };

    // Log the error with appropriate level
    if (status >= 500) {
      this.logger.error(
        `[${requestId}] Internal Server Error: ${message}`,
        exception.stack,
        JSON.stringify(errorContext, null, 2),
      );
      // TODO: Send to error tracking service (Sentry)
      // this.sendToSentry(exception, errorContext);
    } else if (status >= 400) {
      this.logger.warn(
        `[${requestId}] Client Error: ${message}`,
        JSON.stringify(errorContext, null, 2),
      );
    } else {
      this.logger.log(`[${requestId}] Error: ${message}`, JSON.stringify(errorContext, null, 2));
    }

    // Prepare response object
    const errorResponse = this.getErrorResponse(
      status,
      message,
      errorDetails,
      request.url,
      requestId,
    );

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Extract error message from exception
   */
  private getErrorMessage(exception: any): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && 'message' in response) {
        const message = (response as any).message;
        return Array.isArray(message)
          ? message.map((m: any) => String(m)).join(', ')
          : String(message);
      }
    }

    return exception.message || 'An unexpected error occurred';
  }

  /**
   * Extract error details from exception
   */
  private getErrorDetails(exception: any): any {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object') {
        const { message, ...details } = response as any;
        return details;
      }
    }

    return {};
  }

  /**
   * Build error response object
   */
  private getErrorResponse(
    statusCode: number,
    message: string,
    details: any,
    path: string,
    requestId: string,
  ): any {
    const isProduction = process.env.NODE_ENV === 'production';

    const baseResponse = {
      success: false,
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      requestId, // Include requestId for client-side correlation
      message: isProduction ? this.sanitizeMessage(message, statusCode) : message,
    };

    // In production, hide internal error details
    if (isProduction && statusCode >= 500) {
      return {
        ...baseResponse,
        message: 'An internal server error occurred. Please try again later.',
      };
    }

    // In development, include error details
    if (!isProduction && Object.keys(details).length > 0) {
      return {
        ...baseResponse,
        ...details,
      };
    }

    return baseResponse;
  }

  /**
   * Sanitize error message for production
   */
  private sanitizeMessage(message: string, statusCode: number): string {
    // For server errors, return generic message
    if (statusCode >= 500) {
      return 'An internal server error occurred. Please try again later.';
    }

    // For client errors, return the message but sanitize sensitive info
    return message
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '***-**-****') // SSN
      .replace(/\b\d{16}\b/g, '****-****-****-****') // Credit card
      .replace(/password/gi, '***')
      .replace(/token/gi, '***')
      .replace(/secret/gi, '***');
  }

  /**
   * Send error to Sentry (placeholder for future implementation)
   */
  private sendToSentry(exception: any, context: any): void {
    // TODO: Implement Sentry integration
    // Sentry.captureException(exception, { extra: context });
  }
}
