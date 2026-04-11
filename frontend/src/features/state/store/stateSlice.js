import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';
import stateService from '../../../services/state.service';
import reportService from '../../../services/report.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  currentPrincipal: null,
  institutions: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  principals: {
    list: [],
    pagination: null,
    loading: false,
    error: null,
  },
  staff: {
    list: [],
    pagination: null,
    loading: false,
    error: null,
  },
  reports: {
    list: [],
    loading: false,
    error: null,
  },
  analytics: {
    topPerformers: [],
    bottomPerformers: [],
    topIndustries: [],
    monthlyStats: null,
    // Split loading states to prevent race conditions
    topPerformersLoading: false,
    topIndustriesLoading: false,
    monthlyAnalyticsLoading: false,
    error: null,
  },
  placements: {
    stats: null,
    trends: [],
    // Split loading states to prevent race conditions
    statsLoading: false,
    trendsLoading: false,
    error: null,
  },
  joiningLetters: {
    stats: null,
    loading: false,
    error: null,
  },
  visitsByType: {
    data: null,
    loading: false,
    error: null,
  },
  reportBuilder: {
    catalog: [],
    config: null,
    history: [],
    generating: false,
    loading: false,
    error: null,
  },
  selectedInstitute: {
    id: null,
    data: null,
    loading: false,
    error: null,
  },
  instituteOverview: {
    data: null,
    loading: false,
    error: null,
  },
  instituteStudents: {
    list: [],
    cursor: null,
    hasMore: true,
    total: 0,
    filters: {
      branches: [],
    },
    loading: false,
    loadingMore: false,
    error: null,
  },
  instituteCompanies: {
    list: [],
    total: 0,
    summary: null,
    loading: false,
    error: null,
  },
  instituteFacultyPrincipal: {
    principal: null,
    faculty: [],
    summary: null,
    loading: false,
    error: null,
  },
  // All mentors across all institutions (for cross-institution assignment)
  allMentors: {
    list: [],
    loading: false,
    error: null,
  },
  institutionsWithStats: {
    list: [],
    pagination: null,
    month: null,
    year: null,
    loading: false,
    error: null,
  },
  criticalAlerts: {
    data: null,
    loading: false,
    error: null,
  },
  actionItems: {
    data: null,
    loading: false,
    error: null,
  },
  complianceSummary: {
    data: null,
    loading: false,
    error: null,
  },
  // State-wide companies overview
  companiesOverview: {
    list: [],
    pagination: null,
    summary: null,
    selectedCompany: null,
    selectedCompanyDetails: null,
    loading: false,
    detailsLoading: false,
    error: null,
    detailsError: null,
  },
  // Restore Center - for restoring soft-deleted items
  restoreCenter: {
    summary: { monthlyReports: 0, facultyVisits: 0, documents: 0, total: 0 },
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    selectedType: 'monthly-reports',
    loading: false,
    summaryLoading: false,
    restoring: {}, // Track restoring state per item ID
    error: null,
  },
  // Monthly Compliance Tracker - Reports & Visits by Institution
  monthlyCompliance: {
    institutionList: [],           // Institution-level compliance data
    stateWideSummary: null,        // State-wide totals
    selectedInstitutionId: null,   // Currently selected institution
    selectedInstitutionDetails: null, // Detailed compliance for selected institution
    availableMonths: [],           // Months with compliance data
    month: null,                   // Currently selected month
    year: null,                    // Currently selected year
    pagination: null,
    loading: false,
    detailsLoading: false,
    monthsLoading: false,
    error: null,
    detailsError: null,
  },
  // State-wide Students List
  students: {
    list: [],
    pagination: null,
    summary: null,
    filters: {
      institutions: [],
      branches: [],
    },
    currentMonth: null,
    currentYear: null,
    loading: false,
    summaryLoading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    dashboardKey: null,
    institutions: null,
    institutionsKey: null,
    institutionsWithStats: null,
    institutionsWithStatsKey: null,
    principals: null,
    principalsKey: null,
    staff: null,
    staffKey: null,
    reports: null,
    // Split analytics timestamps to prevent race conditions
    topPerformers: null,
    topPerformersKey: null,
    topIndustries: null,
    topIndustriesKey: null,
    monthlyAnalytics: null,
    monthlyAnalyticsKey: null,
    // Split placement timestamps
    placementStats: null,
    placementTrends: null,
    joiningLetters: null,
    joiningLettersKey: null,
    visitsByType: null,
    visitsByTypeKey: null,
    criticalAlerts: null,
    actionItems: null,
    complianceSummary: null,
    companiesOverview: null,
    companiesOverviewKey: null,
    // Institute detail caching - keyed by institutionId
    instituteOverview: {},
    instituteStudents: {},
    instituteCompanies: {},
    instituteFaculty: {},
    // Monthly compliance tracker
    monthlyCompliance: null,
    monthlyComplianceKey: null,
    monthlyComplianceDetails: {},
    availableComplianceMonths: null,
    // State-wide students
    students: null,
    studentsKey: null,
    studentsSummary: null,
  },
};

// Async thunks
export const fetchDashboardStats = createAsyncThunk(
  'state/fetchDashboardStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.dashboard;

      // Cache key includes month/year for filtered requests
      const cacheKey = params?.month && params?.year
        ? `${params.month}-${params.year}`
        : 'current';
      const lastKey = state.state.lastFetched.dashboardKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      // Pass month/year to the service
      const response = await stateService.getDashboard({
        month: params?.month,
        year: params?.year,
      });
      return { ...response, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchInstitutions = createAsyncThunk(
  'state/fetchInstitutions',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.institutions;

      // Cache must be param-aware; otherwise pagination/search may randomly show stale data.
      // Normalize params into a stable key.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
        type: params?.type ?? '',
        isActive:
          typeof params?.isActive === 'boolean' ? String(params.isActive) : params?.isActive ?? '',
        cursor: params?.cursor ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.institutionsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await stateService.getInstitutions(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institutions');
    }
  }
);

export const fetchInstitutionsWithStats = createAsyncThunk(
  'state/fetchInstitutionsWithStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.institutionsWithStats;

      // Include month/year in cache key for filtered requests
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        month: params?.month ?? null,
        year: params?.year ?? null,
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.institutionsWithStatsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      // Pass all params including month/year to service
      const response = await stateService.getInstitutionsWithStats(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institutions stats');
    }
  }
);

export const fetchPrincipals = createAsyncThunk(
  'state/fetchPrincipals',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.principals;

      // Cache must be param-aware; otherwise pagination/search may randomly show stale data.
      // Normalize params into a stable key.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        institutionId: params?.institutionId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.principalsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await stateService.getPrincipals(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch principals');
    }
  }
);

export const fetchReports = createAsyncThunk(
  'state/fetchReports',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.reports;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await stateService.getReports(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports');
    }
  }
);

// Institution CRUD
export const createInstitution = createAsyncThunk(
  'state/createInstitution',
  async (institutionData, { rejectWithValue }) => {
    try {
      const response = await stateService.createInstitution(institutionData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create institution');
    }
  }
);

export const updateInstitution = createAsyncThunk(
  'state/updateInstitution',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updateInstitution(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update institution');
    }
  }
);

export const deleteInstitution = createAsyncThunk(
  'state/deleteInstitution',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteInstitution(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete institution');
    }
  }
);

// Principal CRUD
export const createPrincipal = createAsyncThunk(
  'state/createPrincipal',
  async (principalData, { rejectWithValue }) => {
    try {
      const response = await stateService.createPrincipal(principalData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create principal');
    }
  }
);

export const updatePrincipal = createAsyncThunk(
  'state/updatePrincipal',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updatePrincipal(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update principal');
    }
  }
);

export const deletePrincipal = createAsyncThunk(
  'state/deletePrincipal',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deletePrincipal(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete principal');
    }
  }
);

// Toggle principal status (activate/deactivate)
export const togglePrincipalStatus = createAsyncThunk(
  'state/togglePrincipalStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.togglePrincipalStatus(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle principal status');
    }
  }
);

export const resetPrincipalPassword = createAsyncThunk(
  'state/resetPrincipalPassword',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.resetPrincipalPassword(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset password');
    }
  }
);

export const fetchPrincipalById = createAsyncThunk(
  'state/fetchPrincipalById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getPrincipalById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch principal');
    }
  }
);

// Staff
export const fetchStaff = createAsyncThunk(
  'state/fetchStaff',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.staff;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        institutionId: params?.institutionId ?? '',
        staffType: params?.staffType ?? '',
        role: params?.role ?? '',
        branchName: params?.branchName ?? '',
        designationEnum: params?.designationEnum ?? '',
        active: params?.active ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.staffKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await stateService.getStaff(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch staff');
    }
  }
);

export const fetchStaffById = createAsyncThunk(
  'state/fetchStaffById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getStaffById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch staff member');
    }
  }
);

export const createStaff = createAsyncThunk(
  'state/createStaff',
  async (data, { rejectWithValue }) => {
    try {
      const response = await stateService.createStaff(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create staff');
    }
  }
);

export const updateStaff = createAsyncThunk(
  'state/updateStaff',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await stateService.updateStaff(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update staff');
    }
  }
);

export const deleteStaff = createAsyncThunk(
  'state/deleteStaff',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteStaff(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete staff');
    }
  }
);

export const resetStaffPassword = createAsyncThunk(
  'state/resetStaffPassword',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.resetStaffPassword(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reset password');
    }
  }
);

// Toggle staff status (activate/deactivate)
export const toggleStaffStatus = createAsyncThunk(
  'state/toggleStaffStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.toggleFacultyStatus(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle staff status');
    }
  }
);

// State-Wide Students
export const fetchAllStudents = createAsyncThunk(
  'state/fetchAllStudents',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.students;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        search: params?.search ?? '',
        institutionId: params?.institutionId ?? '',
        branchName: params?.branchName ?? '',
        status: params?.status ?? '',
        internshipStatus: params?.internshipStatus ?? '',
        mentorStatus: params?.mentorStatus ?? '',
        reportStatus: params?.reportStatus ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.studentsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await stateService.getAllStudents(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students');
    }
  }
);

