/**
 * API Helper utilities for request cancellation and retry logic
 */

// Store active abort controllers for cleanup
const activeControllers = new Map();

/**
 * Create an AbortController and register it for a specific key
 * Automatically cancels any previous request with the same key
 * @param {string} key - Unique identifier for the request
 * @returns {AbortSignal} The abort signal to pass to fetch/axios
 */
export const createAbortSignal = (key) => {
  // Cancel any existing request with this key
  if (activeControllers.has(key)) {
    activeControllers.get(key).abort();
  }

  // Create new controller
  const controller = new AbortController();
  activeControllers.set(key, controller);

  return controller.signal;
};

/**
 * Clean up an abort controller after request completes
 * @param {string} key - The key used when creating the signal
 */
export const cleanupAbortSignal = (key) => {
  activeControllers.delete(key);
};

/**
 * Cancel a specific request by key
 * @param {string} key - The key of the request to cancel
 */
export const cancelRequest = (key) => {
  if (activeControllers.has(key)) {
    activeControllers.get(key).abort();
    activeControllers.delete(key);
  }
};

/**
 * Cancel all pending requests
 */
export const cancelAllRequests = () => {
  activeControllers.forEach((controller) => controller.abort());
  activeControllers.clear();
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.retries - Maximum number of retries (default: 3)
 * @param {number} options.delay - Initial delay in ms (default: 1000)
 * @param {number} options.backoff - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried
 * @returns {Promise} Result of the function
 */
export const retryWithBackoff = async (fn, options = {}) => {
  const {
    retries = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = (error) => {
      // Retry on network errors and 5xx server errors
      if (!error.response) return true; // Network error
      const status = error.response?.status;
      return status >= 500 && status < 600;
    },
  } = options;

  let lastError;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's an abort error
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        throw error;
      }

      // Check if we should retry this error
      if (!shouldRetry(error) || attempt === retries) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      currentDelay *= backoff;
    }
  }

  throw lastError;
};

/**
 * Wrap an async thunk to support request cancellation
 * @param {string} key - Unique key for this request type
 * @param {Function} apiCall - The API function to call
 * @param {Object} options - Additional options
 * @returns {Function} Wrapped function that supports cancellation
 */
export const withCancellation = (key, apiCall, options = {}) => {
  return async (...args) => {
    const signal = createAbortSignal(key);

    try {
      const result = await apiCall(...args, { signal, ...options });
      cleanupAbortSignal(key);
      return result;
    } catch (error) {
      cleanupAbortSignal(key);
      throw error;
    }
  };
};

/**
 * Create a cleanup function for component unmount
 * @param {string[]} keys - Array of request keys to cancel on unmount
 * @returns {Function} Cleanup function
 */
export const createCleanupHandler = (...keys) => {
  return () => {
    keys.forEach((key) => cancelRequest(key));
  };
};
