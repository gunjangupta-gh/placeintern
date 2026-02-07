import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  CipherGCM,
  DecipherGCM,
} from 'crypto';

/**
 * Encryption Configuration
 */
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm' as const,
  keyLength: 32, // 256 bits
  ivLength: 16, // 128 bits for AES
  authTagLength: 16, // 128 bits
  saltLength: 16,
};

/**
 * Field-Level Encryption Service
 * Provides AES-256-GCM encryption for sensitive PII fields
 *
 * Usage:
 * - Encrypt Aadhaar, PAN, phone numbers before storage
 * - Decrypt when reading for authorized users
 *
 * Format: base64(iv:authTag:ciphertext)
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private encryptionKey: Buffer;
  private isEnabled: boolean = false;

  onModuleInit() {
    const keyEnv = process.env.ENCRYPTION_KEY;

    if (!keyEnv) {
      this.logger.warn(
        'ENCRYPTION_KEY not set. Field-level encryption is DISABLED. ' +
          'Generate with: openssl rand -hex 32',
      );
      this.isEnabled = false;
      return;
    }

    try {
      // Key should be 64 hex chars (32 bytes)
      if (keyEnv.length !== 64) {
        throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
      }

      this.encryptionKey = Buffer.from(keyEnv, 'hex');
      this.isEnabled = true;
      this.logger.log('Field-level encryption initialized');
    } catch (error) {
      this.logger.error(`Encryption initialization failed: ${error.message}`);
      this.isEnabled = false;
    }
  }

  /**
   * Check if encryption is enabled
   */
  isEncryptionEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Encrypt a plaintext value
   * @param plaintext - The value to encrypt
   * @returns Base64-encoded encrypted string (iv:authTag:ciphertext)
   */
  encrypt(plaintext: string): string {
    if (!this.isEnabled) {
      this.logger.warn('Encryption called but not enabled - returning plaintext');
      return plaintext;
    }

    if (!plaintext) {
      return plaintext;
    }

    try {
      // Generate random IV
      const iv = randomBytes(ENCRYPTION_CONFIG.ivLength);

      // Create cipher (cast to CipherGCM for getAuthTag method)
      const cipher = createCipheriv(
        ENCRYPTION_CONFIG.algorithm,
        this.encryptionKey,
        iv,
      ) as CipherGCM;

      // Encrypt
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Combine: iv:authTag:ciphertext
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      return combined.toString('base64');
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt an encrypted value
   * @param ciphertext - Base64-encoded encrypted string
   * @returns Decrypted plaintext
   */
  decrypt(ciphertext: string): string {
    if (!this.isEnabled) {
      return ciphertext;
    }

    if (!ciphertext) {
      return ciphertext;
    }

    try {
      // Decode base64
      const combined = Buffer.from(ciphertext, 'base64');

      // Extract components
      const iv = combined.subarray(0, ENCRYPTION_CONFIG.ivLength);
      const authTag = combined.subarray(
        ENCRYPTION_CONFIG.ivLength,
        ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength,
      );
      const encrypted = combined.subarray(
        ENCRYPTION_CONFIG.ivLength + ENCRYPTION_CONFIG.authTagLength,
      );

      // Create decipher (cast to DecipherGCM for setAuthTag method)
      const decipher = createDecipheriv(
        ENCRYPTION_CONFIG.algorithm,
        this.encryptionKey,
        iv,
      ) as DecipherGCM;

      decipher.setAuthTag(authTag);

      // Decrypt
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Check if a value appears to be encrypted
   * (Base64 encoded and of expected length)
   */
  isEncrypted(value: string): boolean {
    if (!value || value.length < 50) {
      return false;
    }

    try {
      const decoded = Buffer.from(value, 'base64');
      // Minimum size: iv(16) + authTag(16) + at least 1 byte of data
      return decoded.length >= 33;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt or return as-is if already encrypted
   */
  encryptIfNeeded(value: string): string {
    if (!value || this.isEncrypted(value)) {
      return value;
    }
    return this.encrypt(value);
  }

  /**
   * Decrypt or return as-is if not encrypted
   */
  decryptIfNeeded(value: string): string {
    if (!value || !this.isEncrypted(value)) {
      return value;
    }
    return this.decrypt(value);
  }

  /**
   * Encrypt multiple fields in an object
   * @param data - Object with fields to encrypt
   * @param fields - Array of field names to encrypt
   */
  encryptFields<T extends Record<string, any>>(data: T, fields: string[]): T {
    if (!this.isEnabled) {
      return data;
    }

    const result = { ...data } as Record<string, any>;
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encryptIfNeeded(result[field]);
      }
    }
    return result as T;
  }

  /**
   * Decrypt multiple fields in an object
   * @param data - Object with encrypted fields
   * @param fields - Array of field names to decrypt
   */
  decryptFields<T extends Record<string, any>>(data: T, fields: string[]): T {
    if (!this.isEnabled) {
      return data;
    }

    const result = { ...data } as Record<string, any>;
    for (const field of fields) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.decryptIfNeeded(result[field]);
      }
    }
    return result as T;
  }

  /**
   * Hash a value for searching (deterministic)
   * Use when you need to search on encrypted field
   */
  hash(value: string): string {
    if (!value) return value;

    const hash = scryptSync(value, this.encryptionKey, 32);
    return hash.toString('hex');
  }
}

/**
 * List of PII fields that should be encrypted
 */
export const PII_FIELDS = [
  'aadhaarNumber',
  'panNumber',
  'bankAccountNumber',
  'ifscCode',
];