export const fetchStudentsSummary = createAsyncThunk(
  'state/fetchStudentsSummary',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.studentsSummary;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await stateService.getStudentsSummary();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students summary');
    }
  }
);

// Reports
export const fetchReportById = createAsyncThunk(
  'state/fetchReportById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await stateService.getReportById(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report');
    }
  }
);

export const generateReport = createAsyncThunk(
  'state/generateReport',
  async (reportParams, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/state/reports/generate', reportParams);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate report');
    }
  }
);

// Analytics thunks - each uses its own timestamp to prevent race conditions
export const fetchTopPerformers = createAsyncThunk(
  'state/fetchTopPerformers',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.topPerformers;

      // Cache key includes month/year for filtered requests
      const cacheKey = params?.month && params?.year
        ? `${params.month}-${params.year}`
        : 'current';
      const lastKey = state.state.lastFetched.topPerformersKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await apiClient.get('/state/analytics/performers', { params });
      return { ...response.data, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch performers');
    }
  }
);

export const fetchTopIndustries = createAsyncThunk(
  'state/fetchTopIndustries',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.topIndustries;

      // Cache key includes month/year for filtered requests
      const cacheKey = params?.month && params?.year
        ? `${params.month}-${params.year}`
        : 'current';
      const lastKey = state.state.lastFetched.topIndustriesKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      // Pass month/year to service
      const response = await stateService.getTopIndustries({
        limit: params?.limit || 10,
        month: params?.month,
        year: params?.year,
      });
      return { ...response, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch industries');
    }
  }
);

export const fetchMonthlyAnalytics = createAsyncThunk(
  'state/fetchMonthlyAnalytics',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.monthlyAnalytics;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await stateService.getMonthlyAnalytics(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly analytics');
    }
  }
);

export const exportDashboardReport = createAsyncThunk(
  'state/exportDashboardReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.exportDashboardReport(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export report');
    }
  }
);

// Force refresh thunks - bypass cache
export const forceRefreshDashboard = createAsyncThunk(
  'state/forceRefreshDashboard',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh dashboard');
    }
  }
);

export const forceRefreshInstitutions = createAsyncThunk(
  'state/forceRefreshInstitutions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutions(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh institutions');
    }
  }
);

export const forceRefreshPrincipals = createAsyncThunk(
  'state/forceRefreshPrincipals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getPrincipals(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to refresh principals');
    }
  }
);

// Report Builder thunks
export const fetchReportCatalog = createAsyncThunk(
  'state/fetchReportCatalog',
  async (_, { rejectWithValue }) => {
    try {
      const response = await reportService.getCatalog();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report catalog');
    }
  }
);

export const fetchReportConfig = createAsyncThunk(
  'state/fetchReportConfig',
  async (type, { rejectWithValue }) => {
    try {
      const response = await reportService.getConfig(type);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report config');
    }
  }
);

export const generateNewReport = createAsyncThunk(
  'state/generateNewReport',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await reportService.generateReport(reportData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to generate report');
    }
  }
);

export const fetchReportHistory = createAsyncThunk(
  'state/fetchReportHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await reportService.getHistory(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch report history');
    }
  }
);

export const checkReportStatus = createAsyncThunk(
  'state/checkReportStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await reportService.getReportStatus(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check report status');
    }
  }
);

// Placement Statistics thunks - each uses its own timestamp
export const fetchPlacementStats = createAsyncThunk(
  'state/fetchPlacementStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.placementStats;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await stateService.getPlacementStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch placement stats');
    }
  }
);

export const fetchPlacementTrends = createAsyncThunk(
  'state/fetchPlacementTrends',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.placementTrends;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await stateService.getPlacementTrends(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch placement trends');
    }
  }
);

// Joining Report Stats thunks
export const fetchJoiningLetterStats = createAsyncThunk(
  'state/fetchJoiningLetterStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.joiningLetters;

      // Cache key includes month/year for filtered requests
      const cacheKey = params?.month && params?.year
        ? `${params.month}-${params.year}`
        : 'current';
      const lastKey = state.state.lastFetched.joiningLettersKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await stateService.getJoiningLetterStats({
        month: params?.month,
        year: params?.year,
      });
      return { ...response, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch joining Report stats');
    }
  }
);

export const fetchVisitsByType = createAsyncThunk(
  'state/fetchVisitsByType',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.visitsByType;

      // Cache key includes month/year for filtered requests
      const cacheKey = params?.month && params?.year
        ? `${params.month}-${params.year}`
        : 'current';
      const lastKey = state.state.lastFetched.visitsByTypeKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await stateService.getVisitsByType({
        month: params?.month,
        year: params?.year,
      });
      return { ...response, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visits by type');
    }
  }
);

// Institute Detail View thunks
export const fetchInstituteOverview = createAsyncThunk(
  'state/fetchInstituteOverview',
  async (institutionId, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.instituteOverview?.[institutionId];

      // Return cached data if available and fresh
      if (isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true, institutionId };
      }

      const response = await stateService.getInstitutionOverview(institutionId);
      return { ...response, institutionId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institute overview');
    }
  }
);

export const fetchInstituteStudents = createAsyncThunk(
  'state/fetchInstituteStudents',
  async ({ institutionId, cursor, limit, search, filter, branch, companyId, reportStatus, visitStatus, selfIdentified, status, loadMore = false, forceRefresh = false }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.instituteStudents?.[institutionId];
      const hasFilters = search || (filter && filter !== 'all') || (branch && branch !== 'all') ||
                        companyId || (reportStatus && reportStatus !== 'all') ||
                        (visitStatus && visitStatus !== 'all') || (selfIdentified && selfIdentified !== 'all') ||
                        (status && status !== 'all');

      // Return cached data if available, fresh, not loading more, and no active filters
      if (!forceRefresh && !loadMore && !hasFilters && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true, institutionId };
      }

      const response = await stateService.getInstitutionStudents(institutionId, {
        cursor,
        limit,
        search,
        filter,
        branch,
        companyId,
        reportStatus,
        visitStatus,
        selfIdentified,
        status,
      });
      return { ...response, loadMore, institutionId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students');
    }
  }
);

export const fetchInstituteCompanies = createAsyncThunk(
  'state/fetchInstituteCompanies',
  async ({ institutionId, limit, search, forceRefresh = false }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.instituteCompanies?.[institutionId];

      // Return cached data if available, fresh, and no search filter
      if (!forceRefresh && !search && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true, institutionId };
      }

      const response = await stateService.getInstitutionCompanies(institutionId, { limit, search });
      return { ...response, institutionId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch companies');
    }
  }
);

export const fetchInstituteFacultyPrincipal = createAsyncThunk(
  'state/fetchInstituteFacultyPrincipal',
  async (institutionId, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.instituteFaculty?.[institutionId];

      // Return cached data if available and fresh
      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true, institutionId };
      }

      const response = await stateService.getInstitutionFacultyPrincipal(institutionId);
      return { ...response, institutionId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch faculty and principal');
    }
  }
);

// Mentor management thunks
export const fetchInstitutionMentors = createAsyncThunk(
  'state/fetchInstitutionMentors',
  async (institutionId, { rejectWithValue }) => {
    try {
      const response = await stateService.getInstitutionMentors(institutionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch mentors');
    }
  }
);

export const fetchAllMentors = createAsyncThunk(
  'state/fetchAllMentors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await stateService.getAllMentors(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch all mentors');
    }
  }
);

export const assignMentorToStudent = createAsyncThunk(
  'state/assignMentorToStudent',
  async ({ studentId, mentorId }, { rejectWithValue }) => {
    try {
      const response = await stateService.assignMentorToStudent(studentId, mentorId);
      return { studentId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign mentor');
    }
  }
);

export const removeMentorFromStudent = createAsyncThunk(
  'state/removeMentorFromStudent',
  async (studentId, { rejectWithValue }) => {
    try {
      const response = await stateService.removeMentorFromStudent(studentId);
      return { studentId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove mentor');
    }
  }
);

// Delete student thunk
export const deleteInstituteStudent = createAsyncThunk(
  'state/deleteInstituteStudent',
  async ({ studentId, institutionId }, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteStudent(studentId);
      return { studentId, institutionId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete student');
    }
  }
);

// Toggle student status thunk (activate/deactivate)
export const toggleStudentStatus = createAsyncThunk(
  'state/toggleStudentStatus',
  async ({ studentId, institutionId }, { rejectWithValue }) => {
    try {
      const response = await stateService.toggleStudentStatus(studentId);
      return { studentId, institutionId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle student status');
    }
  }
);

// Delete Faculty thunk
export const deleteInstituteFaculty = createAsyncThunk(
  'state/deleteInstituteFaculty',
  async ({ facultyId, institutionId }, { rejectWithValue }) => {
    try {
      const response = await stateService.deleteFaculty(facultyId);
      return { facultyId, institutionId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete faculty');
    }
  }
);

// Toggle faculty status thunk (activate/deactivate)
export const toggleFacultyStatus = createAsyncThunk(
  'state/toggleFacultyStatus',
  async ({ facultyId, institutionId }, { rejectWithValue }) => {
    try {
      const response = await stateService.toggleFacultyStatus(facultyId);
      return { facultyId, institutionId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle faculty status');
    }
  }
);

// Critical Alerts thunk
export const fetchCriticalAlerts = createAsyncThunk(
  'state/fetchCriticalAlerts',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.criticalAlerts;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await stateService.getCriticalAlerts();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch critical alerts');
    }
  }
);

// Action Items thunk
export const fetchActionItems = createAsyncThunk(
  'state/fetchActionItems',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.actionItems;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await stateService.getActionItems();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch action items');
    }
  }
);

// Compliance Summary thunk
export const fetchComplianceSummary = createAsyncThunk(
  'state/fetchComplianceSummary',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.complianceSummary;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await stateService.getComplianceSummary();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch compliance summary');
    }
  }
);

