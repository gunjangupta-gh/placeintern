import { createSelector } from '@reduxjs/toolkit';

// ============================================================================
// DEFAULT CONSTANTS - Reused across selectors for consistent fallback values
// ============================================================================

const DEFAULT_OBJECT = {};
const DEFAULT_ARRAY = [];
const DEFAULT_NULL = null;
const DEFAULT_BOOL = false;
const DEFAULT_STRING = '';

// ============================================================================
// BASE SELECTORS
// ============================================================================

/**
 * Base selector to get the entire student state slice
 * @param {Object} state - Redux root state
 * @returns {Object} Student state slice
 */
export const selectStudentState = (state) => state.student || DEFAULT_OBJECT;

// ============================================================================
// APPLICATIONS SELECTORS
// ============================================================================

/**
 * Selector for the entire applications state object
 * @param {Object} state - Redux root state
 * @returns {Object} Applications state containing list, loading, and error
 */
export const selectApplications = createSelector(
  [selectStudentState],
  (student) => student.applications || DEFAULT_OBJECT
);

/**
 * Selector for the applications list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of application objects
 */
export const selectApplicationsList = createSelector(
  [selectApplications],
  (applications) => applications.list || DEFAULT_ARRAY
);

/**
 * Selector for applications loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if applications are currently loading
 */
export const selectApplicationsLoading = createSelector(
  [selectApplications],
  (applications) => applications.loading || DEFAULT_BOOL
);

/**
 * Selector for applications error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectApplicationsError = createSelector(
  [selectApplications],
  (applications) => applications.error || DEFAULT_NULL
);

/**
 * Derived selector - filters self-identified applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of self-identified applications
 */
export const selectSelfIdentifiedApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => app.isSelfIdentified === true)
);

/**
 * Derived selector - filters platform applications (non-self-identified)
 * @param {Object} state - Redux root state
 * @returns {Array} Array of platform applications
 */
export const selectPlatformApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => !app.isSelfIdentified)
);

/**
 * Derived selector - calculates application statistics by status
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing counts by status (total, pending, approved, rejected, etc.)
 */
export const selectApplicationStats = createSelector(
  [selectApplicationsList],
  (applications) => {
    const stats = {
      total: applications.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      withdrawn: 0,
      underReview: 0,
      shortlisted: 0,
      accepted: 0,
    };

    applications.forEach((app) => {
      const status = app.status?.toLowerCase();
      switch (status) {
        case 'pending':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'withdrawn':
          stats.withdrawn++;
          break;
        case 'under_review':
        case 'under review':
          stats.underReview++;
          break;
        case 'shortlisted':
          stats.shortlisted++;
          break;
        case 'accepted':
          stats.accepted++;
          break;
        default:
          break;
      }
    });

    return stats;
  }
);

// ============================================================================
// PROFILE SELECTORS
// ============================================================================

/**
 * Selector for the entire profile state object
 * @param {Object} state - Redux root state
 * @returns {Object} Profile state containing data, loading, and error
 */
export const selectProfile = createSelector(
  [selectStudentState],
  (student) => student.profile || DEFAULT_OBJECT
);

/**
 * Selector for the profile data
 * @param {Object} state - Redux root state
 * @returns {Object|null} Profile data object or null
 */
export const selectProfileData = createSelector(
  [selectProfile],
  (profile) => profile.data || DEFAULT_NULL
);

/**
 * Selector for profile loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if profile is currently loading
 */
export const selectProfileLoading = createSelector(
  [selectProfile],
  (profile) => profile.loading || DEFAULT_BOOL
);

/**
 * Selector for profile error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectProfileError = createSelector(
  [selectProfile],
  (profile) => profile.error || DEFAULT_NULL
);

// ============================================================================
// DASHBOARD SELECTORS
// ============================================================================

/**
 * Selector for the entire dashboard state object
 * @param {Object} state - Redux root state
 * @returns {Object} Dashboard state containing stats, loading, and error
 */
