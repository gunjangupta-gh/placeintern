import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Account Lockout Configuration
 * Configurable via environment variables
 */
const LOCKOUT_CONFIG = {
  // Maximum failed attempts before lockout
  maxAttempts: parseInt(process.env.LOCKOUT_MAX_ATTEMPTS || '5', 10),
  // Lockout duration in minutes
  lockoutDurationMinutes: parseInt(process.env.LOCKOUT_DURATION_MINUTES || '15', 10),
  // Reset attempts after this many minutes of no failed attempts
  resetAfterMinutes: parseInt(process.env.LOCKOUT_RESET_AFTER_MINUTES || '30', 10),
};

export interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  minutesRemaining: number | null;
}

/**
 * Account Lockout Service
 * Prevents brute force attacks by temporarily locking accounts after failed login attempts
 */
@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if an account is currently locked
   */
  async isAccountLocked(userId: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        failedLoginAttempts: true,
        lockedUntil: true,
        lastFailedLoginAt: true,
      },
    });

    if (!user) {
      return {
        isLocked: false,
        remainingAttempts: LOCKOUT_CONFIG.maxAttempts,
        lockedUntil: null,
        minutesRemaining: null,
      };
    }

    // Check if currently locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesRemaining = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60),
      );
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: user.lockedUntil,
        minutesRemaining,
      };
    }

    // Check if we should reset attempts (no failed attempts for resetAfterMinutes)
    if (user.lastFailedLoginAt) {
      const resetThreshold = new Date(
        Date.now() - LOCKOUT_CONFIG.resetAfterMinutes * 60 * 1000,
      );
      if (user.lastFailedLoginAt < resetThreshold) {
        // Reset attempts silently
        await this.resetFailedAttempts(userId);
        return {
          isLocked: false,
          remainingAttempts: LOCKOUT_CONFIG.maxAttempts,
          lockedUntil: null,
          minutesRemaining: null,
        };
      }
    }

    const remainingAttempts = Math.max(
      0,
      LOCKOUT_CONFIG.maxAttempts - user.failedLoginAttempts,
    );

    return {
      isLocked: false,
      remainingAttempts,
      lockedUntil: null,
      minutesRemaining: null,
    };
  }

  /**
   * Check lockout by email (for pre-login check)
   */
  async isAccountLockedByEmail(email: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // Don't reveal if user exists
      return {
        isLocked: false,
        remainingAttempts: LOCKOUT_CONFIG.maxAttempts,
        lockedUntil: null,
        minutesRemaining: null,
      };
    }

    return this.isAccountLocked(user.id);
  }

  /**
   * Record a failed login attempt
   * Returns updated lockout status
   */
  async recordFailedAttempt(userId: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        failedLoginAttempts: true,
        email: true,
      },
    });

    if (!user) {
      return {
        isLocked: false,
        remainingAttempts: 0,
        lockedUntil: null,
        minutesRemaining: null,
      };
    }

    const newAttemptCount = user.failedLoginAttempts + 1;
    const shouldLock = newAttemptCount >= LOCKOUT_CONFIG.maxAttempts;

    const lockedUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_CONFIG.lockoutDurationMinutes * 60 * 1000)
      : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newAttemptCount,
        lastFailedLoginAt: new Date(),
        lockedUntil,
      },
    });

    if (shouldLock) {
      this.logger.warn(
        `Account locked for user ${user.email} after ${newAttemptCount} failed attempts. Locked until ${lockedUntil}`,
      );
    }

    const remainingAttempts = Math.max(
      0,
      LOCKOUT_CONFIG.maxAttempts - newAttemptCount,
    );

    return {
      isLocked: shouldLock,
      remainingAttempts,
      lockedUntil,
      minutesRemaining: shouldLock ? LOCKOUT_CONFIG.lockoutDurationMinutes : null,
    };
  }

  /**
   * Record failed attempt by email (when user ID is not yet known)
   */
  async recordFailedAttemptByEmail(email: string): Promise<LockoutStatus> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      // Don't reveal if user exists, but still return a status
      return {
        isLocked: false,
        remainingAttempts: LOCKOUT_CONFIG.maxAttempts - 1,
        lockedUntil: null,
        minutesRemaining: null,
      };
    }

    return this.recordFailedAttempt(user.id);
  }

  /**
   * Reset failed attempts on successful login
   */
  async resetFailedAttempts(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      },
    });
  }

  /**
   * Admin unlock account
   */
  async unlockAccount(userId: string, adminId?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
      },
    });

    this.logger.log(
      `Account unlocked for user ${user?.email} by admin ${adminId || 'system'}`,
    );
  }

  /**
   * Get lockout configuration (for display purposes)
   */
  getConfig() {
    return {
      maxAttempts: LOCKOUT_CONFIG.maxAttempts,
      lockoutDurationMinutes: LOCKOUT_CONFIG.lockoutDurationMinutes,
      resetAfterMinutes: LOCKOUT_CONFIG.resetAfterMinutes,
    };
  }
}
