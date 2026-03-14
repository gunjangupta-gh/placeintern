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

  async getTrainings(filters: TrainingFilterDto, userId: string) {
    // Don't pass branchIds - let TrainingService resolve branch from userId to avoid conflicts
    // TrainingService will automatically filter by user's branch using getUserBranchId()
    return this.trainingService.findAll(
      filters,
      false,
      userId,
    );
  }

  async getCalendar(filters: CalendarFilterDto, userId: string) {
    // Don't pass branchIds - let TrainingService resolve branch from userId to avoid conflicts
    return this.trainingService.getCalendar(
      filters,
      userId,
    );
  }

  async getUpcoming(limit: number, userId: string) {
    // Don't pass branchIds - let TrainingService resolve branch from userId to avoid conflicts
    return this.trainingService.getUpcoming(limit, undefined, userId);
  }

  async getMyTrainings(userId: string) {
    // getUserTrainings returns trainings where user has applied
    // We don't need additional filtering here as the applications are already created,
    // and the user should be able to see trainings they've applied to
    return this.trainingService.getUserTrainings(userId);
  }

  async getTraining(id: string, userId: string) {
    return this.trainingService.findOne(id, userId);
  }

  async checkEligibility(trainingId: string, userId: string) {
    return this.trainingService.checkUserEligibility(trainingId, userId);
  }
}
