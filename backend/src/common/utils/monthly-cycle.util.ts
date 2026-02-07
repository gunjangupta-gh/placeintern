/**
 * Monthly Cycle Utility
 *
 * Implements the Fixed Monthly Cycle system for internship compliance tracking:
 * - Reports and visits are aligned with calendar months
 * - Visit Inclusion Rule: First month = any days, last month requires >10 days
 * - Report Inclusion Rule: January month ALWAYS skipped, last month requires >10 days
 * - Report Due Date: 5th of the next month (e.g., January report due Feb 5)
 * - Visit Due Date: Last day of the month at 11:59:59 PM (NO grace period)
 * - Minimum internship: 16 weeks (4 months typically)
 * - Late submissions: Allowed with isOverdue flag, no penalty
 *
 * CONFIGURATION:
 * All business rules can be modified in: src/config/monthly-cycle.config.ts
 *
 * Example:
 * Internship: Jan 15 - May 15 (17 weeks)
 * VISITS:
 * - January: 17 days (any days) -> INCLUDE -> Visit due Jan 31
 * - February: 28 days -> INCLUDE -> Visit due Feb 28
 * - March: 31 days -> INCLUDE -> Visit due Mar 31
 * - April: 30 days -> INCLUDE -> Visit due Apr 30
 * - May: 15 days (>10) -> INCLUDE -> Visit due May 31
 * Total: 5 visits
 *
 * REPORTS:
 * - January: SKIP (January month always excluded)
 * - February: 28 days (full month) -> INCLUDE -> Report due Mar 5
 * - March: 31 days -> INCLUDE -> Report due Apr 5
 * - April: 30 days -> INCLUDE -> Report due May 5
 * - May: 15 days (>10) -> INCLUDE -> Report due Jun 5
 * Total: 4 reports
 */

import { MONTHLY_CYCLE_CONFIG } from '../../config/monthly-cycle.config';

// Import configuration values
const MIN_DAYS_FOR_INCLUSION = MONTHLY_CYCLE_CONFIG.MIN_DAYS_FOR_INCLUSION;
const FIRST_MONTH_MIN_DAYS = MONTHLY_CYCLE_CONFIG.FIRST_MONTH_MIN_DAYS;
const REPORT_DUE_DAY = MONTHLY_CYCLE_CONFIG.REPORT_DUE_DAY;
const MAX_MONTHS = MONTHLY_CYCLE_CONFIG.MAX_MONTHS;
const MONTH_NAMES = MONTHLY_CYCLE_CONFIG.MONTH_NAMES;

/**
 * Report submission status enum
 */
export enum ReportStatus {
  NOT_STARTED = 'NOT_STARTED',
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  OVERDUE = 'OVERDUE',
}

/**
 * Visit submission status enum
 */
