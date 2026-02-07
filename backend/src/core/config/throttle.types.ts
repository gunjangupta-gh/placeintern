/**
 * Throttle Configuration Types
 * Type definitions for the centralized throttle configuration system
 */

/**
 * Single throttle preset configuration
 */
export interface ThrottlePreset {
  limit: number;
  ttl: number;
}

/**
 * Available throttle preset types by operation
 */
export type ThrottlePresetType =
  | 'dashboard'
  | 'export'
  | 'list'
  | 'mutation'
  | 'lightweight'
  | 'default';

/**
 * Record of all throttle presets
 */
export type ThrottlePresets = Record<ThrottlePresetType, ThrottlePreset>;

/**
 * WebSocket-specific rate limiting configuration
 */
export interface WebSocketThrottleConfig {
  windowMs: number;
  maxEvents: number;
  cleanupIntervalMs: number;
  entryTtlMs: number;
}

/**
 * Complete throttle configuration
 */
export interface ThrottleConfig {
  /** Global flag to enable/disable HTTP throttling */
  enabled: boolean;
  /** Flag to enable/disable WebSocket rate limiting */
  wsEnabled: boolean;
  presets: ThrottlePresets;
  websocket: WebSocketThrottleConfig;
  skipPatterns: string[];
  errorMessage: string;
}
