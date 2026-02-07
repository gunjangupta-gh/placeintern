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
 * Base selector to get the entire industry state slice
 * @param {Object} state - Redux root state
 * @returns {Object} Industry state slice
 */
export const selectIndustryState = (state) => state.industry || DEFAULT_OBJECT;

// ============================================================================
// DASHBOARD SELECTORS
// ============================================================================

/**
 * Selector for the entire dashboard state object
 * @param {Object} state - Redux root state
 * @returns {Object} Dashboard state containing stats, loading, and error
 */
export const selectDashboard = createSelector(
  [selectIndustryState],
  (industry) => industry.dashboard || DEFAULT_OBJECT
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
// POSTINGS SELECTORS
// ============================================================================

/**
 * Selector for the entire postings state object
 * @param {Object} state - Redux root state
 * @returns {Object} Postings state containing list, selected, loading, and error
 */
export const selectPostings = createSelector(
  [selectIndustryState],
  (industry) => industry.postings || DEFAULT_OBJECT
);

/**
 * Selector for the postings list array
 * @param {Object} state - Redux root state
 * @returns {Array} Array of posting objects
 */
export const selectPostingsList = createSelector(
  [selectPostings],
  (postings) => postings.list || DEFAULT_ARRAY
);

/**
 * Selector for the selected posting
 * @param {Object} state - Redux root state
 * @returns {Object|null} Selected posting object or null
 */
export const selectSelectedPosting = createSelector(
  [selectPostings],
  (postings) => postings.selected || DEFAULT_NULL
);

/**
 * Selector for postings loading state
 * @param {Object} state - Redux root state
 * @returns {boolean} True if postings are currently loading
 */
export const selectPostingsLoading = createSelector(
  [selectPostings],
  (postings) => postings.loading || DEFAULT_BOOL
);

/**
 * Selector for postings error message
 * @param {Object} state - Redux root state
 * @returns {string|null} Error message or null
 */
export const selectPostingsError = createSelector(
  [selectPostings],
  (postings) => postings.error || DEFAULT_NULL
);

// ============================================================================
// APPLICATIONS SELECTORS
// ============================================================================

/**
 * Selector for the entire applications state object
 * @param {Object} state - Redux root state
 * @returns {Object} Applications state containing list, loading, and error
 */
export const selectApplications = createSelector(
  [selectIndustryState],
  (industry) => industry.applications || DEFAULT_OBJECT
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

// ============================================================================
// INTERNSHIPS SELECTORS
// ============================================================================

/**
 * Selector for the entire internships state object
 * @param {Object} state - Redux root state
 * @returns {Object} Internships state containing list, selected, loading, and error
 */
export const selectInternships = createSelector(
  [selectIndustryState],
  (industry) => industry.internships || DEFAULT_OBJECT
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
 * Selector for the selected internship
 * @param {Object} state - Redux root state
 * @returns {Object|null} Selected internship object or null
 */
export const selectSelectedInternship = createSelector(
  [selectInternships],
  (internships) => internships.selected || DEFAULT_NULL
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
// PROFILE SELECTORS
// ============================================================================

/**
 * Selector for the entire profile state object
 * @param {Object} state - Redux root state
 * @returns {Object} Profile state containing data, loading, and error
 */
export const selectProfile = createSelector(
  [selectIndustryState],
  (industry) => industry.profile || DEFAULT_OBJECT
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
// LAST FETCHED SELECTORS
// ============================================================================

/**
 * Selector for the entire lastFetched state object
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing timestamps for when each data type was last fetched
 */
export const selectLastFetched = createSelector(
  [selectIndustryState],
  (industry) => industry.lastFetched || DEFAULT_OBJECT
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
 * Selector for postings last fetched timestamp
 * @param {Object} state - Redux root state
 * @returns {number|null} Timestamp or null
 */
export const selectPostingsLastFetched = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.postings || DEFAULT_NULL
);

/**
 * Selector for postings cache key
 * @param {Object} state - Redux root state
 * @returns {string|null} Cache key or null
 */
export const selectPostingsCacheKey = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.postingsKey || DEFAULT_NULL
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
 * Selector for applications cache key
 * @param {Object} state - Redux root state
 * @returns {string|null} Cache key or null
 */
export const selectApplicationsCacheKey = createSelector(
  [selectLastFetched],
  (lastFetched) => lastFetched.applicationsKey || DEFAULT_NULL
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

// ============================================================================
// DERIVED SELECTORS - FILTERED POSTINGS
// ============================================================================

/**
 * Derived selector - filters active postings
 * @param {Object} state - Redux root state
 * @returns {Array} Array of active posting objects
 */
export const selectActivePostings = createSelector(
  [selectPostingsList],
  (postings) => postings.filter((posting) => posting.isActive === true)
);

/**
 * Derived selector - filters inactive postings
 * @param {Object} state - Redux root state
 * @returns {Array} Array of inactive posting objects
 */
export const selectInactivePostings = createSelector(
  [selectPostingsList],
  (postings) => postings.filter((posting) => posting.isActive === false)
);

/**
 * Derived selector - filters draft postings
 * @param {Object} state - Redux root state
 * @returns {Array} Array of draft posting objects
 */
export const selectDraftPostings = createSelector(
  [selectPostingsList],
  (postings) => postings.filter((posting) => posting.status === 'DRAFT' || posting.status === 'draft')
);

/**
 * Derived selector - filters published postings
 * @param {Object} state - Redux root state
 * @returns {Array} Array of published posting objects
 */
export const selectPublishedPostings = createSelector(
  [selectPostingsList],
  (postings) => postings.filter((posting) => posting.status === 'PUBLISHED' || posting.status === 'published')
);

/**
 * Derived selector - filters closed postings
 * @param {Object} state - Redux root state
 * @returns {Array} Array of closed posting objects
 */
export const selectClosedPostings = createSelector(
  [selectPostingsList],
  (postings) => postings.filter((posting) => posting.status === 'CLOSED' || posting.status === 'closed')
);

/**
 * Derived selector - counts postings by status
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing counts by status
 */
export const selectPostingsStats = createSelector(
  [selectPostingsList],
  (postings) => {
    const stats = {
      total: postings.length,
      active: 0,
      inactive: 0,
      draft: 0,
      published: 0,
      closed: 0,
    };

    postings.forEach((posting) => {
      if (posting.isActive === true) {
        stats.active++;
      } else if (posting.isActive === false) {
        stats.inactive++;
      }

      const status = posting.status?.toLowerCase();
      switch (status) {
        case 'draft':
          stats.draft++;
          break;
        case 'published':
          stats.published++;
          break;
        case 'closed':
          stats.closed++;
          break;
        default:
          break;
      }
    });

    return stats;
  }
);

// ============================================================================
// DERIVED SELECTORS - FILTERED APPLICATIONS
// ============================================================================

/**
 * Derived selector - filters pending applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of pending application objects
 */
export const selectPendingApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => {
    const status = app.status?.toUpperCase();
    return status === 'PENDING' || status === 'APPLIED' || status === 'SUBMITTED';
  })
);

/**
 * Derived selector - filters shortlisted applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of shortlisted application objects
 */
export const selectShortlistedApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => {
    const status = app.status?.toUpperCase();
    return status === 'SHORTLISTED' || status === 'UNDER_REVIEW';
  })
);

/**
 * Derived selector - filters selected/approved applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of selected application objects
 */
export const selectSelectedApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => {
    const status = app.status?.toUpperCase();
    return status === 'SELECTED' || status === 'APPROVED' || status === 'ACCEPTED';
  })
);

