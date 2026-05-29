import { z } from 'zod';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { Role, Designation, Prisma } from '../../../../../generated/prisma/client';
import { BaseTool } from '../base.tool';

/**
 * Input schema for staff count tool
 */
const StaffCountInputSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe('Institution name to filter by (partial match supported, e.g., "Government Polytechnic")'),
  designation: z
    .enum([
      'PRINCIPAL',
      'HOD',
      'SENIOR_LECTURER',
      'LECTURER',
      'ASSISTANT_PROFESSOR',
      'FOREMAN_INSTRUCTOR',
      'WORKSHOP_INSTRUCTOR',
      'WORKSHOP_SUPERINTENDENT',
      'WORKSHOP_FOREMAN',
      'LAB_TECHNICIAN',
      'TECHNICIAN',
      'INSTRUCTOR',
      'SYSTEM_ANALYST',
      'SYSTEM_ADMINISTRATOR',
      'SYSTEM_MANAGER',
      'PROGRAMMER',
      'NETWORK_ENGINEER',
      'COMPUTER_OPERATOR',
      'LIBRARIAN',
      'TPO',
      'FASHION_DESIGNER',
      'PEON',
      'ASSTT_DIRECTOR',
      'ADDITIONAL_DIRECTOR',
      'DEPUTY_DIRECTOR_STAFF',
      'DEPUTY_DIRECTOR_CONDUCT',
      'DEPUTY_DIRECTOR_PLANNING',
      'DIRECTOR_ACADEMICS',
      'REGISTRAR',
      'HOD_CONTROLLER_EXAMINATIONS',
      'DEMONSTRATOR',
      'STENOTYPIST',
      'CLERK',
      'JR_SCALE_STENOGRAPHER',
      'JUNIOR_ASSTT',
      'SR_ASSTT',
      'SUPDT_GRADE_2',
      'OTHER',
    ])
    .optional()
    .describe('Staff designation to filter by'),
  role: z
    .enum(['TEACHER', 'FACULTY_COORDINATOR', 'PRINCIPAL'])
    .optional()
    .describe('User role to filter by (TEACHER, FACULTY_COORDINATOR, or PRINCIPAL)'),
});

type StaffCountInput = z.infer<typeof StaffCountInputSchema>;

/**
 * Tool for counting staff/faculty members.
 * Supports filtering by institution, designation, and role.
 */
export class StaffCountTool extends BaseTool {
  name = 'staff_count';

  description = `Count staff, faculty, or teachers with optional filters. Use this tool when user asks:
- "How many staff..."
- "Total faculty..."
- "Teacher count..."
- "Number of teachers..."
- "How many principals..."
- "Faculty in [institution]..."
- "Staff by designation..."
- "HODs count..."
- "Lecturers in [institution]..."`;

  schema = StaffCountInputSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: StaffCountInput): Promise<string> {
    try {
      // Build the where clause based on filters
      const where: Prisma.UserWhereInput = {
        active: true,
        // Only count staff roles (not students)
        role: {
          in: [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.PRINCIPAL, Role.ADMIN_STAFF],
        },
      };
      const appliedFilters: Record<string, unknown> = {};

      // Apply institution filter
      if (input.institutionName) {
        const institutionId = await this.resolveInstitutionId(input.institutionName);
        if (!institutionId) {
          return this.successResponse({
            count: 0,
            formattedCount: '0',
            filtersApplied: `institution: "${input.institutionName}" (not found)`,
            message: `No institution found matching "${input.institutionName}"`,
          });
        }
        where.institutionId = institutionId;
        appliedFilters.institution = input.institutionName;
      }

      // Apply role filter (override default if specified)
      if (input.role) {
        where.role = input.role as Role;
        appliedFilters.role = input.role;
      }

      // Apply designation filter
      if (input.designation) {
        where.designationEnum = input.designation as Designation;
        appliedFilters.designation = input.designation;
      }

      const count = await this.prisma.user.count({ where });

      return this.successResponse({
        count,
        formattedCount: this.formatNumber(count),
        filtersApplied: this.buildFilterDescription(appliedFilters) || 'all active staff',
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to count staff',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }
}
