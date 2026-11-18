import { BadRequestException } from '@nestjs/common';
import { InternshipCompensationType } from '../../generated/prisma/client';

export const COMPENSATION_TYPES = Object.values(InternshipCompensationType) as InternshipCompensationType[];

export const COMPENSATION_LABELS: Record<InternshipCompensationType, string> = {
  WITH_STIPEND: 'With Stipend',
  WITHOUT_STIPEND: 'Without Stipend',
  PAID_BY_STUDENT: 'Paid by Student',
};

/** Highest amount accepted for either a stipend or a fee (rupees). */
const MAX_AMOUNT = 99_99_999;

export interface CompensationInput {
  internshipType?: unknown;
  stipend?: unknown;
  studentFeeAmount?: unknown;
}

export interface NormalizedCompensation {
  internshipType: InternshipCompensationType;
  /** Monthly stipend in rupees as a string (the column is text), null unless WITH_STIPEND. */
  stipend: string | null;
  /** Fee the student pays the company, null unless PAID_BY_STUDENT. */
  studentFeeAmount: number | null;
}

export function isCompensationType(v: unknown): v is InternshipCompensationType {
  return typeof v === 'string' && (COMPENSATION_TYPES as string[]).includes(v);
}

function amountOf(v: unknown): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function requireAmount(v: unknown, label: string): number {
  const n = amountOf(v);
  if (n === null) throw new BadRequestException(`${label} is required`);
  if (Number.isNaN(n) || n <= 0) throw new BadRequestException(`${label} must be an amount greater than 0`);
  if (n > MAX_AMOUNT) throw new BadRequestException(`${label} is too large`);
  return Math.round(n * 100) / 100;
}

/**
 * Validates a type + its matching amount and returns exactly what should be stored.
 * The amount that does not belong to the chosen type is always cleared, so a student who
 * switches from "With Stipend" to "Paid by Student" never keeps a stale stipend.
 */
export function normalizeCompensation(input: CompensationInput): NormalizedCompensation {
  if (!isCompensationType(input.internshipType)) {
    throw new BadRequestException(
      `Internship type is required: one of ${COMPENSATION_TYPES.join(', ')}`,
    );
  }
  switch (input.internshipType) {
    case InternshipCompensationType.WITH_STIPEND:
      return {
        internshipType: input.internshipType,
        stipend: String(requireAmount(input.stipend, 'Stipend amount')),
        studentFeeAmount: null,
      };
    case InternshipCompensationType.PAID_BY_STUDENT:
      return {
        internshipType: input.internshipType,
        stipend: null,
        studentFeeAmount: requireAmount(input.studentFeeAmount, 'Fee amount'),
      };
    default:
      return { internshipType: input.internshipType, stipend: null, studentFeeAmount: null };
  }
}

export interface CompensationFields {
  internshipType?: InternshipCompensationType | null;
  stipend?: string | null;
  studentFeeAmount?: number | null;
}

/** Which compensation details are still missing on an internship (empty = complete). */
export function missingCompensationFields(app: CompensationFields): { key: string; label: string }[] {
  if (!app.internshipType) return [{ key: 'internshipType', label: 'Internship type' }];
  if (app.internshipType === InternshipCompensationType.WITH_STIPEND) {
    const n = amountOf(app.stipend);
    if (n === null || Number.isNaN(n) || n <= 0) return [{ key: 'stipend', label: 'Stipend amount' }];
  }
  if (app.internshipType === InternshipCompensationType.PAID_BY_STUDENT) {
    const n = amountOf(app.studentFeeAmount);
    if (n === null || Number.isNaN(n) || n <= 0) return [{ key: 'studentFeeAmount', label: 'Fee amount' }];
  }
  return [];
}

/** Prisma `where` fragment matching internships whose compensation details are incomplete. */
export const INCOMPLETE_COMPENSATION_WHERE = {
  OR: [
    { internshipType: null },
    { internshipType: InternshipCompensationType.WITH_STIPEND, OR: [{ stipend: null }, { stipend: { in: ['', '0'] } }] },
    { internshipType: InternshipCompensationType.PAID_BY_STUDENT, OR: [{ studentFeeAmount: null }, { studentFeeAmount: { lte: 0 } }] },
  ],
};
