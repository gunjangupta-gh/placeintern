import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

/**
 * MFA Configuration
 */
const MFA_CONFIG = {
  // TOTP settings
  totpDigits: 6,
  totpPeriod: 30, // seconds
  totpAlgorithm: 'sha1',
  // Backup codes
  backupCodeCount: 10,
  backupCodeLength: 8,
  // App name for authenticator apps
  appName: process.env.MFA_APP_NAME || 'CMS Portal',
};

/**
 * MFA Service
 * Provides optional Two-Factor Authentication support
 * Users can enable/disable MFA on their accounts
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Generate a new MFA secret for a user
   * Returns the secret and QR code URL for authenticator apps
   */
  async generateMfaSecret(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled. Disable it first to regenerate.');
    }

    // Generate a random secret (20 bytes = 160 bits, base32 encoded)
    const secretBuffer = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBuffer);

    // Store the secret (not yet enabled)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    // Generate otpauth URL for QR code
    const otpauthUrl = this.generateOtpauthUrl(user.email || userId, secret);

    this.logger.log(`MFA secret generated for user ${userId}`);

    return {
      secret,
      qrCodeUrl: otpauthUrl,
      manualEntryKey: this.formatSecretForDisplay(secret),
    };
  }

  /**
   * Enable MFA after verifying the TOTP code
   * Also generates backup codes
   */
  async enableMfa(
    userId: string,
    totpCode: string,
  ): Promise<{ success: boolean; backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabled: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    if (!user.mfaSecret) {
      throw new BadRequestException('Generate MFA secret first');
    }

    // Verify the TOTP code
    if (!this.verifyTotp(user.mfaSecret, totpCode)) {
      throw new BadRequestException('Invalid verification code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex'),
    );

    // Enable MFA and store backup codes
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: hashedBackupCodes,
      },
    });

    this.logger.log(`MFA enabled for user ${user.email}`);

    return {
      success: true,
      backupCodes, // Return plain backup codes (only shown once)
    };
  }

  /**
   * Disable MFA for a user (requires current password or backup code)
   */
  async disableMfa(userId: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: [],
      },
    });

    this.logger.log(`MFA disabled for user ${user.email}`);

    return { success: true };
  }

  /**
   * Verify MFA code (TOTP or backup code)
   * Uses transaction for backup code to prevent race conditions
   */
  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaSecret: true, mfaBackupCodes: true, mfaEnabled: true },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    // Try TOTP first
    if (this.verifyTotp(user.mfaSecret, code)) {
      return true;
    }

    // Try backup code with atomic transaction to prevent race conditions
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Use transaction to atomically check and remove backup code
    const result = await this.prisma.$transaction(async (tx) => {
      // Re-fetch user within transaction for consistency
      const currentUser = await tx.user.findUnique({
        where: { id: userId },
        select: { mfaBackupCodes: true },
      });

      if (!currentUser) return false;

      const backupCodeIndex = currentUser.mfaBackupCodes.indexOf(hashedCode);
      if (backupCodeIndex === -1) return false;

      // Remove used backup code atomically
      const updatedCodes = [...currentUser.mfaBackupCodes];
      updatedCodes.splice(backupCodeIndex, 1);

      await tx.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: updatedCodes },
      });

      return { success: true, remainingCodes: updatedCodes.length };
    });

    if (result && result.success) {
      this.logger.warn(`Backup code used for user ${userId}. ${result.remainingCodes} codes remaining.`);
      return true;
    }

    return false;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    return user?.mfaEnabled ?? false;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true },
    });

    if (!user?.mfaEnabled) {
      throw new BadRequestException('MFA must be enabled to regenerate backup codes');
    }

    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex'),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaBackupCodes: hashedBackupCodes },
    });

    this.logger.log(`Backup codes regenerated for user ${userId}`);

    return backupCodes;
  }

  /**
   * Get MFA status for user
   */
  async getMfaStatus(userId: string): Promise<{
    enabled: boolean;
    backupCodesRemaining: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaBackupCodes: true },
    });

    return {
      enabled: user?.mfaEnabled ?? false,
      backupCodesRemaining: user?.mfaBackupCodes?.length ?? 0,
    };
  }

  // ===== Private Helper Methods =====

  /**
   * Verify TOTP code
   * Implements RFC 6238 TOTP algorithm
   * Uses constant-time comparison to prevent timing attacks
   */
  private verifyTotp(secret: string, code: string, window = 1): boolean {
    const now = Math.floor(Date.now() / 1000);
    const counter = Math.floor(now / MFA_CONFIG.totpPeriod);

    // Normalize code to 6 digits
    const normalizedCode = code.padStart(MFA_CONFIG.totpDigits, '0');

    // Check current and adjacent time windows
    for (let i = -window; i <= window; i++) {
      const expectedCode = this.generateTotp(secret, counter + i);
      // Use constant-time comparison to prevent timing attacks
      if (this.timingSafeCompare(expectedCode, normalizedCode)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      // Still do comparison to maintain constant time
      const dummy = Buffer.from(a);
      crypto.timingSafeEqual(dummy, dummy);
      return false;
    }
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return crypto.timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Generate TOTP code for a given counter
   */
  private generateTotp(secret: string, counter: number): string {
    const secretBuffer = this.base32Decode(secret);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter));

    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const hmacResult = hmac.digest();

    // Dynamic truncation
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const otp = binary % Math.pow(10, MFA_CONFIG.totpDigits);
    return otp.toString().padStart(MFA_CONFIG.totpDigits, '0');
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < MFA_CONFIG.backupCodeCount; i++) {
      const code = crypto
        .randomBytes(MFA_CONFIG.backupCodeLength / 2)
        .toString('hex')
        .toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  /**
   * Generate otpauth URL for QR code
   */
  private generateOtpauthUrl(email: string, secret: string): string {
    const issuer = encodeURIComponent(MFA_CONFIG.appName);
    const account = encodeURIComponent(email);
    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=${MFA_CONFIG.totpAlgorithm.toUpperCase()}&digits=${MFA_CONFIG.totpDigits}&period=${MFA_CONFIG.totpPeriod}`;
  }

  /**
   * Format secret for manual entry (groups of 4 characters)
   */
  private formatSecretForDisplay(secret: string): string {
    return secret.match(/.{1,4}/g)?.join(' ') || secret;
  }

  /**
   * Base32 encode
   */
  private base32Encode(buffer: Buffer): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  /**
   * Base32 decode
   */
  private base32Decode(input: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleanedInput = input.replace(/[\s=]/g, '').toUpperCase();

    let bits = 0;
    let value = 0;
    const output: number[] = [];

    for (const char of cleanedInput) {
      const index = alphabet.indexOf(char);
      if (index === -1) continue;

      value = (value << 5) | index;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }
}
