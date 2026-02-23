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
    const principal = await this.prisma.user.findFirst({
      where: {
        id: principalId,
        role: Role.PRINCIPAL,
        active: true,
      },
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

  private async validateStudentsInInstitution(
    institutionId: string,
    students: { studentId: string; isPresent?: boolean }[],
  ) {
    if (!students || students.length === 0) {
      throw new BadRequestException('At least one student is required');
    }

    const studentIds = students.map((s) => s.studentId);
    const uniqueStudentIds = [...new Set(studentIds)];

    const dbStudents = await this.prisma.student.findMany({
      where: {
        id: { in: uniqueStudentIds },
        institutionId,
        user: { active: true },
      },
      select: { id: true },
    });

    if (dbStudents.length !== uniqueStudentIds.length) {
      throw new BadRequestException('One or more studentIds are invalid for your institution');
    }

    // Return unique students with attendance info
    const studentMap = new Map<string, boolean>();
    for (const s of students) {
      if (!studentMap.has(s.studentId)) {
        studentMap.set(s.studentId, s.isPresent ?? true);
      }
    }

    return Array.from(studentMap.entries()).map(([studentId, isPresent]) => ({
      studentId,
      isPresent,
    }));
  }

  private toReport(log: any) {
    const visitTypeMap: Record<string, string> = {
      PHYSICAL: 'In-Person',
      VIRTUAL: 'Virtual',
      TELEPHONIC: 'Phone',
      PHONE: 'Phone',
    };

    const statusMap: Record<string, string> = {
      DRAFT: 'Draft',
      SCHEDULED: 'Scheduled',
      IN_PROGRESS: 'In Progress',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };

    const status = statusMap[log.status] || log.status || 'Pending';

    return {
      id: log.id,
      principalId: log.principal?.id,
      principalName: log.principal?.name,
      studentIds: log.students?.map((entry: any) => entry.student.id) || [],
      students:
        log.students?.map((entry: any) => ({
          id: entry.student.id,
          name: entry.student.user?.name,
          rollNumber: entry.student.user?.rollNumber,
          isPresent: entry.isPresent ?? true,
          companyName: entry.student.internshipApplications?.[0]?.companyName || null,
        })) || [],
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
      responseFromOrganisation: log.responseFromOrganisation,
      observationsAboutStudent: log.observationsAboutStudent,
      observationsAboutIndustry: log.observationsAboutIndustry,
    };
  }

  async getVisitLogs(principalId: string, query: PrincipalVisitLogQueryDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PrincipalFeedbackWhereInput = {
      isDeleted: false,
      institutionId,
    };

    if (query.studentId) {
      where.students = {
        some: {
          studentId: query.studentId,
        },
      };
    }

    if (query.status) {
      where.status = query.status as any;
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

    const [logs, total, thisMonthCount, allRatings] = await Promise.all([
      this.prisma.principalFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitDate: 'desc' },
        include: {
          principal: { select: { id: true, name: true, email: true } },
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  user: { select: { name: true, rollNumber: true } },
                  internshipApplications: {
                    select: { companyName: true },
                    where: { isActive: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.principalFeedback.count({ where }),
      this.prisma.principalFeedback.count({
        where: {
          ...where,
          visitDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.principalFeedback.findMany({
        where,
        select: {
          overallSatisfactionRating: true,
          studentProgressRating: true,
        },
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

    const visitLog = await this.prisma.principalFeedback.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        institutionId,
      },
      include: {
        principal: { select: { id: true, name: true, email: true } },
        students: {
          include: {
            student: {
              select: {
                id: true,
                user: { select: { name: true, rollNumber: true } },
                internshipApplications: {
                  select: { companyName: true },
                  where: { isActive: true },
                  take: 1,
                },
              },
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
        principalId: visitLog.principalId,
        students: visitLog.students.map((entry) => ({
          studentId: entry.studentId,
          isPresent: entry.isPresent,
        })),
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
        responseFromOrganisation: visitLog.responseFromOrganisation,
        observationsAboutStudent: visitLog.observationsAboutStudent,
        observationsAboutIndustry: visitLog.observationsAboutIndustry,
        recommendations: visitLog.recommendations,
        issuesIdentified: visitLog.issuesIdentified,
        actionRequired: visitLog.actionRequired,
        overallSatisfactionRating: visitLog.overallSatisfactionRating,
        studentProgressRating: visitLog.studentProgressRating,
        followUpRequired: visitLog.followUpRequired,
        nextVisitDate: visitLog.nextVisitDate,
        visitPhotos: visitLog.visitPhotos,
        attendeesList: visitLog.attendeesList,
        filesUrl: visitLog.filesUrl,
      },
    };
  }

  async createVisitLog(principalId: string, dto: CreatePrincipalVisitLogDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const normalizedType = this.normalizeVisitType(dto.visitType);
    const visitDate = dto.visitDate ? new Date(dto.visitDate) : new Date();
    // Only allow 'DRAFT' or 'COMPLETED' as status
    let status = (dto.status || 'COMPLETED').toUpperCase();
    if (status !== 'DRAFT' && status !== 'COMPLETED') {
      status = 'COMPLETED';
    }

    if (normalizedType === 'PHYSICAL' && !dto.visitLocation && status !== 'DRAFT') {
      throw new BadRequestException('visitLocation is required for physical visits');
    }

    const validatedStudents = await this.validateStudentsInInstitution(institutionId, dto.students);

    const created = await this.prisma.principalFeedback.create({
      data: {
        principalId,
        institutionId,
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
        responseFromOrganisation: dto.responseFromOrganisation,
        observationsAboutStudent: dto.observationsAboutStudent,
        observationsAboutIndustry: dto.observationsAboutIndustry,
        recommendations: dto.recommendations,
        issuesIdentified: dto.issuesIdentified,
        actionRequired: dto.actionRequired,
        overallSatisfactionRating: dto.overallSatisfactionRating,
        studentProgressRating: dto.studentProgressRating,
        followUpRequired: dto.followUpRequired ?? false,
        nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
        visitPhotos: dto.visitPhotos || [],
        attendeesList: dto.attendeesList || [],
        filesUrl: dto.filesUrl,
        visitMonth: visitDate.getMonth() + 1,
        visitYear: visitDate.getFullYear(),
        students: {
          create: validatedStudents.map((s) => ({
            studentId: s.studentId,
            isPresent: s.isPresent,
          })),
        },
      },
    });

    return this.getVisitLogById(principalId, created.id);
  }

  async updateVisitLog(principalId: string, visitLogId: string, dto: UpdatePrincipalVisitLogDto) {
    const institutionId = await this.getInstitutionId(principalId);

    const existing = await this.prisma.principalFeedback.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        institutionId,
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

    const nextVisitType = this.normalizeVisitType(dto.visitType) || existing.visitType;
    // Only allow 'DRAFT' or 'COMPLETED' as status in update
    let nextStatus = (dto.status || existing.status || 'COMPLETED').toUpperCase();
    if (nextStatus !== 'DRAFT' && nextStatus !== 'COMPLETED') {
      nextStatus = 'COMPLETED';
    }
    const nextLocation = dto.visitLocation !== undefined ? dto.visitLocation : existing.visitLocation;

    if (nextVisitType === 'PHYSICAL' && !nextLocation && nextStatus !== 'DRAFT') {
      throw new BadRequestException('visitLocation is required for physical visits');
    }

    const updateData: Prisma.PrincipalFeedbackUpdateInput = {
      visitType: dto.visitType ? (this.normalizeVisitType(dto.visitType) as any) : undefined,
      visitLocation: dto.visitLocation,
      visitDate: dto.visitDate ? new Date(dto.visitDate) : undefined,
      status: nextStatus as any,
      visitDuration: dto.visitDuration,
      studentPerformance: dto.studentPerformance,
      workEnvironment: dto.workEnvironment,
      skillsDevelopment: dto.skillsDevelopment,
      attendanceStatus: dto.attendanceStatus,
      workQuality: dto.workQuality,
      responseFromOrganisation: dto.responseFromOrganisation,
      observationsAboutStudent: dto.observationsAboutStudent,
      observationsAboutIndustry: dto.observationsAboutIndustry,
      recommendations: dto.recommendations,
      issuesIdentified: dto.issuesIdentified,
      actionRequired: dto.actionRequired,
      overallSatisfactionRating: dto.overallSatisfactionRating,
      studentProgressRating: dto.studentProgressRating,
      followUpRequired: dto.followUpRequired,
      nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
      visitPhotos: dto.visitPhotos ? dto.visitPhotos : undefined,
      attendeesList: dto.attendeesList ? dto.attendeesList : undefined,
      filesUrl: dto.filesUrl,
    };

    await this.prisma.principalFeedback.update({
      where: { id: visitLogId },
      data: updateData,
    });

    if (dto.students) {
      const validatedStudents = await this.validateStudentsInInstitution(institutionId, dto.students);

      await this.prisma.principalFeedbackStudent.deleteMany({
        where: { principalFeedbackId: visitLogId },
      });

      await this.prisma.principalFeedbackStudent.createMany({
        data: validatedStudents.map((s) => ({
          principalFeedbackId: visitLogId,
          studentId: s.studentId,
          isPresent: s.isPresent,
        })),
        skipDuplicates: true,
      });
    }

    return this.getVisitLogById(principalId, visitLogId);
  }

  async getCompanies(principalId: string) {
    const institutionId = await this.getInstitutionId(principalId);

    // Get unique company names from internship applications for students in this institution
    const applications = await this.prisma.internshipApplication.findMany({
      where: {
        isActive: true,
        companyName: { not: null },
        student: {
          institutionId,
          user: { active: true },
        },
      },
      select: {
        companyName: true,
      },
      distinct: ['companyName'],
      orderBy: { companyName: 'asc' },
    });

    return {
      companies: applications
        .map((a) => a.companyName)
        .filter((name): name is string => !!name && name.trim() !== ''),
    };
  }

  async getStudentsByCompany(principalId: string, companyName?: string) {
    const institutionId = await this.getInstitutionId(principalId);

    const where: Prisma.StudentWhereInput = {
      institutionId,
      user: { active: true },
    };

    // If companyName is provided, filter students who have internships at that company
    if (companyName) {
      where.internshipApplications = {
        some: {
          isActive: true,
          companyName: {
            equals: companyName,
            mode: 'insensitive',
          },
        },
      };
    }

    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        user: {
          select: {
            name: true,
            rollNumber: true,
          },
        },
        internshipApplications: {
          where: { isActive: true },
          select: { companyName: true },
          take: 1,
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return {
      students: students.map((s) => ({
        id: s.id,
        name: s.user?.name || 'Unknown',
        rollNumber: s.user?.rollNumber || '-',
        companyName: s.internshipApplications?.[0]?.companyName || null,
      })),
    };
  }

  async deleteVisitLog(principalId: string, visitLogId: string) {
    const institutionId = await this.getInstitutionId(principalId);

    const existing = await this.prisma.principalFeedback.findFirst({
      where: {
        id: visitLogId,
        isDeleted: false,
        institutionId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Visit log not found');
    }

    await this.prisma.principalFeedback.update({
      where: { id: visitLogId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return { message: 'Visit log deleted successfully' };
  }
}
