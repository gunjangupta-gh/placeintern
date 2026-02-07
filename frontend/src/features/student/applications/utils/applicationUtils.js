import dayjs from 'dayjs';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const formatDisplayDate = (dateString, showTime = false) => {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(showTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return date.toLocaleDateString('en-IN', options);
};

export const formatCurrency = (value) => {
  if (!value) return 'Not specified';
  const numericValue = Number(value);
  if (isNaN(numericValue)) return 'Not specified';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numericValue);
};

export const getStatusColor = (status) => {
  const colors = {
    APPLIED: 'blue',
    UNDER_REVIEW: 'orange',
    ACCEPTED: 'green',
    REJECTED: 'red',
    JOINED: 'cyan',
    COMPLETED: 'purple',
    WITHDRAWN: 'default',
  };
  return colors[status] || 'default';
};

export const getStatusIcon = (status, icons) => {
  const iconMap = {
    APPLIED: icons.clock,
    UNDER_REVIEW: icons.clock,
    ACCEPTED: icons.check,
    REJECTED: icons.close,
    JOINED: icons.check,
    COMPLETED: icons.star,
  };
  return iconMap[status] || icons.clock;
};

export const getReportMonthOptions = () => {
  return MONTH_NAMES.map((name, index) => ({
    value: index + 1,
    label: name,
  }));
};

export const getReportYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear + 2; y >= currentYear - 6; y--) {
    years.push({ value: y, label: y.toString() });
  }
  return years;
};

