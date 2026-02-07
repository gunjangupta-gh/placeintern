import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';
import { getClientIp, getUserContext } from '../../core/common/utils/request.utils';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditMetadata {
  action: string;
  entityType: string;
}

/**
 * Decorator to enable audit logging for a route
 * @param action - The action being performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
 * @param entityType - The type of entity being affected (e.g., 'User', 'Post')
 */
export const AuditLog = (action: string, entityType: string) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(
      AUDIT_LOG_KEY,
      { action, entityType },
      descriptor.value,
    );
    return descriptor;
  };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const { action, entityType } = metadata;
    const userAgent = request.headers['user-agent'];
    const ipAddress = getClientIp(request);

    return next.handle().pipe(
      tap({
        next: async (data) => {
          try {
            const { userId, institutionId } = getUserContext(request);

            // Extract entity ID from response or request
            const entityId = data?.id || request.params?.id || 'unknown';

            await this.auditService.log({
              action,
              entityType,
              entityId,
              userId,
              description: `${request.method} ${request.url}`,
              newValues: {
                method: request.method,
                url: request.url,
                body: this.sanitizeBody(request.body),
                params: request.params,
                query: request.query,
              },
              ipAddress,
              userAgent,
              institutionId,
            });
          } catch (error) {
            this.logger.error('Failed to create audit log in interceptor', error.stack);
          }
        },
        error: async (error) => {
          try {
            const { userId, institutionId } = getUserContext(request);

            await this.auditService.log({
              action: `${action}_FAILED`,
              entityType,
              entityId: 'unknown',
              userId,
              description: `${request.method} ${request.url} (failed)`,
              newValues: {
                method: request.method,
                url: request.url,
                error: error?.message,
              },
              ipAddress,
              userAgent,
              institutionId,
            });
          } catch (auditError) {
            this.logger.error('Failed to create error audit log', auditError.stack);
          }
        },
      }),
    );
  }

  /**
   * Remove sensitive data from request body before logging
   */
  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    const sanitized = { ...body };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}
