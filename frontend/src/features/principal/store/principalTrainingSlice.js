import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import trainingPrincipalService from '../../../services/training-principal.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  trainings: {
    list: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    },
    loading: false,
    error: null,
  },
  currentTraining: {
    data: null,
    stats: null,
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
  applications: {
    list: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
    },
    loading: false,
    error: null,
  },
  applicationStats: {
    data: null,
    loading: false,
    error: null,
  },
  lessonPlans: {
    list: [],
    pending: [],
    pagination: null,
    loading: false,
    error: null,
  },
  lessonPlanStats: {
    data: null,
    loading: false,
    error: null,
  },
  recommendations: {
    list: [],
    statusCounts: {},
    loading: false,
    error: null,
  },
  reports: {
    dashboard: null,
    attendance: null,
    certificates: [],
    participation: null,
    feedback: null,
    loading: false,
    error: null,
  },
  lastFetched: {
    trainings: null,
    calendar: null,
    upcoming: null,
    applications: null,
    lessonPlans: null,
    recommendations: null,
    dashboard: null,
  },
};

// Trainings
export const fetchPrincipalTrainings = createAsyncThunk(
  'principalTraining/fetchTrainings',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { forceRefresh, ...apiParams } = params || {};
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.trainings;
      const hasQueryParams = Object.keys(params || {}).some((key) => key !== 'forceRefresh');

      if (!params?.forceRefresh && !hasQueryParams && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getTrainings(apiParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch trainings');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().principalTraining;
      if (params?.forceRefresh) return true;
      return !state.trainings.loading;
    },
  }
);

export const fetchPrincipalTrainingDetails = createAsyncThunk(
  'principalTraining/fetchTrainingDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getTrainingDetails(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training');
    }
  }
);

export const fetchPrincipalTrainingStats = createAsyncThunk(
  'principalTraining/fetchTrainingStats',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getTrainingStats(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training stats');
    }
  }
);

export const fetchPrincipalCalendar = createAsyncThunk(
  'principalTraining/fetchCalendar',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { forceRefresh, ...apiParams } = params || {};
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.calendar;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getCalendar(apiParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch calendar');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().principalTraining;
      if (params?.forceRefresh) return true;
      return !state.calendar.loading;
    },
  }
);

export const fetchPrincipalUpcoming = createAsyncThunk(
  'principalTraining/fetchUpcoming',
  async (limit = 10, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.upcoming;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getUpcoming(limit);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch upcoming trainings');
    }
  }
);

// Applications
export const fetchPrincipalApplications = createAsyncThunk(
  'principalTraining/fetchApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { forceRefresh, ...apiParams } = params || {};
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.applications;
      const hasQueryParams = Object.keys(params || {}).some((key) => key !== 'forceRefresh');

      if (!params?.forceRefresh && !hasQueryParams && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getApplications(apiParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().principalTraining;
      if (params?.forceRefresh) return true;
      return !state.applications.loading;
    },
  }
);

export const reviewPrincipalApplication = createAsyncThunk(
  'principalTraining/reviewApplication',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.reviewApplication(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review application');
    }
  }
);

export const bulkReviewPrincipalApplications = createAsyncThunk(
  'principalTraining/bulkReviewApplications',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.bulkReviewApplications(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk review applications');
    }
  }
);

export const fetchPrincipalApplicationStats = createAsyncThunk(
  'principalTraining/fetchApplicationStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getApplicationStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch application stats');
    }
  }
);

// Lesson Plans
export const fetchPrincipalLessonPlans = createAsyncThunk(
  'principalTraining/fetchLessonPlans',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { forceRefresh, ...apiParams } = params || {};
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.lessonPlans;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getLessonPlans(apiParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch lesson plans');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().principalTraining;
      if (params?.forceRefresh) return true;
      return !state.lessonPlans.loading;
    },
  }
);

export const reviewPrincipalLessonPlan = createAsyncThunk(
  'principalTraining/reviewLessonPlan',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.reviewLessonPlan(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review lesson plan');
    }
  }
);

export const fetchPrincipalPendingLessonPlans = createAsyncThunk(
  'principalTraining/fetchPendingLessonPlans',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getPendingLessonPlans();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch pending lesson plans');
    }
  }
);

