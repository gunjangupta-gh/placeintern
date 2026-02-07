import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';

export interface CreateBatchDto {
  name: string;
  isActive?: boolean;
}

export interface UpdateBatchDto extends Partial<CreateBatchDto> {}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private readonly CACHE_TTL = 600; // 10 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async createBatch(institutionId: string, data: CreateBatchDto) {
    try {
      this.logger.log(`Creating batch for institution ${institutionId}`);

      const institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
      });

      if (!institution) {
        throw new NotFoundException('Institution not found');
      }

      // Check for duplicate batch name
      const existingBatch = await this.prisma.batch.findFirst({
        where: {
          institutionId,
          name: data.name,
        },
      });

      if (existingBatch) {
        throw new BadRequestException('Batch with this name and year already exists');
      }

      const batch = await this.prisma.batch.create({
        data: {
          institutionId,
          name: data.name,
          isActive: data.isActive !== undefined ? data.isActive : true,
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`batches:institution:${institutionId}`);

      return batch;
    } catch (error) {
      this.logger.error(`Failed to create batch: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getBatchesByInstitution(institutionId: string) {
    try {
      const cacheKey = `batches:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.batch.findMany({
            where: { institutionId },
            include: {
              Institution: true,
              _count: {
                select: {
                  students: true,
                },
              },
            },
            orderBy: [
              { name: 'asc' },
            ],
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get batches for institution ${institutionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateBatch(id: string, data: UpdateBatchDto) {
    try {
      this.logger.log(`Updating batch ${id}`);

      const batch = await this.prisma.batch.findUnique({
        where: { id },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      const updated = await this.prisma.batch.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        },
        include: {
          Institution: true,
        },
      });

      // Invalidate cache
      await this.cache.del(`batches:institution:${batch.institutionId}`);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update batch: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteBatch(id: string) {
    try {
      this.logger.log(`Deleting batch ${id}`);

      const batch = await this.prisma.batch.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              students: true,
            },
          },
        },
      });

      if (!batch) {
        throw new NotFoundException('Batch not found');
      }

      if (batch._count.students > 0) {
        throw new BadRequestException('Cannot delete batch with assigned students');
      }

      await this.prisma.batch.delete({
        where: { id },
      });

      // Invalidate cache
      await this.cache.del(`batches:institution:${batch.institutionId}`);

      return { success: true, message: 'Batch deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete batch: ${error.message}`, error.stack);
      throw error;
    }
  }
}
