import { ApplicationStatus, Prisma } from '../../../generated/prisma/client';

/**
 * Statuses at which a State-published opportunity application counts as a real internship.
 * (Pending / rejected / withdrawn applications are NOT internships yet.)
 */
export const CONFIRMED_INTERNSHIP_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.SELECTED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.JOINED,
  ApplicationStatus.COMPLETED,
];

/**
 * "Internship record" filter for InternshipApplication, replacing the old bare
 * `isSelfIdentified: true`. Spread it into a `where`:
 *
 *   where: { studentId, ...INTERNSHIP_RECORD_WHERE }
 *
 * Matches:
 *  - every self-identified application (exactly what `isSelfIdentified: true` matched before), and
 *  - State-opportunity applications once confirmed (approved / selected / joined / completed).
 *
 * Written as NOT(non-self-identified AND not-confirmed) so it can be spread alongside a
 * caller's own `OR` / `AND` without overwriting them.
 * Do not spread into a `select`, `data` or `orderBy`. Do not use it where only self-identified
 * records may be touched (e.g. deleting or editing a student's own entry).
 */
export const INTERNSHIP_RECORD_WHERE: Prisma.InternshipApplicationWhereInput = {
  NOT: {
    isSelfIdentified: false,
    status: { notIn: CONFIRMED_INTERNSHIP_STATUSES },
  },
};
