import { Role } from '../../../generated/prisma/client';

/**
 * WebSocket event names used across the application
 */
export enum WebSocketEvent {
  // Connection events
  CONNECTED = 'connected',
  ERROR = 'error',

  // Notification events
  NOTIFICATION = 'notification',
  UNREAD_COUNT = 'unreadCount',
  MARK_AS_READ = 'markAsRead',
  MARK_AS_READ_ACK = 'markAsReadAck',

  // Admin Metrics events
  QUICK_METRICS = 'quickMetrics',
  METRICS_UPDATE = 'metricsUpdate',
  SESSION_UPDATE = 'sessionUpdate',
  SERVICE_ALERT = 'serviceAlert',
  INITIAL_DATA = 'initialData',

  // Admin Operations events
  BACKUP_PROGRESS = 'backupProgress',
  RESTORE_PROGRESS = 'restoreProgress',
  BULK_OPERATION_PROGRESS = 'bulkOperationProgress',
  USER_ACTIVITY = 'userActivity',

  // Report generation events
  REPORT_STATUS = 'reportStatus',
}

/**
 * Admin-specific channels/rooms
 */
export enum AdminChannel {
  METRICS = 'admin:metrics',
  SESSIONS = 'admin:sessions',
  BACKUP = 'admin:backup',
  USERS = 'admin:users',
}

/**
 * Room patterns for different channel types
 */
export const RoomPatterns = {
  USER: (userId: string) => `user:${userId}`,
  ROLE: (role: Role) => `role:${role}`,
  INSTITUTION: (institutionId: string) => `institution:${institutionId}`,
  ADMIN: (channel: AdminChannel) => channel,
} as const;

/**
 * Roles allowed to access admin channels
 */
export const AdminRoles: Role[] = [Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE];

/**
 * Notification payload structure
 */
export interface NotificationPayload {
  id: string;
  title: string;
  body: string;
  type: string | null;
  data: any;
  read: boolean;
  createdAt: Date;
}

/**
 * Unread count payload
 */
export interface UnreadCountPayload {
  count: number;
}

/**
 * Mark as read payload
 */
export interface MarkAsReadPayload {
  notificationId: string;
}

/**
 * Quick metrics payload (lightweight, frequent updates)
 */
export interface QuickMetricsPayload {
  cpu: number;
  memory: number;
  uptime: number;
  timestamp: Date;
}

/**
 * Full metrics update payload
 */
export interface MetricsUpdatePayload {
  health: any;
  metrics: any;
  timestamp: Date;
}

/**
 * Session update payload
 */
export interface SessionUpdatePayload {
  stats: any;
  action?: 'terminated' | 'created' | 'updated';
  timestamp: Date;
}

/**
 * Service alert payload
 */
export interface ServiceAlertPayload {
  service: string;
  status: 'up' | 'down';
  details?: Record<string, any>;
  timestamp: Date;
}

/**
 * Backup progress payload
 */
export interface BackupProgressPayload {
  backupId: string;
  status: 'in_progress' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  timestamp: Date;
}

/**
 * Restore progress payload
 */
export interface RestoreProgressPayload {
  backupId: string;
  status: 'in_progress' | 'completed' | 'failed';
  stage: 'initializing' | 'downloading' | 'restoring' | 'finalizing' | 'done';
  progress?: number;
  message?: string;
  timestamp: Date;
}

/**
 * Bulk operation progress payload
 */
export interface BulkOperationProgressPayload {
  operationId: string;
  type: string;
  progress: number;
  total: number;
  completed: number;
  timestamp: Date;
}

/**
 * Connected user data stored in socket
 */
export interface SocketUserData {
  userId: string;
  email?: string;
  role: Role;
  institutionId?: string;
}

/**
 * Subscriber tracking
 */
export interface WebSocketSubscriber {
  socketId: string;
  userId: string;
  role: Role;
  institutionId?: string;
  connectedAt: Date;
  lastActivity?: Date;
}

/**
 * Auth refresh payload
 */
export interface AuthRefreshPayload {
  token: string;
}

/**
 * Auth refreshed response
 */
export interface AuthRefreshedPayload {
  success: boolean;
  userId: string;
  role: Role;
  rooms: string[];
}

/**
 * Heartbeat acknowledgment payload
 */
export interface HeartbeatAckPayload {
  timestamp: Date;
  userId: string;
}

/**
 * WebSocket error payload
 */
export interface WebSocketErrorPayload {
  message: string;
  code?: 'AUTH_INVALID' | 'AUTH_EXPIRED' | 'AUTH_FAILED' | 'RATE_LIMIT' | 'NOT_AUTHORIZED';
}

/**
 * Report status payload for real-time report generation updates
 */
export interface ReportStatusPayload {
  reportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reportType?: string;
  reportName?: string;
  format?: string;
  progress?: number;
  totalRecords?: number;
  fileUrl?: string;
  errorMessage?: string;
  generatedAt?: Date;
  timestamp: Date;
}
