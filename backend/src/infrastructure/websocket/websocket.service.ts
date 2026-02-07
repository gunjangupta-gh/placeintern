import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Role } from '../../generated/prisma/client';
import { UnifiedWebSocketGateway } from './websocket.gateway';
import {
  WebSocketEvent,
  AdminChannel,
  RoomPatterns,
  NotificationPayload,
  UnreadCountPayload,
  QuickMetricsPayload,
  MetricsUpdatePayload,
  SessionUpdatePayload,
  ServiceAlertPayload,
  BackupProgressPayload,
  RestoreProgressPayload,
  BulkOperationProgressPayload,
  ReportStatusPayload,
} from './dto';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);

  constructor(
    @Inject(forwardRef(() => UnifiedWebSocketGateway))
    private readonly gateway: UnifiedWebSocketGateway,
  ) {}

  // ============ User Notification Methods ============

  /**
   * Send notification to a specific user
   */
  sendNotificationToUser(userId: string, notification: NotificationPayload): void {
    const room = RoomPatterns.USER(userId);
    this.gateway.emitToRoom(room, WebSocketEvent.NOTIFICATION, notification);
    this.logger.debug(`Sent notification to user ${userId}`);
  }

  /**
   * Send unread count update to a user
   */
  sendUnreadCount(userId: string, count: number): void {
    const room = RoomPatterns.USER(userId);
    const payload: UnreadCountPayload = { count };
    this.gateway.emitToRoom(room, WebSocketEvent.UNREAD_COUNT, payload);
  }

  /**
   * Send to a specific user room
   */
  sendToUser(userId: string, event: string, data: any): void {
    const room = RoomPatterns.USER(userId);
    this.gateway.emitToRoom(room, event, data);
  }

  /**
   * Send to multiple users
   */
  sendToUsers(userIds: string[], event: string, data: any): void {
    for (const userId of userIds) {
      this.sendToUser(userId, event, data);
    }
  }

  // ============ Role-Based Methods ============

  /**
   * Send to all users with a specific role
   */
  sendToRole(role: Role, event: string, data: any): void {
    const room = RoomPatterns.ROLE(role);
    this.gateway.emitToRoom(room, event, data);
    this.logger.debug(`Sent '${event}' to role ${role}`);
  }

  /**
   * Send to multiple roles
   */
  sendToRoles(roles: Role[], event: string, data: any): void {
    for (const role of roles) {
      this.sendToRole(role, event, data);
    }
  }

  // ============ Institution Methods ============

  /**
   * Send to all users in an institution
   */
  sendToInstitution(institutionId: string, event: string, data: any): void {
    const room = RoomPatterns.INSTITUTION(institutionId);
    this.gateway.emitToRoom(room, event, data);
    this.logger.debug(`Sent '${event}' to institution ${institutionId}`);
  }

  // ============ Admin Channel Methods ============

  /**
   * Send to a specific admin channel
   */
  sendToAdminChannel(channel: AdminChannel, event: string, data: any): void {
    this.gateway.emitToRoom(channel, event, data);
    this.logger.debug(`Sent '${event}' to admin channel ${channel}`);
  }

  /**
   * Send quick metrics to admin metrics channel
   */
  sendQuickMetrics(metrics: QuickMetricsPayload): void {
    this.sendToAdminChannel(AdminChannel.METRICS, WebSocketEvent.QUICK_METRICS, metrics);
  }

  /**
   * Send full metrics update to admin metrics channel
   */
  sendMetricsUpdate(data: MetricsUpdatePayload): void {
    this.sendToAdminChannel(AdminChannel.METRICS, WebSocketEvent.METRICS_UPDATE, data);
  }

  /**
   * Send session update to admin sessions channel
   */
  sendSessionUpdate(data: SessionUpdatePayload): void {
    this.sendToAdminChannel(AdminChannel.SESSIONS, WebSocketEvent.SESSION_UPDATE, data);
  }

  /**
   * Send service alert to admin metrics channel
   */
  sendServiceAlert(alert: ServiceAlertPayload): void {
    this.sendToAdminChannel(AdminChannel.METRICS, WebSocketEvent.SERVICE_ALERT, alert);
  }

  /**
   * Send initial data to admin (used when admin first connects)
   */
  sendInitialAdminData(userId: string, data: any): void {
    this.sendToUser(userId, WebSocketEvent.INITIAL_DATA, data);
  }

  /**
   * Send backup progress update
   */
  sendBackupProgress(data: Omit<BackupProgressPayload, 'timestamp'>): void {
    const payload: BackupProgressPayload = {
      ...data,
      timestamp: new Date(),
    };
    this.sendToAdminChannel(AdminChannel.BACKUP, WebSocketEvent.BACKUP_PROGRESS, payload);
    this.logger.debug(`Sent backup progress: ${data.status} - ${data.progress}%`);
  }

  /**
   * Send restore progress update
   */
  sendRestoreProgress(data: Omit<RestoreProgressPayload, 'timestamp'>): void {
    const payload: RestoreProgressPayload = {
      ...data,
      timestamp: new Date(),
    };
    this.sendToAdminChannel(AdminChannel.BACKUP, WebSocketEvent.RESTORE_PROGRESS, payload);
    this.logger.debug(`Sent restore progress: ${data.stage} - ${data.progress}%`);
  }

  /**
   * Send bulk operation progress
   */
  sendBulkOperationProgress(data: Omit<BulkOperationProgressPayload, 'timestamp'>): void {
    const payload: BulkOperationProgressPayload = {
      ...data,
      timestamp: new Date(),
    };
    this.sendToAdminChannel(AdminChannel.USERS, WebSocketEvent.BULK_OPERATION_PROGRESS, payload);
    this.logger.debug(`Sent bulk operation progress: ${data.completed}/${data.total}`);
  }

  // ============ Report Status Methods ============

  /**
   * Send report generation status update to a specific user
   */
  sendReportStatus(userId: string, data: Omit<ReportStatusPayload, 'timestamp'>): void {
    const payload: ReportStatusPayload = {
      ...data,
      timestamp: new Date(),
    };
    this.sendToUser(userId, WebSocketEvent.REPORT_STATUS, payload);
    this.logger.debug(`Sent report status to user ${userId}: ${data.reportId} - ${data.status}`);
  }

  // ============ Broadcast Methods ============

  /**
   * Broadcast to all connected clients
   */
  broadcast(event: string, data: any): void {
    this.gateway.getServer().emit(event, data);
    this.logger.debug(`Broadcast '${event}' to all clients`);
  }

  // ============ Connection Status Methods ============

  /**
   * Check if a user is currently connected
   */
  isUserConnected(userId: string): boolean {
    return this.gateway.isUserConnected(userId);
  }

  /**
   * Get count of connected users
   */
  getConnectedUsersCount(): number {
    return this.gateway.getConnectedUsersCount();
  }

  /**
   * Get total socket connections count
   */
  getTotalSocketsCount(): number {
    return this.gateway.getTotalSocketsCount();
  }

  /**
   * Get admin subscribers count
   */
  getAdminSubscribersCount(): number {
    return this.gateway.getAdminSubscribersCount();
  }

  /**
   * Get subscribers in a specific room
   */
  getSubscribersInRoom(room: string) {
    return this.gateway.getSubscribersInRoom(room);
  }
}
