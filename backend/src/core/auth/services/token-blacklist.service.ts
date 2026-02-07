import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LruCacheService } from '../../cache/lru-cache.service';
import * as crypto from 'crypto';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly CACHE_PREFIX = 'token:blacklist:';
  private readonly USER_INVALIDATION_PREFIX = 'user:invalidation:';

  constructor(
    private prisma: PrismaService,
    private cache: LruCacheService,
  ) {}

  /**
   * Blacklist a specific token
   */
  async blacklistToken(token: string, expiresAt: Date): Promise<void> {
    try {
      const tokenHash = this.hashToken(token);
      const key = `${this.CACHE_PREFIX}${tokenHash}`;
      const ttl = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      // Store in cache for fast lookup
      if (ttl > 0) {
        await this.cache.set(key, true, { ttl });
      }

      // Store in database for persistence across restarts
      try {
        await this.prisma.tokenBlacklist.create({
          data: {
            tokenHash,
            expiresAt,
          },
        });
        this.logger.log(`Token blacklisted: ${tokenHash.substring(0, 10)}...`);
      } catch (error) {
        // If duplicate, ignore the error
        if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
          throw error;
        }
      }
    } catch (error) {
      this.logger.error('Failed to blacklist token', error);
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isBlacklisted(token: string): Promise<boolean> {
    try {
      const tokenHash = this.hashToken(token);
      const key = `${this.CACHE_PREFIX}${tokenHash}`;

      // Check cache first for performance
      const cached = await this.cache.get<boolean>(key);
      if (cached === true) {
        return true;
      }

      // Check database if not in cache
      const record = await this.prisma.tokenBlacklist.findFirst({
        where: {
          tokenHash,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (record) {
        // Populate cache with the finding
        const ttl = Math.max(0, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000));
        if (ttl > 0) {
          await this.cache.set(key, true, { ttl });
        }
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to check token blacklist', error);
      // On error, assume not blacklisted to avoid blocking legitimate users
      return false;
    }
  }

  /**
   * Invalidate all tokens for a specific user
   * This is useful when a user changes password or when admin forces logout
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    try {
      const invalidationTime = Date.now();
      const key = `${this.USER_INVALIDATION_PREFIX}${userId}`;

      // Store in cache with 7 days TTL (longer than max token lifetime)
      await this.cache.set(key, invalidationTime, {
        ttl: 7 * 24 * 60 * 60, // 7 days in seconds
      });

      // Mark all user sessions as invalidated in database
      await this.prisma.userSession.updateMany({
        where: {
          userId,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      this.logger.log(`All tokens invalidated for user: ${userId}`);
    } catch (error) {
      this.logger.error('Failed to invalidate user tokens', error);
      throw error;
    }
  }

  /**
   * Check if a token was invalidated for a specific user
   * This checks if the token was issued before the user-level invalidation
   */
  async isTokenInvalidatedForUser(
    userId: string,
    tokenIssuedAt: number,
  ): Promise<boolean> {
    try {
      const key = `${this.USER_INVALIDATION_PREFIX}${userId}`;
      const invalidationTime = await this.cache.get<number>(key);

      // If invalidation timestamp exists and token was issued before it, reject
      if (invalidationTime && tokenIssuedAt < invalidationTime / 1000) {
        return true;
      }

      // Fallback: Check if ALL user sessions were invalidated at the same time
      // This indicates a "logout all devices" or password change event
      // We only reject if ALL sessions were bulk-invalidated after token issuance
      const tokenIssuedDate = new Date(tokenIssuedAt * 1000);

      // Count active sessions and invalidated sessions after token issuance
      const [activeSessions, bulkInvalidatedSessions] = await Promise.all([
        this.prisma.userSession.count({
          where: {
            userId,
            invalidatedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
        this.prisma.userSession.count({
          where: {
            userId,
            invalidatedAt: {
              not: null,
              gt: tokenIssuedDate, // Session invalidated AFTER token was issued
            },
          },
        }),
      ]);

      // If there are no active sessions and there were bulk invalidations
      // after this token was issued, consider it invalidated
      if (activeSessions === 0 && bulkInvalidatedSessions > 0) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Failed to check user token invalidation', error);
      // On error, assume not invalidated to avoid blocking legitimate users
      return false;
    }
  }

  /**
   * Hash a token for secure storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Clean up expired tokens from database (scheduled task)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired blacklisted tokens`);
      return result.count;
    } catch (error) {
      this.logger.error('Failed to cleanup expired tokens', error);
      return 0;
    }
  }

  /**
   * Get statistics about blacklisted tokens
   */
  async getStatistics(): Promise<{
    totalBlacklisted: number;
    totalExpired: number;
    totalActive: number;
  }> {
    try {
      const now = new Date();

      const [total, expired] = await Promise.all([
        this.prisma.tokenBlacklist.count(),
        this.prisma.tokenBlacklist.count({
          where: {
            expiresAt: {
              lt: now,
            },
          },
        }),
      ]);

      return {
        totalBlacklisted: total,
        totalExpired: expired,
        totalActive: total - expired,
      };
    } catch (error) {
      this.logger.error('Failed to get blacklist statistics', error);
      return {
        totalBlacklisted: 0,
        totalExpired: 0,
        totalActive: 0,
      };
    }
  }
}
