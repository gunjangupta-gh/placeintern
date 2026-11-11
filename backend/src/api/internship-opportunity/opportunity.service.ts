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
import { parseMonthlyStipend } from './stipend.util';
import { sortByComputed, stipendNumber, toOrder } from './list-sort.util';
import { applicationCap, countBranchApplications, studentInBranch } from './eligibility.service';
import {
  ApproveApplicationDto,
  CreateOpportunityDto,
  ListApplicationsQueryDto,
  ListOpportunitiesQueryDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';

/** Column sort for application lists (State view). Unknown keys keep first-come-first-served. */
export function applicationOrderBy(sortBy: string | undefined, order: 'asc' | 'desc'): Prisma.InternshipApplicationOrderByWithRelationInput[] {
  const tie: Prisma.InternshipApplicationOrderByWithRelationInput[] = [{ appliedDate: 'asc' }, { id: 'asc' }];
  const map: Record<string, Prisma.InternshipApplicationOrderByWithRelationInput> = {
    rank: { appliedDate: order },
    appliedDate: { appliedDate: order },
    institution: { student: { Institution: { name: order } } },
    student: { student: { user: { name: order } } },
    branch: { student: { branch: { name: order } } },
    position: { opportunity: { title: order } },
    status: { status: order },
  };
  return sortBy && map[sortBy] ? [map[sortBy], ...tie] : tie;
}

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
  institutionName: true,
  pocName: true,
  pocPhone: true,
  importBatchId: true,
  createdAt: true,
  company: { select: { id: true, name: true } },
  branches: {
    select: {
      positions: true,
      approvedCount: true,
      maxApplications: true,
      stipend: true,
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: { branch: { name: 'asc' } },
  },
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
    /** Seat-holding applications per branch on this opportunity. */
    perBranch: Map<string, number> = new Map(),
  ) {
    const { branches, ...rest } = o;
    const shaped = branches.map((b) => {
      const branchApplied = perBranch.get(b.branch.id) ?? 0;
      const limit = applicationCap(b);
      return {
        ...b.branch,
        positions: b.positions,
        approvedCount: b.approvedCount,
        maxApplications: b.maxApplications,
        stipend: b.stipend,
        applicationLimit: limit,
        appliedCount: branchApplied,
        seatsLeft: Math.max(b.positions - b.approvedCount, 0),
        applicationsLeft: Math.max(limit - branchApplied, 0),
      };
    });
    return {
      ...rest,
      branches: shaped,
      appliedCount: applied,
      applicationLimit: shaped.reduce((n, b) => n + b.applicationLimit, 0),
      seatsLeft: shaped.reduce((n, b) => n + b.seatsLeft, 0),
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
    const order = toOrder(q.sortOrder);
    const direct: Record<string, Prisma.InternshipOpportunityOrderByWithRelationInput> = {
      company: { company: { name: order } },
      district: { district: order },
      seats: { positions: order },
      deadline: { applicationDeadline: order },
      status: { status: order },
    };
    const tieBreak: Prisma.InternshipOpportunityOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'asc' }];

    let total: number;
    let items: Prisma.InternshipOpportunityGetPayload<{ select: typeof DIRECTOR_SELECT }>[];
    if (q.sortBy === 'stipend') {
      // Stipend is free text with a computed "highest branch amount", so order the whole filtered
      // set in memory (ids only) and then load just the requested page.
      const all = await this.prisma.internshipOpportunity.findMany({
        where,
        select: { id: true, stipend: true, branches: { select: { stipend: true } } },
        orderBy: tieBreak,
      });
      total = all.length;
      const amount = (o: (typeof all)[number]) => {
        const nums = o.branches.map((b) => stipendNumber(b.stipend ?? o.stipend)).filter((n): n is number => n !== null);
        return nums.length ? Math.max(...nums) : stipendNumber(o.stipend);
      };
      const pageIds = sortByComputed(all, amount, order).slice(skip, skip + take).map((o) => o.id);
      const found = await this.prisma.internshipOpportunity.findMany({ where: { id: { in: pageIds } }, select: DIRECTOR_SELECT });
      const byId = new Map(found.map((o) => [o.id, o]));
      items = pageIds.map((id) => byId.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
    } else {
      const orderBy = q.sortBy && direct[q.sortBy] ? [direct[q.sortBy], ...tieBreak] : tieBreak;
      [total, items] = await Promise.all([
        this.prisma.internshipOpportunity.count({ where }),
        this.prisma.internshipOpportunity.findMany({ where, select: DIRECTOR_SELECT, orderBy, skip, take }),
      ]);
    }
    const ids = items.map((i) => i.id);
    const counts = await this.appliedCounts(ids);
    const byBranch = await countBranchApplications(this.prisma, ids);
    return {
      data: items.map((i) => this.shape(i, counts.get(i.id) ?? 0, byBranch.get(i.id))),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Headline numbers for the State dashboard cards. Covers published internships (OPEN and
   * FILLED; drafts, closed and deleted ones are left out).
   *  - vacancies: total positions, and per branch (with how many are already selected)
   *  - averageStipend: per month, weighted by vacancies, over the vacancies whose stipend text
   *    has a usable amount (branch stipend, else the opportunity's); coverage says how many
   */
  async stats() {
    const scope = { isDeleted: false, status: { in: [OpportunityStatus.OPEN, OpportunityStatus.FILLED] } };
    const [opps, received, waiting] = await Promise.all([
      this.prisma.internshipOpportunity.findMany({
        where: scope,
        select: {
          status: true,
          stipend: true,
          branches: {
            select: { positions: true, approvedCount: true, stipend: true, branch: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      this.prisma.internshipApplication.count({
        where: { opportunity: scope, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
      }),
      this.prisma.internshipApplication.count({
        where: { opportunity: scope, isActive: true, status: { in: PENDING_DECISION_STATUSES } },
      }),
    ]);

    const byBranch = new Map<string, { code: string; name: string; positions: number; selected: number }>();
    let vacancies = 0;
    let selected = 0;
    let stipendTotal = 0;
    let stipendVacancies = 0;
    for (const o of opps) {
      for (const b of o.branches) {
        vacancies += b.positions;
        selected += b.approvedCount;
        const row = byBranch.get(b.branch.id) ?? { code: b.branch.code, name: b.branch.name, positions: 0, selected: 0 };
        row.positions += b.positions;
        row.selected += b.approvedCount;
        byBranch.set(b.branch.id, row);

        const amount = parseMonthlyStipend(b.stipend ?? o.stipend);
        if (amount !== null) {
          stipendTotal += amount * b.positions;
          stipendVacancies += b.positions;
        }
      }
    }

    return {
      opportunities: opps.length,
      openOpportunities: opps.filter((o) => o.status === OpportunityStatus.OPEN).length,
      vacancies,
      selected,
      vacanciesLeft: Math.max(vacancies - selected, 0),
      branchWise: Array.from(byBranch.values()).sort((a, b) => b.positions - a.positions || a.code.localeCompare(b.code)),
      averageStipend: stipendVacancies ? Math.round(stipendTotal / stipendVacancies) : null,
      stipendCoverage: { counted: stipendVacancies, total: vacancies },
      applications: { received, waiting },
    };
  }

  async getOne(id: string) {
    const opp = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: DIRECTOR_SELECT,
    });
    if (!opp) throw new NotFoundException('Opportunity not found');
    const counts = await this.appliedCounts([id]);
    const byBranch = await countBranchApplications(this.prisma, [id]);
    return this.shape(opp, counts.get(id) ?? 0, byBranch.get(id));
  }

  /**
   * Add one opportunity through the form. Same rules as the Excel upload: company matched
   * case-insensitively or created, deadline today or later, start after the deadline,
   * branch-wise positions / application limits / stipend, no duplicate (company + position + start date).
   */
  async create(dto: CreateOpportunityDto, actor: Actor) {
    const title = dto.title.replace(/\s+/g, ' ').trim();
    const companyName = dto.companyName.replace(/\s+/g, ' ').trim();
    if (!title) throw new BadRequestException('Position title cannot be empty');
    if (!companyName) throw new BadRequestException('Company name cannot be empty');

    const startCal = parseApiDate(dto.startDate);
    const deadlineCal = parseApiDate(dto.applicationDeadline);
    if (!startCal) throw new BadRequestException('startDate is not a valid date');
    if (!deadlineCal) throw new BadRequestException('applicationDeadline is not a valid date');
    const startDate = startOfDayIST(startCal);
    const deadline = endOfDayIST(deadlineCal);
    if (startOfDayIST(deadlineCal) < todayStartIST()) {
      throw new BadRequestException('applicationDeadline cannot be in the past');
    }
    if (startDate.getTime() <= deadline.getTime()) {
      throw new BadRequestException('Start date must be after the application deadline');
    }

    const ids = dto.branches.map((b) => b.branchId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('A branch can only be listed once');
    const known = await this.prisma.branch.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, name: true },
    });
    if (known.length !== ids.length) throw new BadRequestException('One or more branches are invalid');
    const nameOf = new Map(known.map((b) => [b.id, b.name]));
    for (const b of dto.branches) {
      if (b.maxApplications != null && b.maxApplications < b.positions) {
        throw new BadRequestException(
          `${nameOf.get(b.branchId)}: the application limit cannot be less than the positions (${b.positions})`,
        );
      }
    }

    const found = await this.prisma.company.findFirst({
      where: { name: { equals: companyName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (found) {
      const clash = await this.prisma.internshipOpportunity.findFirst({
        where: { isDeleted: false, companyId: found.id, title: { equals: title, mode: 'insensitive' }, startDate },
        select: { id: true },
      });
      if (clash) {
        throw new ConflictException('This opportunity already exists (same company, position and start date)');
      }
    }

    const text = (v?: string) => (v && v.trim() ? v.trim() : null);
    const id = await this.prisma.$transaction(async (tx) => {
      const companyId = found
        ? found.id
        : (await tx.company.create({ data: { name: companyName }, select: { id: true } })).id;
      const created = await tx.internshipOpportunity.create({
        data: {
          companyId,
          title,
          description: text(dto.description),
          district: text(dto.district),
          positions: dto.branches.reduce((n, b) => n + b.positions, 0),
          eligibleYears: Array.from(new Set(dto.eligibleYears ?? [])).sort(),
          durationMonths: dto.durationMonths,
          stipend: text(dto.stipend),
          startDate,
          applicationDeadline: deadline,
          status: (dto.status as OpportunityStatus) ?? OpportunityStatus.OPEN,
          contactName: text(dto.contactName),
          contactPhone: text(dto.contactPhone),
          contactEmail: text(dto.contactEmail),
          institutionName: text(dto.institutionName),
          pocName: text(dto.pocName),
          pocPhone: text(dto.pocPhone),
          createdById: actor.userId,
          branches: {
            create: dto.branches.map((b) => ({
              branchId: b.branchId,
              positions: b.positions,
              maxApplications: b.maxApplications ?? null,
              stipend: text(b.stipend ?? undefined),
            })),
          },
        },
        select: { id: true },
      });
      return created.id;
    });

    this.logAudit(actor, AuditAction.INTERNSHIP_CREATE, id, `Created internship opportunity: ${title} at ${companyName}`);
    await this.cache.invalidateByTags(['applications']).catch(() => undefined);
    return this.getOne(id);
  }

  /**
   * Edit any field of an opportunity. Only the keys that are sent change.
   *  - Company: matched case-insensitively or created.
   *  - Branches carry their own positions and application limit (`branches` replaces the whole list).
   *    A branch's positions can never drop below its selected students, and its application limit
   *    (default = positions) never below its current applications.
   *  - A branch can only be removed if none of its students have applied.
   *  - Deadline is only checked against "today" when it is actually changed, so an expired
   *    opportunity can still have its other fields (or status) edited.
   *  - Editing cannot create a duplicate (same company, position and start date) of another one.
   *  - An empty string clears an optional text field.
   */
  async update(id: string, dto: UpdateOpportunityDto, actor: Actor) {
    const existing = await this.prisma.internshipOpportunity.findFirst({
      where: { id, isDeleted: false },
      select: {
        id: true, status: true, startDate: true,
        applicationDeadline: true, companyId: true, title: true,
        branches: { select: { branchId: true, positions: true, approvedCount: true } },
      },
    });
    if (!existing) throw new NotFoundException('Opportunity not found');

    const data: Prisma.InternshipOpportunityUpdateInput = {};

    // Plain text fields. '' clears the optional ones.
    if (dto.title !== undefined) {
      const title = dto.title.replace(/\s+/g, ' ').trim();
      if (!title) throw new BadRequestException('Position title cannot be empty');
      data.title = title;
    }
    for (const key of ['description', 'district', 'stipend', 'contactName', 'contactPhone', 'contactEmail', 'institutionName', 'pocName', 'pocPhone'] as const) {
      if (dto[key] !== undefined) (data as any)[key] = dto[key].trim() === '' ? null : dto[key].trim();
    }
    if (dto.durationMonths !== undefined) data.durationMonths = dto.durationMonths;
    if (dto.eligibleYears !== undefined) data.eligibleYears = Array.from(new Set(dto.eligibleYears)).sort();

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

    // Branch-wise positions + application limits
    let slots = existing.branches.map((b) => ({ positions: b.positions, approvedCount: b.approvedCount }));
    if (dto.branches) {
      const wanted = dto.branches;
      const wantedIds = wanted.map((w) => w.branchId);
      if (new Set(wantedIds).size !== wantedIds.length) {
        throw new BadRequestException('A branch can only be listed once');
      }
      const known = await this.prisma.branch.findMany({
        where: { id: { in: wantedIds }, isActive: true },
        select: { id: true, name: true },
      });
      if (known.length !== wantedIds.length) throw new BadRequestException('One or more branches are invalid');
      const nameOf = new Map(known.map((b) => [b.id, b.name]));

      const applicantsByBranch = (await countBranchApplications(this.prisma, [id])).get(id) ?? new Map<string, number>();
      const current = new Map(existing.branches.map((b) => [b.branchId, b]));

      for (const w of wanted) {
        const name = nameOf.get(w.branchId);
        const selected = current.get(w.branchId)?.approvedCount ?? 0;
        const branchApplied = applicantsByBranch.get(w.branchId) ?? 0;
        if (w.positions < selected) {
          throw new BadRequestException(`${name}: positions cannot be less than the ${selected} student(s) already selected`);
        }
        if (w.maxApplications != null && w.maxApplications < w.positions) {
          throw new BadRequestException(`${name}: the application limit cannot be less than the positions (${w.positions})`);
        }
        const limit = w.maxApplications ?? w.positions;
        if (limit < branchApplied) {
          throw new BadRequestException(
            `${name}: the application limit cannot be below the ${branchApplied} application(s) already received`,
          );
        }
      }

      // A branch can only be removed if none of its students have applied
      const removed = existing.branches.filter((b) => !wantedIds.includes(b.branchId));
      const blocked = removed.filter((b) => (applicantsByBranch.get(b.branchId) ?? 0) > 0 || b.approvedCount > 0);
      if (blocked.length) {
        const names = await this.prisma.branch.findMany({
          where: { id: { in: blocked.map((b) => b.branchId) } },
          select: { name: true },
        });
        throw new BadRequestException(
          `Cannot remove branch(es) ${names.map((n) => n.name).join(', ')}: students from them have already applied`,
        );
      }

      data.branches = {
        deleteMany: { branchId: { notIn: wantedIds } },
        upsert: wanted.map((w) => ({
          where: { opportunityId_branchId: { opportunityId: id, branchId: w.branchId } },
          create: { branchId: w.branchId, positions: w.positions, maxApplications: w.maxApplications ?? null, stipend: w.stipend?.trim() || null },
          update: { positions: w.positions, maxApplications: w.maxApplications ?? null, stipend: w.stipend?.trim() || null },
        })),
      };
      slots = wanted.map((w) => ({
        positions: w.positions,
        approvedCount: current.get(w.branchId)?.approvedCount ?? 0,
      }));
      data.positions = slots.reduce((n, b) => n + b.positions, 0);
      data.approvedCount = slots.reduce((n, b) => n + b.approvedCount, 0);
    }

    // Status: FILLED is automatic (every branch has taken all its positions)
    if (dto.status) data.status = dto.status as OpportunityStatus;
    const finalStatus = (data.status as OpportunityStatus | undefined) ?? existing.status;
    if (slots.length > 0 && slots.every((b) => b.approvedCount >= b.positions)) {
      data.status = OpportunityStatus.FILLED;
    } else if (finalStatus === OpportunityStatus.FILLED) {
      // positions were raised (or a branch added) on a filled opportunity -> reopen
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
              branchId: true,
              currentYear: true,
              user: { select: { name: true, email: true, rollNumber: true, phoneNo: true, branchId: true } },
              Institution: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true, code: true } },
            },
          },
        },
        // First come, first served unless a column sort is asked for; id breaks ties so paging is stable
        orderBy: applicationOrderBy(q.sortBy, toOrder(q.sortOrder)),
        skip,
        take,
      }),
    ]);
    return {
      data: await this.withQueue(items),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Adds the first-come-first-served queue to each application:
   *  - queue.rank:         1 = applied first among the (still active) applicants of the same
   *                        branch on the same opportunity - the people it competes with
   *  - queue.pendingAhead: earlier applicants of that branch still waiting for a decision
   *  - branchSeat:         that branch's positions / selected / application limit
   */
  private async withQueue<
    T extends {
      id: string;
      opportunity: { id: string } | null;
      student: { branchId: string | null; user: { branchId: string | null } | null } | null;
    },
  >(items: T[]) {
    const oppIds = Array.from(new Set(items.map((i) => i.opportunity?.id).filter((x): x is string => !!x)));
    if (!oppIds.length) return items.map((i) => ({ ...i, queue: null, branchSeat: null }));

    const [holders, seats] = await Promise.all([
      this.prisma.internshipApplication.findMany({
        where: { opportunityId: { in: oppIds }, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
        select: {
          id: true,
          opportunityId: true,
          status: true,
          student: { select: { branchId: true, user: { select: { branchId: true } } } },
        },
        orderBy: [{ appliedDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.opportunityBranch.findMany({
        where: { opportunityId: { in: oppIds } },
        select: { opportunityId: true, branchId: true, positions: true, approvedCount: true, maxApplications: true },
      }),
    ]);

    const counters = new Map<string, { n: number; pending: number }>();
    const queue = new Map<string, { rank: number; pendingAhead: number }>();
    for (const h of holders) {
      const branchId = h.student?.branchId ?? h.student?.user?.branchId;
      const key = `${h.opportunityId}|${branchId}`;
      const c = counters.get(key) ?? { n: 0, pending: 0 };
      queue.set(h.id, { rank: c.n + 1, pendingAhead: c.pending });
      c.n += 1;
      if (PENDING_DECISION_STATUSES.includes(h.status)) c.pending += 1;
      counters.set(key, c);
    }
    const seatOf = new Map(seats.map((b) => [`${b.opportunityId}|${b.branchId}`, b]));

    return items.map((i) => {
      const branchId = i.student?.branchId ?? i.student?.user?.branchId;
      const seat = seatOf.get(`${i.opportunity?.id}|${branchId}`);
      return {
        ...i,
        queue: queue.get(i.id) ?? null,
        branchSeat: seat
          ? {
              positions: seat.positions,
              approvedCount: seat.approvedCount,
              applicationLimit: applicationCap(seat),
            }
          : null,
      };
    });
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
        select: { id: true, studentId: true, status: true, startDate: true, endDate: true, appliedDate: true },
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

      // Positions are per branch: the student takes a seat in THEIR branch
      const stu = await tx.student.findUnique({
        where: { id: app.studentId },
        select: { branchId: true, user: { select: { branchId: true } } },
      });
      const studentBranchId = stu?.branchId ?? stu?.user?.branchId ?? null;
      const slot = studentBranchId
        ? await tx.opportunityBranch.findUnique({
            where: { opportunityId_branchId: { opportunityId: opp.id, branchId: studentBranchId } },
            select: { positions: true, approvedCount: true, branch: { select: { name: true } } },
          })
        : null;
      if (!slot || !studentBranchId) {
        throw new BadRequestException("This student's branch is not eligible for this opportunity");
      }
      if (slot.approvedCount >= slot.positions) {
        throw new BadRequestException(
          `All ${slot.positions} position(s) for ${slot.branch.name} are already filled`,
        );
      }

      // Earlier applicants of the same branch who are still waiting (priority is first-come-first-served)
      const skippedEarlier = await tx.internshipApplication.count({
        where: {
          opportunityId: opp.id,
          isActive: true,
          id: { not: applicationId },
          status: { in: PENDING_DECISION_STATUSES },
          student: studentInBranch(studentBranchId),
          OR: [
            { appliedDate: { lt: app.appliedDate } },
            { appliedDate: app.appliedDate, id: { lt: app.id } },
          ],
        },
      });

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

      await tx.opportunityBranch.update({
        where: { opportunityId_branchId: { opportunityId: opp.id, branchId: studentBranchId } },
        data: { approvedCount: { increment: 1 } },
      });
      // FILLED only when EVERY branch has taken all its positions
      const allSlots = await tx.opportunityBranch.findMany({
        where: { opportunityId: opp.id },
        select: { positions: true, approvedCount: true },
      });
      await tx.internshipOpportunity.update({
        where: { id: opp.id },
        data: {
          approvedCount: { increment: 1 },
          ...(allSlots.every((b) => b.approvedCount >= b.positions) ? { status: OpportunityStatus.FILLED } : {}),
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
        skippedEarlier,
      };
    });

    await this.expectedCycle
      .recalculateExpectedCounts(applicationId)
      .catch((e) => this.logger.warn(`Expected counts failed for ${applicationId}: ${e?.message}`));
    await this.cache.invalidateByTags(['applications', `student:${result.studentId}`]).catch(() => undefined);
    this.logAudit(actor, AuditAction.APPLICATION_APPROVE, applicationId, `Approved internship at ${result.company} (${result.title})`, {
      remarks: dto.remarks,
      otherApplicationsWithdrawn: result.withdrawn,
      skippedEarlierApplicants: result.skippedEarlier,
    });
    return {
      success: true,
      applicationId,
      withdrawnOtherApplications: result.withdrawn,
      skippedEarlierApplicants: result.skippedEarlier,
    };
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
   * Move a pending application between the non-final statuses (under review / shortlisted).
   * The student keeps the seat and the application slot; approve / reject still decide it.
   */
  async markStatus(
    applicationId: string,
    status: typeof ApplicationStatus.UNDER_REVIEW | typeof ApplicationStatus.SHORTLISTED,
    remarks: string | undefined,
    actor: Actor,
  ) {
    const app = await this.prisma.internshipApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, studentId: true, status: true, opportunityId: true },
    });
    if (!app?.opportunityId) throw new NotFoundException('Application not found');
    if (!PENDING_DECISION_STATUSES.includes(app.status)) {
      throw new BadRequestException(`Application is already ${app.status}`);
    }
    if (app.status === status) return { success: true, applicationId };
    const res = await this.prisma.internshipApplication.updateMany({
      where: { id: applicationId, status: { in: PENDING_DECISION_STATUSES } },
      data: { status, ...(remarks?.trim() ? { reviewRemarks: remarks.trim() } : {}) },
    });
    if (res.count === 0) throw new ConflictException('Application was updated by someone else. Refresh and retry.');

    await this.cache.invalidateByTags(['applications', `student:${app.studentId}`]).catch(() => undefined);
    this.logAudit(actor, AuditAction.APPLICATION_UPDATE, applicationId, `Marked internship application as ${status}`, { status, remarks });
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
        const stu = await tx.student.findUnique({
          where: { id: pre.studentId },
          select: { branchId: true, user: { select: { branchId: true } } },
        });
        const studentBranchId = stu?.branchId ?? stu?.user?.branchId ?? null;
        // Release the seat in the student's branch (guarded so the count never goes negative)
        if (studentBranchId) {
          await tx.opportunityBranch.updateMany({
            where: { opportunityId: pre.opportunityId, branchId: studentBranchId, approvedCount: { gt: 0 } },
            data: { approvedCount: { decrement: 1 } },
          });
        }
        const opp = await tx.internshipOpportunity.findUnique({
          where: { id: pre.opportunityId },
          select: { approvedCount: true, status: true },
        });
        if (opp) {
          await tx.internshipOpportunity.update({
            where: { id: pre.opportunityId },
            data: {
              approvedCount: Math.max(opp.approvedCount - 1, 0),
              // a seat just opened, so a FILLED opportunity is open again
              ...(opp.status === OpportunityStatus.FILLED ? { status: OpportunityStatus.OPEN } : {}),
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
    action: 'APPROVE' | 'REJECT' | 'DELETE' | 'UNDER_REVIEW' | 'SHORTLISTED',
    applicationIds: string[],
    remarks: string | undefined,
    actor: Actor,
  ) {
    if (action === 'REJECT' && !remarks?.trim()) {
      throw new BadRequestException('A reason (remarks) is required to reject');
    }
    const results: Array<{ applicationId: string; ok: boolean; error?: string; skippedEarlier?: number }> = [];
    let ordered = Array.from(new Set(applicationIds));
    if (action === 'APPROVE') {
      // Earliest applicant first: when a branch has fewer seats than selected students,
      // the seats go to whoever applied first (id breaks an exact tie).
      const dates = await this.prisma.internshipApplication.findMany({
        where: { id: { in: ordered } },
        select: { id: true, appliedDate: true },
      });
      const at = new Map(dates.map((d) => [d.id, d.appliedDate.getTime()]));
      ordered = ordered.sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0) || a.localeCompare(b));
    }
    // Sequential on purpose: approvals lock the opportunity row, and order keeps seat use predictable
    for (const id of ordered) {
      try {
        let skippedEarlier: number | undefined;
        if (action === 'APPROVE') {
          skippedEarlier = (await this.approve(id, { remarks }, actor)).skippedEarlierApplicants;
        } else if (action === 'DELETE') await this.deleteApplication(id, actor);
        else if (action === 'UNDER_REVIEW' || action === 'SHORTLISTED') await this.markStatus(id, ApplicationStatus[action], remarks, actor);
        else await this.reject(id, remarks!.trim(), actor);
        results.push({ applicationId: id, ok: true, skippedEarlier });
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