export const selectDashboard = createSelector(
  [selectStudentState],
  (student) => student.dashboard || DEFAULT_OBJECT
);

/**
 * Selector for dashboard stats data
 * @param {Object} state - Redux root state
 * @returns {Object|null} Dashboard statistics or null
 */
export const selectDashboardStats = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.stats || DEFAULT_NULL
);

/**
 * Selector for dashboard loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if dashboard is currently loading
 */
export const selectDashboardLoading = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.loading || DEFAULT_BOOL
);

/**
 * Selector for dashboard error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectDashboardError = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.error || DEFAULT_NULL
);

// ============================================================================
// INTERNSHIPS SELECTORS
// ============================================================================

/**
 * Selector for the entire internships state object
 * @param {Object} state - Redux root state
 * @returns {Object} Internships state containing list, loading, and error
 */
export const selectInternships = createSelector(
  [selectStudentState],
  (student) => student.internships || DEFAULT_OBJECT
);

/**
 * Selector for the internships list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of internship objects
 */
export const selectInternshipsList = createSelector(
  [selectInternships],
  (internships) => internships.list || DEFAULT_ARRAY
);

/**
 * Selector for internships loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if internships are currently loading
 */
export const selectInternshipsLoading = createSelector(
  [selectInternships],
  (internships) => internships.loading || DEFAULT_BOOL
);

/**
 * Selector for internships error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectInternshipsError = createSelector(
  [selectInternships],
  (internships) => internships.error || DEFAULT_NULL
);

// ============================================================================
// AVAILABLE INTERNSHIPS SELECTORS
// ============================================================================

/**
 * Selector for the entire available internships state object
 * @param {Object} state - Redux root state
 * @returns {Object} Available internships state containing list, loading, and error
 */
export const selectAvailableInternships = createSelector(
  [selectStudentState],
  (student) => student.availableInternships || DEFAULT_OBJECT
);

/**
 * Selector for the available internships list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of available internship objects
 */
export const selectAvailableInternshipsList = createSelector(
  [selectAvailableInternships],
  (availableInternships) => availableInternships.list || DEFAULT_ARRAY
);

/**
 * Selector for available internships loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if available internships are currently loading
 */
export const selectAvailableInternshipsLoading = createSelector(
  [selectAvailableInternships],
  (availableInternships) => availableInternships.loading || DEFAULT_BOOL
);

/**
 * Selector for available internships error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectAvailableInternshipsError = createSelector(
  [selectAvailableInternships],
  (availableInternships) => availableInternships.error || DEFAULT_NULL
);

// ============================================================================
// REPORTS SELECTORS
// ============================================================================

/**
 * Selector for the entire reports state object
 * @param {Object} state - Redux root state
 * @returns {Object} Reports state containing list, loading, and error
 */
export const selectReports = createSelector(
  [selectStudentState],
  (student) => student.reports || DEFAULT_OBJECT
);

/**
 * Selector for the reports list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of report objects
 */
export const selectReportsList = createSelector(
  [selectReports],
  (reports) => reports.list || DEFAULT_ARRAY
);

/**
 * Selector for reports loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if reports are currently loading
 */
export const selectReportsLoading = createSelector(
  [selectReports],
  (reports) => reports.loading || DEFAULT_BOOL
);

/**
 * Selector for reports error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectReportsError = createSelector(
  [selectReports],
  (reports) => reports.error || DEFAULT_NULL
);

// ============================================================================
// ENROLLMENTS SELECTORS
// ============================================================================

/**
 * Selector for the entire enrollments state object
 * @param {Object} state - Redux root state
 * @returns {Object} Enrollments state containing list, loading, and error
 */
export const selectEnrollments = createSelector(
  [selectStudentState],
  (student) => student.enrollments || DEFAULT_OBJECT
);

/**
 * Selector for the enrollments list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of enrollment objects
 */