export enum VisitStatus {
  UPCOMING = 'UPCOMING',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

/**
 * Represents a monthly reporting/visit cycle
 */
export interface MonthlyCycle {
  monthNumber: number; // 1-12
  monthName: string; // "January", "February", etc.
  year: number; // 2025
  reportDueDate: Date; // 5th of next month
  visitDueDate: Date; // Last day of month 11:59:59 PM
  daysInMonth: number; // Days student is in this month
  isFirstMonth: boolean;
  isLastMonth: boolean;
  isIncluded: boolean; // true based on first/last/middle month rules
}

/**
 * Result of calculating expected months for an internship
 */
export interface MonthlyCalculationResult {
  totalExpectedMonths: number;
  months: MonthlyCycle[];
  includedMonths: MonthlyCycle[];
  excludedMonths: MonthlyCycle[];
}

/**
 * Report submission status result
 */
export interface ReportStatusResult {
  status: ReportStatus;
  label: string;
  color: string;
  isOverdue: boolean;
  daysOverdue: number;
  canSubmit: boolean;
}

/**
 * Visit submission status result
 */
export interface VisitStatusResult {
  status: VisitStatus;
  label: string;
  color: string;
  isOverdue: boolean;
  daysOverdue: number;
  canComplete: boolean;
}

/**
 * Get month name from month number (1-12)
 *
 * @param monthNumber - Month number (1-12)
 * @returns Month name string
 */
export function getMonthName(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month number: ${monthNumber}. Must be 1-12.`);
  }
  return MONTH_NAMES[monthNumber - 1];
}

/**
 * Get the last day of a given month
 *
 * @param year - Year
 * @param month - Month number (1-12)
 * @returns Last day of the month
 */
function getLastDayOfMonth(year: number, month: number): number {
  // Create date for first day of next month, then go back one day
  return new Date(year, month, 0).getDate();
}

/**
 * Get report due date for a specific month/year
 * Reports are due on the 5th of the following month
 *
 * @param year - Year of the month being reported on
 * @param month - Month number (1-12) being reported on
 * @returns Due date (5th of next month at 11:59:59 PM)
 */
export function getReportDueDate(year: number, month: number): Date {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month number: ${month}. Must be 1-12.`);
  }

  // Calculate next month
  let nextMonth = month + 1;
  let nextYear = year;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }

  // Create date for 5th of next month at 11:59:59 PM
  const dueDate = new Date(nextYear, nextMonth - 1, REPORT_DUE_DAY);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Get visit due date for a specific month/year
 * Visits are due on the last day of the month at 11:59:59 PM (NO grace period)
 *
 * @param year - Year
 * @param month - Month number (1-12)
 * @returns Due date (last day of month at 11:59:59 PM)
 */
