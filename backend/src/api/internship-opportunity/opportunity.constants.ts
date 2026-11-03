import { ApplicationStatus } from '../../generated/prisma/client';

/**
 * Application statuses that occupy a seat on an opportunity AND block the student
 * from applying anywhere else (a student may hold only one application).
 * REJECTED / WITHDRAWN are intentionally absent: they free both the seat and the student.
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
