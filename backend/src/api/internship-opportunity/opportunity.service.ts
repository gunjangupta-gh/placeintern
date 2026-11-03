import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExpectedCycleService } from '../../domain/internship/expected-cycle/expected-cycle.service';
import {
  ApplicationStatus,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  InternshipPhase,
  OpportunityStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PENDING_DECISION_STATUSES, SEAT_HOLDING_STATUSES } from './opportunity.constants';
import {
  addMonthsIST,
  endOfDayIST,
  parseApiDate,
  startOfDayIST,
  todayStartIST,
} from './opportunity-dates.util';
import {
  ApproveApplicationDto,
  ListApplicationsQueryDto,
  ListOpportunitiesQueryDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';

export interface Actor {
  userId: string;
  userName?: string;
  role: any;
}

/** Director/state view: everything, including industry contact. */
const DIRECTOR_SELECT = {
  id: true,
  title: true,
  description: true,
  district: true,
  positions: true,
  approvedCount: true,
  eligibleYears: true,
  durationMonths: true,
  stipend: true,
  startDate: true,
  applicationDeadline: true,
  status: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  importBatchId: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
  branches: { select: { branch: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.InternshipOpportunitySelect;

@Injectable()
export class OpportunityService {
  private readonly logger = new Logger(OpportunityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly expectedCycle: ExpectedCycleService,
  ) {}

  private paging(q: { page?: number; limit?: number }) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return { page, limit, skip: (page - 1) * limit, take: limit };
  }

  /** applied = seat-holding applications per opportunity */
  private async appliedCounts(opportunityIds: string[]): Promise<Map<string, number>> {
    if (!opportunityIds.length) return new Map();
    const grouped = await this.prisma.internshipApplication.groupBy({
      by: ['opportunityId'],
      where: {
        opportunityId: { in: opportunityIds },
        isActive: true,
        status: { in: SEAT_HOLDING_STATUSES },
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.opportunityId as string, g._count._all]));
  }

  private shape(
    o: Prisma.InternshipOpportunityGetPayload<{ select: typeof DIRECTOR_SELECT }>,
    applied: number,
  ) {
    const { branches, ...rest } = o;
    return {
      ...rest,
      branches: branches.map((b) => b.branch),
      appliedCount: applied,
      seatsLeft: Math.max(o.positions - applied, 0),
    };
  }

  // ---------------------------------------------------------------------------
  // Opportunities
  // ---------------------------------------------------------------------------

  async list(q: ListOpportunitiesQueryDto) {
    const { page, limit, skip, take } = this.paging(q);
    const where: Prisma.InternshipOpportunityWhereInput = { isDeleted: false };
    if (q.status) where.status = q.status as OpportunityStatus;
    if (q.branchId) where.branches = { some: { branchId: q.branchId } };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { company: { name: { contains: q.search, mode: 'insensitive' } } },
        { district: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [total, items] = await Promise.all([
      this.prisma.internshipOpportunity.count({ where }),
      this.prisma.internshipOpportunity.findMany({
        where,
        select: DIRECTOR_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);
    const counts = await this.appliedCounts(items.map((i) => i.id));
    return {
      data: items.map((i) => this.shape(i, counts.get(i.id) ?? 0)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getOne(id: string) {
    const opp = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: DIRECTOR_SELECT,
    });
    if (!opp) throw new NotFoundException('Opportunity not found');
    const counts = await this.appliedCounts([id]);
    return this.shape(opp, counts.get(id) ?? 0);
  }

  async update(id: string, dto: UpdateOpportunityDto, actor: Actor) {
    const existing = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, status: true, positions: true, approvedCount: true, startDate: true, applicationDeadline: true },
    });
    if (!existing) throw new NotFoundException('Opportunity not found');

    const applied = (await this.appliedCounts([id])).get(id) ?? 0;
    const data: Prisma.InternshipOpportunityUpdateInput = {};

    for (const key of ['title', 'description', 'district', 'stipend', 'contactName', 'contactPhone', 'contactEmail', 'durationMonths'] as const) {
      if (dto[key] !== undefined) (data as any)[key] = dto[key];
    }
    if (dto.eligibleYears !== undefined) data.eligibleYears = Array.from(new Set(dto.eligibleYears)).sort();

    // Seats can never drop below confirmed or pending applicants
    const positions = dto.positions ?? existing.positions;
    if (dto.positions !== undefined) {
      if (dto.positions < Math.max(applied, existing.approvedCount)) {
        throw new BadRequestException(
          `Positions cannot be less than current applications (${applied}) / approved students (${existing.approvedCount})`,
        );
      }
      data.positions = dto.positions;
    }

    // Dates
    let start = existing.startDate;
    let deadline = existing.applicationDeadline;
    if (dto.startDate) {
      const c = parseApiDate(dto.startDate);
      if (!c) throw new BadRequestException('startDate is not a valid date');
      start = startOfDayIST(c);
      data.startDate = start;
    }
    if (dto.applicationDeadline) {
      const c = parseApiDate(dto.applicationDeadline);
      if (!c) throw new BadRequestException('applicationDeadline is not a valid date');
      if (startOfDayIST(c) < todayStartIST()) {
        throw new BadRequestException('applicationDeadline cannot be in the past');
      }
      deadline = endOfDayIST(c);
      data.applicationDeadline = deadline;
    }
    if ((dto.startDate || dto.applicationDeadline) && start.getTime() <= deadline.getTime()) {
      throw new BadRequestException('Start date must be after the application deadline');
    }

    // Eligible branches can only be changed while nobody has applied
    if (dto.branchIds) {
      if (applied > 0) {
        throw new BadRequestException('Branches cannot be changed after students have applied');
      }
      const found = await this.prisma.branch.count({ where: { id: { in: dto.branchIds }, isActive: true } });
      if (found !== new Set(dto.branchIds).size) throw new BadRequestException('One or more branches are invalid');
      data.branches = {
        deleteMany: {},
        create: Array.from(new Set(dto.branchIds)).map((branchId) => ({ branchId })),
      };
    }

    // Status: FILLED is automatic; OPEN is not allowed if it is actually full
    if (dto.status) {
      data.status = dto.status as OpportunityStatus;
    }
    const finalStatus = (data.status as OpportunityStatus | undefined) ?? existing.status;
    if (existing.approvedCount >= positions) {
      data.status = OpportunityStatus.FILLED;
    } else if (finalStatus === OpportunityStatus.FILLED) {
      // positions were raised on a filled opportunity -> reopen
      data.status = OpportunityStatus.OPEN;
    }

    const updated = await this.prisma.internshipOpportunity.update({
      where: { id },
      data,
      select: { id: true },
    });

    this.logAudit(actor, AuditAction.INTERNSHIP_UPDATE, id, `Updated internship opportunity`, {
      fields: Object.keys(dto),
    });
    await this.cache.invalidateByTags(['applications']).catch(() => undefined);
    return this.getOne(updated.id);
  }

  async remove(id: string, actor: Actor) {
    const opp = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: { id: true, title: true },
    });
    if (!opp) throw new NotFoundException('Opportunity not found');

    const active = (await this.appliedCounts([id])).get(id) ?? 0;
    if (active > 0) {
      throw new ConflictException(
        `Cannot delete: ${active} student application(s) exist. Close the opportunity instead.`,
      );
    }
    await this.prisma.internshipOpportunity.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), status: OpportunityStatus.CLOSED },
    });
    this.logAudit(actor, AuditAction.INTERNSHIP_DELETE, id, `Deleted internship opportunity: ${opp.title}`);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Applications (director)
  // ---------------------------------------------------------------------------

  async listApplications(q: ListApplicationsQueryDto) {
    const { page, limit, skip, take } = this.paging(q);
    const studentWhere: Prisma.StudentWhereInput = {};
    if (q.institutionId) studentWhere.institutionId = q.institutionId;
    if (q.branchId) studentWhere.branchId = q.branchId;
    if (q.search) {
      studentWhere.user = {
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { rollNumber: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    }
    const where: Prisma.InternshipApplicationWhereInput = {
      opportunityId: q.opportunityId ?? { not: null },
      student: studentWhere,
      ...(q.status ? { status: q.status } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.internshipApplication.count({ where }),
      this.prisma.internshipApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          appliedDate: true,
          reviewedAt: true,
          reviewRemarks: true,
          rejectionReason: true,
          startDate: true,
          endDate: true,
          opportunity: {
            select: { id: true, title: true, positions: true, approvedCount: true, company: { select: { name: true } } },
          },
          student: {
            select: {
              id: true,
              currentYear: true,
              user: { select: { name: true, email: true, rollNumber: true } },
              Institution: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: { appliedDate: 'asc' },
        skip,
        take,
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async approve(applicationId: string, dto: ApproveApplicationDto, actor: Actor) {
    const result = await this.prisma.$transaction(async (tx) => {
      const pre = await tx.internshipApplication.findUnique({
        where: { id: applicationId },
        select: { opportunityId: true },
      });
      if (!pre?.opportunityId) throw new NotFoundException('Application not found');

      // Serialise approvals per opportunity so positions can never be over-approved
      await tx.$queryRaw`SELECT id FROM internship_opportunities WHERE id = ${pre.opportunityId} FOR UPDATE`;

      const app = await tx.internshipApplication.findUnique({
        where: { id: applicationId },
        select: { id: true, studentId: true, status: true, startDate: true, endDate: true },
      });
      const opp = await tx.internshipOpportunity.findUnique({
        where: { id: pre.opportunityId },
        select: {
          id: true, title: true, positions: true, approvedCount: true, status: true, startDate: true,
          durationMonths: true, contactName: true, contactPhone: true, contactEmail: true,
          company: { select: { name: true, email: true, contact: true, address: true } },
        },
      });
      if (!app || !opp) throw new NotFoundException('Application not found');

      if (!PENDING_DECISION_STATUSES.includes(app.status)) {
        throw new BadRequestException(`Application is already ${app.status}`);
      }
      if (opp.approvedCount >= opp.positions) {
        throw new BadRequestException('All positions for this opportunity are already filled');
      }

      let start = app.startDate ?? opp.startDate;
      if (dto.startDate) {
        const c = parseApiDate(dto.startDate);
        if (!c) throw new BadRequestException('startDate is not a valid date');
        start = startOfDayIST(c);
      }
      let end = app.endDate ?? addMonthsIST(start, opp.durationMonths);
      if (dto.endDate) {
        const c = parseApiDate(dto.endDate);
        if (!c) throw new BadRequestException('endDate is not a valid date');
        end = startOfDayIST(c);
      } else if (dto.startDate) {
        end = addMonthsIST(start, opp.durationMonths);
      }
      if (end.getTime() <= start.getTime()) throw new BadRequestException('End date must be after start date');

      const now = new Date();
      await tx.internshipApplication.update({
        where: { id: applicationId },
        data: {
          status: ApplicationStatus.APPROVED,
          internshipPhase: InternshipPhase.NOT_STARTED, // phase scheduler activates it on startDate
          isSelected: true,
          selectionDate: now,
          reviewedAt: now,
          reviewedDate: now,
          reviewRemarks: dto.remarks ?? null,
          rejectionReason: null,
          startDate: start,
          endDate: end,
          // carry industry contact onto the internship so mentor/visit workflows have it
          hrName: opp.contactName ?? undefined,
          hrContact: opp.contactPhone ?? undefined,
          hrEmail: opp.contactEmail ?? undefined,
          companyEmail: opp.company.email ?? undefined,
          companyContact: opp.company.contact ?? undefined,
          companyAddress: opp.company.address ?? undefined,
        },
      });

      const newCount = opp.approvedCount + 1;
      await tx.internshipOpportunity.update({
        where: { id: opp.id },
        data: {
          approvedCount: newCount,
          ...(newCount >= opp.positions ? { status: OpportunityStatus.FILLED } : {}),
        },
      });

      return { studentId: app.studentId, title: opp.title, company: opp.company.name };
    });

    await this.expectedCycle
      .recalculateExpectedCounts(applicationId)
      .catch((e) => this.logger.warn(`Expected counts failed for ${applicationId}: ${e?.message}`));
    await this.cache.invalidateByTags(['applications', `student:${result.studentId}`]).catch(() => undefined);
    this.logAudit(actor, AuditAction.APPLICATION_APPROVE, applicationId, `Approved internship at ${result.company} (${result.title})`, {
      remarks: dto.remarks,
    });
    return { success: true, applicationId };
  }

  async reject(applicationId: string, reason: string, actor: Actor) {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, studentId: true, status: true, opportunityId: true },
    });
    if (!app?.opportunityId) throw new NotFoundException('Application not found');
    if (!PENDING_DECISION_STATUSES.includes(app.status)) {
      throw new BadRequestException(`Application is already ${app.status}`);
    }
    const now = new Date();
    // Conditional update guards against a concurrent approve
    const res = await this.prisma.internshipApplication.updateMany({
      where: { id: applicationId, status: { in: PENDING_DECISION_STATUSES } },
      data: {
        status: ApplicationStatus.REJECTED,
        isSelected: false,
        rejectionReason: reason,
        reviewRemarks: reason,
        reviewedAt: now,
        reviewedDate: now,
      },
    });
    if (res.count === 0) throw new ConflictException('Application was updated by someone else. Refresh and retry.');

    await this.cache.invalidateByTags(['applications', `student:${app.studentId}`]).catch(() => undefined);
    this.logAudit(actor, AuditAction.APPLICATION_REJECT, applicationId, 'Rejected internship application', { reason });
    return { success: true, applicationId };
  }

  async bulkAction(
    action: 'APPROVE' | 'REJECT',
    applicationIds: string[],
    remarks: string | undefined,
    actor: Actor,
  ) {
    if (action === 'REJECT' && !remarks?.trim()) {
      throw new BadRequestException('A reason (remarks) is required to reject');
    }
    const results: Array<{ applicationId: string; ok: boolean; error?: string }> = [];
    // Sequential on purpose: approvals lock the opportunity row, and order keeps seat use predictable
    for (const id of Array.from(new Set(applicationIds))) {
      try {
        if (action === 'APPROVE') await this.approve(id, { remarks }, actor);
        else await this.reject(id, remarks!.trim(), actor);
        results.push({ applicationId: id, ok: true });
      } catch (e: any) {
        results.push({ applicationId: id, ok: false, error: e?.response?.message ?? e?.message ?? 'Failed' });
      }
    }
    return {
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private logAudit(
    actor: Actor,
    action: AuditAction,
    entityId: string,
    description: string,
    newValues?: Record<string, unknown>,
  ) {
    this.audit
      .log({
        action,
        entityType: 'InternshipOpportunity',
        entityId,
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.role,
        description,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        newValues,
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));
  }
}
