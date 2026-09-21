import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';
import { InstitutionType, Prisma } from '../../../../../generated/prisma/client';

// General, ownership-independent institution kinds. POLYTECHNIC/ITI/SPECIAL_TRADE_INSTITUTE
// each map to 3 InstitutionType enum values split by ownership (see schema.prisma); the legacy
// bare POLYTECHNIC/ITI values are included too as a safety net in case a database hasn't run
// the ownership backfill migration yet.
const KIND_TO_TYPES: Record<string, InstitutionType[]> = {
  POLYTECHNIC: [
    InstitutionType.GOVT_POLYTECHNIC,
    InstitutionType.GOVT_AIDED_POLYTECHNIC,
    InstitutionType.PRIVATE_POLYTECHNIC,
    InstitutionType.POLYTECHNIC,
  ],
  ITI: [
    InstitutionType.GOVT_ITI,
    InstitutionType.GOVT_AIDED_ITI,
    InstitutionType.PRIVATE_ITI,
    InstitutionType.ITI,
  ],
  SPECIAL_TRADE_INSTITUTE: [
    InstitutionType.GOVT_SPECIAL_TRADE_INSTITUTE,
    InstitutionType.GOVT_AIDED_SPECIAL_TRADE_INSTITUTE,
    InstitutionType.PRIVATE_SPECIAL_TRADE_INSTITUTE,
  ],
  ENGINEERING_COLLEGE: [InstitutionType.ENGINEERING_COLLEGE],
  UNIVERSITY: [InstitutionType.UNIVERSITY],
  DEGREE_COLLEGE: [InstitutionType.DEGREE_COLLEGE],
  SKILL_CENTER: [InstitutionType.SKILL_CENTER],
};

const OWNERSHIP_PREFIX: Record<string, string> = {
  GOVT: 'GOVT_',
  GOVT_AIDED: 'GOVT_AIDED_',
  PRIVATE: 'PRIVATE_',
};

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
    - "How many ITIs are there..."
    - "How many government polytechnics..." / "How many private ITIs..."`;

  schema = z.object({
    kind: z
      .enum([
        'POLYTECHNIC',
        'ITI',
        'SPECIAL_TRADE_INSTITUTE',
        'ENGINEERING_COLLEGE',
        'UNIVERSITY',
        'DEGREE_COLLEGE',
        'SKILL_CENTER',
      ])
      .optional()
      .describe(
        'General institution kind to filter by, independent of ownership (POLYTECHNIC, ITI, SPECIAL_TRADE_INSTITUTE, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, SKILL_CENTER)',
      ),
    ownership: z
      .enum(['GOVT', 'GOVT_AIDED', 'PRIVATE'])
      .optional()
      .describe(
        'Ownership to filter by - only meaningful when kind is POLYTECHNIC, ITI, or SPECIAL_TRADE_INSTITUTE',
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
      const where: Prisma.InstitutionWhereInput = {};

      if (input.kind || input.ownership) {
        let types: InstitutionType[] = input.kind
          ? KIND_TO_TYPES[input.kind]
          : Object.values(InstitutionType);

        if (input.ownership) {
          const prefix = OWNERSHIP_PREFIX[input.ownership];
          types = types.filter((t) => t.startsWith(prefix));
        }

        where.type = { in: types };
      }

      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      // Count institutions
      const count = await this.prisma.institution.count({ where });

      // Build filter descriptions for response
      const filtersApplied: Record<string, unknown> = {};
      if (input.kind) {
        filtersApplied.kind = input.kind;
      }
      if (input.ownership) {
        filtersApplied.ownership = input.ownership;
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
