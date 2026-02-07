import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  private readonly redisHealthClient: Redis;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const redisHost = this.configService.get('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get('REDIS_PORT', 6379);
    const redisPassword = this.configService.get('REDIS_PASSWORD');

    this.redisHealthClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      connectTimeout: 1000,
      commandTimeout: 1000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
    });
  }

  private async prismaPing(): Promise<HealthIndicatorResult> {
    try {
      // PostgreSQL health check
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' as const } };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        database: { status: 'down' as const },
      });
    }
  }

  private async redisPing(): Promise<HealthIndicatorResult> {
    try {
      if (this.redisHealthClient.status === 'end') {
        await this.redisHealthClient.connect();
      }
      const result = await this.redisHealthClient.ping();
      if (result !== 'PONG') {
        throw new Error('Redis ping failed');
      }
      return { redis: { status: 'up' as const } };
    } catch (error) {
      throw new HealthCheckError('Redis check failed', {
        redis: { status: 'down' as const },
      });
    }
  }

  /**
   * Basic health check
   */
  @Get()
  @HealthCheck()
  async check() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Database health check
   */
  @Get('db')
  @HealthCheck()
  async checkDatabase() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Redis health check
   */
  @Get('redis')
  @HealthCheck()
  async checkRedis() {
    return this.health.check([
      () => this.redisPing(),
    ]);
  }

  /**
   * Detailed health check including memory, disk, database, and Redis
   */
  @Get('detailed')
  @HealthCheck()
  async checkDetailed() {
    return this.health.check([
      // Database check
      () => this.prismaPing(),

      // Memory heap check (should not exceed 400MB - aligned with 600MB max heap)
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),

      // Memory RSS check (should not exceed 500MB - aligned with 600MB max heap)
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Disk storage check (should have at least 50% free space)
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.5,
        }),

      // Redis check
      () => this.redisPing(),
    ]);
  }

  /**
   * Memory health check
   */
  @Get('memory')
  @HealthCheck()
  async checkMemory() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
    ]);
  }

  /**
   * Disk health check
   */
  @Get('disk')
  @HealthCheck()
  async checkDisk() {
    return this.health.check([
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.5,
        }),
    ]);
  }

  /**
   * Readiness probe (for Kubernetes)
   */
  @Get('ready')
  @HealthCheck()
  async checkReadiness() {
    return this.health.check([
      () => this.prismaPing(),
    ]);
  }

  /**
   * Liveness probe (for Kubernetes)
   */
  @Get('live')
  @HealthCheck()
  async checkLiveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 500 * 1024 * 1024),
    ]);
  }
}