export const fetchPrincipalLessonPlanStats = createAsyncThunk(
  'principalTraining/fetchLessonPlanStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getLessonPlanStats();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch lesson plan stats');
    }
  }
);

// Reports
export const fetchPrincipalTrainingDashboard = createAsyncThunk(
  'principalTraining/fetchDashboard',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.dashboard;

      if (isCacheValid(lastFetched, CACHE_DURATIONS.DEFAULT)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().principalTraining;
      return !state.reports.loading;
    },
  }
);

export const fetchPrincipalAttendanceReport = createAsyncThunk(
  'principalTraining/fetchAttendanceReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getAttendanceReport(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch attendance report');
    }
  }
);

export const fetchPrincipalCertificates = createAsyncThunk(
  'principalTraining/fetchCertificates',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getCertificates();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch certificates');
    }
  }
);

export const fetchPrincipalParticipationReport = createAsyncThunk(
  'principalTraining/fetchParticipationReport',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getParticipationReport();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch participation report');
    }
  }
);

export const fetchPrincipalFeedbackSummary = createAsyncThunk(
  'principalTraining/fetchFeedbackSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.getFeedbackSummary(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback summary');
    }
  }
);

// Recommendations
export const fetchPrincipalRecommendations = createAsyncThunk(
  'principalTraining/fetchRecommendations',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { forceRefresh, ...apiParams } = params || {};
      const state = getState();
      const lastFetched = state.principalTraining.lastFetched.recommendations;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingPrincipalService.getRecommendations(apiParams);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch recommendations');
    }
  },
  {
    condition: (params = {}, { getState }) => {
      const state = getState().principalTraining;
      if (params?.forceRefresh) return true;
      return !state.recommendations.loading;
    },
  }
);

export const reviewPrincipalRecommendation = createAsyncThunk(
  'principalTraining/reviewRecommendation',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingPrincipalService.reviewRecommendation(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review recommendation');
    }
  }
);

