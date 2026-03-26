import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import trainingService from '../../../services/training.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  trainings: {
    list: [],
    pagination: null,
    loading: false,
    error: null,
  },
  calendar: {
    list: [],
    loading: false,
    error: null,
  },
  upcoming: {
    list: [],
    loading: false,
    error: null,
  },
  myTrainings: {
    list: [],
    loading: false,
    error: null,
  },
  currentTraining: {
    data: null,
    eligibility: null,
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    loading: false,
    error: null,
  },
  applicationStatus: {},
  attendance: {
    list: [],
    summary: null,
    byTraining: {},
    loadingByTraining: {},
    errorByTraining: {},
    loading: false,
    error: null,
  },
  feedback: {
    form: null,
    responses: [],
    pending: [],
    statusByTraining: {},
    loading: false,
    error: null,
  },
  lessonPlans: {
    list: [],
    current: null,
    loading: false,
    error: null,
  },
  certificates: {
    list: [],
    current: null,
    loading: false,
    error: null,
  },
  recommendations: {
    list: [],
    current: null,
    loading: false,
    error: null,
  },
  preTest: {
    form: null,
    statusByTraining: {},
    loading: false,
    error: null,
  },
  postTest: {
    form: null,
    statusByTraining: {},
    loading: false,
    error: null,
  },
  pendingTests: {
    list: [],
    loading: false,
    error: null,
  },
  pendingLessonPlans: {
    list: [],
    loading: false,
    error: null,
  },
  backdatedAttendance: {
    trainings: [],
    totalPendingDays: 0,
    loading: false,
    error: null,
  },
  lastFetched: {
    trainings: null,
    trainingsKey: null,
    calendar: null,
    calendarKey: null,
    upcoming: null,
    myTrainings: null,
    applications: null,
    applicationsKey: null,
    lessonPlans: null,
    lessonPlansKey: null,
    certificates: null,
    recommendations: null,
    pendingTests: null,
    pendingLessonPlans: null,
    backdatedAttendance: null,
  },
};

const unwrapPayload = (payload) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload) {
    return payload.data;
  }
  return payload;
};

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [];
};

// Trainings
export const fetchTrainings = createAsyncThunk(
  'facultyTraining/fetchTrainings',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.trainings;

      const normalizedParams = {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        search: params?.search ?? '',
        year: params?.year ?? '',
        month: params?.month ?? '',
        deliveryMode: params?.deliveryMode ?? '',
        difficulty: params?.difficulty ?? '',
        isPublished: params?.isPublished ?? '',
        isActive: params?.isActive ?? '',
        startDateFrom: params?.startDateFrom ?? '',
        startDateTo: params?.startDateTo ?? '',
        branchIds: Array.isArray(params?.branchIds) ? params.branchIds.join(',') : params?.branchIds ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.facultyTraining.lastFetched.trainingsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await trainingService.getTrainings(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch trainings');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().facultyTraining;
      if (params?.forceRefresh) return true;
      return !state.trainings.loading;
    },
  }
);

export const fetchTrainingDetails = createAsyncThunk(
  'facultyTraining/fetchTrainingDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.getTrainingDetails(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training');
    }
  }
);

export const fetchCalendar = createAsyncThunk(
  'facultyTraining/fetchCalendar',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.calendar;

      const normalizedParams = {
        year: params?.year ?? '',
        month: params?.month ?? '',
        deliveryMode: params?.deliveryMode ?? '',
        branchIds: Array.isArray(params?.branchIds) ? params.branchIds.join(',') : params?.branchIds ?? '',
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.facultyTraining.lastFetched.calendarKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await trainingService.getCalendar(params);
      return { data: response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch calendar');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().facultyTraining;
      if (params?.forceRefresh) return true;
      return !state.calendar.loading;
    },
  }
);

export const fetchUpcoming = createAsyncThunk(
  'facultyTraining/fetchUpcoming',
  async (limit = 10, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.upcoming;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingService.getUpcoming(limit);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch upcoming trainings');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().facultyTraining;
      return !state.upcoming.loading;
    },
  }
);