/**
 * Derived selector - filters rejected applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of rejected application objects
 */
export const selectRejectedApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => app.status?.toUpperCase() === 'REJECTED')
);

/**
 * Derived selector - filters withdrawn applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of withdrawn application objects
 */
export const selectWithdrawnApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => app.status?.toUpperCase() === 'WITHDRAWN')
);

/**
 * Derived selector - filters applications with optimistic updates
 * @param {Object} state - Redux root state
 * @returns {Array} Array of application objects with pending optimistic updates
 */
export const selectOptimisticApplications = createSelector(
  [selectApplicationsList],
  (applications) => applications.filter((app) => app._isOptimistic === true)
);

/**
 * Derived selector - calculates application statistics by status
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing counts by status
 */
export const selectApplicationStats = createSelector(
  [selectApplicationsList],
  (applications) => {
    const stats = {
      total: applications.length,
      pending: 0,
      shortlisted: 0,
      selected: 0,
      rejected: 0,
      withdrawn: 0,
      underReview: 0,
    };

    applications.forEach((app) => {
      const status = app.status?.toUpperCase();
      switch (status) {
        case 'PENDING':
        case 'APPLIED':
        case 'SUBMITTED':
          stats.pending++;
          break;
        case 'SHORTLISTED':
          stats.shortlisted++;
          break;
        case 'UNDER_REVIEW':
          stats.underReview++;
          break;
        case 'SELECTED':
        case 'APPROVED':
        case 'ACCEPTED':
          stats.selected++;
          break;
        case 'REJECTED':
          stats.rejected++;
          break;
        case 'WITHDRAWN':
          stats.withdrawn++;
          break;
        default:
          break;
      }
    });

    return stats;
  }
);

