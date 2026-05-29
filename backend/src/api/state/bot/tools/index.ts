import { PrismaService } from '../../../../core/database/prisma.service';
import { StructuredTool } from '@langchain/core/tools';

// Import tool modules
import { getStaffTools, StaffCountTool, MentorStatsTool, STAFF_TOOL_NAMES } from './staff';
import {
  getComplianceTools,
  ComplianceSummaryTool,
  ComplianceAlertsTool,
  COMPLIANCE_TOOL_NAMES,
} from './compliance';
import {
  getInstitutionTools,
  InstitutionCountTool,
  InstitutionBreakdownTool,
  InstitutionPerformanceTool,
  INSTITUTION_TOOL_NAMES,
} from './institution';
import {
  StudentCountTool,
  StudentBreakdownTool,
  StudentListTool,
} from './student';
import {
  createVisitTools,
  VisitCountTool,
  VisitBreakdownTool,
  PendingVisitsTool,
  VISIT_TOOL_NAMES,
} from './visit';
import {
  getReportTools,
  ReportCountTool,
  ReportBreakdownTool,
  OverdueReportsTool,
  REPORT_TOOL_NAMES,
} from './report';

// Re-export base tool
export { BaseTool } from './base.tool';

// Re-export individual tools for direct usage
export { StaffCountTool, MentorStatsTool };
export { ComplianceSummaryTool, ComplianceAlertsTool };
export { InstitutionCountTool, InstitutionBreakdownTool, InstitutionPerformanceTool };
export { StudentCountTool, StudentBreakdownTool, StudentListTool };
export { VisitCountTool, VisitBreakdownTool, PendingVisitsTool };
export { ReportCountTool, ReportBreakdownTool, OverdueReportsTool };

// Re-export factory functions
export { getStaffTools } from './staff';
export { getComplianceTools } from './compliance';
export { getInstitutionTools } from './institution';
export { createVisitTools } from './visit';
export { getReportTools } from './report';

/**
 * Create all student tools (no factory function in student module)
 */
function getStudentTools(prisma: PrismaService): StructuredTool[] {
  return [
    new StudentCountTool(prisma),
    new StudentBreakdownTool(prisma),
    new StudentListTool(prisma),
  ];
}

export { getStudentTools };

/**
 * Get all available bot tools
 * This function creates instances of all tools with the provided PrismaService
 *
 * @param prisma - PrismaService instance for database access
 * @returns Array of all tool instances
 */
export function getAllTools(prisma: PrismaService): StructuredTool[] {
  return [
    // Student tools
    ...getStudentTools(prisma),
    // Staff tools
    ...getStaffTools(prisma),
    // Institution tools
    ...getInstitutionTools(prisma),
    // Visit tools
    ...createVisitTools(prisma),
    // Report tools
    ...getReportTools(prisma),
    // Compliance tools
    ...getComplianceTools(prisma),
  ];
}

/**
 * Get tools by category
 */
export function getToolsByCategory(
  prisma: PrismaService,
  category: 'student' | 'staff' | 'institution' | 'visit' | 'report' | 'compliance',
): StructuredTool[] {
  switch (category) {
    case 'student':
      return getStudentTools(prisma);
    case 'staff':
      return getStaffTools(prisma);
    case 'institution':
      return getInstitutionTools(prisma);
    case 'visit':
      return createVisitTools(prisma);
    case 'report':
      return getReportTools(prisma);
    case 'compliance':
      return getComplianceTools(prisma);
    default:
      return [];
  }
}

/**
 * All tool names for reference
 */
export const ALL_TOOL_NAMES = [
  // Student tools
  'student_count',
  'student_breakdown',
  'student_list',
  // Staff tools
  ...Object.values(STAFF_TOOL_NAMES),
  // Institution tools
  ...Object.values(INSTITUTION_TOOL_NAMES),
  // Visit tools
  ...Object.values(VISIT_TOOL_NAMES),
  // Report tools
  ...Object.values(REPORT_TOOL_NAMES),
  // Compliance tools
  ...Object.values(COMPLIANCE_TOOL_NAMES),
] as const;

export type ToolName = (typeof ALL_TOOL_NAMES)[number];

/**
 * Tool metadata for documentation/discovery
 */
export const TOOL_METADATA = {
  student: {
    name: 'Student Tools',
    description: 'Tools for counting and analyzing student data',
    tools: [
      {
        name: 'student_count',
        description: 'Count students with optional filters',
      },
      {
        name: 'student_breakdown',
        description: 'Get student breakdown by institution, branch, status, or phase',
      },
      {
        name: 'student_list',
        description: 'List students with specific criteria',
      },
    ],
  },
  staff: {
    name: 'Staff Tools',
    description: 'Tools for counting and analyzing staff/faculty data',
    tools: [
      {
        name: 'staff_count',
        description: 'Count staff/faculty with optional filters',
      },
      {
        name: 'mentor_stats',
        description: 'Get mentor workload statistics',
      },
    ],
  },
  institution: {
    name: 'Institution Tools',
    description: 'Tools for counting and analyzing institution data',
    tools: [
      {
        name: 'institution_count',
        description: 'Count institutions with optional type and status filters',
      },
      {
        name: 'institution_breakdown',
        description: 'Get institution breakdown by type',
      },
      {
        name: 'institution_performance',
        description: 'Find top or bottom performing institutions',
      },
    ],
  },
  visit: {
    name: 'Visit Tools',
    description: 'Tools for counting and analyzing faculty visit data',
    tools: [
      {
        name: 'visit_count',
        description: 'Count faculty visits with optional filters',
      },
      {
        name: 'visit_breakdown',
        description: 'Get visit breakdown by type, institution, or month',
      },
      {
        name: 'pending_visits',
        description: 'Get pending or overdue visits',
      },
    ],
  },
  report: {
    name: 'Report Tools',
    description: 'Tools for counting and analyzing monthly report data',
    tools: [
      {
        name: 'report_count',
        description: 'Count monthly reports with optional filters',
      },
      {
        name: 'report_breakdown',
        description: 'Get report breakdown by status, institution, or month',
      },
      {
        name: 'overdue_reports',
        description: 'Get overdue or late reports',
      },
    ],
  },
  compliance: {
    name: 'Compliance Tools',
    description: 'Tools for compliance monitoring and alerts',
    tools: [
      {
        name: 'compliance_summary',
        description: 'Get overall compliance rates',
      },
      {
        name: 'compliance_alerts',
        description: 'Get critical compliance issues and alerts',
      },
    ],
  },
};
