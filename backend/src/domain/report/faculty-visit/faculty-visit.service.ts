import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Role, VisitType, VisitLogStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { ExpectedCycleService } from '../../internship/expected-cycle/expected-cycle.service';
import {
  calculateExpectedMonths,
  MonthlyCycle,
  getVisitSubmissionStatus as getMonthlyVisitStatus,
  MONTHLY_CYCLE,
  getMonthName,
} from '../../../common/utils/monthly-cycle.util';

// Types for visit status
export type VisitStatusType = 'UPCOMING' | 'PENDING' | 'OVERDUE' | 'COMPLETED';

// REMOVED: VisitPeriod interface - was used by removed generateExpectedVisits function
// Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()

export interface VisitWithStatus {
  id: string;
  visitMonth: number;
  visitYear: number;
  requiredByDate: Date;
  status: VisitLogStatus;
  submissionStatus: VisitStatusType;
  statusLabel: string;
  statusColor: string;
  visitDate?: Date;
  isCompleted: boolean;
  isOverdue: boolean;
}

// REMOVED: calculateExpectedVisitPeriods function - was used by removed generateExpectedVisits
// Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()

/**
 * Get visit submission status based on calendar months
 * NOTE: Visit deadline has NO grace period - due on last day of month at 11:59:59 PM
 * @see COMPLIANCE_CALCULATION_ANALYSIS.md Section V
 */
