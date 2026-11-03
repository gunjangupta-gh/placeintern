import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { OpportunityStatus, Prisma, Role } from '../../generated/prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

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
  async listOpportunities(q: ListOpportunitiesQueryDto) {
    const { page, limit, skip, take } = this.page(q);
    const where: Prisma.InternshipOpportunityWhereInput = {
      isDeleted: false,
      status: { in: [OpportunityStatus.OPEN, OpportunityStatus.FILLED] },
    };
    if (q.branchId) where.branches = { some: { branchId: q.branchId } };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { company: { name: { contains: q.search, mode: 'insensitive' } } },
      ];
    }
    const [total, rows] = await Promise.all([
      this.prisma.internshipOpportunity.count({ where }),
      this.prisma.internshipOpportunity.findMany({
        where,
        select: PUBLIC_VIEW_SELECT,
        orderBy: { applicationDeadline: 'asc' },
        skip,
        take,
      }),
    ]);
    const byBranch = await countBranchApplications(this.prisma, rows.map((r) => r.id));
    return {
      data: rows.map(({ branches, ...r }) => ({
        ...r,
        branches: branches.map((b) => ({
          ...b.branch,
          positions: b.positions,
          approvedCount: b.approvedCount,
          applicationLimit: applicationCap(b),
          appliedCount: byBranch.get(r.id)?.get(b.branch.id) ?? 0,
        })),
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
        orderBy: [{ appliedDate: 'asc' }, { id: 'asc' }],
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
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    const total = incomplete.length;
    return {
      data: incomplete.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), studentsChecked: students.length },
    };
  }
}
