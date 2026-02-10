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
  },
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
        
        // Optimistically update current training capacity if viewing details
        if (state.currentTraining.data && state.currentTraining.data.id === action.payload.trainingId) {
          if (state.currentTraining.data.capacity) {
            // Note: Backend counts only APPROVED applications for capacity
            // Application starts as SUBMITTED, so capacity won't decrease until approved
            // But we mark that user has applied
            if (state.currentTraining.data.userStatus) {
              state.currentTraining.data.userStatus.hasApplied = true;
              state.currentTraining.data.userStatus.application = action.payload;
            }
          }
        }
        
        // Invalidate training lists cache in case capacity has changed
        state.lastFetched.trainings = null;
        state.lastFetched.calendar = null;
        state.lastFetched.upcoming = null;
      })
      .addCase(withdrawApplication.fulfilled, (state, action) => {
        state.applications.list = state.applications.list.filter((app) => app.id !== action.payload.id);
        
        // Optimistically update current training capacity if viewing details  
        if (state.currentTraining.data) {
          const withdrawnApp = state.applications.list.find(app => app.id === action.payload.id);
          if (withdrawnApp && state.currentTraining.data.id === withdrawnApp.trainingId) {
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
        state.attendance.summary = action.payload;
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
      .addCase(fetchMyFeedbackResponses.fulfilled, (state, action) => {
        state.feedback.responses = action.payload || [];
      })
      .addCase(fetchPendingFeedback.fulfilled, (state, action) => {
        state.feedback.pending = action.payload || [];
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
      });
  },
});

export const { clearCurrentTraining } = facultyTrainingSlice.actions;
export default facultyTrainingSlice.reducer;
