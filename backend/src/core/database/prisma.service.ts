import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private static pool: Pool;

  constructor() {
    // Create pool lazily on first instantiation
    if (!PrismaService.pool) {
      PrismaService.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });
    }

    const adapter = new PrismaPg(PrismaService.pool);

    super({
      adapter,
      log: ['error', 'warn'],
    } as any);
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (PrismaService.pool) {
      await PrismaService.pool.end();
      this.logger.log('Database connection pool closed');
    }
  }

  /**
   * Connect to database with retry logic
   */
  private async connectWithRetry(attempt = 1): Promise<void> {
    try {
      await this.$connect();

      // Parse DATABASE_URL to extract connection details
      const dbUrl = process.env.DATABASE_URL || '';
      const dbInfo = this.parseDatabaseUrl(dbUrl);

      this.logger.log('========================================');
      this.logger.log('✓ Database connection established');
      this.logger.log(`  Host: ${dbInfo.host}`);
      this.logger.log(`  Port: ${dbInfo.port}`);
      this.logger.log(`  Database: ${dbInfo.database}`);
      this.logger.log(`  User: ${dbInfo.user}`);
      this.logger.log('========================================');
    } catch (error) {
      this.logger.error(
        `Failed to connect to database (attempt ${attempt}/${this.maxRetries}): ${error.message}`,
      );

      if (attempt < this.maxRetries) {
        this.logger.log(`Retrying in ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay * attempt);
        return this.connectWithRetry(attempt + 1);
      }

      throw new Error(
        `Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`,
      );
    }
  }

  /**
   * Helper to create a delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parse DATABASE_URL to extract connection details
   */
  private parseDatabaseUrl(url: string): { host: string; port: string; database: string; user: string } {
    try {
      // Format: postgresql://user:password@host:port/database?schema=public
      const regex = /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
      const match = url.match(regex);

      if (match) {
        return {
          user: match[1],
          host: match[3],
          port: match[4],
          database: match[5],
        };
      }
    } catch {
      // Ignore parsing errors
    }

    return { host: 'unknown', port: 'unknown', database: 'unknown', user: 'unknown' };
  }

  /**
   * Health check for database connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats() {
    if (!PrismaService.pool) return null;
    return {
      totalCount: PrismaService.pool.totalCount,
      idleCount: PrismaService.pool.idleCount,
      waitingCount: PrismaService.pool.waitingCount,
    };
  }

  /**
   * Execute a transaction with automatic retry on transient errors
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const isRetryable =
          error.code === 'P2024' ||
          error.code === 'P2028' ||
          error.message?.includes('connection') ||
          error.message?.includes('timeout');

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Database operation failed (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying...`,
        );
        await this.delay(this.retryDelay * attempt);
      }
    }

    throw lastError;
  }
}