export const selectEnrollmentsList = createSelector(
  [selectEnrollments],
  (enrollments) => enrollments.list || DEFAULT_ARRAY
);

/**
 * Selector for enrollments loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if enrollments are currently loading
 */
export const selectEnrollmentsLoading = createSelector(
  [selectEnrollments],
  (enrollments) => enrollments.loading || DEFAULT_BOOL
);

/**
 * Selector for enrollments error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectEnrollmentsError = createSelector(
  [selectEnrollments],
  (enrollments) => enrollments.error || DEFAULT_NULL
);

// ============================================================================
// MENTOR SELECTORS
// ============================================================================

/**
 * Selector for the entire mentor state object
 * @param {Object} state - Redux root state
 * @returns {Object} Mentor state containing data, loading, and error
 */
export const selectMentor = createSelector(
  [selectStudentState],
  (student) => student.mentor || DEFAULT_OBJECT
);

/**
 * Selector for mentor data
 * @param {Object} state - Redux root state
 * @returns {Object|null} Mentor data object or null
 */
export const selectMentorData = createSelector(
  [selectMentor],
  (mentor) => mentor.data || DEFAULT_NULL
);

/**
 * Selector for mentor loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if mentor data is currently loading
 */
export const selectMentorLoading = createSelector(
  [selectMentor],
  (mentor) => mentor.loading || DEFAULT_BOOL
);

/**
 * Selector for mentor error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectMentorError = createSelector(
  [selectMentor],
  (mentor) => mentor.error || DEFAULT_NULL
);

// ============================================================================
// GRIEVANCES SELECTORS
// ============================================================================

/**
 * Selector for the entire grievances state object
 * @param {Object} state - Redux root state
 * @returns {Object} Grievances state containing list, loading, and error
 */
export const selectGrievances = createSelector(
  [selectStudentState],
  (student) => student.grievances || DEFAULT_OBJECT
);

/**
 * Selector for the grievances list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of grievance objects
 */
export const selectGrievancesList = createSelector(
  [selectGrievances],
  (grievances) => grievances.list || DEFAULT_ARRAY
);

/**
 * Selector for grievances loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if grievances are currently loading
 */
export const selectGrievancesLoading = createSelector(
  [selectGrievances],
  (grievances) => grievances.loading || DEFAULT_BOOL
);

/**
 * Selector for grievances error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectGrievancesError = createSelector(
  [selectGrievances],
  (grievances) => grievances.error || DEFAULT_NULL
);

// ============================================================================
// SELF-IDENTIFIED INTERNSHIPS SELECTORS
// ============================================================================

/**
 * Selector for the entire self-identified internships state object
 * @param {Object} state - Redux root state
 * @returns {Object} Self-identified internships state containing list, loading, and error
 */
export const selectSelfIdentified = createSelector(
  [selectStudentState],
  (student) => student.selfIdentified || DEFAULT_OBJECT
);

/**
 * Selector for the self-identified internships list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of self-identified internship objects
 */
export const selectSelfIdentifiedList = createSelector(
  [selectSelfIdentified],
  (selfIdentified) => selfIdentified.list || DEFAULT_ARRAY
);

/**
 * Selector for self-identified internships loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if self-identified internships are currently loading
 */
export const selectSelfIdentifiedLoading = createSelector(
  [selectSelfIdentified],
  (selfIdentified) => selfIdentified.loading || DEFAULT_BOOL
);

/**
 * Selector for self-identified internships error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectSelfIdentifiedError = createSelector(
  [selectSelfIdentified],
  (selfIdentified) => selfIdentified.error || DEFAULT_NULL
);

// ============================================================================
// LAST FETCHED SELECTORS
// ============================================================================

/**
 * Selector for the entire lastFetched state object
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing timestamps for when each data type was last fetched
 */
export const selectLastFetched = createSelector(
  [selectStudentState],
  (student) => student.lastFetched || DEFAULT_OBJECT
);