// ==================== STATE-WIDE COMPANIES OVERVIEW ====================

// Fetch all companies across all institutions
export const fetchAllCompanies = createAsyncThunk(
  'state/fetchAllCompanies',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.companiesOverview;

      // Normalize params for cache key
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        search: params?.search ?? '',
        industryType: params?.industryType ?? '',
        sortBy: params?.sortBy ?? 'studentCount',
        sortOrder: params?.sortOrder ?? 'desc',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.state.lastFetched.companiesOverviewKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await stateService.getAllCompanies(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch companies');
    }
  }
);

// Fetch company details with all institutions and students
export const fetchCompanyDetails = createAsyncThunk(
  'state/fetchCompanyDetails',
  async (companyId, { rejectWithValue }) => {
    try {
      const response = await stateService.getCompanyDetails(companyId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch company details');
    }
  }
);

// ==================== RESTORE CENTER ====================

// Fetch summary of deleted items counts
export const fetchDeletedItemsSummary = createAsyncThunk(
  'state/fetchDeletedItemsSummary',
  async (institutionId, { rejectWithValue }) => {
    try {
      const response = await stateService.getDeletedItemsSummary(institutionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch deleted items summary');
    }
  }
);

// Fetch deleted items by type with pagination
export const fetchDeletedItems = createAsyncThunk(
  'state/fetchDeletedItems',
  async ({ type, params = {} }, { rejectWithValue }) => {
    try {
      const response = await stateService.getDeletedItems(type, params);
      return { ...response, type };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch deleted items');
    }
  }
);

// Restore a single deleted item
export const restoreDeletedItem = createAsyncThunk(
  'state/restoreDeletedItem',
  async ({ type, id }, { rejectWithValue }) => {
    try {
      const response = await stateService.restoreItem(type, id);
      return { ...response, type, id };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to restore item');
    }
  }
);

// Bulk restore multiple deleted items
export const bulkRestoreDeletedItems = createAsyncThunk(
  'state/bulkRestoreDeletedItems',
  async ({ type, ids }, { rejectWithValue }) => {
    try {
      const response = await stateService.bulkRestoreItems(type, ids);
      return { ...response, type, ids };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk restore items');
    }
  }
);

// ==================== Monthly Compliance Tracker ====================

// Fetch monthly compliance data by institution
export const fetchMonthlyCompliance = createAsyncThunk(
  'state/fetchMonthlyCompliance',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.monthlyCompliance;

      // Cache key includes month/year
      const cacheKey = `${params.month}-${params.year}-${params.page || 1}-${params.search || ''}`;
      const lastKey = state.state.lastFetched.monthlyComplianceKey;

      if (!params?.forceRefresh && lastKey === cacheKey && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await stateService.getMonthlyCompliance(params);
      return { ...response, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly compliance');
    }
  }
);

// Fetch detailed compliance for a specific institution
export const fetchInstitutionComplianceDetails = createAsyncThunk(
  'state/fetchInstitutionComplianceDetails',
  async ({ institutionId, month, year, forceRefresh }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const cacheKey = `${institutionId}-${month}-${year}`;
      const lastFetched = state.state.lastFetched.monthlyComplianceDetails?.[cacheKey];
      const currentDetails = state.state.monthlyCompliance.selectedInstitutionDetails;

      // Cache is only valid if:
      // 1. Not force refreshing
      // 2. Fetch time is valid
      // 3. Currently stored details match the requested institution
      const detailsMatch = currentDetails?.institutionId === institutionId &&
        currentDetails?.month === month &&
        currentDetails?.year === year;

      if (!forceRefresh && detailsMatch && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true, institutionId };
      }

      const response = await stateService.getInstitutionComplianceDetails(institutionId, { month, year });
      return { ...response, institutionId, month, year, _cacheKey: cacheKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institution compliance details');
    }
  }
);

// Fetch available months with compliance data
export const fetchAvailableComplianceMonths = createAsyncThunk(
  'state/fetchAvailableComplianceMonths',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.state.lastFetched.availableComplianceMonths;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await stateService.getAvailableComplianceMonths();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch available months');
    }
  }
);

