import { ApplicationStatus } from '../../generated/prisma/client';

/** A student may have at most this many pending applications at the same time. */
export const MAX_PENDING_APPLICATIONS = 2;

/**
 * Application statuses that occupy a seat on an opportunity and count toward the student's
 * applications. REJECTED / WITHDRAWN are intentionally absent: they free both the seat and
 * the student's slot.
 */
export const SEAT_HOLDING_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.SELECTED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.JOINED,
  ApplicationStatus.COMPLETED,
];

/**
 * The student has actually got an internship (approved, selected, joined or completed).
 * Such a student cannot apply for more, and cannot be approved a second time.
 */
export const CONFIRMED_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SELECTED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.JOINED,
  ApplicationStatus.COMPLETED,
];

/**
 * Filter groups for application lists. SELECTED covers every status a confirmed student passes
 * through (the daily job moves APPROVED -> JOINED -> COMPLETED), so "selected students" never
 * disappears from the list after the start date.
 */
export const APPLICATION_STATUS_GROUPS: Record<string, ApplicationStatus[]> = {
  PENDING: [ApplicationStatus.APPLIED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SHORTLISTED],
  SELECTED: [
    ApplicationStatus.SELECTED,
    ApplicationStatus.APPROVED,
    ApplicationStatus.JOINED,
    ApplicationStatus.COMPLETED,
  ],
  CLOSED: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN],
};

/** Statuses the director may still approve/reject (i.e. not yet decided). */
export const PENDING_DECISION_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.SHORTLISTED,
];

/**
 * Fields a student must have filled before applying. Mirrors the required fields on the
 * student profile page (StudentProfile.jsx) plus date of birth and admission type, which the
 * profile form also marks as required. Keys are logical names resolved in computeMissingProfileFields.
 */
export const REQUIRED_PROFILE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'contact', label: 'Contact' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'parentName', label: 'Parent Name' },
  { key: 'parentContact', label: 'Parent Contact' },
  { key: 'gender', label: 'Gender' },
  { key: 'admissionType', label: 'Admission Type' },
  { key: 'category', label: 'Category' },
  { key: 'pinCode', label: 'Pin Code' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City/Village' },
  { key: 'state', label: 'State' },
  { key: 'tehsil', label: 'Tehsil' },
  { key: 'district', label: 'District' },
];

export const MAX_IMPORT_ROWS = 500;
export const MAX_POSITIONS_PER_ROW = 500;
export const MAX_DURATION_MONTHS = 24;
export const VALID_ELIGIBLE_YEARS = [1, 2, 3];
