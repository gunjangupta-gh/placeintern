import { createSelector } from '@reduxjs/toolkit';

// Default values for fallbacks
const DEFAULT_STATS = null;
const DEFAULT_LIST = [];
const DEFAULT_PAGINATION = null;
const DEFAULT_SUMMARY = null;
const DEFAULT_DATA = null;
const DEFAULT_OBJECT = {};
const DEFAULT_LOADING = false;
const DEFAULT_ERROR = null;
const DEFAULT_BOOLEAN = false;
const DEFAULT_NUMBER = 0;
const DEFAULT_STRING = '';

// ============= BASE SELECTORS =============

/**
 * Base selector for the entire state slice
 */
export const selectStateSlice = (state) => state.state;

// ============= DASHBOARD SELECTORS =============

export const selectDashboard = createSelector(
  [selectStateSlice],
  (state) => state.dashboard || DEFAULT_OBJECT
);

export const selectDashboardStats = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.stats || DEFAULT_STATS
);

export const selectDashboardLoading = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.loading || DEFAULT_LOADING
);

export const selectDashboardError = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.error || DEFAULT_ERROR
);

// ============= INSTITUTIONS SELECTORS =============

export const selectInstitutions = createSelector(
  [selectStateSlice],
  (state) => state.institutions || DEFAULT_OBJECT
);

export const selectInstitutionsList = createSelector(
  [selectInstitutions],
  (institutions) => institutions.list || DEFAULT_LIST
);

export const selectInstitutionsLoading = createSelector(
  [selectInstitutions],
  (institutions) => institutions.loading || DEFAULT_LOADING
);

export const selectInstitutionsError = createSelector(
  [selectInstitutions],
  (institutions) => institutions.error || DEFAULT_ERROR
);

export const selectInstitutionsPagination = createSelector(
  [selectInstitutions],
  (institutions) => institutions.pagination || DEFAULT_PAGINATION
);

export const selectSelectedInstitution = createSelector(
  [selectInstitutions],
  (institutions) => institutions.selected || DEFAULT_DATA
);

// Institutions with Stats selectors (for dashboard)
export const selectInstitutionsWithStats = createSelector(
  [selectStateSlice],
  (state) => state.institutionsWithStats || DEFAULT_OBJECT
);

export const selectInstitutionsWithStatsList = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.list || DEFAULT_LIST
);

export const selectInstitutionsWithStatsPagination = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.pagination || DEFAULT_PAGINATION
);

export const selectInstitutionsWithStatsLoading = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.loading || DEFAULT_LOADING
);

export const selectInstitutionsWithStatsError = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.error || DEFAULT_ERROR
);

export const selectInstitutionsWithStatsMonth = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.month || DEFAULT_DATA
);

export const selectInstitutionsWithStatsYear = createSelector(
  [selectInstitutionsWithStats],
  (institutionsWithStats) => institutionsWithStats.year || DEFAULT_DATA
);

// ============= PRINCIPALS SELECTORS =============

export const selectPrincipals = createSelector(
  [selectStateSlice],
  (state) => state.principals || DEFAULT_OBJECT
);

export const selectPrincipalsList = createSelector(
  [selectPrincipals],
  (principals) => principals.list || DEFAULT_LIST
);

export const selectPrincipalsLoading = createSelector(
  [selectPrincipals],
  (principals) => principals.loading || DEFAULT_LOADING
);

export const selectPrincipalsError = createSelector(
  [selectPrincipals],
  (principals) => principals.error || DEFAULT_ERROR
);

export const selectPrincipalsPagination = createSelector(
  [selectPrincipals],
  (principals) => principals.pagination || DEFAULT_PAGINATION
);

export const selectCurrentPrincipal = createSelector(
  [selectStateSlice],
  (state) => state.currentPrincipal || DEFAULT_DATA
);

// ============= STAFF SELECTORS =============

export const selectStaff = createSelector(
  [selectStateSlice],
  (state) => state.staff || DEFAULT_OBJECT
);

export const selectStaffList = createSelector(
  [selectStaff],
  (staff) => staff.list || DEFAULT_LIST
);

export const selectStaffLoading = createSelector(
  [selectStaff],
  (staff) => staff.loading || DEFAULT_LOADING
);

export const selectStaffError = createSelector(
  [selectStaff],
  (staff) => staff.error || DEFAULT_ERROR
);

export const selectStaffPagination = createSelector(
  [selectStaff],
  (staff) => staff.pagination || DEFAULT_PAGINATION
);

// ============= ANALYTICS SELECTORS =============

export const selectAnalytics = createSelector(
  [selectStateSlice],
  (state) => state.analytics || DEFAULT_OBJECT
);

export const selectTopIndustries = createSelector(
  [selectAnalytics],
  (analytics) => analytics.topIndustries || DEFAULT_LIST
);

