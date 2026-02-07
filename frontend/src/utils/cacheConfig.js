/**
 * Centralized Cache Configuration
 * Single source of truth for all cache durations across the application
 *
 * Usage:
 * import { CACHE_DURATIONS, isCacheValid } from '../utils/cacheConfig';
 *
 * if (isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
 *   return { cached: true };
 * }
 */

// Cache durations in milliseconds
export const CACHE_DURATIONS = {
  // Very short - data that changes frequently
  ALERTS: 2 * 60 * 1000,           // 2 minutes

  // Short - lists that may update often
  LISTS: 3 * 60 * 1000,            // 3 minutes

  // Standard - most data falls here
  DEFAULT: 5 * 60 * 1000,          // 5 minutes
  DASHBOARD: 5 * 60 * 1000,        // 5 minutes
  NOTIFICATIONS: 5 * 60 * 1000,    // 5 minutes

  // Medium - data that updates occasionally
  PROFILE: 10 * 60 * 1000,         // 10 minutes
  METRICS: 10 * 60 * 1000,         // 10 minutes
  LOOKUP: 10 * 60 * 1000,          // 10 minutes (departments, branches, etc.)

  // Long - stable reference data
  MASTER_DATA: 30 * 60 * 1000,     // 30 minutes (batches, departments)
};

// Backward compatibility alias
export const CACHE_DURATION = CACHE_DURATIONS.DEFAULT;

/**
 * Check if cached data is still valid
 * @param {number|null} lastFetched - Timestamp of last fetch
 * @param {number} duration - Cache duration in milliseconds (default: CACHE_DURATIONS.DEFAULT)
 * @returns {boolean} - True if cache is valid
 */
export const isCacheValid = (lastFetched, duration = CACHE_DURATIONS.DEFAULT) => {
  if (!lastFetched) return false;
  return (Date.now() - lastFetched) < duration;
};

/**
 * Check if cache should be refreshed (inverse of isCacheValid)
 * @param {number|null} lastFetched - Timestamp of last fetch
 * @param {number} duration - Cache duration in milliseconds
 * @returns {boolean} - True if cache should be refreshed
 */
export const shouldRefreshCache = (lastFetched, duration = CACHE_DURATIONS.DEFAULT) => {
  return !isCacheValid(lastFetched, duration);
};

/**
 * Get remaining cache time in milliseconds
 * @param {number|null} lastFetched - Timestamp of last fetch
 * @param {number} duration - Cache duration in milliseconds
 * @returns {number} - Remaining time in ms, 0 if expired
 */
export const getRemainingCacheTime = (lastFetched, duration = CACHE_DURATIONS.DEFAULT) => {
  if (!lastFetched) return 0;
  const remaining = duration - (Date.now() - lastFetched);
  return Math.max(0, remaining);
};

export default CACHE_DURATIONS;
