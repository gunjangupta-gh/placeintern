import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';
import toast from 'react-hot-toast';

// Map to track in-flight requests for deduplication
const inFlightRequests = new Map();

/**
 * Generate a unique key for request deduplication
 * @param {string} url - API endpoint URL
 * @param {string} method - HTTP method
 * @param {object} body - Request body
 * @returns {string} - Unique request key
 */
const generateRequestKey = (url, method, body) => {
  const bodyKey = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyKey}`;
};

/**
 * Smart fetch hook with automatic data fetching, caching, error handling, and request deduplication
 * @param {string} url - API endpoint URL
 * @param {object} options - Configuration options
 * @returns {object} - Data, loading state, error, and refetch function
 */
export const useSmartFetch = (url, options = {}) => {
  const {
    method = 'GET',
    body = null,
    dependencies = [],
    enabled = true,
    onSuccess,
    onError,
    showToast = true,
  } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !url) return;

    // Generate unique key for this request
    const requestKey = generateRequestKey(url, method, body);

    // Check if this request is already in-flight
    if (inFlightRequests.has(requestKey)) {
      // Return the existing promise to deduplicate the request
      try {
        const existingResult = await inFlightRequests.get(requestKey);
        setData(existingResult.data || existingResult);
        if (onSuccess) {
          onSuccess(existingResult.data || existingResult);
        }
        return existingResult;
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
        setError(errorMessage);
        if (onError) {
          onError(err);
        }
        throw err;
      }
    }

    setLoading(true);
    setError(null);

    // Create the request promise
    const requestPromise = (async () => {
      try {
        let response;

        switch (method.toUpperCase()) {
          case 'GET':
            response = await apiClient.get(url);
            break;
          case 'POST':
            response = await apiClient.post(url, body);
            break;
          case 'PUT':
            response = await apiClient.put(url, body);
            break;
          case 'PATCH':
            response = await apiClient.patch(url, body);
            break;
          case 'DELETE':
            response = await apiClient.delete(url);
            break;
          default:
            response = await apiClient.get(url);
        }

        setData(response.data || response);

        if (onSuccess) {
          onSuccess(response.data || response);
        }

        if (showToast && method !== 'GET') {
          toast.success(response.message || 'Operation successful');
        }

        return response;
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message || 'An error occurred';
        setError(errorMessage);

        if (onError) {
          onError(err);
        }

        if (showToast) {
          toast.error(errorMessage);
        }

        throw err;
      } finally {
        setLoading(false);
        // Clean up the in-flight request tracking
        inFlightRequests.delete(requestKey);
      }
    })();

    // Store the promise in the in-flight requests map
    inFlightRequests.set(requestKey, requestPromise);

    return requestPromise;
  }, [url, method, body, enabled, onSuccess, onError, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...dependencies]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export default useSmartFetch;
