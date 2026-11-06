import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ApplicationStatus, DocumentType, OpportunityStatus, Prisma } from '../../generated/prisma/client';
import {
  CONFIRMED_STATUSES,
  MAX_PENDING_APPLICATIONS,
  PENDING_DECISION_STATUSES,
  REQUIRED_PROFILE_FIELDS,
  SEAT_HOLDING_STATUSES,
} from './opportunity.constants';

/** Minimal student shape needed to judge profile completeness. */
export const PROFILE_SELECT = {
  gender: true,
  category: true,
  admissionType: true,
  parentName: true,
  parentContact: true,
  address: true,
  pinCode: true,
  tehsil: true,
  district: true,
  city: true,
  state: true,
  user: { select: { name: true, email: true, phoneNo: true, dob: true } },
  /** A resume on the profile is required to apply (at least one active RESUME document). */
  document: { where: { type: DocumentType.RESUME, isDeleted: false }, select: { id: true }, take: 1 },
} satisfies Prisma.StudentSelect;

export const STUDENT_CONTEXT_SELECT = {
  id: true,
  userId: true,
  branchId: true,
  institutionId: true,
  currentYear: true,
  /** An active mentor assignment is required to apply. */
  mentorAssignments: { where: { isActive: true }, select: { id: true }, take: 1 },
  ...PROFILE_SELECT,
  user: {
    select: { name: true, email: true, phoneNo: true, dob: true, active: true, branchId: true },
  },
} satisfies Prisma.StudentSelect;

export type StudentContext = Prisma.StudentGetPayload<{ select: typeof STUDENT_CONTEXT_SELECT }>;

export interface EligibilityReason {
  code:
    | 'PROFILE_INCOMPLETE'
    | 'NO_MENTOR'
    | 'ACCOUNT_INACTIVE'
    | 'NO_BRANCH'
    | 'BRANCH_NOT_ELIGIBLE'
    | 'YEAR_NOT_ELIGIBLE'
    | 'NOT_OPEN'
    | 'DEADLINE_PASSED'
    | 'APPLICATIONS_FULL'
    | 'POSITIONS_FILLED'
    | 'ALREADY_APPLIED'
    | 'HAS_INTERNSHIP'
    | 'MAX_APPLICATIONS_REACHED';
  message: string;
}

export interface MissingField {
  key: string;
  label: string;
}

/** Derive the two numbers evaluateEligibility needs from a student's seat-holding applications. */
export function summariseApplications(holding: Array<{ status: ApplicationStatus }>) {
  return {
    hasConfirmedInternship: holding.some((a) => CONFIRMED_STATUSES.includes(a.status)),
    pendingApplications: holding.filter((a) => PENDING_DECISION_STATUSES.includes(a.status)).length,
  };
}

const isFilled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Single source of truth for "is this student's profile complete enough to apply".
 * Used by the apply endpoint, the browse list banner, and the principal/faculty
 * "incomplete profiles" view.
 */
export function computeMissingProfileFields(
  s: Pick<Prisma.StudentGetPayload<{ select: typeof PROFILE_SELECT }>, keyof typeof PROFILE_SELECT>,
): MissingField[] {
  const values: Record<string, unknown> = {
    name: s.user?.name,
    email: s.user?.email,
    contact: s.user?.phoneNo,
    dob: s.user?.dob,
    parentName: s.parentName,
    parentContact: s.parentContact,
    gender: s.gender,
    admissionType: s.admissionType,
    category: s.category,
    pinCode: s.pinCode,
    address: s.address,
    city: s.city,
    state: s.state,
    tehsil: s.tehsil,
    district: s.district,
    resume: s.document?.length ? 'uploaded' : null,
  };
  return REQUIRED_PROFILE_FIELDS.filter((f) => !isFilled(values[f.key])).map((f) => ({
    key: f.key,
    label: f.label,
  }));
}

/** One branch's slice of an opportunity. */
export interface BranchSlot {
  branchId: string;
  positions: number;
  approvedCount: number;
  /** null = same as positions */
  maxApplications: number | null;
}

/** How many applications a branch accepts before it closes (waiting list included). */
export function applicationCap(slot: Pick<BranchSlot, 'positions' | 'maxApplications'>): number {
  return Math.max(slot.maxApplications ?? slot.positions, slot.positions);
}

export interface OpportunityForEvaluation {
  status: OpportunityStatus;
  isDeleted: boolean;
  applicationDeadline: Date;
  eligibleYears: number[];
  branches: BranchSlot[];
}

export interface EvaluationInput {
  student: StudentContext;
  opportunity: OpportunityForEvaluation;
  /** Seat-holding applications from the student's OWN branch on this opportunity. */
  branchApplications: number;
  /** Student already has an application (any status, incl. rejected) on THIS opportunity. */
  appliedToThis: boolean;
  /** Student already has a confirmed internship (approved / selected / joined / completed). */
  hasConfirmedInternship: boolean;
  /** Student's pending applications (applied / under review / shortlisted), across all opportunities. */
  pendingApplications: number;
  now?: Date;
}

/**
 * Pure eligibility evaluation. Returns every reason that blocks applying (empty = eligible).
 * Pure so the exact same rules run for the browse list and again, under lock, inside the apply
 * transaction.
 */