function getVisitSubmissionStatus(visit: any): { status: VisitStatusType; label: string; color: string; sublabel?: string } {
  const now = new Date();
  const requiredByDate = visit.requiredByDate ? new Date(visit.requiredByDate) : null;
  const monthStartDate = visit.monthStartDate ? new Date(visit.monthStartDate) : null;
  const monthEndDate = visit.monthEndDate ? new Date(visit.monthEndDate) : null;

  // If visit is completed
  if (visit.status === VisitLogStatus.COMPLETED) {
    return {
      status: 'COMPLETED',
      label: 'Completed',
      color: 'green',
      sublabel: visit.visitDate ? `Visited on ${new Date(visit.visitDate).toLocaleDateString()}` : undefined,
    };
  }

  if (!requiredByDate) {
    return { status: 'PENDING', label: 'Pending', color: 'blue' };
  }

  // Check if overdue (past requiredByDate - last day of month, NO grace period)
  if (now > requiredByDate) {
    const daysOverdue = Math.floor((now.getTime() - requiredByDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      sublabel: `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
    };
  }

  // Check if we're in the current month (between monthStart and monthEnd)
  if (monthStartDate && monthEndDate && now >= monthStartDate && now <= monthEndDate) {
    const daysLeft = Math.ceil((monthEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'PENDING',
      label: 'Due This Month',
      color: 'blue',
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in month`,
    };
  }

  // Future month (not yet started)
  if (monthStartDate && now < monthStartDate) {
    const daysUntil = Math.ceil((monthStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'UPCOMING',
      label: 'Upcoming',
      color: 'gray',
      sublabel: `Month starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    };
  }

  // Default: upcoming
  return {
    status: 'UPCOMING',
    label: 'Upcoming',
    color: 'gray',
    sublabel: `Due by ${requiredByDate.toLocaleDateString()}`,
  };
}

export interface CreateVisitLogDto {
  visitDate: Date;
  visitType?: VisitType;
  visitLocation?: string;
  visitDuration?: string;
  meetingMinutes?: string;
  issuesIdentified?: string;
  recommendations?: string;
  followUpRequired?: boolean;
  nextVisitDate?: Date;
  visitPhotos?: string[];
  filesUrl?: string;
}

export interface UpdateVisitLogDto extends Partial<CreateVisitLogDto> {
  // no extra fields for now
}

@Injectable()
export class FacultyVisitService {
  private readonly logger = new Logger(FacultyVisitService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly expectedCycleService: ExpectedCycleService,
  ) {}

  async createVisitLog(
    facultyId: string,
    applicationId: string,
    data: CreateVisitLogDto,
  ) {
    try {
      this.logger.log(
        `Creating visit log for faculty ${facultyId} and application ${applicationId}`,
      );

      const [faculty, application, visitCount] = await Promise.all([
        this.prisma.user.findFirst({
          where: {
            id: facultyId,
            role: { in: [Role.TEACHER] },
          },
        }),
        this.prisma.internshipApplication.findFirst({
          where: {
            id: applicationId,
            mentorId: facultyId,
          },
          select: {
            id: true,
            studentId: true,
            startDate: true,
          },
        }),
        this.prisma.facultyVisitLog.count({ where: { applicationId, isDeleted: false } }),
      ]);

      if (!faculty) {
        throw new NotFoundException('Faculty not found');
      }

      if (!application) {
        throw new NotFoundException(
          'Application not found or you are not the assigned mentor',
        );
      }

      // Validate visitDate is not before internship start date
      const internshipStartDate = application.startDate;
      if (internshipStartDate && data.visitDate < new Date(internshipStartDate)) {
        throw new BadRequestException(
          `Visit date cannot be before internship start date (${new Date(internshipStartDate).toLocaleDateString()})`,
        );
      }

      // When faculty logs a visit, it's an actual completed visit (not scheduled)
      // Explicitly set status to COMPLETED to match the counter increment
      const visitLog = await this.prisma.facultyVisitLog.create({
        data: {
          facultyId,
          applicationId,
          visitNumber: visitCount + 1,
          visitDate: data.visitDate,
          visitType: data.visitType,
          visitLocation: data.visitLocation,
          visitDuration: data.visitDuration,
          meetingMinutes: data.meetingMinutes,
          issuesIdentified: data.issuesIdentified,
          recommendations: data.recommendations,
          followUpRequired: data.followUpRequired,
          nextVisitDate: data.nextVisitDate,
          visitPhotos: data.visitPhotos ?? [],
          filesUrl: data.filesUrl,
          status: VisitLogStatus.COMPLETED, // Explicitly mark as completed since this is an actual logged visit
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: {
            include: {
              student: { select: { id: true, user: { select: { name: true, rollNumber: true } } } },
            },
          },
        },
      });

      // Increment the completed visits counter
      await this.expectedCycleService.incrementVisitCount(applicationId);

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${facultyId}`),
        this.cache.del(`visits:student:${application.studentId}`),
      ]);

      return visitLog;
    } catch (error) {
      this.logger.error(`Failed to create visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitLogsByFaculty(facultyId: string) {
    try {
      const cacheKey = `visits:faculty:${facultyId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.facultyVisitLog.findMany({
            where: {
              facultyId,
              isDeleted: false,
              application: {
                student: {
              user: { active: true },
            },
              },
            },
            include: {
              application: {
                include: {
                  student: {
                    select: {
                      id: true,
                      institutionId: true,
                      user: { select: { name: true, rollNumber: true } },
                    },
                  },
                },
              },
            },
            orderBy: { visitDate: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit logs for faculty ${facultyId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitLogsByStudent(studentId: string) {
    try {
      const cacheKey = `visits:student:${studentId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          return await this.prisma.facultyVisitLog.findMany({
            where: {
              isDeleted: false,
              application: {
                studentId,
                student: {
                  user: { active: true },
                },
              },
            },
            include: {
              faculty: { select: { id: true, name: true, designation: true } },
            },
            orderBy: { visitDate: 'desc' },
          });
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit logs for student ${studentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateVisitLog(id: string, data: UpdateVisitLogDto) {
    try {
      this.logger.log(`Updating visit log ${id}`);

      const visitLog = await this.prisma.facultyVisitLog.findUnique({
        where: { id },
        include: { application: { select: { studentId: true } } },
      });

      if (!visitLog || visitLog.isDeleted) {
        throw new NotFoundException('Visit log not found');
      }

      const updated = await this.prisma.facultyVisitLog.update({
        where: { id },
        data: {
          visitDate: data.visitDate,
          visitType: data.visitType,
          visitLocation: data.visitLocation,
          visitDuration: data.visitDuration,
          meetingMinutes: data.meetingMinutes,
          issuesIdentified: data.issuesIdentified,
          recommendations: data.recommendations,
          followUpRequired: data.followUpRequired,
          nextVisitDate: data.nextVisitDate,
          visitPhotos: data.visitPhotos,
          filesUrl: data.filesUrl,
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: { select: { id: true, studentId: true } },
        },
      });

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${visitLog.facultyId}`),
        this.cache.del(`visits:student:${visitLog.application.studentId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to update visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteVisitLog(id: string) {
    try {
      this.logger.log(`Deleting visit log ${id}`);

      const visitLog = await this.prisma.facultyVisitLog.findUnique({
        where: { id },
        include: { application: { select: { id: true, studentId: true } } },
      });

      if (!visitLog || visitLog.isDeleted) {
        throw new NotFoundException('Visit log not found');
      }

      // Soft delete instead of hard delete
      await this.prisma.facultyVisitLog.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      // Decrement counter only if this was a completed visit
      if (visitLog.status === VisitLogStatus.COMPLETED) {
        await this.expectedCycleService.decrementVisitCount(visitLog.application.id);
      }

      // Invalidate cache (parallel)
      await Promise.all([
        this.cache.del(`visits:faculty:${visitLog.facultyId}`),
        this.cache.del(`visits:student:${visitLog.application.studentId}`),
      ]);

      return { success: true, message: 'Visit log deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete visit log: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getVisitStatistics(institutionId: string) {
    try {
      const cacheKey = `visit-stats:institution:${institutionId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          const [totalVisits, pendingFollowUps, facultyStats] = await Promise.all([
            this.prisma.facultyVisitLog.count({
              where: {
                isDeleted: false,
                application: { student: { institutionId, user: { active: true } } },
              },
            }),
            this.prisma.facultyVisitLog.count({
              where: {
                isDeleted: false,
                application: { student: { institutionId, user: { active: true } } },
                followUpRequired: true,
              },
            }),
            this.prisma.facultyVisitLog.findMany({
              where: { isDeleted: false, application: { student: { institutionId, user: { active: true } } } },
              select: { facultyId: true },
            }),
          ]);

          const uniqueFaculty = new Set(facultyStats.map((row) => row.facultyId));

          return {
            totalVisits,
            pendingFollowUps,
            facultyCount: uniqueFaculty.size,
            averageVisitsPerFaculty:
              uniqueFaculty.size > 0 ? totalVisits / uniqueFaculty.size : 0,
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get visit statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  // REMOVED: generateExpectedVisits function - was creating SCHEDULED placeholder records
  // Expected counts are now calculated via ExpectedCycleService using getTotalExpectedCount()
  // and stored in InternshipApplication.totalExpectedVisits and completedVisitsCount
  // Actual visits are logged via createVisitLog or completeMonthlyVisit when faculty completes a visit

  /**
   * Get monthly visits with status for an application
   */
  async getMonthlyVisitStatus(applicationId: string) {
    try {
      const cacheKey = `visits:application:${applicationId}`;

      return await this.cache.getOrSet(
        cacheKey,
        async () => {
          // Get all visits for application
          const visits = await this.prisma.facultyVisitLog.findMany({
            where: {
              applicationId,
              isDeleted: false,
              application: {
                student: {
                  user: { active: true },
                },
              },
            },
            include: {
              faculty: { select: { id: true, name: true, designation: true } },
            },
            orderBy: [{ visitYear: 'asc' }, { visitMonth: 'asc' }],
          });

          // Format visits with status
          const visitsWithStatus = visits.map((visit) => {
            const statusInfo = getVisitSubmissionStatus(visit);
            return {
              id: visit.id,
              visitMonth: visit.visitMonth || 0,
              visitYear: visit.visitYear || 0,
              requiredByDate: visit.requiredByDate,
              status: visit.status,
              submissionStatus: statusInfo.status,
              statusLabel: statusInfo.label,
              statusColor: statusInfo.color,
              sublabel: statusInfo.sublabel,
              visitDate: visit.visitDate,
              isCompleted: visit.status === VisitLogStatus.COMPLETED,
              isOverdue: statusInfo.status === 'OVERDUE',
              faculty: visit.faculty,
              visitType: visit.visitType,
              visitLocation: visit.visitLocation,
              meetingMinutes: visit.meetingMinutes,
            };
          });

          // Calculate progress
          const total = visits.length;
          const completed = visits.filter((v) => v.status === VisitLogStatus.COMPLETED).length;
          const overdue = visitsWithStatus.filter((v) => v.isOverdue).length;
          const pending = total - completed;

          return {
            visits: visitsWithStatus,
            progress: {
              total,
              completed,
              pending,
              overdue,
              percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            },
          };
        },
        this.CACHE_TTL,
      );
    } catch (error) {
      this.logger.error(`Failed to get monthly visit status: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Mark a scheduled visit as completed
   */
  async completeMonthlyVisit(
    visitId: string,
    data: CreateVisitLogDto,
  ) {
    try {
      this.logger.log(`Completing monthly visit ${visitId}`);

      const visit = await this.prisma.facultyVisitLog.findUnique({
        where: { id: visitId },
        include: { application: { select: { id: true, studentId: true } } },
      });

      if (!visit || visit.isDeleted) {
        throw new NotFoundException('Visit not found');
      }

      // Check if visit was already completed (to avoid double counting)
      const wasAlreadyCompleted = visit.status === VisitLogStatus.COMPLETED;

      const updated = await this.prisma.facultyVisitLog.update({
        where: { id: visitId },
        data: {
          visitDate: data.visitDate,
          
          visitType: data.visitType,
          visitLocation: data.visitLocation,
          visitDuration: data.visitDuration,
          meetingMinutes: data.meetingMinutes,
          issuesIdentified: data.issuesIdentified,
          recommendations: data.recommendations,
          followUpRequired: data.followUpRequired,
          nextVisitDate: data.nextVisitDate,
          visitPhotos: data.visitPhotos ?? [],
          filesUrl: data.filesUrl,
          status: VisitLogStatus.COMPLETED,
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
          application: {
            include: {
              student: { select: { id: true, user: { select: { name: true, rollNumber: true } } } },
            },
          },
        },
      });

      // Increment counter only if visit wasn't already completed
      if (!wasAlreadyCompleted) {
        await this.expectedCycleService.incrementVisitCount(visit.application.id);
      }

      // Invalidate cache
      await Promise.all([
        this.cache.del(`visits:faculty:${visit.facultyId}`),
        this.cache.del(`visits:student:${visit.application.studentId}`),
        this.cache.del(`visits:application:${visit.applicationId}`),
      ]);

      return updated;
    } catch (error) {
      this.logger.error(`Failed to complete monthly visit: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get visits for a specific application (for student view)
   */
  async getVisitsByApplication(applicationId: string) {
    try {
      return await this.prisma.facultyVisitLog.findMany({
        where: {
          applicationId,
          isDeleted: false,
          application: {
            student: {
              user: { active: true },
            },
          },
        },
        include: {
          faculty: { select: { id: true, name: true, designation: true } },
        },
        orderBy: [{ visitYear: 'asc' }, { visitMonth: 'asc' }],
      });
    } catch (error) {
      this.logger.error(`Failed to get visits for application ${applicationId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