export const fetchMyTrainings = createAsyncThunk(
  'facultyTraining/fetchMyTrainings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.myTrainings;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingService.getMyTrainings();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch my trainings');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().facultyTraining;
      return !state.myTrainings.loading;
    },
  }
);

export const checkEligibility = createAsyncThunk(
  'facultyTraining/checkEligibility',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.checkEligibility(trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check eligibility');
    }
  }
);

// Applications
export const fetchMyApplications = createAsyncThunk(
  'facultyTraining/fetchMyApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.applications;

      const normalizedParams = {
        status: params?.status ?? '',
        trainingId: params?.trainingId ?? '',
        search: params?.search ?? '',
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.facultyTraining.lastFetched.applicationsKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await trainingService.getMyApplications(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().facultyTraining;
      if (params?.forceRefresh) return true;
      return !state.applications.loading;
    },
  }
);

export const applyForTraining = createAsyncThunk(
  'facultyTraining/applyForTraining',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingService.apply(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to apply for training');
    }
  }
);

export const withdrawApplication = createAsyncThunk(
  'facultyTraining/withdrawApplication',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.withdrawApplication(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to withdraw application');
    }
  }
);

export const fetchApplicationStatus = createAsyncThunk(
  'facultyTraining/fetchApplicationStatus',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getApplicationStatus(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch application status');
    }
  }
);

// Attendance
export const fetchMyAttendance = createAsyncThunk(
  'facultyTraining/fetchMyAttendance',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingService.getMyAttendance();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch attendance');
    }
  }
);

export const fetchAttendanceSummary = createAsyncThunk(
  'facultyTraining/fetchAttendanceSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingService.getAttendanceSummary();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch attendance summary');
    }
  }
);

export const fetchTrainingAttendance = createAsyncThunk(
  'facultyTraining/fetchTrainingAttendance',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getTrainingAttendance(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue({
        trainingId,
        message: error.response?.data?.message || 'Failed to fetch training attendance',
      });
    }
  }
);

export const markSelfAttendance = createAsyncThunk(
  'facultyTraining/markSelfAttendance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingService.markSelfAttendance(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark attendance');
    }
  }
);

export const fetchLastMonthPendingAttendance = createAsyncThunk(
  'facultyTraining/fetchLastMonthPendingAttendance',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.backdatedAttendance;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await trainingService.getLastMonthPendingAttendance();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch last month pending attendance');
    }
  }
);

export const markBackdatedAttendance = createAsyncThunk(
  'facultyTraining/markBackdatedAttendance',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingService.markBackdatedAttendance(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark backdated attendance');
    }
  }
);

// Feedback
export const fetchFeedbackForm = createAsyncThunk(
  'facultyTraining/fetchFeedbackForm',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getFeedbackForm(trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback form');
    }
  }
);

export const submitFeedback = createAsyncThunk(
  'facultyTraining/submitFeedback',
  async ({ trainingId, data }, { rejectWithValue }) => {
    try {
      const response = await trainingService.submitFeedback(trainingId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit feedback');
    }
  }
);

export const fetchFeedbackStatus = createAsyncThunk(
  'facultyTraining/fetchFeedbackStatus',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getFeedbackStatus(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback status');
    }
  }
);

export const fetchMyFeedbackResponses = createAsyncThunk(
  'facultyTraining/fetchMyFeedbackResponses',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingService.getMyFeedbackResponses();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback responses');
    }
  }
);

export const fetchPendingFeedback = createAsyncThunk(
  'facultyTraining/fetchPendingFeedback',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingService.getPendingFeedback();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pending feedback');
    }
  }
);