export const selectTopPerformers = createSelector(
  [selectAnalytics],
  (analytics) => analytics.topPerformers || DEFAULT_LIST
);

export const selectBottomPerformers = createSelector(
  [selectAnalytics],
  (analytics) => analytics.bottomPerformers || DEFAULT_LIST
);

export const selectMonthlyStats = createSelector(
  [selectAnalytics],
  (analytics) => analytics.monthlyStats || DEFAULT_STATS
);

export const selectAnalyticsLoading = createSelector(
  [selectAnalytics],
  (analytics) => analytics.loading || DEFAULT_LOADING
);

export const selectAnalyticsError = createSelector(
  [selectAnalytics],
  (analytics) => analytics.error || DEFAULT_ERROR
);

// ============= COMPANIES OVERVIEW SELECTORS =============

export const selectCompaniesOverview = createSelector(
  [selectStateSlice],
  (state) => state.companiesOverview || DEFAULT_OBJECT
);

export const selectCompaniesList = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.list || DEFAULT_LIST
);

export const selectCompaniesPagination = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.pagination || DEFAULT_PAGINATION
);

export const selectCompaniesSummary = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.summary || DEFAULT_SUMMARY
);

export const selectSelectedCompany = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.selectedCompany || DEFAULT_DATA
);

export const selectSelectedCompanyDetails = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.selectedCompanyDetails || DEFAULT_DATA
);

export const selectCompaniesLoading = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.loading || DEFAULT_LOADING
);

export const selectCompanyDetailsLoading = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.detailsLoading || DEFAULT_LOADING
);

export const selectCompaniesError = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.error || DEFAULT_ERROR
);

export const selectCompanyDetailsError = createSelector(
  [selectCompaniesOverview],
  (companiesOverview) => companiesOverview.detailsError || DEFAULT_ERROR
);

// ============= INSTITUTE DETAIL VIEW SELECTORS =============

export const selectSelectedInstitute = createSelector(
  [selectStateSlice],
  (state) => state.selectedInstitute || DEFAULT_OBJECT
);

export const selectInstituteOverview = createSelector(
  [selectStateSlice],
  (state) => state.instituteOverview || DEFAULT_OBJECT
);

export const selectInstituteStudents = createSelector(
  [selectStateSlice],
  (state) => state.instituteStudents || DEFAULT_OBJECT
);

export const selectInstituteStudentsList = createSelector(
  [selectInstituteStudents],
  (instituteStudents) => instituteStudents.list || DEFAULT_LIST
);

export const selectInstituteStudentsTotal = createSelector(
  [selectInstituteStudents],
  (instituteStudents) => instituteStudents.total || DEFAULT_NUMBER
);

export const selectInstituteStudentsHasMore = createSelector(
  [selectInstituteStudents],
  (instituteStudents) => instituteStudents.hasMore || DEFAULT_BOOLEAN
);

export const selectInstituteStudentsLoading = createSelector(
  [selectInstituteStudents],
  (instituteStudents) => instituteStudents.loading || DEFAULT_LOADING
);

export const selectInstituteCompanies = createSelector(
  [selectStateSlice],
  (state) => state.instituteCompanies || DEFAULT_OBJECT
);

export const selectInstituteFacultyPrincipal = createSelector(
  [selectStateSlice],
  (state) => state.instituteFacultyPrincipal || DEFAULT_OBJECT
);

// Alias for institute staff (same as faculty principal)
export const selectInstituteStaff = createSelector(
  [selectInstituteFacultyPrincipal],
  (facultyPrincipal) => ({
    principal: facultyPrincipal.principal || DEFAULT_DATA,
    faculty: facultyPrincipal.faculty || DEFAULT_LIST,
    summary: facultyPrincipal.summary || DEFAULT_SUMMARY,
    loading: facultyPrincipal.loading || DEFAULT_LOADING,
    error: facultyPrincipal.error || DEFAULT_ERROR,
  })
);

// ============= REPORTS SELECTORS =============

export const selectReports = createSelector(
  [selectStateSlice],
  (state) => state.reports || DEFAULT_OBJECT
);

export const selectReportsList = createSelector(
  [selectReports],
  (reports) => reports.list || DEFAULT_LIST
);

export const selectReportsLoading = createSelector(
  [selectReports],
  (reports) => reports.loading || DEFAULT_LOADING
);

export const selectReportsError = createSelector(
  [selectReports],
  (reports) => reports.error || DEFAULT_ERROR
);

// Report Builder selectors
export const selectReportBuilder = createSelector(
  [selectStateSlice],
  (state) => state.reportBuilder || DEFAULT_OBJECT
);

export const selectReportCatalog = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.catalog || DEFAULT_LIST
);

export const selectReportConfig = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.config || DEFAULT_DATA
);

export const selectReportHistory = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.history || DEFAULT_LIST
);

export const selectReportBuilderLoading = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.loading || DEFAULT_LOADING
);

