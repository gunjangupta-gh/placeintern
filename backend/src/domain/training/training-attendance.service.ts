import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
import { MarkAttendanceDto, BulkMarkAttendanceDto, AttendanceFilterDto, MarkSelfAttendanceDto } from './dto';

@Injectable()
export class TrainingAttendanceService {
  private readonly logger = new Logger(TrainingAttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Mark own attendance (Faculty)
   */
  async markAttendance(trainingId: string, userId: string, dto: MarkAttendanceDto) {
    try {
      this.logger.log(`User ${userId} marking attendance for training ${trainingId}`);

      // Check if training exists
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      // Check if user has approved application
      const application = await this.prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId, trainingId } },
      });

      if (!application || application.status !== 'APPROVED') {
        throw new ForbiddenException('You must have an approved application to mark attendance');
      }

      // Check if training is currently running
      const now = new Date();
      const attendanceDate = dto.attendanceDate ? new Date(dto.attendanceDate) : now;
      const dateOnly = new Date(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate());

      const trainingStart = new Date(training.startDate.getFullYear(), training.startDate.getMonth(), training.startDate.getDate());
      const trainingEnd = new Date(training.endDate.getFullYear(), training.endDate.getMonth(), training.endDate.getDate());

      if (dateOnly < trainingStart || dateOnly > trainingEnd) {
        throw new BadRequestException('Attendance can only be marked during the training period');
      }

      // Check if already marked for this date
      const existing = await this.prisma.trainingAttendance.findFirst({
        where: {
          userId,
          trainingId,
          attendanceDate: {
            gte: dateOnly,
            lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Attendance already marked for this date');
      }

      const attendance = await this.prisma.trainingAttendance.create({
        data: {
          userId,
          trainingId,
          attendanceDate: dateOnly,
          markedAt: now,
          markedById: userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationAddress: dto.locationAddress,
          ipAddress: dto.ipAddress,
          userAgent: dto.userAgent,
        },
        include: {
          user: { select: { id: true, name: true } },
          training: { select: { id: true, title: true } },
        },
      });

      this.auditService.log({
        action: AuditAction.TRAINING_ATTENDANCE_MARK,
        entityType: 'TrainingAttendance',
        entityId: attendance.id,
        userId,
        category: AuditCategory.PROFILE_MANAGEMENT,
        severity: AuditSeverity.LOW,
        description: `Marked attendance for "${training.title}"`,
      }).catch(() => {});

      return attendance;
    } catch (error) {
      this.logger.error(`Failed to mark attendance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Bulk mark attendance (State)
   */
  async bulkMarkAttendance(trainingId: string, dto: BulkMarkAttendanceDto, markerId: string) {
    try {
      const { userIds, attendanceDate } = dto;

      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      const dateToMark = attendanceDate ? new Date(attendanceDate) : new Date();
      const dateOnly = new Date(dateToMark.getFullYear(), dateToMark.getMonth(), dateToMark.getDate());

      // Verify all users have approved applications
      const applications = await this.prisma.trainingApplication.findMany({
        where: {
          trainingId,
          userId: { in: userIds },
          status: 'APPROVED',
        },
      });

      const approvedUserIds = applications.map((a) => a.userId);
      const unapprovedUsers = userIds.filter((id) => !approvedUserIds.includes(id));

      if (unapprovedUsers.length > 0) {
        throw new BadRequestException(
          `${unapprovedUsers.length} users do not have approved applications`
        );
      }

      // Get existing attendance for this date
      const existingAttendance = await this.prisma.trainingAttendance.findMany({
        where: {
          trainingId,
          userId: { in: userIds },
          attendanceDate: {
            gte: dateOnly,
            lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      const alreadyMarkedUserIds = existingAttendance.map((a) => a.userId);
      const toMarkUserIds = userIds.filter((id) => !alreadyMarkedUserIds.includes(id));

      if (toMarkUserIds.length === 0) {
        return {
          success: true,
          message: 'All users already have attendance marked for this date',
          marked: 0,
          skipped: userIds.length,
        };
      }

      // Create attendance records
      await this.prisma.trainingAttendance.createMany({
        data: toMarkUserIds.map((userId) => ({
          userId,
          trainingId,
          attendanceDate: dateOnly,
          markedAt: new Date(),
          markedById: markerId,
        })),
      });

      return {
        success: true,
        message: `Attendance marked for ${toMarkUserIds.length} users`,
        marked: toMarkUserIds.length,
        skipped: alreadyMarkedUserIds.length,
      };
    } catch (error) {
      this.logger.error(`Failed to bulk mark attendance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get user's attendance history (Faculty)
   */
  async getMyAttendance(userId: string) {
    try {
      const attendance = await this.prisma.trainingAttendance.findMany({
        where: { userId },
        include: {
          training: {
            select: {
              id: true,
              title: true,
              startDate: true,
              endDate: true,
              deliveryMode: true,
            },
          },
        },
        orderBy: { attendanceDate: 'desc' },
      });

      // Group by training
      const byTraining = attendance.reduce((acc, att) => {
        const trainingId = att.trainingId;
        if (!acc[trainingId]) {
          acc[trainingId] = {
            training: att.training,
            attendance: [],
            totalDays: 0,
          };
        }
        acc[trainingId].attendance.push(att);
        acc[trainingId].totalDays++;
        return acc;
      }, {} as Record<string, any>);

      return {
        records: attendance,
        byTraining: Object.values(byTraining),
        totalAttendance: attendance.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get attendance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get attendance by training (State/Principal)
   */
  async getByTraining(trainingId: string, date?: Date, institutionId?: string) {
    try {
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      const where: Prisma.TrainingAttendanceWhereInput = {
        trainingId,
        ...(institutionId ? { user: { institutionId } } : {}),
      };

      if (date) {
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        where.attendanceDate = {
          gte: dateOnly,
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
        };
      }

      const [attendance, approvedApplications] = await Promise.all([
        this.prisma.trainingAttendance.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                branchName: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
            markedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ attendanceDate: 'desc' }, { markedAt: 'desc' }],
        }),
        this.prisma.trainingApplication.findMany({
          where: {
            trainingId,
            status: 'APPROVED',
            ...(institutionId ? { user: { institutionId } } : {}),
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
      ]);

      // Calculate training days
      const trainingDays = Math.ceil(
        (training.endDate.getTime() - training.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      // Get unique attendees
      const uniqueAttendees = [...new Set(attendance.map((a) => a.userId))];

      // Get attendance by user
      const attendanceByUser = approvedApplications.map((app) => {
        const userAttendance = attendance.filter((a) => a.userId === app.userId);
        return {
          user: app.user,
          attendanceCount: userAttendance.length,
          attendanceRate: (userAttendance.length / trainingDays) * 100,
          dates: userAttendance.map((a) => a.attendanceDate),
        };
      });

      return {
        training: {
          id: training.id,
          title: training.title,
          startDate: training.startDate,
          endDate: training.endDate,
          trainingDays,
        },
        summary: {
          totalApproved: approvedApplications.length,
          uniqueAttendees: uniqueAttendees.length,
          totalRecords: attendance.length,
          averageAttendanceRate: approvedApplications.length > 0
            ? (uniqueAttendees.length / approvedApplications.length) * 100
            : 0,
        },
        attendanceByUser,
        records: attendance,
      };
    } catch (error) {
      this.logger.error(`Failed to get training attendance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get attendance report (State)
   */
  async getAttendanceReport(filters: AttendanceFilterDto) {
    try {
      const { trainingId, date, institutionId } = filters;

      const where: Prisma.TrainingAttendanceWhereInput = {
        ...(trainingId ? { trainingId } : {}),
        ...(institutionId ? { user: { institutionId } } : {}),
      };

      if (date) {
        const dateObj = new Date(date);
        const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        where.attendanceDate = {
          gte: dateOnly,
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
        };
      }

      const attendance = await this.prisma.trainingAttendance.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              Institution: { select: { id: true, name: true, shortName: true } },
            },
          },
          training: { select: { id: true, title: true } },
        },
        orderBy: { attendanceDate: 'desc' },
      });

      // Group by institution
      const byInstitution = attendance.reduce((acc, att) => {
        const instId = att.user.Institution?.id || 'unknown';
        if (!acc[instId]) {
          acc[instId] = {
            institution: att.user.Institution,
            count: 0,
            users: new Set<string>(),
          };
        }
        acc[instId].count++;
        acc[instId].users.add(att.userId);
        return acc;
      }, {} as Record<string, any>);

      return {
        total: attendance.length,
        uniqueUsers: [...new Set(attendance.map((a) => a.userId))].length,
        byInstitution: Object.values(byInstitution).map((i: any) => ({
          institution: i.institution,
          totalRecords: i.count,
          uniqueUsers: i.users.size,
        })),
      };
    } catch (error) {
      this.logger.error(`Failed to get attendance report: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Verify attendance
   */
  async verifyAttendance(trainingId: string, userId: string) {
    const attendance = await this.prisma.trainingAttendance.findMany({
      where: { trainingId, userId },
    });

    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
    });

    if (!training) {
      throw new NotFoundException('Training not found');
    }

    const trainingDays = Math.ceil(
      (training.endDate.getTime() - training.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    return {
      hasAttended: attendance.length > 0,
      attendedDays: attendance.length,
      totalDays: trainingDays,
      attendanceRate: (attendance.length / trainingDays) * 100,
      isComplete: attendance.length >= trainingDays,
    };
  }

  /**
   * Get attendance by user (Faculty)
   */
  async getByUser(userId: string) {
    return this.getMyAttendance(userId);
  }

  /**
   * Get user attendance for a specific training (Faculty)
   */
  async getUserAttendanceForTraining(trainingId: string, userId: string) {
    const attendance = await this.prisma.trainingAttendance.findMany({
      where: { trainingId, userId },
      orderBy: { attendanceDate: 'asc' },
    });

    const training = await this.prisma.training.findUnique({
      where: { id: trainingId },
      select: { id: true, title: true, startDate: true, endDate: true },
    });

    if (!training) {
      throw new NotFoundException('Training not found');
    }

    const trainingDays = Math.ceil(
      (training.endDate.getTime() - training.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    return {
      training,
      attendance,
      attendedDays: attendance.length,
      totalDays: trainingDays,
      attendanceRate: (attendance.length / trainingDays) * 100,
    };
  }

  /**
   * Mark self attendance using DTO (Faculty)
   */
  async markSelfAttendance(dto: MarkSelfAttendanceDto, userId: string) {
    return this.markAttendance(dto.trainingId, userId, {
      attendanceDate: dto.attendanceDate,
      latitude: dto.latitude,
      longitude: dto.longitude,
      locationAddress: dto.locationAddress,
    });
  }

  /**
   * Get user attendance summary (Faculty)
   */
  async getUserAttendanceSummary(userId: string) {
    const applications = await this.prisma.trainingApplication.findMany({
      where: { userId, status: 'APPROVED' },
      include: {
        training: {
          select: { id: true, title: true, startDate: true, endDate: true },
        },
      },
    });

    const summaries = await Promise.all(
      applications.map(async (app) => {
        const attendance = await this.prisma.trainingAttendance.count({
          where: { trainingId: app.trainingId, userId },
        });

        const trainingDays = Math.ceil(
          (app.training.endDate.getTime() - app.training.startDate.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;

        return {
          training: app.training,
          attendedDays: attendance,
          totalDays: trainingDays,
          attendanceRate: (attendance / trainingDays) * 100,
        };
      })
    );

    const totalAttended = summaries.reduce((sum, s) => sum + s.attendedDays, 0);
    const totalDays = summaries.reduce((sum, s) => sum + s.totalDays, 0);

    return {
      trainings: summaries,
      overall: {
        totalTrainings: summaries.length,
        totalAttendedDays: totalAttended,
        totalTrainingDays: totalDays,
        overallAttendanceRate: totalDays > 0 ? (totalAttended / totalDays) * 100 : 0,
      },
    };
  }

  /**
   * Get institution attendance report (Principal)
   */
  async getInstitutionAttendanceReport(institutionId: string, filters: { trainingId?: string; date?: string }) {
    const where: Prisma.TrainingAttendanceWhereInput = {
      user: { institutionId },
      ...(filters.trainingId ? { trainingId: filters.trainingId } : {}),
    };

    if (filters.date) {
      const dateObj = new Date(filters.date);
      const dateOnly = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      where.attendanceDate = {
        gte: dateOnly,
        lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    const attendance = await this.prisma.trainingAttendance.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, branchName: true } },
        training: { select: { id: true, title: true, startDate: true, endDate: true } },
      },
      orderBy: { attendanceDate: 'desc' },
    });

    // Group by training
    const byTraining = attendance.reduce((acc, att) => {
      const trainingId = att.trainingId;
      if (!acc[trainingId]) {
        acc[trainingId] = {
          training: att.training,
          records: [],
          uniqueUsers: new Set<string>(),
        };
      }
      acc[trainingId].records.push(att);
      acc[trainingId].uniqueUsers.add(att.userId);
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRecords: attendance.length,
      uniqueUsers: [...new Set(attendance.map((a) => a.userId))].length,
      byTraining: Object.values(byTraining).map((t: any) => ({
        training: t.training,
        totalRecords: t.records.length,
        uniqueUsers: t.uniqueUsers.size,
      })),
      records: attendance.slice(0, 100), // Limit records
    };
  }
}
