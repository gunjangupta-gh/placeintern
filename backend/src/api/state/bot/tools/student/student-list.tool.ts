import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';

/**
 * Input schema for student list tool
 */
const StudentListInputSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe('Filter by institution name (partial match supported)'),
  branchCode: z.string().optional().describe('Filter by branch code (e.g., "CS", "ME")'),
  isActive: z.boolean().optional().describe('Filter by active status'),
  internshipPhase: z
    .enum(['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'TERMINATED'])
    .optional()
    .describe('Filter by internship phase'),
  hasMentor: z.boolean().optional().describe('Filter by mentor assignment status'),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe('Maximum number of students to return (default: 10, max: 50)'),
  orderBy: z
    .enum(['name', 'createdAt', 'admissionYear'])
    .default('name')
    .optional()
    .describe('Field to order by: "name", "createdAt", or "admissionYear"'),
  orderDirection: z
    .enum(['asc', 'desc'])
    .default('asc')
    .optional()
    .describe('Order direction: "asc" or "desc"'),
});

type StudentListInput = z.infer<typeof StudentListInputSchema>;

interface StudentInfo {
  id: string;
  name: string;
  rollNumber: string | null;
  email: string | null;
  branch: string | null;
  institution: string | null;
  isActive: boolean;
  admissionYear: number | null;
  internshipPhase: string | null;
  hasMentor: boolean;
}

/**
 * Tool to list students with filters and pagination.
 * Use this when user wants to see a list of students.
 */
export class StudentListTool extends BaseTool {
  name = 'student_list';

  description = `List students with optional filters. Use this tool when user asks:
- "Show me students..."
- "List students in [institution/branch]..."
- "Who are the students..."
- "Get student details..."
- "Show top N students..."
- "Students list..."`;

  schema = StudentListInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: StudentListInput): Promise<string> {
    try {
      const limit = input.limit ?? 10;
      const orderBy = input.orderBy ?? 'name';
      const orderDirection = input.orderDirection ?? 'asc';
      const appliedFilters: Record<string, unknown> = { limit, orderBy, orderDirection };

      // Build where clause
      const where: Prisma.StudentWhereInput = {};

      // Institution filter
      if (input.institutionName) {
        const institutionId = await this.resolveInstitutionId(input.institutionName);
        if (institutionId) {
          where.institutionId = institutionId;
          appliedFilters.institution = input.institutionName;
        } else {
          return this.successResponse({
            students: [],
            totalCount: 0,
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
            students: [],
            totalCount: 0,
            filtersApplied: `branch: "${input.branchCode}" (not found)`,
            message: `No branch found matching "${input.branchCode}"`,
          });
        }
      }

      // Active status filter
      if (input.isActive !== undefined) {
        where.user = {
          ...((where.user as Prisma.UserWhereInput) || {}),
          active: input.isActive,
        };
        appliedFilters.status = input.isActive ? 'active' : 'inactive';
      }

      // Internship phase filter
      if (input.internshipPhase) {
        where.internshipApplications = {
          some: { internshipPhase: input.internshipPhase },
        };
        appliedFilters.internshipPhase = input.internshipPhase;
      }

      // Mentor assignment filter
      if (input.hasMentor !== undefined) {
        if (input.hasMentor) {
          where.mentorAssignments = {
            some: { isActive: true },
          };
          appliedFilters.mentor = 'assigned';
        } else {
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

      // Build orderBy clause
      const orderByClause: Prisma.StudentOrderByWithRelationInput = {};
      if (orderBy === 'name') {
        orderByClause.user = { name: orderDirection };
      } else if (orderBy === 'createdAt') {
        orderByClause.createdAt = orderDirection;
      } else if (orderBy === 'admissionYear') {
        orderByClause.admissionYear = orderDirection;
      }

      // Get total count
      const totalCount = await this.prisma.student.count({ where });

      // Fetch students
      const students = await this.prisma.student.findMany({
        where,
        take: limit,
        orderBy: orderByClause,
        select: {
          id: true,
          admissionYear: true,
          user: {
            select: {
              name: true,
              email: true,
              rollNumber: true,
              active: true,
            },
          },
          branch: {
            select: {
              name: true,
              shortName: true,
              code: true,
            },
          },
          Institution: {
            select: {
              name: true,
              shortName: true,
            },
          },
          internshipApplications: {
            select: {
              internshipPhase: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          mentorAssignments: {
            where: { isActive: true },
            select: { id: true },
            take: 1,
          },
        },
      });

      // Transform to output format
      const studentList: StudentInfo[] = students.map((s) => ({
        id: s.id,
        name: s.user.name,
        rollNumber: s.user.rollNumber,
        email: s.user.email,
        branch: s.branch?.name || s.branch?.shortName || s.branch?.code || null,
        institution: s.Institution?.name || s.Institution?.shortName || null,
        isActive: s.user.active,
        admissionYear: s.admissionYear,
        internshipPhase: s.internshipApplications[0]?.internshipPhase || null,
        hasMentor: s.mentorAssignments.length > 0,
      }));

      return this.successResponse({
        students: studentList,
        totalCount,
        formattedTotal: this.formatNumber(totalCount),
        returnedCount: studentList.length,
        filtersApplied: this.buildFilterDescription(appliedFilters),
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to list students',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
