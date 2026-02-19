import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  CreatePrincipalVisitLogDto,
  PrincipalVisitLogQueryDto,
  UpdatePrincipalVisitLogDto,
} from './dto/principal-visit-log.dto';

@Injectable()
export class PrincipalVisitLogsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getInstitutionId(principalId: string) {
    const principal = await this.prisma.user.findUnique({
      where: { id: principalId },
      select: { institutionId: true },
    });

    if (!principal?.institutionId) {
      throw new NotFoundException('Institution not found');
    }

    return principal.institutionId;
  }

  private normalizeVisitType(visitType?: string) {
    if (!visitType) return visitType;
    return visitType === 'PHONE' ? 'TELEPHONIC' : visitType;
  }

  private toReport(log: any) {
    const visitTypeMap: Record<string, string> = {
      PHYSICAL: 'In-Person',
      VIRTUAL: 'Virtual',
      TELEPHONIC: 'Phone',
      PHONE: 'Phone',
    };

    let status = 'Pending';
    if (log.reportSubmittedTo) {
      status = log.followUpRequired ? 'Under Review' : 'Approved';
    }

    return {
      id: log.id,
      facultyId: log.faculty?.id,
      facultyName: log.faculty?.name,
      studentId: log.application?.student?.id,
      studentName: log.application?.student?.user?.name,
      studentRollNumber: log.application?.student?.user?.rollNumber,
      internshipTitle: log.application?.jobProfile || 'N/A',
      visitDate: log.visitDate,
      visitType: visitTypeMap[log.visitType] || log.visitType,
      status,
      rating: log.overallSatisfactionRating || log.studentProgressRating || 0,
      duration: log.visitDuration || 'N/A',
      location: log.visitLocation || 'N/A',
      summary: log.observationsAboutStudent || log.studentPerformance || '',
      observations:
        [
          log.workEnvironment && `Work Environment: ${log.workEnvironment}`,
          log.skillsDevelopment && `Skills Development: ${log.skillsDevelopment}`,
          log.attendanceStatus && `Attendance: ${log.attendanceStatus}`,
          log.workQuality && `Work Quality: ${log.workQuality}`,
        ]
          .filter(Boolean)
          .join('\n') || 'No observations recorded',
      recommendations: log.recommendations || 'No recommendations',
      issuesIdentified: log.issuesIdentified,
      actionRequired: log.actionRequired,
    };
  }

  async getVisitLogs(principalId: string, query: PrincipalVisitLogQueryDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FacultyVisitLogWhereInput = {
      isDeleted: false,
      application: {
        student: {
          institutionId,
          user: { active: true },
        },
      },
    };

    if (query.facultyId) {
      where.facultyId = query.facultyId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.visitDate = {};
      if (query.startDate) {
        where.visitDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.visitDate.lte = new Date(query.endDate);
      }
    }

    const [logs, total, thisMonthCount, allRatings, facultyList] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          faculty: { select: { id: true, name: true, email: true } },
          application: {
            include: {
              student: {
                select: { id: true, user: { select: { name: true, rollNumber: true } } },
              },
            },
          },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
      this.prisma.facultyVisitLog.count({
        where: {
          ...where,
          visitDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.facultyVisitLog.findMany({
        where,
        select: {
          overallSatisfactionRating: true,
          studentProgressRating: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          institutionId,
          role: { in: [Role.TEACHER] },
          active: true,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const ratings = allRatings
      .map((entry) => entry.overallSatisfactionRating || entry.studentProgressRating)
      .filter((entry): entry is number => entry !== null && entry !== undefined);

    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
        : 0;

    return {
      reports: logs.map((log) => this.toReport(log)),
      stats: {
        totalVisits: total,
        avgRating,
        visitsThisMonth: thisMonthCount,
      },
      facultyList,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getVisitLogById(principalId: string, visitLogId: string) {
    const institutionId = await this.getInstitutionId(principalId);

    const visitLog = await this.prisma.facultyVisitLog.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        application: {
          student: {
            institutionId,
            user: { active: true },
          },
        },
      },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        application: {
          include: {
            student: {
              select: { id: true, user: { select: { name: true, rollNumber: true } } },
            },
          },
        },
      },
    });

    if (!visitLog) {
      throw new NotFoundException('Visit log not found');
    }

    return {
      ...this.toReport(visitLog),
      raw: {
        id: visitLog.id,
        applicationId: visitLog.applicationId,
        facultyId: visitLog.facultyId,
        visitLocation: visitLog.visitLocation,
        visitDate: visitLog.visitDate,
        visitType: visitLog.visitType,
        status: visitLog.status,
        visitDuration: visitLog.visitDuration,
        studentPerformance: visitLog.studentPerformance,
        workEnvironment: visitLog.workEnvironment,
        skillsDevelopment: visitLog.skillsDevelopment,
        attendanceStatus: visitLog.attendanceStatus,
        workQuality: visitLog.workQuality,
        observationsAboutStudent: visitLog.observationsAboutStudent,
        recommendations: visitLog.recommendations,
        issuesIdentified: visitLog.issuesIdentified,
        actionRequired: visitLog.actionRequired,
        overallSatisfactionRating: visitLog.overallSatisfactionRating,
        studentProgressRating: visitLog.studentProgressRating,
        followUpRequired: visitLog.followUpRequired,
        nextVisitDate: visitLog.nextVisitDate,
        visitPhotos: visitLog.visitPhotos,
        attendeesList: visitLog.attendeesList,
      },
    };
  }

  async createVisitLog(principalId: string, dto: CreatePrincipalVisitLogDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const application = await this.prisma.internshipApplication.findFirst({
      where: {
        id: dto.applicationId,
        student: {
          institutionId,
          user: { active: true },
        },
      },
      select: {
        id: true,
        startDate: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found for your institution');
    }

    const normalizedType = this.normalizeVisitType(dto.visitType);

    const visitDate = dto.visitDate ? new Date(dto.visitDate) : new Date();
    if (application.startDate && visitDate < application.startDate) {
      throw new BadRequestException('Visit date cannot be before internship start date');
    }

    const status = dto.status || 'COMPLETED';
    if (normalizedType === 'PHYSICAL' && !dto.visitLocation && status !== 'DRAFT') {
      throw new BadRequestException('visitLocation is required for physical visits');
    }

    let facultyId = dto.facultyId;
    if (facultyId) {
      const faculty = await this.prisma.user.findFirst({
        where: {
          id: facultyId,
          institutionId,
          role: Role.TEACHER,
          active: true,
        },
        select: { id: true },
      });

      if (!faculty) {
        throw new BadRequestException('Invalid facultyId for your institution');
      }
    }

    const created = await this.prisma.facultyVisitLog.create({
      data: {
        applicationId: dto.applicationId,
        facultyId,
        visitType: normalizedType as any,
        visitLocation: dto.visitLocation,
        visitDate,
        status: status as any,
        visitDuration: dto.visitDuration,
        studentPerformance: dto.studentPerformance,
        workEnvironment: dto.workEnvironment,
        skillsDevelopment: dto.skillsDevelopment,
        attendanceStatus: dto.attendanceStatus,
        workQuality: dto.workQuality,
        observationsAboutStudent: dto.observationsAboutStudent,
        recommendations: dto.recommendations,
        issuesIdentified: dto.issuesIdentified,
        actionRequired: dto.actionRequired,
        overallSatisfactionRating: dto.overallSatisfactionRating,
        studentProgressRating: dto.studentProgressRating,
        followUpRequired: dto.followUpRequired ?? false,
        nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
        visitPhotos: dto.visitPhotos || [],
        attendeesList: dto.attendeesList || [],
        visitMonth: visitDate.getMonth() + 1,
        visitYear: visitDate.getFullYear(),
      },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        application: {
          include: {
            student: {
              select: { id: true, user: { select: { name: true, rollNumber: true } } },
            },
          },
        },
      },
    });

    return this.getVisitLogById(principalId, created.id);
  }

  async updateVisitLog(principalId: string, visitLogId: string, dto: UpdatePrincipalVisitLogDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const existing = await this.prisma.facultyVisitLog.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        application: {
          student: {
            institutionId,
            user: { active: true },
          },
        },
      },
      select: {
        id: true,
        visitType: true,
        visitLocation: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Visit log not found');
    }

    if (dto.facultyId) {
      const faculty = await this.prisma.user.findFirst({
        where: {
          id: dto.facultyId,
          institutionId,
          role: Role.TEACHER,
          active: true,
        },
        select: { id: true },
      });

      if (!faculty) {
        throw new BadRequestException('Invalid facultyId for your institution');
      }
    }

    const nextVisitType = this.normalizeVisitType(dto.visitType) || existing.visitType;
    const nextStatus = dto.status || existing.status;
    const nextLocation = dto.visitLocation !== undefined ? dto.visitLocation : existing.visitLocation;

    if (nextVisitType === 'PHYSICAL' && !nextLocation && nextStatus !== 'DRAFT') {
      throw new BadRequestException('visitLocation is required for physical visits');
    }

    const updateData: Prisma.FacultyVisitLogUpdateInput = {
      faculty: dto.facultyId ? { connect: { id: dto.facultyId } } : undefined,
      visitType: dto.visitType ? (this.normalizeVisitType(dto.visitType) as any) : undefined,
      visitLocation: dto.visitLocation,
      visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
      status: dto.status as any,
      visitDuration: dto.visitDuration,
      studentPerformance: dto.studentPerformance,
      workEnvironment: dto.workEnvironment,
      skillsDevelopment: dto.skillsDevelopment,
      attendanceStatus: dto.attendanceStatus,
      workQuality: dto.workQuality,
      observationsAboutStudent: dto.observationsAboutStudent,
      recommendations: dto.recommendations,
      issuesIdentified: dto.issuesIdentified,
      actionRequired: dto.actionRequired,
      overallSatisfactionRating: dto.overallSatisfactionRating,
      studentProgressRating: dto.studentProgressRating,
      followUpRequired: dto.followUpRequired,
      nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
      visitPhotos: dto.visitPhotos ? dto.visitPhotos : undefined,
      attendeesList: dto.attendeesList ? dto.attendeesList : undefined,
    };

    await this.prisma.facultyVisitLog.update({
      where: { id: visitLogId },
      data: updateData,
    });

    return this.getVisitLogById(principalId, visitLogId);
  }

  async deleteVisitLog(principalId: string, visitLogId: string) {
    const institutionId = await this.getInstitutionId(principalId);

    const existing = await this.prisma.facultyVisitLog.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        application: {
          student: {
            institutionId,
            user: { active: true },
          },
        },
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Visit log not found');
    }

    await this.prisma.facultyVisitLog.update({
      where: { id: visitLogId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: 'Visit log deleted successfully' };
  }
}