/**
 * Derived selector - groups applications by posting ID
 * @param {Object} state - Redux root state
 * @returns {Object} Object with posting IDs as keys and arrays of applications as values
 */
export const selectApplicationsByPosting = createSelector(
  [selectApplicationsList],
  (applications) => {
    const grouped = {};

    applications.forEach((app) => {
      const postingId = app.postingId || app.internshipPosting?.id || app.internshipId;
      if (postingId) {
        if (!grouped[postingId]) {
          grouped[postingId] = [];
        }
        grouped[postingId].push(app);
      }
    });

    return grouped;
  }
);

/**
 * Derived selector - gets application count for each posting
 * @param {Object} state - Redux root state
 * @returns {Object} Object with posting IDs as keys and counts as values
 */
export const selectApplicationCountsByPosting = createSelector(
  [selectApplicationsByPosting],
  (applicationsByPosting) => {
    const counts = {};
    Object.keys(applicationsByPosting).forEach((postingId) => {
      counts[postingId] = applicationsByPosting[postingId].length;
    });
    return counts;
  }
);

// ============================================================================
// UTILITY SELECTORS
// ============================================================================

/**
 * Derived selector - checks if any data is currently loading
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any industry data is loading
 */
export const selectIsAnyLoading = createSelector(
  [
    selectDashboardLoading,
    selectPostingsLoading,
    selectApplicationsLoading,
    selectInternshipsLoading,
    selectProfileLoading,
  ],
  (...loadingStates) => loadingStates.some((loading) => loading === true)
);

/**
 * Derived selector - gets all errors across industry state
 * @param {Object} state - Redux root state
 * @returns {Object} Object containing all error messages keyed by data type
 */
export const selectAllErrors = createSelector(
  [
    selectDashboardError,
    selectPostingsError,
    selectApplicationsError,
    selectInternshipsError,
    selectProfileError,
  ],
  (dashboardError, postingsError, applicationsError, internshipsError, profileError) => ({
    dashboard: dashboardError,
    postings: postingsError,
    applications: applicationsError,
    internships: internshipsError,
    profile: profileError,
  })
);

/**
 * Derived selector - checks if there are any errors
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any industry data has errors
 */
export const selectHasAnyError = createSelector(
  [selectAllErrors],
  (errors) => Object.values(errors).some((error) => error !== null && error !== undefined)
);

/**
 * Combined loading states object for use in hooks
 * @param {Object} state - Redux root state
 * @returns {Object} Object with loading state for each data type
 */
export const selectCombinedLoadingStates = createSelector(
  [
    selectDashboardLoading,
    selectPostingsLoading,
    selectApplicationsLoading,
    selectInternshipsLoading,
    selectProfileLoading,
  ],
  (dashboard, postings, applications, internships, profile) => ({
    dashboard,
    postings,
    applications,
    internships,
    profile,
  })
);

/**
 * Combined errors object for use in hooks
 * @param {Object} state - Redux root state
 * @returns {Object} Object with error state for each data type
 */
export const selectCombinedErrors = createSelector(
  [
    selectDashboardError,
    selectPostingsError,
    selectApplicationsError,
    selectInternshipsError,
    selectProfileError,
  ],
  (dashboard, postings, applications, internships, profile) => ({
    dashboard,
    postings,
    applications,
    internships,
    profile,
  })
);

/**
 * Overall loading state for dashboard
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any critical dashboard data is loading
 */
export const selectDashboardIsLoading = createSelector(
  [selectDashboardLoading, selectPostingsLoading, selectApplicationsLoading],
  (dashboard, postings, applications) => dashboard || postings || applications
);

/**
 * Has dashboard error - checks if any critical dashboard data has errors
 * @param {Object} state - Redux root state
 * @returns {boolean} True if any critical data has errors
 */
export const selectHasDashboardError = createSelector(
  [selectDashboardError, selectPostingsError, selectApplicationsError],
  (dashboard, postings, applications) => !!(dashboard || postings || applications)
);

// ============================================================================
// ADVANCED DERIVED SELECTORS
// ============================================================================

/**
 * Derived selector - gets postings with application counts
 * @param {Object} state - Redux root state
 * @returns {Array} Array of posting objects enriched with application counts
 */
export const selectPostingsWithApplicationCounts = createSelector(
  [selectPostingsList, selectApplicationCountsByPosting],
  (postings, applicationCounts) =>
    postings.map((posting) => ({
      ...posting,
      applicationCount: applicationCounts[posting.id] || 0,
    }))
);