export function getVisitDueDate(year: number, month: number): Date {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month number: ${month}. Must be 1-12.`);
  }

  const lastDay = getLastDayOfMonth(year, month);
  const dueDate = new Date(year, month - 1, lastDay);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Calculate the number of days a student is present in a specific month
 *
 * @param year - Year
 * @param month - Month number (1-12)
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Number of days in the month for the student
 */
function calculateDaysInMonth(
  year: number,
  month: number,
  startDate: Date,
  endDate: Date,
): number {
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);

  const lastDay = getLastDayOfMonth(year, month);
  const monthEnd = new Date(year, month - 1, lastDay);
  monthEnd.setHours(23, 59, 59, 999);

  // Normalize dates
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // Calculate effective start and end within this month
  const effectiveStart = start > monthStart ? start : monthStart;
  const effectiveEnd = end < monthEnd ? end : monthEnd;

  // If the student is not in this month at all
  if (effectiveStart > monthEnd || effectiveEnd < monthStart) {
    return 0;
  }

  // Calculate days (inclusive)
  const days =
    Math.floor(
      (effectiveEnd.getTime() - effectiveStart.getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;

  return Math.max(0, days);
}

/**
 * Check if a specific month is included for visit expectations
 * Visit Rule: First month = any days, last month requires >10 days
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @param year - Year of the month to check
 * @param month - Month number (1-12) to check
 * @returns true if month should be included for visits
 */
export function isVisitMonthIncluded(
  startDate: Date,
  endDate: Date,
  year: number,
  month: number,
): boolean {
  if (!startDate || !endDate) return false;
  if (month < 1 || month > 12) return false;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  if (end < start) return false;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const daysInMonth = calculateDaysInMonth(year, month, start, end);
  if (daysInMonth <= 0) return false;

  const isFirst = year === start.getFullYear() && month === start.getMonth() + 1;
  const isLast = year === end.getFullYear() && month === end.getMonth() + 1;

  if (isFirst) {
    return true; // First month: any days count
  }

  if (isLast) {
    return daysInMonth > MIN_DAYS_FOR_INCLUSION; // Last month: require >10 days
  }

  return true; // Middle months always count
}

/**
 * Check if a specific month is included for report expectations
 * Report Rule: Skip January entirely, last month requires >10 days
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @param year - Year of the month to check
 * @param month - Month number (1-12) to check
 * @returns true if month should be included for reports
 */
export function isReportMonthIncluded(
  startDate: Date,
  endDate: Date,
  year: number,
  month: number,
): boolean {
  if (!startDate || !endDate) return false;
  if (month < 1 || month > 12) return false;
  if (month === 1) return false; // Skip January entirely

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  if (end < start) return false;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const daysInMonth = calculateDaysInMonth(year, month, start, end);
  if (daysInMonth <= 0) return false;

  const isLast = year === end.getFullYear() && month === end.getMonth() + 1;

  if (isLast) {
    return daysInMonth > MIN_DAYS_FOR_INCLUSION; // Last month: require >10 days
  }

  return true; // Other months always count
}

/**
 * Calculate all expected months for an internship
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Array of MonthlyCycle objects (only included months)
 * @throws Error if dates are invalid
 */
export function calculateExpectedMonths(
  startDate: Date,
  endDate: Date,
): MonthlyCycle[] {
  // Validate input types and values
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date provided');
  }

  // Normalize to start of day for start, end of day for end
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Validate date order
  if (end < start) {
    return [];
  }

  const allMonths: MonthlyCycle[] = [];
  const includedMonths: MonthlyCycle[] = [];

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1; // 1-12
  let monthCount = 0;

  // Iterate through all months in the internship period
  while (monthCount < MAX_MONTHS) {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const monthEnd = new Date(currentYear, currentMonth - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    // Check if this month is within the internship period
    if (monthStart > end) {
      break;
    }

    // Calculate days student is in this month
    const daysInMonth = calculateDaysInMonth(
      currentYear,
      currentMonth,
      start,
      end,
    );

    if (daysInMonth > 0) {
      const isFirstMonth = allMonths.length === 0;
      const isLastMonth = end >= monthStart && end <= monthEnd;
      // First month: any days count (matches isVisitMonthIncluded rule)
      // Last month: requires >10 days
      // Middle months: always included
      const isIncluded = isFirstMonth
        ? true
        : isLastMonth
          ? daysInMonth > MIN_DAYS_FOR_INCLUSION
          : true;

      const cycle: MonthlyCycle = {
        monthNumber: currentMonth,
        monthName: getMonthName(currentMonth),
        year: currentYear,
        reportDueDate: getReportDueDate(currentYear, currentMonth),
        visitDueDate: getVisitDueDate(currentYear, currentMonth),
        daysInMonth,
        isFirstMonth,
        isLastMonth,
        isIncluded,
      };

      allMonths.push(cycle);

      if (isIncluded) {
        includedMonths.push(cycle);
      }
    }

    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    monthCount++;
  }

  // Set isLastMonth flag correctly
  if (allMonths.length > 0) {
    allMonths[allMonths.length - 1].isLastMonth = true;
  }

  // Update isLastMonth in includedMonths array as well
  if (includedMonths.length > 0) {
    // Find the last included month and mark it
    const lastAllMonth = allMonths[allMonths.length - 1];
    const lastIncludedMonth = includedMonths[includedMonths.length - 1];

    // If the last overall month is excluded, the last included month is still the last one for included
    if (lastAllMonth.isIncluded) {
      lastIncludedMonth.isLastMonth = true;
    } else {
      // Last overall month is excluded, so last included should be marked
      lastIncludedMonth.isLastMonth = true;
    }
  }

  return includedMonths;
}

/**
 * Calculate all months (both included and excluded) for an internship
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns MonthlyCalculationResult with all month details
 */
export function calculateAllMonths(
  startDate: Date,
  endDate: Date,
): MonthlyCalculationResult {
  // Validate input types and values
  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates are valid
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date provided');
  }

  // Normalize to start of day for start, end of day for end
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Validate date order
  if (end < start) {
    return {
      totalExpectedMonths: 0,
      months: [],
      includedMonths: [],
      excludedMonths: [],
    };
  }

  const allMonths: MonthlyCycle[] = [];
  const includedMonths: MonthlyCycle[] = [];
  const excludedMonths: MonthlyCycle[] = [];

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1; // 1-12
  let monthCount = 0;

  // Iterate through all months in the internship period
  while (monthCount < MAX_MONTHS) {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const monthEnd = new Date(currentYear, currentMonth - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    // Check if this month is within the internship period
    if (monthStart > end) {
      break;
    }

    // Calculate days student is in this month
    const daysInMonth = calculateDaysInMonth(
      currentYear,
      currentMonth,
      start,
      end,
    );

    if (daysInMonth > 0) {
      const isFirstMonth = allMonths.length === 0;
      const isLastMonth = end >= monthStart && end <= monthEnd;
      // First month: any days count (matches isVisitMonthIncluded rule)
      // Last month: requires >10 days
      // Middle months: always included
      const isIncluded = isFirstMonth
        ? true
        : isLastMonth
          ? daysInMonth > MIN_DAYS_FOR_INCLUSION
          : true;

      const cycle: MonthlyCycle = {
        monthNumber: currentMonth,
        monthName: getMonthName(currentMonth),
        year: currentYear,
        reportDueDate: getReportDueDate(currentYear, currentMonth),
        visitDueDate: getVisitDueDate(currentYear, currentMonth),
        daysInMonth,
        isFirstMonth,
        isLastMonth,
        isIncluded,
      };

      allMonths.push(cycle);

      if (isIncluded) {
        includedMonths.push(cycle);
      } else {
        excludedMonths.push(cycle);
      }
    }

    // Move to next month
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    monthCount++;
  }

  // Set isLastMonth flag correctly
  if (allMonths.length > 0) {
    allMonths[allMonths.length - 1].isLastMonth = true;
  }

  return {
    totalExpectedMonths: includedMonths.length,
    months: allMonths,
    includedMonths,
    excludedMonths,
  };
}

/**
 * Get total expected visits for an internship
 * Visit Rule: First month = any days, last month requires >10 days
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Number of expected visits
 */
export function getTotalExpectedVisits(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1;
  let count = 0;
  let monthCount = 0;

  const allMonths: Array<{ year: number; month: number; days: number }> = [];

  // Collect all months
  while (monthCount < MAX_MONTHS) {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const monthEnd = new Date(currentYear, currentMonth - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    if (monthStart > end) break;

    const daysInMonth = calculateDaysInMonth(currentYear, currentMonth, start, end);

    if (daysInMonth > 0) {
      allMonths.push({ year: currentYear, month: currentMonth, days: daysInMonth });
    }

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    monthCount++;
  }

  // Apply visit rules: first month = any days, last month >10 days
  for (let i = 0; i < allMonths.length; i++) {
    const { days } = allMonths[i];
    const isFirst = i === 0;
    const isLast = i === allMonths.length - 1;

    if (isFirst) {
      // First month: any days count
      count++;
    } else if (isLast) {
      // Last month: require >10 days
      if (days > MIN_DAYS_FOR_INCLUSION) {
        count++;
      }
    } else {
      // Middle months: always count
      count++;
    }
  }

  return count;
}

/**
 * Get total expected reports for an internship
 * Report Rule: SKIP January month entirely (students join companies in January at various dates), 
 * then count other months, last month requires >10 days
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Number of expected reports
 */
export function getTotalExpectedReports(startDate: Date, endDate: Date): number {
  // Validate inputs
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1;
  let count = 0;
  let monthCount = 0;

  const allMonths: Array<{ year: number; month: number; days: number }> = [];

  // Collect all months
  while (monthCount < MAX_MONTHS) {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const monthEnd = new Date(currentYear, currentMonth - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    if (monthStart > end) break;

    const daysInMonth = calculateDaysInMonth(currentYear, currentMonth, start, end);

    if (daysInMonth > 0) {
      allMonths.push({ year: currentYear, month: currentMonth, days: daysInMonth });
    }

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    monthCount++;
  }

  // Apply report rules: SKIP January month, count other months, last month >10 days
  for (let i = 0; i < allMonths.length; i++) {
    const { month, days } = allMonths[i];
    const isLast = i === allMonths.length - 1;

    // Skip January month entirely (monthNumber === 1)
    if (month === 1) {
      continue;
    }

    if (isLast) {
      // Last month: require >10 days
      if (days > MIN_DAYS_FOR_INCLUSION) {
        count++;
      }
    } else {
      // Other months: always count
      count++;
    }
  }

  return count;
}

/**
 * Get total expected count (reports or visits) for an internship
 * @deprecated Use getTotalExpectedVisits() or getTotalExpectedReports() instead
 * Defaults to visit logic for backward compatibility
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Number of expected visits
 */
export function getTotalExpectedCount(startDate: Date, endDate: Date): number {
  return getTotalExpectedVisits(startDate, endDate);
}

/**
 * Get expected reports as of a specific date (defaults to today)
 * Only counts months where the report deadline (5th of next month) has passed
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @param asOfDate - Reference date for calculation (defaults to today)
 * @returns Number of expected reports as of the reference date
 */
export function getExpectedReportsAsOfToday(
  startDate: Date,
  endDate: Date,
  asOfDate?: Date,
): number {
  // Validate inputs
  if (!startDate || !endDate) {
    return 0;
  }

  const referenceDate = asOfDate ? new Date(asOfDate) : new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start || referenceDate < start) {
    return 0;
  }

  const includedMonths = calculateExpectedMonths(startDate, endDate);
  let expectedCount = 0;

  for (const month of includedMonths) {
    // Report is expected if the due date has passed as of the reference date
    if (referenceDate > month.reportDueDate) {
      expectedCount++;
    }
  }

  return expectedCount;
}

/**
 * Get expected visits as of a specific date (defaults to today)
 * Only counts months where the visit deadline (last day of month) has passed
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @param asOfDate - Reference date for calculation (defaults to today)
 * @returns Number of expected visits as of the reference date
 */
export function getExpectedVisitsAsOfToday(
  startDate: Date,
  endDate: Date,
  asOfDate?: Date,
): number {
  // Validate inputs
  if (!startDate || !endDate) {
    return 0;
  }

  const referenceDate = asOfDate ? new Date(asOfDate) : new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return 0;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start || referenceDate < start) {
    return 0;
  }

  const includedMonths = calculateExpectedMonths(startDate, endDate);
  let expectedCount = 0;

  for (const month of includedMonths) {
    // Visit is expected if the due date has passed as of the reference date
    if (referenceDate > month.visitDueDate) {
      expectedCount++;
    }
  }

  return expectedCount;
}

/**
 * Get report submission status
 *
 * @param report - Report object (should have status and submittedAt properties)
 * @param dueDate - Due date for the report
 * @returns ReportStatusResult
 */
export function getReportSubmissionStatus(
  report: { status?: string; submittedAt?: Date | string | null } | null | undefined,
  dueDate: Date,
): ReportStatusResult {
  const now = new Date();
  const due = new Date(dueDate);

  // Calculate days overdue
  const daysOverdue =
    now > due
      ? Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  // No report exists
  if (!report) {
    if (now > due) {
      return {
        status: ReportStatus.OVERDUE,
        label: 'Overdue',
        color: 'red',
        isOverdue: true,
        daysOverdue,
        canSubmit: true, // Late submissions allowed
      };
    }
    return {
      status: ReportStatus.NOT_STARTED,
      label: 'Not Started',
      color: 'gray',
      isOverdue: false,
      daysOverdue: 0,
      canSubmit: true,
    };
  }

  // Check report status
  const reportStatus = report.status?.toUpperCase();

  // If approved, it's complete
  if (reportStatus === 'APPROVED') {
    return {
      status: ReportStatus.APPROVED,
      label: 'Approved',
      color: 'green',
      isOverdue: false,
      daysOverdue: 0,
      canSubmit: false,
    };
  }

  // If draft or pending
  if (reportStatus === 'DRAFT' || reportStatus === 'PENDING' || reportStatus === 'SUBMITTED') {
    // Check if overdue
    if (now > due && !report.submittedAt) {
      return {
        status: ReportStatus.OVERDUE,
        label: 'Overdue (Draft)',
        color: 'red',
        isOverdue: true,
        daysOverdue,
        canSubmit: true,
      };
    }

    // Check if submitted late
    if (report.submittedAt) {
      const submittedDate = new Date(report.submittedAt);
      if (submittedDate > due) {
        return {
          status: ReportStatus.DRAFT,
          label: 'Submitted Late',
          color: 'orange',
          isOverdue: true,
          daysOverdue: Math.floor(
            (submittedDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
          ),
          canSubmit: false,
        };
      }
    }

    return {
      status: ReportStatus.DRAFT,
      label: 'Draft',
      color: 'blue',
      isOverdue: false,
      daysOverdue: 0,
      canSubmit: true,
    };
  }

  // Default case - check if overdue
  if (now > due) {
    return {
      status: ReportStatus.OVERDUE,
      label: 'Overdue',
      color: 'red',
      isOverdue: true,
      daysOverdue,
      canSubmit: true,
    };
  }

  return {
    status: ReportStatus.NOT_STARTED,
    label: 'Not Started',
    color: 'gray',
    isOverdue: false,
    daysOverdue: 0,
    canSubmit: true,
  };
}

/**
 * Get visit submission status
 *
 * @param visit - Visit object (should have status and completedAt properties)
 * @param dueDate - Due date for the visit
 * @returns VisitStatusResult
 */
export function getVisitSubmissionStatus(
  visit: { status?: string; completedAt?: Date | string | null; scheduledDate?: Date | string | null } | null | undefined,
  dueDate: Date,
): VisitStatusResult {
  const now = new Date();
  const due = new Date(dueDate);

  // Calculate days overdue
  const daysOverdue =
    now > due
      ? Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

  // No visit exists
  if (!visit) {
    if (now > due) {
      return {
        status: VisitStatus.OVERDUE,
        label: 'Overdue',
        color: 'red',
        isOverdue: true,
        daysOverdue,
        canComplete: true, // Late visits allowed
      };
    }

    // Calculate days until due
    const daysUntilDue = Math.ceil(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      status: VisitStatus.UPCOMING,
      label: daysUntilDue <= 7 ? 'Due Soon' : 'Upcoming',
      color: daysUntilDue <= 7 ? 'orange' : 'gray',
      isOverdue: false,
      daysOverdue: 0,
      canComplete: true,
    };
  }

  // Check visit status
  const visitStatus = visit.status?.toUpperCase();

  // If completed
  if (visitStatus === 'COMPLETED') {
    // Check if completed late
    if (visit.completedAt) {
      const completedDate = new Date(visit.completedAt);
      if (completedDate > due) {
        return {
          status: VisitStatus.COMPLETED,
          label: 'Completed Late',
          color: 'orange',
          isOverdue: true,
          daysOverdue: Math.floor(
            (completedDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24),
          ),
          canComplete: false,
        };
      }
    }

    return {
      status: VisitStatus.COMPLETED,
      label: 'Completed',
      color: 'green',
      isOverdue: false,
      daysOverdue: 0,
      canComplete: false,
    };
  }

  // If scheduled or pending
  if (visitStatus === 'SCHEDULED' || visitStatus === 'PENDING') {
    // Check if overdue
    if (now > due) {
      return {
        status: VisitStatus.OVERDUE,
        label: 'Overdue (Scheduled)',
        color: 'red',
        isOverdue: true,
        daysOverdue,
        canComplete: true,
      };
    }

    return {
      status: VisitStatus.PENDING,
      label: 'Scheduled',
      color: 'blue',
      isOverdue: false,
      daysOverdue: 0,
      canComplete: true,
    };
  }

  // Default case - check if overdue
  if (now > due) {
    return {
      status: VisitStatus.OVERDUE,
      label: 'Overdue',
      color: 'red',
      isOverdue: true,
      daysOverdue,
      canComplete: true,
    };
  }

  // Calculate days until due
  const daysUntilDue = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    status: VisitStatus.UPCOMING,
    label: daysUntilDue <= 7 ? 'Due Soon' : 'Upcoming',
    color: daysUntilDue <= 7 ? 'orange' : 'gray',
    isOverdue: false,
    daysOverdue: 0,
    canComplete: true,
  };
}

/**
 * Format report name for display
 *
 * @param monthNumber - Month number (1-12)
 * @param year - Year
 * @returns Formatted report name (e.g., "January 2025 Report")
 */
export function formatReportName(monthNumber: number, year?: number): string {
  const monthName = getMonthName(monthNumber);
  if (year) {
    return `${monthName} ${year} Report`;
  }
  return `${monthName} Report`;
}

/**
 * Get the current month cycle info for an internship
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Current month cycle or null if not in any cycle
 */
export function getCurrentMonthCycle(
  startDate: Date,
  endDate: Date,
): MonthlyCycle | null {
  const now = new Date();
  const includedMonths = calculateExpectedMonths(startDate, endDate);

  for (const month of includedMonths) {
    // Check if we're in this month
    const monthStart = new Date(month.year, month.monthNumber - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(month.year, month.monthNumber);
    const monthEnd = new Date(month.year, month.monthNumber - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    if (now >= monthStart && now <= monthEnd) {
      return month;
    }
  }

  return null;
}

/**
 * Get the next upcoming report due date
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Next due date or null if all reports are past due
 */
export function getNextReportDueDate(
  startDate: Date,
  endDate: Date,
): Date | null {
  const now = new Date();
  const includedMonths = calculateExpectedMonths(startDate, endDate);

  for (const month of includedMonths) {
    if (month.reportDueDate > now) {
      return month.reportDueDate;
    }
  }

  return null;
}

/**
 * Get the next upcoming visit due date
 *
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns Next due date or null if all visits are past due
 */
export function getNextVisitDueDate(
  startDate: Date,
  endDate: Date,
): Date | null {
  const now = new Date();
  const includedMonths = calculateExpectedMonths(startDate, endDate);

  for (const month of includedMonths) {
    if (month.visitDueDate > now) {
      return month.visitDueDate;
    }
  }

  return null;
}

/**
 * Check if a date falls within an internship's active period
 *
 * @param date - Date to check
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns true if date is within the internship period
 */
export function isDateInInternshipPeriod(
  date: Date,
  startDate: Date,
  endDate: Date,
): boolean {
  const checkDate = new Date(date);
  const start = new Date(startDate);
  const end = new Date(endDate);

  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return checkDate >= start && checkDate <= end;
}

/**
 * Get month cycle for a specific month/year
 *
 * @param year - Year
 * @param month - Month number (1-12)
 * @param startDate - Internship start date
 * @param endDate - Internship end date
 * @returns MonthlyCycle or null if month is not part of internship
 */
export function getMonthCycle(
  year: number,
  month: number,
  startDate: Date,
  endDate: Date,
): MonthlyCycle | null {
  const includedMonths = calculateExpectedMonths(startDate, endDate);

  return (
    includedMonths.find((m) => m.year === year && m.monthNumber === month) ||
    null
  );
}

// Export constants for external use
export const MONTHLY_CYCLE = {
  MIN_DAYS_FOR_INCLUSION,
  FIRST_MONTH_MIN_DAYS,
  REPORT_DUE_DAY,
  MAX_MONTHS,
  MONTH_NAMES,
};