const stateSlice = createSlice({
  name: 'state',
  initialState,
  reducers: {
    setSelectedInstitution: (state, action) => {
      state.institutions.selected = action.payload;
    },
    clearStateError: (state) => {
      state.dashboard.error = null;
      state.institutions.error = null;
      state.principals.error = null;
      state.reports.error = null;
      state.analytics.error = null;
    },
    markAllDataStale: (state) => {
      state.lastFetched.dashboard = 0;
      state.lastFetched.institutions = 0;
      state.lastFetched.institutionsKey = null;
      state.lastFetched.principals = 0;
      state.lastFetched.principalsKey = null;
      state.lastFetched.reports = 0;
      state.lastFetched.analytics = 0;
    },
    resetStateSlice: () => initialState,
    clearCurrentPrincipal: (state) => {
      state.currentPrincipal = null;
    },
    // Optimistic update reducers for institutions
    optimisticallyAddInstitution: (state, action) => {
      const tempInstitution = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.institutions.list.unshift(tempInstitution);
    },
    optimisticallyUpdateInstitution: (state, action) => {
      const { id, data } = action.payload;
      const index = state.institutions.list.findIndex(inst => inst.id === id);
      if (index !== -1) {
        state.institutions.list[index] = {
          ...state.institutions.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeleteInstitution: (state, action) => {
      state.institutions.list = state.institutions.list.filter(
        inst => inst.id !== action.payload
      );
    },
    rollbackInstitutionOperation: (state, action) => {
      if (action.payload?.list) {
        state.institutions.list = action.payload.list;
      }
    },
    // Optimistic update reducers for principals
    optimisticallyAddPrincipal: (state, action) => {
      const tempPrincipal = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.principals.list.unshift(tempPrincipal);
    },
    optimisticallyUpdatePrincipal: (state, action) => {
      const { id, data } = action.payload;
      const index = state.principals.list.findIndex(p => p.id === id);
      if (index !== -1) {
        state.principals.list[index] = {
          ...state.principals.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeletePrincipal: (state, action) => {
      state.principals.list = state.principals.list.filter(
        p => p.id !== action.payload
      );
    },
    rollbackPrincipalOperation: (state, action) => {
      if (action.payload?.list) {
        state.principals.list = action.payload.list;
      }
    },
    setSelectedInstitute: (state, action) => {
      const newId = action.payload;
      const oldId = state.selectedInstitute.id;

      // If switching to a different institution, clear all cached data to force fresh fetch
      if (oldId !== newId) {
        // Clear cached data for the new institution to force fresh fetch
        state.instituteOverview = { data: null, loading: true, error: null };
        state.instituteStudents = { list: [], cursor: null, hasMore: true, total: 0, filters: { branches: [] }, loading: true, loadingMore: false, error: null };
        state.instituteCompanies = { list: [], total: 0, summary: null, loading: true, error: null };
        state.instituteFacultyPrincipal = { principal: null, faculty: [], summary: null, loading: true, error: null };

        // Clear cache timestamps for this specific institution to force re-fetch
        if (state.lastFetched.instituteOverview) {
          delete state.lastFetched.instituteOverview[newId];
        }
        if (state.lastFetched.instituteStudents) {
          delete state.lastFetched.instituteStudents[newId];
        }
        if (state.lastFetched.instituteCompanies) {
          delete state.lastFetched.instituteCompanies[newId];
        }
        if (state.lastFetched.instituteFaculty) {
          delete state.lastFetched.instituteFaculty[newId];
        }
      }

      state.selectedInstitute.id = newId;
    },
    clearSelectedInstitute: (state) => {
      state.selectedInstitute = { id: null, data: null, loading: false, error: null };
      state.instituteOverview = { data: null, loading: false, error: null };
      state.instituteStudents = { list: [], cursor: null, hasMore: true, total: 0, loading: false, loadingMore: false, error: null };
      state.instituteCompanies = { list: [], total: 0, summary: null, loading: false, error: null };
      state.instituteFacultyPrincipal = { principal: null, faculty: [], summary: null, loading: false, error: null };
    },
    setSelectedCompany: (state, action) => {
      state.companiesOverview.selectedCompany = action.payload;
    },
    clearSelectedCompany: (state) => {
      state.companiesOverview.selectedCompany = null;
      state.companiesOverview.selectedCompanyDetails = null;
    },
    // Restore Center reducers
    setRestoreCenterType: (state, action) => {
      state.restoreCenter.selectedType = action.payload;
      // Reset items when switching type
      state.restoreCenter.items = [];
      state.restoreCenter.pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
    },
    clearRestoreCenterError: (state) => {
      state.restoreCenter.error = null;
    },
    // Monthly Compliance reducers
    setMonthlyComplianceMonth: (state, action) => {
      const { month, year } = action.payload;
      state.monthlyCompliance.month = month;
      state.monthlyCompliance.year = year;
    },
    setSelectedComplianceInstitution: (state, action) => {
      state.monthlyCompliance.selectedInstitutionId = action.payload;
      // Clear details when changing institution
      state.monthlyCompliance.selectedInstitutionDetails = null;
      state.monthlyCompliance.detailsError = null;
    },
    clearMonthlyComplianceError: (state) => {
      state.monthlyCompliance.error = null;
      state.monthlyCompliance.detailsError = null;
    },
    clearMonthlyComplianceDetails: (state) => {
      state.monthlyCompliance.selectedInstitutionDetails = null;
      state.monthlyCompliance.selectedInstitutionId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchDashboardStats.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
          state.lastFetched.dashboardKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Institutions
      .addCase(fetchInstitutions.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(fetchInstitutions.fulfilled, (state, action) => {
        state.institutions.loading = false;
        if (!action.payload.cached) {
          state.institutions.list = action.payload.data || action.payload;
          // Support multiple response shapes:
          // - { data, pagination: { ... } }
          // - { data, total, page, limit, totalPages, nextCursor, totalStudents }
          // - legacy arrays
          state.institutions.pagination =
            action.payload.pagination ||
            (typeof action.payload?.total === 'number' || typeof action.payload?.page === 'number'
              ? {
                  total: action.payload.total ?? (action.payload.data?.length || 0),
                  page: action.payload.page ?? 1,
                  limit: action.payload.limit ?? (action.payload.data?.length || 10),
                  totalPages: action.payload.totalPages,
                  nextCursor: action.payload.nextCursor,
                }
              : null);
          // Store total students count from API (matches dashboard total)
          state.institutions.totalStudents = action.payload.totalStudents ?? null;
          state.lastFetched.institutions = Date.now();
          state.lastFetched.institutionsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchInstitutions.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      // Institutions with Stats (for dashboard)
      .addCase(fetchInstitutionsWithStats.pending, (state) => {
        state.institutionsWithStats.loading = true;
        state.institutionsWithStats.error = null;
      })
      .addCase(fetchInstitutionsWithStats.fulfilled, (state, action) => {
        state.institutionsWithStats.loading = false;
        if (!action.payload.cached) {
          state.institutionsWithStats.list = action.payload.data || [];
          state.institutionsWithStats.pagination = {
            total: action.payload.total ?? 0,
            page: action.payload.page ?? 1,
            limit: action.payload.limit ?? 10,
            totalPages: action.payload.totalPages ?? 1,
          };
          state.institutionsWithStats.month = action.payload.month;
          state.institutionsWithStats.year = action.payload.year;
          state.lastFetched.institutionsWithStats = Date.now();
          state.lastFetched.institutionsWithStatsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchInstitutionsWithStats.rejected, (state, action) => {
        state.institutionsWithStats.loading = false;
        state.institutionsWithStats.error = action.payload;
      })
      .addCase(createInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(createInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = [action.payload, ...state.institutions.list];
        state.lastFetched.institutions = null; // Invalidate cache after mutation
        state.lastFetched.institutionsKey = null;
      })
      .addCase(createInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(updateInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(updateInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        const updatedInstitution = action.payload?.data ?? action.payload;
        if (updatedInstitution?.id) {
          // Create new array to ensure React detects the change
          state.institutions.list = state.institutions.list.map(i =>
            i.id === updatedInstitution.id ? { ...i, ...updatedInstitution } : i
          );
        }
        state.lastFetched.institutions = null; // Invalidate cache after mutation
        state.lastFetched.institutionsKey = null;
      })
      .addCase(updateInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(deleteInstitution.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(deleteInstitution.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = state.institutions.list.filter(i => i.id !== action.payload.id);
        state.lastFetched.institutions = null; // Invalidate cache after mutation
        state.lastFetched.institutionsKey = null;
      })
      .addCase(deleteInstitution.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })

      // Principals
      .addCase(fetchPrincipals.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(fetchPrincipals.fulfilled, (state, action) => {
        state.principals.loading = false;
        if (!action.payload.cached) {
          state.principals.list = action.payload.data || action.payload;
          state.principals.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            limit: action.payload.limit,
            totalPages: action.payload.totalPages,
          };
          state.lastFetched.principals = Date.now();
          state.lastFetched.principalsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchPrincipals.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(fetchPrincipalById.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(fetchPrincipalById.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.currentPrincipal = action.payload?.data ?? action.payload;
      })
      .addCase(fetchPrincipalById.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(createPrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(createPrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = [action.payload, ...state.principals.list];
        state.lastFetched.principals = null; // Invalidate cache after mutation
        state.lastFetched.principalsKey = null;
      })
      .addCase(createPrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(updatePrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(updatePrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        const updatedPrincipal = action.payload?.data ?? action.payload;
        if (updatedPrincipal?.id) {
          // Create new array to ensure React detects the change
          state.principals.list = state.principals.list.map(p =>
            p.id === updatedPrincipal.id ? { ...p, ...updatedPrincipal } : p
          );
        }
        state.currentPrincipal = null; // Clear current principal after update
        state.lastFetched.principals = null; // Invalidate cache after mutation
        state.lastFetched.principalsKey = null;
      })
      .addCase(updatePrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(deletePrincipal.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(deletePrincipal.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = state.principals.list.filter(p => p.id !== action.payload.id);
        state.lastFetched.principals = null; // Invalidate cache after mutation
        state.lastFetched.principalsKey = null;
      })
      .addCase(deletePrincipal.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      // Toggle principal status
      .addCase(togglePrincipalStatus.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(togglePrincipalStatus.fulfilled, (state, action) => {
        state.principals.loading = false;
        const { id, active } = action.payload;
        // Update principal in list with new status
        const principalIndex = state.principals.list.findIndex(p => p.id === id);
        if (principalIndex !== -1) {
          state.principals.list[principalIndex] = {
            ...state.principals.list[principalIndex],
            active,
          };
        }
        state.lastFetched.principals = null; // Invalidate cache
        state.lastFetched.principalsKey = null;
      })
      .addCase(togglePrincipalStatus.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })
      .addCase(resetPrincipalPassword.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(resetPrincipalPassword.fulfilled, (state) => {
        state.principals.loading = false;
      })
      .addCase(resetPrincipalPassword.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })

      // Staff
      .addCase(fetchStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(fetchStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        if (!action.payload.cached) {
          state.staff.list = action.payload.data || action.payload;
          state.staff.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            limit: action.payload.limit,
            totalPages: action.payload.totalPages,
          };
          state.lastFetched.staff = Date.now();
          state.lastFetched.staffKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(fetchStaffById.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(fetchStaffById.fulfilled, (state) => {
        state.staff.loading = false;
      })
      .addCase(fetchStaffById.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(createStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(createStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        state.staff.list = [action.payload, ...state.staff.list];
        state.lastFetched.staff = null; // Invalidate cache to force refresh
        state.lastFetched.staffKey = null;
      })
      .addCase(createStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(updateStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(updateStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        const updatedStaff = action.payload?.data ?? action.payload;
        if (updatedStaff?.id) {
          // Create new array to ensure React detects the change
          state.staff.list = state.staff.list.map(s =>
            s.id === updatedStaff.id ? { ...s, ...updatedStaff } : s
          );
        }
        state.lastFetched.staff = null; // Invalidate cache
        state.lastFetched.staffKey = null;
      })
      .addCase(updateStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(deleteStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(deleteStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        state.staff.list = state.staff.list.filter(s => s.id !== action.payload.id);
        state.lastFetched.staff = null; // Invalidate cache
        state.lastFetched.staffKey = null;
      })
      .addCase(deleteStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(resetStaffPassword.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(resetStaffPassword.fulfilled, (state) => {
        state.staff.loading = false;
      })
      .addCase(resetStaffPassword.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      // Toggle staff status
      .addCase(toggleStaffStatus.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(toggleStaffStatus.fulfilled, (state, action) => {
        state.staff.loading = false;
        const { id, active } = action.payload;
        // Update staff in list with new status
        const staffIndex = state.staff.list.findIndex(s => s.id === id);
        if (staffIndex !== -1) {
          state.staff.list[staffIndex] = {
            ...state.staff.list[staffIndex],
            active,
          };
        }
        state.lastFetched.staff = null; // Invalidate cache
        state.lastFetched.staffKey = null;
      })
      .addCase(toggleStaffStatus.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })

      // State-Wide Students
      .addCase(fetchAllStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(fetchAllStudents.fulfilled, (state, action) => {
        state.students.loading = false;
        if (!action.payload.cached) {
          state.students.list = action.payload.data || [];
          state.students.pagination = {
            total: action.payload.total,
            page: action.payload.page,
            limit: action.payload.limit,
            totalPages: action.payload.totalPages,
          };
          state.students.filters = action.payload.filters || { institutions: [], branches: [] };
          state.students.currentMonth = action.payload.currentMonth;
          state.students.currentYear = action.payload.currentYear;
          state.lastFetched.students = Date.now();
          state.lastFetched.studentsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchAllStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })
      .addCase(fetchStudentsSummary.pending, (state) => {
        state.students.summaryLoading = true;
      })
      .addCase(fetchStudentsSummary.fulfilled, (state, action) => {
        state.students.summaryLoading = false;
        if (!action.payload.cached) {
          state.students.summary = action.payload;
          state.lastFetched.studentsSummary = Date.now();
        }
      })
      .addCase(fetchStudentsSummary.rejected, (state, action) => {
        state.students.summaryLoading = false;
        state.students.error = action.payload;
      })

      // Reports
      .addCase(fetchReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchReports.fulfilled, (state, action) => {
        state.reports.loading = false;
        if (!action.payload.cached) {
          state.reports.list = action.payload.data || action.payload;
          state.lastFetched.reports = Date.now();
        }
      })
      .addCase(fetchReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(fetchReportById.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchReportById.fulfilled, (state, action) => {
        state.reports.loading = false;
      })
      .addCase(fetchReportById.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(generateReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(generateReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.list = [action.payload, ...state.reports.list];
        state.lastFetched.reports = Date.now();
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Analytics - each thunk uses its own loading state to prevent race conditions
      .addCase(fetchTopPerformers.pending, (state) => {
        state.analytics.topPerformersLoading = true;
        state.analytics.error = null;
      })
      .addCase(fetchTopPerformers.fulfilled, (state, action) => {
        state.analytics.topPerformersLoading = false;
        if (!action.payload.cached) {
          state.analytics.topPerformers = action.payload.topPerformers || [];
          state.analytics.bottomPerformers = action.payload.bottomPerformers || [];
          state.lastFetched.topPerformers = Date.now();
          state.lastFetched.topPerformersKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchTopPerformers.rejected, (state, action) => {
        state.analytics.topPerformersLoading = false;
        state.analytics.error = action.payload;
      })
      .addCase(fetchTopIndustries.pending, (state) => {
        state.analytics.topIndustriesLoading = true;
      })
      .addCase(fetchTopIndustries.fulfilled, (state, action) => {
        state.analytics.topIndustriesLoading = false;
        if (!action.payload.cached) {
          state.analytics.topIndustries = action.payload.data || action.payload || [];
          state.lastFetched.topIndustries = Date.now();
          state.lastFetched.topIndustriesKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchTopIndustries.rejected, (state, action) => {
        state.analytics.topIndustriesLoading = false;
        state.analytics.error = action.payload;
      })
      .addCase(fetchMonthlyAnalytics.pending, (state) => {
        state.analytics.monthlyAnalyticsLoading = true;
      })
      .addCase(fetchMonthlyAnalytics.fulfilled, (state, action) => {
        state.analytics.monthlyAnalyticsLoading = false;
        if (!action.payload.cached) {
          state.analytics.monthlyStats = action.payload.data || action.payload;
          state.lastFetched.monthlyAnalytics = Date.now();
        }
      })
      .addCase(fetchMonthlyAnalytics.rejected, (state, action) => {
        state.analytics.monthlyAnalyticsLoading = false;
        state.analytics.error = action.payload;
      })

      // Force Refresh thunks
      .addCase(forceRefreshDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(forceRefreshDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.stats = action.payload;
        state.lastFetched.dashboard = Date.now();
      })
      .addCase(forceRefreshDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })
      .addCase(forceRefreshInstitutions.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(forceRefreshInstitutions.fulfilled, (state, action) => {
        state.institutions.loading = false;
        state.institutions.list = action.payload.data || action.payload;
        state.institutions.pagination = action.payload.pagination || null;
        state.lastFetched.institutions = Date.now();
      })
      .addCase(forceRefreshInstitutions.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })
      .addCase(forceRefreshPrincipals.pending, (state) => {
        state.principals.loading = true;
        state.principals.error = null;
      })
      .addCase(forceRefreshPrincipals.fulfilled, (state, action) => {
        state.principals.loading = false;
        state.principals.list = action.payload.data || action.payload;
        state.lastFetched.principals = Date.now();
      })
      .addCase(forceRefreshPrincipals.rejected, (state, action) => {
        state.principals.loading = false;
        state.principals.error = action.payload;
      })

      // Report Builder
      .addCase(fetchReportCatalog.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportCatalog.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        // Backend returns { reports: [...], total: number }
        state.reportBuilder.catalog = action.payload.reports || action.payload.data || action.payload || [];
      })
      .addCase(fetchReportCatalog.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(fetchReportConfig.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportConfig.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.config = action.payload.data || action.payload;
      })
      .addCase(fetchReportConfig.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(generateNewReport.pending, (state) => {
        state.reportBuilder.generating = true;
        state.reportBuilder.error = null;
      })
      .addCase(generateNewReport.fulfilled, (state, action) => {
        state.reportBuilder.generating = false;
        state.reportBuilder.history = [action.payload, ...state.reportBuilder.history];
      })
      .addCase(generateNewReport.rejected, (state, action) => {
        state.reportBuilder.generating = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(fetchReportHistory.pending, (state) => {
        state.reportBuilder.loading = true;
        state.reportBuilder.error = null;
      })
      .addCase(fetchReportHistory.fulfilled, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.history = action.payload.data || action.payload || [];
      })
      .addCase(fetchReportHistory.rejected, (state, action) => {
        state.reportBuilder.loading = false;
        state.reportBuilder.error = action.payload;
      })
      .addCase(checkReportStatus.fulfilled, (state, action) => {
        const index = state.reportBuilder.history.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reportBuilder.history[index] = action.payload;
        }
      })

      // Placement Stats - each thunk uses its own loading state to prevent race conditions
      .addCase(fetchPlacementStats.pending, (state) => {
        state.placements.statsLoading = true;
        state.placements.error = null;
      })
      .addCase(fetchPlacementStats.fulfilled, (state, action) => {
        state.placements.statsLoading = false;
        if (!action.payload.cached) {
          state.placements.stats = action.payload;
          state.lastFetched.placementStats = Date.now();
        }
      })
      .addCase(fetchPlacementStats.rejected, (state, action) => {
        state.placements.statsLoading = false;
        state.placements.error = action.payload;
      })
      .addCase(fetchPlacementTrends.pending, (state) => {
        state.placements.trendsLoading = true;
        state.placements.error = null;
      })
      .addCase(fetchPlacementTrends.fulfilled, (state, action) => {
        state.placements.trendsLoading = false;
        if (!action.payload.cached) {
          state.placements.trends = action.payload || [];
          state.lastFetched.placementTrends = Date.now();
        }
      })
      .addCase(fetchPlacementTrends.rejected, (state, action) => {
        state.placements.trendsLoading = false;
        state.placements.error = action.payload;
      })

      // Joining Report Stats
      .addCase(fetchJoiningLetterStats.pending, (state) => {
        state.joiningLetters.loading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLetterStats.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        if (!action.payload.cached) {
          state.joiningLetters.stats = action.payload;
          state.lastFetched.joiningLetters = Date.now();
          state.lastFetched.joiningLettersKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchJoiningLetterStats.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })

      // Visits By Type (for pie chart)
      .addCase(fetchVisitsByType.pending, (state) => {
        state.visitsByType.loading = true;
        state.visitsByType.error = null;
      })
      .addCase(fetchVisitsByType.fulfilled, (state, action) => {
        state.visitsByType.loading = false;
        if (!action.payload.cached) {
          state.visitsByType.data = action.payload;
          state.lastFetched.visitsByType = Date.now();
          state.lastFetched.visitsByTypeKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchVisitsByType.rejected, (state, action) => {
        state.visitsByType.loading = false;
        state.visitsByType.error = action.payload;
      })

      // Institute Detail View
      .addCase(fetchInstituteOverview.pending, (state, action) => {
        // Only show loading if not cached
        if (!state.lastFetched.instituteOverview?.[action.meta.arg]) {
          state.instituteOverview.loading = true;
        }
        state.instituteOverview.error = null;
      })
      .addCase(fetchInstituteOverview.fulfilled, (state, action) => {
        state.instituteOverview.loading = false;
        if (!action.payload.cached) {
          state.instituteOverview.data = action.payload;
          // Cache timestamp per institution
          if (!state.lastFetched.instituteOverview) {
            state.lastFetched.instituteOverview = {};
          }
          state.lastFetched.instituteOverview[action.payload.institutionId] = Date.now();
        }
      })
      .addCase(fetchInstituteOverview.rejected, (state, action) => {
        state.instituteOverview.loading = false;
        state.instituteOverview.error = action.payload;
      })
      .addCase(fetchInstituteStudents.pending, (state, action) => {
        const { loadMore, institutionId } = action.meta.arg;
        const isCached = state.lastFetched.instituteStudents?.[institutionId];
        if (loadMore) {
          state.instituteStudents.loadingMore = true;
        } else if (!isCached) {
          state.instituteStudents.loading = true;
        }
        state.instituteStudents.error = null;
      })
      .addCase(fetchInstituteStudents.fulfilled, (state, action) => {
        if (action.payload.cached) {
          state.instituteStudents.loading = false;
          return;
        }
        if (action.payload.loadMore) {
          state.instituteStudents.list = [...state.instituteStudents.list, ...action.payload.students];
          state.instituteStudents.loadingMore = false;
        } else {
          state.instituteStudents.list = action.payload.students;
          state.instituteStudents.loading = false;
          // Cache timestamp per institution (only for initial fetch without filters)
          if (!state.lastFetched.instituteStudents) {
            state.lastFetched.instituteStudents = {};
          }
          state.lastFetched.instituteStudents[action.payload.institutionId] = Date.now();
        }
        state.instituteStudents.cursor = action.payload.nextCursor;
        state.instituteStudents.hasMore = action.payload.hasMore;
        state.instituteStudents.total = action.payload.total;
        // Store filters data (branches list for dropdown)
        if (action.payload.filters) {
          state.instituteStudents.filters = action.payload.filters;
        }
      })
      .addCase(fetchInstituteStudents.rejected, (state, action) => {
        state.instituteStudents.loading = false;
        state.instituteStudents.loadingMore = false;
        state.instituteStudents.error = action.payload;
      })
      .addCase(fetchInstituteCompanies.pending, (state, action) => {
        const isCached = state.lastFetched.instituteCompanies?.[action.meta.arg.institutionId];
        if (!isCached) {
          state.instituteCompanies.loading = true;
        }
        state.instituteCompanies.error = null;
      })
      .addCase(fetchInstituteCompanies.fulfilled, (state, action) => {
        state.instituteCompanies.loading = false;
        if (action.payload.cached) {
          return;
        }
        state.instituteCompanies.list = action.payload.companies || action.payload.data || [];
        state.instituteCompanies.total = action.payload.total || 0;
        state.instituteCompanies.summary = action.payload.summary || null;
        // Cache timestamp per institution
        if (!state.lastFetched.instituteCompanies) {
          state.lastFetched.instituteCompanies = {};
        }
        state.lastFetched.instituteCompanies[action.payload.institutionId] = Date.now();
      })
      .addCase(fetchInstituteCompanies.rejected, (state, action) => {
        state.instituteCompanies.loading = false;
        state.instituteCompanies.error = action.payload;
      })

      // Faculty & Principal
      .addCase(fetchInstituteFacultyPrincipal.pending, (state, action) => {
        const isCached = state.lastFetched.instituteFaculty?.[action.meta.arg];
        if (!isCached) {
          state.instituteFacultyPrincipal.loading = true;
        }
        state.instituteFacultyPrincipal.error = null;
      })
      .addCase(fetchInstituteFacultyPrincipal.fulfilled, (state, action) => {
        state.instituteFacultyPrincipal.loading = false;
        if (action.payload.cached) {
          return;
        }
        state.instituteFacultyPrincipal.principal = action.payload.principal || null;
        state.instituteFacultyPrincipal.faculty = action.payload.faculty || [];
        state.instituteFacultyPrincipal.summary = action.payload.summary || null;
        // Cache timestamp per institution
        if (!state.lastFetched.instituteFaculty) {
          state.lastFetched.instituteFaculty = {};
        }
        state.lastFetched.instituteFaculty[action.payload.institutionId] = Date.now();
      })
      .addCase(fetchInstituteFacultyPrincipal.rejected, (state, action) => {
        state.instituteFacultyPrincipal.loading = false;
        state.instituteFacultyPrincipal.error = action.payload;
      })

      // All Mentors (cross-institution)
      .addCase(fetchAllMentors.pending, (state) => {
        state.allMentors.loading = true;
        state.allMentors.error = null;
      })
      .addCase(fetchAllMentors.fulfilled, (state, action) => {
        state.allMentors.loading = false;
        state.allMentors.list = action.payload.data || action.payload || [];
      })
      .addCase(fetchAllMentors.rejected, (state, action) => {
        state.allMentors.loading = false;
        state.allMentors.error = action.payload;
      })

      // Assign Mentor to Student
      .addCase(assignMentorToStudent.fulfilled, (state, action) => {
        const { studentId, assignment, isCrossInstitutionMentor } = action.payload;
        // Update the student in the list with the new mentor
        const studentIndex = state.instituteStudents.list.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          const student = state.instituteStudents.list[studentIndex];
          // Component expects mentorAssignments array with isActive and mentor
          const newAssignment = {
            ...assignment,
            isActive: true,
            mentor: assignment?.mentor || null,
          };
          // Deactivate existing assignments and add new one
          const existingAssignments = (student.mentorAssignments || []).map(ma => ({
            ...ma,
            isActive: false,
          }));
          state.instituteStudents.list[studentIndex] = {
            ...student,
            mentor: assignment?.mentor || null,
            mentorAssignments: [...existingAssignments, newAssignment],
            isCrossInstitutionMentor: isCrossInstitutionMentor || false,
          };
        }
      })

      // Remove Mentor from Student
      .addCase(removeMentorFromStudent.fulfilled, (state, action) => {
        const { studentId } = action.payload;
        // Update the student in the list to remove mentor
        const studentIndex = state.instituteStudents.list.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          const student = state.instituteStudents.list[studentIndex];
          // Deactivate all mentor assignments
          const deactivatedAssignments = (student.mentorAssignments || []).map(ma => ({
            ...ma,
            isActive: false,
          }));
          state.instituteStudents.list[studentIndex] = {
            ...student,
            mentor: null,
            mentorAssignments: deactivatedAssignments,
          };
        }
      })

      // Delete Student
      .addCase(deleteInstituteStudent.fulfilled, (state, action) => {
        // Remove student from list
        state.instituteStudents.list = state.instituteStudents.list.filter(
          s => s.id !== action.payload.studentId
        );
        state.instituteStudents.total = Math.max(0, state.instituteStudents.total - 1);
        // Invalidate caches for this institution to force refresh on next visit
        if (action.payload.institutionId) {
          if (state.lastFetched.instituteStudents) {
            delete state.lastFetched.instituteStudents[action.payload.institutionId];
          }
          if (state.lastFetched.instituteOverview) {
            delete state.lastFetched.instituteOverview[action.payload.institutionId];
          }
        }
      })

      // Toggle Student Status (activate/deactivate)
      .addCase(toggleStudentStatus.fulfilled, (state, action) => {
        const { studentId, active } = action.payload;
        // Update student in list with new status
        const studentIndex = state.instituteStudents.list.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          const student = state.instituteStudents.list[studentIndex];
          state.instituteStudents.list[studentIndex] = {
            ...student,
            user: {
              ...student.user,
              active: active,
            },
            // Update mentor assignments based on new status
            mentorAssignments: (student.mentorAssignments || []).map(ma => ({
              ...ma,
              isActive: active, // Reactivate or deactivate based on student status
            })),
          };
        }
        // Invalidate caches for this institution to force refresh on next visit
        if (action.payload.institutionId) {
          if (state.lastFetched.instituteStudents) {
            delete state.lastFetched.instituteStudents[action.payload.institutionId];
          }
          if (state.lastFetched.instituteOverview) {
            delete state.lastFetched.instituteOverview[action.payload.institutionId];
          }
        }
      })

      // Delete Faculty
      .addCase(deleteInstituteFaculty.fulfilled, (state, action) => {
        // Remove faculty from list
        state.instituteFacultyPrincipal.faculty = state.instituteFacultyPrincipal.faculty.filter(
          f => f.id !== action.payload.facultyId
        );
        // Invalidate caches for this institution to force refresh on next visit
        if (action.payload.institutionId) {
          if (state.lastFetched.instituteFaculty) {
            delete state.lastFetched.instituteFaculty[action.payload.institutionId];
          }
          if (state.lastFetched.instituteOverview) {
            delete state.lastFetched.instituteOverview[action.payload.institutionId];
          }
        }
      })

      // Toggle Faculty Status (activate/deactivate)
      .addCase(toggleFacultyStatus.fulfilled, (state, action) => {
        const { facultyId, active } = action.payload;
        // Update faculty in list with new status
        const facultyIndex = state.instituteFacultyPrincipal.faculty.findIndex(f => f.id === facultyId);
        if (facultyIndex !== -1) {
          state.instituteFacultyPrincipal.faculty[facultyIndex] = {
            ...state.instituteFacultyPrincipal.faculty[facultyIndex],
            active: active,
          };
        }
        // Invalidate caches for this institution to force refresh on next visit
        if (action.payload.institutionId) {
          if (state.lastFetched.instituteFaculty) {
            delete state.lastFetched.instituteFaculty[action.payload.institutionId];
          }
          if (state.lastFetched.instituteOverview) {
            delete state.lastFetched.instituteOverview[action.payload.institutionId];
          }
        }
      })

      // Critical Alerts
      .addCase(fetchCriticalAlerts.pending, (state) => {
        state.criticalAlerts.loading = true;
        state.criticalAlerts.error = null;
      })
      .addCase(fetchCriticalAlerts.fulfilled, (state, action) => {
        state.criticalAlerts.loading = false;
        if (!action.payload.cached) {
          state.criticalAlerts.data = action.payload;
          state.lastFetched.criticalAlerts = Date.now();
        }
      })
      .addCase(fetchCriticalAlerts.rejected, (state, action) => {
        state.criticalAlerts.loading = false;
        state.criticalAlerts.error = action.payload;
      })

      // Action Items
      .addCase(fetchActionItems.pending, (state) => {
        state.actionItems.loading = true;
        state.actionItems.error = null;
      })
      .addCase(fetchActionItems.fulfilled, (state, action) => {
        state.actionItems.loading = false;
        if (!action.payload.cached) {
          state.actionItems.data = action.payload;
          state.lastFetched.actionItems = Date.now();
        }
      })
      .addCase(fetchActionItems.rejected, (state, action) => {
        state.actionItems.loading = false;
        state.actionItems.error = action.payload;
      })

      // Compliance Summary
      .addCase(fetchComplianceSummary.pending, (state) => {
        state.complianceSummary.loading = true;
        state.complianceSummary.error = null;
      })
      .addCase(fetchComplianceSummary.fulfilled, (state, action) => {
        state.complianceSummary.loading = false;
        if (!action.payload.cached) {
          state.complianceSummary.data = action.payload;
          state.lastFetched.complianceSummary = Date.now();
        }
      })
      .addCase(fetchComplianceSummary.rejected, (state, action) => {
        state.complianceSummary.loading = false;
        state.complianceSummary.error = action.payload;
      })

      // ==================== STATE-WIDE COMPANIES OVERVIEW ====================
      .addCase(fetchAllCompanies.pending, (state) => {
        state.companiesOverview.loading = true;
        state.companiesOverview.error = null;
      })
      .addCase(fetchAllCompanies.fulfilled, (state, action) => {
        state.companiesOverview.loading = false;
        if (!action.payload.cached) {
          state.companiesOverview.list = action.payload.companies || [];
          state.companiesOverview.pagination = action.payload.pagination || null;
          state.companiesOverview.summary = action.payload.summary || null;
          state.lastFetched.companiesOverview = Date.now();
          state.lastFetched.companiesOverviewKey = action.payload._cacheKey;
        }
      })
      .addCase(fetchAllCompanies.rejected, (state, action) => {
        state.companiesOverview.loading = false;
        state.companiesOverview.error = action.payload;
      })
      .addCase(fetchCompanyDetails.pending, (state) => {
        state.companiesOverview.detailsLoading = true;
        state.companiesOverview.detailsError = null;
      })
      .addCase(fetchCompanyDetails.fulfilled, (state, action) => {
        state.companiesOverview.detailsLoading = false;
        state.companiesOverview.selectedCompanyDetails = action.payload;
      })
      .addCase(fetchCompanyDetails.rejected, (state, action) => {
        state.companiesOverview.detailsLoading = false;
        state.companiesOverview.detailsError = action.payload || 'Failed to load company details';
      })

      // ==================== RESTORE CENTER ====================
      .addCase(fetchDeletedItemsSummary.pending, (state) => {
        state.restoreCenter.summaryLoading = true;
        state.restoreCenter.error = null;
      })
      .addCase(fetchDeletedItemsSummary.fulfilled, (state, action) => {
        state.restoreCenter.summaryLoading = false;
        state.restoreCenter.summary = action.payload || { monthlyReports: 0, facultyVisits: 0, documents: 0, total: 0 };
      })
      .addCase(fetchDeletedItemsSummary.rejected, (state, action) => {
        state.restoreCenter.summaryLoading = false;
        state.restoreCenter.error = action.payload;
      })
      .addCase(fetchDeletedItems.pending, (state) => {
        state.restoreCenter.loading = true;
        state.restoreCenter.error = null;
      })
      .addCase(fetchDeletedItems.fulfilled, (state, action) => {
        state.restoreCenter.loading = false;
        state.restoreCenter.items = action.payload.items || action.payload.data || [];
        state.restoreCenter.pagination = action.payload.pagination || {
          page: 1,
          limit: 20,
          total: action.payload.total || 0,
          totalPages: action.payload.totalPages || 0,
        };
      })
      .addCase(fetchDeletedItems.rejected, (state, action) => {
        state.restoreCenter.loading = false;
        state.restoreCenter.error = action.payload;
      })
      .addCase(restoreDeletedItem.pending, (state, action) => {
        // Track individual item restore state
        const id = action.meta.arg.id;
        state.restoreCenter.restoring[id] = true;
      })
      .addCase(restoreDeletedItem.fulfilled, (state, action) => {
        const { id, type } = action.payload;
        // Remove from restoring state
        delete state.restoreCenter.restoring[id];
        // Remove restored item from list
        state.restoreCenter.items = state.restoreCenter.items.filter(item => item.id !== id);
        // Update summary counts
        if (type === 'monthly-reports' && state.restoreCenter.summary.monthlyReports > 0) {
          state.restoreCenter.summary.monthlyReports--;
          state.restoreCenter.summary.total--;
        } else if (type === 'faculty-visits' && state.restoreCenter.summary.facultyVisits > 0) {
          state.restoreCenter.summary.facultyVisits--;
          state.restoreCenter.summary.total--;
        } else if (type === 'documents' && state.restoreCenter.summary.documents > 0) {
          state.restoreCenter.summary.documents--;
          state.restoreCenter.summary.total--;
        }
        // Update pagination total
        if (state.restoreCenter.pagination.total > 0) {
          state.restoreCenter.pagination.total--;
        }
      })
      .addCase(restoreDeletedItem.rejected, (state, action) => {
        const id = action.meta.arg.id;
        delete state.restoreCenter.restoring[id];
        state.restoreCenter.error = action.payload;
      })
      .addCase(bulkRestoreDeletedItems.pending, (state, action) => {
        // Track all items being restored
        const ids = action.meta.arg.ids;
        ids.forEach(id => {
          state.restoreCenter.restoring[id] = true;
        });
      })
      .addCase(bulkRestoreDeletedItems.fulfilled, (state, action) => {
        const { ids, type, restoredCount } = action.payload;
        // Clear restoring state for all ids
        ids.forEach(id => {
          delete state.restoreCenter.restoring[id];
        });
        // Remove restored items from list
        state.restoreCenter.items = state.restoreCenter.items.filter(item => !ids.includes(item.id));
        // Update summary counts based on actual restored count
        const count = restoredCount || ids.length;
        if (type === 'monthly-reports') {
          state.restoreCenter.summary.monthlyReports = Math.max(0, state.restoreCenter.summary.monthlyReports - count);
        } else if (type === 'faculty-visits') {
          state.restoreCenter.summary.facultyVisits = Math.max(0, state.restoreCenter.summary.facultyVisits - count);
        } else if (type === 'documents') {
          state.restoreCenter.summary.documents = Math.max(0, state.restoreCenter.summary.documents - count);
        }
        state.restoreCenter.summary.total = Math.max(0, state.restoreCenter.summary.total - count);
        // Update pagination total
        state.restoreCenter.pagination.total = Math.max(0, state.restoreCenter.pagination.total - count);
      })
      .addCase(bulkRestoreDeletedItems.rejected, (state, action) => {
        const ids = action.meta.arg.ids;
        ids.forEach(id => {
          delete state.restoreCenter.restoring[id];
        });
        state.restoreCenter.error = action.payload;
      })
      // ==================== Monthly Compliance ====================
      .addCase(fetchMonthlyCompliance.pending, (state) => {
        state.monthlyCompliance.loading = true;
        state.monthlyCompliance.error = null;
      })
      .addCase(fetchMonthlyCompliance.fulfilled, (state, action) => {
        state.monthlyCompliance.loading = false;
        if (!action.payload.cached) {
          state.monthlyCompliance.institutionList = action.payload.institutions || [];
          state.monthlyCompliance.stateWideSummary = action.payload.stateWideSummary || null;
          state.monthlyCompliance.month = action.payload.month;
          state.monthlyCompliance.year = action.payload.year;
          state.monthlyCompliance.pagination = action.payload.pagination || null;
          state.lastFetched.monthlyCompliance = Date.now();
          state.lastFetched.monthlyComplianceKey = action.payload._cacheKey;
        }
      })
      .addCase(fetchMonthlyCompliance.rejected, (state, action) => {
        state.monthlyCompliance.loading = false;
        state.monthlyCompliance.error = action.payload;
      })
      .addCase(fetchInstitutionComplianceDetails.pending, (state) => {
        state.monthlyCompliance.detailsLoading = true;
        state.monthlyCompliance.detailsError = null;
      })
      .addCase(fetchInstitutionComplianceDetails.fulfilled, (state, action) => {
        state.monthlyCompliance.detailsLoading = false;
        if (!action.payload.cached) {
          // Store details with month/year for proper cache validation
          state.monthlyCompliance.selectedInstitutionDetails = {
            ...action.payload,
            institutionId: action.payload.institutionId,
            month: action.payload.month,
            year: action.payload.year,
          };
          state.monthlyCompliance.selectedInstitutionId = action.payload.institutionId;
          // Cache the fetch timestamp
          if (!state.lastFetched.monthlyComplianceDetails) {
            state.lastFetched.monthlyComplianceDetails = {};
          }
          state.lastFetched.monthlyComplianceDetails[action.payload._cacheKey] = Date.now();
        }
      })
      .addCase(fetchInstitutionComplianceDetails.rejected, (state, action) => {
        state.monthlyCompliance.detailsLoading = false;
        state.monthlyCompliance.detailsError = action.payload;
      })
      .addCase(fetchAvailableComplianceMonths.pending, (state) => {
        state.monthlyCompliance.monthsLoading = true;
      })
      .addCase(fetchAvailableComplianceMonths.fulfilled, (state, action) => {
        state.monthlyCompliance.monthsLoading = false;
        if (!action.payload.cached) {
          state.monthlyCompliance.availableMonths = action.payload.months || [];
          state.lastFetched.availableComplianceMonths = Date.now();
        }
      })
      .addCase(fetchAvailableComplianceMonths.rejected, (state, action) => {
        state.monthlyCompliance.monthsLoading = false;
      });
  },
});

export const {
  setSelectedInstitution,
  clearStateError,
  markAllDataStale,
  resetStateSlice,
  clearCurrentPrincipal,
  // Institution optimistic updates
  optimisticallyAddInstitution,
  optimisticallyUpdateInstitution,
  optimisticallyDeleteInstitution,
  rollbackInstitutionOperation,
  // Principal optimistic updates
  optimisticallyAddPrincipal,
  optimisticallyUpdatePrincipal,
  optimisticallyDeletePrincipal,
  rollbackPrincipalOperation,
  // Institute detail view actions
  setSelectedInstitute,
  clearSelectedInstitute,
  // Companies overview actions
  setSelectedCompany,
  clearSelectedCompany,
  // Restore Center actions
  setRestoreCenterType,
  clearRestoreCenterError,
  // Monthly Compliance actions
  setMonthlyComplianceMonth,
  setSelectedComplianceInstitution,
  clearMonthlyComplianceError,
  clearMonthlyComplianceDetails,
} = stateSlice.actions;

// ============= SELECTORS =============
// All selectors use optional chaining for null safety during redux-persist rehydration

// Dashboard selectors
export const selectDashboardStats = (state) => state.state?.dashboard?.stats ?? null;
export const selectDashboardLoading = (state) => state.state?.dashboard?.loading ?? false;
export const selectDashboardError = (state) => state.state?.dashboard?.error ?? null;

// Institution selectors
export const selectInstitutions = (state) => state.state?.institutions?.list ?? [];
export const selectSelectedInstitution = (state) => state.state?.institutions?.selected ?? null;
export const selectInstitutionsPagination = (state) => state.state?.institutions?.pagination ?? null;
export const selectInstitutionsLoading = (state) => state.state?.institutions?.loading ?? false;
export const selectInstitutionsError = (state) => state.state?.institutions?.error ?? null;
export const selectInstitutionsTotalStudents = (state) => state.state?.institutions?.totalStudents ?? null;

// Institutions with Stats selectors (for dashboard)
export const selectInstitutionsWithStats = (state) => state.state?.institutionsWithStats?.list ?? [];
export const selectInstitutionsWithStatsPagination = (state) => state.state?.institutionsWithStats?.pagination ?? null;
export const selectInstitutionsWithStatsLoading = (state) => state.state?.institutionsWithStats?.loading ?? false;
export const selectInstitutionsWithStatsError = (state) => state.state?.institutionsWithStats?.error ?? null;
export const selectInstitutionsWithStatsMonth = (state) => state.state?.institutionsWithStats?.month ?? null;
export const selectInstitutionsWithStatsYear = (state) => state.state?.institutionsWithStats?.year ?? null;

// Principal selectors
export const selectPrincipals = (state) => state.state?.principals?.list ?? [];
export const selectCurrentPrincipal = (state) => state.state?.currentPrincipal ?? null;
export const selectPrincipalsLoading = (state) => state.state?.principals?.loading ?? false;
export const selectPrincipalsError = (state) => state.state?.principals?.error ?? null;

// Reports selectors
export const selectReports = (state) => state.state?.reports?.list ?? [];
export const selectReportsLoading = (state) => state.state?.reports?.loading ?? false;
export const selectReportsError = (state) => state.state?.reports?.error ?? null;

// Analytics selectors
export const selectTopPerformers = (state) => state.state?.analytics?.topPerformers ?? [];
export const selectBottomPerformers = (state) => state.state?.analytics?.bottomPerformers ?? [];
export const selectTopIndustries = (state) => state.state?.analytics?.topIndustries ?? [];
export const selectMonthlyStats = (state) => state.state?.analytics?.monthlyStats ?? null;
// Split loading selectors for granular control
export const selectTopPerformersLoading = (state) => state.state?.analytics?.topPerformersLoading ?? false;
export const selectTopIndustriesLoading = (state) => state.state?.analytics?.topIndustriesLoading ?? false;
export const selectMonthlyAnalyticsLoading = (state) => state.state?.analytics?.monthlyAnalyticsLoading ?? false;
// Combined loading selector for backward compatibility
export const selectAnalyticsLoading = (state) =>
  (state.state?.analytics?.topPerformersLoading ?? false) ||
  (state.state?.analytics?.topIndustriesLoading ?? false) ||
  (state.state?.analytics?.monthlyAnalyticsLoading ?? false);
export const selectAnalyticsError = (state) => state.state?.analytics?.error ?? null;

// Report Builder selectors
export const selectReportCatalog = (state) => state.state?.reportBuilder?.catalog ?? [];
export const selectReportConfig = (state) => state.state?.reportBuilder?.config ?? null;
export const selectReportHistory = (state) => state.state?.reportBuilder?.history ?? [];
export const selectReportBuilderLoading = (state) => state.state?.reportBuilder?.loading ?? false;
export const selectReportGenerating = (state) => state.state?.reportBuilder?.generating ?? false;
export const selectReportBuilderError = (state) => state.state?.reportBuilder?.error ?? null;

// Placement selectors
export const selectPlacementStats = (state) => state.state?.placements?.stats ?? null;
export const selectPlacementTrends = (state) => state.state?.placements?.trends ?? [];
// Split loading selectors for granular control
export const selectPlacementStatsLoading = (state) => state.state?.placements?.statsLoading ?? false;
export const selectPlacementTrendsLoading = (state) => state.state?.placements?.trendsLoading ?? false;
// Combined loading selector for backward compatibility
export const selectPlacementsLoading = (state) =>
  (state.state?.placements?.statsLoading ?? false) ||
  (state.state?.placements?.trendsLoading ?? false);
export const selectPlacementsError = (state) => state.state?.placements?.error ?? null;

// Joining Report selectors
export const selectJoiningLetterStats = (state) => state.state?.joiningLetters?.stats ?? null;
export const selectJoiningLettersLoading = (state) => state.state?.joiningLetters?.loading ?? false;
export const selectJoiningLettersError = (state) => state.state?.joiningLetters?.error ?? null;

// Visits By Type selectors
export const selectVisitsByType = (state) => state.state?.visitsByType?.data ?? null;
export const selectVisitsByTypeLoading = (state) => state.state?.visitsByType?.loading ?? false;
export const selectVisitsByTypeError = (state) => state.state?.visitsByType?.error ?? null;

// Last fetched selectors
export const selectLastFetched = (state) => state.state?.lastFetched ?? {};
export const selectMostRecentFetch = (state) => {
  const lastFetched = state.state?.lastFetched ?? {};
  const timestamps = Object.values(lastFetched).filter(Boolean);
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

// Combined loading selector
export const selectAnyLoading = (state) =>
  (state.state?.dashboard?.loading ?? false) ||
  (state.state?.institutions?.loading ?? false) ||
  (state.state?.principals?.loading ?? false) ||
  (state.state?.reports?.loading ?? false) ||
  (state.state?.analytics?.topPerformersLoading ?? false) ||
  (state.state?.analytics?.topIndustriesLoading ?? false) ||
  (state.state?.analytics?.monthlyAnalyticsLoading ?? false) ||
  (state.state?.placements?.statsLoading ?? false) ||
  (state.state?.placements?.trendsLoading ?? false) ||
  (state.state?.joiningLetters?.loading ?? false);

// Institute Detail View selectors
export const selectSelectedInstitute = (state) => state.state?.selectedInstitute ?? { id: null, data: null, loading: false, error: null };
export const selectInstituteOverview = (state) => state.state?.instituteOverview ?? { data: null, loading: false, error: null };
export const selectInstituteStudents = (state) => state.state?.instituteStudents ?? { list: [], cursor: null, hasMore: true, total: 0, loading: false, loadingMore: false, error: null, filters: { branches: [] } };
export const selectInstituteCompanies = (state) => state.state?.instituteCompanies ?? { list: [], total: 0, summary: null, loading: false, error: null };
export const selectInstituteFacultyPrincipal = (state) => state.state?.instituteFacultyPrincipal ?? { principal: null, faculty: [], summary: null, loading: false, error: null };

// All Mentors selectors (cross-institution)
export const selectAllMentors = (state) => state.state?.allMentors?.list ?? [];
export const selectAllMentorsLoading = (state) => state.state?.allMentors?.loading ?? false;
export const selectAllMentorsError = (state) => state.state?.allMentors?.error ?? null;

// Critical Alerts selectors
export const selectCriticalAlerts = (state) => state.state?.criticalAlerts?.data ?? null;
export const selectCriticalAlertsLoading = (state) => state.state?.criticalAlerts?.loading ?? false;
export const selectCriticalAlertsError = (state) => state.state?.criticalAlerts?.error ?? null;

// Action Items selectors
export const selectActionItems = (state) => state.state?.actionItems?.data ?? null;
export const selectActionItemsLoading = (state) => state.state?.actionItems?.loading ?? false;
export const selectActionItemsError = (state) => state.state?.actionItems?.error ?? null;

// Compliance Summary selectors
export const selectComplianceSummary = (state) => state.state?.complianceSummary?.data ?? null;
export const selectComplianceSummaryLoading = (state) => state.state?.complianceSummary?.loading ?? false;
export const selectComplianceSummaryError = (state) => state.state?.complianceSummary?.error ?? null;

// Companies Overview selectors
export const selectCompaniesOverview = (state) => state.state?.companiesOverview ?? { list: [], pagination: null, summary: null, selectedCompany: null, selectedCompanyDetails: null, loading: false, detailsLoading: false, error: null, detailsError: null };
export const selectAllCompanies = (state) => state.state?.companiesOverview?.list ?? [];
export const selectCompaniesPagination = (state) => state.state?.companiesOverview?.pagination ?? null;
export const selectCompaniesSummary = (state) => state.state?.companiesOverview?.summary ?? null;
export const selectSelectedCompany = (state) => state.state?.companiesOverview?.selectedCompany ?? null;
export const selectSelectedCompanyDetails = (state) => state.state?.companiesOverview?.selectedCompanyDetails ?? null;
export const selectCompaniesLoading = (state) => state.state?.companiesOverview?.loading ?? false;
export const selectCompanyDetailsLoading = (state) => state.state?.companiesOverview?.detailsLoading ?? false;
export const selectCompaniesError = (state) => state.state?.companiesOverview?.error ?? null;
export const selectCompanyDetailsError = (state) => state.state?.companiesOverview?.detailsError ?? null;

// Restore Center selectors
export const selectRestoreCenter = (state) => state.state?.restoreCenter ?? {
  summary: { monthlyReports: 0, facultyVisits: 0, documents: 0, total: 0 },
  items: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  selectedType: 'monthly-reports',
  loading: false,
  summaryLoading: false,
  restoring: {},
  error: null,
};
export const selectRestoreCenterSummary = (state) => state.state?.restoreCenter?.summary ?? { monthlyReports: 0, facultyVisits: 0, documents: 0, total: 0 };
export const selectRestoreCenterItems = (state) => state.state?.restoreCenter?.items ?? [];
export const selectRestoreCenterPagination = (state) => state.state?.restoreCenter?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 0 };
export const selectRestoreCenterSelectedType = (state) => state.state?.restoreCenter?.selectedType ?? 'monthly-reports';
export const selectRestoreCenterLoading = (state) => state.state?.restoreCenter?.loading ?? false;
export const selectRestoreCenterSummaryLoading = (state) => state.state?.restoreCenter?.summaryLoading ?? false;
export const selectRestoreCenterRestoring = (state) => state.state?.restoreCenter?.restoring ?? {};
export const selectRestoreCenterError = (state) => state.state?.restoreCenter?.error ?? null;

// Monthly Compliance selectors
export const selectMonthlyComplianceInstitutions = (state) => state.state?.monthlyCompliance?.institutionList ?? [];
export const selectMonthlyComplianceStateWideSummary = (state) => state.state?.monthlyCompliance?.stateWideSummary ?? null;
export const selectMonthlyComplianceSelectedInstitutionId = (state) => state.state?.monthlyCompliance?.selectedInstitutionId ?? null;
export const selectMonthlyComplianceSelectedDetails = (state) => state.state?.monthlyCompliance?.selectedInstitutionDetails ?? null;
export const selectMonthlyComplianceAvailableMonths = (state) => state.state?.monthlyCompliance?.availableMonths ?? [];
export const selectMonthlyComplianceMonth = (state) => state.state?.monthlyCompliance?.month ?? null;
export const selectMonthlyComplianceYear = (state) => state.state?.monthlyCompliance?.year ?? null;
export const selectMonthlyCompliancePagination = (state) => state.state?.monthlyCompliance?.pagination ?? null;
export const selectMonthlyComplianceLoading = (state) => state.state?.monthlyCompliance?.loading ?? false;
export const selectMonthlyComplianceDetailsLoading = (state) => state.state?.monthlyCompliance?.detailsLoading ?? false;
export const selectMonthlyComplianceMonthsLoading = (state) => state.state?.monthlyCompliance?.monthsLoading ?? false;
export const selectMonthlyComplianceError = (state) => state.state?.monthlyCompliance?.error ?? null;
export const selectMonthlyComplianceDetailsError = (state) => state.state?.monthlyCompliance?.detailsError ?? null;

export default stateSlice.reducer;
