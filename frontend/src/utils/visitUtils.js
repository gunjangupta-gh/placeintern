import { getTotalExpectedVisits } from './monthlyCycle';

/**
 * Get faculty visit status for an internship application
 * Returns total expected for entire internship period (calculated dynamically from dates)
 * @param {Object} application - Internship application object
 * @returns {{ expected: number, completed: number }} Visit status
 */
export function getFacultyVisitStatus(application) {
  if (!application) {
    return { expected: 0, completed: 0 };
  }

  // Get completed visits count
  const visits = application.facultyVisitLogs ||
                 application.visitLogs ||
                 application.visits ||
                 [];
  const completed = Array.isArray(visits) ? visits.length : 0;

  // Calculate total expected visits dynamically based on dates
  const startDate = application.startDate || application.joiningDate;
  const endDate = application.endDate || application.completionDate;

  if (!startDate || !endDate) {
    return { expected: 0, completed };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Always calculate dynamically to reflect date changes
  const expected = getTotalExpectedVisits(start, end);

  return { expected, completed };
}

/**
 * Get report submission status for an internship application
 * Returns total expected for entire internship period (calculated dynamically from dates)
 * @param {Object} application - Internship application object
 * @returns {{ expected: number, completed: number }} Report status
 */
export function getReportStatus(application) {
  if (!application) {
    return { expected: 0, completed: 0 };
  }

  // Get reports
  const reports = application.monthlyReports || application.reports || [];
  const completed = Array.isArray(reports)
    ? reports.filter(r => r.status === 'SUBMITTED' || r.status === 'APPROVED').length
    : 0;

  // Calculate total expected reports dynamically based on dates
  const startDate = application.startDate || application.joiningDate;
  const endDate = application.endDate || application.completionDate;

  if (!startDate || !endDate) {
    return { expected: 0, completed };
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Always calculate dynamically to reflect date changes
  const expected = getTotalExpectedVisits(start, end);

  return { expected, completed };
}
