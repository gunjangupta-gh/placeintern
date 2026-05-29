import { PrismaService } from '../../../../../core/database/prisma.service';
import { ReportCountTool } from './report-count.tool';
import { ReportBreakdownTool } from './report-breakdown.tool';
import { OverdueReportsTool } from './overdue-reports.tool';

// Export individual tool classes
export { ReportCountTool } from './report-count.tool';
export { ReportBreakdownTool } from './report-breakdown.tool';
export { OverdueReportsTool } from './overdue-reports.tool';

/**
 * Get all report-related tools
 * @param prisma - PrismaService instance for database access
 * @returns Array of instantiated report tools
 */
export function getReportTools(prisma: PrismaService) {
  return [
    new ReportCountTool(prisma),
    new ReportBreakdownTool(prisma),
    new OverdueReportsTool(prisma),
  ];
}

/**
 * Report tool names for reference
 */
export const REPORT_TOOL_NAMES = {
  REPORT_COUNT: 'report_count',
  REPORT_BREAKDOWN: 'report_breakdown',
  OVERDUE_REPORTS: 'overdue_reports',
} as const;
