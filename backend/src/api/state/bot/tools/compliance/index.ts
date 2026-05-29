import { PrismaService } from '../../../../../core/database/prisma.service';
import { ComplianceSummaryTool } from './compliance-summary.tool';
import { ComplianceAlertsTool } from './compliance-alerts.tool';

// Export individual tool classes
export { ComplianceSummaryTool } from './compliance-summary.tool';
export { ComplianceAlertsTool } from './compliance-alerts.tool';

/**
 * Factory function to create all compliance tools with the provided PrismaService.
 * @param prisma - The PrismaService instance for database access
 * @returns Array of compliance tool instances
 */
export function getComplianceTools(prisma: PrismaService) {
  return [
    new ComplianceSummaryTool(prisma),
    new ComplianceAlertsTool(prisma),
  ];
}

/**
 * All compliance tool names for reference
 */
export const COMPLIANCE_TOOL_NAMES = [
  'compliance_summary',
  'compliance_alerts',
] as const;

export type ComplianceToolName = (typeof COMPLIANCE_TOOL_NAMES)[number];
