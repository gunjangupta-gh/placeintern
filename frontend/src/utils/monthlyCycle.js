/**
 * Fixed Monthly Cycle System for Frontend
 *
 * Business Rules:
 * 1. Visit Inclusion Rule: First month = any days; last month requires >10 days
 * 2. Report Inclusion Rule: January month ALWAYS skipped; last month requires >10 days
 * 3. Report Due Date: 5th of the next month (e.g., January report due Feb 5)
 * 4. Visit Due Date: Last day of the month at 11:59:59 PM (NO grace period)
 * 5. Minimum internship: 16 weeks (4 months typically = 4 reports/visits)
 * 6. Report naming: "January Report", "February Report" etc.
 * 7. Late submissions: Allowed with isOverdue flag, no penalty
 *
 * CONFIGURATION:
 * All business rules can be modified in: src/config/monthlyCycle.config.js
 */

import { MONTHLY_CYCLE_CONFIG } from '../config/monthlyCycle.config';

// Import configuration values
const MONTH_NAMES = MONTHLY_CYCLE_CONFIG.MONTH_NAMES;
const MIN_DAYS_FOR_INCLUSION = MONTHLY_CYCLE_CONFIG.MIN_DAYS_FOR_INCLUSION;
const FIRST_MONTH_MIN_DAYS = MONTHLY_CYCLE_CONFIG.FIRST_MONTH_MIN_DAYS;
const REPORT_DUE_DAY = MONTHLY_CYCLE_CONFIG.REPORT_DUE_DAY;

/**
 * Report submission status values
 * @readonly
 * @enum {string}
 */
export const ReportStatus = {
  NOT_STARTED: 'NOT_STARTED',
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  OVERDUE: 'OVERDUE'
};

/**
 * Visit submission status values
 * @readonly
 * @enum {string}
 */
export const VisitStatus = {
  UPCOMING: 'UPCOMING',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE'
};

/**
 * Safely parse a date from Date object or ISO string
 * @param {Date|string} date - The date to parse
 * @returns {Date|null} - Parsed Date object or null if invalid
 */