const principalTrainingSlice = createSlice({
  name: 'principalTraining',
  initialState,
  reducers: {
    clearCurrentTraining: (state) => {
      state.currentTraining.data = null;
      state.currentTraining.stats = null;
      state.currentTraining.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Trainings
      .addCase(fetchPrincipalTrainings.pending, (state) => {
        state.trainings.loading = true;
        state.trainings.error = null;
      })
      .addCase(fetchPrincipalTrainings.fulfilled, (state, action) => {
        state.trainings.loading = false;
        if (!action.payload?.cached) {
          const list = action.payload?.data || action.payload?.items || action.payload || [];
          state.trainings.list = Array.isArray(list) ? list : [];
          state.trainings.pagination = {
            page: action.payload?.pagination?.page || 1,
            limit: action.payload?.pagination?.limit || state.trainings.pagination.limit || 10,
            total: action.payload?.pagination?.total || (Array.isArray(list) ? list.length : 0),
            totalPages: action.payload?.pagination?.totalPages || 1,
          };
          state.lastFetched.trainings = Date.now();
        }
      })
      .addCase(fetchPrincipalTrainings.rejected, (state, action) => {
        state.trainings.loading = false;
        state.trainings.error = action.payload;
      })
      .addCase(fetchPrincipalTrainingDetails.fulfilled, (state, action) => {
        state.currentTraining.data = action.payload;
      })
      .addCase(fetchPrincipalTrainingStats.fulfilled, (state, action) => {
        state.currentTraining.stats = action.payload;
      })

      // Calendar & Upcoming
      .addCase(fetchPrincipalCalendar.pending, (state) => {
        state.calendar.loading = true;
        state.calendar.error = null;
      })
      .addCase(fetchPrincipalCalendar.fulfilled, (state, action) => {
        state.calendar.loading = false;
        if (!action.payload?.cached) {
          state.calendar.list = action.payload || [];
          state.lastFetched.calendar = Date.now();
        }
      })
      .addCase(fetchPrincipalCalendar.rejected, (state, action) => {
        state.calendar.loading = false;
        state.calendar.error = action.payload;
      })
      .addCase(fetchPrincipalUpcoming.fulfilled, (state, action) => {
        if (!action.payload?.cached) {
          state.upcoming.list = action.payload || [];
          state.lastFetched.upcoming = Date.now();
        }
      })

      // Applications
      .addCase(fetchPrincipalApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchPrincipalApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload?.cached) {
          const list = action.payload?.data || action.payload?.items || action.payload || [];
          state.applications.list = Array.isArray(list) ? list : [];
          state.applications.pagination = {
            page: action.payload?.pagination?.page || 1,
            limit: action.payload?.pagination?.limit || state.applications.pagination.limit || 10,
            total: action.payload?.pagination?.total || (Array.isArray(list) ? list.length : 0),
            totalPages: action.payload?.pagination?.totalPages || 1,
          };
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchPrincipalApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(reviewPrincipalApplication.fulfilled, (state, action) => {
        const index = state.applications.list.findIndex((app) => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        // Invalidate training cache to refresh capacity counts
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
      })
      .addCase(bulkReviewPrincipalApplications.fulfilled, (state) => {
        // Invalidate training cache after bulk review to refresh capacity counts
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
        state.lastFetched.applications = null;
      })
      .addCase(fetchPrincipalApplicationStats.fulfilled, (state, action) => {
        state.applicationStats.data = action.payload;
      })

      // Lesson plans
      .addCase(fetchPrincipalLessonPlans.pending, (state) => {
        state.lessonPlans.loading = true;
        state.lessonPlans.error = null;
      })
      .addCase(fetchPrincipalLessonPlans.fulfilled, (state, action) => {
        state.lessonPlans.loading = false;
        if (!action.payload?.cached) {
          state.lessonPlans.list = action.payload?.data || action.payload?.items || action.payload || [];
          state.lessonPlans.pagination = action.payload?.pagination || null;
          state.lastFetched.lessonPlans = Date.now();
        }
      })
      .addCase(fetchPrincipalLessonPlans.rejected, (state, action) => {
        state.lessonPlans.loading = false;
        state.lessonPlans.error = action.payload;
      })
      .addCase(reviewPrincipalLessonPlan.fulfilled, (state, action) => {
        const index = state.lessonPlans.list.findIndex((plan) => plan.id === action.payload.id);
        if (index !== -1) {
          state.lessonPlans.list[index] = action.payload;
        }
      })
      .addCase(fetchPrincipalPendingLessonPlans.fulfilled, (state, action) => {
        state.lessonPlans.pending = action.payload || [];
      })
      .addCase(fetchPrincipalLessonPlanStats.fulfilled, (state, action) => {
        state.lessonPlanStats.data = action.payload;
      })

      // Reports
      .addCase(fetchPrincipalTrainingDashboard.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchPrincipalTrainingDashboard.fulfilled, (state, action) => {
        state.reports.loading = false;
        if (!action.payload?.cached) {
          state.reports.dashboard = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchPrincipalTrainingDashboard.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(fetchPrincipalAttendanceReport.fulfilled, (state, action) => {
        state.reports.attendance = action.payload;
      })
      .addCase(fetchPrincipalCertificates.fulfilled, (state, action) => {
        state.reports.certificates = action.payload || [];
      })
      .addCase(fetchPrincipalParticipationReport.fulfilled, (state, action) => {
        state.reports.participation = action.payload;
      })
      .addCase(fetchPrincipalFeedbackSummary.fulfilled, (state, action) => {
        state.reports.feedback = action.payload;
      })

      // Recommendations
      .addCase(fetchPrincipalRecommendations.pending, (state) => {
        state.recommendations.loading = true;
        state.recommendations.error = null;
      })
      .addCase(fetchPrincipalRecommendations.fulfilled, (state, action) => {
        state.recommendations.loading = false;
        if (!action.payload?.cached) {
          state.recommendations.list = action.payload?.data || [];
          state.recommendations.statusCounts = action.payload?.statusCounts || {};
          state.lastFetched.recommendations = Date.now();
        }
      })
      .addCase(fetchPrincipalRecommendations.rejected, (state, action) => {
        state.recommendations.loading = false;
        state.recommendations.error = action.payload;
      })
      .addCase(reviewPrincipalRecommendation.fulfilled, (state, action) => {
        const index = state.recommendations.list.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.recommendations.list[index] = action.payload;
        }
        state.lastFetched.recommendations = null;
      });
  },
});

export const { clearCurrentTraining } = principalTrainingSlice.actions;
export default principalTrainingSlice.reducer;
