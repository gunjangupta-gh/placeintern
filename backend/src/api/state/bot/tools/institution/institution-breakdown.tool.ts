import { z } from 'zod';
import { BaseTool } from '../base.tool';
import { PrismaService } from '../../../../../core/database/prisma.service';

/**
 * Tool to get institution breakdowns grouped by specified dimensions.
 * Use this for understanding the distribution of institutions.
 */
export class InstitutionBreakdownTool extends BaseTool {
  name = 'institution_breakdown';

  description = `Get breakdown of institutions grouped by type. Use this tool when user asks:
    - "Breakdown of institutions by type..."
    - "How many polytechnics vs engineering colleges..."
    - "Distribution of institutions..."
    - "Institution type wise count..."
    - "Categorize institutions by type..."`;

  schema = z.object({
    groupBy: z
      .enum(['type'])
      .describe('Dimension to group institutions by. Currently supports: type'),
  });

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: z.infer<typeof this.schema>): Promise<string> {
    try {
      if (input.groupBy === 'type') {
        return await this.groupByType();
      }

      return this.errorResponse('Invalid groupBy parameter');
    } catch (error) {
      return this.errorResponse(
        'Failed to get institution breakdown',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Group institutions by type
   */
  private async groupByType(): Promise<string> {
    // Use groupBy to get counts by institution type
    const breakdown = await this.prisma.institution.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
      where: {
        isActive: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    // Get total count
    const totalCount = await this.prisma.institution.count({
      where: { isActive: true },
    });

    // Format the breakdown data
    const formattedBreakdown = breakdown.map((item) => ({
      type: item.type,
      count: item._count.id,
      percentage: totalCount > 0
        ? ((item._count.id / totalCount) * 100).toFixed(1) + '%'
        : '0%',
    }));

    return this.successResponse({
      groupBy: 'type',
      totalCount,
      breakdown: formattedBreakdown,
    });
  }
}
