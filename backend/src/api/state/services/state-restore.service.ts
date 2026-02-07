import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../infrastructure/audit/audit.service';
import { ExpectedCycleService } from '../../../domain/internship/expected-cycle/expected-cycle.service';
import { AuditAction, VisitLogStatus } from '../../../generated/prisma/client';

/**
 * Supported restorable entity types
 * Add new types here to extend restore functionality
 */
export type RestorableEntityType = 'monthly-reports' | 'faculty-visits' | 'documents';

interface GetDeletedItemsParams {
  skip: number;
  limit: number;
  search?: string;
  institutionId?: string;
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class StateRestoreService {
  private readonly logger = new Logger(StateRestoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly expectedCycleService: ExpectedCycleService,
  ) {}

  /**
   * Get all deleted items by type with pagination
   */
  async getDeletedItems(
    type: RestorableEntityType,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      institutionId?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const { page = 1, limit = 20, search, institutionId, fromDate, toDate } = params;
    const skip = (page - 1) * limit;

    const internalParams: GetDeletedItemsParams = { skip, limit, search, institutionId, fromDate, toDate };

    switch (type) {
      case 'monthly-reports':
        return this.getDeletedMonthlyReports(internalParams);
      case 'faculty-visits':
        return this.getDeletedFacultyVisits(internalParams);
      case 'documents':
        return this.getDeletedDocuments(internalParams);
      default:
        throw new BadRequestException(`Unknown item type: ${type}. Valid types: monthly-reports, faculty-visits, documents`);
    }
  }

  /**
   * Get deleted monthly reports
   */
  private async getDeletedMonthlyReports(params: GetDeletedItemsParams) {
    const { skip, limit, search, institutionId, fromDate, toDate } = params;

    const where: any = {
      isDeleted: true,
    };

    if (institutionId) {
      where.student = { institutionId };
    }

    if (search) {
      where.OR = [
        { student: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { student: { user: { rollNumber: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (fromDate || toDate) {
      where.deletedAt = {};
      if (fromDate) where.deletedAt.gte = new Date(fromDate);
      if (toDate) where.deletedAt.lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.monthlyReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          student: {
            include: {
              user: { select: { name: true, email: true, rollNumber: true } },
              Institution: { select: { id: true, name: true, code: true } },
            },
          },
          application: {
            select: { id: true },
          },
        },
      }),
      this.prisma.monthlyReport.count({ where }),
    ]);

    return {
      data: data.map((report) => ({
        id: report.id,
        type: 'monthly-report' as const,
        title: `Monthly Report - ${report.reportMonth}/${report.reportYear}`,
        description: `Report for ${report.student?.user?.name || 'Unknown Student'}`,
        studentName: report.student?.user?.name,
        studentEmail: report.student?.user?.email,
        studentRollNo: report.student?.user?.rollNumber,
        institutionName: report.student?.Institution?.name,
        institutionId: report.student?.Institution?.id,
        month: report.reportMonth,
        year: report.reportYear,
        status: report.status,
        applicationId: report.application?.id,
        deletedAt: report.deletedAt,
        createdAt: report.createdAt,
      })),
      pagination: {
        page: Math.floor(skip / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get deleted faculty visits
   */
  private async getDeletedFacultyVisits(params: GetDeletedItemsParams) {
    const { skip, limit, search, institutionId, fromDate, toDate } = params;

    const where: any = {
      isDeleted: true,
    };

    if (institutionId) {
      where.OR = [
        { faculty: { institutionId } },
        { application: { student: { institutionId } } },
      ];
    }

    if (search) {
      const searchFilter = [
        { faculty: { name: { contains: search, mode: 'insensitive' } } },
        { application: { student: { user: { name: { contains: search, mode: 'insensitive' } } } } },
      ];

      if (where.OR) {
        // Combine institution filter with search filter
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    if (fromDate || toDate) {
      where.deletedAt = {};
      if (fromDate) where.deletedAt.gte = new Date(fromDate);
      if (toDate) where.deletedAt.lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.facultyVisitLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          faculty: {
            select: { id: true, name: true, email: true, institutionId: true },
          },
          application: {
            select: {
              id: true,
              companyName: true,
              student: {
                include: {
                  user: { select: { name: true } },
                  Institution: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.facultyVisitLog.count({ where }),
    ]);

    return {
      data: data.map((visit) => ({
        id: visit.id,
        type: 'faculty-visit' as const,
        title: `Faculty Visit - ${visit.visitDate ? new Date(visit.visitDate).toLocaleDateString() : 'No date'}`,
        description: `Visit by ${visit.faculty?.name || 'Unknown Faculty'} for ${visit.application?.student?.user?.name || 'Unknown Student'}`,
        facultyName: visit.faculty?.name,
        facultyEmail: visit.faculty?.email,
        studentName: visit.application?.student?.user?.name,
        companyName: visit.application?.companyName,
        institutionName: visit.application?.student?.Institution?.name,
        institutionId: visit.faculty?.institutionId || visit.application?.student?.Institution?.id,
        visitDate: visit.visitDate,
        status: visit.status,
        applicationId: visit.applicationId,
        deletedAt: visit.deletedAt,
        createdAt: visit.createdAt,
      })),
      pagination: {
        page: Math.floor(skip / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get deleted documents
   */
  private async getDeletedDocuments(params: GetDeletedItemsParams) {
    const { skip, limit, search, institutionId, fromDate, toDate } = params;

    const where: any = {
      isDeleted: true,
    };

    if (institutionId) {
      where.Student = { institutionId };
    }

    if (search) {
      where.OR = [
        { fileName: { contains: search, mode: 'insensitive' } },
        { Student: { user: { name: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (fromDate || toDate) {
      where.deletedAt = {};
      if (fromDate) where.deletedAt.gte = new Date(fromDate);
      if (toDate) where.deletedAt.lte = new Date(toDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { deletedAt: 'desc' },
        include: {
          Student: {
            include: {
              user: { select: { name: true, email: true } },
              Institution: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: data.map((doc) => ({
        id: doc.id,
        type: 'document' as const,
        title: doc.fileName,
        description: `${doc.type} document for ${doc.Student?.user?.name || 'Unknown Student'}`,
        studentName: doc.Student?.user?.name,
        studentEmail: doc.Student?.user?.email,
        institutionName: doc.Student?.Institution?.name,
        institutionId: doc.Student?.Institution?.id,
        documentType: doc.type,
        fileUrl: doc.fileUrl,
        deletedAt: doc.deletedAt,
        createdAt: doc.createdAt,
      })),
      pagination: {
        page: Math.floor(skip / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Restore a deleted item by type and ID
   */
  async restoreItem(type: RestorableEntityType, id: string, restoredBy?: string) {
    switch (type) {
      case 'monthly-reports':
        return this.restoreMonthlyReport(id, restoredBy);
      case 'faculty-visits':
        return this.restoreFacultyVisit(id, restoredBy);
      case 'documents':
        return this.restoreDocument(id, restoredBy);
      default:
        throw new BadRequestException(`Unknown item type: ${type}. Valid types: monthly-reports, faculty-visits, documents`);
    }
  }

  /**
   * Restore a deleted monthly report with counter adjustment
   */
  private async restoreMonthlyReport(id: string, restoredBy?: string) {
    const report = await this.prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        student: { include: { user: true } },
        application: { select: { id: true } },
      },
    });

    if (!report) {
      throw new NotFoundException(`Monthly report with ID ${id} not found`);
    }

    if (!report.isDeleted) {
      throw new BadRequestException(`Monthly report with ID ${id} is not deleted`);
    }

    // Restore the report
    const restored = await this.prisma.monthlyReport.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Re-increment the report counter if we have an application
    if (report.application?.id) {
      try {
        await this.expectedCycleService.incrementReportCount(report.application.id);
        this.logger.log(`Incremented report count for application ${report.application.id}`);
      } catch (error) {
        this.logger.warn(`Failed to increment report count for application ${report.application.id}: ${error.message}`);
      }
    }

    // Log the restore action
    await this.auditService.log({
      action: AuditAction.MONTHLY_REPORT_RESTORE,
      userId: restoredBy,
      entityType: 'MonthlyReport',
      entityId: id,
      newValues: { isDeleted: false, restoredAt: new Date() },
      oldValues: { isDeleted: true, deletedAt: report.deletedAt },
      description: `Restored monthly report for ${report.student?.user?.name} (${report.reportMonth}/${report.reportYear})`,
    });

    this.logger.log(`Monthly report ${id} restored by ${restoredBy}`);

    return {
      success: true,
      message: `Monthly report for ${report.student?.user?.name || 'Unknown'} (${report.reportMonth}/${report.reportYear}) has been restored`,
      data: {
        id: restored.id,
        month: restored.reportMonth,
        year: restored.reportYear,
        status: restored.status,
      },
    };
  }

  /**
   * Restore a deleted faculty visit with counter adjustment
   */
  private async restoreFacultyVisit(id: string, restoredBy?: string) {
    const visit = await this.prisma.facultyVisitLog.findUnique({
      where: { id },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
        application: {
          include: { student: { include: { user: true } } },
        },
      },
    });

    if (!visit) {
      throw new NotFoundException(`Faculty visit with ID ${id} not found`);
    }

    if (!visit.isDeleted) {
      throw new BadRequestException(`Faculty visit with ID ${id} is not deleted`);
    }

    // Restore the visit
    const restored = await this.prisma.facultyVisitLog.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Re-increment the visit counter only if it was a COMPLETED visit
    if (visit.status === VisitLogStatus.COMPLETED && visit.applicationId) {
      try {
        await this.expectedCycleService.incrementVisitCount(visit.applicationId);
        this.logger.log(`Incremented visit count for application ${visit.applicationId}`);
      } catch (error) {
        this.logger.warn(`Failed to increment visit count for application ${visit.applicationId}: ${error.message}`);
      }
    }

    // Log the restore action
    await this.auditService.log({
      action: AuditAction.VISIT_LOG_RESTORE,
      userId: restoredBy,
      entityType: 'FacultyVisitLog',
      entityId: id,
      newValues: { isDeleted: false, restoredAt: new Date() },
      oldValues: { isDeleted: true, deletedAt: visit.deletedAt },
      description: `Restored faculty visit by ${visit.faculty?.name} for ${visit.application?.student?.user?.name}`,
    });

    this.logger.log(`Faculty visit ${id} restored by ${restoredBy}`);

    return {
      success: true,
      message: `Faculty visit by ${visit.faculty?.name || 'Unknown'} for ${visit.application?.student?.user?.name || 'Unknown'} has been restored`,
      data: {
        id: restored.id,
        visitDate: restored.visitDate,
        status: restored.status,
      },
    };
  }

  /**
   * Restore a deleted document
   */
  private async restoreDocument(id: string, restoredBy?: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { Student: { include: { user: true } } },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    if (!document.isDeleted) {
      throw new BadRequestException(`Document with ID ${id} is not deleted`);
    }

    // Restore the document
    const restored = await this.prisma.document.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    // Log the restore action
    await this.auditService.log({
      action: AuditAction.STUDENT_DOCUMENT_RESTORE,
      userId: restoredBy,
      entityType: 'Document',
      entityId: id,
      newValues: { isDeleted: false, restoredAt: new Date() },
      oldValues: { isDeleted: true, deletedAt: document.deletedAt },
      description: `Restored document "${document.fileName}" for ${document.Student?.user?.name}`,
    });

    this.logger.log(`Document ${id} restored by ${restoredBy}`);

    return {
      success: true,
      message: `Document "${document.fileName}" for ${document.Student?.user?.name || 'Unknown'} has been restored`,
      data: {
        id: restored.id,
        fileName: restored.fileName,
        type: restored.type,
      },
    };
  }

  /**
   * Bulk restore multiple items of the same type
   */
  async bulkRestore(type: RestorableEntityType, ids: string[], restoredBy?: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('No items to restore');
    }

    if (ids.length > 100) {
      throw new BadRequestException('Cannot restore more than 100 items at once');
    }

    const results = await Promise.allSettled(
      ids.map((id) => this.restoreItem(type, id, restoredBy)),
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason?.message || 'Unknown error');

    return {
      success: failed === 0,
      message: `Restored ${successful} items.${failed > 0 ? ` ${failed} items failed.` : ''}`,
      restored: successful,
      failed,
      total: ids.length,
      errors: failed > 0 ? errors : undefined,
    };
  }

  /**
   * Get summary of deleted items across all types
   */
  async getDeletedItemsSummary(institutionId?: string) {
    const monthlyReportFilter = institutionId ? { student: { institutionId } } : {};
    const visitInstitutionFilter = institutionId
      ? {
          OR: [
            { faculty: { institutionId } },
            { application: { student: { institutionId } } },
          ],
        }
      : {};
    const documentFilter = institutionId ? { Student: { institutionId } } : {};

    const [monthlyReports, facultyVisits, documents] = await Promise.all([
      this.prisma.monthlyReport.count({
        where: { isDeleted: true, ...monthlyReportFilter },
      }),
      this.prisma.facultyVisitLog.count({
        where: { isDeleted: true, ...visitInstitutionFilter },
      }),
      this.prisma.document.count({
        where: { isDeleted: true, ...documentFilter },
      }),
    ]);

    return {
      monthlyReports,
      facultyVisits,
      documents,
      total: monthlyReports + facultyVisits + documents,
    };
  }
}
