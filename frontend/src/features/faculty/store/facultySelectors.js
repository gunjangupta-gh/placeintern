import { createSelector } from '@reduxjs/toolkit';

// Default values for fallbacks
const DEFAULT_STATS = null;
const DEFAULT_LIST = [];
const DEFAULT_DATA = null;
const DEFAULT_OBJECT = {};
const DEFAULT_LOADING = false;
const DEFAULT_ERROR = null;
const DEFAULT_NUMBER = 0;

// ============= BASE SELECTORS =============

/**
 * Base selector for the entire faculty slice
 */
export const selectFacultyState = (state) => state.faculty;

// ============= DASHBOARD SELECTORS =============

export const selectDashboard = createSelector(
  [selectFacultyState],
  (faculty) => faculty.dashboard || DEFAULT_OBJECT
);

export const selectDashboardStats = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.stats || DEFAULT_STATS
);

export const selectDashboardRecentActivities = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.recentActivities || DEFAULT_LIST
);

export const selectDashboardUpcomingVisits = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.upcomingVisits || DEFAULT_LIST
);

export const selectDashboardLoading = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.loading || DEFAULT_LOADING
);

export const selectDashboardError = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.error || DEFAULT_ERROR
);

// ============= STUDENTS SELECTORS =============

export const selectStudents = createSelector(
  [selectFacultyState],
  (faculty) => faculty.students || DEFAULT_OBJECT
);

export const selectStudentsList = createSelector(
  [selectStudents],
  (students) => students.list || DEFAULT_LIST
);

export const selectStudentsTotal = createSelector(
  [selectStudents],
  (students) => students.total || DEFAULT_NUMBER
);

export const selectStudentsPage = createSelector(
  [selectStudents],
  (students) => students.page || 1
);

export const selectStudentsTotalPages = createSelector(
  [selectStudents],
  (students) => students.totalPages || 1
);

export const selectStudentsLoading = createSelector(
  [selectStudents],
  (students) => students.loading || DEFAULT_LOADING
);

export const selectStudentsError = createSelector(
  [selectStudents],
  (students) => students.error || DEFAULT_ERROR
);

// ============= VISIT LOGS SELECTORS =============

export const selectVisitLogs = createSelector(
  [selectFacultyState],
  (faculty) => faculty.visitLogs || DEFAULT_OBJECT
);

export const selectVisitLogsList = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.list || DEFAULT_LIST
);

export const selectCurrentVisitLog = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.current || DEFAULT_DATA
);

export const selectVisitLogsTotal = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.total || DEFAULT_NUMBER
);

export const selectVisitLogsPage = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.page || 1
);

export const selectVisitLogsTotalPages = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.totalPages || 1
);

export const selectVisitLogsLoading = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.loading || DEFAULT_LOADING
);

export const selectVisitLogsError = createSelector(
  [selectVisitLogs],
  (visitLogs) => visitLogs.error || DEFAULT_ERROR
);

/**
 * Memoized selector to get pending visit logs
 * Filters visit logs that have status 'PENDING'
 */
export const selectPendingVisits = createSelector(
  [selectVisitLogsList],
  (visitLogs) => visitLogs.filter((log) => log.status === 'PENDING')
);

// ============= MONTHLY REPORTS SELECTORS =============

export const selectMonthlyReports = createSelector(
  [selectFacultyState],
  (faculty) => faculty.monthlyReports || DEFAULT_OBJECT
);

export const selectMonthlyReportsList = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.list || DEFAULT_LIST
);

export const selectMonthlyReportsTotal = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.total || DEFAULT_NUMBER
);

export const selectMonthlyReportsPage = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.page || 1
);

export const selectMonthlyReportsTotalPages = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.totalPages || 1
);

export const selectMonthlyReportsLoading = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.loading || DEFAULT_LOADING
);

export const selectMonthlyReportsError = createSelector(
  [selectMonthlyReports],
  (monthlyReports) => monthlyReports.error || DEFAULT_ERROR
);

/**
 * Memoized selector to get pending monthly reports
 * With auto-approval, only DRAFT reports are considered pending
 */
export const selectPendingMonthlyReports = createSelector(
  [selectMonthlyReportsList],
  (reports) => reports.filter((report) => report.status === 'DRAFT')
);

// ============= APPLICATIONS SELECTORS =============

export const selectApplications = createSelector(
  [selectFacultyState],
  (faculty) => faculty.applications || DEFAULT_OBJECT
);

export const selectApplicationsList = createSelector(
  [selectApplications],
  (applications) => applications.list || DEFAULT_LIST
);

export const selectApplicationsTotal = createSelector(
  [selectApplications],
  (applications) => applications.total || DEFAULT_NUMBER
);

export const selectApplicationsPage = createSelector(
  [selectApplications],
  (applications) => applications.page || 1
);

export const selectApplicationsTotalPages = createSelector(
  [selectApplications],
  (applications) => applications.totalPages || 1
);

export const selectApplicationsLoading = createSelector(
  [selectApplications],
  (applications) => applications.loading || DEFAULT_LOADING
);

export const selectApplicationsError = createSelector(
  [selectApplications],
  (applications) => applications.error || DEFAULT_ERROR
);

/**
 * Memoized selector to get pending applications
 * Filters applications that have status 'PENDING'
 */
export const selectPendingApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => app.status === 'PENDING')
);

