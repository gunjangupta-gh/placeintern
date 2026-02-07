/**
 * Grievance Management Constants
 * Centralized constants for grievance categories, statuses, and priorities
 */

// Must match Prisma GrievanceCategory enum
export const GRIEVANCE_CATEGORIES = [
  { value: 'INTERNSHIP_RELATED', label: 'Internship Related', color: 'cyan', description: 'Issues related to your internship' },
  { value: 'MENTOR_RELATED', label: 'Mentor Related', color: 'purple', description: 'Issues with faculty mentor support' },
  { value: 'INDUSTRY_RELATED', label: 'Industry Related', color: 'orange', description: 'Industry partner related issues' },
  { value: 'PAYMENT_ISSUE', label: 'Payment Issue', color: 'gold', description: 'Stipend or payment concerns' },
  { value: 'WORKPLACE_HARASSMENT', label: 'Workplace Harassment', color: 'red', description: 'Harassment at workplace' },
  { value: 'WORK_CONDITION', label: 'Work Condition', color: 'volcano', description: 'Working conditions concerns' },
  { value: 'WORK_ENVIRONMENT', label: 'Work Environment', color: 'geekblue', description: 'Issues with work environment' },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern', color: 'magenta', description: 'Safety related issues' },
  { value: 'HARASSMENT', label: 'Harassment', color: 'red', description: 'General harassment concerns' },
  { value: 'MENTORSHIP', label: 'Mentorship', color: 'blue', description: 'Mentorship quality issues' },
  { value: 'LEARNING_OPPORTUNITY', label: 'Learning Opportunity', color: 'green', description: 'Lack of learning opportunities' },
  { value: 'DISCRIMINATION', label: 'Discrimination', color: 'red', description: 'Discrimination concerns' },
  { value: 'WORK_HOURS', label: 'Work Hours', color: 'lime', description: 'Issues with work hours' },
  { value: 'DOCUMENTATION', label: 'Documentation', color: 'cyan', description: 'Documentation related issues' },
  { value: 'OTHER', label: 'Other', color: 'default', description: 'Other concerns' },
];

export const GRIEVANCE_STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted', color: 'blue', badge: 'processing' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'orange', badge: 'warning' },
  { value: 'ESCALATED', label: 'Escalated', color: 'red', badge: 'error' },
  { value: 'RESOLVED', label: 'Resolved', color: 'green', badge: 'success' },
  { value: 'CLOSED', label: 'Closed', color: 'default', badge: 'default' },
];

export const GRIEVANCE_PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'default', description: 'Non-urgent matters' },
  { value: 'MEDIUM', label: 'Medium', color: 'blue', description: 'Standard priority' },
  { value: 'HIGH', label: 'High', color: 'orange', description: 'Requires prompt attention' },
  { value: 'URGENT', label: 'Urgent', color: 'red', description: 'Requires immediate attention' },
];

/**
 * Get category configuration by value
 * @param {string} value - Category value
 * @returns {Object} Category configuration
 */
export const getCategoryConfig = (value) => {
  return GRIEVANCE_CATEGORIES.find(c => c.value === value) || GRIEVANCE_CATEGORIES[GRIEVANCE_CATEGORIES.length - 1];
};

/**
 * Get status configuration by value
 * @param {string} value - Status value
 * @returns {Object} Status configuration
 */
export const getStatusConfig = (value) => {
  return GRIEVANCE_STATUSES.find(s => s.value === value) || GRIEVANCE_STATUSES[0];
};

/**
 * Get priority configuration by value
 * @param {string} value - Priority value
 * @returns {Object} Priority configuration
 */
export const getPriorityConfig = (value) => {
  return GRIEVANCE_PRIORITIES.find(p => p.value === value) || GRIEVANCE_PRIORITIES[1];
};