/**
 * Selector for dashboard last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectDashboardLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.dashboard || DEFAULT_NULL
);

/**
 * Selector for profile last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectProfileLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.profile || DEFAULT_NULL
);

/**
 * Selector for internships last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectInternshipsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.internships || DEFAULT_NULL
);

/**
 * Selector for reports last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectReportsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.reports || DEFAULT_NULL
);

/**
 * Selector for applications last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectApplicationsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.applications || DEFAULT_NULL
);

/**
 * Selector for mentor last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectMentorLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.mentor || DEFAULT_NULL
);

/**
 * Selector for grievances last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectGrievancesLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.grievances || DEFAULT_NULL
);

/**
 * Selector for self-identified internships last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectSelfIdentifiedLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.selfIdentified || DEFAULT_NULL
);

/**
 * Selector for enrollments last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectEnrollmentsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.enrollments || DEFAULT_NULL
);

/**
 * Selector for available internships last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectAvailableInternshipsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.availableInternships || DEFAULT_NULL
);

// ============================================================================
// UTILITY SELECTORS
// ============================================================================

/**
 * Derived selector - gets active internship from internships list
 * @param {Object} state - Redux root state
 * @returns {Object|null} Active internship object or null
 */
export const selectActiveInternship = createSelector(
  [selectInternshipsList],
  (internships) => internships.find((internship) => internship.status === 'active') || DEFAULT_NULL
);

/**
 * Derived selector - checks if student has any active internship
 * @param {Object} state - Redux root state
 * @returns {boolean} True if student has an active internship
 */
export const selectHasActiveInternship = createSelector(
  [selectActiveInternship],
  (activeInternship) => !!activeInternship
);

/**
 * Derived selector - gets pending reports that need submission
 * @param {Object} state - Redux root state
 * @returns {Array} Array of pending report objects
 */
export const selectPendingReports = createSelector(
  [selectReportsList],
  (reports) => reports.filter((report) => report.status === 'draft')
);

/**
 * Derived selector - counts pending reports
 * @param {Object} state - Redux root state
 * @returns {number} Count of pending reports
 */
export const selectPendingReportsCount = createSelector(
  [selectPendingReports],
  (pendingReports) => pendingReports.length
);

/**
 * Derived selector - gets unresolved grievances
 * @param {Object} state - Redux root state
 * @returns {Array} Array of unresolved grievance objects
 */
export const selectUnresolvedGrievances = createSelector(
  [selectGrievancesList],
  (grievances) => grievances.filter((grievance) => grievance.status !== 'resolved' && grievance.status !== 'closed')
);

/**
 * Derived selector - counts unresolved grievances
 * @param {Object} state - Redux root state
 * @returns {number} Count of unresolved grievances
 */
export const selectUnresolvedGrievancesCount = createSelector(
  [selectUnresolvedGrievances],
  (unresolvedGrievances) => unresolvedGrievances.length
);

/**
 * Derived selector - checks if any data is currently loading
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any student data is loading
 */
export const selectIsAnyLoading = createSelector(
  [
    selectDashboardLoading,
    selectProfileLoading,
    selectInternshipsLoading,
    selectReportsLoading,
    selectApplicationsLoading,
    selectMentorLoading,
    selectGrievancesLoading,
    selectSelfIdentifiedLoading,
    selectEnrollmentsLoading,
    selectAvailableInternshipsLoading,
  ],
  (...loadingStates) => loadingStates.some((loading) => loading === true)
);

/**
 * Derived selector - gets all errors across student state
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing all error messages keyed by data type
 */
