import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { TokenService } from '../../core/auth/services/token.service';
import {
  WebSocketEvent,
  AdminChannel,
  AdminRoles,
  RoomPatterns,
  SocketUserData,
  WebSocketSubscriber,
  MarkAsReadPayload,
} from './dto';
import {
  WEBSOCKET_THROTTLE_CONFIG,
  WS_RATE_LIMIT_ENABLED,
} from '../../core/config/throttle.config';

// Get allowed origins from environment variable
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  // Default origins for local development
  return ['http://localhost:5173', 'http://localhost:3000'];
};

@WebSocketGateway({
  cors: {
    origin: process.env.NODE_ENV === 'production' ? getAllowedOrigins() : true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000, // Heartbeat every 25 seconds
  pingTimeout: 20000, // Timeout after 20 seconds without pong
})
@Injectable()
export class UnifiedWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(UnifiedWebSocketGateway.name);

  // Track all connected users: userId -> Set of socketIds
  private userSockets: Map<string, Set<string>> = new Map();

  // Track all subscribers with detailed info
  private subscribers: Map<string, WebSocketSubscriber> = new Map();

  // Rate limiting: socketId -> { count, windowStart }
  private rateLimitMap: Map<string, { count: number; windowStart: number }> = new Map();

  // Interval for periodic cleanup of rate limit map
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

  constructor(private readonly tokenService: TokenService) {}

  afterInit(): void {
    this.logger.log('Unified WebSocket Gateway initialized');
    this.logger.log(`Allowed WebSocket origins: ${getAllowedOrigins().join(', ')}`);

    // Start periodic cleanup of stale rate limit entries
    this.startRateLimitCleanup();
  }

  /**
   * Cleanup resources on module destroy
   */
  onModuleDestroy(): void {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
    this.rateLimitMap.clear();
    this.userSockets.clear();
    this.subscribers.clear();
    this.logger.log('WebSocket Gateway cleanup completed');
  }

  /**
   * Start periodic cleanup of stale rate limit entries
   * This prevents memory leaks from disconnected clients
   */
  private startRateLimitCleanup(): void {
    this.rateLimitCleanupInterval = setInterval(() => {
      this.cleanupStaleRateLimitEntries();
    }, WEBSOCKET_THROTTLE_CONFIG.cleanupIntervalMs);
  }

  /**
   * Remove rate limit entries for disconnected clients or expired entries
   */
  private cleanupStaleRateLimitEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [socketId, rateInfo] of this.rateLimitMap.entries()) {
      // Remove entry if:
      // 1. Socket is no longer connected, OR
      // 2. Entry is older than TTL (stale)
      const isConnected = this.subscribers.has(socketId);
      const isStale = now - rateInfo.windowStart > WEBSOCKET_THROTTLE_CONFIG.entryTtlMs;

      if (!isConnected || isStale) {
        this.rateLimitMap.delete(socketId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Rate limit cleanup: removed ${cleanedCount} stale entries, ${this.rateLimitMap.size} remaining`);
    }
  }

  /**
   * Handle new WebSocket connection
   * Validates JWT and joins user to appropriate rooms
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Debug: record handshake summary (don't log token contents)
      const origin = client.handshake.headers.origin || client.handshake.headers?.Origin || 'unknown';
      const upgrade = client.handshake.headers.upgrade || 'none';
      const hasAuth = !!client.handshake.auth?.token;
      const hasQueryToken = !!client.handshake.query?.token;
      this.logger.debug(`Handshake attempt: id=${client.id}, url=${client.handshake.url || 'n/a'}, origin=${origin}, upgrade=${upgrade}, auth=${hasAuth}, queryToken=${hasQueryToken}`);

      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`Connection rejected: No token - ${client.id}`);
        client.emit(WebSocketEvent.ERROR, { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.tokenService.validateAccessToken(token);

      if (!payload || !payload.sub) {
        this.logger.warn(`Connection rejected: Invalid token - ${client.id}`);
        client.emit(WebSocketEvent.ERROR, { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const userId = payload.sub;
      // Token stores roles as array, get first role
      const role = (payload.roles?.[0] || payload.role) as Role;
      const institutionId = payload.institutionId;

      // Store user data in socket
      const userData: SocketUserData = {
        userId,
        email: payload.email,
        role,
        institutionId,
      };
      client.data = userData;

      // Join user-specific room (for personal notifications)
      await client.join(RoomPatterns.USER(userId));

      // Join role-specific room
      await client.join(RoomPatterns.ROLE(role));

      // Join institution room if applicable
      if (institutionId) {
        await client.join(RoomPatterns.INSTITUTION(institutionId));
      }

      // Join admin rooms if user has admin role
      if (AdminRoles.includes(role)) {
        await client.join(AdminChannel.METRICS);
        await client.join(AdminChannel.SESSIONS);

        // Only SYSTEM_ADMIN can access backup channel
        if (role === Role.SYSTEM_ADMIN) {
          await client.join(AdminChannel.BACKUP);
          await client.join(AdminChannel.USERS);
        }
      }

      // Track socket for this user
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Track subscriber info
      this.subscribers.set(client.id, {
        socketId: client.id,
        userId,
        role,
        institutionId,
        connectedAt: new Date(),
      });

      this.logger.log(`Client connected: ${client.id} (User: ${userId}, Role: ${role})`);

      // Emit connection success
      client.emit(WebSocketEvent.CONNECTED, {
        userId,
        role,
        message: 'Connected to WebSocket',
        rooms: Array.from(client.rooms),
      });
    } catch (error) {
      // Log token expiration as warn (expected behavior) vs other errors
      if (error.message?.includes('expired')) {
        this.logger.warn(`Connection rejected: Token expired - ${client.id}`);
      } else {
        this.logger.error(`Connection error: ${error.message}`, error.stack);
      }
      client.emit(WebSocketEvent.ERROR, { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(client: Socket): void {
    const userData = client.data as SocketUserData;
    const userId = userData?.userId;

    if (userId) {
      // Remove socket from user tracking
      const userSocketSet = this.userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(client.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }

    // Remove from subscribers
    this.subscribers.delete(client.id);

    // Remove from rate limit map to prevent memory leak
    this.rateLimitMap.delete(client.id);

    this.logger.log(`Client disconnected: ${client.id} (User: ${userId || 'unknown'})`);
  }

  /**
   * Handle mark as read event from client
   */
  @SubscribeMessage(WebSocketEvent.MARK_AS_READ)
  handleMarkAsRead(
    @MessageBody() data: MarkAsReadPayload,
    @ConnectedSocket() client: Socket,
  ): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authenticated' });
      return;
    }

    this.logger.debug(`User ${userData.userId} marking notification ${data.notificationId} as read`);
    client.emit(WebSocketEvent.MARK_AS_READ_ACK, { notificationId: data.notificationId });
  }

  /**
   * Handle client requesting metrics refresh (admin only)
   */
  @SubscribeMessage('refreshMetrics')
  handleRefreshMetrics(@ConnectedSocket() client: Socket): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId || !AdminRoles.includes(userData.role)) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authorized' });
      return;
    }
    // The actual metrics will be emitted by MetricsService
    client.emit('metricsRefreshRequested', { timestamp: new Date() });
  }

  /**
   * Handle client requesting session refresh (admin only)
   */
  @SubscribeMessage('refreshSessions')
  handleRefreshSessions(@ConnectedSocket() client: Socket): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId || !AdminRoles.includes(userData.role)) {
      client.emit(WebSocketEvent.ERROR, { message: 'Not authorized' });
      return;
    }
    client.emit('sessionsRefreshRequested', { timestamp: new Date() });
  }

  /**
   * Handle heartbeat/ping from client to keep connection alive
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket): void {
    const userData = client.data as SocketUserData;
    if (!userData?.userId) {
      return;
    }

    // Update last activity time
    const subscriber = this.subscribers.get(client.id);
    if (subscriber) {
      subscriber.lastActivity = new Date();
    }

    // Respond with pong
    client.emit('heartbeat_ack', {
      timestamp: new Date(),
      userId: userData.userId,
    });
  }

  /**
   * Handle token refresh request from client
   * Client should call this periodically or when token is about to expire
   */
  @SubscribeMessage('refreshAuth')
  handleRefreshAuth(
    @MessageBody() data: { token: string },
    @ConnectedSocket() client: Socket,
  ): void {
    try {
      const payload = this.tokenService.validateAccessToken(data.token);

      if (!payload || !payload.sub) {
        client.emit(WebSocketEvent.ERROR, {
          message: 'Invalid token',
          code: 'AUTH_INVALID',
        });
        client.disconnect();
        return;
      }

      // Update socket data with new token info
      const userData = client.data as SocketUserData;
      const newRole = (payload.roles?.[0] || payload.role) as Role;
      const newInstitutionId = payload.institutionId;

      // Check if role or institution changed - may need to update rooms
      if (userData.role !== newRole || userData.institutionId !== newInstitutionId) {
        // Leave old role room
        client.leave(RoomPatterns.ROLE(userData.role));
        // Join new role room
        client.join(RoomPatterns.ROLE(newRole));

        // Handle institution room changes
        if (userData.institutionId && userData.institutionId !== newInstitutionId) {
          client.leave(RoomPatterns.INSTITUTION(userData.institutionId));
        }
        if (newInstitutionId && userData.institutionId !== newInstitutionId) {
          client.join(RoomPatterns.INSTITUTION(newInstitutionId));
        }

        // Update admin room access
        if (AdminRoles.includes(newRole) && !AdminRoles.includes(userData.role)) {
          client.join(AdminChannel.METRICS);
          client.join(AdminChannel.SESSIONS);
          if (newRole === Role.SYSTEM_ADMIN) {
            client.join(AdminChannel.BACKUP);
            client.join(AdminChannel.USERS);
          }
        } else if (!AdminRoles.includes(newRole) && AdminRoles.includes(userData.role)) {
          client.leave(AdminChannel.METRICS);
          client.leave(AdminChannel.SESSIONS);
          client.leave(AdminChannel.BACKUP);
          client.leave(AdminChannel.USERS);
        }

        // Update user data
        userData.role = newRole;
        userData.institutionId = newInstitutionId;

        // Update subscriber info
        const subscriber = this.subscribers.get(client.id);
        if (subscriber) {
          subscriber.role = newRole;
          subscriber.institutionId = newInstitutionId;
        }
      }

      client.emit('authRefreshed', {
        success: true,
        userId: payload.sub,
        role: newRole,
        rooms: Array.from(client.rooms),
      });

      this.logger.debug(`Token refreshed for user ${payload.sub}`);
    } catch (error) {
      if (error.message?.includes('expired')) {
        client.emit(WebSocketEvent.ERROR, {
          message: 'Token expired',
          code: 'AUTH_EXPIRED',
        });
      } else {
        client.emit(WebSocketEvent.ERROR, {
          message: 'Token validation failed',
          code: 'AUTH_FAILED',
        });
      }
      client.disconnect();
    }
  }

  /**
   * Check rate limit for a socket
   * Returns true if within limits, false if exceeded
   */
  private checkRateLimit(socketId: string): boolean {
    // Skip rate limiting if disabled
    if (!WS_RATE_LIMIT_ENABLED) {
      return true;
    }

    const now = Date.now();
    let rateInfo = this.rateLimitMap.get(socketId);

    if (!rateInfo || now - rateInfo.windowStart > WEBSOCKET_THROTTLE_CONFIG.windowMs) {
      // Start new window
      rateInfo = { count: 1, windowStart: now };
      this.rateLimitMap.set(socketId, rateInfo);
      return true;
    }

    rateInfo.count++;
    if (rateInfo.count > WEBSOCKET_THROTTLE_CONFIG.maxEvents) {
      this.logger.warn(`Rate limit exceeded for socket ${socketId}`);
      return false;
    }

    return true;
  }

  /**
   * Generic message handler with rate limiting
   */
  @SubscribeMessage('*')
  handleGenericMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ): void {
    // Check rate limit
    if (!this.checkRateLimit(client.id)) {
      client.emit(WebSocketEvent.ERROR, {
        message: 'Rate limit exceeded. Please slow down.',
        code: 'RATE_LIMIT',
      });
      return;
    }
  }

  // ============ Public Methods for WebSocketService ============

  /**
   * Get the Socket.io server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Emit to a specific room
   */
  emitToRoom(room: string, event: string, data: any): void {
    const roomSockets = this.server.sockets.adapter.rooms.get(room);
    const socketCount = roomSockets ? roomSockets.size : 0;

    // Only log important events or when there are subscribers
    if (socketCount > 0 || event.includes('Progress') || event.includes('Alert')) {
      this.logger.debug(`Emitting '${event}' to room '${room}' (${socketCount} subscribers)`);
    }

    this.server.to(room).emit(event, data);
  }

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Get total socket count
   */
  getTotalSocketsCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get all subscribers in a specific room
   */
  getSubscribersInRoom(room: string): WebSocketSubscriber[] {
    const result: WebSocketSubscriber[] = [];
    for (const [socketId, subscriber] of this.subscribers) {
      // Check if this socket is in the room
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket && socket.rooms.has(room)) {
        result.push(subscriber);
      }
    }
    return result;
  }

  /**
   * Get admin subscribers count
   */
  getAdminSubscribersCount(): number {
    let count = 0;
    for (const subscriber of this.subscribers.values()) {
      if (AdminRoles.includes(subscriber.role)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Extract JWT token from socket handshake
   */
  private extractToken(client: Socket): string | null {
    // Try query parameter first (for browser compatibility)
    const queryToken = client.handshake.query.token;
    if (queryToken && typeof queryToken === 'string') {
      return queryToken;
    }

    // Try auth object
    const authToken = client.handshake.auth?.token;
    if (authToken && typeof authToken === 'string') {
      return authToken;
    }

    // Try Authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
