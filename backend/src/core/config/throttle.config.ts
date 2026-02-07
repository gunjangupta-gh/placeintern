/**
 * Centralized Throttle Configuration
 * Single source of truth for all rate limiting settings
 */

import {
  ThrottleConfig,
  ThrottlePreset,
  ThrottlePresets,
  WebSocketThrottleConfig,
} from './throttle.types';

/**
 * Parse environment variable as integer with fallback
 */
const parseEnvInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value || '', 10);
  return isNaN(parsed) ? fallback : parsed;
};

/**
 * Parse environment variable as boolean with fallback
 */
const parseEnvBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true' || value === '1';
};

/**
 * Parse comma-separated environment variable as array
 */
const parseEnvArray = (value: string | undefined, fallback: string[]): string[] => {
  if (!value || value.trim() === '') return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
};

// =============================================================================
// THROTTLE ENABLE/DISABLE
// =============================================================================

/**
 * Global flag to enable/disable HTTP throttling
 * Set THROTTLE_ENABLED=false in .env to disable all HTTP rate limiting
 */
export const THROTTLE_ENABLED: boolean = parseEnvBool(process.env.THROTTLE_ENABLED, true);

/**
 * Flag to enable/disable WebSocket rate limiting
 * Set WS_RATE_LIMIT_ENABLED=false in .env to disable WebSocket rate limiting
 */
export const WS_RATE_LIMIT_ENABLED: boolean = parseEnvBool(process.env.WS_RATE_LIMIT_ENABLED, true);

// =============================================================================
// THROTTLE PRESETS BY OPERATION TYPE
// =============================================================================

/**
 * Default TTL for all throttle presets (in milliseconds)
 * Can be overridden per-preset via environment variables
 */
const DEFAULT_TTL = parseEnvInt(process.env.THROTTLE_DEFAULT_TTL, 60000);

/**
 * Throttle presets for different operation types
 * Each preset can be overridden via environment variables
 */
export const THROTTLE_PRESETS: ThrottlePresets = {
  /**
   * Dashboard operations - restrictive limit for dashboard views
   * Use for: main dashboard endpoints, overview pages
   */
  dashboard: {
    limit: parseEnvInt(process.env.THROTTLE_DASHBOARD_LIMIT, 5),
    ttl: parseEnvInt(process.env.THROTTLE_DASHBOARD_TTL, DEFAULT_TTL),
  },

  /**
   * Export operations - most restrictive for expensive export operations
   * Use for: PDF exports, CSV downloads, report generation
   */
  export: {
    limit: parseEnvInt(process.env.THROTTLE_EXPORT_LIMIT, 3),
    ttl: parseEnvInt(process.env.THROTTLE_EXPORT_TTL, DEFAULT_TTL),
  },

  /**
   * List/Read operations - higher limit for read operations
   * Use for: paginated lists, search results, data fetching
   */
  list: {
    limit: parseEnvInt(process.env.THROTTLE_LIST_LIMIT, 30),
    ttl: parseEnvInt(process.env.THROTTLE_LIST_TTL, DEFAULT_TTL),
  },

  /**
   * Mutation operations - standard limit for create/update/delete
   * Use for: form submissions, data modifications, CRUD operations
   */
  mutation: {
    limit: parseEnvInt(process.env.THROTTLE_MUTATION_LIMIT, 10),
    ttl: parseEnvInt(process.env.THROTTLE_MUTATION_TTL, DEFAULT_TTL),
  },

  /**
   * Lightweight operations - most permissive for lightweight queries
   * Use for: health checks, count queries, status endpoints
   */
  lightweight: {
    limit: parseEnvInt(process.env.THROTTLE_LIGHTWEIGHT_LIMIT, 60),
    ttl: parseEnvInt(process.env.THROTTLE_LIGHTWEIGHT_TTL, DEFAULT_TTL),
  },

  /**
   * Default - global fallback for non-decorated routes
   * Use for: general API endpoints without specific requirements
   */
  default: {
    limit: parseEnvInt(process.env.THROTTLE_DEFAULT_LIMIT, 100),
    ttl: parseEnvInt(process.env.THROTTLE_DEFAULT_TTL, DEFAULT_TTL),
  },
};

// =============================================================================
// WEBSOCKET RATE LIMITING CONFIGURATION
// =============================================================================

/**
 * WebSocket-specific rate limiting configuration
 */
export const WEBSOCKET_THROTTLE_CONFIG: WebSocketThrottleConfig = {
  /** Rate limit window in milliseconds */
  windowMs: parseEnvInt(process.env.WS_RATE_LIMIT_WINDOW_MS, 60000),

  /** Maximum events allowed per window */
  maxEvents: parseEnvInt(process.env.WS_RATE_LIMIT_MAX_EVENTS, 100),

  /** Cleanup interval for stale entries in milliseconds */
  cleanupIntervalMs: parseEnvInt(process.env.WS_RATE_LIMIT_CLEANUP_INTERVAL_MS, 5 * 60 * 1000),

  /** Time-to-live for rate limit entries in milliseconds */
  entryTtlMs: parseEnvInt(process.env.WS_RATE_LIMIT_ENTRY_TTL_MS, 2 * 60 * 1000),
};

// =============================================================================
// SKIP PATTERNS
// =============================================================================

/**
 * Default routes to skip throttling
 */
const DEFAULT_SKIP_PATTERNS = ['/health', '/api/docs', '/api/docs/*'];

/**
 * Routes that should skip throttling
 * Can be extended via THROTTLE_SKIP_PATTERNS environment variable
 */
export const THROTTLE_SKIP_PATTERNS: string[] = parseEnvArray(
  process.env.THROTTLE_SKIP_PATTERNS,
  DEFAULT_SKIP_PATTERNS,
);

// =============================================================================
// ERROR MESSAGES
// =============================================================================

/**
 * Default throttle error message
 * Supports {retryAfter} placeholder for retry time in seconds
 */
export const THROTTLE_ERROR_MESSAGE: string =
  process.env.THROTTLE_ERROR_MESSAGE ||
  'Too many requests. Please try again in {retryAfter} seconds.';

// =============================================================================
// FULL CONFIGURATION EXPORT
// =============================================================================

/**
 * Complete throttle configuration object
 */
export const throttleConfig: ThrottleConfig = {
  enabled: THROTTLE_ENABLED,
  wsEnabled: WS_RATE_LIMIT_ENABLED,
  presets: THROTTLE_PRESETS,
  websocket: WEBSOCKET_THROTTLE_CONFIG,
  skipPatterns: THROTTLE_SKIP_PATTERNS,
  errorMessage: THROTTLE_ERROR_MESSAGE,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a throttle preset by name
 * @param preset - The preset type to retrieve
 * @returns The throttle preset configuration
 */
export const getThrottlePreset = (preset: keyof ThrottlePresets): ThrottlePreset => {
  return THROTTLE_PRESETS[preset];
};

/**
 * Format error message with retry time
 * @param retryAfterSeconds - Time until retry is allowed
 * @returns Formatted error message
 */
export const formatThrottleErrorMessage = (retryAfterSeconds: number): string => {
  return THROTTLE_ERROR_MESSAGE.replace('{retryAfter}', String(retryAfterSeconds));
};

/**
 * Check if a path matches any skip pattern
 * @param path - The request path to check
 * @returns True if the path should skip throttling
 */
export const shouldSkipThrottle = (path: string): boolean => {
  return THROTTLE_SKIP_PATTERNS.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return path.startsWith(prefix);
    }
    return path === pattern;
  });
};

export default throttleConfig;
