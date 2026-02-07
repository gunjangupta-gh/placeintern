import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { SessionService } from '../services/session.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { AdminChannel, WebSocketEvent } from '../../../infrastructure/websocket/dto';

/**
 * MetricsGateway - Uses unified WebSocketService for broadcasting
 * Handles periodic metrics broadcasting to admin users
 *
 * Note: This is no longer a WebSocketGateway - it's a service that uses
 * the centralized WebSocketService for all communications.
 */
@Injectable()
export class MetricsGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsGateway.name);
  private metricsInterval: NodeJS.Timeout | null = null;
  private healthInterval: NodeJS.Timeout | null = null;
  private sessionInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly sessionService: SessionService,
    private readonly wsService: WebSocketService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Metrics broadcasting service initialized');
    // Start broadcasting automatically
    this.startBroadcasting();
  }

  onModuleDestroy(): void {
    this.stopBroadcasting();
  }

  /**
   * Start broadcasting metrics to all admin subscribers
   */
  startBroadcasting(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logger.log('Starting metrics broadcast');

    // Quick metrics every 5 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const adminCount = this.wsService.getAdminSubscribersCount();
        if (adminCount === 0) return; // Skip if no admins connected

        const quickMetrics = await this.metricsService.getQuickMetrics();
        this.wsService.sendQuickMetrics({
          ...quickMetrics,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to broadcast quick metrics', error.message);
      }
    }, 5000);

    // Full health check every 15 seconds
    this.healthInterval = setInterval(async () => {
      try {
        const adminCount = this.wsService.getAdminSubscribersCount();
        if (adminCount === 0) return; // Skip if no admins connected

        const [health, metrics] = await Promise.all([
          this.metricsService.getDetailedHealth(),
          this.metricsService.getRealtimeMetrics(),
        ]);

        this.wsService.sendMetricsUpdate({
          health,
          metrics,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to broadcast full metrics', error.message);
      }
    }, 15000);

    // Session stats every 10 seconds
    this.sessionInterval = setInterval(async () => {
      try {
        const adminCount = this.wsService.getAdminSubscribersCount();
        if (adminCount === 0) return; // Skip if no admins connected

        const sessionStats = await this.sessionService.getSessionStats();
        this.wsService.sendSessionUpdate({
          stats: sessionStats,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error('Failed to broadcast session stats', error.message);
      }
    }, 10000);
  }

  /**
   * Stop broadcasting metrics
   */
  stopBroadcasting(): void {
    this.logger.log('Stopping metrics broadcast');
    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    if (this.sessionInterval) {
      clearInterval(this.sessionInterval);
      this.sessionInterval = null;
    }
  }

  /**
   * Broadcast service status change immediately
   */
  broadcastServiceAlert(service: string, status: 'up' | 'down', details?: Record<string, any>): void {
    this.wsService.sendServiceAlert({
      service,
      status,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast session change immediately (e.g., after termination)
   */
  async broadcastSessionChange(action: 'terminated' | 'created' | 'updated'): Promise<void> {
    try {
      const sessionStats = await this.sessionService.getSessionStats();
      this.wsService.sendSessionUpdate({
        stats: sessionStats,
        action,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to broadcast session change', error.message);
    }
  }

  /**
   * Send initial data to a specific admin user
   */
  async sendInitialDataToUser(userId: string): Promise<void> {
    try {
      const [health, metrics] = await Promise.all([
        this.metricsService.getDetailedHealth(),
        this.metricsService.getRealtimeMetrics(),
      ]);

      this.wsService.sendToUser(userId, WebSocketEvent.INITIAL_DATA, {
        health,
        metrics,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to send initial metrics data', error);
    }
  }

  /**
   * Force refresh metrics for all admins
   */
  async forceRefresh(): Promise<void> {
    try {
      const [health, metrics] = await Promise.all([
        this.metricsService.getDetailedHealth(),
        this.metricsService.getRealtimeMetrics(),
      ]);

      this.wsService.sendMetricsUpdate({
        health,
        metrics,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to force refresh metrics', error);
    }
  }

  /**
   * Get count of connected admin subscribers
   */
  getSubscribersCount(): number {
    return this.wsService.getAdminSubscribersCount();
  }

  /**
   * Check if broadcasting is active
   */
  isBroadcasting(): boolean {
    return this.isRunning;
  }
}
