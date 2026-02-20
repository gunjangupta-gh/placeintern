import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TrainingService } from './training.service';
import { CalendarFilterDto, TrainingFilterDto } from './dto';

@Injectable()
export class FacultyTrainingService {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly prisma: PrismaService,
  ) {}

  private async getFacultyBranchId(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { branchId: true, branchName: true },
    });

    if (!user) {
      return null;
    }

    if (user.branchId) {
      return user.branchId;
    }

    const normalizedBranchName = user.branchName?.trim();
    if (!normalizedBranchName) {
      return null;
    }

    const matchedBranch = await this.prisma.branch.findFirst({
      where: {
        OR: [
          { code: { equals: normalizedBranchName, mode: 'insensitive' } },
          { shortName: { equals: normalizedBranchName, mode: 'insensitive' } },
          { name: { equals: normalizedBranchName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    return matchedBranch?.id || null;
  }

  async getTrainings(filters: TrainingFilterDto, userId: string) {
    const branchId = await this.getFacultyBranchId(userId);

    if (!branchId) {
      return {
        data: [],
        pagination: {
          page: filters?.page || 1,
          limit: filters?.limit || 20,
          total: 0,
          totalPages: 0,
        },
      };
    }

    return this.trainingService.findAll(
      { ...filters, branchIds: [branchId] },
      false,
      userId,
    );
  }

  async getCalendar(filters: CalendarFilterDto, userId: string) {
    const branchId = await this.getFacultyBranchId(userId);

    if (!branchId) {
      return {
        year: filters?.year || new Date().getFullYear(),
        month: filters?.month,
        trainings: [],
      };
    }

    return this.trainingService.getCalendar(
      { ...filters, branchIds: [branchId] },
      userId,
    );
  }

  async getUpcoming(limit: number, userId: string) {
    const branchId = await this.getFacultyBranchId(userId);

    if (!branchId) {
      return [];
    }

    return this.trainingService.getUpcoming(limit, [branchId], userId);
  }

  async getMyTrainings(userId: string) {
    const trainings = await this.trainingService.getUserTrainings(userId);
    const branchId = await this.getFacultyBranchId(userId);

    if (!branchId) {
      return trainings;
    }

    return trainings.filter((item) => {
      const branches = item.training?.targetBranches || [];
      if (branches.length === 0) {
        return true;
      }
      return branches.some((branch) => branch.id === branchId);
    });
  }

  async getTraining(id: string, userId: string) {
    return this.trainingService.findOne(id, userId);
  }

  async checkEligibility(trainingId: string, userId: string) {
    return this.trainingService.checkUserEligibility(trainingId, userId);
  }
}
