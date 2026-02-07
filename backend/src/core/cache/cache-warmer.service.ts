import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { LruCacheService } from './lru-cache.service';
import { LookupService } from '../../api/shared/lookup.service';

@Injectable()
export class CacheWarmerService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmerService.name);
  private isWarming = false;

  constructor(
    private prisma: PrismaService,
    private cache: LruCacheService,
    @Inject(forwardRef(() => LookupService))
    private lookupService: LookupService,
  ) {}

  async onModuleInit() {
    // Warm cache 5 seconds after startup
    setTimeout(() => this.warmAll(), 5000);
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledWarm() {
    await this.warmAll();
  }

  async warmAll(): Promise<void> {
    if (this.isWarming) {
      this.logger.warn('Cache warming already in progress, skipping');
      return;
    }

    this.isWarming = true;
    this.logger.log('Starting cache warming...');
    const start = Date.now();

    try {
      await Promise.allSettled([
        this.warmInstitutions(),
        this.warmBatches(),
        this.warmDepartments(),
        this.warmDashboardStats(),
        this.warmActiveStudentCounts(),
      ]);

      this.logger.log(`Cache warming completed in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.error('Cache warming failed', error);
    } finally {
      this.isWarming = false;
    }
  }

  private async warmInstitutions(): Promise<void> {
    // Use LookupService which handles caching internally
    const result = await this.lookupService.getInstitutions();
    this.logger.debug(`Warmed ${result.total} institutions`);
  }

  private async warmBatches(): Promise<void> {
    // Use LookupService which handles caching internally
    const result = await this.lookupService.getBatches();
    this.logger.debug(`Warmed ${result.total} batches`);
  }

  private async warmDepartments(): Promise<void> {
    // Use LookupService which handles caching internally
    const result = await this.lookupService.getDepartments();
    this.logger.debug(`Warmed ${result.total} departments`);
  }

  private async warmDashboardStats(): Promise<void> {
    const [institutions, students] = await Promise.all([
      this.prisma.institution.count({ where: { isActive: true } }),
      this.prisma.student.count({ where: { user: { active: true } } }),
      // Industry and Internship models removed
    ]);

    await this.cache.set('stats:global', {
      totalInstitutions: institutions,
      totalStudents: students,
      // Industry and Internship models removed
      totalIndustries: 0,
      activeInternships: 0,
      updatedAt: new Date(),
    }, { ttl: 60000 }); // 1 min

    this.logger.debug('Warmed global dashboard stats');
  }

  private async warmActiveStudentCounts(): Promise<void> {
    const counts = await this.prisma.student.groupBy({
      by: ['institutionId'],
      where: { user: { active: true } },
      _count: true,
    });

    const countMap = counts.reduce((acc, curr) => {
      acc[curr.institutionId] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    await this.cache.set('stats:studentCounts', countMap, { ttl: 60000 });
    this.logger.debug(`Warmed student counts for ${counts.length} institutions`);
  }

  getStatus() {
    return {
      isWarming: this.isWarming,
      cacheMetrics: this.cache.getMetrics(),
    };
  }
}
