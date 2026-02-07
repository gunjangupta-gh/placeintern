/**
 * Report Definitions Index
 * Exports all report definitions organized by category
 */

export * from './student-reports.definition';
export * from './mentor-reports.definition';
export * from './internship-reports.definition';
export * from './compliance-reports.definition';
export * from './institute-reports.definition';
export * from './pending-reports.definition';
export * from './user-activity-reports.definition';
export * from './industry-reports.definition';

import { studentReportDefinitions } from './student-reports.definition';
import { mentorReportDefinitions } from './mentor-reports.definition';
import { internshipReportDefinitions } from './internship-reports.definition';
import { complianceReportDefinitions } from './compliance-reports.definition';
import { instituteReportDefinitions } from './institute-reports.definition';
import { pendingReportDefinitions } from './pending-reports.definition';
import { userActivityReportDefinitions } from './user-activity-reports.definition';
import { industryReportDefinitions } from './industry-reports.definition';

export const allReportDefinitions = {
  ...studentReportDefinitions,
  ...mentorReportDefinitions,
  ...internshipReportDefinitions,
  ...complianceReportDefinitions,
  ...instituteReportDefinitions,
  ...pendingReportDefinitions,
  ...userActivityReportDefinitions,
  ...industryReportDefinitions,
};

export const reportCategories = {
  STUDENT: {
    key: 'student',
    label: 'Student Reports',
    icon: 'team',
    reports: Object.keys(studentReportDefinitions),
  },
  MENTOR: {
    key: 'mentor',
    label: 'Mentor Reports',
    icon: 'user',
    reports: Object.keys(mentorReportDefinitions),
  },
  INTERNSHIP: {
    key: 'internship',
    label: 'Internship Reports',
    icon: 'laptop',
    reports: Object.keys(internshipReportDefinitions),
  },
  COMPLIANCE: {
    key: 'compliance',
    label: 'Compliance Reports',
    icon: 'audit',
    reports: Object.keys(complianceReportDefinitions),
  },
  INSTITUTE: {
    key: 'institute',
    label: 'Institution Reports',
    icon: 'bank',
    reports: Object.keys(instituteReportDefinitions),
  },
  PENDING: {
    key: 'pending',
    label: 'Pending Reports',
    icon: 'clock-circle',
    reports: Object.keys(pendingReportDefinitions),
  },
  USER_ACTIVITY: {
    key: 'user-activity',
    label: 'User Activity Reports',
    icon: 'login',
    reports: Object.keys(userActivityReportDefinitions),
  },
  INDUSTRY: {
    key: 'industry',
    label: 'Industry Reports',
    icon: 'shop',
    reports: Object.keys(industryReportDefinitions),
  },
};
