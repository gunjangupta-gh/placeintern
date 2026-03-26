import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import principalService from '../../../services/principal.service';
import { bulkService } from '../../../services/bulk.service';
import { credentialsService } from '../../../services/credentials.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  students: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  staff: {
    list: [],
    selected: null,
    pagination: null,
    loading: false,
    error: null,
  },
  mentors: {
    list: [],
    loading: false,
    error: null,
  },
  // Note: batches and departments are now managed globally by lookupSlice
  // Use useBatches() and useDepartments() hooks from shared/hooks/useLookup
  mentorAssignments: [],
  mentorStats: {
    data: null,
    loading: false,
    error: null,
  },
  mentorCoverage: {
    data: null,
    loading: false,
    error: null,
  },
  complianceMetrics: {
    data: null,
    loading: false,
    error: null,
  },
  alertsEnhanced: {
    data: null,
    loading: false,
    error: null,
  },
  joiningLetters: {
    stats: null,
    list: [],
    activity: [],
    byMentor: null,
    pagination: null,
    loading: false,
    statsLoading: false,
    activityLoading: false,
    byMentorLoading: false,
    actionLoading: false,
    actionError: null,
    error: null,
  },
  internshipStats: {
    data: null,
    loading: false,
    error: null,
  },
  facultyWorkload: {
    list: [],
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    students: null,
    studentsKey: null,
    staff: null,
    staffKey: null,
    mentors: null,
    // batches and departments removed - use lookupSlice instead
    mentorAssignments: null,
    mentorAssignmentsKey: null,
    mentorStats: null,
    mentorCoverage: null,
    complianceMetrics: null,
    alertsEnhanced: null,
    joiningLetterStats: null,
    joiningLetters: null,
    joiningLettersKey: null,
    joiningLetterActivity: null,
    joiningLetterActivityKey: null,
    joiningLettersByMentor: null,
    internshipStats: null,
    facultyWorkload: null,
  },
};

