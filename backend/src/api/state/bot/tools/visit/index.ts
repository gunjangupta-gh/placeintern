import { PrismaService } from "../../../../../core/database/prisma.service";
import { VisitCountTool } from "./visit-count.tool";
import { VisitBreakdownTool } from "./visit-breakdown.tool";
import { PendingVisitsTool } from "./pending-visits.tool";

// Export individual tool classes
export { VisitCountTool } from "./visit-count.tool";
export { VisitBreakdownTool } from "./visit-breakdown.tool";
export { PendingVisitsTool } from "./pending-visits.tool";

/**
 * Factory function to create all visit tools with Prisma dependency
 * @param prisma - PrismaService instance
 * @returns Array of instantiated visit tools
 */
export function createVisitTools(prisma: PrismaService) {
  return [
    new VisitCountTool(prisma),
    new VisitBreakdownTool(prisma),
    new PendingVisitsTool(prisma),
  ];
}

/**
 * Get visit tool names for reference
 */
export const VISIT_TOOL_NAMES = [
  "visit_count",
  "visit_breakdown",
  "pending_visits",
] as const;

export type VisitToolName = (typeof VISIT_TOOL_NAMES)[number];
