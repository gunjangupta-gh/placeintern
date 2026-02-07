// Cache duration in milliseconds (5 minutes) - aligned with all Redux slices
export const CACHE_DURATION = 5 * 60 * 1000;

// Volatile cache duration for frequently changing data (2 minutes)
export const VOLATILE_CACHE_DURATION = 2 * 60 * 1000;

// Check if data is stale
export const isStale = (lastFetched) => {
  if (!lastFetched) return true;
  return Date.now() - lastFetched > CACHE_DURATION;
};

// Cache middleware - prevents redundant API calls
export const cacheMiddleware = (store) => (next) => (action) => {
  // Only intercept fetch actions
  if (action.type?.endsWith('/pending')) {
    const sliceName = action.type.split('/')[0];
    const state = store.getState()[sliceName];
    const forceRefresh = action.meta?.arg?.forceRefresh || action.meta?.arg?.force;

    // If we have cached data and it's not stale, skip the fetch
    if (typeof state?.lastFetched === 'number' && !isStale(state.lastFetched) && !forceRefresh) {
      return;
    }
  }

  return next(action);
};
