import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import trainingAdminService from '../../../services/training-admin.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  trainings: {
    list: [],
    loading: false,
    error: null,
  },
  currentTraining: {
    data: null,
    stats: null,
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    loading: false,
    error: null,
  },
  attendance: {
    list: [],
    loading: false,
    error: null,
  },
  certificates: {
    list: [],
    loading: false,
    error: null,
  },
  lessonPlans: {
    list: [],
    loading: false,
    error: null,
  },
  feedbackForms: {
    list: [],
    loading: false,
    error: null,
  },
  feedbackResponses: {
    data: null,
    loading: false,
    error: null,
  },
  feedbackStats: {
    data: null,
    loading: false,
    error: null,
  },
  reports: {
    dashboard: null,
    calendar: [],
    upcoming: [],
    attendance: null,
    loading: false,
    error: null,
  },
  lastFetched: {
    trainings: null,
    applications: null,
    lessonPlans: null,
    feedbackForms: null,
    reportsDashboard: null,
  },
};

// Trainings
export const fetchStateTrainings = createAsyncThunk(
  'stateTraining/fetchTrainings',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.stateTraining.lastFetched.trainings;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingAdminService.getTrainings(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch trainings');
    }
  }
);

export const fetchStateTrainingDetails = createAsyncThunk(
  'stateTraining/fetchTrainingDetails',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getTrainingDetails(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training');
    }
  }
);

export const fetchStateTrainingStats = createAsyncThunk(
  'stateTraining/fetchTrainingStats',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getTrainingStats(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch training stats');
    }
  }
);

export const createStateTraining = createAsyncThunk(
  'stateTraining/createTraining',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.createTraining(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create training');
    }
  }
);

export const updateStateTraining = createAsyncThunk(
  'stateTraining/updateTraining',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.updateTraining(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update training');
    }
  }
);

export const deleteStateTraining = createAsyncThunk(
  'stateTraining/deleteTraining',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.deleteTraining(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete training');
    }
  }
);

export const publishStateTraining = createAsyncThunk(
  'stateTraining/publishTraining',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.publishTraining(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to publish training');
    }
  }
);

export const unpublishStateTraining = createAsyncThunk(
  'stateTraining/unpublishTraining',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.unpublishTraining(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unpublish training');
    }
  }
);

// Applications
export const fetchStateApplications = createAsyncThunk(
  'stateTraining/fetchApplications',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.stateTraining.lastFetched.applications;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingAdminService.getAllApplications(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

export const reviewStateApplication = createAsyncThunk(
  'stateTraining/reviewApplication',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.reviewApplication(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review application');
    }
  }
);

export const bulkReviewStateApplications = createAsyncThunk(
  'stateTraining/bulkReviewApplications',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.bulkReviewApplications(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk review applications');
    }
  }
);

// Attendance
export const fetchStateTrainingAttendance = createAsyncThunk(
  'stateTraining/fetchTrainingAttendance',
  async ({ trainingId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getTrainingAttendance(trainingId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch attendance');
    }
  }
);

export const markStateBulkAttendance = createAsyncThunk(
  'stateTraining/markBulkAttendance',
  async ({ trainingId, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.markBulkAttendance(trainingId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark attendance');
    }
  }
);

// Certificates
export const fetchStateTrainingCertificates = createAsyncThunk(
  'stateTraining/fetchTrainingCertificates',
  async ({ trainingId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getTrainingCertificates(trainingId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch certificates');
    }
  }
);

export const issueStateCertificate = createAsyncThunk(
  'stateTraining/issueCertificate',
  async ({ trainingId, userId }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.issueCertificate(trainingId, userId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to issue certificate');
    }
  }
);

export const bulkIssueStateCertificates = createAsyncThunk(
  'stateTraining/bulkIssueCertificates',
  async ({ trainingId, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.bulkIssueCertificates(trainingId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to bulk issue certificates');
    }
  }
);

export const revokeStateCertificate = createAsyncThunk(
  'stateTraining/revokeCertificate',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.revokeCertificate(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to revoke certificate');
    }
  }
);

// Lesson Plans
export const fetchStateLessonPlans = createAsyncThunk(
  'stateTraining/fetchLessonPlans',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.stateTraining.lastFetched.lessonPlans;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingAdminService.getLessonPlans(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch lesson plans');
    }
  }
);

export const reviewStateLessonPlan = createAsyncThunk(
  'stateTraining/reviewLessonPlan',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.reviewLessonPlan(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to review lesson plan');
    }
  }
);

// Feedback Forms
export const fetchStateFeedbackForms = createAsyncThunk(
  'stateTraining/fetchFeedbackForms',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.stateTraining.lastFetched.feedbackForms;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await trainingAdminService.getFeedbackForms(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback forms');
    }
  }
);

export const createStateFeedbackForm = createAsyncThunk(
  'stateTraining/createFeedbackForm',
  async (data, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.createFeedbackForm(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create feedback form');
    }
  }
);

