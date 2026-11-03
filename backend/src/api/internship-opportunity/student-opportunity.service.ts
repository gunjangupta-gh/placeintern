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
  computeMissingProfileFields,
  evaluateEligibility,
} from './eligibility.service';
import { SEAT_HOLDING_STATUSES } from './opportunity.constants';
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
  positions: true,
  eligibleYears: true,
  durationMonths: true,
  stipend: true,
  startDate: true,
  applicationDeadline: true,
  status: true,
  isDeleted: true,
  company: { select: { name: true } },
  branches: { select: { branch: { select: { id: true, code: true, name: true } } } },
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

  private async seatsUsed(ids: string[]): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const grouped = await this.prisma.internshipApplication.groupBy({
      by: ['opportunityId'],
      where: { opportunityId: { in: ids }, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
      _count: { _all: true },
    });
    return new Map(grouped.map((g) => [g.opportunityId as string, g._count._all]));
  }

  private present(
    o: StudentViewRow,
    student: StudentContext,
    used: number,
    /** The student's application to THIS opportunity, in any status (incl. rejected). */
    mine: { status: ApplicationStatus } | null,
    hasOtherActive: boolean,
  ) {
    const appliedToThis = !!mine;
    const reasons: EligibilityReason[] = evaluateEligibility({
      student,
      opportunity: {
        status: o.status,
        isDeleted: o.isDeleted,
        positions: o.positions,
        applicationDeadline: o.applicationDeadline,
        eligibleYears: o.eligibleYears,
        branchIds: o.branches.map((b) => b.branch.id),
      },
      seatsUsed: used,
      appliedToThis,
      hasOtherActiveApplication: hasOtherActive,
    });
    return {
      id: o.id,
      title: o.title,
      description: o.description,
      district: o.district,
      company: { name: o.company.name },
      positions: o.positions,
      seatsLeft: Math.max(o.positions - used, 0),
      eligibleYears: o.eligibleYears,
      durationMonths: o.durationMonths,
      stipend: o.stipend,
      startDate: o.startDate,
      applicationDeadline: o.applicationDeadline,
      branches: o.branches.map((b) => ({ code: b.branch.code, name: b.branch.name })),
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
    const blocking = await this.eligibility.findBlockingApplication(student.id);

    const empty = {
      profile: { complete: missing.length === 0, missing },
      activeApplication: blocking
        ? { id: blocking.id, opportunityId: blocking.opportunityId, status: blocking.status, isSelfIdentified: blocking.isSelfIdentified }
        : null,
      data: [] as ReturnType<StudentOpportunityService['present']>[],
      meta: { page: q.page ?? 1, limit: q.limit ?? 20, total: 0, totalPages: 0 },
    };
    if (!branchId) return empty;

    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const now = new Date();

    // Visible = OPEN, not deleted, before deadline, and open to the student's branch.
    // The student's own application stays visible even if it later fills/closes.
    const where: Prisma.InternshipOpportunityWhereInput = {
      isDeleted: false,
      branches: { some: { branchId } },
      OR: [
        { status: OpportunityStatus.OPEN, applicationDeadline: { gte: now } },
        ...(blocking?.opportunityId ? [{ id: blocking.opportunityId }] : []),
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
    const used = await this.seatsUsed(ids);
    const mineRows = await this.prisma.internshipApplication.findMany({
      where: { studentId: student.id, opportunityId: { in: ids } },
      select: { opportunityId: true, status: true },
    });
    const mineById = new Map(mineRows.map((m) => [m.opportunityId as string, { status: m.status }]));

    return {
      ...empty,
      data: rows.map((r) =>
        this.present(r, student, used.get(r.id) ?? 0, mineById.get(r.id) ?? null, !!blocking),
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

    const blocking = await this.eligibility.findBlockingApplication(student.id);
    const used = (await this.seatsUsed([id])).get(id) ?? 0;
    const mine = await this.prisma.internshipApplication.findFirst({
      where: { studentId: student.id, opportunityId: id },
      select: { status: true },
    });
    return this.present(row, student, used, mine, !!blocking);
  }

  /**
   * Apply. All eligibility rules are re-evaluated inside a transaction that holds row locks on
   * the student and the opportunity, so:
   *  - the last seat can be taken by exactly one student, and
   *  - a student cannot end up with two applications through concurrent requests.
   * Lock order is always Student -> Opportunity to avoid deadlocks.
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
          id: true, title: true, positions: true, status: true, isDeleted: true, eligibleYears: true,
          applicationDeadline: true, durationMonths: true, stipend: true, startDate: true,
          company: { select: { name: true, address: true } },
          branches: { select: { branchId: true } },
        },
      });
      if (!student) throw new NotFoundException('Student not found');
      if (!opp) throw new NotFoundException('Internship not found');

      const [seatsUsed, mine, other] = await Promise.all([
        tx.internshipApplication.count({
          where: { opportunityId, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
        }),
        tx.internshipApplication.findFirst({
          where: { studentId: student.id, opportunityId },
          select: { id: true },
        }),
        tx.internshipApplication.findFirst({
          where: { studentId: student.id, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
          select: { id: true },
        }),
      ]);

      const reasons = evaluateEligibility({
        student: student as StudentContext,
        opportunity: {
          status: opp.status,
          isDeleted: opp.isDeleted,
          positions: opp.positions,
          applicationDeadline: opp.applicationDeadline,
          eligibleYears: opp.eligibleYears,
          branchIds: opp.branches.map((b) => b.branchId),
        },
        seatsUsed,
        appliedToThis: !!mine,
        hasOtherActiveApplication: !!other,
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
          internshipPhase: InternshipPhase.NOT_STARTED,
          // Snapshot so existing reports/exports/mentor screens work unchanged
          companyName: opp.company.name,
          companyAddress: opp.company.address ?? undefined,
          jobProfile: opp.title,
          stipend: opp.stipend ?? undefined,
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
