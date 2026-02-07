import axios from 'axios';
import toast from 'react-hot-toast';
import { tokenStorage, isTokenExpired, isTokenExpiringSoon } from '../utils/tokenManager';

// Store reference for dispatching actions
let storeRef = null;
let refreshPromise = null;

export const setStore = (store) => {
  storeRef = store;
};

const getBaseURL = () => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  // Don't add /api if it's already in the URL (e.g., from Docker config)
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
};

const API = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
  timeout: 30000,
});

// Refresh token function
const refreshAuthToken = async () => {
  // Prevent multiple simultaneous refresh attempts
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Backend expects snake_case: { refresh_token: string }
  refreshPromise = API.post('/auth/refresh', { refresh_token: refreshToken })
    .then((response) => {
      const newToken = response.data?.access_token || response.data?.accessToken || response.data?.token;
      const newRefreshToken = response.data?.refresh_token || response.data?.refreshToken;

      if (newToken) {
        tokenStorage.setToken(newToken);
      }
      if (newRefreshToken) {
        tokenStorage.setRefreshToken(newRefreshToken);
      }

      return newToken;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

// Logout and redirect - comprehensive cleanup
const handleLogout = (message) => {
  // Clear all storage (localStorage, sessionStorage, cookies) except theme
  tokenStorage.clear();

  if (message) {
    toast.error(message);
  }

  // Hard redirect to login - fully resets React state
  window.location.href = '/login';
};

// Request interceptor
API.interceptors.request.use(
  async (config) => {
    // Skip token handling for auth endpoints (prevents interference during auth flows)
    if (
      config.url?.includes('/auth/login') ||
      config.url?.includes('/auth/refresh') ||
      config.url?.includes('/auth/extend-session')
    ) {
      return config;
    }

    let token = tokenStorage.getToken();

    // Check if token is expired
    if (token && isTokenExpired(token)) {
      try {
        token = await refreshAuthToken();
      } catch (error) {
        handleLogout('Session expired. Please login again.');
        return Promise.reject(new Error('Token expired'));
      }
    }
    // Proactively refresh if expiring soon (within 5 minutes)
    else if (token && isTokenExpiringSoon(token, 5)) {
      // Refresh in background, don't block the request
      refreshAuthToken().catch(() => {
        // Silently fail - will retry on next request
      });
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Unwrap TransformInterceptor response structure from backend.
 * Backend wraps all responses as: { data: T, statusCode, message, timestamp }
 */
const unwrapResponse = (data) => {
  if (
    data &&
    typeof data === 'object' &&
    'statusCode' in data &&
    'message' in data &&
    'timestamp' in data &&
    'data' in data
  ) {
    return data.data;
  }
  return data;
};

// Check if request is for auth endpoints (login, refresh, etc.)
const isAuthEndpoint = (url) => {
  const authPaths = [
    '/auth/login',
    '/auth/refresh',
    '/auth/extend-session',
    '/auth/student-login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
  ];
  return authPaths.some(path => url?.includes(path));
};

// Response interceptor
API.interceptors.response.use(
  (response) => {
    // Auto-unwrap TransformInterceptor wrapper
    response.data = unwrapResponse(response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Skip token refresh logic for auth endpoints - let them handle their own errors
    if (isAuthEndpoint(originalRequest?.url)) {
      return Promise.reject(error);
    }

    // Handle 401 - attempt token refresh once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAuthToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        handleLogout('Session expired. Please login again.');
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    if (error.response?.status === 403) {
      toast.error("Access denied. You don't have permission.");
    } else if (error.response?.status === 429) {
      toast.error('Too many requests. Please slow down.');
    } else if (!error.response) {
      toast.error('Unable to connect to server. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export const apiClient = API;
export default API;
