import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { message } from 'antd';

/**
 * Custom hook for real-time system metrics via WebSocket
 * Provides health and metrics data with automatic updates
 * Uses the shared useWebSocket hook for unified WebSocket connection
 */
export const useMetricsSocket = (options = {}) => {
  const { autoConnect = true, fallbackToPolling = true } = options;

  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [sessionStats, setSessionStats] = useState(null);
  const [backupProgress, setBackupProgress] = useState(null);
  const [restoreProgress, setRestoreProgress] = useState(null);
  const [bulkOperationProgress, setBulkOperationProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Use shared WebSocket connection
  const { isConnected, connectionError, on, off, emit } = useWebSocket();

  const pollingIntervalRef = useRef(null);
  const mountedRef = useRef(true);
  const handlersRef = useRef([]);
  const progressClearTimeoutRef = useRef(null);

  // Set mounted ref on mount/unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Clear progress after delay (for completed/failed states)
  const clearProgressAfterDelay = useCallback((setter, delay = 5000) => {
    if (progressClearTimeoutRef.current) {
      clearTimeout(progressClearTimeoutRef.current);
    }
    progressClearTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setter(null);
      }
    }, delay);
  }, []);

  // Fallback polling function
  const fetchMetricsHttp = useCallback(async () => {
    try {
      const { adminService } = await import('../../../services/admin.service');
      const [healthData, metricsData] = await Promise.all([
        adminService.getDetailedHealth(),
        adminService.getRealtimeMetrics(),
      ]);

      if (mountedRef.current) {
        setHealth(healthData);
        setMetrics(metricsData);
        setLastUpdate(new Date());
        setLoading(false);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, []);

  // Start HTTP polling fallback
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    fetchMetricsHttp();
    pollingIntervalRef.current = setInterval(fetchMetricsHttp, 15000);
  }, [fetchMetricsHttp]);

  // Stop HTTP polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Manual refresh via WebSocket
  const refresh = useCallback(() => {
    if (isConnected) {
      emit('refreshMetrics');
    } else {
      fetchMetricsHttp();
    }
  }, [isConnected, emit, fetchMetricsHttp]);

  // Refresh sessions via WebSocket
  const refreshSessions = useCallback(() => {
    if (isConnected) {
      emit('refreshSessions');
    }
  }, [isConnected, emit]);

  // Handle connection state changes - manage polling
  useEffect(() => {
    if (isConnected) {
      stopPolling();
      setLoading(false);
    } else if (fallbackToPolling && autoConnect) {
      startPolling();
    }
  }, [isConnected, fallbackToPolling, autoConnect, startPolling, stopPolling]);

  // Handle connection errors
  useEffect(() => {
    if (connectionError && mountedRef.current) {
      setError(connectionError);
      if (fallbackToPolling) {
        message.info('Using HTTP polling for metrics updates');
        startPolling();
      }
    }
  }, [connectionError, fallbackToPolling, startPolling]);

  // Setup WebSocket event listeners when connected
  useEffect(() => {
    if (!isConnected) {
      // Clean up any existing handlers when disconnected
      for (const { event, handler } of handlersRef.current) {
        off(event, handler);
      }
      handlersRef.current = [];
      return;
    }

    // Handler for metrics updates
    const handleMetricsUpdate = (data) => {
      if (mountedRef.current) {
        setHealth(data.health);
        setMetrics(data.metrics);
        setLastUpdate(new Date(data.timestamp));
        setLoading(false);
        setError(null);
      }
    };

    // Handler for quick metrics (CPU/Memory only)
    const handleQuickMetrics = (data) => {
      if (mountedRef.current) {
        setMetrics((prev) => ({
          ...prev,
          cpu: { ...prev?.cpu, usage: data.cpu },
          memory: { ...prev?.memory, usagePercent: data.memory },
          application: { ...prev?.application, uptime: data.uptime },
        }));
        setLastUpdate(new Date(data.timestamp));
      }
    };

    // Handler for service alerts
    const handleServiceAlert = (data) => {
      if (mountedRef.current) {
        const alertType = data.status === 'down' ? 'error' : 'success';
        message[alertType](`${data.service} is ${data.status.toUpperCase()}`);

        setHealth((prev) => {
          if (!prev) return prev;
          const serviceKey = data.service.toLowerCase();
          if (prev.services && prev.services[serviceKey]) {
            return {
              ...prev,
              services: {
                ...prev.services,
                [serviceKey]: {
                  ...prev.services[serviceKey],
                  status: data.status,
                },
              },
            };
          }
          return prev;
        });
      }
    };

    // Handler for session updates
    const handleSessionUpdate = (data) => {
      if (mountedRef.current) {
        setSessionStats(data.stats);
        if (data.action === 'terminated') {
          message.info('Session activity updated');
        }
      }
    };

    // Handler for backup progress
    const handleBackupProgress = (data) => {
      if (mountedRef.current) {
        setBackupProgress(data);
        if (data.status === 'completed') {
          message.success('Backup completed successfully');
          clearProgressAfterDelay(setBackupProgress);
        } else if (data.status === 'failed') {
          message.error(`Backup failed: ${data.message || 'Unknown error'}`);
          clearProgressAfterDelay(setBackupProgress);
        }
      }
    };

    // Handler for restore progress
    const handleRestoreProgress = (data) => {
      if (mountedRef.current) {
        setRestoreProgress(data);
        if (data.status === 'completed') {
          message.success('Database restored successfully');
          clearProgressAfterDelay(setRestoreProgress);
        } else if (data.status === 'failed') {
          message.error(`Restore failed: ${data.message || 'Unknown error'}`);
          clearProgressAfterDelay(setRestoreProgress);
        }
      }
    };

    // Handler for bulk operation progress
    const handleBulkOperationProgress = (data) => {
      if (mountedRef.current) {
        setBulkOperationProgress(data);
        if (data.completed === data.total) {
          message.success(`Bulk ${data.type} operation completed: ${data.completed}/${data.total}`);
          clearProgressAfterDelay(setBulkOperationProgress);
        }
      }
    };

    // Handler for initial data (sent when admin connects)
    const handleInitialData = (data) => {
      if (mountedRef.current) {
        setHealth(data.health);
        setMetrics(data.metrics);
        setLastUpdate(new Date());
        setLoading(false);
      }
    };

    // Handler for errors
    const handleError = (err) => {
      if (mountedRef.current) {
        setError(err.message || 'WebSocket error');
      }
    };

    // Define handlers to register
    const handlers = [
      { event: 'metricsUpdate', handler: handleMetricsUpdate },
      { event: 'quickMetrics', handler: handleQuickMetrics },
      { event: 'serviceAlert', handler: handleServiceAlert },
      { event: 'sessionUpdate', handler: handleSessionUpdate },
      { event: 'backupProgress', handler: handleBackupProgress },
      { event: 'restoreProgress', handler: handleRestoreProgress },
      { event: 'bulkOperationProgress', handler: handleBulkOperationProgress },
      { event: 'initialData', handler: handleInitialData },
      { event: 'error', handler: handleError },
    ];

    // Subscribe to events
    for (const { event, handler } of handlers) {
      on(event, handler);
    }
    handlersRef.current = handlers;

    // Cleanup
    return () => {
      for (const { event, handler } of handlers) {
        off(event, handler);
      }
      handlersRef.current = [];
    };
  }, [isConnected, on, off, clearProgressAfterDelay]);

  // Cleanup polling and timeouts on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (progressClearTimeoutRef.current) {
        clearTimeout(progressClearTimeoutRef.current);
      }
    };
  }, [stopPolling]);

  // Initial data fetch if using polling
  useEffect(() => {
    if (autoConnect && !isConnected && fallbackToPolling) {
      fetchMetricsHttp();
    }
  }, [autoConnect, isConnected, fallbackToPolling, fetchMetricsHttp]);

  return {
    health,
    metrics,
    sessionStats,
    backupProgress,
    restoreProgress,
    bulkOperationProgress,
    connected: isConnected,
    loading,
    error,
    lastUpdate,
    refresh,
    refreshSessions,
  };
};

export default useMetricsSocket;
