import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';

// Get socket URL - strip /api suffix if present
const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  return apiUrl.replace(/\/api\/?$/, '');
};
const SOCKET_URL = getSocketUrl();

// Configuration
const HEARTBEAT_INTERVAL = 30000; // Send heartbeat every 30 seconds
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // Refresh token every 4 minutes
const RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 1000;
const RECONNECT_DELAY_MAX = 5000;
const CONNECTION_TIMEOUT = 10000;

// Singleton socket instance and state
let sharedSocket = null;
let connectionCount = 0;
let currentToken = null;
let heartbeatInterval = null;
let tokenRefreshInterval = null;

// Connection quality tracking
let connectionQuality = {
  latency: null,
  lastHeartbeat: null,
  missedHeartbeats: 0,
};

/**
 * Reset connection quality metrics
 */
const resetConnectionQuality = () => {
  connectionQuality = {
    latency: null,
    lastHeartbeat: null,
    missedHeartbeats: 0,
  };
};

/**
 * Start heartbeat mechanism
 */
const startHeartbeat = (token) => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (sharedSocket?.connected) {
      const startTime = Date.now();
      sharedSocket.emit('heartbeat', { timestamp: startTime });

      // Track missed heartbeats
      if (connectionQuality.lastHeartbeat) {
        const timeSinceLastHeartbeat = startTime - connectionQuality.lastHeartbeat;
        if (timeSinceLastHeartbeat > HEARTBEAT_INTERVAL * 2) {
          connectionQuality.missedHeartbeats++;
        }
      }
    }
  }, HEARTBEAT_INTERVAL);
};

/**
 * Stop heartbeat mechanism
 */
const stopHeartbeat = () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
};

/**
 * Start token refresh mechanism
 */
const startTokenRefresh = (getToken) => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  tokenRefreshInterval = setInterval(() => {
    if (sharedSocket?.connected) {
      const token = getToken();
      if (token && token !== currentToken) {
        currentToken = token;
        sharedSocket.emit('refreshAuth', { token });
      } else if (token) {
        // Even if token hasn't changed, still refresh to validate
        sharedSocket.emit('refreshAuth', { token });
      }
    }
  }, TOKEN_REFRESH_INTERVAL);
};

/**
 * Stop token refresh mechanism
 */
const stopTokenRefresh = () => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