export const fetchPrincipalDashboard = createAsyncThunk(
  'principal/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.dashboard;
      const forceRefresh = params?.forceRefresh ?? false;

      if (!forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      // Pass forceRefresh to backend to also invalidate server-side cache
      const response = await principalService.getDashboard(forceRefresh);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch dashboard data. Please check your connection and try again.';
      console.error('Dashboard fetch error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchStudents = createAsyncThunk(
  'principal/fetchStudents',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.students;

      // Normalize params into a stable key for param-aware caching
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        batchId: params?.batchId ?? '',
        branchId: params?.branchId ?? '',
        mentorId: params?.mentorId ?? '',
        // isActive can be boolean or string; normalize to string for cache key
        isActive: params?.isActive != null ? String(params.isActive) : '',
        hasMentor: params?.hasMentor ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.principal.lastFetched.studentsKey;

      // Use LISTS cache duration - users expect relatively fresh data
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await principalService.getStudents(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch students. Please try again.';
      console.error('Fetch students error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchStaff = createAsyncThunk(
  'principal/fetchStaff',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.staff;

      // Normalize params into a stable key for param-aware caching
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        role: params?.role ?? '',
        designation: params?.designation ?? '',
        // Principal staff list endpoint expects `active` (as string)
        active: params?.isActive != null ? String(params.isActive) : (params?.active != null ? String(params.active) : ''),
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.principal.lastFetched.staffKey;

      // Use LISTS cache duration - users expect relatively fresh data
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await principalService.getStaff(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch staff. Please try again.';
      console.error('Fetch staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchMentors = createAsyncThunk(
  'principal/fetchMentors',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.mentors;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await principalService.getMentors(params);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch mentors. Please try again.';
      console.error('Fetch mentors error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Note: fetchBatches and fetchDepartments have been removed
// These are now handled globally by lookupSlice
// Use useBatches() and useDepartments() hooks from shared/hooks/useLookup

// Student CRUD
export const createStudent = createAsyncThunk(
  'principal/createStudent',
  async (studentData, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.students.list];

    try {
      // Optimistic update - add student immediately
      dispatch(principalSlice.actions.optimisticallyAddStudent(studentData));

      // Make API call
      const response = await principalService.createStudent(studentData);
      return response;
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStudentOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to create student. Please check the form and try again.';
      console.error('Create student error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateStudent = createAsyncThunk(
  'principal/updateStudent',
  async ({ id, data }, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.students.list];

    try {
      // Optimistic update - update student immediately
      dispatch(principalSlice.actions.optimisticallyUpdateStudent({ id, data }));

      // Make API call
      const response = await principalService.updateStudent(id, data);
      return response;
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStudentOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to update student. Please try again.';
      console.error('Update student error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteStudent = createAsyncThunk(
  'principal/deleteStudent',
  async (id, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.students.list];

    try {
      // Optimistic update - remove student immediately
      dispatch(principalSlice.actions.optimisticallyDeleteStudent(id));

      // Make API call
      const response = await principalService.deleteStudent(id);
      return { id, ...response };
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStudentOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to delete student. Please try again.';
      console.error('Delete student error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Toggle student active status (activate/deactivate)
// Also toggles related mentor assignments and internship applications
export const toggleStudentStatus = createAsyncThunk(
  'principal/toggleStudentStatus',
  async ({ studentId }, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.students.list];

    try {
      // Optimistic update - toggle status immediately
      dispatch(principalSlice.actions.optimisticallyToggleStudentStatus(studentId));

      // Make API call
      const response = await principalService.toggleStudentStatus(studentId);
      return { studentId, ...response };
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStudentOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to toggle student status. Please try again.';
      console.error('Toggle student status error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const bulkUploadStudents = createAsyncThunk(
  'principal/bulkUploadStudents',
  async (file, { rejectWithValue }) => {
    try {
      const response = await principalService.bulkUploadStudents(file);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to bulk upload students. Please check the file format and try again.';
      console.error('Bulk upload students error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const bulkUploadStaff = createAsyncThunk(
  'principal/bulkUploadStaff',
  async (file, { rejectWithValue }) => {
    try {
      const response = await principalService.bulkUploadStaff(file);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to bulk upload staff. Please check the file format and try again.';
      console.error('Bulk upload staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const downloadTemplate = createAsyncThunk(
  'principal/downloadTemplate',
  async (type, { rejectWithValue }) => {
    try {
      const response = await bulkService.downloadTemplate(type);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to download template. Please try again.';
      console.error('Download template error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Staff CRUD
export const createStaff = createAsyncThunk(
  'principal/createStaff',
  async (staffData, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.staff.list];

    try {
      // Optimistic update - add staff immediately
      dispatch(principalSlice.actions.optimisticallyAddStaff(staffData));

      // Make API call
      const response = await principalService.createStaff(staffData);
      return response;
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStaffOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to create staff. Please check the form and try again.';
      console.error('Create staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const updateStaff = createAsyncThunk(
  'principal/updateStaff',
  async ({ id, data }, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.staff.list];

    try {
      // Optimistic update - update staff immediately
      dispatch(principalSlice.actions.optimisticallyUpdateStaff({ id, data }));

      // Make API call
      const response = await principalService.updateStaff(id, data);
      return response;
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStaffOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to update staff. Please try again.';
      console.error('Update staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteStaff = createAsyncThunk(
  'principal/deleteStaff',
  async (id, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().principal.staff.list];

    try {
      // Optimistic update - remove staff immediately
      dispatch(principalSlice.actions.optimisticallyDeleteStaff(id));

      // Make API call
      const response = await principalService.deleteStaff(id);
      return { id, ...response };
    } catch (error) {
      // Rollback on error
      dispatch(principalSlice.actions.rollbackStaffOperation({ list: previousList }));

      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to delete staff. Please try again.';
      console.error('Delete staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const toggleStaffStatus = createAsyncThunk(
  'principal/toggleStaffStatus',
  async (id, { rejectWithValue }) => {
    try {
      const response = await principalService.toggleStaffStatus(id);
      return { id, ...response };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to toggle staff status. Please try again.';
      console.error('Toggle staff status error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Mentor assignments
export const assignMentor = createAsyncThunk(
  'principal/assignMentor',
  async (data, { rejectWithValue }) => {
    // data should contain: { mentorId, studentIds, academicYear, semester?, reason?, notes? }
    try {
      const response = await principalService.assignMentor(data);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to assign mentor. Please try again.';
      console.error('Assign mentor error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const removeMentorAssignment = createAsyncThunk(
  'principal/removeMentorAssignment',
  async ({ studentId }, { rejectWithValue }) => {
    try {
      const response = await principalService.removeMentor(studentId);
      return { studentId, ...response };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to remove mentor assignment. Please try again.';
      console.error('Remove mentor assignment error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchMentorStats = createAsyncThunk(
  'principal/fetchMentorStats',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.mentorStats;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await principalService.getMentorStats();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch mentor stats. Please try again.';
      console.error('Fetch mentor stats error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const bulkUnassignMentors = createAsyncThunk(
  'principal/bulkUnassignMentors',
  async ({ studentIds }, { rejectWithValue }) => {
    try {
      const response = await principalService.bulkUnassignMentors(studentIds);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to bulk unassign mentors. Please try again.';
      console.error('Bulk unassign mentors error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const autoAssignMentors = createAsyncThunk(
  'principal/autoAssignMentors',
  async (_, { rejectWithValue }) => {
    try {
      const response = await principalService.autoAssignMentors();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to auto-assign mentors. Please try again.';
      console.error('Auto-assign mentors error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Reset user password (student or staff)
// Uses credentialsService for centralized credential management
export const resetUserPassword = createAsyncThunk(
  'principal/resetUserPassword',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await credentialsService.resetUserPassword(userId);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to reset password. Please try again.';
      console.error('Reset password error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchMentorAssignments = createAsyncThunk(
  'principal/fetchMentorAssignments',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.mentorAssignments;

      // Normalize params for cache key
      const normalizedParams = {
        mentorId: params?.mentorId ?? '',
        search: params?.search ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.principal.lastFetched.mentorAssignmentsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await principalService.getMentorAssignments(params);
      // Response is an array from backend, wrap it properly
      const data = Array.isArray(response) ? response : (response?.data || []);
      return { data, _cacheKey: requestKey };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch mentor assignments. Please try again.';
      console.error('Fetch mentor assignments error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Force refresh thunks - bypass cache
export const forceRefreshDashboard = createAsyncThunk(
  'principal/forceRefreshDashboard',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await principalService.getDashboard();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to refresh dashboard. Please try again.';
      console.error('Force refresh dashboard error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const forceRefreshStudents = createAsyncThunk(
  'principal/forceRefreshStudents',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await principalService.getStudents(params);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to refresh students. Please try again.';
      console.error('Force refresh students error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const forceRefreshStaff = createAsyncThunk(
  'principal/forceRefreshStaff',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await principalService.getStaff(params);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to refresh staff. Please try again.';
      console.error('Force refresh staff error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Mentor Coverage thunk
export const fetchMentorCoverage = createAsyncThunk(
  'principal/fetchMentorCoverage',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.mentorCoverage;

      // Use METRICS cache duration - calculated analytics data
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await principalService.getMentorCoverage();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch mentor coverage. Please try again.';
      console.error('Fetch mentor coverage error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Compliance Metrics thunk
export const fetchComplianceMetrics = createAsyncThunk(
  'principal/fetchComplianceMetrics',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.complianceMetrics;

      // Use METRICS cache duration - calculated analytics data
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await principalService.getComplianceMetrics();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch compliance metrics. Please try again.';
      console.error('Fetch compliance metrics error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Alerts Enhanced thunk
export const fetchAlertsEnhanced = createAsyncThunk(
  'principal/fetchAlertsEnhanced',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.alertsEnhanced;

      // Use ALERTS cache duration - time-sensitive data
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await principalService.getAlertsEnhanced();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch enhanced alerts. Please try again.';
      console.error('Fetch alerts enhanced error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Joining Report Thunks
export const fetchJoiningLetterStats = createAsyncThunk(
  'principal/fetchJoiningLetterStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.joiningLetterStats;

      // Use ALERTS cache duration - time-sensitive pending items
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await principalService.getJoiningLetterStats();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch joining report stats. Please try again.';
      console.error('Fetch joining report stats error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchJoiningLetters = createAsyncThunk(
  'principal/fetchJoiningLetters',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.joiningLetters;

      // Normalize params for cache key
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.principal.lastFetched.joiningLettersKey;

      // Use ALERTS cache duration - time-sensitive pending items
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)
      ) {
        return { cached: true };
      }

      const response = await principalService.getJoiningLetters(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch joining reports. Please try again.';
      console.error('Fetch joining reports error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchJoiningLetterActivity = createAsyncThunk(
  'principal/fetchJoiningLetterActivity',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.joiningLetterActivity;
      const limit = params?.limit ?? 10;

      // Normalize params for cache key
      const normalizedParams = { limit };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.principal.lastFetched.joiningLetterActivityKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)
      ) {
        return { cached: true };
      }

      const response = await principalService.getJoiningLetterActivity(limit);
      return { data: response, _cacheKey: requestKey };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch joining report activity. Please try again.';
      console.error('Fetch joining report activity error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const verifyJoiningLetter = createAsyncThunk(
  'principal/verifyJoiningLetter',
  async ({ applicationId, data }, { rejectWithValue }) => {
    try {
      const response = await principalService.verifyJoiningLetter(applicationId, data);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to verify joining report. Please try again.';
      console.error('Verify joining report error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const rejectJoiningLetter = createAsyncThunk(
  'principal/rejectJoiningLetter',
  async ({ applicationId, remarks }, { rejectWithValue }) => {
    try {
      const response = await principalService.rejectJoiningLetter(applicationId, remarks);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to reject joining report. Please try again.';
      console.error('Reject joining report error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const fetchJoiningLettersByMentor = createAsyncThunk(
  'principal/fetchJoiningLettersByMentor',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.joiningLettersByMentor;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await principalService.getJoiningLettersByMentor();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch joining reports by mentor. Please try again.';
      console.error('Fetch joining reports by mentor error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Internship Stats Thunk (with company details)
export const fetchInternshipStats = createAsyncThunk(
  'principal/fetchInternshipStats',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.internshipStats;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.METRICS)) {
        return { cached: true };
      }

      const response = await principalService.getInternshipStats();
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch internship stats. Please try again.';
      console.error('Fetch internship stats error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Faculty Workload Thunk
export const fetchFacultyWorkload = createAsyncThunk(
  'principal/fetchFacultyWorkload',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principal.lastFetched.facultyWorkload;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await principalService.getFacultyProgress(params);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch faculty workload. Please try again.';
      console.error('Fetch faculty workload error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Fetch Student By ID for full details
export const fetchStudentById = createAsyncThunk(
  'principal/fetchStudentById',
  async (studentId, { rejectWithValue }) => {
    try {
      const response = await principalService.getStudentById(studentId);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch student details. Please try again.';
      console.error('Fetch student by ID error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

// Student Documents Thunks
export const fetchStudentDocuments = createAsyncThunk(
  'principal/fetchStudentDocuments',
  async (studentId, { rejectWithValue }) => {
    try {
      const response = await principalService.getStudentDocuments(studentId);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to fetch student documents. Please try again.';
      console.error('Fetch student documents error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const uploadStudentDocument = createAsyncThunk(
  'principal/uploadStudentDocument',
  async ({ studentId, file, type }, { rejectWithValue }) => {
    try {
      const response = await principalService.uploadStudentDocument(studentId, file, type);
      return response;
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to upload document. Please try again.';
      console.error('Upload student document error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

export const deleteStudentDocument = createAsyncThunk(
  'principal/deleteStudentDocument',
  async ({ studentId, documentId }, { rejectWithValue }) => {
    try {
      const response = await principalService.deleteStudentDocument(studentId, documentId);
      return { documentId, ...response };
    } catch (error) {
      const errorMessage = error.response?.data?.message ||
                          error.message ||
                          'Failed to delete document. Please try again.';
      console.error('Delete student document error:', error);
      return rejectWithValue(errorMessage);
    }
  }
);

const principalSlice = createSlice({
  name: 'principal',
  initialState,
  reducers: {
    // Selection reducers
    setSelectedStudent: (state, action) => {
      state.students.selected = action.payload;
    },
    setSelectedStaff: (state, action) => {
      state.staff.selected = action.payload;
    },
    clearSelectedStudent: (state) => {
      state.students.selected = null;
    },
    clearSelectedStaff: (state) => {
      state.staff.selected = null;
    },

    // Error clearing
    clearPrincipalError: (state) => {
      state.dashboard.error = null;
      state.students.error = null;
      state.staff.error = null;
      state.mentors.error = null;
      // batches and departments errors handled by lookupSlice
    },

    // Cache invalidation
    markAllDataStale: (state) => {
      state.lastFetched.dashboard = 0;
      state.lastFetched.students = 0;
      state.lastFetched.studentsKey = null;
      state.lastFetched.staff = 0;
      state.lastFetched.staffKey = null;
      state.lastFetched.mentors = 0;
      // batches and departments cache handled by lookupSlice
      state.lastFetched.mentorAssignments = 0;
      state.lastFetched.mentorAssignmentsKey = null;
      state.lastFetched.joiningLetterActivity = 0;
      state.lastFetched.joiningLetterActivityKey = null;
    },

    // Reset slice
    resetPrincipalSlice: () => initialState,

    // Optimistic update reducers for students
    optimisticallyAddStudent: (state, action) => {
      const tempStudent = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.students.list.unshift(tempStudent);
    },
    optimisticallyUpdateStudent: (state, action) => {
      const { id, data } = action.payload;
      const index = state.students.list.findIndex(s => s.id === id);
      if (index !== -1) {
        state.students.list[index] = {
          ...state.students.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeleteStudent: (state, action) => {
      state.students.list = state.students.list.filter(s => s.id !== action.payload);
    },
    optimisticallyToggleStudentStatus: (state, action) => {
      const studentId = action.payload;
      const index = state.students.list.findIndex(s => s.id === studentId);
      if (index !== -1) {
        const student = state.students.list[index];
        // Status can be on user.active or directly on student
        const currentStatus = student.user?.active ?? student.active ?? true;
        state.students.list[index] = {
          ...student,
          user: student.user ? { ...student.user, active: !currentStatus } : undefined,
          active: !currentStatus,
          _isOptimistic: true,
        };
      }
    },
    rollbackStudentOperation: (state, action) => {
      if (action.payload?.list) {
        state.students.list = action.payload.list;
      }
    },

    // Optimistic update reducers for staff
    optimisticallyAddStaff: (state, action) => {
      const tempStaff = {
        ...action.payload,
        id: `temp_${Date.now()}`,
        _isOptimistic: true,
      };
      state.staff.list.unshift(tempStaff);
    },
    optimisticallyUpdateStaff: (state, action) => {
      const { id, data } = action.payload;
      const index = state.staff.list.findIndex(s => s.id === id);
      if (index !== -1) {
        state.staff.list[index] = {
          ...state.staff.list[index],
          ...data,
          _isOptimistic: true,
        };
      }
    },
    optimisticallyDeleteStaff: (state, action) => {
      state.staff.list = state.staff.list.filter(s => s.id !== action.payload);
    },
    rollbackStaffOperation: (state, action) => {
      if (action.payload?.list) {
        state.staff.list = action.payload.list;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchPrincipalDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchPrincipalDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchPrincipalDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Students
      .addCase(fetchStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(fetchStudents.fulfilled, (state, action) => {
        state.students.loading = false;
        if (!action.payload.cached) {
          state.students.list = action.payload.data || action.payload;
          // Extract pagination from root level of response
          state.students.pagination = {
            total: action.payload.total || 0,
            page: action.payload.page || 1,
            limit: action.payload.limit || 10,
            totalPages: action.payload.totalPages || 1,
          };
          state.lastFetched.students = Date.now();
          state.lastFetched.studentsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })
      .addCase(createStudent.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(createStudent.fulfilled, (state, action) => {
        state.students.loading = false;
        // Replace optimistic entry with real data
        state.students.list = state.students.list.filter(s => !s._isOptimistic);
        // Only add if not already in list (avoid duplicates)
        const exists = state.students.list.some(s => s.id === action.payload.id);
        if (!exists) {
          state.students.list.unshift(action.payload);
        }
        state.lastFetched.students = Date.now();
      })
      .addCase(createStudent.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(updateStudent.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        state.students.loading = false;
        const updatedStudent = action.payload;
        if (updatedStudent?.id) {
          // Replace optimistic entry with real data
          state.students.list = state.students.list.map(s =>
            s.id === updatedStudent.id ? { ...updatedStudent, _isOptimistic: undefined } : s
          );
        }
        state.lastFetched.students = null; // Invalidate cache to trigger refresh
        state.lastFetched.studentsKey = null;
      })
      .addCase(updateStudent.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(deleteStudent.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(deleteStudent.fulfilled, (state, action) => {
        state.students.loading = false;
        // Optimistic delete already removed it, just update metadata
        state.lastFetched.students = null; // Invalidate cache to trigger refresh
        state.lastFetched.studentsKey = null;
      })
      .addCase(deleteStudent.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
        // Rollback is handled in the thunk
      })
      // Toggle Student Status
      .addCase(toggleStudentStatus.pending, (state) => {
        state.students.error = null;
      })
      .addCase(toggleStudentStatus.fulfilled, (state, action) => {
        // Update student status with server response
        const { studentId, active } = action.payload;
        const index = state.students.list.findIndex(s => s.id === studentId);
        if (index !== -1) {
          const student = state.students.list[index];
          state.students.list[index] = {
            ...student,
            user: student.user ? { ...student.user, active } : undefined,
            active,
            _isOptimistic: undefined,
          };
        }
        // Invalidate related caches
        state.lastFetched.mentorAssignments = null;
        state.lastFetched.mentorAssignmentsKey = null;
        state.lastFetched.mentorStats = null;
      })
      .addCase(toggleStudentStatus.rejected, (state, action) => {
        state.students.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(bulkUploadStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(bulkUploadStudents.fulfilled, (state) => {
        state.students.loading = false;
        // Invalidate cache to trigger refresh
        state.lastFetched.students = null;
        state.lastFetched.studentsKey = null;
      })
      .addCase(bulkUploadStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })
      .addCase(bulkUploadStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(bulkUploadStaff.fulfilled, (state) => {
        state.staff.loading = false;
        // Invalidate cache to trigger refresh
        state.lastFetched.staff = null;
        state.lastFetched.staffKey = null;
      })
      .addCase(bulkUploadStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
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
          // Extract pagination from root level of response
          state.staff.pagination = {
            total: action.payload.total || 0,
            page: action.payload.page || 1,
            limit: action.payload.limit || 10,
            totalPages: action.payload.totalPages || 1,
          };
          state.lastFetched.staff = Date.now();
          state.lastFetched.staffKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })
      .addCase(createStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(createStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        // Replace optimistic entry with real data
        state.staff.list = state.staff.list.filter(s => !s._isOptimistic);
        // Only add if not already in list (avoid duplicates)
        const exists = state.staff.list.some(s => s.id === action.payload.id);
        if (!exists) {
          state.staff.list.unshift(action.payload);
        }
        state.lastFetched.staff = Date.now();
      })
      .addCase(createStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(updateStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(updateStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        const updatedStaff = action.payload;
        if (updatedStaff?.id) {
          // Replace optimistic entry with real data
          state.staff.list = state.staff.list.map(s =>
            s.id === updatedStaff.id ? { ...updatedStaff, _isOptimistic: undefined } : s
          );
        }
        state.lastFetched.staff = null; // Invalidate cache to trigger refresh
        state.lastFetched.staffKey = null;
      })
      .addCase(updateStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(deleteStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(deleteStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        // Optimistic delete already removed it, just update metadata
        state.lastFetched.staff = null; // Invalidate cache to trigger refresh
        state.lastFetched.staffKey = null;
      })
      .addCase(deleteStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
        // Rollback is handled in the thunk
      })
      .addCase(toggleStaffStatus.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(toggleStaffStatus.fulfilled, (state, action) => {
        state.staff.loading = false;
        // Update the staff member's active status in the list
        const staffIndex = state.staff.list.findIndex(s => s.id === action.payload.id);
        if (staffIndex !== -1) {
          state.staff.list[staffIndex].active = action.payload.active;
        }
        // Invalidate cache to trigger refresh
        state.lastFetched.staff = null;
        state.lastFetched.staffKey = null;
      })
      .addCase(toggleStaffStatus.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })

      // Mentors
      .addCase(fetchMentors.pending, (state) => {
        state.mentors.loading = true;
        state.mentors.error = null;
      })
      .addCase(fetchMentors.fulfilled, (state, action) => {
        state.mentors.loading = false;
        if (!action.payload.cached) {
          state.mentors.list = action.payload.data || action.payload || [];
          state.lastFetched.mentors = Date.now();
        }
      })
      .addCase(fetchMentors.rejected, (state, action) => {
        state.mentors.loading = false;
        state.mentors.error = action.payload;
      })
      .addCase(assignMentor.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(assignMentor.fulfilled, (state, action) => {
        state.students.loading = false;
        // Optimistic update: Add new assignments to state
        const newAssignments = Array.isArray(action.payload) ? action.payload : [action.payload];
        const newStudentIds = newAssignments.map(a => a.studentId);
        // Remove old assignments for these students (reassignment case)
        state.mentorAssignments = state.mentorAssignments.filter(
          a => !newStudentIds.includes(a.studentId)
        );
        // Add new assignments
        state.mentorAssignments = [...state.mentorAssignments, ...newAssignments];
        // Keep cache valid - no need to refetch
        state.lastFetched.mentorAssignments = Date.now();
      })
      .addCase(assignMentor.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })
      .addCase(removeMentorAssignment.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(removeMentorAssignment.fulfilled, (state, action) => {
        state.students.loading = false;
        // Optimistic update: Remove from mentorAssignments
        state.mentorAssignments = state.mentorAssignments.filter(
          a => a.studentId !== action.payload.studentId
        );
        // Keep cache valid - no need to refetch
        state.lastFetched.mentorAssignments = Date.now();
      })
      .addCase(removeMentorAssignment.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      // Mentor Stats
      .addCase(fetchMentorStats.pending, (state) => {
        state.mentorStats.loading = true;
        state.mentorStats.error = null;
      })
      .addCase(fetchMentorStats.fulfilled, (state, action) => {
        state.mentorStats.loading = false;
        if (!action.payload.cached) {
          state.mentorStats.data = action.payload;
          state.lastFetched.mentorStats = Date.now();
        }
      })
      .addCase(fetchMentorStats.rejected, (state, action) => {
        state.mentorStats.loading = false;
        state.mentorStats.error = action.payload;
      })

      // Bulk Unassign Mentors
      .addCase(bulkUnassignMentors.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(bulkUnassignMentors.fulfilled, (state, action) => {
        state.students.loading = false;
        // Optimistic update: Remove unassigned students from mentorAssignments
        const unassignedStudentIds = action.meta.arg.studentIds || [];
        state.mentorAssignments = state.mentorAssignments.filter(
          a => !unassignedStudentIds.includes(a.studentId)
        );
        // Keep cache valid - no need to refetch
        state.lastFetched.mentorAssignments = Date.now();
      })
      .addCase(bulkUnassignMentors.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      // Auto Assign Mentors
      .addCase(autoAssignMentors.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(autoAssignMentors.fulfilled, (state) => {
        state.students.loading = false;
        // Invalidate cache to trigger refresh
        state.lastFetched.students = null;
        state.lastFetched.studentsKey = null;
        state.lastFetched.mentorAssignments = null;
        state.lastFetched.mentorAssignmentsKey = null;
        state.lastFetched.mentorStats = null;
      })
      .addCase(autoAssignMentors.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      // Mentor Assignments
      .addCase(fetchMentorAssignments.pending, (state) => {
        state.mentors.loading = true;
        state.mentors.error = null;
      })
      .addCase(fetchMentorAssignments.fulfilled, (state, action) => {
        state.mentors.loading = false;
        if (!action.payload.cached) {
          state.mentorAssignments = action.payload.data || action.payload || [];
          state.lastFetched.mentorAssignments = Date.now();
          state.lastFetched.mentorAssignmentsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchMentorAssignments.rejected, (state, action) => {
        state.mentors.loading = false;
        state.mentors.error = action.payload;
      })

      // Note: Batches and Departments extraReducers removed
      // These are now handled by lookupSlice

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
      .addCase(forceRefreshStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(forceRefreshStudents.fulfilled, (state, action) => {
        state.students.loading = false;
        state.students.list = action.payload.data || action.payload;
        state.students.pagination = {
          total: action.payload.total || 0,
          page: action.payload.page || 1,
          limit: action.payload.limit || 10,
          totalPages: action.payload.totalPages || 1,
        };
        state.lastFetched.students = Date.now();
        state.lastFetched.studentsKey = null; // Clear cache key on force refresh
      })
      .addCase(forceRefreshStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })
      .addCase(forceRefreshStaff.pending, (state) => {
        state.staff.loading = true;
        state.staff.error = null;
      })
      .addCase(forceRefreshStaff.fulfilled, (state, action) => {
        state.staff.loading = false;
        state.staff.list = action.payload.data || action.payload;
        state.staff.pagination = {
          total: action.payload.total || 0,
          page: action.payload.page || 1,
          limit: action.payload.limit || 10,
          totalPages: action.payload.totalPages || 1,
        };
        state.lastFetched.staff = Date.now();
        state.lastFetched.staffKey = null; // Clear cache key on force refresh
      })
      .addCase(forceRefreshStaff.rejected, (state, action) => {
        state.staff.loading = false;
        state.staff.error = action.payload;
      })

      // Mentor Coverage
      .addCase(fetchMentorCoverage.pending, (state) => {
        state.mentorCoverage.loading = true;
        state.mentorCoverage.error = null;
      })
      .addCase(fetchMentorCoverage.fulfilled, (state, action) => {
        state.mentorCoverage.loading = false;
        if (!action.payload.cached) {
          state.mentorCoverage.data = action.payload;
          state.lastFetched.mentorCoverage = Date.now();
        }
      })
      .addCase(fetchMentorCoverage.rejected, (state, action) => {
        state.mentorCoverage.loading = false;
        state.mentorCoverage.error = action.payload;
      })

      // Compliance Metrics
      .addCase(fetchComplianceMetrics.pending, (state) => {
        state.complianceMetrics.loading = true;
        state.complianceMetrics.error = null;
      })
      .addCase(fetchComplianceMetrics.fulfilled, (state, action) => {
        state.complianceMetrics.loading = false;
        if (!action.payload.cached) {
          state.complianceMetrics.data = action.payload;
          state.lastFetched.complianceMetrics = Date.now();
        }
      })
      .addCase(fetchComplianceMetrics.rejected, (state, action) => {
        state.complianceMetrics.loading = false;
        state.complianceMetrics.error = action.payload;
      })

      // Alerts Enhanced
      .addCase(fetchAlertsEnhanced.pending, (state) => {
        state.alertsEnhanced.loading = true;
        state.alertsEnhanced.error = null;
      })
      .addCase(fetchAlertsEnhanced.fulfilled, (state, action) => {
        state.alertsEnhanced.loading = false;
        if (!action.payload.cached) {
          state.alertsEnhanced.data = action.payload;
          state.lastFetched.alertsEnhanced = Date.now();
        }
      })
      .addCase(fetchAlertsEnhanced.rejected, (state, action) => {
        state.alertsEnhanced.loading = false;
        state.alertsEnhanced.error = action.payload;
      })
      // Joining Report Stats
      .addCase(fetchJoiningLetterStats.pending, (state) => {
        state.joiningLetters.statsLoading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLetterStats.fulfilled, (state, action) => {
        state.joiningLetters.statsLoading = false;
        if (!action.payload.cached) {
          state.joiningLetters.stats = action.payload;
          state.lastFetched.joiningLetterStats = Date.now();
        }
      })
      .addCase(fetchJoiningLetterStats.rejected, (state, action) => {
        state.joiningLetters.statsLoading = false;
        state.joiningLetters.error = action.payload;
      })
      // Joining Report List
      .addCase(fetchJoiningLetters.pending, (state) => {
        state.joiningLetters.loading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLetters.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        if (!action.payload.cached) {
          state.joiningLetters.list = action.payload.data || [];
          state.joiningLetters.pagination = action.payload.pagination;
          state.lastFetched.joiningLetters = Date.now();
          state.lastFetched.joiningLettersKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchJoiningLetters.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })
      // Joining Report Activity
      .addCase(fetchJoiningLetterActivity.pending, (state) => {
        state.joiningLetters.activityLoading = true;
      })
      .addCase(fetchJoiningLetterActivity.fulfilled, (state, action) => {
        state.joiningLetters.activityLoading = false;
        if (!action.payload.cached) {
          state.joiningLetters.activity = action.payload.data || action.payload;
          state.lastFetched.joiningLetterActivity = Date.now();
          state.lastFetched.joiningLetterActivityKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchJoiningLetterActivity.rejected, (state, action) => {
        state.joiningLetters.activityLoading = false;
      })
      // Verify Joining Report
      .addCase(verifyJoiningLetter.pending, (state) => {
        state.joiningLetters.actionLoading = true;
        state.joiningLetters.actionError = null;
      })
      .addCase(verifyJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.actionLoading = false;
        // Update the list item if it exists
        const index = state.joiningLetters.list.findIndex(
          item => item.applicationId === action.payload.data?.applicationId
        );
        if (index !== -1) {
          state.joiningLetters.list[index].status = 'VERIFIED';
        }
        // Invalidate stats cache
        state.lastFetched.joiningLetterStats = null;
      })
      .addCase(verifyJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.actionLoading = false;
        state.joiningLetters.actionError = action.payload || 'Failed to verify joining report';
      })
      // Reject Joining Report
      .addCase(rejectJoiningLetter.pending, (state) => {
        state.joiningLetters.actionLoading = true;
        state.joiningLetters.actionError = null;
      })
      .addCase(rejectJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.actionLoading = false;
        // Remove from list since letter is cleared
        state.joiningLetters.list = state.joiningLetters.list.filter(
          item => item.applicationId !== action.payload.data?.applicationId
        );
        // Invalidate stats cache
        state.lastFetched.joiningLetterStats = null;
      })
      .addCase(rejectJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.actionLoading = false;
        state.joiningLetters.actionError = action.payload || 'Failed to reject joining report';
      })
      // Joining Reports by Mentor
      .addCase(fetchJoiningLettersByMentor.pending, (state) => {
        state.joiningLetters.byMentorLoading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLettersByMentor.fulfilled, (state, action) => {
        state.joiningLetters.byMentorLoading = false;
        if (!action.payload.cached) {
          state.joiningLetters.byMentor = action.payload;
          state.lastFetched.joiningLettersByMentor = Date.now();
        }
      })
      .addCase(fetchJoiningLettersByMentor.rejected, (state, action) => {
        state.joiningLetters.byMentorLoading = false;
        state.joiningLetters.error = action.payload;
      })
      // Internship Stats (with company details)
      .addCase(fetchInternshipStats.pending, (state) => {
        state.internshipStats.loading = true;
        state.internshipStats.error = null;
      })
      .addCase(fetchInternshipStats.fulfilled, (state, action) => {
        state.internshipStats.loading = false;
        if (!action.payload.cached) {
          state.internshipStats.data = action.payload.data || action.payload;
          state.lastFetched.internshipStats = Date.now();
        }
      })
      .addCase(fetchInternshipStats.rejected, (state, action) => {
        state.internshipStats.loading = false;
        state.internshipStats.error = action.payload;
      })
      // Faculty Workload
      .addCase(fetchFacultyWorkload.pending, (state) => {
        state.facultyWorkload.loading = true;
        state.facultyWorkload.error = null;
      })
      .addCase(fetchFacultyWorkload.fulfilled, (state, action) => {
        state.facultyWorkload.loading = false;
        if (!action.payload.cached) {
          state.facultyWorkload.list = action.payload.faculty || action.payload.data || [];
          state.lastFetched.facultyWorkload = Date.now();
        }
      })
      .addCase(fetchFacultyWorkload.rejected, (state, action) => {
        state.facultyWorkload.loading = false;
        state.facultyWorkload.error = action.payload;
      });
  },
});

export const {
  // Selection
  setSelectedStudent,
  setSelectedStaff,
  clearSelectedStudent,
  clearSelectedStaff,
  // Error clearing
  clearPrincipalError,
  // Cache invalidation
  markAllDataStale,
  // Reset
  resetPrincipalSlice,
  // Student optimistic updates
  optimisticallyAddStudent,
  optimisticallyUpdateStudent,
  optimisticallyDeleteStudent,
  optimisticallyToggleStudentStatus,
  rollbackStudentOperation,
  // Staff optimistic updates
  optimisticallyAddStaff,
  optimisticallyUpdateStaff,
  optimisticallyDeleteStaff,
  rollbackStaffOperation,
} = principalSlice.actions;

// ============= SELECTORS =============

// Dashboard selectors
export const selectDashboardStats = (state) => state.principal.dashboard.stats;
export const selectDashboardLoading = (state) => state.principal.dashboard.loading;
export const selectDashboardError = (state) => state.principal.dashboard.error;

// Student selectors
export const selectStudents = (state) => state.principal.students.list;
export const selectStudentsPagination = (state) => state.principal.students.pagination;
export const selectStudentsLoading = (state) => state.principal.students.loading;
export const selectStudentsError = (state) => state.principal.students.error;
export const selectSelectedStudent = (state) => state.principal.students.selected;

// Staff selectors
export const selectStaff = (state) => state.principal.staff.list;
export const selectStaffPagination = (state) => state.principal.staff.pagination;
export const selectStaffLoading = (state) => state.principal.staff.loading;
export const selectStaffError = (state) => state.principal.staff.error;
export const selectSelectedStaff = (state) => state.principal.staff.selected;

// Mentor selectors
export const selectMentors = (state) => state.principal.mentors.list;
export const selectMentorsLoading = (state) => state.principal.mentors.loading;
export const selectMentorAssignments = (state) => state.principal.mentorAssignments;
export const selectMentorStats = (state) => state.principal.mentorStats.data;
export const selectMentorStatsLoading = (state) => state.principal.mentorStats.loading;

// Note: Batch and Department selectors have been removed
// Use useBatches() and useDepartments() hooks from shared/hooks/useLookup

// Last fetched selectors
export const selectLastFetched = (state) => state.principal.lastFetched;
export const selectMostRecentFetch = (state) => {
  const timestamps = Object.values(state.principal.lastFetched).filter(t => typeof t === 'number');
  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

// Combined loading selector
export const selectAnyLoading = (state) =>
  state.principal.dashboard.loading ||
  state.principal.students.loading ||
  state.principal.staff.loading ||
  state.principal.mentors.loading;

// Mentor Coverage selectors
export const selectMentorCoverage = (state) => state.principal.mentorCoverage.data;
export const selectMentorCoverageLoading = (state) => state.principal.mentorCoverage.loading;
export const selectMentorCoverageError = (state) => state.principal.mentorCoverage.error;

// Compliance Metrics selectors
export const selectComplianceMetrics = (state) => state.principal.complianceMetrics.data;
export const selectComplianceMetricsLoading = (state) => state.principal.complianceMetrics.loading;
export const selectComplianceMetricsError = (state) => state.principal.complianceMetrics.error;

// Alerts Enhanced selectors
export const selectAlertsEnhanced = (state) => state.principal.alertsEnhanced.data;
export const selectAlertsEnhancedLoading = (state) => state.principal.alertsEnhanced.loading;
export const selectAlertsEnhancedError = (state) => state.principal.alertsEnhanced.error;

// Joining Report selectors
export const selectJoiningLetterStats = (state) => state.principal.joiningLetters.stats;
export const selectJoiningLetterStatsLoading = (state) => state.principal.joiningLetters.statsLoading;
export const selectJoiningLetters = (state) => state.principal.joiningLetters.list;
export const selectJoiningLettersLoading = (state) => state.principal.joiningLetters.loading;
export const selectJoiningLettersPagination = (state) => state.principal.joiningLetters.pagination;
export const selectJoiningLetterActivity = (state) => state.principal.joiningLetters.activity;
export const selectJoiningLetterActivityLoading = (state) => state.principal.joiningLetters.activityLoading;
export const selectJoiningLettersError = (state) => state.principal.joiningLetters.error;
export const selectJoiningLettersByMentor = (state) => state.principal.joiningLetters.byMentor;
export const selectJoiningLettersByMentorLoading = (state) => state.principal.joiningLetters.byMentorLoading;

// Internship Stats selectors (with company details)
export const selectInternshipStats = (state) => state.principal.internshipStats.data;
export const selectInternshipStatsLoading = (state) => state.principal.internshipStats.loading;
export const selectInternshipStatsError = (state) => state.principal.internshipStats.error;

// Faculty Workload selectors
export const selectFacultyWorkload = (state) => state.principal.facultyWorkload.list;
export const selectFacultyWorkloadLoading = (state) => state.principal.facultyWorkload.loading;
export const selectFacultyWorkloadError = (state) => state.principal.facultyWorkload.error;

export default principalSlice.reducer;
