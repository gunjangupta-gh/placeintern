import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import facultyService from '../../../services/faculty.service';
import grievanceService from '../../../services/grievance.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  dashboard: {
    stats: null,
    recentActivities: [],
    upcomingVisits: [],
    loading: false,
    error: null,
  },
  monthlyStats: {
    data: null,
    loading: false,
    error: null,
  },
  students: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  visitLogs: {
    list: [],
    current: null,
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  monthlyReports: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    uploading: false,
    error: null,
    uploadError: null,
  },
  joiningLetters: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  profile: {
    data: null,
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    total: 0,
    page: 1,
    totalPages: 1,
    loading: false,
    error: null,
  },
  feedbackHistory: {
    list: [],
    total: 0,
    loading: false,
    error: null,
  },
  grievances: {
    list: [],
    escalationChain: null,
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    monthlyStats: null,
    students: null,
    studentsKey: null,
    visitLogs: null,
    visitLogsKey: null,
    visitLogsById: {}, // Cache per visit log ID
    studentProgressById: {}, // Cache per student ID
    monthlyReports: null,
    monthlyReportsKey: null,
    monthlyReportsDashboard: null,
    monthlyReportsDashboardKey: null,
    joiningLetters: null,
    joiningLettersKey: null,
    profile: null,
    applications: null,
    applicationsKey: null,
    feedbackHistory: null,
    feedbackHistoryKey: null,
    grievances: null,
  },
};

// Dashboard
export const fetchFacultyDashboard = createAsyncThunk(
  'faculty/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.dashboard;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await facultyService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

// Monthly Stats (uses monthly inclusion rules from backend)
export const fetchMonthlyStats = createAsyncThunk(
  'faculty/fetchMonthlyStats',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.monthlyStats;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await facultyService.getCurrentMonthStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly stats');
    }
  }
);

// Profile
export const fetchProfile = createAsyncThunk(
  'faculty/fetchProfile',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.profile;

      // Use PROFILE cache duration - profile rarely changes
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.PROFILE)) {
        return { cached: true };
      }

      const response = await facultyService.getProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

// Alias for backward compatibility
export const fetchMentor = fetchProfile;

// Students
export const fetchAssignedStudents = createAsyncThunk(
  'faculty/fetchAssignedStudents',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.students;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.studentsKey;

      // Use LISTS cache duration - users expect relatively fresh data
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getAssignedStudents(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch students');
    }
  }
);

export const fetchStudentProgress = createAsyncThunk(
  'faculty/fetchStudentProgress',
  async (params, { getState, rejectWithValue }) => {
    try {
      // Support both simple studentId and object with forceRefresh
      const studentId = typeof params === 'object' ? params.studentId : params;
      const forceRefresh = typeof params === 'object' ? params.forceRefresh : false;

      const state = getState();
      const lastFetched = state.faculty.lastFetched.studentProgressById[studentId];

      if (!forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true, studentId };
      }

      const response = await facultyService.getStudentProgress(studentId);
      return { ...response, _studentId: studentId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch student progress');
    }
  }
);

// Visit Logs
export const fetchVisitLogs = createAsyncThunk(
  'faculty/fetchVisitLogs',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.visitLogs;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        studentId: params?.studentId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.visitLogsKey;

      // Use LISTS cache duration - users expect relatively fresh data
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getVisitLogs(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit logs');
    }
  }
);

export const fetchVisitLogById = createAsyncThunk(
  'faculty/fetchVisitLogById',
  async (params, { getState, rejectWithValue }) => {
    try {
      // Support both simple id and object with forceRefresh
      const id = typeof params === 'object' ? params.id : params;
      const forceRefresh = typeof params === 'object' ? params.forceRefresh : false;

      const state = getState();
      const lastFetched = state.faculty.lastFetched.visitLogsById[id];

      if (!forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true, id };
      }

      const response = await facultyService.getVisitLogById(id);
      return { ...response, _visitLogId: id };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch visit log');
    }
  }
);

export const createVisitLog = createAsyncThunk(
  'faculty/createVisitLog',
  async (visitLogData, { rejectWithValue }) => {
    try {
      const response = await facultyService.createVisitLog(visitLogData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create visit log');
    }
  }
);

export const updateVisitLog = createAsyncThunk(
  'faculty/updateVisitLog',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateVisitLog(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update visit log');
    }
  }
);

export const deleteVisitLog = createAsyncThunk(
  'faculty/deleteVisitLog',
  async (id, { rejectWithValue }) => {
    try {
      const response = await facultyService.deleteVisitLog(id);
      return { id, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete visit log');
    }
  }
);

export const uploadVisitDocument = createAsyncThunk(
  'faculty/uploadVisitDocument',
  async ({ file, type }, { rejectWithValue }) => {
    try {
      const response = await facultyService.uploadVisitDocument(file, type);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload visit document');
    }
  }
);

// Monthly Reports
export const fetchMonthlyReports = createAsyncThunk(
  'faculty/fetchMonthlyReports',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.monthlyReports;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
        studentId: params?.studentId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.monthlyReportsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getMonthlyReports(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch monthly reports');
    }
  }
);