function parseDate(date) {
  if (!date) return null;

  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : new Date(date);
  }

  if (typeof date === 'string') {
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Get the number of days in a specific month
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {number} - Number of days in the month
 */
function getDaysInMonth(year, month) {
  // month is 1-12, Date expects 0-11 for month, so we use month (not month-1)
  // and day 0 gives us the last day of the previous month
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate the number of days a student is active in a specific month
 * @param {Date} startDate - Internship start date
 * @param {Date} endDate - Internship end date
 * @param {number} year - The year to check
 * @param {number} month - The month to check (1-12)
 * @returns {number} - Number of active days in the month
 */
function calculateDaysInMonth(startDate, endDate, year, month) {
  const daysInMonth = getDaysInMonth(year, month);

  // First day of the month
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);

  // Last day of the month
  const monthEnd = new Date(year, month - 1, daysInMonth);
  monthEnd.setHours(23, 59, 59, 999);

  // Normalize dates for comparison
  const internStart = new Date(startDate);
  internStart.setHours(0, 0, 0, 0);

  const internEnd = new Date(endDate);
  internEnd.setHours(23, 59, 59, 999);

  // Calculate overlap
  const effectiveStart = internStart > monthStart ? internStart : monthStart;
  const effectiveEnd = internEnd < monthEnd ? internEnd : monthEnd;

  if (effectiveStart > effectiveEnd) {
    return 0;
  }

  // Calculate days (inclusive of both start and end)
  const diffTime = effectiveEnd.getTime() - effectiveStart.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays;
}

/**
 * Get month name from month number
 * @param {number} monthNumber - Month number (1-12)
 * @returns {string} - Full month name
 */
export function getMonthName(monthNumber) {
  if (monthNumber < 1 || monthNumber > 12) {
    return '';
  }
  return MONTH_NAMES[monthNumber - 1];
}

/**
 * Format month label for display (e.g., "January 2025")
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {string} - Formatted month label
 */
export function formatMonthLabel(year, month) {
  const monthName = getMonthName(month);
  if (!monthName) return '';
  return `${monthName} ${year}`;
}

/**
 * Get report due date for a specific month/year
 * Report is due on the 5th of the NEXT month
 * @param {number} year - The year of the report month
 * @param {number} month - The month of the report (1-12)
 * @returns {Date} - The due date (5th of next month at 23:59:59)
 */
export function getReportDueDate(year, month) {
  // Next month
  let dueYear = year;
  let dueMonth = month + 1;

  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }

  // 5th of the next month at end of day
  const dueDate = new Date(dueYear, dueMonth - 1, 5);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * Get visit due date for a specific month/year
 * Visit is due on the last day of the month at 11:59:59 PM
 * @param {number} year - The year
 * @param {number} month - The month (1-12)
 * @returns {Date} - The due date (last day of month at 23:59:59)
 */
export function getVisitDueDate(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const dueDate = new Date(year, month - 1, daysInMonth);
  dueDate.setHours(23, 59, 59, 999);

  return dueDate;
}

/**
 * @typedef {Object} MonthlyCycle
 * @property {number} monthNumber - Month number (1-12)
 * @property {string} monthName - Full month name
 * @property {number} year - The year
 * @property {Date} reportDueDate - Report due date (5th of next month)
 * @property {Date} visitDueDate - Visit due date (last day of month)
 * @property {number} daysInMonth - Days student is active in this month
 * @property {boolean} isFirstMonth - Whether this is the first month of internship
 * @property {boolean} isLastMonth - Whether this is the last month of internship
 * @property {boolean} isIncluded - Whether month is included based on first/last/middle rules
 */

/**
 * Build all months in range with day counts
 * @param {Date} start - Internship start date
 * @param {Date} end - Internship end date
 * @returns {{year:number, month:number, days:number}[]}
 */
function buildAllMonthsInRange(start, end) {
  const allMonths = [];

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1; // 1-12

  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    const daysInThisMonth = calculateDaysInMonth(start, end, currentYear, currentMonth);

    if (daysInThisMonth > 0) {
      allMonths.push({
        year: currentYear,
        month: currentMonth,
        days: daysInThisMonth
      });
    }

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  return allMonths;
}

/**
 * Calculate expected visit months for an internship
 * Visit Rule: First month = any days, last month requires >10 days
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {MonthlyCycle[]} - Array of visit month cycles (only included months)
 */
export function calculateExpectedVisitMonths(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || start > end) {
    return [];
  }

  const allMonths = buildAllMonthsInRange(start, end);
  const months = [];

  for (let i = 0; i < allMonths.length; i++) {
    const monthInfo = allMonths[i];
    const isLast = i === allMonths.length - 1;

    const isIncluded = i === 0
      ? true
      : isLast
        ? monthInfo.days > MIN_DAYS_FOR_INCLUSION
        : true;

    if (!isIncluded) {
      continue;
    }

    months.push({
      monthNumber: monthInfo.month,
      monthName: getMonthName(monthInfo.month),
      year: monthInfo.year,
      reportDueDate: getReportDueDate(monthInfo.year, monthInfo.month),
      visitDueDate: getVisitDueDate(monthInfo.year, monthInfo.month),
      daysInMonth: monthInfo.days,
      isFirstMonth: months.length === 0,
      isLastMonth: false,
      isIncluded: true
    });
  }

  if (months.length > 0) {
    months[months.length - 1].isLastMonth = true;
  }

  return months;
}

/**
 * Calculate expected report months for an internship
 * Report Rule: SKIP January entirely, last month requires >10 days
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {MonthlyCycle[]} - Array of report month cycles (only included months)
 */
