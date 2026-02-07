import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { LogoutReason, logoutUser } from '../utils/authUtils';
import api from '../services/api';
import { tokenStorage } from '../utils/tokenManager';

/**
 * Hook to monitor token expiration and handle automatic logout
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to enable monitoring
 * @param {number} options.warningMinutes - Minutes before expiry to show warning
 * @param {boolean} options.showWarning - Whether to show warning modal
 * @param {boolean} options.trackActivity - Whether to track user activity
 */
export const useTokenMonitor = (options = {}) => {
  const {
    enabled = true,
    warningMinutes = 5,
    showWarning = true,
    trackActivity = true,
  } = options;

  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState(null);
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const checkIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  // Get token expiry time
  const getTokenExpiry = useCallback(() => {
    const token = tokenStorage.getToken();
    if (!token) return null;

    try {
      const decoded = jwtDecode(token);
      return decoded.exp ? decoded.exp * 1000 : null;
    } catch {
      return null;
    }
  }, []);

  // Calculate remaining time
  const getRemainingTime = useCallback(() => {
    const expiry = getTokenExpiry();
    if (!expiry) return null;

    const remaining = expiry - Date.now();
    return remaining > 0 ? remaining : 0;
  }, [getTokenExpiry]);

  // Format time for display
  const formatTime = useCallback((ms) => {
    if (ms === null) return 'Unknown';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }, []);

  // Logout function - comprehensive cleanup and hard redirect
  const logout = useCallback(async (reason = LogoutReason.MANUAL) => {
    try {
      // Call logout API to invalidate token on server
      await api.post('/auth/logout').catch(() => {
        // Ignore API errors during logout
      });
    } catch (error) {
      console.error('Logout API error:', error);
    }

    // Clear all storage (localStorage, sessionStorage, cookies) except theme
    // tokenStorage.clear() now handles everything comprehensively
    tokenStorage.clear();

    // Hard redirect to login - this fully resets React state and cache
    window.location.href = '/login';
  }, []);

  // Refresh token (for automatic/proactive refresh)
  const refreshToken = useCallback(async () => {
    const refreshTokenValue = tokenStorage.getRefreshToken();
    if (!refreshTokenValue) {
      logout(LogoutReason.TOKEN_EXPIRED);
      return false;
    }

    try {
      const response = await api.post('/auth/refresh', {
        refresh_token: refreshTokenValue,
      });

      const newToken = response.data?.access_token || response.data?.accessToken || response.data?.token;
      const newRefreshToken = response.data?.refresh_token || response.data?.refreshToken;

      if (newToken) {
        tokenStorage.setToken(newToken);
        if (newRefreshToken) tokenStorage.setRefreshToken(newRefreshToken);
        warningShownRef.current = false;
        setShowExpiryWarning(false);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout(LogoutReason.TOKEN_EXPIRED);
    }

    return false;
  }, [logout]);

  // Extend session (for explicit user action - tracks session for admin panel)
  const extendSessionRequest = useCallback(async () => {
    const refreshTokenValue = tokenStorage.getRefreshToken();
    if (!refreshTokenValue) {
      logout(LogoutReason.TOKEN_EXPIRED);
      return false;
    }

    try {
      const response = await api.post('/auth/extend-session', {
        refresh_token: refreshTokenValue,
      });

      const newToken = response.data?.access_token || response.data?.accessToken || response.data?.token;
      const newRefreshToken = response.data?.refresh_token || response.data?.refreshToken;

      if (newToken) {
        tokenStorage.setToken(newToken);
        if (newRefreshToken) tokenStorage.setRefreshToken(newRefreshToken);
        warningShownRef.current = false;
        setShowExpiryWarning(false);
        return true;
      }
    } catch (error) {
      console.error('Extend session failed:', error);
      // Fall back to regular refresh
      return refreshToken();
    }

    return false;
  }, [logout, refreshToken]);

  // Track user activity
  useEffect(() => {
    if (!enabled || !trackActivity) return;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [enabled, trackActivity]);

  // Monitor token expiration
  useEffect(() => {
    if (!enabled) return;

    const checkTokenExpiry = () => {
      const remaining = getRemainingTime();

      if (remaining === null) {
        // No token, stop monitoring
        return;
      }

      // Update session info
      setSessionInfo({
        remainingMs: remaining,
        formattedTime: formatTime(remaining),
        expiresAt: new Date(Date.now() + remaining).toLocaleTimeString(),
      });

      // Check if token has expired
      if (remaining <= 0) {
        clearInterval(checkIntervalRef.current);
        logout(LogoutReason.TOKEN_EXPIRED);
        return;
      }

      // Show warning before expiry
      const warningThreshold = warningMinutes * 60 * 1000;
      if (remaining <= warningThreshold && !warningShownRef.current && showWarning) {
        warningShownRef.current = true;
        setShowExpiryWarning(true);
      }
    };

    // Initial check
    checkTokenExpiry();

    // Start interval
    checkIntervalRef.current = setInterval(checkTokenExpiry, 1000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, warningMinutes, showWarning, getRemainingTime, formatTime, logout]);

  // Handle warning modal actions (uses extend-session for proper tracking)
  const extendSession = useCallback(async () => {
    const success = await extendSessionRequest();
    if (success) {
      setShowExpiryWarning(false);
    }
  }, [extendSessionRequest]);

  return {
    logout,
    refreshToken,
    sessionInfo,
    getRemainingTime,
    isExpiring: showExpiryWarning,
    extendSession,
  };
};

export default useTokenMonitor;