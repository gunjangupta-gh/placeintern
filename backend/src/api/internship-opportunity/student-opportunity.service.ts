import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CacheService } from '../../core/cache/cache.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  ApplicationStatus,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  InternshipPhase,
  OpportunityStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import {
  EligibilityReason,
  EligibilityService,
  StudentContext,
  applicationCap,
  computeMissingProfileFields,
  countBranchApplications,
  evaluateEligibility,
  studentInBranch,
  summariseApplications,
} from './eligibility.service';
import { MAX_PENDING_APPLICATIONS, SEAT_HOLDING_STATUSES } from './opportunity.constants';
import { addMonthsIST } from './opportunity-dates.util';
import { PageQueryDto } from './dto/opportunity.dto';

/**
 * Student-facing projection. Deliberately has NO contact fields and no importBatchId /
 * createdById: industry contact details must never reach students.
 */
const STUDENT_VIEW_SELECT = {
  id: true,
  title: true,
  description: true,
  district: true,
  eligibleYears: true,
  durationMonths: true,
  stipend: true,
  startDate: true,
  applicationDeadline: true,
  status: true,
  isDeleted: true,
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

type StudentViewRow = Prisma.InternshipOpportunityGetPayload<{ select: typeof STUDENT_VIEW_SELECT }>;

@Injectable()
export class StudentOpportunityService {
  private readonly logger = new Logger(StudentOpportunityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly audit: AuditService,
    private readonly eligibility: EligibilityService,
  ) {}

  private branchOf(s: StudentContext): string | null {
    return s.branchId ?? s.user?.branchId ?? null;
  }

  /**
   * Queue position of the student's own application among the seat-holding applications of
   * the same branch on the same opportunity (1 = applied first). Null if not applied / closed.
   */
  private async queuePosition(studentId: string, opportunityId: string, branchId: string | null) {
    if (!branchId) return null;
    const mine = await this.prisma.internshipApplication.findFirst({
      where: { studentId, opportunityId, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
      select: { appliedDate: true, id: true },
    });
    if (!mine) return null;
    const ahead = await this.prisma.internshipApplication.count({
      where: {
        opportunityId,
        isActive: true,
        status: { in: SEAT_HOLDING_STATUSES },
        student: studentInBranch(branchId),
        OR: [
          { appliedDate: { lt: mine.appliedDate } },
          { appliedDate: mine.appliedDate, id: { lt: mine.id } },
        ],
      },
    });
    return ahead + 1;
  }

  private present(
    o: StudentViewRow,
    student: StudentContext,
    /** Seat-holding applications per branch on THIS opportunity. */
    perBranch: Map<string, number>,
    /** The student's application to THIS opportunity, in any status (incl. rejected). */
    mine: { status: ApplicationStatus } | null,
    summary: { hasConfirmedInternship: boolean; pendingApplications: number },
    queuePosition: number | null = null,
  ) {
    const appliedToThis = !!mine;
    const branchId = this.branchOf(student);
    const slots = o.branches.map((b) => ({
      branchId: b.branch.id,
      positions: b.positions,
      approvedCount: b.approvedCount,
      maxApplications: b.maxApplications,
    }));
    const mySlot = branchId ? slots.find((b) => b.branchId === branchId) : undefined;
    const myApplications = branchId ? perBranch.get(branchId) ?? 0 : 0;

    const reasons: EligibilityReason[] = evaluateEligibility({
      student,
      opportunity: {
        status: o.status,
        isDeleted: o.isDeleted,
        applicationDeadline: o.applicationDeadline,
        eligibleYears: o.eligibleYears,
        branches: slots,
      },
      branchApplications: myApplications,
      appliedToThis,
      ...summary,
    });

    // The numbers the student cares about are THEIR branch's: that is who they compete with.
    const myCap = mySlot ? applicationCap(mySlot) : 0;
    const myPositions = mySlot?.positions ?? 0;
    const mySeatsLeft = mySlot ? Math.max(mySlot.positions - mySlot.approvedCount, 0) : 0;
    return {
      id: o.id,
      title: o.title,
      description: o.description,
      district: o.district,
      company: { name: o.company.name },
      // Student's own branch (what they compete for)
      positions: myPositions,
      seatsLeft: mySeatsLeft,
      applicationsReceived: myApplications,
      applicationLimit: myCap,
      applicationsLeft: Math.max(myCap - myApplications, 0),
      queuePosition,
      eligibleYears: o.eligibleYears,
      durationMonths: o.durationMonths,
      // The student's own branch stipend, falling back to the opportunity's
      stipend: o.branches.find((b) => b.branch.id === branchId)?.stipend ?? o.stipend,
      startDate: o.startDate,
      applicationDeadline: o.applicationDeadline,
      // Every branch the internship is open to, with its own positions
      branches: o.branches.map((b) => ({
        code: b.branch.code,
        name: b.branch.name,
        positions: b.positions,
        stipend: b.stipend ?? o.stipend,
        mine: b.branch.id === branchId,
      })),
      applied: appliedToThis,
      applicationStatus: appliedToThis ? mine!.status : null,
      canApply: reasons.length === 0,
      reasons,
    };
  }

  /** Branch-filtered list of opportunities the student can see, annotated with eligibility. */
  async listForStudent(userId: string, q: PageQueryDto) {
    const student = await this.eligibility.getStudentContext(userId);
    const branchId = this.branchOf(student);
    const missing = computeMissingProfileFields(student);
    const holding = await this.eligibility.listHoldingApplications(student.id);
    const summary = summariseApplications(holding);

    const empty = {
      profile: { complete: missing.length === 0, missing },
      applicationLimit: MAX_PENDING_APPLICATIONS,
      pendingApplications: summary.pendingApplications,
      hasConfirmedInternship: summary.hasConfirmedInternship,
      applications: holding.map((a) => ({
        id: a.id,
        opportunityId: a.opportunityId,
        status: a.status,
        isSelfIdentified: a.isSelfIdentified,
      })),
      data: [] as any[],
      meta: { page: q.page ?? 1, limit: q.limit ?? 20, total: 0, totalPages: 0 },
    };
    if (!branchId) return empty;

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();

    // Visible = OPEN, not deleted, before deadline, and open to the student's branch.
    // The student's own applications stay visible even if the opportunity later fills/closes.
    const myOpportunityIds = holding.map((a) => a.opportunityId).filter((id): id is string => !!id);
    const where: Prisma.InternshipOpportunityWhereInput = {
      isDeleted: false,
      branches: { some: { branchId } },
      OR: [
        { status: OpportunityStatus.OPEN, applicationDeadline: { gte: now } },
        ...(myOpportunityIds.length ? [{ id: { in: myOpportunityIds } }] : []),
      ],
      ...(q.search
        ? {
            AND: [
              {
                OR: [
                  { title: { contains: q.search, mode: 'insensitive' as const } },
                  { company: { name: { contains: q.search, mode: 'insensitive' as const } } },
                  { district: { contains: q.search, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.internshipOpportunity.count({ where }),
      this.prisma.internshipOpportunity.findMany({
        where,
        select: STUDENT_VIEW_SELECT,
        orderBy: [{ applicationDeadline: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const ids = rows.map((r) => r.id);
    const used = await countBranchApplications(this.prisma, ids);
    const mineRows = await this.prisma.internshipApplication.findMany({
      where: { studentId: student.id, opportunityId: { in: ids } },
      select: { opportunityId: true, status: true },
    });
    const mineById = new Map(mineRows.map((m) => [m.opportunityId as string, { status: m.status }]));
    const queueById = new Map<string, number | null>();
    for (const m of mineRows) {
      if (SEAT_HOLDING_STATUSES.includes(m.status)) {
        queueById.set(m.opportunityId as string, await this.queuePosition(student.id, m.opportunityId as string, branchId));
      }
    }

    return {
      ...empty,
      data: rows.map((r) =>
        this.present(r, student, used.get(r.id) ?? new Map(), mineById.get(r.id) ?? null, summary, queueById.get(r.id) ?? null),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getForStudent(userId: string, id: string) {
    const student = await this.eligibility.getStudentContext(userId);
    const branchId = this.branchOf(student);
    if (!branchId) throw new NotFoundException('Internship not found');

    const row = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false, branches: { some: { branchId } } },
      select: STUDENT_VIEW_SELECT,
    });
    if (!row) throw new NotFoundException('Internship not found');

    const summary = summariseApplications(await this.eligibility.listHoldingApplications(student.id));
    const used = (await countBranchApplications(this.prisma, [id])).get(id) ?? new Map();
    const mine = await this.prisma.internshipApplication.findFirst({
      where: { studentId: student.id, opportunityId: id },
      select: { status: true },
    });
    const queue = mine && SEAT_HOLDING_STATUSES.includes(mine.status) ? await this.queuePosition(student.id, id, branchId) : null;
    return this.present(row, student, used, mine, summary, queue);
  }

  /**
   * Apply. All eligibility rules are re-evaluated inside a transaction that holds row locks on
   * the student and the opportunity, so:
   *  - the last seat can be taken by exactly one student, and
   *  - a student cannot exceed the pending-application limit through concurrent requests.
   * Lock order is always Student -> Opportunity (also used by approve) to avoid deadlocks.
   * The opportunity row lock also serialises applicants, so each branch's application cap is exact
   * and appliedDate (set at insert, under the lock) reflects the true first-come-first-served order.
   */
  async apply(userId: string, opportunityId: string) {
    const ctx = await this.eligibility.getStudentContext(userId);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${ctx.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM internship_opportunities WHERE id = ${opportunityId} FOR UPDATE`;

      // Re-read everything after the locks are held
      const student = await tx.student.findUnique({
        where: { id: ctx.id },
        select: {
          id: true, userId: true, branchId: true, institutionId: true, currentYear: true,
          gender: true, category: true, admissionType: true, parentName: true, parentContact: true,
          address: true, pinCode: true, tehsil: true, district: true, city: true, state: true,
          user: { select: { name: true, email: true, phoneNo: true, dob: true, active: true, branchId: true } },
        },
      });
      const opp = await tx.internshipOpportunity.findFirst({
        where: { id: opportunityId, isDeleted: false },
        select: {
          id: true, title: true, status: true, isDeleted: true, eligibleYears: true,
          applicationDeadline: true, durationMonths: true, stipend: true, startDate: true,
          company: { select: { name: true, address: true } },
          branches: { select: { branchId: true, positions: true, approvedCount: true, maxApplications: true, stipend: true } },
        },
      });
      if (!student) throw new NotFoundException('Student not found');
      if (!opp) throw new NotFoundException('Internship not found');

      const studentBranchId = student.branchId ?? student.user?.branchId ?? null;
      const [branchApplications, mine, holding] = await Promise.all([
        studentBranchId
          ? tx.internshipApplication.count({
              where: {
                opportunityId,
                isActive: true,
                status: { in: SEAT_HOLDING_STATUSES },
                student: studentInBranch(studentBranchId),
              },
            })
          : Promise.resolve(0),
        tx.internshipApplication.findFirst({
          where: { studentId: student.id, opportunityId },
          select: { id: true },
        }),
        tx.internshipApplication.findMany({
          where: { studentId: student.id, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
          select: { status: true },
        }),
      ]);

      const reasons = evaluateEligibility({
        student: student as StudentContext,
        opportunity: {
          status: opp.status,
          isDeleted: opp.isDeleted,
          applicationDeadline: opp.applicationDeadline,
          eligibleYears: opp.eligibleYears,
          branches: opp.branches,
        },
        branchApplications,
        appliedToThis: !!mine,
        ...summariseApplications(holding),
      });
      if (reasons.length > 0) {
        throw new BadRequestException({
          message: reasons[0].message,
          code: reasons[0].code,
          reasons,
        });
      }

      return tx.internshipApplication.create({
        data: {
          studentId: student.id,
          opportunityId: opp.id,
          isSelfIdentified: false,
          isActive: true,
          status: ApplicationStatus.APPLIED,
          // Explicit (not the DB default, which is the transaction START time, i.e. before any lock
          // wait) so this timestamp is the true first-come-first-served order.
          appliedDate: new Date(),
          internshipPhase: InternshipPhase.NOT_STARTED,
          // Snapshot so existing reports/exports/mentor screens work unchanged
          companyName: opp.company.name,
          companyAddress: opp.company.address ?? undefined,
          jobProfile: opp.title,
          // branch-wise stipend if the student's branch has its own, else the opportunity's
          stipend: opp.branches.find((b) => b.branchId === studentBranchId)?.stipend ?? opp.stipend ?? undefined,
          internshipDuration: `${opp.durationMonths} month${opp.durationMonths > 1 ? 's' : ''}`,
          startDate: opp.startDate,
          endDate: addMonthsIST(opp.startDate, opp.durationMonths),
        },
        select: { id: true, status: true, opportunityId: true },
      });
    });

    await this.cache.invalidateByTags(['applications', `student:${ctx.id}`]).catch(() => undefined);
    this.audit
      .log({
        action: AuditAction.APPLICATION_SUBMIT,
        entityType: 'InternshipApplication',
        entityId: created.id,
        userId,
        userName: ctx.user?.name ?? undefined,
        userRole: Role.STUDENT,
        description: `Applied to internship opportunity ${opportunityId}`,
        category: AuditCategory.APPLICATION_PROCESS,
        severity: AuditSeverity.MEDIUM,
        institutionId: ctx.institutionId ?? undefined,
        newValues: { applicationId: created.id, opportunityId },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));

    return { applicationId: created.id, status: created.status };
  }
}
