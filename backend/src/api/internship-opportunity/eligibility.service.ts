import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ApplicationStatus, OpportunityStatus, Prisma } from '../../generated/prisma/client';
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
} satisfies Prisma.StudentSelect;

export const STUDENT_CONTEXT_SELECT = {
  id: true,
  userId: true,
  branchId: true,
  institutionId: true,
  currentYear: true,
  ...PROFILE_SELECT,
  user: {
    select: { name: true, email: true, phoneNo: true, dob: true, active: true, branchId: true },
  },
} satisfies Prisma.StudentSelect;

export type StudentContext = Prisma.StudentGetPayload<{ select: typeof STUDENT_CONTEXT_SELECT }>;

export interface EligibilityReason {
  code:
    | 'PROFILE_INCOMPLETE'
    | 'ACCOUNT_INACTIVE'
    | 'NO_BRANCH'
    | 'BRANCH_NOT_ELIGIBLE'
    | 'YEAR_NOT_ELIGIBLE'
    | 'NOT_OPEN'
    | 'DEADLINE_PASSED'
    | 'APPLICATIONS_FULL'
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
  };
  return REQUIRED_PROFILE_FIELDS.filter((f) => !isFilled(values[f.key])).map((f) => ({
    key: f.key,
    label: f.label,
  }));
}

export interface OpportunityForEvaluation {
  status: OpportunityStatus;
  isDeleted: boolean;
  positions: number;
  applicationDeadline: Date;
  eligibleYears: number[];
  branchIds: string[];
}

export interface EvaluationInput {
  student: StudentContext;
  opportunity: OpportunityForEvaluation;
  /** Seat-holding applications currently on this opportunity. */
  seatsUsed: number;
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
  const { student, opportunity, seatsUsed, appliedToThis, hasConfirmedInternship, pendingApplications } = input;
  const now = input.now ?? new Date();
  const reasons: EligibilityReason[] = [];

  const missing = computeMissingProfileFields(student);
  if (missing.length > 0) {
    reasons.push({
      code: 'PROFILE_INCOMPLETE',
      message: `Complete your profile first. Missing: ${missing.map((m) => m.label).join(', ')}`,
    });
  }

  if (!student.user?.active) {
    reasons.push({ code: 'ACCOUNT_INACTIVE', message: 'Your account is not active' });
  }

  const branchId = student.branchId ?? student.user?.branchId ?? null;
  if (!branchId) {
    reasons.push({ code: 'NO_BRANCH', message: 'No branch is assigned to your profile' });
  } else if (!opportunity.branchIds.includes(branchId)) {
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

  if (!appliedToThis && seatsUsed >= opportunity.positions) {
    reasons.push({
      code: 'APPLICATIONS_FULL',
      message: 'All positions for this internship have been taken',
    });
  }

  return reasons;
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
