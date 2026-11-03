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
import {
  CONFIRMED_STATUSES,
  PENDING_DECISION_STATUSES,
  SEAT_HOLDING_STATUSES,
} from './opportunity.constants';
import {
  addMonthsIST,
  endOfDayIST,
  parseApiDate,
  startOfDayIST,
  todayStartIST,
} from './opportunity-dates.util';
import { buildApplicationWhere } from './application-filters';
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

  /**
   * Edit any field of an opportunity. Only the keys that are sent change.
   *  - Company: matched case-insensitively or created.
   *  - Positions can never drop below current applications / approved students.
   *  - Branches: may be added freely; a branch can only be removed if no applicant belongs to it.
   *  - Deadline is only checked against "today" when it is actually changed, so an expired
   *    opportunity can still have its other fields (or status) edited.
   *  - Editing cannot create a duplicate (same company, position and start date) of another one.
   *  - An empty string clears an optional text field.
   */
  async update(id: string, dto: UpdateOpportunityDto, actor: Actor) {
    const existing = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true, status: true, positions: true, approvedCount: true, startDate: true,
        applicationDeadline: true, companyId: true, title: true,
      },
    });
    if (!existing) throw new NotFoundException('Opportunity not found');

    const applied = (await this.appliedCounts([id])).get(id) ?? 0;
    const data: Prisma.InternshipOpportunityUpdateInput = {};

    // Plain text fields. '' clears the optional ones.
    if (dto.title !== undefined) {
      const title = dto.title.replace(/\s+/g, ' ').trim();
      if (!title) throw new BadRequestException('Position title cannot be empty');
      data.title = title;
    }
    for (const key of ['description', 'district', 'stipend', 'contactName', 'contactPhone', 'contactEmail'] as const) {
      if (dto[key] !== undefined) (data as any)[key] = dto[key].trim() === '' ? null : dto[key].trim();
    }
    if (dto.durationMonths !== undefined) data.durationMonths = dto.durationMonths;
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
      const next = endOfDayIST(c);
      // Only a *changed* deadline must be today or later
      if (next.getTime() !== existing.applicationDeadline.getTime() && startOfDayIST(c) < todayStartIST()) {
        throw new BadRequestException('applicationDeadline cannot be in the past');
      }
      deadline = next;
      data.applicationDeadline = deadline;
    }
    if ((dto.startDate || dto.applicationDeadline) && start.getTime() <= deadline.getTime()) {
      throw new BadRequestException('Start date must be after the application deadline');
    }

    // Company: link to an existing one now, create a new one only when saving
    let newCompanyName: string | null = null;
    let companyId = existing.companyId;
    if (dto.companyName !== undefined) {
      const name = dto.companyName.replace(/\s+/g, ' ').trim();
      if (!name) throw new BadRequestException('Company name cannot be empty');
      const found = await this.prisma.company.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (found) {
        companyId = found.id;
        if (found.id !== existing.companyId) data.company = { connect: { id: found.id } };
      } else {
        newCompanyName = name;
        companyId = '';
      }
    }

    // No duplicate of another opportunity (same company + position + start date)
    const finalTitle = (data.title as string | undefined) ?? existing.title;
    if (companyId && (dto.title !== undefined || dto.startDate || dto.companyName !== undefined)) {
      const clash = await this.prisma.internshipOpportunity.findFirst({
        where: {
          id: { not: id }, isDeleted: false, companyId,
          title: { equals: finalTitle, mode: 'insensitive' }, startDate: start,
        },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('Another opportunity with the same company, position and start date already exists');
      }
    }

    // Eligible branches: add freely; only remove a branch if none of its students have applied
    if (dto.branchIds) {
      const wanted = Array.from(new Set(dto.branchIds));
      const found = await this.prisma.branch.count({ where: { id: { in: wanted }, isActive: true } });
      if (found !== wanted.length) throw new BadRequestException('One or more branches are invalid');

      if (applied > 0) {
        const holders = await this.prisma.internshipApplication.findMany({
          where: { opportunityId: id, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
          select: { student: { select: { branchId: true } } },
        });
        const needed = new Set(holders.map((h) => h.student?.branchId).filter((b): b is string => !!b));
        const missing = [...needed].filter((b) => !wanted.includes(b));
        if (missing.length) {
          const names = await this.prisma.branch.findMany({ where: { id: { in: missing } }, select: { name: true } });
          throw new BadRequestException(
            `Cannot remove branch(es) ${names.map((n) => n.name).join(', ')}: students from them have already applied`,
          );
        }
      }
      data.branches = { deleteMany: {}, create: wanted.map((branchId) => ({ branchId })) };
    }

    // Status: FILLED is automatic; it follows positions vs approved students
    if (dto.status) data.status = dto.status as OpportunityStatus;
    const finalStatus = (data.status as OpportunityStatus | undefined) ?? existing.status;
    if (existing.approvedCount >= positions) {
      data.status = OpportunityStatus.FILLED;
    } else if (finalStatus === OpportunityStatus.FILLED) {
      // positions were raised on a filled opportunity -> reopen
      data.status = OpportunityStatus.OPEN;
    }

    await this.prisma.$transaction(async (tx) => {
      if (newCompanyName) {
        const company = await tx.company.create({ data: { name: newCompanyName }, select: { id: true } });
        data.company = { connect: { id: company.id } };
      }
      await tx.internshipOpportunity.update({ where: { id }, data, select: { id: true } });
    });

    this.logAudit(actor, AuditAction.INTERNSHIP_UPDATE, id, 'Updated internship opportunity', {
      fields: Object.keys(dto),
    });
    await this.cache.invalidateByTags(['applications']).catch(() => undefined);
    return this.getOne(id);
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
    const where = buildApplicationWhere(q);
    const [total, items] = await Promise.all([
      this.prisma.internshipApplication.count({ where }),
      this.prisma.internshipApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          internshipPhase: true,
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
              user: { select: { name: true, email: true, rollNumber: true, phoneNo: true } },
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
        select: { opportunityId: true, studentId: true },
      });
      if (!pre?.opportunityId) throw new NotFoundException('Application not found');

      // Lock Student -> Opportunity (same order as apply, so no deadlocks).
      // Student lock: two approvals for the same student on different opportunities must not race.
      // Opportunity lock: positions can never be over-approved.
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${pre.studentId} FOR UPDATE`;
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

      // A student can only be placed once
      const alreadyPlaced = await tx.internshipApplication.findFirst({
        where: {
          studentId: app.studentId,
          isActive: true,
          id: { not: applicationId },
          status: { in: CONFIRMED_STATUSES },
        },
        select: { id: true },
      });
      if (alreadyPlaced) {
        throw new BadRequestException('This student already has an approved internship');
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

      // The student now has an internship: release their other pending applications
      // (frees those seats) so they can never be approved for a second one.
      const withdrawn = await tx.internshipApplication.updateMany({
        where: {
          studentId: app.studentId,
          id: { not: applicationId },
          opportunityId: { not: null },
          status: { in: PENDING_DECISION_STATUSES },
        },
        data: {
          status: ApplicationStatus.WITHDRAWN,
          reviewRemarks: 'Auto-withdrawn: student was approved for another internship',
          reviewedAt: now,
          reviewedDate: now,
        },
      });

      return {
        studentId: app.studentId,
        title: opp.title,
        company: opp.company.name,
        withdrawn: withdrawn.count,
      };
    });

    await this.expectedCycle
      .recalculateExpectedCounts(applicationId)
      .catch((e) => this.logger.warn(`Expected counts failed for ${applicationId}: ${e?.message}`));
    await this.cache.invalidateByTags(['applications', `student:${result.studentId}`]).catch(() => undefined);
    this.logAudit(actor, AuditAction.APPLICATION_APPROVE, applicationId, `Approved internship at ${result.company} (${result.title})`, {
      remarks: dto.remarks,
      otherApplicationsWithdrawn: result.withdrawn,
    });
    return { success: true, applicationId, withdrawnOtherApplications: result.withdrawn };
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

  /**
   * Permanently delete an application (director only).
   *  - Pending / rejected / withdrawn: simply removed. The student's slot and the seat are freed,
   *    and the student may apply to that opportunity again.
   *  - Confirmed (approved / selected / joined / completed): this is an UNDO of the approval.
   *    The opportunity's approved count is reduced (and it reopens if it was FILLED).
   *  - Refused when monthly reports or faculty visits already exist, because they are deleted
   *    together with the application and that would destroy records.
   * Locks Student -> Opportunity like apply and approve.
   */
  async deleteApplication(applicationId: string, actor: Actor) {
    const result = await this.prisma.$transaction(async (tx) => {
      const pre = await tx.internshipApplication.findUnique({
        where: { id: applicationId },
        select: { opportunityId: true, studentId: true },
      });
      if (!pre?.opportunityId) throw new NotFoundException('Application not found');

      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${pre.studentId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM internship_opportunities WHERE id = ${pre.opportunityId} FOR UPDATE`;

      const app = await tx.internshipApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          status: true,
          _count: { select: { monthlyReports: true, facultyVisitLogs: true } },
        },
      });
      if (!app) throw new NotFoundException('Application not found');

      if (app._count.monthlyReports > 0 || app._count.facultyVisitLogs > 0) {
        throw new BadRequestException(
          `Cannot delete: this internship already has ${app._count.monthlyReports} monthly report(s) and ${app._count.facultyVisitLogs} visit(s) recorded.`,
        );
      }

      const wasConfirmed = CONFIRMED_STATUSES.includes(app.status);
      if (wasConfirmed) {
        const opp = await tx.internshipOpportunity.findUnique({
          where: { id: pre.opportunityId },
          select: { positions: true, approvedCount: true, status: true },
        });
        if (opp) {
          const newCount = Math.max(opp.approvedCount - 1, 0);
          await tx.internshipOpportunity.update({
            where: { id: pre.opportunityId },
            data: {
              approvedCount: newCount,
              ...(opp.status === OpportunityStatus.FILLED && newCount < opp.positions
                ? { status: OpportunityStatus.OPEN }
                : {}),
            },
          });
        }
      }

      await tx.internshipApplication.delete({ where: { id: applicationId } });
      return { studentId: pre.studentId, wasConfirmed, status: app.status };
    });

    await this.cache.invalidateByTags(['applications', `student:${result.studentId}`]).catch(() => undefined);
    this.logAudit(
      actor,
      AuditAction.INTERNSHIP_DELETE,
      applicationId,
      result.wasConfirmed ? 'Deleted a confirmed internship application (approval undone)' : 'Deleted an internship application',
      { previousStatus: result.status },
    );
    return { success: true, applicationId, approvalUndone: result.wasConfirmed };
  }

  async bulkAction(
    action: 'APPROVE' | 'REJECT' | 'DELETE',
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
        else if (action === 'DELETE') await this.deleteApplication(id, actor);
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