export function calculateExpectedReportMonths(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || start > end) {
    return [];
  }

  const allMonths = buildAllMonthsInRange(start, end);
  const months = [];

  for (let i = 0; i < allMonths.length; i++) {
    const monthInfo = allMonths[i];
    const isLast = i === allMonths.length - 1;

    // Skip January entirely for reports
    if (monthInfo.month === 1) {
      continue;
    }

    const isIncluded = isLast
      ? monthInfo.days > MIN_DAYS_FOR_INCLUSION
      : true;

    if (!isIncluded) {
      continue;
    }

    months.push({
      monthNumber: monthInfo.month,
      monthName: getMonthName(monthInfo.month),
      year: monthInfo.year,
      reportDueDate: getReportDueDate(monthInfo.year, monthInfo.month),
      visitDueDate: getVisitDueDate(monthInfo.year, monthInfo.month),
      daysInMonth: monthInfo.days,
      isFirstMonth: months.length === 0,
      isLastMonth: false,
      isIncluded: true
    });
  }

  if (months.length > 0) {
    months[months.length - 1].isLastMonth = true;
  }

  return months;
}

/**
 * Calculate expected months for an internship
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @param {'visit'|'report'} type - Cycle type (visit or report)
 * @returns {MonthlyCycle[]} - Array of monthly cycle objects (only included months)
 */
export function calculateExpectedMonths(startDate, endDate, type = 'visit') {
  return type === 'report'
    ? calculateExpectedReportMonths(startDate, endDate)
    : calculateExpectedVisitMonths(startDate, endDate);
}

/**
 * Get total expected count (reports or visits)
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} - Total number of expected reports/visits
 */
export function getTotalExpectedVisits(startDate, endDate) {
  const months = calculateExpectedVisitMonths(startDate, endDate);
  return months.length;
}

export function getTotalExpectedReports(startDate, endDate) {
  const months = calculateExpectedReportMonths(startDate, endDate);
  return months.length;
}

export function getTotalExpectedCount(startDate, endDate) {
  return getTotalExpectedVisits(startDate, endDate);
}

/**
 * Get expected reports as of today
 * Returns count of reports that should be submitted by now
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} - Number of reports expected as of today
 */
export function getExpectedReportsAsOfToday(startDate, endDate) {
  const months = calculateExpectedMonths(startDate, endDate, 'report');
  const now = new Date();

  let count = 0;
  for (const month of months) {
    // Report is expected if due date has passed
    if (month.reportDueDate <= now) {
      count++;
    }
  }

  return count;
}

/**
 * Get expected visits as of today
 * Returns count of visits that should be completed by now
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {number} - Number of visits expected as of today
 */
export function getExpectedVisitsAsOfToday(startDate, endDate) {
  const months = calculateExpectedMonths(startDate, endDate, 'visit');
  const now = new Date();

  let count = 0;
  for (const month of months) {
    // Visit is expected if due date has passed
    if (month.visitDueDate <= now) {
      count++;
    }
  }

  return count;
}

/**
 * Get report submission status
 * @param {Object|null} report - The report object (null if not started)
 * @param {Date|string} dueDate - The due date for this report
 * @returns {string} - Status: NOT_STARTED, DRAFT, APPROVED, or OVERDUE
 */
export function getReportSubmissionStatus(report, dueDate) {
  const due = parseDate(dueDate);
  const now = new Date();

  if (!report) {
    // No report exists
    if (due && now > due) {
      return ReportStatus.OVERDUE;
    }
    return ReportStatus.NOT_STARTED;
  }

  // Check if report is approved/submitted
  if (report.status === 'approved' || report.status === 'APPROVED') {
    return ReportStatus.APPROVED;
  }

  // Check if it's a draft
  if (report.status === 'draft' || report.status === 'DRAFT' ||
      report.status === 'pending' || report.status === 'PENDING') {
    // Even drafts can be overdue
    if (due && now > due && report.status !== 'approved' && report.status !== 'APPROVED') {
      return ReportStatus.OVERDUE;
    }
    return ReportStatus.DRAFT;
  }

  // Default case - check if overdue
  if (due && now > due) {
    return ReportStatus.OVERDUE;
  }

  return ReportStatus.NOT_STARTED;
}