// Lesson Plans
export const fetchLessonPlans = createAsyncThunk(
  'facultyTraining/fetchLessonPlans',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.lessonPlans;

      const normalizedParams = {
        status: params?.status ?? '',
        trainingId: params?.trainingId ?? '',
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
      };
      const requestKey = JSON.stringify(normalizedParams);
      const lastKey = state.facultyTraining.lastFetched.lessonPlansKey;

      if (
        !params?.forceRefresh &&
        lastKey === requestKey &&
        isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)
      ) {
        return { cached: true };
      }

      const response = await trainingService.getMyLessonPlans(params);
      return { ...response, _cacheKey: requestKey };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch lesson plans');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().facultyTraining;
      if (params?.forceRefresh) return true;
      return !state.lessonPlans.loading;
    },
  }
);

export const fetchLessonPlanById = createAsyncThunk(
  'facultyTraining/fetchLessonPlanById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.getLessonPlan(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch lesson plan');
    }
  }
);

export const createLessonPlan = createAsyncThunk(
  'facultyTraining/createLessonPlan',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingService.createLessonPlan(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create lesson plan');
    }
  }
);

export const updateLessonPlan = createAsyncThunk(
  'facultyTraining/updateLessonPlan',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingService.updateLessonPlan(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update lesson plan');
    }
  }
);

export const deleteLessonPlan = createAsyncThunk(
  'facultyTraining/deleteLessonPlan',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.deleteLessonPlan(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete lesson plan');
    }
  }
);

export const submitLessonPlan = createAsyncThunk(
  'facultyTraining/submitLessonPlan',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.submitLessonPlan(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit lesson plan');
    }
  }
);

// Certificates
export const fetchCertificates = createAsyncThunk(
  'facultyTraining/fetchCertificates',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.certificates;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await trainingService.getMyCertificates();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch certificates');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().facultyTraining;
      return !state.certificates.loading;
    },
  }
);

export const fetchCertificateById = createAsyncThunk(
  'facultyTraining/fetchCertificateById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.getCertificate(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch certificate');
    }
  }
);

export const fetchTrainingCertificate = createAsyncThunk(
  'facultyTraining/fetchTrainingCertificate',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getTrainingCertificate(trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training certificate');
    }
  }
);

// Recommendations
export const fetchMyRecommendations = createAsyncThunk(
  'facultyTraining/fetchMyRecommendations',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.recommendations;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingService.getMyRecommendations(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recommendations');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().facultyTraining;
      if (params?.forceRefresh) return true;
      return !state.recommendations.loading;
    },
  }
);

export const createRecommendation = createAsyncThunk(
  'facultyTraining/createRecommendation',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingService.createRecommendation(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create recommendation');
    }
  }
);

export const updateRecommendation = createAsyncThunk(
  'facultyTraining/updateRecommendation',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingService.updateRecommendation(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update recommendation');
    }
  }
);

export const deleteRecommendation = createAsyncThunk(
  'facultyTraining/deleteRecommendation',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingService.deleteRecommendation(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete recommendation');
    }
  }
);

// Pre-Test
export const fetchPreTestForm = createAsyncThunk(
  'facultyTraining/fetchPreTestForm',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getPreTestForm(trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pre-test form');
    }
  }
);

export const fetchPreTestStatus = createAsyncThunk(
  'facultyTraining/fetchPreTestStatus',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getPreTestStatus(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pre-test status');
    }
  }
);

export const submitPreTest = createAsyncThunk(
  'facultyTraining/submitPreTest',
  async ({ trainingId, data }, { rejectWithValue }) => {
    try {
      const response = await trainingService.submitPreTest(trainingId, data);
      return { trainingId, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit pre-test');
    }
  }
);

// Post-Test
export const fetchPostTestForm = createAsyncThunk(
  'facultyTraining/fetchPostTestForm',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getPostTestForm(trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch post-test form');
    }
  }
);

export const fetchPostTestStatus = createAsyncThunk(
  'facultyTraining/fetchPostTestStatus',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getPostTestStatus(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch post-test status');
    }
  }
);