export const selectAllErrors = createSelector(
  [
    selectDashboardError,
    selectProfileError,
    selectInternshipsError,
    selectReportsError,
    selectApplicationsError,
    selectMentorError,
    selectGrievancesError,
    selectSelfIdentifiedError,
    selectEnrollmentsError,
    selectAvailableInternshipsError,
  ],
  (
    dashboardError,
    profileError,
    internshipsError,
    reportsError,
    applicationsError,
    mentorError,
    grievancesError,
    selfIdentifiedError,
    enrollmentsError,
    availableInternshipsError
  ) => ({
    dashboard: dashboardError,
    profile: profileError,
    internships: internshipsError,
    reports: reportsError,
    applications: applicationsError,
    mentor: mentorError,
    grievances: grievancesError,
    selfIdentified: selfIdentifiedError,
    enrollments: enrollmentsError,
    availableInternships: availableInternshipsError,
  })
);

/**
 * Derived selector - checks if there are any errors
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any student data has errors
 */
export const selectHasAnyError = createSelector(
  [selectAllErrors],
  (errors) => Object.values(errors).some((error) => error !== null && error !== undefined)
);

// ============================================================================
// ADDITIONAL DERIVED SELECTORS FOR DASHBOARD & APPLICATIONS
// ============================================================================

/**
 * Normalized applications list - handles both array and paginated response structures
 * @param {Object} state - Redux root state
 * @returns {Array} Normalized array of applications
 */
export const selectNormalizedApplicationsList = createSelector(
  [selectApplicationsList],
  (list) => {
    if (Array.isArray(list)) {
      return list;
    }
    return list?.applications || [];
  }
);

/**
 * Normalized grievances list - handles both array and paginated response structures
 * @param {Object} state - Redux root state
 * @returns {Array} Normalized array of grievances
 */
export const selectNormalizedGrievancesList = createSelector(
  [selectGrievancesList],
  (list) => {
    if (Array.isArray(list)) {
      return list;
    }
    return list?.grievances || [];
  }
);

/**
 * Active internships - applications with SELECTED, APPROVED, JOINED, or ACTIVE status
 * @param {Object} state - Redux root state
 * @returns {Array} Array of active internship applications
 */
export const selectActiveInternships = createSelector(
  [selectNormalizedApplicationsList],
  (applications) => (applications || []).filter(app =>
    ['SELECTED', 'APPROVED', 'JOINED', 'ACTIVE'].includes(app.status) && app.isActive === true
  )
);

/**
 * Recent applications (within last 30 days)
 * @param {Object} state - Redux root state
 * @returns {Array} Array of recently created/updated applications
 */
export const selectRecentApplications = createSelector(
  [selectNormalizedApplicationsList],
  (applications) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return (applications || []).filter(app => {
      const appDate = new Date(app.updatedAt || app.createdAt);
      return appDate >= thirtyDaysAgo;
    }).sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt);
      const dateB = new Date(b.updatedAt || b.createdAt);
      return dateB - dateA; // Most recent first
    });
  }
);

/**
 * Monthly reports with internship info from applications
 * FIXED: Only include reports that are after the internship start date
 * @param {Object} state - Redux root state
 * @returns {Array} Array of monthly reports enriched with application data
 */
export const selectMonthlyReportsWithInfo = createSelector(
  [selectProfileData, selectNormalizedApplicationsList],
  (profileData, stateApplications) => {
    const applications = (profileData?.internshipApplications?.length > 0)
      ? profileData.internshipApplications
      : (stateApplications || []);
    return applications.flatMap(app => {
    const internshipStartDate = app.internship?.startDate || app.startDate;

    return (app.monthlyReports || [])
      .filter(report => {
        // FIXED: Exclude reports before internship start date
        if (internshipStartDate) {
          const startDate = new Date(internshipStartDate);
          const reportDate = new Date(report.reportYear, report.reportMonth - 1, 1);
          const internshipStartMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

          // Only include reports >= internship start month
          return reportDate >= internshipStartMonth;
        }

        // If no start date, include the report
        return true;
      })
      .map(report => ({
        ...report,
        applicationId: report.applicationId || app.id,
        internshipTitle: app.internship?.title || app.title || app.jobProfile,
        companyName: app.internship?.industry?.companyName || app.companyName,
      }));
    });
  }
);

