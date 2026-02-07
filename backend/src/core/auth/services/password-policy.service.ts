import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';

/**
 * Password Policy Configuration
 * Configurable via environment variables
 */
const PASSWORD_POLICY = {
  // Number of previous passwords to check (prevent reuse)
  historyCount: parseInt(process.env.PASSWORD_HISTORY_COUNT || '5', 10),
  // Password expiry in days (0 = no expiry)
  expiryDays: parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10),
  // Minimum password length
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
  // Require complexity (uppercase, lowercase, number, special char)
  requireComplexity: process.env.PASSWORD_REQUIRE_COMPLEXITY !== 'false',
};

/**
 * Password Policy Service
 * Enforces password security policies including:
 * - Password history (prevent reuse)
 * - Password expiry
 * - Complexity requirements
 */
@Injectable()
export class PasswordPolicyService {
  private readonly logger = new Logger(PasswordPolicyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Check if password was previously used
   * @returns true if password is in history (should be rejected)
   */
  async isPasswordInHistory(userId: string, plainPassword: string): Promise<boolean> {
    // Get the last N passwords from history
    const history = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_POLICY.historyCount,
      select: { hash: true },
    });

    // Check against each historical password
    for (const entry of history) {
      const matches = await bcrypt.compare(plainPassword, entry.hash);
      if (matches) {
        return true; // Password was previously used
      }
    }

    return false;
  }

  /**
   * Add password to history after successful password change
   */
  async addToHistory(userId: string, passwordHash: string): Promise<void> {
    // Add new entry
    await this.prisma.passwordHistory.create({
      data: {
        userId,
        hash: passwordHash,
      },
    });

    // Clean up old entries beyond the history count
    const allHistory = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (allHistory.length > PASSWORD_POLICY.historyCount) {
      const idsToDelete = allHistory
        .slice(PASSWORD_POLICY.historyCount)
        .map((h) => h.id);

      await this.prisma.passwordHistory.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }
  }

  /**
   * Validate new password against policy
   * Throws BadRequestException if validation fails
   */
  async validateNewPassword(
    userId: string,
    newPassword: string,
    currentPasswordHash?: string,
  ): Promise<void> {
    // Check minimum length
    if (newPassword.length < PASSWORD_POLICY.minLength) {
      throw new BadRequestException(
        `Password must be at least ${PASSWORD_POLICY.minLength} characters long`,
      );
    }

    // Check complexity
    if (PASSWORD_POLICY.requireComplexity) {
      const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
      if (!complexityRegex.test(newPassword)) {
        throw new BadRequestException(
          'Password must contain uppercase, lowercase, number, and special character',
        );
      }
    }

    // Check if same as current password
    if (currentPasswordHash) {
      const isSame = await bcrypt.compare(newPassword, currentPasswordHash);
      if (isSame) {
        throw new BadRequestException(
          'New password must be different from current password',
        );
      }
    }

    // Check password history
    const inHistory = await this.isPasswordInHistory(userId, newPassword);
    if (inHistory) {
      throw new BadRequestException(
        `Cannot reuse any of your last ${PASSWORD_POLICY.historyCount} passwords`,
      );
    }
  }

  /**
   * Check if password has expired
   */
  async isPasswordExpired(userId: string): Promise<{
    expired: boolean;
    expiresAt: Date | null;
    daysRemaining: number | null;
  }> {
    if (PASSWORD_POLICY.expiryDays === 0) {
      return { expired: false, expiresAt: null, daysRemaining: null };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordExpiresAt: true, passwordChangedAt: true },
    });

    if (!user) {
      return { expired: false, expiresAt: null, daysRemaining: null };
    }

    // If no expiry date set, calculate from last password change
    let expiresAt = user.passwordExpiresAt;
    if (!expiresAt && user.passwordChangedAt) {
      expiresAt = new Date(user.passwordChangedAt);
      expiresAt.setDate(expiresAt.getDate() + PASSWORD_POLICY.expiryDays);
    }

    if (!expiresAt) {
      return { expired: false, expiresAt: null, daysRemaining: null };
    }

    const now = new Date();
    const expired = expiresAt < now;
    const daysRemaining = expired
      ? 0
      : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return { expired, expiresAt, daysRemaining };
  }

  /**
   * Set password expiry date
   */
  async setPasswordExpiry(userId: string): Promise<Date> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PASSWORD_POLICY.expiryDays);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordExpiresAt: expiresAt },
    });

    return expiresAt;
  }

  /**
   * Check password expiry on login
   * Throws ForbiddenException if expired
   */
  async checkExpiryOnLogin(userId: string): Promise<void> {
    const { expired, daysRemaining } = await this.isPasswordExpired(userId);

    if (expired) {
      throw new ForbiddenException({
        message: 'Your password has expired. Please change it to continue.',
        code: 'PASSWORD_EXPIRED',
        requirePasswordChange: true,
      });
    }

    // Warn if expiring soon (within 7 days)
    if (daysRemaining !== null && daysRemaining <= 7) {
      this.logger.warn(
        `User ${userId} password expires in ${daysRemaining} days`,
      );
    }
  }

  /**
   * Get policy configuration (for display)
   */
  getPolicy() {
    return {
      historyCount: PASSWORD_POLICY.historyCount,
      expiryDays: PASSWORD_POLICY.expiryDays,
      minLength: PASSWORD_POLICY.minLength,
      requireComplexity: PASSWORD_POLICY.requireComplexity,
    };
  }
}