export const submitPostTest = createAsyncThunk(
  'facultyTraining/submitPostTest',
  async ({ trainingId, data }, { rejectWithValue }) => {
    try {
      const response = await trainingService.submitPostTest(trainingId, data);
      return { trainingId, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit post-test');
    }
  }
);

// Test Statuses
export const fetchTestStatuses = createAsyncThunk(
  'facultyTraining/fetchTestStatuses',
  async (trainingId, { rejectWithValue }) => {
    try {
      const response = await trainingService.getTestStatuses(trainingId);
      return { trainingId, data: response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch test statuses');
    }
  }
);

// Pending Tests
export const fetchPendingTests = createAsyncThunk(
  'facultyTraining/fetchPendingTests',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.pendingTests;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingService.getPendingTests();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pending tests');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().facultyTraining;
      return !state.pendingTests.loading;
    },
  }
);

export const fetchPendingLessonPlans = createAsyncThunk(
  'facultyTraining/fetchPendingLessonPlans',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.facultyTraining.lastFetched.pendingLessonPlans;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingService.getPendingLessonPlans();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pending lesson plans');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().facultyTraining;
      return !state.pendingLessonPlans.loading;
    },
  }
);

const facultyTrainingSlice = createSlice({
  name: 'facultyTraining',
  initialState,
  reducers: {
    clearCurrentTraining: (state) => {
      state.currentTraining.data = null;
      state.currentTraining.error = null;
      state.currentTraining.eligibility = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Trainings list
      .addCase(fetchTrainings.pending, (state) => {
        state.trainings.loading = true;
        state.trainings.error = null;
      })
      .addCase(fetchTrainings.fulfilled, (state, action) => {
        state.trainings.loading = false;
        if (!action.payload?.cached) {
          const data = action.payload?.data || action.payload?.items || action.payload || [];
          state.trainings.list = data;
          state.trainings.pagination = action.payload?.pagination || null;
          state.lastFetched.trainings = Date.now();
          state.lastFetched.trainingsKey = action.payload?._cacheKey || null;
        }
      })
      .addCase(fetchTrainings.rejected, (state, action) => {
        state.trainings.loading = false;
        state.trainings.error = action.payload;
      })

      // Training details
      .addCase(fetchTrainingDetails.pending, (state) => {
        state.currentTraining.loading = true;
        state.currentTraining.error = null;
      })
      .addCase(fetchTrainingDetails.fulfilled, (state, action) => {
        state.currentTraining.loading = false;
        state.currentTraining.data = action.payload;
      })
      .addCase(fetchTrainingDetails.rejected, (state, action) => {
        state.currentTraining.loading = false;
        state.currentTraining.error = action.payload;
      })

      // Calendar
      .addCase(fetchCalendar.pending, (state) => {
        state.calendar.loading = true;
        state.calendar.error = null;
      })
      .addCase(fetchCalendar.fulfilled, (state, action) => {
        state.calendar.loading = false;
        if (!action.payload?.cached) {
          state.calendar.list = action.payload?.data || [];
          state.lastFetched.calendar = Date.now();
          state.lastFetched.calendarKey = action.payload?._cacheKey || null;
        }
      })
      .addCase(fetchCalendar.rejected, (state, action) => {
        state.calendar.loading = false;
        state.calendar.error = action.payload;
      })

      // Upcoming
      .addCase(fetchUpcoming.pending, (state) => {
        state.upcoming.loading = true;
        state.upcoming.error = null;
      })
      .addCase(fetchUpcoming.fulfilled, (state, action) => {
        state.upcoming.loading = false;
        if (!action.payload?.cached) {
          state.upcoming.list = action.payload || [];
          state.lastFetched.upcoming = Date.now();
        }
      })
      .addCase(fetchUpcoming.rejected, (state, action) => {
        state.upcoming.loading = false;
        state.upcoming.error = action.payload;
      })

      // My trainings
      .addCase(fetchMyTrainings.pending, (state) => {
        state.myTrainings.loading = true;
        state.myTrainings.error = null;
      })
      .addCase(fetchMyTrainings.fulfilled, (state, action) => {
        state.myTrainings.loading = false;
        if (!action.payload?.cached) {
          state.myTrainings.list = action.payload || [];
          state.lastFetched.myTrainings = Date.now();
        }
      })
      .addCase(fetchMyTrainings.rejected, (state, action) => {
        state.myTrainings.loading = false;
        state.myTrainings.error = action.payload;
      })

      // Eligibility
      .addCase(checkEligibility.fulfilled, (state, action) => {
        state.currentTraining.eligibility = action.payload;
      })

      // Applications
      .addCase(fetchMyApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchMyApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload?.cached) {
          const data = action.payload?.data || action.payload?.items || action.payload || [];
          state.applications.list = data;
          state.lastFetched.applications = Date.now();
          state.lastFetched.applicationsKey = action.payload?._cacheKey || null;
        }
      })
      .addCase(fetchMyApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(applyForTraining.fulfilled, (state, action) => {
        state.applications.list = [action.payload, ...state.applications.list];

        const trainingId = action.payload.trainingId || action.payload.training?.id;

        // Update application status for this training
        if (trainingId) {
          state.applicationStatus[trainingId] = {
            hasApplied: true,
            id: action.payload.id,
            applicationId: action.payload.id,
            status: action.payload.status,
            appliedAt: action.payload.appliedAt,
            createdAt: action.payload.createdAt || action.payload.appliedAt,
          };
        }

        // Optimistically update current training if viewing details
        if (state.currentTraining.data && state.currentTraining.data.id === trainingId) {
          // Note: Backend counts only APPROVED applications for capacity
          // Application starts as SUBMITTED, so capacity won't decrease until approved
          // But we mark that user has applied
          if (state.currentTraining.data.userStatus) {
            state.currentTraining.data.userStatus.hasApplied = true;
            state.currentTraining.data.userStatus.application = action.payload;
          }
        }

        // Invalidate training lists cache
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
      })
      .addCase(withdrawApplication.fulfilled, (state, action) => {
        // Find the app BEFORE filtering it out
        const withdrawnApp = state.applications.list.find(app => app.id === action.payload.id);

        // Remove from list
        state.applications.list = state.applications.list.filter((app) => app.id !== action.payload.id);

        // Optimistically update current training capacity if viewing details
        if (state.currentTraining.data && withdrawnApp) {
          const trainingId = withdrawnApp.trainingId || withdrawnApp.training?.id;
          if (state.currentTraining.data.id === trainingId) {
            // If application was approved, increment available capacity
            if (withdrawnApp.status === 'APPROVED' && state.currentTraining.data.capacity) {
              state.currentTraining.data.capacity.approved = Math.max(0, (state.currentTraining.data.capacity.approved || 0) - 1);
              state.currentTraining.data.capacity.available = (state.currentTraining.data.capacity.available || 0) + 1;
              state.currentTraining.data.capacity.isFull = false;
            }

            // Update user status
            if (state.currentTraining.data.userStatus) {
              state.currentTraining.data.userStatus.hasApplied = false;
              state.currentTraining.data.userStatus.application = null;
            }
          }
        }

        // Clear application status for the training
        if (withdrawnApp) {
          const trainingId = withdrawnApp.trainingId || withdrawnApp.training?.id;
          if (trainingId && state.applicationStatus[trainingId]) {
            state.applicationStatus[trainingId] = { hasApplied: false };
          }
        }

        // Invalidate training lists cache in case capacity has changed
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
      })
      .addCase(fetchApplicationStatus.fulfilled, (state, action) => {
        state.applicationStatus[action.payload.trainingId] = action.payload.data;
      })

      // Attendance
      .addCase(fetchMyAttendance.pending, (state) => {
        state.attendance.loading = true;
        state.attendance.error = null;
      })
      .addCase(fetchMyAttendance.fulfilled, (state, action) => {
        state.attendance.loading = false;
        state.attendance.list = action.payload || [];
      })
      .addCase(fetchMyAttendance.rejected, (state, action) => {
        state.attendance.loading = false;
        state.attendance.error = action.payload;
      })
      .addCase(fetchAttendanceSummary.fulfilled, (state, action) => {
        state.attendance.summary = unwrapPayload(action.payload) || null;
      })
      .addCase(fetchTrainingAttendance.pending, (state, action) => {
        const trainingId = action.meta.arg;
        if (trainingId) {
          state.attendance.loadingByTraining[trainingId] = true;
          state.attendance.errorByTraining[trainingId] = null;
        }
      })
      .addCase(fetchTrainingAttendance.fulfilled, (state, action) => {
        const { trainingId, data } = action.payload;
        if (trainingId) {
          state.attendance.loadingByTraining[trainingId] = false;
          state.attendance.byTraining[trainingId] = data;
        }
      })
      .addCase(fetchTrainingAttendance.rejected, (state, action) => {
        const trainingId = action.payload?.trainingId || action.meta.arg;
        if (trainingId) {
          state.attendance.loadingByTraining[trainingId] = false;
          state.attendance.errorByTraining[trainingId] = action.payload?.message || action.payload;
        }
      })
      .addCase(markSelfAttendance.fulfilled, (state, action) => {
        const trainingId = action.meta?.arg?.trainingId;
        if (!trainingId) return;

        state.applications.list = state.applications.list.map((app) => {
          const appTrainingId = app.trainingId || app.training?.id;
          if (appTrainingId !== trainingId) return app;
          return {
            ...app,
            hasMarkedAttendanceToday: true,
          };
        });
      })

      // Feedback
      .addCase(fetchFeedbackForm.pending, (state) => {
        state.feedback.loading = true;
        state.feedback.error = null;
      })
      .addCase(fetchFeedbackForm.fulfilled, (state, action) => {
        state.feedback.loading = false;
        state.feedback.form = action.payload;
      })
      .addCase(fetchFeedbackForm.rejected, (state, action) => {
        state.feedback.loading = false;
        state.feedback.error = action.payload;
      })
      .addCase(fetchFeedbackStatus.fulfilled, (state, action) => {
        state.feedback.statusByTraining[action.payload.trainingId] = action.payload.data;
      })
      .addCase(submitFeedback.fulfilled, (state, action) => {
        // Mark feedback as submitted immediately after successful submission
        const trainingId = action.meta?.arg?.trainingId;
        if (trainingId) {
          state.feedback.statusByTraining[trainingId] = {
            submitted: true,
            hasSubmitted: true,
          };
        }
      })
      .addCase(fetchMyFeedbackResponses.fulfilled, (state, action) => {
        state.feedback.responses = action.payload || [];
      })
      .addCase(fetchPendingFeedback.fulfilled, (state, action) => {
        state.feedback.pending = asArray(unwrapPayload(action.payload));
      })

      // Lesson plans
      .addCase(fetchLessonPlans.pending, (state) => {
        state.lessonPlans.loading = true;
        state.lessonPlans.error = null;
      })
      .addCase(fetchLessonPlans.fulfilled, (state, action) => {
        state.lessonPlans.loading = false;
        if (!action.payload?.cached) {
          const data = action.payload?.data || action.payload?.items || action.payload || [];
          state.lessonPlans.list = data;
          state.lastFetched.lessonPlans = Date.now();
          state.lastFetched.lessonPlansKey = action.payload?._cacheKey || null;
        }
      })
      .addCase(fetchLessonPlans.rejected, (state, action) => {
        state.lessonPlans.loading = false;
        state.lessonPlans.error = action.payload;
      })
      .addCase(fetchLessonPlanById.fulfilled, (state, action) => {
        state.lessonPlans.current = action.payload;
      })
      .addCase(createLessonPlan.fulfilled, (state, action) => {
        state.lessonPlans.list = [action.payload, ...state.lessonPlans.list];
      })
      .addCase(updateLessonPlan.fulfilled, (state, action) => {
        const index = state.lessonPlans.list.findIndex((plan) => plan.id === action.payload.id);
        if (index !== -1) {
          state.lessonPlans.list[index] = action.payload;
        }
        if (state.lessonPlans.current?.id === action.payload.id) {
          state.lessonPlans.current = action.payload;
        }
      })
      .addCase(deleteLessonPlan.fulfilled, (state, action) => {
        state.lessonPlans.list = state.lessonPlans.list.filter((plan) => plan.id !== action.payload.id);
      })
      .addCase(submitLessonPlan.fulfilled, (state, action) => {
        const index = state.lessonPlans.list.findIndex((plan) => plan.id === action.payload.id);
        if (index !== -1) {
          state.lessonPlans.list[index] = action.payload;
        }
        if (state.lessonPlans.current?.id === action.payload.id) {
          state.lessonPlans.current = action.payload;
        }
        state.lastFetched.pendingLessonPlans = null;
      })

      // Certificates
      .addCase(fetchCertificates.pending, (state) => {
        state.certificates.loading = true;
        state.certificates.error = null;
      })
      .addCase(fetchCertificates.fulfilled, (state, action) => {
        state.certificates.loading = false;
        if (!action.payload?.cached) {
          state.certificates.list = action.payload || [];
          state.lastFetched.certificates = Date.now();
        }
      })
      .addCase(fetchCertificates.rejected, (state, action) => {
        state.certificates.loading = false;
        state.certificates.error = action.payload;
      })
      .addCase(fetchCertificateById.fulfilled, (state, action) => {
        state.certificates.current = action.payload;
      })

      // Recommendations
      .addCase(fetchMyRecommendations.pending, (state) => {
        state.recommendations.loading = true;
        state.recommendations.error = null;
      })
      .addCase(fetchMyRecommendations.fulfilled, (state, action) => {
        state.recommendations.loading = false;
        if (!action.payload?.cached) {
          state.recommendations.list = action.payload?.data || action.payload || [];
          state.lastFetched.recommendations = Date.now();
        }
      })
      .addCase(fetchMyRecommendations.rejected, (state, action) => {
        state.recommendations.loading = false;
        state.recommendations.error = action.payload;
      })
      .addCase(createRecommendation.fulfilled, (state, action) => {
        state.recommendations.list = [action.payload, ...state.recommendations.list];
        state.lastFetched.recommendations = null; // Invalidate cache
      })
      .addCase(updateRecommendation.fulfilled, (state, action) => {
        const index = state.recommendations.list.findIndex((r) => r.id === action.payload.id);
        if (index !== -1) {
          state.recommendations.list[index] = action.payload;
        }
      })
      .addCase(deleteRecommendation.fulfilled, (state, action) => {
        state.recommendations.list = state.recommendations.list.filter((r) => r.id !== action.payload.id);
      })

      // Pre-Test
      .addCase(fetchPreTestForm.pending, (state) => {
        state.preTest.loading = true;
        state.preTest.error = null;
      })
      .addCase(fetchPreTestForm.fulfilled, (state, action) => {
        state.preTest.loading = false;
        state.preTest.form = action.payload;
      })
      .addCase(fetchPreTestForm.rejected, (state, action) => {
        state.preTest.loading = false;
        state.preTest.error = action.payload;
      })
      .addCase(fetchPreTestStatus.fulfilled, (state, action) => {
        state.preTest.statusByTraining[action.payload.trainingId] = action.payload.data;
      })
      .addCase(submitPreTest.fulfilled, (state, action) => {
        const trainingId = action.payload.trainingId;
        if (trainingId) {
          state.preTest.statusByTraining[trainingId] = {
            submitted: true,
            hasSubmitted: true,
            ...action.payload.response,
          };
        }
        // Invalidate pending tests cache
        state.lastFetched.pendingTests = null;
        state.lastFetched.pendingLessonPlans = null;
      })

      // Post-Test
      .addCase(fetchPostTestForm.pending, (state) => {
        state.postTest.loading = true;
        state.postTest.error = null;
      })
      .addCase(fetchPostTestForm.fulfilled, (state, action) => {
        state.postTest.loading = false;
        state.postTest.form = action.payload;
      })
      .addCase(fetchPostTestForm.rejected, (state, action) => {
        state.postTest.loading = false;
        state.postTest.error = action.payload;
      })
      .addCase(fetchPostTestStatus.fulfilled, (state, action) => {
        state.postTest.statusByTraining[action.payload.trainingId] = action.payload.data;
      })
      .addCase(submitPostTest.fulfilled, (state, action) => {
        const trainingId = action.payload.trainingId;
        if (trainingId) {
          state.postTest.statusByTraining[trainingId] = {
            submitted: true,
            hasSubmitted: true,
            ...action.payload.response,
          };
        }
        // Invalidate pending tests cache
        state.lastFetched.pendingTests = null;
        state.lastFetched.pendingLessonPlans = null;
      })

      // Test Statuses
      .addCase(fetchTestStatuses.fulfilled, (state, action) => {
        const { trainingId, data } = action.payload;
        if (data.preTest) {
          state.preTest.statusByTraining[trainingId] = data.preTest;
        }
        if (data.postTest) {
          state.postTest.statusByTraining[trainingId] = data.postTest;
        }
      })

      // Pending Tests
      .addCase(fetchPendingTests.pending, (state) => {
        state.pendingTests.loading = true;
        state.pendingTests.error = null;
      })
      .addCase(fetchPendingTests.fulfilled, (state, action) => {
        state.pendingTests.loading = false;
        if (!action.payload?.cached) {
          const payload = unwrapPayload(action.payload) || {};
          // Backend returns { pendingPreTests, pendingPostTests, totalPending }
          // Transform into a flat list with type indicator
          const preTests = asArray(payload.pendingPreTests).map((t) => ({
            ...t,
            type: 'PRE_TEST',
          }));
          const postTests = asArray(payload.pendingPostTests).map((t) => ({
            ...t,
            type: 'POST_TEST',
          }));
          state.pendingTests.list = [...preTests, ...postTests];
          state.lastFetched.pendingTests = Date.now();
        }
      })
      .addCase(fetchPendingTests.rejected, (state, action) => {
        state.pendingTests.loading = false;
        state.pendingTests.error = action.payload;
      })

      // Pending Lesson Plans
      .addCase(fetchPendingLessonPlans.pending, (state) => {
        state.pendingLessonPlans.loading = true;
        state.pendingLessonPlans.error = null;
      })
      .addCase(fetchPendingLessonPlans.fulfilled, (state, action) => {
        state.pendingLessonPlans.loading = false;
        if (!action.payload?.cached) {
          const payload = unwrapPayload(action.payload) || {};
          state.pendingLessonPlans.list = asArray(payload.pendingLessonPlans);
          state.lastFetched.pendingLessonPlans = Date.now();
        }
      })
      .addCase(fetchPendingLessonPlans.rejected, (state, action) => {
        state.pendingLessonPlans.loading = false;
        state.pendingLessonPlans.error = action.payload;
      })

      // Backdated Attendance
      .addCase(fetchLastMonthPendingAttendance.pending, (state) => {
        state.backdatedAttendance.loading = true;
        state.backdatedAttendance.error = null;
      })
      .addCase(fetchLastMonthPendingAttendance.fulfilled, (state, action) => {
        state.backdatedAttendance.loading = false;
        if (!action.payload?.cached) {
          const payload = unwrapPayload(action.payload) || {};
          state.backdatedAttendance.trainings = payload.trainings || [];
          state.backdatedAttendance.totalPendingDays = payload.totalPendingDays || 0;
          state.lastFetched.backdatedAttendance = Date.now();
        }
      })
      .addCase(fetchLastMonthPendingAttendance.rejected, (state, action) => {
        state.backdatedAttendance.loading = false;
        state.backdatedAttendance.error = action.payload;
      })
      .addCase(markBackdatedAttendance.fulfilled, (state) => {
        // Invalidate backdated attendance cache to refetch
        state.lastFetched.backdatedAttendance = null;
      });
  },
});

export const { clearCurrentTraining } = facultyTrainingSlice.actions;
export default facultyTrainingSlice.reducer;