export const selectReportGenerating = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.generating || DEFAULT_LOADING
);

export const selectReportBuilderError = createSelector(
  [selectReportBuilder],
  (reportBuilder) => reportBuilder.error || DEFAULT_ERROR
);

// ============= PLACEMENTS SELECTORS =============

export const selectPlacements = createSelector(
  [selectStateSlice],
  (state) => state.placements || DEFAULT_OBJECT
);

export const selectPlacementStats = createSelector(
  [selectPlacements],
  (placements) => placements.stats || DEFAULT_STATS
);

export const selectPlacementTrends = createSelector(
  [selectPlacements],
  (placements) => placements.trends || DEFAULT_LIST
);

export const selectPlacementsLoading = createSelector(
  [selectPlacements],
  (placements) => placements.loading || DEFAULT_LOADING
);

export const selectPlacementsError = createSelector(
  [selectPlacements],
  (placements) => placements.error || DEFAULT_ERROR
);

// ============= JOINING REPORT SELECTORS =============

export const selectJoiningLetters = createSelector(
  [selectStateSlice],
  (state) => state.joiningLetters || DEFAULT_OBJECT
);

export const selectJoiningLetterStats = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.stats || DEFAULT_STATS
);

export const selectJoiningLettersLoading = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.loading || DEFAULT_LOADING
);

export const selectJoiningLettersError = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.error || DEFAULT_ERROR
);

// ============= CRITICAL ALERTS SELECTORS =============

export const selectCriticalAlerts = createSelector(
  [selectStateSlice],
  (state) => state.criticalAlerts || DEFAULT_OBJECT
);

export const selectCriticalAlertsData = createSelector(
  [selectCriticalAlerts],
  (criticalAlerts) => criticalAlerts.data || DEFAULT_DATA
);

export const selectCriticalAlertsLoading = createSelector(
  [selectCriticalAlerts],
  (criticalAlerts) => criticalAlerts.loading || DEFAULT_LOADING
);

export const selectCriticalAlertsError = createSelector(
  [selectCriticalAlerts],
  (criticalAlerts) => criticalAlerts.error || DEFAULT_ERROR
);

// ============= ACTION ITEMS SELECTORS =============

export const selectActionItems = createSelector(
  [selectStateSlice],
  (state) => state.actionItems || DEFAULT_OBJECT
);

export const selectActionItemsData = createSelector(
  [selectActionItems],
  (actionItems) => actionItems.data || DEFAULT_DATA
);

export const selectActionItemsLoading = createSelector(
  [selectActionItems],
  (actionItems) => actionItems.loading || DEFAULT_LOADING
);

export const selectActionItemsError = createSelector(
  [selectActionItems],
  (actionItems) => actionItems.error || DEFAULT_ERROR
);

// ============= COMPLIANCE SUMMARY SELECTORS =============

export const selectComplianceSummary = createSelector(
  [selectStateSlice],
  (state) => state.complianceSummary || DEFAULT_OBJECT
);

export const selectComplianceSummaryData = createSelector(
  [selectComplianceSummary],
  (complianceSummary) => complianceSummary.data || DEFAULT_DATA
);

export const selectComplianceSummaryLoading = createSelector(
  [selectComplianceSummary],
  (complianceSummary) => complianceSummary.loading || DEFAULT_LOADING
);

export const selectComplianceSummaryError = createSelector(
  [selectComplianceSummary],
  (complianceSummary) => complianceSummary.error || DEFAULT_ERROR
);

// ============= CACHE & TIMING SELECTORS =============

export const selectLastFetched = createSelector(
  [selectStateSlice],
  (state) => state.lastFetched || DEFAULT_OBJECT
);

/**
 * Returns the most recent fetch timestamp across all data
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
 * Returns true if any data is currently loading
 * Useful for global loading indicators
 */
export const selectAnyLoading = createSelector(
  [
    selectDashboardLoading,
    selectInstitutionsLoading,
    selectPrincipalsLoading,
    selectStaffLoading,
    selectAnalyticsLoading,
    selectCompaniesLoading,
    selectReportsLoading,
    selectPlacementsLoading,
    selectJoiningLettersLoading,
    selectCriticalAlertsLoading,
    selectActionItemsLoading,
    selectComplianceSummaryLoading,
  ],
  (...loadingStates) => loadingStates.some((loading) => loading)
);

/**
 * Returns true if there are any errors in the state
 * Useful for error boundary components
 */
export const selectHasErrors = createSelector(
  [
    selectDashboardError,
    selectInstitutionsError,
    selectPrincipalsError,
    selectStaffError,
    selectAnalyticsError,
    selectCompaniesError,
    selectReportsError,
    selectPlacementsError,
    selectJoiningLettersError,
    selectCriticalAlertsError,
    selectActionItemsError,
    selectComplianceSummaryError,
  ],
  (...errors) => errors.some((error) => error !== null && error !== undefined)
);