// ============= JOINING REPORT SELECTORS =============

export const selectJoiningLetters = createSelector(
  [selectFacultyState],
  (faculty) => faculty.joiningLetters || DEFAULT_OBJECT
);

export const selectJoiningLettersList = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.list || DEFAULT_LIST
);

export const selectJoiningLettersTotal = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.total || DEFAULT_NUMBER
);

export const selectJoiningLettersPage = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.page || 1
);

export const selectJoiningLettersTotalPages = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.totalPages || 1
);

export const selectJoiningLettersLoading = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.loading || DEFAULT_LOADING
);

export const selectJoiningLettersError = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.error || DEFAULT_ERROR
);

/**
 * Memoized selector to get pending joining letters
 * Filters joining letters that have status 'PENDING'
 */
export const selectPendingJoiningLetters = createSelector(
  [selectJoiningLettersList],
  (letters) => letters.filter((letter) => letter.status === 'PENDING')
);

// ============= PROFILE SELECTORS =============

export const selectProfile = createSelector(
  [selectFacultyState],
  (faculty) => faculty.profile || DEFAULT_OBJECT
);

export const selectProfileData = createSelector(
  [selectProfile],
  (profile) => profile.data || DEFAULT_DATA
);

export const selectProfileLoading = createSelector(
  [selectProfile],
  (profile) => profile.loading || DEFAULT_LOADING
);

export const selectProfileError = createSelector(
  [selectProfile],
  (profile) => profile.error || DEFAULT_ERROR
);

// Backward compatibility alias
export const selectMentor = selectProfile;
export const selectMentorData = selectProfileData;

// ============= FEEDBACK HISTORY SELECTORS =============

export const selectFeedbackHistory = createSelector(
  [selectFacultyState],
  (faculty) => faculty.feedbackHistory || DEFAULT_OBJECT
);

export const selectFeedbackHistoryList = createSelector(
  [selectFeedbackHistory],
  (feedbackHistory) => feedbackHistory.list || DEFAULT_LIST
);

export const selectFeedbackHistoryTotal = createSelector(
  [selectFeedbackHistory],
  (feedbackHistory) => feedbackHistory.total || DEFAULT_NUMBER
);

export const selectFeedbackHistoryLoading = createSelector(
  [selectFeedbackHistory],
  (feedbackHistory) => feedbackHistory.loading || DEFAULT_LOADING
);

export const selectFeedbackHistoryError = createSelector(
  [selectFeedbackHistory],
  (feedbackHistory) => feedbackHistory.error || DEFAULT_ERROR
);

// Backward compatibility alias
export const selectGrievances = selectFeedbackHistory;
export const selectGrievancesList = selectFeedbackHistoryList;

// ============= CACHE & TIMING SELECTORS =============

export const selectLastFetched = createSelector(
  [selectFacultyState],
  (faculty) => faculty.lastFetched || DEFAULT_OBJECT
);

/**
 * Returns the most recent fetch timestamp across all faculty data
 * Memoized to avoid recalculating on every render
 */
export const selectMostRecentFetch = createSelector(
  [selectLastFetched],
  (lastFetched) => {
    const timestamps = Object.values(lastFetched).filter(
      (value) => typeof value === 'number' && value > 0
    );
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }
);

/**
 * Returns true if any faculty data is currently loading
 * Useful for global loading indicators
 */
export const selectAnyLoading = createSelector(
  [
    selectDashboardLoading,
    selectStudentsLoading,
    selectVisitLogsLoading,
    selectMonthlyReportsLoading,
    selectApplicationsLoading,
    selectJoiningLettersLoading,
    selectProfileLoading,
    selectFeedbackHistoryLoading,
  ],
  (...loadingStates) => loadingStates.some((loading) => loading)
);

/**
 * Returns true if there are any errors in the faculty state
 * Useful for error boundary components
 */
export const selectHasErrors = createSelector(
  [
    selectDashboardError,
    selectStudentsError,
    selectVisitLogsError,
    selectMonthlyReportsError,
    selectApplicationsError,
    selectJoiningLettersError,
    selectProfileError,
    selectFeedbackHistoryError,
  ],
  (...errors) => errors.some((error) => error !== null && error !== undefined)
);

/**
 * Returns aggregate counts for pending items
 * Useful for badge indicators
 */
export const selectPendingCounts = createSelector(
  [
    selectPendingVisits,
    selectPendingMonthlyReports,
    selectPendingApplications,
    selectPendingJoiningLetters,
  ],
  (pendingVisits, pendingReports, pendingApplications, pendingLetters) => ({
    visits: pendingVisits.length,
    reports: pendingReports.length,
    applications: pendingApplications.length,
    joiningLetters: pendingLetters.length,
    total: pendingVisits.length + pendingReports.length + pendingApplications.length + pendingLetters.length,
  })
);

/**
 * Returns all pending items combined
 * Useful for a unified pending items view
 */
export const selectAllPendingItems = createSelector(
  [
    selectPendingVisits,
    selectPendingMonthlyReports,
    selectPendingApplications,
    selectPendingJoiningLetters,
  ],
  (pendingVisits, pendingReports, pendingApplications, pendingLetters) => ({
    visits: pendingVisits,
    reports: pendingReports,
    applications: pendingApplications,
    joiningLetters: pendingLetters,
  })
);
