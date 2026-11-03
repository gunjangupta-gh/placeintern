import { ApplicationStatus, Prisma } from '../../generated/prisma/client';
import { APPLICATION_STATUS_GROUPS } from './opportunity.constants';

export interface ApplicationFilterInput {
  opportunityId?: string;
  institutionId?: string;
  branchId?: string;
  status?: ApplicationStatus;
  /** PENDING | SELECTED | CLOSED (see APPLICATION_STATUS_GROUPS). Wins over `status`. */
  group?: string;
  search?: string;
}

/**
 * Where-clause for State-side application lists and the Excel export.
 * One place, so the table on screen and the downloaded file always agree.
 */
export function buildApplicationWhere(q: ApplicationFilterInput): Prisma.InternshipApplicationWhereInput {
  const student: Prisma.StudentWhereInput = {};
  if (q.institutionId) student.institutionId = q.institutionId;
  if (q.branchId) student.branchId = q.branchId;
  if (q.search) {
    student.user = {
      OR: [
        { name: { contains: q.search, mode: 'insensitive' } },
        { rollNumber: { contains: q.search, mode: 'insensitive' } },
      ],
    };
  }

  const statuses = q.group ? APPLICATION_STATUS_GROUPS[q.group] : undefined;
  return {
    opportunityId: q.opportunityId ?? { not: null },
    student,
    ...(statuses ? { status: { in: statuses } } : q.status ? { status: q.status } : {}),
  };
}
