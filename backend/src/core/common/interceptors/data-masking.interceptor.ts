/**
 * @deprecated This interceptor has been merged into SecurityInterceptor for performance optimization.
 * The SecurityInterceptor now handles both sensitive field removal AND PII masking in a single traversal.
 *
 * Use SecurityInterceptor instead (already registered globally in app.module.ts).
 *
 * This file is kept for backward compatibility and exports utility functions for manual masking.
 */

/**
 * PII Masking rules for sensitive fields
 */
const MASKING_RULES: Record<string, (value: string) => string> = {
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
    return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
  },
};

/**
 * Utility function for manual masking of sensitive fields
 *
 * @example
 * ```typescript
 * import { maskSensitiveField } from './data-masking.interceptor';
 *
 * const maskedPhone = maskSensitiveField('phoneNo', '9876543210');
 * // Returns: "******3210"
 *
 * const maskedAadhaar = maskSensitiveField('aadhaarNumber', '123456789012');
 * // Returns: "XXXX-XXXX-9012"
 * ```
 */
export function maskSensitiveField(fieldName: string, value: string): string {
  if (!value) return value;
  const maskFn = MASKING_RULES[fieldName];
  return maskFn ? maskFn(value) : value;
}

/**
 * Mask multiple fields in an object
 *
 * @example
 * ```typescript
 * const masked = maskFields({ phoneNo: '9876543210', email: 'test@example.com' }, ['phoneNo', 'email']);
 * ```
 */
export function maskFields<T extends Record<string, any>>(
  data: T,
  fieldNames: string[],
): T {
  const result = { ...data };
  for (const field of fieldNames) {
    if (result[field] && typeof result[field] === 'string') {
      (result as any)[field] = maskSensitiveField(field, result[field]);
    }
  }
  return result;
}

/**
 * Get list of available masking field names
 */
export function getAvailableMaskingFields(): string[] {
  return Object.keys(MASKING_RULES);
}