/**
 * Get visit submission status
 * @param {Object|null} visit - The visit object (null if not scheduled)
 * @param {Date|string} dueDate - The due date for this visit
 * @returns {string} - Status: UPCOMING, PENDING, COMPLETED, or OVERDUE
 */
export function getVisitSubmissionStatus(visit, dueDate) {
  const due = parseDate(dueDate);
  const now = new Date();

  if (!visit) {
    // No visit exists
    if (due && now > due) {
      return VisitStatus.OVERDUE;
    }
    return VisitStatus.UPCOMING;
  }

  // Check if visit is completed
  if (visit.status === 'completed' || visit.status === 'COMPLETED' ||
      visit.isCompleted === true) {
    return VisitStatus.COMPLETED;
  }

  // Check if visit is scheduled/pending
  if (visit.status === 'scheduled' || visit.status === 'SCHEDULED' ||
      visit.status === 'pending' || visit.status === 'PENDING' ||
      visit.scheduledDate) {
    // Check if overdue
    if (due && now > due) {
      return VisitStatus.OVERDUE;
    }
    return VisitStatus.PENDING;
  }

  // Default case - check if overdue
  if (due && now > due) {
    return VisitStatus.OVERDUE;
  }

  return VisitStatus.UPCOMING;
}

/**
 * @typedef {Object} CurrentMonthInfo
 * @property {MonthlyCycle|null} currentMonth - Current active month cycle
 * @property {MonthlyCycle|null} nextMonth - Next month cycle (if any)
 * @property {number} currentIndex - Index of current month in the cycle array (0-based, -1 if not found)
 * @property {number} totalMonths - Total number of expected months
 * @property {boolean} isBeforeStart - True if current date is before internship starts
 * @property {boolean} isAfterEnd - True if current date is after internship ends
 * @property {number} daysUntilReportDue - Days until current report is due (-ve if overdue)
 * @property {number} daysUntilVisitDue - Days until current visit is due (-ve if overdue)
 */

/**
 * Get current month info relative to today
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {CurrentMonthInfo} - Information about the current month in the cycle
 */
