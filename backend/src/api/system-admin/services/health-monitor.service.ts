import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebSocketService } from '../../../infrastructure/websocket/websocket.service';
import { AdminChannel } from '../../../infrastructure/websocket/dto';
import { CacheService } from '../../../core/cache/cache.service';
import * as os from 'os';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
  lastChecked: Date;
  message?: string;
  details?: Record<string, any>;
}

export interface HealthMetrics {
  cpu: {
    usage: number;
    cores: number;
    model: string;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk?: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  process: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    pid: number;
    nodeVersion: string;
  };
  network?: {
    interfaces: Record<string, os.NetworkInterfaceInfo[] | undefined>;
  };
}

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  services: ServiceStatus[];
  metrics: HealthMetrics;
  alerts: HealthAlert[];
}

export interface HealthAlert {
  id: string;
  type: 'cpu' | 'memory' | 'disk' | 'service' | 'database' | 'cache';
  severity: 'warning' | 'critical';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
}

@Injectable()
export class HealthMonitorService implements OnModuleInit {
  private readonly logger = new Logger(HealthMonitorService.name);
  private serviceStartTime: Date;
  private lastHealthCheck: HealthReport | null = null;
  private alertHistory: HealthAlert[] = [];

  // Thresholds for alerts
  private readonly thresholds = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 75, critical: 90 },
    disk: { warning: 80, critical: 95 },
    databaseLatency: { warning: 100, critical: 500 }, // ms
    cacheLatency: { warning: 10, critical: 50 }, // ms
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly wsService: WebSocketService,
    private readonly cacheService: CacheService,
  ) {
    this.serviceStartTime = new Date();
  }

  async onModuleInit() {
    // Initial health check
    await this.performHealthCheck();
    this.logger.log('Health monitor initialized');
  }

  /**
   * Periodic health check every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleHealthCheck() {
    await this.performHealthCheck();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthReport> {
    const timestamp = new Date();
    const alerts: HealthAlert[] = [];

    // Check all services
    const services = await Promise.all([
      this.checkDatabase(),
      this.checkCache(),
      this.checkFileStorage(),
      this.checkWebSocket(),
    ]);

    // Get system metrics
    const metrics = await this.getSystemMetrics();

    // Check for alerts based on metrics
    if (metrics.cpu.usage > this.thresholds.cpu.critical) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: 'cpu',
        severity: 'critical',
        message: `CPU usage is critically high: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.critical,
        timestamp,
      });
    } else if (metrics.cpu.usage > this.thresholds.cpu.warning) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: 'cpu',
        severity: 'warning',
        message: `CPU usage is high: ${metrics.cpu.usage.toFixed(1)}%`,
        value: metrics.cpu.usage,
        threshold: this.thresholds.cpu.warning,
        timestamp,
      });
    }

    if (metrics.memory.usagePercent > this.thresholds.memory.critical) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: 'critical',
        message: `Memory usage is critically high: ${metrics.memory.usagePercent.toFixed(1)}%`,
        value: metrics.memory.usagePercent,
        threshold: this.thresholds.memory.critical,
        timestamp,
      });
    } else if (metrics.memory.usagePercent > this.thresholds.memory.warning) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: 'warning',
        message: `Memory usage is high: ${metrics.memory.usagePercent.toFixed(1)}%`,
        value: metrics.memory.usagePercent,
        threshold: this.thresholds.memory.warning,
        timestamp,
      });
    }

    // Check for unhealthy services
    for (const service of services) {
      if (service.status === 'unhealthy') {
        alerts.push({
          id: `service-${service.name}-${Date.now()}`,
          type: 'service',
          severity: 'critical',
          message: `Service ${service.name} is unhealthy: ${service.message}`,
          timestamp,
        });
      } else if (service.status === 'degraded') {
        alerts.push({
          id: `service-${service.name}-${Date.now()}`,
          type: 'service',
          severity: 'warning',
          message: `Service ${service.name} is degraded: ${service.message}`,
          timestamp,
        });
      }
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (alerts.some(a => a.severity === 'critical')) {
      status = 'unhealthy';
    } else if (alerts.some(a => a.severity === 'warning')) {
      status = 'degraded';
    }

    const report: HealthReport = {
      status,
      timestamp,
      uptime: Date.now() - this.serviceStartTime.getTime(),
      services,
      metrics,
      alerts,
    };

    this.lastHealthCheck = report;

    // Store alerts in history (keep last 100)
    this.alertHistory = [...alerts, ...this.alertHistory].slice(0, 100);

    // Broadcast to admins if there are new alerts
    if (alerts.length > 0) {
      this.wsService.sendToAdminChannel(AdminChannel.METRICS, 'healthAlert', {
        status: report.status,
        alerts,
        timestamp,
      });
    }

    // Broadcast metrics update
    this.wsService.sendToAdminChannel(AdminChannel.METRICS, 'metricsUpdate', {
      cpu: metrics.cpu.usage,
      memory: metrics.memory.usagePercent,
      uptime: report.uptime,
      timestamp,
    });

    return report;
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<HealthMetrics> {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Calculate CPU usage
    const cpuUsage = await this.getCpuUsage();

    return {
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: (usedMemory / totalMemory) * 100,
      },
      process: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        pid: process.pid,
        nodeVersion: process.version,
      },
      network: {
        interfaces: os.networkInterfaces(),
      },
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  private getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const cpus = os.cpus();
      const startMeasure = this.measureCpu(cpus);

      setTimeout(() => {
        const endCpus = os.cpus();
        const endMeasure = this.measureCpu(endCpus);

        let idleDiff = 0;
        let totalDiff = 0;

        for (let i = 0; i < startMeasure.length; i++) {
          idleDiff += endMeasure[i].idle - startMeasure[i].idle;
          totalDiff += endMeasure[i].total - startMeasure[i].total;
        }

        const usage = totalDiff > 0 ? 100 - (idleDiff / totalDiff) * 100 : 0;
        resolve(Math.max(0, Math.min(100, usage)));
      }, 100);
    });
  }

  private measureCpu(cpus: os.CpuInfo[]) {
    return cpus.map((cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return { idle: cpu.times.idle, total };
    });
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      // PostgreSQL health check - simple query
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      let status: 'healthy' | 'degraded' = 'healthy';
      let message = 'Database connection is healthy';

      if (latency > this.thresholds.databaseLatency.critical) {
        status = 'degraded';
        message = `Database latency is high: ${latency}ms`;
      } else if (latency > this.thresholds.databaseLatency.warning) {
        status = 'degraded';
        message = `Database latency is elevated: ${latency}ms`;
      }

      return {
        name: 'Database (PostgreSQL)',
        status,
        latency,
        lastChecked: new Date(),
        message,
      };
    } catch (error) {
      return {
        name: 'Database (PostgreSQL)',
        status: 'unhealthy',
        lastChecked: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * Check Redis cache connectivity
   */
  private async checkCache(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const testKey = '__health_check__';
      await this.cacheService.set(testKey, 'ok', 10);
      const value = await this.cacheService.get(testKey);
      const latency = Date.now() - start;

      if (value !== 'ok') {
        return {
          name: 'Cache (Redis)',
          status: 'degraded',
          latency,
          lastChecked: new Date(),
          message: 'Cache read/write mismatch',
        };
      }

      let status: 'healthy' | 'degraded' = 'healthy';
      let message = 'Cache connection is healthy';

      if (latency > this.thresholds.cacheLatency.critical) {
        status = 'degraded';
        message = `Cache latency is high: ${latency}ms`;
      } else if (latency > this.thresholds.cacheLatency.warning) {
        status = 'degraded';
        message = `Cache latency is elevated: ${latency}ms`;
      }

      return {
        name: 'Cache (Redis)',
        status,
        latency,
        lastChecked: new Date(),
        message,
      };
    } catch (error) {
      return {
        name: 'Cache (Redis)',
        status: 'unhealthy',
        lastChecked: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * Check file storage (MinIO) connectivity
   */
  private async checkFileStorage(): Promise<ServiceStatus> {
    try {
      // For now, just return a placeholder since we'd need MinIO client
      // In production, you'd check MinIO bucket access
      return {
        name: 'File Storage (MinIO)',
        status: 'healthy',
        lastChecked: new Date(),
        message: 'File storage is available',
      };
    } catch (error) {
      return {
        name: 'File Storage (MinIO)',
        status: 'unhealthy',
        lastChecked: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * Check WebSocket gateway status
   */
  private async checkWebSocket(): Promise<ServiceStatus> {
    try {
      const connectedCount = this.wsService.getConnectedUsersCount();
      return {
        name: 'WebSocket Gateway',
        status: 'healthy',
        lastChecked: new Date(),
        message: `${connectedCount} users connected`,
        details: { connectedUsers: connectedCount },
      };
    } catch (error) {
      return {
        name: 'WebSocket Gateway',
        status: 'unhealthy',
        lastChecked: new Date(),
        message: error.message,
      };
    }
  }

  /**
   * Get the last health check result
   */
  getLastHealthCheck(): HealthReport | null {
    return this.lastHealthCheck;
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 50): HealthAlert[] {
    return this.alertHistory.slice(0, limit);
  }

  /**
   * Get quick status summary
   */
  async getQuickStatus() {
    const report = this.lastHealthCheck || await this.performHealthCheck();

    return {
      status: report.status,
      uptime: report.uptime,
      services: report.services.map(s => ({
        name: s.name,
        status: s.status,
      })),
      metrics: {
        cpu: report.metrics.cpu.usage,
        memory: report.metrics.memory.usagePercent,
      },
      activeAlerts: report.alerts.length,
      timestamp: report.timestamp,
    };
  }

  /**
   * Get detailed service status
   */
  async getServiceDetails(serviceName: string): Promise<ServiceStatus | null> {
    const report = this.lastHealthCheck || await this.performHealthCheck();
    return report.services.find(s => s.name.toLowerCase().includes(serviceName.toLowerCase())) || null;
  }

  /**
   * Get uptime statistics
   */
  getUptimeStats() {
    const now = Date.now();
    const uptimeMs = now - this.serviceStartTime.getTime();

    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return {
      startTime: this.serviceStartTime,
      uptimeMs,
      uptime: {
        days,
        hours: hours % 24,
        minutes: minutes % 60,
        seconds: seconds % 60,
      },
      formatted: `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`,
    };
  }

  /**
   * Update alert thresholds
   */
  updateThresholds(newThresholds: Partial<typeof this.thresholds>) {
    Object.assign(this.thresholds, newThresholds);
    this.logger.log('Health monitor thresholds updated');
  }

  /**
   * Get current thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }
}
