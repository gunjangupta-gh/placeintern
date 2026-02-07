import { io } from 'socket.io-client';
import { tokenStorage } from '../utils/tokenManager';

/**
 * @deprecated This service is deprecated. Use the shared useWebSocket hook instead.
 * The useMetricsSocket hook now uses useWebSocket for unified WebSocket connection.
 * This file is kept for backwards compatibility only.
 *
 * System Metrics WebSocket Service
 * Provides real-time system metrics updates for admin dashboard
 * Uses the unified /ws namespace for all WebSocket communications
 */
class MetricsSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.isConnecting = false;
  }

  /**
   * Get WebSocket URL based on current environment
   * Connects to the default namespace (no /ws suffix - backend uses default namespace)
   */
  getSocketUrl() {
    const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    // Remove /api suffix to get base URL for WebSocket
    return apiUrl.replace(/\/api\/?$/, '');
  }

  /**
   * Connect to the unified WebSocket
   */
  connect() {
    if (this.socket?.connected || this.isConnecting) {
      return Promise.resolve();
    }

    this.isConnecting = true;
    const token = tokenStorage.getToken();

    if (!token) {
      this.isConnecting = false;
      return Promise.reject(new Error('No authentication token'));
    }

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.getSocketUrl(), {
          auth: { token },
          query: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
        });

        this.socket.on('connect', () => {
          console.log('[MetricsSocket] Connected to unified WebSocket');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          this.emit('connectionChange', { connected: true });
          resolve();
        });

        this.socket.on('connected', (data) => {
          console.log('[MetricsSocket] Authenticated:', data);
          // Admin users are automatically joined to admin:metrics room on backend
        });

        this.socket.on('initialData', (data) => {
          console.log('[MetricsSocket] Received initial data');
          this.emit('metricsUpdate', data);
        });

        this.socket.on('metricsUpdate', (data) => {
          this.emit('metricsUpdate', data);
        });

        this.socket.on('quickMetrics', (data) => {
          this.emit('quickMetrics', data);
        });

        this.socket.on('serviceAlert', (data) => {
          console.log('[MetricsSocket] Service alert:', data);
          this.emit('serviceAlert', data);
        });

        this.socket.on('sessionUpdate', (data) => {
          console.log('[MetricsSocket] Session update:', data);
          this.emit('sessionUpdate', data);
        });

        this.socket.on('backupProgress', (data) => {
          console.log('[MetricsSocket] Backup progress:', data);
          this.emit('backupProgress', data);
        });

        this.socket.on('restoreProgress', (data) => {
          console.log('[MetricsSocket] Restore progress:', data);
          this.emit('restoreProgress', data);
        });

        this.socket.on('bulkOperationProgress', (data) => {
          console.log('[MetricsSocket] Bulk operation progress:', data);
          this.emit('bulkOperationProgress', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('[MetricsSocket] Disconnected:', reason);
          this.isConnecting = false;
          this.emit('connectionChange', { connected: false, reason });
        });

        this.socket.on('connect_error', (error) => {
          console.error('[MetricsSocket] Connection error:', error.message);
          this.reconnectAttempts++;
          this.isConnecting = false;

          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('connectionChange', { connected: false, error: 'Max reconnection attempts reached' });
            reject(error);
          }
        });

        this.socket.on('error', (error) => {
          console.error('[MetricsSocket] Error:', error);
          this.emit('error', error);
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.isConnecting = false;
  }

  /**
   * Request immediate metrics refresh
   */
  refreshMetrics() {
    if (this.socket?.connected) {
      this.socket.emit('refreshMetrics');
    }
  }

  /**
   * Request immediate sessions refresh
   */
  refreshSessions() {
    if (this.socket?.connected) {
      this.socket.emit('refreshSessions');
    }
  }

  /**
   * Subscribe to a specific event
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[MetricsSocket] Error in listener for ${event}:`, error);
      }
    });
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.socket?.connected || false;
  }
}

// Singleton instance
export const metricsSocket = new MetricsSocketService();
export default metricsSocket;
