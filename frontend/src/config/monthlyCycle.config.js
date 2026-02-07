/**
 * =============================================================================
 * MONTHLY CYCLE CONFIGURATION (Frontend)
 * =============================================================================
 *
 * This is the frontend configuration for monthly cycle business rules.
 * IMPORTANT: Keep these values in sync with the backend config at:
 *   backend/src/config/monthly-cycle.config.ts
 *
 * After making changes:
 * 1. Update backend config first (source of truth)
 * 2. Copy the same values here
 * 3. Rebuild the frontend: npm run build
 *
 * =============================================================================
 */

export const MONTHLY_CYCLE_CONFIG = {
  /**
   * MONTH INCLUSION RULES
   * =====================
   */

  /**
   * Minimum days required in a month to include it for reporting.
   * If a student has <= this many days in a month, that month is EXCLUDED.
   *
   * Example with MIN_DAYS_FOR_INCLUSION = 10:
   * - Student starts Jan 22 (9 days in Jan) → January EXCLUDED
   * - Student starts Jan 21 (11 days in Jan) → January INCLUDED
   *
   * @default 10
   */
  MIN_DAYS_FOR_INCLUSION: 10,

  /**
   * Minimum days required in the FIRST month to include it for reporting.
   * If a student has <= this many days in the first month, that month is EXCLUDED.
   *
   * Example with FIRST_MONTH_MIN_DAYS = 15:
   * - Student starts Jan 17 (15 days in Jan) → January EXCLUDED
   * - Student starts Jan 16 (16 days in Jan) → January INCLUDED
   *
   * @default 15
   */
  FIRST_MONTH_MIN_DAYS: 15,

  /**
   * REPORT DUE DATE
   * ===============
   */

  /**
   * Day of the NEXT month when the report is due.
   *
   * Example with REPORT_DUE_DAY = 5:
   * - January report is due February 5th
   * - December report is due January 5th (next year)
   *
   * @default 5
   */
  REPORT_DUE_DAY: 5,

  /**
   * VISIT DUE DATE
   * ==============
   */

  /**
   * Whether visit is due on the last day of the month.
   * @default true
   */
  VISIT_DUE_ON_MONTH_END: true,

  /**
   * Day of the month when the visit is due (only if VISIT_DUE_ON_MONTH_END = false).
   * @default 28
   */
  VISIT_DUE_DAY: 28,

  /**
   * INTERNSHIP LIMITS
   * =================
   */

  /**
   * Maximum number of months an internship can span.
   * @default 24 (2 years)
   */
  MAX_MONTHS: 24,

  /**
   * Minimum internship duration in weeks.
   * @default 16
   */
  MIN_INTERNSHIP_WEEKS: 16,

  /**
   * NOTIFICATION SETTINGS
   * =====================
   */

  /**
   * Days before deadline to show warning.
   * @default 5
   */
  REMINDER_DAYS_BEFORE_DEADLINE: 5,

  /**
   * STATUS LABELS
   * =============
   */
  STATUS_LABELS: {
    // Report statuses
    REPORT_NOT_STARTED: 'Not Started',
    REPORT_DRAFT: 'Draft',
    REPORT_SUBMITTED: 'Submitted',
    REPORT_APPROVED: 'Approved',
    REPORT_OVERDUE: 'Overdue',

    // Visit statuses
    VISIT_UPCOMING: 'Upcoming',
    VISIT_PENDING: 'Pending',
    VISIT_COMPLETED: 'Completed',
    VISIT_OVERDUE: 'Overdue',
  },

  /**
   * STATUS COLORS
   * =============
   */
  STATUS_COLORS: {
    NOT_STARTED: 'gray',
    DRAFT: 'blue',
    SUBMITTED: 'yellow',
    APPROVED: 'green',
    COMPLETED: 'green',
    PENDING: 'orange',
    UPCOMING: 'blue',
    OVERDUE: 'red',
  },

  /**
   * MONTH NAMES
   * ===========
   */
  MONTH_NAMES: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/**
 * Helper to get month name from month number (1-12)
 */
export function getMonthNameFromConfig(monthNumber) {
  if (monthNumber < 1 || monthNumber > 12) {
    return 'Invalid Month';
  }
  return MONTHLY_CYCLE_CONFIG.MONTH_NAMES[monthNumber - 1];
}

export default MONTHLY_CYCLE_CONFIG;