/**
 * Derived selector - gets postings sorted by most applications
 * @param {Object} state - Redux root state
 * @returns {Array} Array of posting objects sorted by application count (descending)
 */
export const selectPostingsByApplicationCount = createSelector(
  [selectPostingsWithApplicationCounts],
  (postings) => [...postings].sort((a, b) => b.applicationCount - a.applicationCount)
);

/**
 * Derived selector - gets recent postings (created in last 30 days)
 * @param {Object} state - Redux root state
 * @returns {Array} Array of recent posting objects
 */
export const selectRecentPostings = createSelector(
  [selectPostingsList],
  (postings) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return postings.filter((posting) => {
      const createdAt = new Date(posting.createdAt);
      return createdAt >= thirtyDaysAgo;
    });
  }
);

/**
 * Derived selector - gets recent applications (created in last 7 days)
 * @param {Object} state - Redux root state
 * @returns {Array} Array of recent application objects
 */
export const selectRecentApplications = createSelector(
  [selectApplicationsList],
  (applications) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return applications.filter((app) => {
      const createdAt = new Date(app.createdAt);
      return createdAt >= sevenDaysAgo;
    });
  }
);

/**
 * Derived selector - gets applications requiring action (pending review)
 * @param {Object} state - Redux root state
 * @returns {Array} Array of application objects requiring action
 */
export const selectApplicationsRequiringAction = createSelector(
  [selectApplicationsList],
  (applications) => {
    return applications.filter((app) => {
      const status = app.status?.toUpperCase();
      return status === 'PENDING' || status === 'APPLIED' || status === 'SUBMITTED';
    });
  }
);

/**
 * Derived selector - counts applications requiring action
 * @param {Object} state - Redux root state
 * @returns {number} Count of applications requiring action
 */
export const selectApplicationsRequiringActionCount = createSelector(
  [selectApplicationsRequiringAction],
  (applications) => applications.length
);

/**
 * Derived selector - gets normalized applications list (handles pagination)
 * @param {Object} state - Redux root state
 * @returns {Array} Normalized array of applications
 */
export const selectNormalizedApplicationsList = createSelector(
  [selectApplicationsList],
  (list) => {
    if (Array.isArray(list)) {
      return list;
    }
    return list?.applications || list?.data || DEFAULT_ARRAY;
  }
);

/**
 * Derived selector - gets normalized postings list (handles pagination)
 * @param {Object} state - Redux root state
 * @returns {Array} Normalized array of postings
 */
export const selectNormalizedPostingsList = createSelector(
  [selectPostingsList],
  (list) => {
    if (Array.isArray(list)) {
      return list;
    }
    return list?.postings || list?.data || DEFAULT_ARRAY;
  }
);

/**
 * Derived selector - gets posting by ID (factory function)
 * @param {string|number} postingId - The posting ID to find
 * @returns {Function} Selector function that returns the posting or null
 */
export const makeSelectPostingById = (postingId) =>
  createSelector([selectPostingsList], (postings) => {
    return postings.find((posting) => posting.id === postingId) || DEFAULT_NULL;
  });

/**
 * Derived selector - gets application by ID (factory function)
 * @param {string|number} applicationId - The application ID to find
 * @returns {Function} Selector function that returns the application or null
 */
export const makeSelectApplicationById = (applicationId) =>
  createSelector([selectApplicationsList], (applications) => {
    return applications.find((app) => app.id === applicationId) || DEFAULT_NULL;
  });

/**
 * Derived selector - gets applications for a specific posting (factory function)
 * @param {string|number} postingId - The posting ID to filter by
 * @returns {Function} Selector function that returns array of applications
 */
export const makeSelectApplicationsByPostingId = (postingId) =>
  createSelector([selectApplicationsList], (applications) => {
    return applications.filter((app) => {
      const appPostingId = app.postingId || app.internshipPosting?.id || app.internshipId;
      return appPostingId === postingId;
    });
  });

/**
 * Derived selector - calculates overall statistics for industry dashboard
 * @param {Object} state - Redux root state
 * @returns {Object} Comprehensive statistics object
 */
export const selectOverallStats = createSelector(
  [
    selectPostingsStats,
    selectApplicationStats,
    selectDashboardStats,
    selectApplicationsRequiringActionCount,
  ],
  (postingsStats, applicationStats, dashboardStats, actionRequiredCount) => ({
    postings: postingsStats,
    applications: applicationStats,
    dashboard: dashboardStats,
    actionRequired: actionRequiredCount,
  })
);
