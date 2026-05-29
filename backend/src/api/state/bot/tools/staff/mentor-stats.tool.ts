import { z } from 'zod';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { BaseTool } from '../base.tool';

/**
 * Input schema for mentor stats tool
 */
const MentorStatsInputSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe('Institution name to filter by (partial match supported, e.g., "Government Polytechnic")'),
});

type MentorStatsInput = z.infer<typeof MentorStatsInputSchema>;

interface MentorWorkload {
  mentorId: string;
  mentorName: string;
  studentCount: number;
  institutionName: string | null;
}

/**
 * Tool for mentor statistics and workload analysis.
 * Calculates total mentors, average students per mentor, and identifies mentors with most/least students.
 */
export class MentorStatsTool extends BaseTool {
  name = 'mentor_stats';

  description = `Get mentor workload statistics. Use this tool when user asks:
- "Mentor workload..."
- "Students per mentor..."
- "Average mentees..."
- "Mentors with most students..."
- "Mentors with least students..."
- "Mentor assignment stats..."
- "How many mentors..."
- "Mentor distribution..."
- "Faculty mentor analysis..."`;

  schema = MentorStatsInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: MentorStatsInput): Promise<string> {
    try {
      let institutionId: string | null = null;
      const appliedFilters: Record<string, unknown> = {};

      // Resolve institution if provided
      if (input.institutionName) {
        institutionId = await this.resolveInstitutionId(input.institutionName);
        if (!institutionId) {
          return this.successResponse({
            totalMentors: 0,
            totalStudentsWithMentors: 0,
            avgStudentsPerMentor: 0,
            mentorsWithMostStudents: [],
            mentorsWithLeastStudents: [],
            filtersApplied: `institution: "${input.institutionName}" (not found)`,
            message: `No institution found matching "${input.institutionName}"`,
          });
        }
        appliedFilters.institution = input.institutionName;
      }

      // Get all active mentor assignments grouped by mentor
      const mentorAssignments = await this.prisma.mentorAssignment.groupBy({
        by: ['mentorId'],
        where: {
          isActive: true,
          ...(institutionId && {
            mentor: {
              institutionId: institutionId,
            },
          }),
        },
        _count: {
          studentId: true,
        },
      });

      // Get mentor details for those with assignments
      const mentorIds = mentorAssignments.map((ma) => ma.mentorId);
      const mentors = await this.prisma.user.findMany({
        where: {
          id: { in: mentorIds },
        },
        select: {
          id: true,
          name: true,
          Institution: {
            select: { name: true },
          },
        },
      });

      // Create mentor lookup map
      const mentorMap = new Map(
        mentors.map((m) => [
          m.id,
          { name: m.name, institutionName: m.Institution?.name || null },
        ]),
      );

      // Build workload list with mentor details
      const workloads: MentorWorkload[] = mentorAssignments
        .map((ma) => {
          const mentor = mentorMap.get(ma.mentorId);
          return {
            mentorId: ma.mentorId,
            mentorName: mentor?.name || 'Unknown',
            studentCount: ma._count.studentId,
            institutionName: mentor?.institutionName || null,
          };
        })
        .sort((a, b) => b.studentCount - a.studentCount);

      const totalMentors = workloads.length;
      const totalStudentsWithMentors = workloads.reduce(
        (sum, w) => sum + w.studentCount,
        0,
      );
      const avgStudentsPerMentor =
        totalMentors > 0
          ? Math.round((totalStudentsWithMentors / totalMentors) * 100) / 100
          : 0;

      // Get top 5 mentors with most students
      const mentorsWithMostStudents = workloads.slice(0, 5).map((w) => ({
        name: w.mentorName,
        studentCount: w.studentCount,
        institution: w.institutionName,
      }));

      // Get bottom 5 mentors with least students (but at least 1)
      const mentorsWithLeastStudents = workloads
        .filter((w) => w.studentCount > 0)
        .slice(-5)
        .reverse()
        .map((w) => ({
          name: w.mentorName,
          studentCount: w.studentCount,
          institution: w.institutionName,
        }));

      // Count faculty who could be mentors but have no active assignments
      const totalFacultyCoordinators = await this.prisma.user.count({
        where: {
          role: { in: ['TEACHER', 'FACULTY_COORDINATOR'] },
          active: true,
          ...(institutionId && { institutionId }),
        },
      });
      const mentorsWithoutStudents = Math.max(0, totalFacultyCoordinators - totalMentors);

      return this.successResponse({
        totalMentors,
        formattedTotalMentors: this.formatNumber(totalMentors),
        totalStudentsWithMentors,
        formattedTotalStudentsWithMentors: this.formatNumber(totalStudentsWithMentors),
        avgStudentsPerMentor,
        mentorsWithoutStudents,
        mentorsWithMostStudents,
        mentorsWithLeastStudents,
        totalFacultyAvailable: totalFacultyCoordinators,
        filtersApplied: this.buildFilterDescription(appliedFilters) || 'all institutions',
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to get mentor statistics',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