export const getAllowedReportMonths = (application) => {
  if (!application) return [];

  const startDate = application.isSelfIdentified
    ? application.startDate
    : application.joiningDate || application.internship?.startDate;
  const endDate = application.isSelfIdentified
    ? application.endDate
    : application.internship?.endDate;

  if (!startDate) return [];

  const start = dayjs(startDate).startOf('month');
  const end = dayjs(endDate || dayjs().add(6, 'months')).endOf('month');

  const options = [];
  let current = start.clone();

  while (current.isBefore(end) || current.isSame(end, 'month')) {
    options.push({
      value: current.month() + 1,
      year: current.year(),
      label: `${MONTH_NAMES[current.month()]} ${current.year()}`,
    });
    current = current.add(1, 'month');
  }

  // Remove duplicates
  const unique = [];
  const seen = new Set();
  for (const m of options) {
    const key = `${m.year}-${m.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  }

  return unique;
};

export const getRemainingDays = (dateString) => {
  if (!dateString) return null;
  const targetDate = new Date(dateString);
  const currentDate = new Date();
  return Math.ceil((targetDate - currentDate) / (1000 * 60 * 60 * 24));
};

export const hasInternshipStarted = (application) => {
  if (!application) return false;

  const startDate = application.isSelfIdentified
    ? application.startDate
    : application.joiningDate || application.internship?.startDate;

  if (!startDate) return false;

  return dayjs(startDate).isSameOrBefore(dayjs(), 'day');
};

/**
 * Calculate submission window for a report (1st-10th of next month)
 */
export const getSubmissionWindow = (reportMonth, reportYear) => {
  const nextMonth = reportMonth === 12 ? 1 : reportMonth + 1;
  const nextYear = reportMonth === 12 ? reportYear + 1 : reportYear;

  const windowStart = dayjs(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
  const windowEnd = dayjs(`${nextYear}-${String(nextMonth).padStart(2, '0')}-10`).endOf('day');

  return {
    windowStart: windowStart.toDate(),
    windowEnd: windowEnd.toDate(),
    windowStartFormatted: windowStart.format('MMM D, YYYY'),
    windowEndFormatted: windowEnd.format('MMM D, YYYY'),
  };
};

/**
 * Get report submission status with label, color, and actionability
 * @param {Object} report - The report object
 * @returns {Object} - { status, label, color, canSubmit, sublabel }
 */
export const getReportSubmissionStatus = (report) => {
  const now = dayjs();

  // If report is already approved
  if (report.status === 'APPROVED' || report.isApproved) {
    return {
      status: 'APPROVED',
      label: 'Approved',
      color: 'green',
      canSubmit: false,
      sublabel: report.approvedAt ? `Approved on ${dayjs(report.approvedAt).format('MMM D')}` : 'Auto-approved',
    };
  }

  // Calculate submission window
  let windowStart, windowEnd;

  if (report.submissionWindowStart && report.submissionWindowEnd) {
    windowStart = dayjs(report.submissionWindowStart);
    windowEnd = dayjs(report.submissionWindowEnd);
  } else {
    const window = getSubmissionWindow(report.reportMonth, report.reportYear);
    windowStart = dayjs(window.windowStart);
    windowEnd = dayjs(window.windowEnd);
  }

  // Before submission window
  if (now.isBefore(windowStart)) {
    const daysUntil = Math.ceil((windowStart.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'NOT_YET_DUE',
      label: 'Not Yet Due',
      color: 'default',
      canSubmit: false,
      sublabel: `Opens in ${daysUntil} days`,
    };
  }

  // Within submission window
  if (now.isSameOrBefore(windowEnd)) {
    const daysLeft = Math.ceil((windowEnd.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'CAN_SUBMIT',
      label: 'Submit Now',
      color: 'blue',
      canSubmit: true,
      sublabel: `${daysLeft} days left`,
    };
  }

  // After submission window (overdue)
  const daysOverdue = Math.ceil((now.toDate().getTime() - windowEnd.toDate().getTime()) / (1000 * 60 * 60 * 24));
  return {
    status: 'OVERDUE',
    label: 'Overdue',
    color: 'red',
    canSubmit: true, // Still allow late submissions
    sublabel: `${daysOverdue} days overdue`,
  };
};

/**
 * Calculate all expected report periods for an internship
 * @param {Date|string} startDate - Internship start date
 * @param {Date|string} endDate - Internship end date
 * @returns {Array} - Array of report periods
 */
export const calculateExpectedReports = (startDate, endDate) => {
  if (!startDate || !endDate) return [];

  const start = dayjs(startDate);
  const end = dayjs(endDate);
  const periods = [];

  let current = start.startOf('month');

  while (current.isSameOrBefore(end, 'month')) {
    const month = current.month() + 1; // 1-12
    const year = current.year();
    const window = getSubmissionWindow(month, year);

    const isFirstMonth = current.isSame(start, 'month');
    const isLastMonth = current.isSame(end, 'month');

    periods.push({
      month,
      year,
      monthName: MONTH_NAMES[month - 1],
      periodStart: isFirstMonth ? start.toDate() : current.toDate(),
      periodEnd: isLastMonth ? end.toDate() : current.endOf('month').toDate(),
      submissionWindowStart: window.windowStart,
      submissionWindowEnd: window.windowEnd,
      dueDate: window.windowEnd,
      isPartialMonth: isFirstMonth && start.date() > 1,
      isFinalReport: isLastMonth,
    });

    current = current.add(1, 'month');

    // Safety limit
    if (periods.length > 24) break;
  }

  return periods;
};

// Visit grace period constant (should match backend VISIT_GRACE_DAYS)
const VISIT_GRACE_DAYS = 5;

/**
 * Get faculty visit due date (cycle end date + 5 days grace period)
 * NOTE: This is now deprecated for new 4-week cycle system.
 *       The backend calculates requiredByDate with grace period included.
 *       This function is kept for backward compatibility with monthly cycles.
 * @param {number} month - Month (1-12)
 * @param {number} year - Year
 * @param {Date|string} internshipEndDate - Internship end date
 * @returns {Date} - Due date for the visit (includes 5-day grace period)
 */
export const getVisitDueDate = (month, year, internshipEndDate) => {
  const lastDayOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).endOf('month');

  let baseDate;
  if (!internshipEndDate) {
    baseDate = lastDayOfMonth;
  } else {
    const endDate = dayjs(internshipEndDate);
    // If internship ends in this month, base date is the internship end date
    if (endDate.year() === year && endDate.month() + 1 === month) {
      baseDate = endDate;
    } else {
      baseDate = lastDayOfMonth;
    }
  }

  // Add 5-day grace period
  return baseDate.add(VISIT_GRACE_DAYS, 'day').endOf('day').toDate();
};

/**
 * Get visit status for faculty visits
 * NOTE: The backend provides requiredByDate which already includes the 5-day grace period.
 *       A visit is only considered overdue after the grace period has passed.
 * @param {Object} visit - The visit object (with requiredByDate, cycleStartDate, cycleEndDate from backend)
 * @returns {Object} - { status, label, color, sublabel }
 */
export const getVisitStatus = (visit) => {
  const now = dayjs();
  const requiredByDate = visit.requiredByDate ? dayjs(visit.requiredByDate) : null;
  const cycleEndDate = visit.cycleEndDate ? dayjs(visit.cycleEndDate) : null;
  const cycleStartDate = visit.cycleStartDate ? dayjs(visit.cycleStartDate) : null;

  // If visit is completed
  if (visit.status === 'COMPLETED') {
    return {
      status: 'COMPLETED',
      label: 'Completed',
      color: 'green',
      sublabel: visit.visitDate ? `Visited on ${dayjs(visit.visitDate).format('MMM D, YYYY')}` : undefined,
    };
  }

  if (!requiredByDate) {
    return {
      status: 'PENDING',
      label: 'Pending',
      color: 'blue',
    };
  }

  // Check if overdue (past requiredByDate which includes 5-day grace period)
  if (now.isAfter(requiredByDate)) {
    const daysOverdue = Math.floor((now.toDate().getTime() - requiredByDate.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'OVERDUE',
      label: 'Overdue',
      color: 'red',
      sublabel: `${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
    };
  }

  // Check if in grace period (between cycleEnd and requiredByDate)
  if (cycleEndDate && now.isAfter(cycleEndDate) && now.isSameOrBefore(requiredByDate)) {
    const daysLeft = Math.ceil((requiredByDate.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'PENDING',
      label: 'Grace Period',
      color: 'orange',
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to complete`,
    };
  }

  // Check if in current cycle (between cycleStart and cycleEnd)
  if (cycleStartDate && cycleEndDate && now.isSameOrAfter(cycleStartDate) && now.isSameOrBefore(cycleEndDate)) {
    const daysLeft = Math.ceil((cycleEndDate.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'PENDING',
      label: 'Due This Cycle',
      color: 'blue',
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in cycle`,
    };
  }

  // Future cycle
  if (cycleStartDate && now.isBefore(cycleStartDate)) {
    const daysUntil = Math.ceil((cycleStartDate.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'UPCOMING',
      label: 'Upcoming',
      color: 'gray',
      sublabel: `Cycle starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
    };
  }

  // Fallback: Check if current month (for backward compatibility with old visits)
  const currentMonth = now.month() + 1; // dayjs months are 0-indexed
  const currentYear = now.year();
  if (visit.visitMonth === currentMonth && visit.visitYear === currentYear) {
    const daysLeft = Math.ceil((requiredByDate.toDate().getTime() - now.toDate().getTime()) / (1000 * 60 * 60 * 24));
    return {
      status: 'PENDING',
      label: 'Pending',
      color: 'blue',
      sublabel: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`,
    };
  }

  // Future month
  return {
    status: 'UPCOMING',
    label: 'Upcoming',
    color: 'gray',
    sublabel: `Due by ${requiredByDate.format('MMM D, YYYY')}`,
  };
};

/**
 * Format report period for display
 * @param {Object} report - Report with reportMonth, reportYear, isPartialMonth, isFinalReport
 * @returns {string} - Formatted period string
 */
export const formatReportPeriod = (report) => {
  const monthName = MONTH_NAMES[report.reportMonth - 1];
  let period = `${monthName} ${report.reportYear}`;

  if (report.isPartialMonth && report.periodStartDate) {
    period += ` (from ${dayjs(report.periodStartDate).format('D')})`;
  }

  if (report.isFinalReport) {
    period += ' (Final)';
  }

  return period;
};