/**
 * Dashboard statistics calculated from current data
 * FIXED: Ensure self-identified count is consistent
 * @param {Object} state - Redux root state
 * @returns {Object} Statistics object with counts
 */
export const selectCalculatedStats = createSelector(
  [
    selectNormalizedApplicationsList,
    selectSelfIdentifiedApplications,
    selectInternshipsList,
    selectNormalizedGrievancesList,
  ],
  (applications, selfIdentified, internships, grievances) => {
    // FIXED: Use a consistent definition for self-identified internships
    // Count applications where isSelfIdentified is true OR internship.isSelfIdentified is true
    const selfIdentifiedCount = applications.filter(app =>
      app.isSelfIdentified === true || app.internship?.isSelfIdentified === true
    ).length;

    return {
      totalApplications: applications.length,
      activeApplications: applications.filter(app =>
        ['APPLIED', 'SHORTLISTED', 'UNDER_REVIEW'].includes(app.status)
      ).length,
      selectedApplications: applications.filter(app =>
        app.status === 'SELECTED' || app.status === 'APPROVED'
      ).length,
      completedInternships: applications.filter(app => app.status === 'COMPLETED').length,
      totalInternships: internships.length,
      grievances: grievances.length,
      selfIdentifiedCount: selfIdentifiedCount,
      ongoingInternships: applications.filter(app =>
        ['SELECTED', 'APPROVED', 'JOINED', 'ACTIVE'].includes(app.status)
      ).length,
    };
  }
);

/**
 * Combined loading states object for use in hooks
 * @param {Object} state - Redux root state
 * @returns {Object} Object with loading state for each data type
 */
export const selectCombinedLoadingStates = createSelector(
  [
    selectDashboardLoading,
    selectProfileLoading,
    selectInternshipsLoading,
    selectApplicationsLoading,
    selectReportsLoading,
    selectMentorLoading,
    selectGrievancesLoading,
  ],
  (dashboard, profile, internships, applications, reports, mentor, grievances) => ({
    dashboard,
    profile,
    internships,
    applications,
    reports,
    mentor,
    grievances,
  })
);

/**
 * Overall loading state for dashboard
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any critical dashboard data is loading
 */
export const selectDashboardIsLoading = createSelector(
  [
    selectDashboardLoading,
    selectProfileLoading,
    selectInternshipsLoading,
    selectApplicationsLoading,
    selectReportsLoading,
  ],
  (dashboard, profile, internships, applications, reports) =>
    dashboard || profile || internships || applications || reports
);

/**
 * Combined errors object for use in hooks
 * @param {Object} state - Redux root state
 * @returns {Object} Object with error state for each data type
 */
export const selectCombinedErrors = createSelector(
  [
    selectDashboardError,
    selectProfileError,
    selectInternshipsError,
    selectApplicationsError,
    selectReportsError,
    selectMentorError,
    selectGrievancesError,
  ],
  (dashboard, profile, internships, applications, reports, mentor, grievances) => ({
    dashboard,
    profile,
    internships,
    applications,
    reports,
    mentor,
    grievances,
  })
);

/**
 * Has dashboard error - checks if any critical dashboard data has errors
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any critical data has errors
 */
export const selectHasDashboardError = createSelector(
  [selectDashboardError, selectProfileError, selectApplicationsError, selectReportsError],
  (dashboard, profile, applications, reports) =>
    !!(dashboard || profile || applications || reports)
);

/**
 * Mentor data with fallback to profile's mentor assignments
 * @param {Object} state - Redux root state
 * @returns {Object|null} Mentor object or null
 */
export const selectMentorWithFallback = createSelector(
  [selectMentorData, selectProfileData],
  (mentorData, profileData) => {
    // First try from profile's mentorAssignments
    if (profileData?.mentorAssignments?.length > 0) {
      const activeAssignment = profileData.mentorAssignments.find(a => a.isActive);
      return activeAssignment?.mentor || null;
    }
    // Fallback to mentor state
    return mentorData;
  }
);