export function getCurrentMonthInfo(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const now = new Date();

  const result = {
    currentMonth: null,
    nextMonth: null,
    currentIndex: -1,
    totalMonths: 0,
    isBeforeStart: false,
    isAfterEnd: false,
    daysUntilReportDue: 0,
    daysUntilVisitDue: 0
  };

  if (!start || !end) {
    return result;
  }

  const months = calculateExpectedMonths(start, end, 'visit');
  result.totalMonths = months.length;

  // Check if before start
  if (now < start) {
    result.isBeforeStart = true;
    if (months.length > 0) {
      result.nextMonth = months[0];
    }
    return result;
  }

  // Check if after end
  if (now > end) {
    result.isAfterEnd = true;
    if (months.length > 0) {
      result.currentMonth = months[months.length - 1];
      result.currentIndex = months.length - 1;
    }
    return result;
  }

  // Find current month
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  for (let i = 0; i < months.length; i++) {
    const month = months[i];

    if (month.year === currentYear && month.monthNumber === currentMonthNum) {
      result.currentMonth = month;
      result.currentIndex = i;

      if (i + 1 < months.length) {
        result.nextMonth = months[i + 1];
      }

      // Calculate days until due
      const reportDue = month.reportDueDate;
      const visitDue = month.visitDueDate;

      result.daysUntilReportDue = Math.ceil(
        (reportDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      result.daysUntilVisitDue = Math.ceil(
        (visitDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      break;
    }
  }

  // If current month not in included months, find the closest one
  if (!result.currentMonth && months.length > 0) {
    // Find the month we should be working on
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      const monthDate = new Date(month.year, month.monthNumber - 1, 1);

      if (monthDate > now) {
        // This month is in the future, so previous month (if any) is current
        if (i > 0) {
          result.currentMonth = months[i - 1];
          result.currentIndex = i - 1;
        }
        result.nextMonth = month;
        break;
      }

      // If this is the last month and we're past it
      if (i === months.length - 1) {
        result.currentMonth = month;
        result.currentIndex = i;
      }
    }

    // Calculate days until due for the found current month
    if (result.currentMonth) {
      result.daysUntilReportDue = Math.ceil(
        (result.currentMonth.reportDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      result.daysUntilVisitDue = Math.ceil(
        (result.currentMonth.visitDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return result;
}

/**
 * Get all months in range (including excluded ones) for display purposes
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {MonthlyCycle[]} - Array of all monthly cycle objects (including excluded)
 */
export function getAllMonthsInRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || start > end) {
    return [];
  }

  const allMonths = [];

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1;

  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;

  let index = 0;
  const totalMonthsCount = [];

  // First pass: collect all months
  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    totalMonthsCount.push({ year: currentYear, month: currentMonth });
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }

  // Second pass: build cycle objects
  currentYear = start.getFullYear();
  currentMonth = start.getMonth() + 1;

  for (let i = 0; i < totalMonthsCount.length; i++) {
    const { year, month } = totalMonthsCount[i];
    const daysInThisMonth = calculateDaysInMonth(start, end, year, month);
    const isFirst = i === 0;
    const isLast = i === totalMonthsCount.length - 1;
    const isIncluded = isFirst
      ? daysInThisMonth > FIRST_MONTH_MIN_DAYS
      : isLast
        ? daysInThisMonth > MIN_DAYS_FOR_INCLUSION
        : daysInThisMonth > MIN_DAYS_FOR_INCLUSION;

    allMonths.push({
      monthNumber: month,
      monthName: getMonthName(month),
      year: year,
      reportDueDate: getReportDueDate(year, month),
      visitDueDate: getVisitDueDate(year, month),
      daysInMonth: daysInThisMonth,
      isFirstMonth: isFirst,
      isLastMonth: isLast,
      isIncluded: isIncluded
    });
  }

  return allMonths;
}

/**
 * Check if a specific month/year is included in the internship cycle
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @param {number} year - Year to check
 * @param {number} month - Month to check (1-12)
 * @returns {boolean} - True if month is included
 */
export function isMonthIncluded(startDate, endDate, year, month, type = 'visit') {
  const months = calculateExpectedMonths(startDate, endDate, type);
  return months.some(m => m.year === year && m.monthNumber === month);
}

/**
 * Get the month cycle for a specific month/year
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @param {number} year - Year to get
 * @param {number} month - Month to get (1-12)
 * @returns {MonthlyCycle|null} - The month cycle or null if not found
 */
export function getMonthCycle(startDate, endDate, year, month, type = 'visit') {
  const allMonths = getAllMonthsInRange(startDate, endDate, type);
  return allMonths.find(m => m.year === year && m.monthNumber === month) || null;
}

// Default export with all functions
const monthlyCycle = {
  // Constants
  ReportStatus,
  VisitStatus,
  MONTH_NAMES,
  MIN_DAYS_FOR_INCLUSION,
  FIRST_MONTH_MIN_DAYS,

  // Core functions
  calculateExpectedMonths,
  calculateExpectedVisitMonths,
  calculateExpectedReportMonths,
  getReportDueDate,
  getVisitDueDate,
  getTotalExpectedCount,
  getTotalExpectedVisits,
  getTotalExpectedReports,
  getExpectedReportsAsOfToday,
  getExpectedVisitsAsOfToday,

  // Utility functions
  getMonthName,
  formatMonthLabel,
  getReportSubmissionStatus,
  getVisitSubmissionStatus,
  getCurrentMonthInfo,

  // Additional helper functions
  getAllMonthsInRange,
  isMonthIncluded,
  getMonthCycle
};

export default monthlyCycle;
