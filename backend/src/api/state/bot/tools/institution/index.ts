import { PrismaService } from '../../../../../core/database/prisma.service';
import { InstitutionCountTool } from './institution-count.tool';
import { InstitutionBreakdownTool } from './institution-breakdown.tool';
import { InstitutionPerformanceTool } from './institution-performance.tool';

// Export individual tool classes
export { InstitutionCountTool } from './institution-count.tool';
export { InstitutionBreakdownTool } from './institution-breakdown.tool';
export { InstitutionPerformanceTool } from './institution-performance.tool';

/**
 * Factory function to create all institution tools with the provided PrismaService.
 * @param prisma - The PrismaService instance for database access
 * @returns Array of institution tool instances
 */
export function getInstitutionTools(prisma: PrismaService) {
  return [
    new InstitutionCountTool(prisma),
    new InstitutionBreakdownTool(prisma),
    new InstitutionPerformanceTool(prisma),
  ];
}

/**
 * All institution tool names for reference
 */
export const INSTITUTION_TOOL_NAMES = [
  'institution_count',
  'institution_breakdown',
  'institution_performance',
] as const;

export type InstitutionToolName = (typeof INSTITUTION_TOOL_NAMES)[number];
