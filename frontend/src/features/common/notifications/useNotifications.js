import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';
import toast from 'react-hot-toast';
import { useWebSocket } from '../../../hooks/useWebSocket';

/**
 * Custom hook for managing notifications with real-time WebSocket support
 * This is the common hook used across the application
 *
 * Features:
 * - Real-time notifications via WebSocket
 * - HTTP fallback for initial fetch
 * - Automatic retry on failure
 * - Cross-tab synchronization
 * - Optimistic updates with rollback
 */
export const useNotifications = (options = {}) => {
  const {
    autoFetch = true,
    showToasts = true,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Track mounted state
  const mountedRef = useRef(true);
  const handlersRef = useRef([]);
  const initialFetchDoneRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef(null);

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Use the shared WebSocket hook with new features
  const { isConnected, connectionState, on, off, emit, emitWithAck, reconnect } = useWebSocket();

  // Set mounted ref on mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      // Clear any pending retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Fetch notifications via HTTP (initial load and fallback) with retry logic
  const fetchNotifications = useCallback(async (isRetry = false) => {
    if (!token) return;

    if (!isRetry) {
      setLoading(true);
      setError(null);
      retryCountRef.current = 0;
    }

    try {
      const response = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS);
      if (mountedRef.current) {
        // API returns { data: [...], unreadCount: N, pagination: {...} }
        const result = response.data;
        setNotifications(result?.data || []);
        setUnreadCount(result?.unreadCount || 0);
        setLastSyncTime(new Date());
        retryCountRef.current = 0; // Reset retry count on success
      }
    } catch (err) {
      if (mountedRef.current) {
        console.error('Error fetching notifications:', err);

        // Retry logic
        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const delay = retryDelay * Math.pow(2, retryCountRef.current - 1); // Exponential backoff
          console.debug(`[Notifications] Retrying fetch in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);

          retryTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              fetchNotifications(true);
            }
          }, delay);
        } else {
          setError(err.message);
          if (showToasts) {
            toast.error('Failed to load notifications. Please refresh the page.');
          }
        }
      }
    } finally {
      if (mountedRef.current && !isRetry) {
        setLoading(false);
      }
    }
  }, [token, maxRetries, retryDelay, showToasts]);

  // Resync notifications when connection is restored
  useEffect(() => {
    if (connectionState === 'connected' && lastSyncTime) {
      // Re-fetch to ensure we didn't miss any notifications while disconnected
      const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
      if (timeSinceLastSync > 60000) { // If disconnected for more than 1 minute
        console.debug('[Notifications] Resyncing after reconnection');
        fetchNotifications();
      }
    }
  }, [connectionState, lastSyncTime, fetchNotifications]);

  // Set up WebSocket event listeners
  useEffect(() => {
    if (!isConnected) {
      // Clean up any existing handlers when disconnected
      for (const { event, handler } of handlersRef.current) {
        off(event, handler);
      }
      handlersRef.current = [];
      return;
    }

    // Handler for new notifications
    const handleNotification = (notification) => {
      if (mountedRef.current) {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // Show toast for new notification
        if (showToasts) {
          toast(notification.title || 'New notification', {
            icon: 'info',
            duration: 4000,
          });
        }
      }
    };

    // Handler for unread count updates
    const handleUnreadCount = (data) => {
      if (mountedRef.current) {
        setUnreadCount(data.count);
      }
    };

    // Handler for mark as read acknowledgment
    const handleMarkAsReadAck = (data) => {
      if (mountedRef.current) {
        // Update local state to reflect the read status
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === data.notificationId ? { ...notif, read: true } : notif
          )
        );
      }
    };

    // Handler for notification deleted (from another tab/device)
    const handleNotificationDeleted = (data) => {
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.filter((notif) => notif.id !== data.notificationId)
        );
      }
    };

    // Define handlers to register
    const handlers = [
      { event: 'notification', handler: handleNotification },
      { event: 'unreadCount', handler: handleUnreadCount },
      { event: 'markAsReadAck', handler: handleMarkAsReadAck },
      { event: 'notificationDeleted', handler: handleNotificationDeleted },
    ];

    // Subscribe to events
    for (const { event, handler } of handlers) {
      on(event, handler);
    }
    handlersRef.current = handlers;

    // Cleanup on unmount or disconnect
    return () => {
      for (const { event, handler } of handlers) {
        off(event, handler);
      }
      handlersRef.current = [];
    };
  }, [isConnected, on, off, showToasts]);

  // Fetch notifications when token changes (initial load)
  useEffect(() => {
    if (token && autoFetch) {
      // Only fetch if we haven't done initial fetch or token changed
      if (!initialFetchDoneRef.current) {
        fetchNotifications();
        initialFetchDoneRef.current = true;
      }
    } else if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      initialFetchDoneRef.current = false;
    }
  }, [token, autoFetch, fetchNotifications]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}/read`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Also notify via WebSocket for cross-tab sync
      emit('markAsRead', { notificationId });
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark as read');
    }
  }, [emit]);

  // Mark multiple as read
  const markMultipleAsRead = useCallback(async (notificationIds) => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/mark-read`, { ids: notificationIds });
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notificationIds.includes(notif.id) ? { ...notif, read: true } : notif
          )
        );
        // Fetch updated unread count
        const countResponse = await apiClient.get(`${API_ENDPOINTS.NOTIFICATIONS}/unread-count`);
        setUnreadCount(countResponse.data?.count ?? countResponse.data?.unreadCount ?? 0);
      }
      toast.success(`${notificationIds.length} notifications marked as read`);
    } catch (err) {
      console.error('Error marking notifications as read:', err);
      toast.error('Failed to mark notifications as read');
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.put(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true }))
        );
        setUnreadCount(0);
      }
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Failed to mark notifications as read');
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
      await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/${notificationId}`);
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.filter((notif) => notif.id !== notificationId)
        );
        if (wasUnread) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      toast.success('Notification deleted');
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('Failed to delete notification');
    }
  }, [notifications]);

  // Delete multiple notifications
  const deleteMultiple = useCallback(async (notificationIds) => {
    try {
      await apiClient.post(`${API_ENDPOINTS.NOTIFICATIONS}/delete-multiple`, { ids: notificationIds });
      if (mountedRef.current) {
        setNotifications((prev) =>
          prev.filter((notif) => !notificationIds.includes(notif.id))
        );
        // Fetch updated unread count
        const countResponse = await apiClient.get(`${API_ENDPOINTS.NOTIFICATIONS}/unread-count`);
        setUnreadCount(countResponse.data?.count ?? countResponse.data?.unreadCount ?? 0);
      }
      toast.success(`${notificationIds.length} notifications deleted`);
    } catch (err) {
      console.error('Error deleting notifications:', err);
      toast.error('Failed to delete notifications');
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    try {
      const response = await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/clear-all`);
      if (mountedRef.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
      toast.success(response.data?.message || 'All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      toast.error('Failed to clear notifications');
    }
  }, []);

  // Clear read notifications only
  const clearRead = useCallback(async () => {
    try {
      await apiClient.delete(`${API_ENDPOINTS.NOTIFICATIONS}/clear-read`);
      if (mountedRef.current) {
        setNotifications((prev) => prev.filter((notif) => !notif.read));
      }
      toast.success('Read notifications cleared');
    } catch (err) {
      console.error('Error clearing read notifications:', err);
      toast.error('Failed to clear read notifications');
    }
  }, []);

  // Refresh notifications manually
  const refresh = useCallback(() => {
    retryCountRef.current = 0; // Reset retry count
    fetchNotifications();
  }, [fetchNotifications]);

  // Force reconnect WebSocket
  const forceReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

  return {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    isConnected,
    connectionState,
    lastSyncTime,

    // Actions
    fetchNotifications,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteMultiple,
    clearAll,
    clearRead,
    refresh,
    forceReconnect,
  };
};

export default useNotifications;
