import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

/**
 * Audit Retention Service
 * Audit logs are retained permanently: there is no cron job and no deletion path.
 * This service only reports on what is stored.
 */
@Injectable()
export class AuditRetentionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get storage statistics
   */
  async getRetentionStats(): Promise<{
    totalLogs: number;
    oldestLogDate: Date | null;
    newestLogDate: Date | null;
    retention: 'permanent';
  }> {
    const [totalLogs, oldest, newest] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true },
      }),
      this.prisma.auditLog.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      }),
    ]);

    return {
      totalLogs,
      oldestLogDate: oldest?.timestamp || null,
      newestLogDate: newest?.timestamp || null,
      retention: 'permanent',
    };
  }
}
