import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  ApplicationStatus,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  OpportunityStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import { PENDING_DECISION_STATUSES } from './opportunity.constants';
import { applicationOrderBy } from './opportunity.service';
import { sortByComputed, stipendNumber, toOrder } from './list-sort.util';
import { applicationCap, countBranchApplications, computeMissingProfileFields, PROFILE_SELECT } from './eligibility.service';
import {
  IncompleteProfilesQueryDto,
  ListApplicationsQueryDto,
  ListOpportunitiesQueryDto,
} from './dto/opportunity.dto';

export interface Viewer {
  userId: string;
  role: Role;
  institutionId?: string | null;
}

/** Read-only projection: no contact details, no import metadata. */
const PUBLIC_VIEW_SELECT = {
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
  company: { select: { name: true } },
  branches: {
    select: {
      positions: true,
      approvedCount: true,
      maxApplications: true,
      stipend: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  },
} satisfies Prisma.InternshipOpportunitySelect;

/**
 * Read-only views for Principal (own institution) and Teacher / Faculty Coordinator
 * (only their actively-assigned mentees). Least privilege: faculty never see the whole institution.
 */
@Injectable()
export class InstitutionOpportunityService {
  private readonly logger = new Logger(InstitutionOpportunityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
  ) {}

  /**
   * A faculty mentor cancels (withdraws) a PENDING application of one of their own active
   * mentees, e.g. when the student asks them to. The seat and the student's application slot
   * are released. Decided applications (approved / selected / joined / completed / rejected)
   * are not touched; only the State Directorate can undo those.
   * Anything outside the mentor's scope answers "not found" so other students are not revealed.
   */
  async withdrawApplication(v: Viewer, applicationId: string, reason?: string) {
    if (v.role === Role.PRINCIPAL) throw new BadRequestException('Only the faculty mentor can withdraw an application');

    const app = await this.prisma.internshipApplication.findFirst({
      where: { id: applicationId, opportunityId: { not: null }, isActive: true, student: this.studentScope(v) },
      select: {
        id: true,
        status: true,
        studentId: true,
        student: { select: { institutionId: true, user: { select: { name: true } } } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!PENDING_DECISION_STATUSES.includes(app.status)) {
      throw new BadRequestException(
        `Only pending applications can be withdrawn. This one is already ${app.status}.`,
      );
    }

    const note = reason?.trim();
    const now = new Date();
    // Conditional update guards against the Directorate deciding at the same moment
    const res = await this.prisma.internshipApplication.updateMany({
      where: { id: applicationId, status: { in: PENDING_DECISION_STATUSES } },
      data: {
        status: ApplicationStatus.WITHDRAWN,
        isSelected: false,
        reviewRemarks: note ? `Withdrawn by mentor: ${note}` : 'Withdrawn by mentor',
        reviewedAt: now,
        reviewedDate: now,
      },
    });
    if (res.count === 0) throw new ConflictException('Application was updated by someone else. Refresh and retry.');

    await this.cache.invalidateByTags(['applications', `student:${app.studentId}`]).catch(() => undefined);
    this.audit
      .log({
        action: AuditAction.APPLICATION_WITHDRAW,
        entityType: 'InternshipApplication',
        entityId: applicationId,
        userId: v.userId,
        userRole: v.role,
        description: `Mentor withdrew internship application of ${app.student?.user?.name ?? 'a student'}`,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        institutionId: app.student?.institutionId ?? undefined,
        newValues: { reason: note },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));
    return { success: true, applicationId };
  }

  /**
   * The viewer's own branch(es). Faculty: the branch on their account (else the branches of their
   * mentees). Principal: the branches their institution's active students are in.
   */
  private async viewerBranchIds(v: Viewer): Promise<Set<string>> {
    if (v.role !== Role.PRINCIPAL) {
      const u = await this.prisma.user.findUnique({ where: { id: v.userId }, select: { branchId: true } });
      if (u?.branchId) return new Set([u.branchId]);
    }
    const rows = await this.prisma.student.findMany({
      where: this.studentScope(v),
      distinct: ['branchId'],
      select: { branchId: true },
    });
    return new Set(rows.map((r) => r.branchId).filter((x): x is string => !!x));
  }

  private studentScope(v: Viewer): Prisma.StudentWhereInput {
    if (v.role === Role.PRINCIPAL) {
      if (!v.institutionId) throw new BadRequestException('Institution not found for this user');
      return { institutionId: v.institutionId, user: { active: true } };
    }
    return {
      user: { active: true },
      mentorAssignments: { some: { mentorId: v.userId, isActive: true } },
    };
  }

  private page(q: { page?: number; limit?: number }) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    return { page, limit, skip: (page - 1) * limit, take: limit };
  }

  /** Published opportunities (OPEN / FILLED) with seat usage. Same for every viewer; no contacts. */
  async listOpportunities(q: ListOpportunitiesQueryDto, v?: Viewer) {
    const myBranchIds = v ? await this.viewerBranchIds(v) : new Set<string>();
    const { page, limit, skip, take } = this.page(q);
    const where: Prisma.InternshipOpportunityWhereInput = {
      isDeleted: false,
      status: { in: [OpportunityStatus.OPEN, OpportunityStatus.FILLED] },
    };
    if (q.status === 'OPEN' || q.status === 'FILLED') where.status = q.status as OpportunityStatus;
    if (q.branchId) where.branches = { some: { branchId: q.branchId } };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { company: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const order = toOrder(q.sortOrder);
    const direct: Record<string, Prisma.InternshipOpportunityOrderByWithRelationInput> = {
      company: { company: { name: order } },
      district: { district: order },
      deadline: { applicationDeadline: order },
      status: { status: order },
    };
    const tieBreak: Prisma.InternshipOpportunityOrderByWithRelationInput[] = [{ applicationDeadline: 'asc' }, { id: 'asc' }];

    let total: number;
    let rows: Prisma.InternshipOpportunityGetPayload<{ select: typeof PUBLIC_VIEW_SELECT }>[];
    if (q.sortBy === 'stipend' || q.sortBy === 'seatsLeft') {
      // Computed columns (the viewer's own branch stipend, seats left): order the whole filtered set
      // in memory, then load only the requested page.
      const all = await this.prisma.internshipOpportunity.findMany({
        where,
        select: {
          id: true,
          stipend: true,
          branches: { select: { positions: true, approvedCount: true, stipend: true, branchId: true } },
        },
        orderBy: tieBreak,
      });
      total = all.length;
      const key = (o: (typeof all)[number]) => {
        if (q.sortBy === 'seatsLeft') return o.branches.reduce((n, b) => n + Math.max(b.positions - b.approvedCount, 0), 0);
        const nums = o.branches
          .filter((b) => myBranchIds.has(b.branchId))
          .map((b) => stipendNumber(b.stipend ?? o.stipend))
          .filter((n): n is number => n !== null);
        return nums.length ? Math.max(...nums) : null;
      };
      const pageIds = sortByComputed(all, key, order).slice(skip, skip + take).map((o) => o.id);
      const found = await this.prisma.internshipOpportunity.findMany({ where: { id: { in: pageIds } }, select: PUBLIC_VIEW_SELECT });
      const byId = new Map(found.map((o) => [o.id, o]));
      rows = pageIds.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    } else {
      const orderBy = q.sortBy && direct[q.sortBy] ? [direct[q.sortBy], ...tieBreak] : tieBreak;
      [total, rows] = await Promise.all([
        this.prisma.internshipOpportunity.count({ where }),
        this.prisma.internshipOpportunity.findMany({ where, select: PUBLIC_VIEW_SELECT, orderBy, skip, take }),
      ]);
    }
    const byBranch = await countBranchApplications(this.prisma, rows.map((r) => r.id));
    return {
      // Stipend is only shown for the viewer's own branch(es): the branch's stipend, else the
      // opportunity's. Other branches' stipends are not sent.
      data: rows.map(({ branches, stipend, ...r }) => ({
        ...r,
        branches: branches.map((b) => {
          const mine = myBranchIds.has(b.branch.id);
          return {
            ...b.branch,
            positions: b.positions,
            approvedCount: b.approvedCount,
            applicationLimit: applicationCap(b),
            appliedCount: byBranch.get(r.id)?.get(b.branch.id) ?? 0,
            mine,
            stipend: mine ? b.stipend ?? stipend : null,
          };
        }),
        seatsLeft: branches.reduce((n, b) => n + Math.max(b.positions - b.approvedCount, 0), 0),
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Applications made by students in the viewer's scope. */
  async listApplications(v: Viewer, q: ListApplicationsQueryDto) {
    const { page, limit, skip, take } = this.page(q);
    const student: Prisma.StudentWhereInput = { ...this.studentScope(v) };
    if (q.branchId) student.branchId = q.branchId;
    if (q.search) {
      student.user = {
        active: true,
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { rollNumber: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    }
    const where: Prisma.InternshipApplicationWhereInput = {
      opportunityId: q.opportunityId ?? { not: null },
      student,
      ...(q.status ? { status: q.status } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.internshipApplication.count({ where }),
      this.prisma.internshipApplication.findMany({
        where,
        select: {
          id: true,
          status: true,
          appliedDate: true,
          reviewedAt: true,
          rejectionReason: true,
          opportunity: { select: { id: true, title: true, company: { select: { name: true } } } },
          student: {
            select: {
              id: true,
              currentYear: true,
              user: { select: { name: true, rollNumber: true } },
              branch: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: applicationOrderBy(q.sortBy, toOrder(q.sortOrder)),
        skip,
        take,
      }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Students in scope who cannot apply yet because their profile is incomplete. */
  async incompleteProfiles(v: Viewer, q: IncompleteProfilesQueryDto) {
    const { page, limit } = this.page(q);
    const where: Prisma.StudentWhereInput = { ...this.studentScope(v) };
    if (q.branchId) where.branchId = q.branchId;
    if (q.search) {
      where.user = {
        active: true,
        OR: [
          { name: { contains: q.search, mode: 'insensitive' } },
          { rollNumber: { contains: q.search, mode: 'insensitive' } },
        ],
      };
    }

    const students = await this.prisma.student.findMany({
      where,
      take: 5000, // safety cap
      select: {
        id: true,
        currentYear: true,
        branch: { select: { name: true, code: true } },
        ...PROFILE_SELECT,
        user: { select: { name: true, email: true, phoneNo: true, dob: true, rollNumber: true } },
      },
    });

    const incomplete = students
      .map((s) => ({
        studentId: s.id,
        name: s.user?.name ?? null,
        rollNumber: s.user?.rollNumber ?? null,
        branch: s.branch,
        currentYear: s.currentYear,
        missing: computeMissingProfileFields(s),
      }))
      .filter((s) => s.missing.length > 0)
    const byName = sortByComputed(incomplete, (s) => s.name, 'asc');
    const keys: Record<string, (s: (typeof incomplete)[number]) => string | number | null | undefined> = {
      student: (s) => s.name,
      branch: (s) => s.branch?.name,
      year: (s) => s.currentYear,
    };
    const sorted = q.sortBy && keys[q.sortBy] ? sortByComputed(byName, keys[q.sortBy], toOrder(q.sortOrder)) : byName;

    const total = sorted.length;
    return {
      data: sorted.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), studentsChecked: students.length },
    };
  }
}
