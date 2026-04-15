import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AuditAction, AuditCategory, AuditSeverity, Prisma } from '../../generated/prisma/client';
import { MarkAttendanceDto, BulkMarkAttendanceDto, AttendanceFilterDto, MarkSelfAttendanceDto, MarkBackdatedAttendanceDto } from './dto';

@Injectable()
export class TrainingAttendanceService {
  private readonly logger = new Logger(TrainingAttendanceService.name);

  private toUtcDateOnly(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private resolveAttendanceDate(attendanceDate?: string, fallback: Date = new Date()): Date {
    if (!attendanceDate) {
      return this.toUtcDateOnly(fallback);
    }

    // Treat YYYY-MM-DD as a calendar date and avoid local timezone shifting.
    const dateOnlyMatch = attendanceDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }

    const parsed = new Date(attendanceDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid attendance date format');
    }

    return this.toUtcDateOnly(parsed);
  }

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
      const dateOnly = this.resolveAttendanceDate(dto.attendanceDate, now);

      const trainingStart = this.toUtcDateOnly(training.startDate);
      const trainingEnd = this.toUtcDateOnly(training.endDate);

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

      const dateOnly = this.resolveAttendanceDate(attendanceDate);

      const trainingStart = this.toUtcDateOnly(training.startDate);
      const trainingEnd = this.toUtcDateOnly(training.endDate);

