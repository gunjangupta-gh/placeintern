// Centralized Token Manager - Single source of truth for auth tokens
// Uses Redux store as the primary source, with localStorage as fallback for initial hydration

import { jwtDecode } from 'jwt-decode';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Token storage - uses a single localStorage key
export const tokenStorage = {
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (error) {
    }
  },

  getRefreshToken: () => {
    try {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setRefreshToken: (token) => {
    try {
      if (token) {
        localStorage.setItem(REFRESH_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    } catch (error) {
    }
  },

  clear: () => {
    try {
      // Keys to preserve (theme settings)
      const preserveKeys = ['theme', 'app_theme', 'darkMode', 'themeMode'];
      const preserved = {};

      // Save theme-related values
      preserveKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          preserved[key] = value;
        }
      });

      // Clear all localStorage
      localStorage.clear();

      // Restore theme values
      Object.entries(preserved).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      // Clear sessionStorage completely
      sessionStorage.clear();

      // Clear all cookies except theme
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=');
        const trimmedName = name.trim();
        if (!preserveKeys.includes(trimmedName)) {
          document.cookie = `${trimmedName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  },
};

// Token utilities
export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    // Add 30 second buffer for network latency
    return decoded.exp * 1000 < Date.now() + 30000;
  } catch {
    return true;
  }
};

export const isTokenExpiringSoon = (token, minutesBefore = 5) => {
  if (!token) return true;
  try {
    const decoded = jwtDecode(token);
    const expiresIn = decoded.exp * 1000 - Date.now();
    return expiresIn < minutesBefore * 60 * 1000;
  } catch {
    return true;
  }
};

export const getTokenPayload = (token) => {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export const getTokenExpiryTime = (token) => {
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000;
  } catch {
    return null;
  }
};

export default tokenStorage;
