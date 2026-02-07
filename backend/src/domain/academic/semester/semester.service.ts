import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateSemesterDto {
  name: string;
  number: number;
  startDate: Date;
  endDate: Date;
  isActive?: boolean;
}

@Injectable()
export class SemesterService {
  private readonly logger = new Logger(SemesterService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSemesters() {
    // Semester feature removed from schema
    return [];
  }

  async createSemester(data: CreateSemesterDto) {
    throw new BadRequestException('Semester feature has been removed');
  }

  async getActiveSemester() {
    return null;
  }
}