/**
 * Base WebSocket hook for shared socket connection
 * Uses singleton pattern to maintain one connection across components
 * Each hook instance registers its own connection state handlers
 *
 * Features:
 * - Automatic heartbeat for connection health monitoring
 * - Token refresh mechanism for long-lived connections
 * - Emit with acknowledgment support
 * - Connection quality tracking
 * - Rate limiting protection
 */
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(() => sharedSocket?.connected ?? false);
  const [connectionError, setConnectionError] = useState(null);
  const [connectionState, setConnectionState] = useState('disconnected'); // 'connecting', 'connected', 'reconnecting', 'disconnected', 'error'

  // Track handlers registered by this hook instance - use array to support multiple handlers per event
  const eventHandlersRef = useRef([]);
  const mountedRef = useRef(true);

  // Get auth token from Redux store
  const { token } = useSelector((state) => state.auth);

  // Create a getter function for the current token (for token refresh)
  const getTokenRef = useRef(() => token);
  getTokenRef.current = () => token;

  // Initialize or reuse socket connection
  useEffect(() => {
    mountedRef.current = true;

    if (!token) {
      // No token, disconnect if connected and no other consumers
      if (sharedSocket && connectionCount === 0) {
        stopHeartbeat();
        stopTokenRefresh();
        sharedSocket.disconnect();
        sharedSocket = null;
        currentToken = null;
        resetConnectionQuality();
      }
      setIsConnected(false);
      setConnectionState('disconnected');
      return;
    }

    connectionCount++;

    // Check if token changed - need to reconnect with new token
    const tokenChanged = currentToken && currentToken !== token;

    // Create shared socket if not exists or token changed
    if (!sharedSocket || tokenChanged) {
      // Disconnect old socket if token changed
      if (sharedSocket && tokenChanged) {
        stopHeartbeat();
        stopTokenRefresh();
        sharedSocket.disconnect();
        sharedSocket = null;
        resetConnectionQuality();
      }

      currentToken = token;
      setConnectionState('connecting');

      sharedSocket = io(SOCKET_URL, {
        auth: { token },
        query: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: RECONNECT_ATTEMPTS,
        reconnectionDelay: RECONNECT_DELAY,
        reconnectionDelayMax: RECONNECT_DELAY_MAX,
        timeout: CONNECTION_TIMEOUT,
        forceNew: false,
      });

      // Global error handler (only once per socket)
      sharedSocket.on('error', (error) => {
        console.error('[WebSocket] Error:', error);
        if (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_INVALID') {
          // Token issue - disconnect and let app handle re-auth
          sharedSocket.disconnect();
        }
      });

      // Handle heartbeat acknowledgment
      sharedSocket.on('heartbeat_ack', (data) => {
        const latency = Date.now() - (data.timestamp || Date.now());
        connectionQuality.latency = latency;
        connectionQuality.lastHeartbeat = Date.now();
        connectionQuality.missedHeartbeats = 0;
      });

      // Handle auth refresh response
      sharedSocket.on('authRefreshed', (data) => {
        if (data.success) {
          console.debug('[WebSocket] Auth refreshed successfully');
        }
      });

      // Handle rate limit warning
      sharedSocket.on('error', (error) => {
        if (error.code === 'RATE_LIMIT') {
          console.warn('[WebSocket] Rate limit exceeded, slowing down');
        }
      });
    } else {
      // Socket exists with same token
      sharedSocket.auth = { token };
      if (!sharedSocket.connected) {
        setConnectionState('connecting');
        sharedSocket.connect();
      }
    }

    // Each hook instance registers its own connection state handlers
    const handleConnect = () => {
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
        setConnectionState('connected');
      }
      // Start heartbeat and token refresh on connect
      startHeartbeat(token);
      startTokenRefresh(getTokenRef.current);
    };

    const handleDisconnect = (reason) => {
      if (mountedRef.current) {
        setIsConnected(false);
        setConnectionState('disconnected');
      }
      // Stop heartbeat on disconnect
      stopHeartbeat();
      stopTokenRefresh();

      // Log disconnect reason for debugging
      console.debug(`[WebSocket] Disconnected: ${reason}`);

      // If server initiated disconnect, don't auto-reconnect
      if (reason === 'io server disconnect') {
        console.warn('[WebSocket] Server initiated disconnect');
      }
    };

    const handleConnectError = (error) => {
      if (mountedRef.current) {
        setIsConnected(false);
        setConnectionError(error.message);
        setConnectionState('error');
      }
      console.error('[WebSocket] Connection error:', error.message);
    };

    const handleReconnect = (attemptNumber) => {
      if (mountedRef.current) {
        setIsConnected(true);
        setConnectionError(null);
        setConnectionState('connected');
      }
      console.debug(`[WebSocket] Reconnected after ${attemptNumber} attempts`);
      // Restart heartbeat after reconnection
      startHeartbeat(token);
      startTokenRefresh(getTokenRef.current);
    };

    const handleReconnectAttempt = (attemptNumber) => {
      if (mountedRef.current) {
        setConnectionState('reconnecting');
      }
      console.debug(`[WebSocket] Reconnection attempt ${attemptNumber}`);
    };

    const handleReconnectFailed = () => {
      if (mountedRef.current) {
        setConnectionState('error');
        setConnectionError('Failed to reconnect after multiple attempts');
      }
      console.error('[WebSocket] Reconnection failed');
    };

    // Register this instance's handlers
    sharedSocket.on('connect', handleConnect);
    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('connect_error', handleConnectError);
    sharedSocket.io.on('reconnect', handleReconnect);
    sharedSocket.io.on('reconnect_attempt', handleReconnectAttempt);
    sharedSocket.io.on('reconnect_failed', handleReconnectFailed);

    // Sync initial state
    if (sharedSocket.connected) {
      setIsConnected(true);
      setConnectionState('connected');
      // Ensure heartbeat is running for existing connection
      startHeartbeat(token);
      startTokenRefresh(getTokenRef.current);
    }

    // Cleanup on unmount or token change
    return () => {
      mountedRef.current = false;
      connectionCount = Math.max(0, connectionCount - 1); // Prevent negative count

      // Remove this instance's connection state handlers
      if (sharedSocket) {
        sharedSocket.off('connect', handleConnect);
        sharedSocket.off('disconnect', handleDisconnect);
        sharedSocket.off('connect_error', handleConnectError);
        sharedSocket.io?.off('reconnect', handleReconnect);
        sharedSocket.io?.off('reconnect_attempt', handleReconnectAttempt);
        sharedSocket.io?.off('reconnect_failed', handleReconnectFailed);
      }

      // Clean up event handlers registered by this component
      for (const { event, handler } of eventHandlersRef.current) {
        sharedSocket?.off(event, handler);
      }
      eventHandlersRef.current = [];

      // Disconnect if no more consumers
      if (connectionCount === 0 && sharedSocket) {
        stopHeartbeat();
        stopTokenRefresh();
        sharedSocket.disconnect();
        sharedSocket = null;
        currentToken = null;
        resetConnectionQuality();
      }
    };
  }, [token]);

  // Handle visibility change - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && sharedSocket && !sharedSocket.connected && currentToken) {
        setConnectionState('reconnecting');
        sharedSocket.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Subscribe to a WebSocket event
   * Supports multiple handlers for the same event
   */
  const on = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.on(event, handler);
      eventHandlersRef.current.push({ event, handler });
    }
  }, []);

  /**
   * Unsubscribe from a WebSocket event
   */
  const off = useCallback((event, handler) => {
    if (sharedSocket) {
      sharedSocket.off(event, handler);
      eventHandlersRef.current = eventHandlersRef.current.filter(
        (h) => !(h.event === event && h.handler === handler)
      );
    }
  }, []);

  /**
   * Emit an event to the server (fire and forget)
   * @returns {boolean} true if socket is connected and event was sent
   */
  const emit = useCallback((event, data) => {
    if (sharedSocket?.connected) {
      sharedSocket.emit(event, data);
      return true;
    }
    console.warn(`[WebSocket] Cannot emit '${event}': not connected`);
    return false;
  }, []);

  /**
   * Emit an event with acknowledgment/callback
   * @returns {Promise} resolves with server response or rejects on timeout/error
   */
  const emitWithAck = useCallback((event, data, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      if (!sharedSocket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${event} acknowledgment`));
      }, timeout);

      sharedSocket.emit(event, data, (response) => {
        clearTimeout(timeoutId);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }, []);

  /**
   * Get the socket instance (for advanced usage)
   */
  const getSocket = useCallback(() => sharedSocket, []);

  /**
   * Get connection quality metrics
   */
  const getConnectionQuality = useCallback(() => ({
    ...connectionQuality,
    isHealthy: connectionQuality.missedHeartbeats < 3 && connectionQuality.latency < 1000,
  }), []);

  /**
   * Force reconnection
   */
  const reconnect = useCallback(() => {
    if (sharedSocket) {
      setConnectionState('reconnecting');
      sharedSocket.disconnect();
      setTimeout(() => {
        if (currentToken) {
          sharedSocket.connect();
        }
      }, 100);
    }
  }, []);

  return {
    // Connection state
    isConnected,
    connectionError,
    connectionState,

    // Event handlers
    on,
    off,
    emit,
    emitWithAck,

    // Utilities
    getSocket,
    getConnectionQuality,
    reconnect,
  };
};

export default useWebSocket;
