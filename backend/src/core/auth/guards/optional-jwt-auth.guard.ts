import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenBlacklistService } from '../services/token-blacklist.service';

/**
 * Optional JWT Auth Guard
 * - If a valid token is provided, user info is attached to request
 * - If no token or invalid token, request continues without user (req.user = null)
 * - Does NOT throw UnauthorizedException
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private tokenBlacklistService: TokenBlacklistService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    // No token = allow without user
    if (!token) {
      request.user = null;
      return true;
    }

    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        request.user = null;
        return true;
      }

      // Try to validate the token
      const canActivate = await super.canActivate(context);
      if (!canActivate) {
        request.user = null;
        return true;
      }

      // Check if user's tokens have been invalidated
      const user = request.user;
      if (user && user.iat) {
        const isInvalidated = await this.tokenBlacklistService.isTokenInvalidatedForUser(
          user.sub,
          user.iat,
        );
        if (isInvalidated) {
          request.user = null;
          return true;
        }
      }

      return true;
    } catch (error) {
      // Any error = continue without user
      request.user = null;
      return true;
    }
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
   * Handle request - don't throw on missing/invalid user
   */
  handleRequest(err: any, user: any) {
    // Return user if valid, null otherwise (don't throw)
    return user || null;
  }
}
