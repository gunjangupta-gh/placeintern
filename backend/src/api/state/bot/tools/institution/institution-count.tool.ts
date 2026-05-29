import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { InstitutionType } from '../../../../../generated/prisma/client';

/**
 * Tool to count institutions with optional filters.
 * Use this when the user asks about the number of institutions, colleges, polytechnics, etc.
 */
export class InstitutionCountTool extends BaseTool {
  name = 'institution_count';

  description = `Count institutions with optional filters. Use this tool when user asks:
    - "How many institutions..."
    - "Total colleges..."
    - "Number of polytechnics..."
    - "How many engineering colleges..."
    - "Count of active institutions..."
    - "How many ITIs are there..."`;

  schema = z.object({
    type: z
      .enum([
        'POLYTECHNIC',
        'ENGINEERING_COLLEGE',
        'UNIVERSITY',
        'DEGREE_COLLEGE',
        'ITI',
        'SKILL_CENTER',
      ])
      .optional()
      .describe(
        'Institution type to filter (POLYTECHNIC, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, ITI, SKILL_CENTER)',
      ),
    isActive: z
      .boolean()
      .optional()
      .describe('Filter by active status (true = active, false = inactive)'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      // Build the where clause based on filters
      const where: {
        type?: InstitutionType;
        isActive?: boolean;
      } = {};

      if (input.type) {
        where.type = input.type as InstitutionType;
      }

      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      // Count institutions
      const count = await this.prisma.institution.count({ where });

      // Build filter descriptions for response
      const filtersApplied: Record<string, unknown> = {};
      if (input.type) {
        filtersApplied.type = input.type;
      }
      if (input.isActive !== undefined) {
        filtersApplied.isActive = input.isActive ? 'active' : 'inactive';
      }

      return this.successResponse({
        count,
        filtersApplied: this.buildFilterDescription(filtersApplied),
        filters: filtersApplied,
      });
    } catch (error) {
      return this.errorResponse(
        'Failed to count institutions',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
