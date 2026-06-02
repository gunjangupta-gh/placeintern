import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';

/**
 * Input schema for student count tool
 */
const StudentCountInputSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe('Institution name to filter by (partial match supported, e.g., "Government Polytechnic")'),
  branchCode: z
    .string()
    .optional()
    .describe('Branch code to filter by (e.g., "CS", "ME", "EE", "CE", "ECE")'),
  isActive: z
    .boolean()
    .optional()
    .describe('Filter by active status: true for active students, false for inactive'),
  internshipPhase: z
    .enum(['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED'])
    .optional()
    .describe('Filter by internship phase: NOT_STARTED, ACTIVE, COMPLETED, or TERMINATED'),
  hasMentor: z
    .boolean()
    .optional()
    .describe('Filter by mentor assignment: true for students with mentors, false for students without'),
});

type StudentCountInput = z.infer<typeof StudentCountInputSchema>;

/**
 * Tool to count students with optional filters.
 * Use this when user asks about total students, student counts, or how many students.
 */
export class StudentCountTool extends BaseTool {
  name = 'student_count';

  description = `Count students with optional filters. Use this tool when user asks:
- "How many students are there?"
- "Total students..."
- "Student count..."
- "Number of students..."
- "Students in [institution/branch]..."
- "Active/inactive students..."
- "Students with/without mentors..."
- "Students who completed/started internships..."`;

  schema = StudentCountInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: StudentCountInput): Promise<string> {
    try {
      // Build the where clause based on filters
      const where: Prisma.StudentWhereInput = {};
      const appliedFilters: Record<string, unknown> = {};

      // Institution filter - filter via User relation
      if (input.institutionName) {
        const institutionId = await this.resolveInstitutionId(input.institutionName);
        if (institutionId) {
          where.institutionId = institutionId;
          appliedFilters.institution = input.institutionName;
        } else {
          // Institution not found, return 0 with message
          return this.successResponse({
            count: 0,
            filtersApplied: `institution: "${input.institutionName}" (not found)`,
            message: `No institution found matching "${input.institutionName}"`,
          });
        }
      }

      // Branch filter
      if (input.branchCode) {
        const branchId = await this.resolveBranchId(input.branchCode);
        if (branchId) {
          where.branchId = branchId;
          appliedFilters.branch = input.branchCode;
        } else {
          return this.successResponse({
            count: 0,
            filtersApplied: `branch: "${input.branchCode}" (not found)`,
            message: `No branch found matching "${input.branchCode}"`,
          });
        }
      }

      // Active status filter - via User relation
      if (input.isActive !== undefined) {
        where.user = {
          ...((where.user as Prisma.UserWhereInput) || {}),
          active: input.isActive,
        };
        appliedFilters.status = input.isActive ? 'active' : 'inactive';
      }

      // Mentor assignment filter
      if (input.hasMentor !== undefined) {
        if (input.hasMentor) {
          where.mentorAssignments = {
            some: { isActive: true },
          };
          appliedFilters.mentor = 'assigned';
        } else {
          // Students without active mentor assignments
          where.AND = [
            ...(Array.isArray(where.AND) ? where.AND : []),
            {
              OR: [
                { mentorAssignments: { none: {} } },
                { mentorAssignments: { every: { isActive: false } } },
              ],
            },
          ];
          appliedFilters.mentor = 'not assigned';
        }
      }

      // Internship phase filter
      if (input.internshipPhase) {
        where.internshipApplications = {
          some: { internshipPhase: input.internshipPhase },
        };
        appliedFilters.internshipPhase = input.internshipPhase;
      }

      // Execute count query
      const count = await this.prisma.student.count({ where });

      // Strategy 5: Use compact response to reduce output tokens
      const filtersDesc = this.buildFilterDescription(appliedFilters);
      return this.countResponse(count, filtersDesc);
    } catch (error) {
      return this.errorResponse(
        'Failed to count students',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