// ============================================================================
// PROFILE DATA EXTRACTION SELECTORS
// These extract data directly from the profile response to avoid redundant API calls
// ============================================================================

/**
 * Extract applications from profile's internshipApplications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of applications from profile
 */
export const selectApplicationsFromProfile = createSelector(
  [selectProfileData],
  (profileData) => profileData?.internshipApplications || DEFAULT_ARRAY
);

/**
 * Extract counts from profile's _count field
 * @param {Object} state - Redux root state
 * @returns {Object} Counts object from profile
 */
export const selectCountsFromProfile = createSelector(
  [selectProfileData],
  (profileData) => profileData?._count || DEFAULT_OBJECT
);

/**
 * Get applications - prefers profile data, falls back to applications state
 * This helps reduce redundant API calls since profile already has internshipApplications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of applications
 */
export const selectApplicationsWithProfileFallback = createSelector(
  [selectApplicationsFromProfile, selectApplicationsList],
  (profileApplications, stateApplications) => {
    // If profile has applications, use those (more up-to-date from single API call)
    if (profileApplications && profileApplications.length > 0) {
      return profileApplications;
    }
    // Fallback to state applications
    return stateApplications;
  }
);

/**
 * Self-identified applications from profile data
 * @param {Object} state - Redux root state
 * @returns {Array} Array of self-identified applications
 */
export const selectSelfIdentifiedFromProfile = createSelector(
  [selectApplicationsFromProfile],
  (applications) => applications.filter((app) => app.isSelfIdentified === true)
);

/**
 * Platform applications from profile data
 * @param {Object} state - Redux root state
 * @returns {Array} Array of platform applications
 */
export const selectPlatformFromProfile = createSelector(
  [selectApplicationsFromProfile],
  (applications) => applications.filter((app) => !app.isSelfIdentified)
);

/**
 * Active internships from profile data
 * @param {Object} state - Redux root state
 * @returns {Array} Array of active internship applications
 */
export const selectActiveInternshipsFromProfile = createSelector(
  [selectApplicationsFromProfile],
  (applications) => applications.filter(app =>
    ['SELECTED', 'APPROVED', 'JOINED', 'ACTIVE'].includes(app.status) && app.isActive !== false
  )
);

/**
 * Quick stats calculated from profile data
 * Uses _count for accurate server-side counts and internshipApplications for status breakdowns
 * @param {Object} state - Redux root state
 * @returns {Object} Statistics object
 */
export const selectStatsFromProfile = createSelector(
  [selectProfileData, selectApplicationsFromProfile, selectCountsFromProfile],
  (profileData, applications, counts) => {
    if (!profileData) return DEFAULT_OBJECT;

    const selfIdentifiedCount = applications.filter(app =>
      app.isSelfIdentified === true
    ).length;

    const activeStatuses = ['SELECTED', 'APPROVED', 'JOINED', 'ACTIVE'];
    const pendingStatuses = ['APPLIED', 'SHORTLISTED', 'UNDER_REVIEW', 'PENDING'];

    return {
      // From _count (server-side accurate counts)
      totalApplications: counts.internshipApplications || applications.length,
      totalMonthlyReports: counts.monthlyReports || 0,
      totalGrievances: counts.grievances || 0,

      // Calculated from applications
      selfIdentifiedCount,
      ongoingInternships: applications.filter(app =>
        activeStatuses.includes(app.status)
      ).length,
      pendingApplications: applications.filter(app =>
        pendingStatuses.includes(app.status)
      ).length,
      completedInternships: applications.filter(app =>
        app.status === 'COMPLETED'
      ).length,
      selectedApplications: applications.filter(app =>
        app.status === 'SELECTED' || app.status === 'APPROVED'
      ).length,
    };
  }
);
