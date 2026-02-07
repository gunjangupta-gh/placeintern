import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateNoticeDto {
  title: string;
  message: string;
  institutionId?: string;
}

export interface UpdateNoticeDto extends Partial<CreateNoticeDto> {}

@Injectable()
export class NoticeService {
  private readonly logger = new Logger(NoticeService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createNotice(creatorId: string, data: CreateNoticeDto) {
    throw new NotFoundException('Notice feature has been removed');
  }

  async getNotices(institutionId?: string) {
    return [];
  }

  async updateNotice(id: string, data: UpdateNoticeDto) {
    throw new NotFoundException('Notice feature has been removed');
  }

  async deleteNotice(id: string) {
    throw new NotFoundException('Notice feature has been removed');
  }

  async getActiveNotices() {
    return [];
  }
}
