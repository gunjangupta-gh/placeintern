/**
 * Central export file for all custom React hooks
 * This file provides easy access to all hooks in the application
 */

export { useAuth } from './useAuth';
export { useDebounce, useDebouncedCallback } from './useDebounce';
export { useSmartFetch } from './useSmartFetch';
export { useNotifications } from './useNotifications';
export { useSmartIndustry } from './useSmartIndustry';
export { useWebSocket } from './useWebSocket';
export { useThemeStyles } from './useThemeStyles';

// Lookup hooks (re-exported from shared features for convenience)
export {
  useLookup,
  useBranches,
  useDepartments,
  useBatches,
  useInstitutions,
} from '../features/shared/hooks/useLookup';

// Default exports (only for hooks that have default exports)
export { default as useAuthDefault } from './useAuth';
export { default as useDebounceDefault } from './useDebounce';
export { default as useSmartFetchDefault } from './useSmartFetch';
export { default as useNotificationsDefault } from './useNotifications';
export { default as useWebSocketDefault } from './useWebSocket';
// Note: useThemeStyles only has named export, no default export