export const fetchMonthlyReportsForDashboard = createAsyncThunk(
  'faculty/fetchMonthlyReportsForDashboard',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.monthlyReportsDashboard;

      const normalizedParams = {
        page: 1,
        limit: 1000,
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.monthlyReportsDashboardKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getMonthlyReports(normalizedParams);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard monthly reports');
    }
  }
);

// Removed: Auto-approval implemented - reviewMonthlyReport no longer needed
// export const reviewMonthlyReport = createAsyncThunk(
//   'faculty/reviewMonthlyReport',
//   async ({ reportId, reviewData }, { rejectWithValue }) => {
//     try {
//       const response = await facultyService.reviewMonthlyReport(reportId, reviewData);
//       return response;
//     } catch (error) {
//       return rejectWithValue(error.response?.data?.message || 'Failed to review report');
//     }
//   }
// );

// Self-Identified Approvals
export const fetchApplications = createAsyncThunk(
  'faculty/fetchApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.applications;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.applicationsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getSelfIdentifiedApprovals(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

export const approveApplication = createAsyncThunk(
  'faculty/approveApplication',
  async ({ applicationId, data = {} }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateSelfIdentifiedApproval(applicationId, {
        ...data,
        status: 'APPROVED',
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve application');
    }
  }
);

export const rejectApplication = createAsyncThunk(
  'faculty/rejectApplication',
  async ({ applicationId, reason }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateSelfIdentifiedApproval(applicationId, {
        status: 'REJECTED',
        reviewRemarks: reason,
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject application');
    }
  }
);

// Feedback
export const submitFeedback = createAsyncThunk(
  'faculty/submitFeedback',
  async ({ applicationId, feedbackData }, { rejectWithValue }) => {
    try {
      const response = await facultyService.submitMonthlyFeedback({
        applicationId,
        ...feedbackData,
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit feedback');
    }
  }
);

export const fetchFeedbackHistory = createAsyncThunk(
  'faculty/fetchFeedbackHistory',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.feedbackHistory;

      // Cache must be param-aware; otherwise pagination/search may show stale data.
      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 10,
        search: params?.search ?? '',
        studentId: params?.studentId ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.feedbackHistoryKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getFeedbackHistory(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback history');
    }
  }
);

// ==================== Joining Report ====================

export const fetchJoiningLetters = createAsyncThunk(
  'faculty/fetchJoiningLetters',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.joiningLetters;

      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 100,
        status: params?.status ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.faculty.lastFetched.joiningLettersKey;

      // Use ALERTS cache duration - time-sensitive pending items
      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)
      ) {
        return { cached: true };
      }

      const response = await facultyService.getJoiningLetters(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch joining reports');
    }
  }
);

export const verifyJoiningLetter = createAsyncThunk(
  'faculty/verifyJoiningLetter',
  async ({ letterId, remarks }, { rejectWithValue }) => {
    try {
      const response = await facultyService.verifyJoiningLetter(letterId, { remarks });
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to verify joining report');
    }
  }
);

export const rejectJoiningLetter = createAsyncThunk(
  'faculty/rejectJoiningLetter',
  async ({ letterId, reason }, { rejectWithValue }) => {
    try {
      const response = await facultyService.rejectJoiningLetter(letterId, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject joining report');
    }
  }
);

export const deleteJoiningLetter = createAsyncThunk(
  'faculty/deleteJoiningLetter',
  async (letterId, { rejectWithValue }) => {
    try {
      const response = await facultyService.deleteJoiningLetter(letterId);
      return { id: letterId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete joining report');
    }
  }
);

export const uploadJoiningLetter = createAsyncThunk(
  'faculty/uploadJoiningLetter',
  async ({ applicationId, file }, { rejectWithValue }) => {
    try {
      const response = await facultyService.uploadJoiningLetter(applicationId, file);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload joining report');
    }
  }
);

// ==================== Monthly Report Actions ====================
// Removed: Auto-approval implemented - approveMonthlyReport, rejectMonthlyReport, deleteMonthlyReport no longer needed

// export const approveMonthlyReport = createAsyncThunk(
//   'faculty/approveMonthlyReport',
//   async ({ reportId, remarks }, { rejectWithValue }) => {
//     try {
//       const response = await facultyService.approveMonthlyReport(reportId, remarks);
//       return response;
//     } catch (error) {
//       return rejectWithValue(error.response?.data?.message || 'Failed to approve report');
//     }
//   }
// );

// export const rejectMonthlyReport = createAsyncThunk(
//   'faculty/rejectMonthlyReport',
//   async ({ reportId, reason }, { rejectWithValue }) => {
//     try {
//       const response = await facultyService.rejectMonthlyReport(reportId, reason);
//       return response;
//     } catch (error) {
//       return rejectWithValue(error.response?.data?.message || 'Failed to reject report');
//     }
//   }
// );

// Monthly Report Actions (enabled)
export const approveMonthlyReport = createAsyncThunk(
  'faculty/approveMonthlyReport',
  async ({ reportId, remarks }, { rejectWithValue }) => {
    try {
      const response = await facultyService.approveMonthlyReport(reportId, remarks);
      return { id: reportId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to approve report');
    }
  }
);

export const rejectMonthlyReport = createAsyncThunk(
  'faculty/rejectMonthlyReport',
  async ({ reportId, reason }, { rejectWithValue }) => {
    try {
      const response = await facultyService.rejectMonthlyReport(reportId, reason);
      return { id: reportId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject report');
    }
  }
);

export const deleteMonthlyReport = createAsyncThunk(
  'faculty/deleteMonthlyReport',
  async (reportId, { rejectWithValue }) => {
    try {
      const response = await facultyService.deleteMonthlyReport(reportId);
      return { id: reportId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete report');
    }
  }
);

export const uploadMonthlyReport = createAsyncThunk(
  'faculty/uploadMonthlyReport',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await facultyService.uploadMonthlyReport(formData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload report');
    }
  }
);

export const downloadMonthlyReport = createAsyncThunk(
  'faculty/downloadMonthlyReport',
  async (reportId, { rejectWithValue }) => {
    try {
      const blob = await facultyService.downloadMonthlyReport(reportId);
      return blob;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to download report');
    }
  }
);

export const viewMonthlyReport = createAsyncThunk(
  'faculty/viewMonthlyReport',
  async (reportId, { rejectWithValue }) => {
    try {
      const response = await facultyService.viewMonthlyReport(reportId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get report view URL');
    }
  }
);

// Internship Actions
export const updateInternship = createAsyncThunk(
  'faculty/updateInternship',
  async ({ internshipId, data }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateInternship(internshipId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update internship');
    }
  }
);

export const deleteInternship = createAsyncThunk(
  'faculty/deleteInternship',
  async (internshipId, { rejectWithValue }) => {
    try {
      const response = await facultyService.deleteInternship(internshipId);
      return { id: internshipId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete internship');
    }
  }
);

// Assignment Actions
export const createAssignment = createAsyncThunk(
  'faculty/createAssignment',
  async (assignmentData, { rejectWithValue }) => {
    try {
      const response = await facultyService.createAssignment(assignmentData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create assignment');
    }
  }
);

// ==================== Student Management Actions ====================

export const updateStudent = createAsyncThunk(
  'faculty/updateStudent',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await facultyService.updateStudent(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update student');
    }
  }
);

export const uploadStudentDocument = createAsyncThunk(
  'faculty/uploadStudentDocument',
  async ({ studentId, file, type }, { rejectWithValue }) => {
    try {
      const response = await facultyService.uploadStudentDocument(studentId, file, type);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload document');
    }
  }
);

export const toggleStudentStatus = createAsyncThunk(
  'faculty/toggleStudentStatus',
  async ({ studentId }, { rejectWithValue, dispatch, getState }) => {
    // Save current state for rollback
    const previousList = [...getState().faculty.students.list];

    try {
      // Optimistic update - toggle status immediately
      dispatch(facultySlice.actions.optimisticallyToggleStudentStatus(studentId));

      // Make API call
      const response = await facultyService.toggleStudentStatus(studentId);
      return { studentId, ...response };
    } catch (error) {
      // Rollback on error
      dispatch(facultySlice.actions.rollbackStudentOperation({ list: previousList }));
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle student status');
    }
  }
);

// Faculty Grievances
export const fetchFacultyGrievances = createAsyncThunk(
  'faculty/fetchFacultyGrievances',
  async (facultyId, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.faculty.lastFetched.grievances;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await grievanceService.getByFaculty(facultyId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch grievances');
    }
  }
);

export const fetchGrievanceEscalationChain = createAsyncThunk(
  'faculty/fetchGrievanceEscalationChain',
  async (grievanceId, { rejectWithValue }) => {
    try {
      const response = await grievanceService.getEscalationChain(grievanceId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch escalation chain');
    }
  }
);

export const respondToGrievance = createAsyncThunk(
  'faculty/respondToGrievance',
  async ({ grievanceId, response, status }, { rejectWithValue }) => {
    try {
      const result = await grievanceService.respond(grievanceId, response, status);
      return result;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to respond to grievance');
    }
  }
);

export const escalateGrievance = createAsyncThunk(
  'faculty/escalateGrievance',
  async ({ grievanceId, reason }, { rejectWithValue }) => {
    try {
      const response = await grievanceService.escalate(grievanceId, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to escalate grievance');
    }
  }
);

export const rejectGrievance = createAsyncThunk(
  'faculty/rejectGrievance',
  async ({ grievanceId, reason }, { rejectWithValue }) => {
    try {
      const response = await grievanceService.reject(grievanceId, reason);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to reject grievance');
    }
  }
);

export const updateGrievanceStatus = createAsyncThunk(
  'faculty/updateGrievanceStatus',
  async ({ grievanceId, status }, { rejectWithValue }) => {
    try {
      const response = await grievanceService.updateStatus(grievanceId, status);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update grievance status');
    }
  }
);

// Backward compatibility aliases
export const fetchGrievances = fetchFeedbackHistory;
export const resolveGrievance = submitFeedback;
export const submitMonthlyFeedback = submitFeedback;

const facultySlice = createSlice({
  name: 'faculty',
  initialState,
  reducers: {
    clearError: (state) => {
      state.dashboard.error = null;
      state.students.error = null;
      state.visitLogs.error = null;
      state.monthlyReports.error = null;
      state.joiningLetters.error = null;
      state.applications.error = null;
      state.feedbackHistory.error = null;
    },
    invalidateCache: (state) => {
      state.lastFetched = {
        dashboard: null,
        students: null,
        studentsKey: null,
        visitLogs: null,
        visitLogsKey: null,
        visitLogsById: {}, // Reset ID-based cache
        studentProgressById: {}, // Reset ID-based cache
        monthlyReports: null,
        monthlyReportsKey: null,
        monthlyReportsDashboard: null,
        monthlyReportsDashboardKey: null,
        joiningLetters: null,
        joiningLettersKey: null,
        profile: null,
        applications: null,
        applicationsKey: null,
        feedbackHistory: null,
        feedbackHistoryKey: null,
      };
    },
    // Optimistic update: Remove application from list immediately
    optimisticApproveApplication: (state, action) => {
      const { applicationId } = action.payload;
      state.applications.list = state.applications.list.filter(app => app.id !== applicationId);
      state.applications.total = Math.max(0, state.applications.total - 1);
    },
    // Optimistic update: Remove application from list immediately
    optimisticRejectApplication: (state, action) => {
      const { applicationId } = action.payload;
      state.applications.list = state.applications.list.filter(app => app.id !== applicationId);
      state.applications.total = Math.max(0, state.applications.total - 1);
    },
    // Rollback: Restore application to list on error
    rollbackApplicationUpdate: (state, action) => {
      const { application } = action.payload;
      // Add back the application if it's not already in the list
      const exists = state.applications.list.some(app => app.id === application.id);
      if (!exists) {
        state.applications.list = [application, ...state.applications.list];
        state.applications.total += 1;
      }
    },
    // Optimistic update: Update joining report status immediately
    optimisticallyUpdateJoiningLetter: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.joiningLetters.list.findIndex(letter => letter.id === id);
      if (index !== -1) {
        state.joiningLetters.list[index] = {
          ...state.joiningLetters.list[index],
          ...updates,
          _isOptimistic: true,
        };
      }
    },
    // Rollback: Restore joining report state on error
    rollbackJoiningLetterOperation: (state, action) => {
      const { joiningLetters } = action.payload;
      state.joiningLetters.list = joiningLetters.list;
    },
    // Optimistic update: Delete visit log from list immediately
    optimisticallyDeleteVisitLog: (state, action) => {
      const id = action.payload;
      state.visitLogs.list = state.visitLogs.list.filter(log => log.id !== id);
      state.visitLogs.total = Math.max(0, state.visitLogs.total - 1);
    },
    // Rollback: Restore visit logs state on error
    rollbackVisitLogOperation: (state, action) => {
      const { list, total } = action.payload;
      state.visitLogs.list = list;
      state.visitLogs.total = total;
    },
    // Optimistic update: Update student in list immediately
    optimisticallyUpdateStudent: (state, action) => {
      const { studentId, updates } = action.payload;
      const index = state.students.list.findIndex(s => {
        const stud = s.student || s;
        return stud.id === studentId || s.id === studentId;
      });
      if (index !== -1) {
        const student = state.students.list[index];
        const actualStudent = student.student || student;
        // Update the student data
        if (student.student) {
          state.students.list[index] = {
            ...student,
            student: { ...actualStudent, ...updates },
          };
        } else {
          state.students.list[index] = { ...student, ...updates };
        }
      }
    },
    // Optimistic update: Toggle student status immediately
    // Uses User SOT pattern - active status is stored on user object
    // Auto-toggles based on current status (doesn't require isActive parameter)
    optimisticallyToggleStudentStatus: (state, action) => {
      const studentId = action.payload;
      const index = state.students.list.findIndex(s => {
        const stud = s.student || s;
        return stud.id === studentId || s.id === studentId;
      });
      if (index !== -1) {
        const student = state.students.list[index];
        if (student.student) {
          // Nested structure: get current status from student.user.active or student.isActive
          const currentStatus = student.student.user?.active ?? student.student.isActive ?? true;
          const newStatus = !currentStatus;
          // Update both student.isActive and student.user.active for compatibility
          state.students.list[index] = {
            ...student,
            student: {
              ...student.student,
              isActive: newStatus,
              user: student.student.user ? { ...student.student.user, active: newStatus } : undefined,
            },
          };
        } else {
          // Flat structure: get current status from user.active or isActive
          const currentStatus = student.user?.active ?? student.isActive ?? true;
          const newStatus = !currentStatus;
          // Update both isActive and user.active for compatibility
          state.students.list[index] = {
            ...student,
            isActive: newStatus,
            user: student.user ? { ...student.user, active: newStatus } : undefined,
          };
        }
      }
    },
    // Rollback: Restore students state on error
    rollbackStudentOperation: (state, action) => {
      const { list } = action.payload;
      state.students.list = list;
    },
    // Optimistic update: Add report to list immediately
    optimisticallyAddReport: (state, action) => {
      const { report } = action.payload;
      // Add to beginning of list with optimistic flag
      state.monthlyReports.list.unshift({
        ...report,
        _isOptimistic: true,
      });
      state.monthlyReports.total += 1;
    },
    // Rollback: Restore monthly reports state on error
    rollbackReportOperation: (state, action) => {
      const { list, total } = action.payload;
      state.monthlyReports.list = list;
      state.monthlyReports.total = total;
    },
    // Confirm optimistic report (replace with actual data)
    confirmOptimisticReport: (state, action) => {
      const { tempId, actualReport } = action.payload;
      const index = state.monthlyReports.list.findIndex(r => r._tempId === tempId);
      if (index !== -1) {
        state.monthlyReports.list[index] = actualReport;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchFacultyDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchFacultyDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = {
            totalStudents: action.payload.totalStudents || 0,
            activeInternships: action.payload.activeInternships || 0,
            pendingReports: action.payload.pendingReports || 0,
            pendingApprovals: action.payload.pendingApprovals || 0,
            totalVisits: action.payload.totalVisits || 0,
            // Joining report stats
            pendingJoiningLetters: action.payload.pendingJoiningLetters || 0,
            totalJoiningLetters: action.payload.totalJoiningLetters || 0,
            // Grievance stats
            pendingGrievances: action.payload.pendingGrievances || 0,
            totalGrievances: action.payload.totalGrievances || 0,
          };
          state.dashboard.upcomingVisits = action.payload.upcomingVisits || [];
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchFacultyDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Monthly Stats
      .addCase(fetchMonthlyStats.pending, (state) => {
        state.monthlyStats.loading = true;
        state.monthlyStats.error = null;
      })
      .addCase(fetchMonthlyStats.fulfilled, (state, action) => {
        state.monthlyStats.loading = false;
        if (!action.payload.cached) {
          state.monthlyStats.data = action.payload;
          state.lastFetched.monthlyStats = Date.now();
        }
      })
      .addCase(fetchMonthlyStats.rejected, (state, action) => {
        state.monthlyStats.loading = false;
        state.monthlyStats.error = action.payload;
      })

      // Profile
      .addCase(fetchProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        if (!action.payload.cached) {
          state.profile.data = action.payload;
          state.lastFetched.profile = Date.now();
        }
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })

      // Students
      .addCase(fetchAssignedStudents.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(fetchAssignedStudents.fulfilled, (state, action) => {
        state.students.loading = false;
        if (!action.payload.cached) {
          state.students.list = action.payload.students || [];
          state.students.total = action.payload.total || 0;
          state.students.page = action.payload.page || 1;
          state.students.totalPages = action.payload.totalPages || 1;
          state.lastFetched.students = Date.now();
          state.lastFetched.studentsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchAssignedStudents.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      // Student Progress (ID-based caching)
      .addCase(fetchStudentProgress.fulfilled, (state, action) => {
        if (!action.payload.cached && action.payload._studentId) {
          state.lastFetched.studentProgressById[action.payload._studentId] = Date.now();
        }
      })

      // Visit Logs
      .addCase(fetchVisitLogs.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(fetchVisitLogs.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        if (!action.payload.cached) {
          state.visitLogs.list = action.payload.visitLogs || [];
          state.visitLogs.total = action.payload.total || 0;
          state.visitLogs.page = action.payload.page || 1;
          state.visitLogs.totalPages = action.payload.totalPages || 1;
          state.lastFetched.visitLogs = Date.now();
          state.lastFetched.visitLogsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchVisitLogs.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(fetchVisitLogById.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(fetchVisitLogById.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        if (!action.payload.cached) {
          state.visitLogs.current = action.payload;
          // Update ID-based cache timestamp
          if (action.payload._visitLogId) {
            state.lastFetched.visitLogsById[action.payload._visitLogId] = Date.now();
          }
        }
      })
      .addCase(fetchVisitLogById.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(createVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(createVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.list = [action.payload, ...state.visitLogs.list];
        state.visitLogs.total += 1;
        state.lastFetched.visitLogs = null; // Invalidate cache
        state.lastFetched.visitLogsKey = null;
      })
      .addCase(createVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(updateVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(updateVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        const index = state.visitLogs.list.findIndex(log => log.id === action.payload.id);
        if (index !== -1) {
          state.visitLogs.list[index] = action.payload;
        }
        // Invalidate ID-based cache for this visit log
        if (action.payload.id) {
          delete state.lastFetched.visitLogsById[action.payload.id];
        }
        // Invalidate list cache
        state.lastFetched.visitLogs = null;
        state.lastFetched.visitLogsKey = null;
      })
      .addCase(updateVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })
      .addCase(deleteVisitLog.pending, (state) => {
        state.visitLogs.loading = true;
        state.visitLogs.error = null;
      })
      .addCase(deleteVisitLog.fulfilled, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.list = state.visitLogs.list.filter(log => log.id !== action.payload.id);
        state.visitLogs.total -= 1;
        // Invalidate ID-based cache for this visit log
        if (action.payload.id) {
          delete state.lastFetched.visitLogsById[action.payload.id];
        }
        // Invalidate list cache
        state.lastFetched.visitLogs = null;
        state.lastFetched.visitLogsKey = null;
      })
      .addCase(deleteVisitLog.rejected, (state, action) => {
        state.visitLogs.loading = false;
        state.visitLogs.error = action.payload;
      })

      // Monthly Reports
      .addCase(fetchMonthlyReports.pending, (state) => {
        state.monthlyReports.loading = true;
        state.monthlyReports.error = null;
      })
      .addCase(fetchMonthlyReports.fulfilled, (state, action) => {
        state.monthlyReports.loading = false;
        if (!action.payload.cached) {
          state.monthlyReports.list = action.payload.reports || [];
          state.monthlyReports.total = action.payload.total || 0;
          state.monthlyReports.page = action.payload.page || 1;
          state.monthlyReports.totalPages = action.payload.totalPages || 1;
          state.lastFetched.monthlyReports = Date.now();
          state.lastFetched.monthlyReportsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchMonthlyReports.rejected, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.error = action.payload;
      })
      .addCase(fetchMonthlyReportsForDashboard.pending, (state) => {
        state.monthlyReports.loading = true;
        state.monthlyReports.error = null;
      })
      .addCase(fetchMonthlyReportsForDashboard.fulfilled, (state, action) => {
        state.monthlyReports.loading = false;
        if (!action.payload.cached) {
          state.monthlyReports.list = action.payload.reports || [];
          state.monthlyReports.total = action.payload.total || 0;
          state.monthlyReports.page = action.payload.page || 1;
          state.monthlyReports.totalPages = action.payload.totalPages || 1;
          state.lastFetched.monthlyReportsDashboard = Date.now();
          state.lastFetched.monthlyReportsDashboardKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchMonthlyReportsForDashboard.rejected, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.error = action.payload;
      })

      // Upload Monthly Report
      .addCase(uploadMonthlyReport.pending, (state) => {
        state.monthlyReports.uploading = true;
        state.monthlyReports.uploadError = null;
      })
      .addCase(uploadMonthlyReport.fulfilled, (state, action) => {
        state.monthlyReports.uploading = false;
        // Add the new report to the list if data is returned
        if (action.payload?.data) {
          // Check if report already exists (from optimistic update)
          const existingIndex = state.monthlyReports.list.findIndex(
            r => r._isOptimistic && r.reportMonth === action.payload.data.reportMonth && r.reportYear === action.payload.data.reportYear
          );
          if (existingIndex !== -1) {
            // Replace optimistic report with actual data
            state.monthlyReports.list[existingIndex] = action.payload.data;
          } else {
            // Add new report to beginning of list
            state.monthlyReports.list.unshift(action.payload.data);
            state.monthlyReports.total += 1;
          }
        }
        // Invalidate cache to ensure fresh data on next fetch
        state.lastFetched.monthlyReports = null;
        state.lastFetched.monthlyReportsKey = null;
      })
      .addCase(uploadMonthlyReport.rejected, (state, action) => {
        state.monthlyReports.uploading = false;
        state.monthlyReports.uploadError = action.payload;
        // Remove optimistic report on failure
        state.monthlyReports.list = state.monthlyReports.list.filter(r => !r._isOptimistic);
      })

      // Removed: Auto-approval implemented - reviewMonthlyReport reducers no longer needed
      // .addCase(reviewMonthlyReport.pending, (state) => {
      //   state.monthlyReports.loading = true;
      // })
      // .addCase(reviewMonthlyReport.fulfilled, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   const index = state.monthlyReports.list.findIndex(r => r.id === action.payload.id);
      //   if (index !== -1) {
      //     state.monthlyReports.list[index] = action.payload;
      //   }
      //   state.lastFetched.monthlyReports = null; // Invalidate cache
      //   state.lastFetched.monthlyReportsKey = null;
      // })
      // .addCase(reviewMonthlyReport.rejected, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   state.monthlyReports.error = action.payload;
      // })

      // Applications
      .addCase(fetchApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload.cached) {
          state.applications.list = action.payload.approvals || [];
          state.applications.total = action.payload.total || 0;
          state.applications.page = action.payload.page || 1;
          state.applications.totalPages = action.payload.totalPages || 1;
          state.lastFetched.applications = Date.now();
          state.lastFetched.applicationsKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(approveApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(approveApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        state.lastFetched.applications = null; // Invalidate cache
      })
      .addCase(approveApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(rejectApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(rejectApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        state.lastFetched.applications = null; // Invalidate cache
      })
      .addCase(rejectApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Feedback History
      .addCase(fetchFeedbackHistory.pending, (state) => {
        state.feedbackHistory.loading = true;
        state.feedbackHistory.error = null;
      })
      .addCase(fetchFeedbackHistory.fulfilled, (state, action) => {
        state.feedbackHistory.loading = false;
        if (!action.payload.cached) {
          state.feedbackHistory.list = action.payload.feedback || [];
          state.feedbackHistory.total = action.payload.total || 0;
          state.lastFetched.feedbackHistory = Date.now();
          state.lastFetched.feedbackHistoryKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchFeedbackHistory.rejected, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.error = action.payload;
      })

      // Submit Feedback
      .addCase(submitFeedback.pending, (state) => {
        state.feedbackHistory.loading = true;
      })
      .addCase(submitFeedback.fulfilled, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.list = [action.payload, ...state.feedbackHistory.list];
        state.lastFetched.feedbackHistory = null; // Invalidate cache
      })
      .addCase(submitFeedback.rejected, (state, action) => {
        state.feedbackHistory.loading = false;
        state.feedbackHistory.error = action.payload;
      })

      // ==================== Joining Report ====================
      .addCase(fetchJoiningLetters.pending, (state) => {
        state.joiningLetters.loading = true;
        state.joiningLetters.error = null;
      })
      .addCase(fetchJoiningLetters.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        if (!action.payload.cached) {
          state.joiningLetters.list = action.payload.letters || [];
          state.joiningLetters.total = action.payload.total || 0;
          state.joiningLetters.page = action.payload.page || 1;
          state.joiningLetters.totalPages = action.payload.totalPages || 1;
          state.lastFetched.joiningLetters = Date.now();
          state.lastFetched.joiningLettersKey = action.payload._cacheKey ?? null;
        }
      })
      .addCase(fetchJoiningLetters.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })
      .addCase(verifyJoiningLetter.pending, (state) => {
        state.joiningLetters.loading = true;
      })
      .addCase(verifyJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        const index = state.joiningLetters.list.findIndex(l => l.id === action.payload.data?.id);
        if (index !== -1) {
          state.joiningLetters.list[index] = action.payload.data;
        }
        state.lastFetched.joiningLetters = null;
      })
      .addCase(verifyJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })
      .addCase(rejectJoiningLetter.pending, (state) => {
        state.joiningLetters.loading = true;
      })
      .addCase(rejectJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        const index = state.joiningLetters.list.findIndex(l => l.id === action.payload.data?.id);
        if (index !== -1) {
          state.joiningLetters.list[index] = action.payload.data;
        }
        state.lastFetched.joiningLetters = null;
      })
      .addCase(rejectJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })
      .addCase(deleteJoiningLetter.pending, (state) => {
        state.joiningLetters.loading = true;
      })
      .addCase(deleteJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.list = state.joiningLetters.list.filter(l => l.id !== action.payload.id);
        state.joiningLetters.total -= 1;
        state.lastFetched.joiningLetters = null; // Invalidate cache after mutation
        state.lastFetched.joiningLettersKey = null;
      })
      .addCase(deleteJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })
      .addCase(uploadJoiningLetter.pending, (state) => {
        state.joiningLetters.loading = true;
      })
      .addCase(uploadJoiningLetter.fulfilled, (state, action) => {
        state.joiningLetters.loading = false;
        // Add or update the letter in the list
        const newLetter = action.payload.data;
        const index = state.joiningLetters.list.findIndex(l => l.id === newLetter.id);
        if (index !== -1) {
          state.joiningLetters.list[index] = newLetter;
        } else {
          state.joiningLetters.list = [newLetter, ...state.joiningLetters.list];
          state.joiningLetters.total += 1;
        }
        state.lastFetched.joiningLetters = null;
      })
      .addCase(uploadJoiningLetter.rejected, (state, action) => {
        state.joiningLetters.loading = false;
        state.joiningLetters.error = action.payload;
      })

      // ==================== Monthly Report Actions ====================
      // Removed: Auto-approval implemented - approveMonthlyReport, rejectMonthlyReport, deleteMonthlyReport reducers no longer needed
      // .addCase(approveMonthlyReport.pending, (state) => {
      //   state.monthlyReports.loading = true;
      // })
      // .addCase(approveMonthlyReport.fulfilled, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   const index = state.monthlyReports.list.findIndex(r => r.id === action.payload.data?.id);
      //   if (index !== -1) {
      //     state.monthlyReports.list[index] = action.payload.data;
      //   }
      //   state.lastFetched.monthlyReports = null;
      //   state.lastFetched.monthlyReportsKey = null;
      // })
      // .addCase(approveMonthlyReport.rejected, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   state.monthlyReports.error = action.payload;
      // })
      // .addCase(rejectMonthlyReport.pending, (state) => {
      //   state.monthlyReports.loading = true;
      // })
      // .addCase(rejectMonthlyReport.fulfilled, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   const index = state.monthlyReports.list.findIndex(r => r.id === action.payload.data?.id);
      //   if (index !== -1) {
      //     state.monthlyReports.list[index] = action.payload.data;
      //   }
      //   state.lastFetched.monthlyReports = null;
      //   state.lastFetched.monthlyReportsKey = null;
      // })
      // .addCase(rejectMonthlyReport.rejected, (state, action) => {
      //   state.monthlyReports.loading = false;
      //   state.monthlyReports.error = action.payload;
      // })
      .addCase(deleteMonthlyReport.pending, (state) => {
        state.monthlyReports.loading = true;
      })
      .addCase(deleteMonthlyReport.fulfilled, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.list = state.monthlyReports.list.filter(r => r.id !== action.payload.id);
        state.monthlyReports.total = Math.max(0, state.monthlyReports.total - 1);
        state.lastFetched.monthlyReports = null; // Invalidate cache after mutation
        state.lastFetched.monthlyReportsKey = null;
      })
      .addCase(deleteMonthlyReport.rejected, (state, action) => {
        state.monthlyReports.loading = false;
        state.monthlyReports.error = action.payload;
      })

      // ==================== Faculty Grievances ====================
      .addCase(fetchFacultyGrievances.pending, (state) => {
        state.grievances.loading = true;
        state.grievances.error = null;
      })
      .addCase(fetchFacultyGrievances.fulfilled, (state, action) => {
        state.grievances.loading = false;
        if (!action.payload?.cached) {
          state.grievances.list = Array.isArray(action.payload) ? action.payload : [];
          state.lastFetched.grievances = Date.now();
        }
      })
      .addCase(fetchFacultyGrievances.rejected, (state, action) => {
        state.grievances.loading = false;
        state.grievances.error = action.payload;
      })

      .addCase(fetchGrievanceEscalationChain.fulfilled, (state, action) => {
        state.grievances.escalationChain = action.payload;
      })

      .addCase(respondToGrievance.fulfilled, (state) => {
        state.lastFetched.grievances = null; // Invalidate cache
      })

      .addCase(escalateGrievance.fulfilled, (state) => {
        state.lastFetched.grievances = null; // Invalidate cache
      })

      .addCase(rejectGrievance.fulfilled, (state) => {
        state.lastFetched.grievances = null; // Invalidate cache
      })

      .addCase(updateGrievanceStatus.fulfilled, (state) => {
        state.lastFetched.grievances = null; // Invalidate cache
      })

      // ==================== Student Management ====================
      .addCase(updateStudent.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(updateStudent.fulfilled, (state, action) => {
        state.students.loading = false;
        // Update the student in the list - handle nested structure
        const updatedStudent = action.payload.data;
        if (updatedStudent?.id) {
          const index = state.students.list.findIndex(s => {
            const stud = s.student || s;
            return stud.id === updatedStudent.id || s.id === updatedStudent.id;
          });
          if (index !== -1) {
            const existing = state.students.list[index];
            // Handle nested structure (s.student) vs flat structure
            if (existing.student) {
              state.students.list[index] = {
                ...existing,
                student: { ...existing.student, ...updatedStudent },
              };
            } else {
              state.students.list[index] = { ...existing, ...updatedStudent };
            }
          }
        }
        // Invalidate cache to refresh student list
        state.lastFetched.students = null;
        state.lastFetched.studentsKey = null;
      })
      .addCase(updateStudent.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      .addCase(uploadStudentDocument.pending, (state) => {
        state.students.loading = true;
        state.students.error = null;
      })
      .addCase(uploadStudentDocument.fulfilled, (state) => {
        state.students.loading = false;
        // Invalidate cache to refresh student list
        state.lastFetched.students = null;
        state.lastFetched.studentsKey = null;
      })
      .addCase(uploadStudentDocument.rejected, (state, action) => {
        state.students.loading = false;
        state.students.error = action.payload;
      })

      .addCase(toggleStudentStatus.pending, (state) => {
        // Don't set loading to true since we use optimistic updates
        state.students.error = null;
      })
      .addCase(toggleStudentStatus.fulfilled, (state, action) => {
        // Optimistic update already applied, just confirm with server response
        // Payload: { studentId, success, active, message }
        const { studentId, active: newActiveStatus } = action.payload;
        const index = state.students.list.findIndex(s => {
          const stud = s.student || s;
          return stud.id === studentId || s.id === studentId;
        });
        if (index !== -1) {
          const existing = state.students.list[index];
          // Handle nested structure (s.student) vs flat structure
          // Update both isActive and user.active for compatibility
          if (existing.student) {
            state.students.list[index] = {
              ...existing,
              student: {
                ...existing.student,
                isActive: newActiveStatus,
                user: existing.student.user ? { ...existing.student.user, active: newActiveStatus } : undefined,
              },
            };
          } else {
            state.students.list[index] = {
              ...existing,
              isActive: newActiveStatus,
              user: existing.user ? { ...existing.user, active: newActiveStatus } : undefined,
            };
          }
        }
        // No need to invalidate students cache - optimistic update already handled the change
        // Only invalidate related caches that might be affected
        state.lastFetched.dashboard = null;
      })
      .addCase(toggleStudentStatus.rejected, (state, action) => {
        // Rollback already handled in thunk, just set error
        state.students.error = action.payload;
      })
      ;
  },
});

export const {
  clearError,
  invalidateCache,
  optimisticApproveApplication,
  optimisticRejectApplication,
  rollbackApplicationUpdate,
  optimisticallyUpdateJoiningLetter,
  rollbackJoiningLetterOperation,
  optimisticallyDeleteVisitLog,
  rollbackVisitLogOperation,
  optimisticallyUpdateStudent,
  optimisticallyToggleStudentStatus,
  rollbackStudentOperation,
  optimisticallyAddReport,
  rollbackReportOperation,
  confirmOptimisticReport,
} = facultySlice.actions;

// Selectors
export const selectDashboard = (state) => state.faculty.dashboard;
export const selectMonthlyStats = (state) => state.faculty.monthlyStats;
export const selectStudents = (state) => state.faculty.students;
export const selectVisitLogs = (state) => state.faculty.visitLogs;
export const selectMonthlyReports = (state) => state.faculty.monthlyReports;
export const selectJoiningLetters = (state) => state.faculty.joiningLetters;
export const selectProfile = (state) => state.faculty.profile;
export const selectApplications = (state) => state.faculty.applications;
export const selectFeedbackHistory = (state) => state.faculty.feedbackHistory;
export const selectFacultyGrievances = (state) => state.faculty.grievances;

// Backward compatibility selectors
export const selectMentor = (state) => state.faculty.profile;
export const selectGrievances = (state) => state.faculty.feedbackHistory;

// Cache timestamp selectors
export const selectLastFetched = (state) => state.faculty.lastFetched;

export const selectMostRecentFetch = (state) => {
  const { lastFetched } = state.faculty;
  const timestamps = [
    lastFetched.dashboard,
    lastFetched.monthlyStats,
    lastFetched.students,
    lastFetched.visitLogs,
    lastFetched.monthlyReports,
    lastFetched.joiningLetters,
    lastFetched.profile,
    lastFetched.applications,
    lastFetched.feedbackHistory,
  ].filter(Boolean);

  return timestamps.length > 0 ? Math.max(...timestamps) : null;
};

export default facultySlice.reducer;