export function evaluateEligibility(input: EvaluationInput): EligibilityReason[] {
  const { student, opportunity, branchApplications, appliedToThis, hasConfirmedInternship, pendingApplications } = input;
  const now = input.now ?? new Date();
  const reasons: EligibilityReason[] = [];

  const missing = computeMissingProfileFields(student);
  if (missing.length > 0) {
    reasons.push({
      code: 'PROFILE_INCOMPLETE',
      message: `Complete your profile first. Missing: ${missing.map((m) => m.label).join(', ')}`,
    });
  }

  if (!student.mentorAssignments?.length) {
    reasons.push({
      code: 'NO_MENTOR',
      message: 'You have no active mentor assigned. Contact your institution to get a faculty mentor assigned before applying',
    });
  }

  if (!student.user?.active) {
    reasons.push({ code: 'ACCOUNT_INACTIVE', message: 'Your account is not active' });
  }

  const branchId = student.branchId ?? student.user?.branchId ?? null;
  const slot = branchId ? opportunity.branches.find((b) => b.branchId === branchId) : undefined;
  if (!branchId) {
    reasons.push({ code: 'NO_BRANCH', message: 'No branch is assigned to your profile' });
  } else if (!slot) {
    reasons.push({
      code: 'BRANCH_NOT_ELIGIBLE',
      message: 'This internship is not open for your branch',
    });
  }

  if (
    opportunity.eligibleYears.length > 0 &&
    (!student.currentYear || !opportunity.eligibleYears.includes(student.currentYear))
  ) {
    reasons.push({
      code: 'YEAR_NOT_ELIGIBLE',
      message: `Open only for year ${opportunity.eligibleYears.join(', ')} students`,
    });
  }

  if (opportunity.isDeleted || opportunity.status !== OpportunityStatus.OPEN) {
    reasons.push({ code: 'NOT_OPEN', message: 'This internship is not open for applications' });
  } else if (now.getTime() > opportunity.applicationDeadline.getTime()) {
    reasons.push({ code: 'DEADLINE_PASSED', message: 'The application deadline has passed' });
  }

  if (appliedToThis) {
    reasons.push({ code: 'ALREADY_APPLIED', message: 'You have already applied to this internship' });
  } else if (hasConfirmedInternship) {
    reasons.push({ code: 'HAS_INTERNSHIP', message: 'You already have an internship' });
  } else if (pendingApplications >= MAX_PENDING_APPLICATIONS) {
    reasons.push({
      code: 'MAX_APPLICATIONS_REACHED',
      message: `You can apply to at most ${MAX_PENDING_APPLICATIONS} internships at a time`,
    });
  }

  // Branch-wise seats: a student only competes with students of the same branch
  if (slot && !appliedToThis) {
    if (slot.approvedCount >= slot.positions) {
      reasons.push({
        code: 'POSITIONS_FILLED',
        message: 'All positions for your branch have been filled',
      });
    } else if (branchApplications >= applicationCap(slot)) {
      reasons.push({
        code: 'APPLICATIONS_FULL',
        message: 'Applications for your branch are full',
      });
    }
  }

  return reasons;
}

/** Where-clause matching students of a branch (falls back to the user's branch like the apply flow). */
export function studentInBranch(branchId: string): Prisma.StudentWhereInput {
  return { OR: [{ branchId }, { branchId: null, user: { branchId } }] };
}

/**
 * Seat-holding applications per opportunity per branch (oppId -> branchId -> count).
 * Accepts the global client or a transaction client.
 */
export async function countBranchApplications(
  db: Pick<PrismaService, 'internshipApplication'>,
  opportunityIds: string[],
): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  if (!opportunityIds.length) return out;
  const rows = await db.internshipApplication.findMany({
    where: { opportunityId: { in: opportunityIds }, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
    select: { opportunityId: true, student: { select: { branchId: true, user: { select: { branchId: true } } } } },
  });
  for (const r of rows) {
    const branchId = r.student?.branchId ?? r.student?.user?.branchId;
    if (!r.opportunityId || !branchId) continue;
    const perBranch = out.get(r.opportunityId) ?? new Map<string, number>();
    perBranch.set(branchId, (perBranch.get(branchId) ?? 0) + 1);
    out.set(r.opportunityId, perBranch);
  }
  return out;
}

@Injectable()
export class EligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getStudentContext(userId: string): Promise<StudentContext> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: STUDENT_CONTEXT_SELECT,
    });
    if (!student) throw new NotFoundException('Student not found');
    return student;
  }

  /** All of the student's seat-holding applications (opportunity-based and self-identified). */
  async listHoldingApplications(studentId: string) {
    return this.prisma.internshipApplication.findMany({
      where: { studentId, isActive: true, status: { in: SEAT_HOLDING_STATUSES } },
      select: { id: true, opportunityId: true, status: true, isSelfIdentified: true },
      orderBy: { appliedDate: 'asc' },
    });
  }

  /** Profile completeness summary for the student UI banner. */
  async getProfileStatus(userId: string) {
    const student = await this.getStudentContext(userId);
    const missing = computeMissingProfileFields(student);
    return { complete: missing.length === 0, missing };
  }
}