export const updateStateFeedbackForm = createAsyncThunk(
  'stateTraining/updateFeedbackForm',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.updateFeedbackForm(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update feedback form');
    }
  }
);

export const deleteStateFeedbackForm = createAsyncThunk(
  'stateTraining/deleteFeedbackForm',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.deleteFeedbackForm(id);
      return { id, response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete feedback form');
    }
  }
);

export const publishStateFeedbackForm = createAsyncThunk(
  'stateTraining/publishFeedbackForm',
  async (id, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.publishFeedbackForm(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to publish feedback form');
    }
  }
);

export const duplicateStateFeedbackForm = createAsyncThunk(
  'stateTraining/duplicateFeedbackForm',
  async ({ id, title }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.duplicateFeedbackForm(id, title);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to duplicate feedback form');
    }
  }
);

export const assignStateFeedbackForm = createAsyncThunk(
  'stateTraining/assignFeedbackForm',
  async ({ formId, trainingId }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.assignFeedbackForm(formId, trainingId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to assign feedback form');
    }
  }
);

export const fetchStateFeedbackResponses = createAsyncThunk(
  'stateTraining/fetchFeedbackResponses',
  async ({ formId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getFeedbackResponses(formId, params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback responses');
    }
  }
);

export const fetchStateFeedbackStats = createAsyncThunk(
  'stateTraining/fetchFeedbackStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getFeedbackStats(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feedback stats');
    }
  }
);

// Reports
export const fetchStateTrainingDashboard = createAsyncThunk(
  'stateTraining/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchStateTrainingCalendar = createAsyncThunk(
  'stateTraining/fetchCalendar',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getCalendar(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch calendar');
    }
  }
);

export const fetchStateTrainingUpcoming = createAsyncThunk(
  'stateTraining/fetchUpcoming',
  async (limit = 10, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getUpcoming(limit);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch upcoming');
    }
  }
);

export const fetchStateAttendanceReport = createAsyncThunk(
  'stateTraining/fetchAttendanceReport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await trainingAdminService.getAttendanceReport(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch attendance report');
    }
  }
);

