/**
 * =============================================================================
 * MONTHLY CYCLE CONFIGURATION
 * =============================================================================
 *
 * This is the SINGLE SOURCE OF TRUTH for all monthly cycle business rules.
 * Change values here and they will apply across the entire application.
 *
 * After making changes:
 * 1. Rebuild the backend: npm run build
 * 2. Update frontend config: frontend/src/config/monthlyCycle.config.js
 * 3. Run tests: npx ts-node scripts/test-monthly-cycle.ts
 * 4. Re-run migration if needed: npx ts-node scripts/populate-expected-counts.ts
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
   * @range 1-28
   */
  MIN_DAYS_FOR_INCLUSION: 10,

  /**
   * Minimum days required in the FIRST month to include it for reporting.
   * If a student has <= this many days in the first month, that month is EXCLUDED.
   *
   * Example with FIRST_MONTH_MIN_DAYS = 25:
   * - Student starts Jan 17 (15 days in Jan) → January EXCLUDED
   * - Student starts Jan 16 (16 days in Jan) → January INCLUDED
   *
   * @default 25
   * @range 1-28
   */
  FIRST_MONTH_MIN_DAYS: 25,

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
   * @range 1-28
   */
  REPORT_DUE_DAY: 5,

  /**
   * VISIT DUE DATE
   * ==============
   */

  /**
   * Whether visit is due on the last day of the month.
   * If false, uses VISIT_DUE_DAY instead.
   *
   * @default true
   */
  VISIT_DUE_ON_MONTH_END: true,

  /**
   * Day of the month when the visit is due (only used if VISIT_DUE_ON_MONTH_END = false).
   *
   * @default 28
   * @range 1-28
   */
  VISIT_DUE_DAY: 28,

  /**
   * Grace period in days after visit due date (currently NOT used - visits have no grace).
   * Set to 0 for no grace period.
   *
   * @default 0
   */
  VISIT_GRACE_DAYS: 0,

  /**
   * INTERNSHIP LIMITS
   * =================
   */

  /**
   * Maximum number of months an internship can span.
   * This prevents infinite loops in calculations.
   *
   * @default 24 (2 years)
   */
  MAX_MONTHS: 24,

  /**
   * Minimum internship duration in weeks.
   * Used for validation when creating internships.
   *
   * @default 16
   */
  MIN_INTERNSHIP_WEEKS: 16,

  /**
   * NOTIFICATION SETTINGS
   * =====================
   */

  /**
   * Days before deadline to send reminder notification.
   *
   * @default 5
   */
  REMINDER_DAYS_BEFORE_DEADLINE: 5,

  /**
   * Whether to send notifications after deadline for overdue items.
   *
   * @default true
   */
  SEND_OVERDUE_NOTIFICATIONS: true,

  /**
   * AUTO-APPROVAL SETTINGS
   * ======================
   */

  /**
   * Whether reports are auto-approved upon submission.
   *
   * @default true
   */
  AUTO_APPROVE_REPORTS: true,

  /**
   * STATUS LABELS
   * =============
   * Customize the labels shown in the UI for different statuses.
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
   * Colors for status badges in the UI.
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
   * Customize month names if needed (e.g., for localization).
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
 * Type for the configuration object
 */
export type MonthlyCycleConfig = typeof MONTHLY_CYCLE_CONFIG;

/**
 * Helper to get month name from month number (1-12)
 */
export function getMonthNameFromConfig(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) {
    return 'Invalid Month';
  }
  return MONTHLY_CYCLE_CONFIG.MONTH_NAMES[monthNumber - 1];
}

/**
 * Validate configuration values
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const config = MONTHLY_CYCLE_CONFIG;

  if (config.MIN_DAYS_FOR_INCLUSION < 1 || config.MIN_DAYS_FOR_INCLUSION > 28) {
    errors.push('MIN_DAYS_FOR_INCLUSION must be between 1 and 28');
  }

  if (config.FIRST_MONTH_MIN_DAYS < 1 || config.FIRST_MONTH_MIN_DAYS > 28) {
    errors.push('FIRST_MONTH_MIN_DAYS must be between 1 and 28');
  }

  if (config.REPORT_DUE_DAY < 1 || config.REPORT_DUE_DAY > 28) {
    errors.push('REPORT_DUE_DAY must be between 1 and 28');
  }

  if (config.VISIT_DUE_DAY < 1 || config.VISIT_DUE_DAY > 28) {
    errors.push('VISIT_DUE_DAY must be between 1 and 28');
  }

  if (config.MAX_MONTHS < 1 || config.MAX_MONTHS > 60) {
    errors.push('MAX_MONTHS must be between 1 and 60');
  }

  if (config.MIN_INTERNSHIP_WEEKS < 1) {
    errors.push('MIN_INTERNSHIP_WEEKS must be at least 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default MONTHLY_CYCLE_CONFIG;
