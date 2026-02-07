import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Debounce hook for optimizing search and filter inputs
 * @param {*} value - The value to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @param {object} options - Configuration options
 * @param {boolean} options.immediate - Execute immediately on first call (default: false)
 * @returns {*} - The debounced value
 *
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 *
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     performSearch(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 */
export const useDebounce = (value, delay = 300, options = {}) => {
  const { immediate = false } = options;
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [isFirstRun, setIsFirstRun] = useState(true);

  useEffect(() => {
    // Handle immediate execution on first run
    if (immediate && isFirstRun) {
      setDebouncedValue(value);
      setIsFirstRun(false);
      return;
    }

    setIsFirstRun(false);

    // Set up debounce timer
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timer on value change or unmount
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay, immediate, isFirstRun]);

  return debouncedValue;
};

/**
 * Debounced callback hook for optimizing function calls
 * @param {Function} callback - The function to debounce
 * @param {number} delay - The delay in milliseconds (default: 300ms)
 * @param {Array} deps - Additional dependencies for the callback (default: [])
 * @returns {Function} - The debounced function
 *
 * @example
 * const debouncedSearch = useDebouncedCallback((searchTerm) => {
 *   performSearch(searchTerm);
 * }, 500);
 *
 * // Call the debounced function
 * debouncedSearch('query');
 */
export const useDebouncedCallback = (callback, delay = 300, deps = []) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create debounced function
  const debouncedFn = useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay, ...deps]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedFn;
};

export default useDebounce;