const stateTrainingSlice = createSlice({
  name: 'stateTraining',
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
      .addCase(fetchStateTrainings.pending, (state) => {
        state.trainings.loading = true;
        state.trainings.error = null;
      })
      .addCase(fetchStateTrainings.fulfilled, (state, action) => {
        state.trainings.loading = false;
        if (!action.payload?.cached) {
          state.trainings.list = action.payload?.data || action.payload?.items || action.payload || [];
          state.lastFetched.trainings = Date.now();
        }
      })
      .addCase(fetchStateTrainings.rejected, (state, action) => {
        state.trainings.loading = false;
        state.trainings.error = action.payload;
      })
      .addCase(fetchStateTrainingDetails.fulfilled, (state, action) => {
        state.currentTraining.data = action.payload;
      })
      .addCase(fetchStateTrainingStats.fulfilled, (state, action) => {
        state.currentTraining.stats = action.payload;
      })
      .addCase(createStateTraining.fulfilled, (state, action) => {
        state.trainings.list = [action.payload, ...state.trainings.list];
      })
      .addCase(updateStateTraining.fulfilled, (state, action) => {
        const index = state.trainings.list.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.trainings.list[index] = action.payload;
        }
        if (state.currentTraining.data?.id === action.payload.id) {
          state.currentTraining.data = action.payload;
        }
      })
      .addCase(deleteStateTraining.fulfilled, (state, action) => {
        state.trainings.list = state.trainings.list.filter((t) => t.id !== action.payload.id);
      })
      .addCase(publishStateTraining.fulfilled, (state, action) => {
        const index = state.trainings.list.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.trainings.list[index] = action.payload;
        }
      })
      .addCase(unpublishStateTraining.fulfilled, (state, action) => {
        const index = state.trainings.list.findIndex((t) => t.id === action.payload.id);
        if (index !== -1) {
          state.trainings.list[index] = action.payload;
        }
      })

      // Applications
      .addCase(fetchStateApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchStateApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload?.cached) {
          state.applications.list = action.payload?.data || action.payload?.items || action.payload || [];
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchStateApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(reviewStateApplication.fulfilled, (state, action) => {
        const index = state.applications.list.findIndex((app) => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        // Invalidate training cache to refresh capacity counts
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
      })
      .addCase(bulkReviewStateApplications.fulfilled, (state) => {
        // Invalidate training cache after bulk review to refresh capacity counts
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
        state.lastFetched.applications = null;
      })

      // Attendance
      .addCase(fetchStateTrainingAttendance.pending, (state) => {
        state.attendance.loading = true;
        state.attendance.error = null;
      })
      .addCase(fetchStateTrainingAttendance.fulfilled, (state, action) => {
        state.attendance.loading = false;
        state.attendance.list = action.payload || [];
      })
      .addCase(fetchStateTrainingAttendance.rejected, (state, action) => {
        state.attendance.loading = false;
        state.attendance.error = action.payload;
      })

      // Certificates
      .addCase(fetchStateTrainingCertificates.pending, (state) => {
        state.certificates.loading = true;
        state.certificates.error = null;
      })
      .addCase(fetchStateTrainingCertificates.fulfilled, (state, action) => {
        state.certificates.loading = false;
        state.certificates.list = action.payload || [];
      })
      .addCase(fetchStateTrainingCertificates.rejected, (state, action) => {
        state.certificates.loading = false;
        state.certificates.error = action.payload;
      })
      .addCase(issueStateCertificate.fulfilled, (state, action) => {
        state.certificates.list = [action.payload, ...state.certificates.list];
      })

      // Lesson plans
      .addCase(fetchStateLessonPlans.pending, (state) => {
        state.lessonPlans.loading = true;
        state.lessonPlans.error = null;
      })
      .addCase(fetchStateLessonPlans.fulfilled, (state, action) => {
        state.lessonPlans.loading = false;
        if (!action.payload?.cached) {
          state.lessonPlans.list = action.payload?.data || action.payload?.items || action.payload || [];
          state.lastFetched.lessonPlans = Date.now();
        }
      })
      .addCase(fetchStateLessonPlans.rejected, (state, action) => {
        state.lessonPlans.loading = false;
        state.lessonPlans.error = action.payload;
      })
      .addCase(reviewStateLessonPlan.fulfilled, (state, action) => {
        const index = state.lessonPlans.list.findIndex((plan) => plan.id === action.payload.id);
        if (index !== -1) {
          state.lessonPlans.list[index] = action.payload;
        }
      })

      // Feedback forms
      .addCase(fetchStateFeedbackForms.pending, (state) => {
        state.feedbackForms.loading = true;
        state.feedbackForms.error = null;
      })
      .addCase(fetchStateFeedbackForms.fulfilled, (state, action) => {
        state.feedbackForms.loading = false;
        if (!action.payload?.cached) {
          state.feedbackForms.list = action.payload?.data || action.payload?.items || action.payload || [];
          state.lastFetched.feedbackForms = Date.now();
        }
      })
      .addCase(fetchStateFeedbackForms.rejected, (state, action) => {
        state.feedbackForms.loading = false;
        state.feedbackForms.error = action.payload;
      })
      .addCase(createStateFeedbackForm.fulfilled, (state, action) => {
        state.feedbackForms.list = [action.payload, ...state.feedbackForms.list];
      })
      .addCase(updateStateFeedbackForm.fulfilled, (state, action) => {
        const index = state.feedbackForms.list.findIndex((form) => form.id === action.payload.id);
        if (index !== -1) {
          state.feedbackForms.list[index] = action.payload;
        }
      })
      .addCase(deleteStateFeedbackForm.fulfilled, (state, action) => {
        state.feedbackForms.list = state.feedbackForms.list.filter((form) => form.id !== action.payload.id);
      })
      .addCase(publishStateFeedbackForm.fulfilled, (state, action) => {
        const index = state.feedbackForms.list.findIndex((form) => form.id === action.payload.id);
        if (index !== -1) {
          state.feedbackForms.list[index] = action.payload;
        }
      })

      // Feedback responses
      .addCase(fetchStateFeedbackResponses.pending, (state) => {
        state.feedbackResponses.loading = true;
        state.feedbackResponses.error = null;
      })
      .addCase(fetchStateFeedbackResponses.fulfilled, (state, action) => {
        state.feedbackResponses.loading = false;
        state.feedbackResponses.data = action.payload;
      })
      .addCase(fetchStateFeedbackResponses.rejected, (state, action) => {
        state.feedbackResponses.loading = false;
        state.feedbackResponses.error = action.payload;
      })
      .addCase(fetchStateFeedbackStats.pending, (state) => {
        state.feedbackStats.loading = true;
        state.feedbackStats.error = null;
      })
      .addCase(fetchStateFeedbackStats.fulfilled, (state, action) => {
        state.feedbackStats.loading = false;
        state.feedbackStats.data = action.payload;
      })
      .addCase(fetchStateFeedbackStats.rejected, (state, action) => {
        state.feedbackStats.loading = false;
        state.feedbackStats.data = null;
        state.feedbackStats.error = action.payload;
      })

      // Reports
      .addCase(fetchStateTrainingDashboard.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchStateTrainingDashboard.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.dashboard = action.payload;
        state.lastFetched.reportsDashboard = Date.now();
      })
      .addCase(fetchStateTrainingDashboard.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(fetchStateTrainingCalendar.fulfilled, (state, action) => {
        state.reports.calendar = action.payload || [];
      })
      .addCase(fetchStateTrainingUpcoming.fulfilled, (state, action) => {
        state.reports.upcoming = action.payload || [];
      })
      .addCase(fetchStateAttendanceReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchStateAttendanceReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        state.reports.attendance = action.payload;
      })
      .addCase(fetchStateAttendanceReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.attendance = null;
        state.reports.error = action.payload;
      });
  },
});

export const { clearCurrentTraining } = stateTrainingSlice.actions;
export default stateTrainingSlice.reducer;
