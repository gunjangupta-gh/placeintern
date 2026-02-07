import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Configuration constants for DoS protection
 */
const SECURITY_CONFIG = {
  /** Maximum recursion depth to prevent stack overflow attacks */
  MAX_RECURSION_DEPTH: 50,
  /** Maximum number of keys to process in a single object */
  MAX_OBJECT_KEYS: 10000,
  /** Maximum array length to process */
  MAX_ARRAY_LENGTH: 50000,
  /** Enable debug logging for security events */
  DEBUG_MODE: process.env.NODE_ENV !== 'production',
} as const;

/**
 * PII Masking rules for sensitive fields
 * Each function takes a value and returns a masked version
 */
const MASKING_RULES: Readonly<Record<string, (value: string) => string>> =
  Object.freeze({
    // Aadhaar: Show last 4 digits (XXXX-XXXX-1234)
    aadhaarNumber: (value: string) => {
      if (!value || value.length < 4) return '****';
      const last4 = value.replace(/\D/g, '').slice(-4);
      return `XXXX-XXXX-${last4}`;
    },

    // PAN: Show last 4 characters (XXXXXX1234)
    panNumber: (value: string) => {
      if (!value || value.length < 4) return '****';
      return `XXXXXX${value.slice(-4)}`;
    },

    // Phone: Show last 4 digits (******6789)
    phoneNo: (value: string) => {
      if (!value || value.length < 4) return '****';
      const digits = value.replace(/\D/g, '');
      return `******${digits.slice(-4)}`;
    },
    phone: (value: string) => MASKING_RULES.phoneNo(value),
    mobile: (value: string) => MASKING_RULES.phoneNo(value),
    mobileNumber: (value: string) => MASKING_RULES.phoneNo(value),
    contactNumber: (value: string) => MASKING_RULES.phoneNo(value),

    // Bank Account: Show last 4 digits
    bankAccountNumber: (value: string) => {
      if (!value || value.length < 4) return '****';
      return `XXXXXXXX${value.slice(-4)}`;
    },
    accountNumber: (value: string) => MASKING_RULES.bankAccountNumber(value),

    // IFSC: Show first 4 characters
    ifscCode: (value: string) => {
      if (!value || value.length < 4) return '****';
      return `${value.slice(0, 4)}XXXXXXX`;
    },

    // Email: Mask middle part (j***@example.com)
    email: (value: string) => {
      if (!value || !value.includes('@')) return '****';
      const [local, domain] = value.split('@');
      if (local.length <= 2) return `**@${domain}`;
      return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 10))}${local[local.length - 1]}@${domain}`;
    },

    // Date of Birth: Show only year
    dob: (value: string) => {
      if (!value) return '****';
      // Try to extract year from various formats
      const yearMatch = value.match(/\d{4}/);
      return yearMatch ? `**/**/XXXX` : '****';
    },
  });

/**
 * Fields that should always be masked in responses (PII)
 */
const ALWAYS_MASK_FIELDS: ReadonlySet<string> = new Set([
  'aadhaarNumber',
  'panNumber',
  'bankAccountNumber',
  'accountNumber',
  'ifscCode',
]);

/**
 * Fields to mask based on user role (lower roles see masked data)
 */
const ROLE_BASED_MASK_FIELDS: Readonly<Record<string, ReadonlySet<string>>> =
  Object.freeze({
    STUDENT: new Set(['phoneNo', 'phone', 'mobile', 'mobileNumber', 'email', 'dob', 'contactNumber']),
    TEACHER: new Set(['phoneNo', 'phone', 'mobile', 'mobileNumber']),
    FACULTY: new Set(['phoneNo', 'phone', 'mobile', 'mobileNumber']),
  });

/**
 * Fields that should be completely removed from responses (security-sensitive)
 * These are NEVER exposed to any client
 */
const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  'password',
  'passwordHash',
  'hashedPassword',
  'refreshToken',
  'resetToken',
  'resetPasswordToken',
  'verificationToken',
  'emailVerificationToken',
  'secret',
  'secretKey',
  'privateKey',
  'apiKey',
  'apiSecret',
  'accessToken',
  'authToken',
  'sessionToken',
  'csrfToken',
  'mfaSecret',
  'totpSecret',
  'encryptionKey',
  'salt',
  'passwordSalt',
  'iv',
  'creditCardNumber',
  'cvv',
  'cardCvv',
  'pin',
]);

/**
 * Dangerous object keys that could indicate prototype pollution attempts
 */
const DANGEROUS_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Roles that bypass PII masking entirely (still removes sensitive fields)
 */
const ADMIN_ROLES: ReadonlySet<string> = new Set([
  'SYSTEM_ADMIN',
  'STATE_DIRECTORATE',
  'SUPER_ADMIN',
]);

/**
 * Security Interceptor - Optimized single-pass response processing
 *
 * This interceptor handles:
 * 1. Adding security headers to responses
 * 2. Removing sensitive fields (passwords, tokens, keys)
 * 3. Masking PII fields (Aadhaar, PAN, phone, etc.) based on user role
 * 4. Protection against DoS via deeply nested objects
 * 5. Prototype pollution protection
 *
 * NOTE: Request body sanitization is handled by SanitizePipe to avoid duplication
 */
@Injectable()
export class SecurityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SecurityInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    // Add security headers
    this.addSecurityHeaders(response);

    // Get user role for masking decisions
    const userRole = request.user?.role;
    const requestId = request.requestId || 'unknown';

    // Determine if user is admin (bypasses PII masking but NOT sensitive field removal)
    const isAdmin = userRole && ADMIN_ROLES.has(userRole);

    // Process response
    return next.handle().pipe(
      map((data) => {
        if (data === null || data === undefined) {
          return data;
        }

        // Skip processing for non-objects (primitives, strings, numbers)
        if (typeof data !== 'object') {
          return data;
        }

        // Check if response is marked as unmasked (explicit bypass for authorized endpoints)
        if (data._unmasked === true) {
          // Remove the _unmasked flag but keep sensitive field removal active
          const { _unmasked, ...cleanData } = data;
          // Process with null role (admin mode) - skips PII masking but removes sensitive fields
          try {
            return this.processResponse(
              cleanData,
              null, // null role = skip PII masking
              new WeakSet(),
              0,
              { keysProcessed: 0 },
            );
          } catch (error) {
            this.logger.error(`[${requestId}] Error processing unmasked response: ${error.message}`);
            return cleanData;
          }
        }

        try {
          const processedData = this.processResponse(
            data,
            isAdmin ? null : userRole,
            new WeakSet(),
            0,
            { keysProcessed: 0 },
          );
          return processedData;
        } catch (error) {
          // Log error but return safe empty response rather than exposing data
          this.logger.error(
            `[${requestId}] Error processing response: ${error.message}`,
            error.stack,
          );
          // Return a safe fallback - either empty object/array or the original if simple
          if (Array.isArray(data)) {
            return [];
          }
          return {};
        }
      }),
      catchError((error) => {
        // Re-throw the error but ensure it doesn't contain sensitive data
        throw error;
      }),
    );
  }

  /**
   * Process response data in a single traversal:
   * - Remove sensitive fields (passwords, tokens)
   * - Mask PII fields based on user role
   * - Protect against DoS attacks
   *
   * @param data - Response data to process
   * @param userRole - User role for masking decisions (null = skip masking, only remove sensitive)
   * @param visited - WeakSet to handle circular references
   * @param depth - Current recursion depth
   * @param stats - Processing statistics for DoS protection
   */
  private processResponse(
    data: any,
    userRole: string | null | undefined,
    visited: WeakSet<object>,
    depth: number,
    stats: { keysProcessed: number },
  ): any {
    // DoS protection: Check recursion depth
    if (depth > SECURITY_CONFIG.MAX_RECURSION_DEPTH) {
      if (SECURITY_CONFIG.DEBUG_MODE) {
        this.logger.warn(
          `Max recursion depth (${SECURITY_CONFIG.MAX_RECURSION_DEPTH}) exceeded`,
        );
      }
      return '[DEPTH_LIMIT_EXCEEDED]';
    }

    // Handle null/undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle primitives
    if (typeof data !== 'object') {
      return data;
    }

    // Handle circular references
    if (visited.has(data)) {
      return '[CIRCULAR_REFERENCE]';
    }

    // Skip special built-in objects that shouldn't be traversed
    if (this.isSpecialObject(data)) {
      return data;
    }

    // Mark as visited for circular reference detection
    visited.add(data);

    // Handle arrays
    if (Array.isArray(data)) {
      // DoS protection: Limit array size
      const maxLength = Math.min(data.length, SECURITY_CONFIG.MAX_ARRAY_LENGTH);
      const result: any[] = new Array(maxLength);

      for (let i = 0; i < maxLength; i++) {
        result[i] = this.processResponse(
          data[i],
          userRole,
          visited,
          depth + 1,
          stats,
        );
      }

      if (data.length > maxLength) {
        if (SECURITY_CONFIG.DEBUG_MODE) {
          this.logger.warn(
            `Array truncated from ${data.length} to ${maxLength} items`,
          );
        }
      }

      return result;
    }

    // Handle Map objects
    if (data instanceof Map) {
      const result = new Map();
      const entries = Array.from(data.entries());
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        if (typeof key === 'string' && DANGEROUS_KEYS.has(key)) {
          continue; // Skip dangerous keys
        }
        if (typeof key === 'string' && SENSITIVE_FIELDS.has(key)) {
          continue; // Skip sensitive fields
        }
        result.set(
          key,
          this.processResponse(value, userRole, visited, depth + 1, stats),
        );
      }
      return result;
    }

    // Handle Set objects
    if (data instanceof Set) {
      const result = new Set();
      const values = Array.from(data.values());
      for (let i = 0; i < values.length; i++) {
        result.add(
          this.processResponse(values[i], userRole, visited, depth + 1, stats),
        );
      }
      return result;
    }

    // Handle plain objects
    return this.processObject(data, userRole, visited, depth, stats);
  }

  /**
   * Process a plain object
   */
  private processObject(
    data: Record<string, any>,
    userRole: string | null | undefined,
    visited: WeakSet<object>,
    depth: number,
    stats: { keysProcessed: number },
  ): Record<string, any> {
    const processed: Record<string, any> = {};
    const keys = Object.keys(data);
    const roleMaskFields = userRole ? ROLE_BASED_MASK_FIELDS[userRole] : null;

    // DoS protection: Limit number of keys
    const maxKeys = Math.min(keys.length, SECURITY_CONFIG.MAX_OBJECT_KEYS);

    for (let i = 0; i < maxKeys; i++) {
      const key = keys[i];
      stats.keysProcessed++;

      // Prototype pollution protection
      if (DANGEROUS_KEYS.has(key)) {
        continue;
      }

      // Skip sensitive fields entirely (passwords, tokens, etc.)
      if (SENSITIVE_FIELDS.has(key)) {
        continue;
      }

      const value = data[key];

      // Handle null/undefined values
      if (value === null || value === undefined) {
        processed[key] = value;
        continue;
      }

      // Check if field should be masked (only if userRole is set)
      const shouldMask =
        userRole !== null && this.shouldMaskField(key, roleMaskFields);

      if (shouldMask && typeof value === 'string') {
        // Apply masking
        processed[key] = this.applyMasking(key, value);
      } else if (typeof value === 'object') {
        // Recurse into nested objects
        processed[key] = this.processResponse(
          value,
          userRole,
          visited,
          depth + 1,
          stats,
        );
      } else {
        // Keep value as-is (numbers, booleans, etc.)
        processed[key] = value;
      }
    }

    if (keys.length > maxKeys) {
      if (SECURITY_CONFIG.DEBUG_MODE) {
        this.logger.warn(
          `Object keys truncated from ${keys.length} to ${maxKeys}`,
        );
      }
    }

    return processed;
  }

  /**
   * Check if an object is a special built-in that shouldn't be traversed
   */
  private isSpecialObject(obj: any): boolean {
    // Date objects
    if (obj instanceof Date) return true;

    // Regular expressions
    if (obj instanceof RegExp) return true;

    // Buffer objects
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) return true;

    // ArrayBuffer and typed arrays
    if (obj instanceof ArrayBuffer) return true;
    if (ArrayBuffer.isView(obj)) return true;

    // Error objects
    if (obj instanceof Error) return true;

    // Streams and response objects (check by duck typing)
    if (obj.pipe && typeof obj.pipe === 'function') return true;
    if (
      obj.headersSent !== undefined &&
      obj.send &&
      typeof obj.send === 'function'
    ) {
      return true;
    }

    // Promise objects
    if (obj instanceof Promise) return true;

    // Function objects (shouldn't be in response, but be safe)
    if (typeof obj === 'function') return true;

    return false;
  }

  /**
   * Determine if a field should be masked
   */
  private shouldMaskField(
    fieldName: string,
    roleMaskFields: ReadonlySet<string> | null,
  ): boolean {
    // Always mask these PII fields
    if (ALWAYS_MASK_FIELDS.has(fieldName)) {
      return true;
    }

    // Check case-insensitive matches for common variations
    const lowerKey = fieldName.toLowerCase();
    if (
      lowerKey.includes('aadhaar') ||
      lowerKey.includes('aadhar') ||
      lowerKey === 'pan'
    ) {
      return true;
    }

    // Role-based masking
    if (roleMaskFields && roleMaskFields.has(fieldName)) {
      return true;
    }

    return false;
  }

  /**
   * Apply masking to a field value
   */
  private applyMasking(fieldName: string, value: string): string {
    // Try exact match first
    const maskFn = MASKING_RULES[fieldName];
    if (maskFn) {
      return maskFn(value);
    }

    // Try case-insensitive matching for common fields
    const lowerField = fieldName.toLowerCase();
    if (lowerField.includes('phone') || lowerField.includes('mobile')) {
      return MASKING_RULES.phoneNo(value);
    }
    if (lowerField.includes('email')) {
      return MASKING_RULES.email(value);
    }
    if (lowerField.includes('aadhaar') || lowerField.includes('aadhar')) {
      return MASKING_RULES.aadhaarNumber(value);
    }
    if (lowerField === 'pan' || lowerField.includes('pannumber')) {
      return MASKING_RULES.panNumber(value);
    }

    // Default masking
    return this.defaultMask(value);
  }

  /**
   * Default masking for fields without specific rules
   */
  private defaultMask(value: string): string {
    if (!value) return '****';
    const len = value.length;
    if (len <= 4) return '****';
    if (len <= 8) return `${value.slice(0, 1)}${'*'.repeat(len - 2)}${value.slice(-1)}`;
    return `${value.slice(0, 2)}${'*'.repeat(Math.min(len - 4, 10))}${value.slice(-2)}`;
  }

  /**
   * Add security headers to response
   */
  private addSecurityHeaders(response: any): void {
    // Only set headers if response object supports it
    if (!response || typeof response.setHeader !== 'function') {
      return;
    }

    try {
      // Prevent MIME type sniffing
      response.setHeader('X-Content-Type-Options', 'nosniff');

      // Enable XSS protection (legacy, but still useful)
      response.setHeader('X-XSS-Protection', '1; mode=block');

      // Prevent clickjacking
      response.setHeader('X-Frame-Options', 'DENY');

      // Disable caching for API responses (sensitive data)
      response.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');

      // Strict Transport Security (HSTS) - only in production
      if (process.env.NODE_ENV === 'production') {
        response.setHeader(
          'Strict-Transport-Security',
          'max-age=31536000; includeSubDomains; preload',
        );
      }

      // Prevent information leakage
      response.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

      // Content Security Policy for API responses
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'",
      );
    } catch (error) {
      // Headers might already be sent, ignore errors
    }
  }
}

/**
 * Utility function to manually mask a single field (for use outside interceptor)
 */
export function maskField(fieldName: string, value: string): string {
  if (!value || typeof value !== 'string') return value;
  const maskFn = MASKING_RULES[fieldName];
  return maskFn ? maskFn(value) : value;
}

/**
 * Check if a field name is considered sensitive
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELDS.has(fieldName);
}

/**
 * Check if a field should be masked for a given role
 */
export function shouldMaskForRole(fieldName: string, role: string): boolean {
  if (ALWAYS_MASK_FIELDS.has(fieldName)) return true;
  const roleFields = ROLE_BASED_MASK_FIELDS[role];
  return roleFields ? roleFields.has(fieldName) : false;
}
