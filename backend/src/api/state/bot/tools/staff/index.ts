import { PrismaService } from '../../../../../core/database/prisma.service';
import { StaffCountTool } from './staff-count.tool';
import { MentorStatsTool } from './mentor-stats.tool';

// Export individual tool classes
export { StaffCountTool } from './staff-count.tool';
export { MentorStatsTool } from './mentor-stats.tool';

/**
 * Factory function to create all staff tools with the provided PrismaService.
 * @param prisma - The PrismaService instance for database access
 * @returns Array of staff tool instances
 */
export function getStaffTools(prisma: PrismaService) {
  return [
    new StaffCountTool(prisma),
    new MentorStatsTool(prisma),
  ];
}

/**
 * All staff tool names for reference
 */
export const STAFF_TOOL_NAMES = [
  'staff_count',
  'mentor_stats',
] as const;

export type StaffToolName = (typeof STAFF_TOOL_NAMES)[number];
