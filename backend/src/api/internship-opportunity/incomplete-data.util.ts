import { PrismaService } from '../../core/database/prisma.service';
import { ApplicationStatus, Prisma } from '../../generated/prisma/client';
import { missingCompensationFields } from '../../common/utils/internship-compensation.util';
import { computeMissingProfileFields, MissingField, PROFILE_SELECT } from './eligibility.service';

export interface IncompleteStudent {
  studentId: string;
  name: string | null;
  rollNumber: string | null;
  branch: { name: string; code: string } | null;
  /** Active mentor, null when the student has none */
  mentor: { id: string; name: string | null } | null;
  /** Everything still missing: profile fields first, then internship type / stipend / fee */
  missing: MissingField[];
}

/**
 * Students (within `where`) whose profile OR internship compensation details are incomplete.
 * One definition shared by the principal "Incomplete Data" dashboard card and the
 * Incomplete profiles table, so the card count always matches the table.
 */
export async function findIncompleteStudents(
  prisma: PrismaService,
  where: Prisma.StudentWhereInput,
  take = 5000,
): Promise<{ checked: number; incomplete: IncompleteStudent[] }> {
  const students = await prisma.student.findMany({
    where,
    take,
    select: {
      id: true,
      branch: { select: { name: true, code: true } },
      ...PROFILE_SELECT,
      user: { select: { name: true, email: true, phoneNo: true, dob: true, rollNumber: true } },
      mentorAssignments: {
        where: { isActive: true },
        orderBy: { assignmentDate: 'desc' },
        take: 1,
        select: { mentor: { select: { id: true, name: true } } },
      },
      internshipApplications: {
        where: {
          // Only self-identified internships: a State opportunity's stipend is set by the Directorate
          isSelfIdentified: true,
          isActive: true,
          status: { notIn: [ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN] },
        },
        select: { internshipType: true, stipend: true, studentFeeAmount: true },
      },
    },
  });

  const incomplete: IncompleteStudent[] = [];
  for (const s of students) {
    const missing: MissingField[] = [...computeMissingProfileFields(s)];
    for (const app of s.internshipApplications) {
      for (const f of missingCompensationFields(app)) {
        if (!missing.some((m) => m.key === f.key)) missing.push(f);
      }
    }
    if (missing.length === 0) continue;
    incomplete.push({
      studentId: s.id,
      name: s.user?.name ?? null,
      rollNumber: s.user?.rollNumber ?? null,
      branch: s.branch,
      mentor: s.mentorAssignments[0]?.mentor ?? null,
      missing,
    });
  }
  return { checked: students.length, incomplete };
}
