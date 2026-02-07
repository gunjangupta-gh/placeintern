import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../../generated/prisma/client';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private tokenBlacklistService: TokenBlacklistService,
    private auditService: AuditService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Extract token from request
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      // Audit: Unauthorized access attempt - no token provided
      this.logSecurityEvent(request, 'NO_TOKEN', 'No token provided').catch(() => {});
      throw new UnauthorizedException('No token provided');
    }

    // Validate token with passport strategy and check blacklist in parallel
    const [canActivate, isBlacklisted] = await Promise.all([
      super.canActivate(context) as Promise<boolean>,
      this.tokenBlacklistService.isBlacklisted(token),
    ]);

    if (!canActivate) {
      // Audit: Unauthorized access attempt - invalid token
      this.logSecurityEvent(request, 'INVALID_TOKEN', 'Invalid token').catch(() => {});
      throw new UnauthorizedException('Invalid token');
    }

    if (isBlacklisted) {
      // Audit: Unauthorized access attempt - revoked token
      this.logSecurityEvent(request, 'REVOKED_TOKEN', 'Token has been revoked', request.user?.sub).catch(() => {});
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check if user's tokens have been invalidated
    const user = request.user;
    if (user && user.iat) {
      const isInvalidated =
        await this.tokenBlacklistService.isTokenInvalidatedForUser(
          user.sub,
          user.iat,
        );

      if (isInvalidated) {
        // Audit: Unauthorized access attempt - invalidated session
        this.logSecurityEvent(request, 'INVALIDATED_SESSION', 'Session has been invalidated', user.sub).catch(() => {});
        throw new UnauthorizedException('Session has been invalidated');
      }
    }

    return true;
  }

  /**
   * Extract JWT token from Authorization header
   */
  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers?.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  /**
   * Handle request to add user to request object
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication failed');
    }
    return user;
  }

  /**
   * Log security events for unauthorized access attempts
   */
  private async logSecurityEvent(
    request: any,
    reason: string,
    description: string,
    userId?: string,
  ) {
    try {
      const ipAddress = this.getClientIp(request);
      const userAgent = request.headers?.['user-agent'];
      const url = request.url;
      const method = request.method;

      await this.auditService.log({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        entityType: 'SecurityEvent',
        userId: userId || null,
        description: `Unauthorized access attempt: ${description}`,
        category: AuditCategory.SECURITY,
        severity: AuditSeverity.HIGH,
        newValues: {
          reason,
          url,
          method,
          ipAddress,
          userAgent,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Silent fail - don't break request flow
    }
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(request: any): string | undefined {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress
    );
  }
}