      if (dateOnly < trainingStart || dateOnly > trainingEnd) {
        throw new BadRequestException('Attendance can only be marked during the training period');
      }

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
  async getByTraining(
    trainingId: string,
    date?: Date,
    institutionId?: string,
    branchName?: string,
    branchId?: string,
  ) {
    try {
      const training = await this.prisma.training.findUnique({
        where: { id: trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      const userFilter: Prisma.UserWhereInput = institutionId
        ? {
            institutionId,
            ...(branchName || branchId
              ? {
                  OR: [
                    ...(branchName
                      ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                      : []),
                    ...(branchId ? [{ branchId }] : []),
                  ],
                }
              : {}),
          }
        : branchName || branchId
          ? {
              OR: [
                ...(branchName
                  ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                  : []),
                ...(branchId ? [{ branchId }] : []),
              ],
            }
          : {};

      const where: Prisma.TrainingAttendanceWhereInput = {
        trainingId,
        ...(institutionId || branchName || branchId ? { user: userFilter } : {}),
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
            ...(institutionId || branchName || branchId ? { user: userFilter } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                Institution: { select: { id: true, name: true, shortName: true } },
              },
            },
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
    // Ignore optional client-provided attendanceDate to avoid timezone drift issues.
    // Self-attendance is always recorded for the server's current day.
    return this.markAttendance(dto.trainingId, userId, {
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
          select: { id: true, title: true, startDate: true, endDate: true, duration: true },
        },
      },
    });

    const trainingIds = applications.map((app) => app.trainingId);

    const attendanceByTraining = trainingIds.length > 0
      ? await this.prisma.trainingAttendance.groupBy({
          by: ['trainingId'],
          where: { userId, trainingId: { in: trainingIds } },
          _count: { _all: true },
        })
      : [];

    const attendanceCountMap = new Map(
      attendanceByTraining.map((entry) => [entry.trainingId, entry._count._all])
    );

    const summaries = applications.map((app) => {
      const attendedDays = attendanceCountMap.get(app.trainingId) || 0;

      const trainingDays = Math.ceil(
        (app.training.endDate.getTime() - app.training.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

      const safeTrainingDays = Math.max(trainingDays, 1);
      const totalHours = app.training.duration ?? safeTrainingDays * 8;
      const hoursPerDay = totalHours / safeTrainingDays;
      const completedHours = Math.min(attendedDays, safeTrainingDays) * hoursPerDay;

      return {
        training: app.training,
        attendedDays,
        totalDays: safeTrainingDays,
        totalHours,
        completedHours,
        attendanceRate: (attendedDays / safeTrainingDays) * 100,
      };
    });

    const totalAttended = summaries.reduce((sum, s) => sum + s.attendedDays, 0);
    const totalDays = summaries.reduce((sum, s) => sum + s.totalDays, 0);
    const totalCompletedHours = summaries.reduce((sum, s) => sum + s.completedHours, 0);
    const attendedTrainings = summaries.filter((s) => s.attendedDays > 0);
    const trainingsAttendedNames = [...new Set(attendedTrainings.map((s) => s.training.title))];
    const trainingsAttended = attendedTrainings.map((s) => ({
      id: s.training.id,
      title: s.training.title,
      attendedDays: s.attendedDays,
      totalDays: s.totalDays,
      completedHours: Number(s.completedHours.toFixed(2)),
      totalHours: s.totalHours,
    }));

    const requiredHours = 40;
    const requiredDays = 5;
    const hoursCompleted = Number(totalCompletedHours.toFixed(2));
    const daysCompleted = totalAttended;
    const hoursCompletionPercent = Math.min(100, Math.round((hoursCompleted / requiredHours) * 100));
    const daysCompletionPercent = Math.min(100, Math.round((daysCompleted / requiredDays) * 100));
    const isMandatoryCompleted = hoursCompleted >= requiredHours && daysCompleted >= requiredDays;

    return {
      trainings: summaries,
      overall: {
        totalTrainings: summaries.length,
        totalAttendedDays: totalAttended,
        totalTrainingDays: totalDays,
        totalCompletedHours: hoursCompleted,
        trainingsAttendedCount: attendedTrainings.length,
        trainingsCompleted: summaries.filter((s) => s.attendedDays >= s.totalDays).length,
        certificatesEarned: summaries.filter((s) => s.attendedDays >= s.totalDays).length,
        overallAttendanceRate: totalDays > 0 ? (totalAttended / totalDays) * 100 : 0,
      },
      dashboard: {
        mandatoryTraining: {
          requiredHours,
          requiredDays,
          hoursCompleted,
          daysCompleted,
          hoursCompletionPercent,
          daysCompletionPercent,
          isCompleted: isMandatoryCompleted,
          hoursRemaining: Math.max(0, Number((requiredHours - hoursCompleted).toFixed(2))),
          daysRemaining: Math.max(0, requiredDays - daysCompleted),
        },
        trainingsAttendedCount: attendedTrainings.length,
        trainingsAttendedNames,
        trainingsAttended,
      },
    };
  }

  /**
   * Get institution attendance report (Principal/Coordinator)
   * If institutionId is undefined and branchName/branchId provided, fetches across all institutions for that branch
   */
  async getInstitutionAttendanceReport(
    institutionId: string | undefined,
    filters: { trainingId?: string; date?: string },
    branchName?: string,
    branchId?: string,
  ) {
    // Build user filter - if no institutionId, filter by branch across all institutions
    const userFilter: Prisma.UserWhereInput = institutionId
      ? {
          institutionId,
          ...(branchName
            ? { branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }
            : {}),
        }
      : branchName || branchId
        ? {
            OR: [
              ...(branchName
                ? [{ branchName: { equals: branchName, mode: Prisma.QueryMode.insensitive } }]
                : []),
              ...(branchId ? [{ branchId }] : []),
            ],
          }
        : {};

    const where: Prisma.TrainingAttendanceWhereInput = {
      user: userFilter,
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            branchName: true,
            Institution: { select: { id: true, name: true, shortName: true } },
          }
        },
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

  /**
   * Mark backdated attendance for last month's trainings (Faculty)
   */
  async markBackdatedAttendance(dto: MarkBackdatedAttendanceDto, userId: string) {
    try {
      this.logger.log(`User ${userId} marking backdated attendance for training ${dto.trainingId}`);

      const training = await this.prisma.training.findUnique({
        where: { id: dto.trainingId },
      });

      if (!training) {
        throw new NotFoundException('Training not found');
      }

      // Check if user has approved application
      const application = await this.prisma.trainingApplication.findUnique({
        where: { userId_trainingId: { userId, trainingId: dto.trainingId } },
      });

      if (!application || application.status !== 'APPROVED') {
        throw new ForbiddenException('You must have an approved application to mark attendance');
      }

      const now = new Date();

      // Parse dates consistently using UTC to avoid timezone issues
      // The attendanceDate comes as ISO string like "2026-02-15"
      const attendanceDateStr = dto.attendanceDate.split('T')[0]; // Ensure we only use date part
      const [attYear, attMonth, attDay] = attendanceDateStr.split('-').map(Number);
      const dateOnly = new Date(Date.UTC(attYear, attMonth - 1, attDay));

      // Training dates from database - extract date parts using UTC
      const trainingStartUTC = new Date(training.startDate);
      const trainingEndUTC = new Date(training.endDate);
      const trainingStart = new Date(Date.UTC(trainingStartUTC.getUTCFullYear(), trainingStartUTC.getUTCMonth(), trainingStartUTC.getUTCDate()));
      const trainingEnd = new Date(Date.UTC(trainingEndUTC.getUTCFullYear(), trainingEndUTC.getUTCMonth(), trainingEndUTC.getUTCDate()));

      this.logger.debug(`Backdated attendance check: attendanceDate=${attendanceDateStr}, trainingStart=${trainingStart.toISOString()}, trainingEnd=${trainingEnd.toISOString()}`);

      // Check if the attendance date falls within training period
      if (dateOnly < trainingStart || dateOnly > trainingEnd) {
        this.logger.warn(`Attendance date ${attendanceDateStr} is outside training period ${trainingStart.toISOString()} to ${trainingEnd.toISOString()}`);
        throw new BadRequestException('Attendance date must be within the training period');
      }

      // Calculate last month boundaries using UTC
      const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));

      // Allow backdated attendance only for trainings that ended within last month
      if (trainingEnd < lastMonthStart || trainingEnd > lastMonthEnd) {
        this.logger.warn(`Training end date ${trainingEnd.toISOString()} is outside last month window ${lastMonthStart.toISOString()} to ${lastMonthEnd.toISOString()}`);
        throw new BadRequestException('Backdated attendance is only allowed for trainings that ended in the last month');
      }

      // Check if already marked for this date
      const existing = await this.prisma.trainingAttendance.findFirst({
        where: {
          userId,
          trainingId: dto.trainingId,
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
          trainingId: dto.trainingId,
          attendanceDate: dateOnly,
          markedAt: now,
          markedById: userId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationAddress: dto.locationAddress,
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
        description: `Marked backdated attendance for "${training.title}" on ${dateOnly.toISOString().split('T')[0]}`,
      }).catch(() => {});

      return attendance;
    } catch (error) {
      this.logger.error(`Failed to mark backdated attendance: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get last month's trainings with pending attendance (Faculty)
   */
  async getLastMonthTrainingsWithPendingAttendance(userId: string) {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get approved applications for trainings that ended last month
    const applications = await this.prisma.trainingApplication.findMany({
      where: {
        userId,
        status: 'APPROVED',
        training: {
          endDate: {
            gte: lastMonthStart,
            lte: lastMonthEnd,
          },
        },
      },
      include: {
        training: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            deliveryMode: true,
            duration: true,
          },
        },
      },
    });

    if (applications.length === 0) {
      return { trainings: [], totalPendingDays: 0 };
    }

    const trainingIds = applications.map((app) => app.trainingId);

    // Get existing attendance for these trainings
    const existingAttendance = await this.prisma.trainingAttendance.findMany({
      where: {
        userId,
        trainingId: { in: trainingIds },
      },
      select: {
        trainingId: true,
        attendanceDate: true,
      },
    });

    // Group attendance by training
    const attendanceByTraining = existingAttendance.reduce((acc, att) => {
      if (!acc[att.trainingId]) {
        acc[att.trainingId] = new Set<string>();
      }
      acc[att.trainingId].add(att.attendanceDate.toISOString().split('T')[0]);
      return acc;
    }, {} as Record<string, Set<string>>);

    // Calculate pending attendance for each training
    const trainingsWithPending = applications.map((app) => {
      const training = app.training;
      const trainingStartUTC = new Date(training.startDate);
      const trainingEndUTC = new Date(training.endDate);

      // Generate all training dates using UTC to avoid timezone issues
      const allDates: string[] = [];
      const currentDate = new Date(Date.UTC(
        trainingStartUTC.getUTCFullYear(),
        trainingStartUTC.getUTCMonth(),
        trainingStartUTC.getUTCDate()
      ));
      const endDate = new Date(Date.UTC(
        trainingEndUTC.getUTCFullYear(),
        trainingEndUTC.getUTCMonth(),
        trainingEndUTC.getUTCDate()
      ));

      while (currentDate <= endDate) {
        allDates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      const markedDates = attendanceByTraining[training.id] || new Set<string>();
      const pendingDates = allDates.filter((date) => !markedDates.has(date));
      const totalDays = allDates.length;
      const attendedDays = markedDates.size;
      const pendingDays = pendingDates.length;

      return {
        training,
        totalDays,
        attendedDays,
        pendingDays,
        pendingDates,
        markedDates: Array.from(markedDates),
        attendanceRate: totalDays > 0 ? (attendedDays / totalDays) * 100 : 0,
      };
    }).filter((t) => t.pendingDays > 0);

    const totalPendingDays = trainingsWithPending.reduce((sum, t) => sum + t.pendingDays, 0);

    return {
      trainings: trainingsWithPending,
      totalPendingDays,
    };
  }
}
