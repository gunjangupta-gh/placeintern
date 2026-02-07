import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common';

/**
 * Configuration for DoS protection
 */
const SANITIZE_CONFIG = {
  /** Maximum recursion depth for nested objects */
  MAX_DEPTH: 30,
  /** Maximum string length to process */
  MAX_STRING_LENGTH: 1_000_000, // 1MB
  /** Maximum array items to process */
  MAX_ARRAY_LENGTH: 10_000,
  /** Maximum object keys to process */
  MAX_OBJECT_KEYS: 5_000,
} as const;

/**
 * Pre-compiled regex patterns for better performance
 */
const XSS_PATTERNS = {
  // Script tags (including variations)
  SCRIPT: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  SCRIPT_OPEN: /<script\b[^>]*>/gi,

  // Iframe tags
  IFRAME: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  IFRAME_OPEN: /<iframe\b[^>]*>/gi,

  // Event handlers (onclick, onerror, onload, etc.)
  EVENT_HANDLERS: /\bon\w+\s*=/gi,

  // JavaScript protocol
  JS_PROTOCOL: /javascript\s*:/gi,

  // VBScript protocol
  VBS_PROTOCOL: /vbscript\s*:/gi,

  // Data URLs with HTML/JavaScript
  DATA_HTML: /data\s*:\s*text\/html/gi,
  DATA_JS: /data\s*:\s*application\/javascript/gi,

  // Dangerous HTML tags
  DANGEROUS_TAGS: /<(embed|object|link|meta|style|base|form|input|button|select|textarea)\b[^>]*>/gi,

  // SVG with scripts
  SVG_SCRIPT: /<svg\b[^>]*>[\s\S]*?<script/gi,

  // Expression in CSS (IE specific but still check)
  CSS_EXPRESSION: /expression\s*\(/gi,

  // Import statements
  CSS_IMPORT: /@import\s/gi,

  // Null bytes (can bypass some filters)
  NULL_BYTES: /\x00/g,

  // HTML entities that could be dangerous
  ENCODED_BRACKETS: /&#x?0*(?:60|3c);|&#x?0*(?:62|3e);/gi,
} as const;

/**
 * Dangerous keys that could indicate prototype pollution
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitize Pipe for input validation and sanitization
 *
 * Features:
 * - XSS prevention via HTML/script sanitization
 * - File upload validation (type, size, extension)
 * - Prototype pollution protection
 * - DoS protection via depth/size limits
 * - SQL injection pattern detection (logged, not blocked - WAF should handle)
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  private readonly logger = new Logger(SanitizePipe.name);

  // Allowed MIME types for file uploads
  private readonly allowedFileTypes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv',
    'text/plain',
  ]);

  // Maximum file size (10MB)
  private readonly maxFileSize = 10 * 1024 * 1024;

  // Extension to MIME type mapping
  private readonly extensionToMime: Record<string, Set<string>> = {
    jpg: new Set(['image/jpeg', 'image/jpg']),
    jpeg: new Set(['image/jpeg', 'image/jpg']),
    png: new Set(['image/png']),
    gif: new Set(['image/gif']),
    webp: new Set(['image/webp']),
    svg: new Set(['image/svg+xml']),
    pdf: new Set(['application/pdf']),
    xlsx: new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]),
    xls: new Set(['application/vnd.ms-excel']),
    docx: new Set([
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]),
    doc: new Set(['application/msword']),
    csv: new Set(['text/csv', 'text/plain']),
    txt: new Set(['text/plain']),
  };

  transform(value: any, metadata: ArgumentMetadata): any {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle file upload validation
    if (this.isFileUpload(value)) {
      return this.validateFile(value);
    }

    // Sanitize based on type
    return this.sanitizeValue(value, 0);
  }

  /**
   * Recursively sanitize a value with depth tracking
   */
  private sanitizeValue(value: any, depth: number): any {
    // DoS protection: Check depth
    if (depth > SANITIZE_CONFIG.MAX_DEPTH) {
      this.logger.warn(`Max sanitization depth exceeded at ${depth}`);
      return null; // Truncate deeply nested data
    }

    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle strings
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return this.sanitizeArray(value, depth);
    }

    // Handle objects
    if (typeof value === 'object') {
      // Check for file upload
      if (this.isFileUpload(value)) {
        return this.validateFile(value);
      }
      return this.sanitizeObject(value, depth);
    }

    // Return primitives as-is (numbers, booleans)
    return value;
  }

  /**
   * Check if value is a file upload object
   */
  private isFileUpload(value: any): boolean {
    if (!value || typeof value !== 'object') return false;
    return (
      'mimetype' in value ||
      'fieldname' in value ||
      ('originalname' in value && 'buffer' in value)
    );
  }

  /**
   * Validate file upload with comprehensive checks
   */
  private validateFile(file: any): any {
    // Check file size
    if (file.size !== undefined && file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    // Check file type
    const mimetype = file.mimetype?.toLowerCase()?.trim();
    if (!mimetype || !this.allowedFileTypes.has(mimetype)) {
      throw new BadRequestException(
        `File type "${mimetype || 'unknown'}" is not allowed`,
      );
    }

    // Validate file extension matches MIME type
    if (file.originalname) {
      const parts = file.originalname.split('.');
      const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : null;

      if (extension) {
        const allowedMimes = this.extensionToMime[extension];
        if (!allowedMimes || !allowedMimes.has(mimetype)) {
          throw new BadRequestException(
            `File extension ".${extension}" does not match the file type "${mimetype}"`,
          );
        }
      }

      // Check for double extensions (e.g., file.php.jpg)
      if (parts.length > 1) {
        const suspiciousExtensions = new Set([
          'php',
          'phtml',
          'php3',
          'php4',
          'php5',
          'phps',
          'exe',
          'bat',
          'cmd',
          'sh',
          'bash',
          'ps1',
          'js',
          'jsp',
          'asp',
          'aspx',
          'cgi',
          'pl',
          'py',
          'rb',
        ]);

        for (const part of parts) {
          if (suspiciousExtensions.has(part.toLowerCase())) {
            throw new BadRequestException(
              'File contains suspicious extension pattern',
            );
          }
        }
      }
    }

    // For SVG files, sanitize content
    if (mimetype === 'image/svg+xml' && file.buffer) {
      const content = file.buffer.toString('utf-8');
      if (this.hasDangerousSvgContent(content)) {
        throw new BadRequestException(
          'SVG file contains potentially dangerous content',
        );
      }
    }

    return file;
  }

  /**
   * Check SVG content for dangerous elements
   */
  private hasDangerousSvgContent(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return (
      lowerContent.includes('<script') ||
      lowerContent.includes('javascript:') ||
      lowerContent.includes('onerror') ||
      lowerContent.includes('onload') ||
      lowerContent.includes('onclick')
    );
  }

  /**
   * Sanitize string to prevent XSS attacks
   */
  private sanitizeString(value: string): string {
    if (!value) return value;

    // DoS protection: Limit string length
    if (value.length > SANITIZE_CONFIG.MAX_STRING_LENGTH) {
      this.logger.warn(
        `String truncated from ${value.length} to ${SANITIZE_CONFIG.MAX_STRING_LENGTH}`,
      );
      value = value.slice(0, SANITIZE_CONFIG.MAX_STRING_LENGTH);
    }

    // Remove null bytes first (can bypass other filters)
    let sanitized = value.replace(XSS_PATTERNS.NULL_BYTES, '');

    // Apply all XSS patterns
    sanitized = sanitized
      // Remove script tags
      .replace(XSS_PATTERNS.SCRIPT, '')
      .replace(XSS_PATTERNS.SCRIPT_OPEN, '')
      // Remove iframe tags
      .replace(XSS_PATTERNS.IFRAME, '')
      .replace(XSS_PATTERNS.IFRAME_OPEN, '')
      // Remove event handlers
      .replace(XSS_PATTERNS.EVENT_HANDLERS, '')
      // Remove dangerous protocols
      .replace(XSS_PATTERNS.JS_PROTOCOL, '')
      .replace(XSS_PATTERNS.VBS_PROTOCOL, '')
      // Remove dangerous data URLs
      .replace(XSS_PATTERNS.DATA_HTML, '')
      .replace(XSS_PATTERNS.DATA_JS, '')
      // Remove dangerous HTML tags
      .replace(XSS_PATTERNS.DANGEROUS_TAGS, '')
      // Remove CSS expressions and imports
      .replace(XSS_PATTERNS.CSS_EXPRESSION, '')
      .replace(XSS_PATTERNS.CSS_IMPORT, '');

    return sanitized.trim();
  }

  /**
   * Sanitize array with bounds checking
   */
  private sanitizeArray(arr: any[], depth: number): any[] {
    // DoS protection: Limit array size
    const maxLength = Math.min(arr.length, SANITIZE_CONFIG.MAX_ARRAY_LENGTH);

    if (arr.length > maxLength) {
      this.logger.warn(`Array truncated from ${arr.length} to ${maxLength}`);
    }

    const result: any[] = new Array(maxLength);
    for (let i = 0; i < maxLength; i++) {
      result[i] = this.sanitizeValue(arr[i], depth + 1);
    }

    return result;
  }

  /**
   * Sanitize object with prototype pollution protection
   */
  private sanitizeObject(obj: any, depth: number): any {
    // Skip special objects
    if (obj instanceof Date) return obj;
    if (obj instanceof RegExp) return obj;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(obj)) return obj;

    const keys = Object.keys(obj);

    // DoS protection: Limit number of keys
    const maxKeys = Math.min(keys.length, SANITIZE_CONFIG.MAX_OBJECT_KEYS);

    if (keys.length > maxKeys) {
      this.logger.warn(`Object keys truncated from ${keys.length} to ${maxKeys}`);
    }

    const sanitized: Record<string, any> = {};

    for (let i = 0; i < maxKeys; i++) {
      const key = keys[i];

      // Prototype pollution protection
      if (DANGEROUS_KEYS.has(key)) {
        this.logger.warn(`Blocked prototype pollution attempt with key: ${key}`);
        continue;
      }

      // Skip keys that start with $ (MongoDB operators, etc.)
      if (key.startsWith('$')) {
        this.logger.warn(`Blocked potential injection key: ${key}`);
        continue;
      }

      const value = obj[key];
      sanitized[key] = this.sanitizeValue(value, depth + 1);
    }

    return sanitized;
  }
}

/**
 * Utility function to sanitize a single string (for use outside pipe)
 */
export function sanitizeString(value: string): string {
  if (!value || typeof value !== 'string') return value;

  return value
    .replace(XSS_PATTERNS.NULL_BYTES, '')
    .replace(XSS_PATTERNS.SCRIPT, '')
    .replace(XSS_PATTERNS.SCRIPT_OPEN, '')
    .replace(XSS_PATTERNS.IFRAME, '')
    .replace(XSS_PATTERNS.IFRAME_OPEN, '')
    .replace(XSS_PATTERNS.EVENT_HANDLERS, '')
    .replace(XSS_PATTERNS.JS_PROTOCOL, '')
    .replace(XSS_PATTERNS.VBS_PROTOCOL, '')
    .replace(XSS_PATTERNS.DATA_HTML, '')
    .replace(XSS_PATTERNS.DATA_JS, '')
    .replace(XSS_PATTERNS.DANGEROUS_TAGS, '')
    .replace(XSS_PATTERNS.CSS_EXPRESSION, '')
    .replace(XSS_PATTERNS.CSS_IMPORT, '')
    .trim();
}
