import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * CSRF Guard
 * Optional guard for CSRF protection on state-changing operations
 * Use @UseCsrfProtection() decorator on controllers/routes that need protection
 *
 * Works by validating:
 * 1. Origin header matches allowed origins
 * 2. Custom X-CSRF-Token header is present (for XHR requests)
 *
 * Note: This guard is NOT globally enabled to maintain API compatibility.
 * Apply it selectively using the decorator.
 */
export const CSRF_PROTECTION_KEY = 'csrf_protection';

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if CSRF protection is explicitly enabled for this route
    const csrfRequired = this.reflector.getAllAndOverride<boolean>(
      CSRF_PROTECTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If CSRF protection is not enabled, allow the request
    if (!csrfRequired) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const method = request.method.toUpperCase();

    // Skip CSRF check for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    return this.validateCsrf(request);
  }

  private validateCsrf(request: any): boolean {
    const origin = request.headers['origin'];
    const referer = request.headers['referer'];
    const csrfToken = request.headers['x-csrf-token'];

    // Get allowed origins from environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [];

    // Check origin header
    if (origin) {
      if (!this.isOriginAllowed(origin, allowedOrigins)) {
        this.logger.warn(`CSRF validation failed: Invalid origin ${origin}`);
        throw new ForbiddenException('Invalid request origin');
      }
    }

    // Check referer header as fallback
    if (!origin && referer) {
      const refererOrigin = this.extractOrigin(referer);
      if (!this.isOriginAllowed(refererOrigin, allowedOrigins)) {
        this.logger.warn(`CSRF validation failed: Invalid referer ${referer}`);
        throw new ForbiddenException('Invalid request origin');
      }
    }

    // For XHR requests, also check for CSRF token
    const isXhr =
      request.headers['x-requested-with'] === 'XMLHttpRequest' ||
      request.headers['content-type']?.includes('application/json');

    if (isXhr && !csrfToken) {
      this.logger.warn('CSRF validation failed: Missing X-CSRF-Token header');
      throw new ForbiddenException('Missing CSRF token');
    }

    return true;
  }

  private isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production') {
      if (
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        return true;
      }
    }

    return allowedOrigins.some((allowed) => {
      // Exact match
      if (allowed === origin) return true;
      // Wildcard subdomain match (e.g., *.example.com)
      if (allowed.startsWith('*.')) {
        const domain = allowed.slice(2);
        return origin.endsWith(domain);
      }
      return false;
    });
  }

  private extractOrigin(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }
}

/**
 * Decorator to enable CSRF protection on a controller or route
 * @example
 * @Controller('sensitive')
 * @UseCsrfProtection()
 * export class SensitiveController {}
 *
 * @example
 * @Post('transfer')
 * @UseCsrfProtection()
 * async transfer() {}
 */
import { SetMetadata } from '@nestjs/common';
export const UseCsrfProtection = () => SetMetadata(CSRF_PROTECTION_KEY, true);
