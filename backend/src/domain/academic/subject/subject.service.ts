import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateSubjectDto {
  subjectName: string;
  subjectCode: string;
  syllabusYear: number;
  semesterNumber?: string;
  branchName?: string;
  maxMarks: number;
  subjectType: string;
}

@Injectable()
export class SubjectService {
  private readonly logger = new Logger(SubjectService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async getSubjectsByBranch(branchId: string) {
    return [];
  }

  async createSubject(data: CreateSubjectDto & { branchId: string }) {
    throw new BadRequestException('Subject feature has been removed');
  }

  async getSubjectsBySemester(semesterId: string) {
    return [];
  }
}
