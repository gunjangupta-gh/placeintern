import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import studentService from '../../../services/student.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  dashboard: {
    stats: null,
    loading: false,
    error: null,
  },
  profile: {
    data: null,
    loading: false,
    error: null,
  },
  internships: {
    list: [],
    loading: false,
    error: null,
  },
  reports: {
    list: [],
    loading: false,
    error: null,
  },
  enrollments: {
    list: [],
    loading: false,
    error: null,
  },
  applications: {
    list: [],
    loading: false,
    error: null,
  },
  mentor: {
    data: null,
    loading: false,
    error: null,
  },
  grievances: {
    list: [],
    loading: false,
    error: null,
  },
  selfIdentified: {
    list: [],
    loading: false,
    error: null,
  },
  lastFetched: {
    dashboard: null,
    profile: null,
    internships: null,
    reports: null,
    enrollments: null,
    applications: null,
    mentor: null,
    grievances: null,
    selfIdentified: null,
  },
};

export const fetchStudentDashboard = createAsyncThunk(
  'student/fetchDashboard',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.dashboard;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.DASHBOARD)) {
        return { cached: true };
      }

      const response = await studentService.getDashboard();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch dashboard');
    }
  }
);

export const fetchStudentProfile = createAsyncThunk(
  'student/fetchProfile',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.profile;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.PROFILE)) {
        return { cached: true };
      }

      const response = await studentService.getProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

export const fetchMyInternships = createAsyncThunk(
  'student/fetchMyInternships',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.internships;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getMyInternships(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch internships');
    }
  }
);

export const fetchMyReports = createAsyncThunk(
  'student/fetchMyReports',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.reports;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getMyReports(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports');
    }
  }
);

// Enrollments
export const fetchEnrollments = createAsyncThunk(
  'student/fetchEnrollments',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.enrollments;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getEnrollments();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch enrollments');
    }
  }
);

// Reports CRUD
export const createReport = createAsyncThunk(
  'student/createReport',
  async (reportData, { rejectWithValue }) => {
    try {
      const response = await studentService.createReport(reportData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create report');
    }
  }
);

export const updateReport = createAsyncThunk(
  'student/updateReport',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await studentService.updateReport(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update report');
    }
  }
);

// Profile update
export const updateProfile = createAsyncThunk(
  'student/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const response = await studentService.updateProfile(profileData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update profile');
    }
  }
);

// Internship application - STUBBED (industry internship browsing removed)
export const applyForInternship = createAsyncThunk(
  'student/applyForInternship',
  async ({ internshipId, applicationData }, { rejectWithValue }) => {
    return rejectWithValue('Industry internship browsing has been removed. Please use self-identified internships.');
  }
);

// Available internships - STUBBED (industry internship browsing removed)
export const fetchAvailableInternships = createAsyncThunk(
  'student/fetchAvailableInternships',
  async (filters, { rejectWithValue }) => {
    return rejectWithValue('Industry internship browsing has been removed. Please use self-identified internships.');
  }
);

// Applications
export const fetchApplications = createAsyncThunk(
  'student/fetchApplications',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.applications;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getApplications();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch applications');
    }
  }
);

// Submit report (alias for createReport for consistency)
export const submitReport = createReport;

// Alias for fetchStudentProfile for consistency
export const fetchProfile = fetchStudentProfile;

// Aliases for monthly reports (same as regular reports)
export const createMonthlyReport = createReport;
export const updateMonthlyReport = updateReport;

// Alias for fetchAvailableInternships
export const fetchInternships = fetchAvailableInternships;

// Mentor - extracted from profile data (no separate API call needed)
export const fetchMentor = createAsyncThunk(
  'student/fetchMentor',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.mentor;

      // Check cache first
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.PROFILE)) {
        return { cached: true };
      }

      // If profile is already loaded, extract mentor from it
      if (state.student.profile.data) {
        const profile = state.student.profile.data;
        // Mentor is in mentorAssignments array - get active assignment
        const activeAssignment = profile.mentorAssignments?.find(a => a.isActive);
        return activeAssignment?.mentor || null;
      }
      // Only fetch profile if not already loaded
      const response = await studentService.getProfile();
      const activeAssignment = response?.mentorAssignments?.find(a => a.isActive);
      return activeAssignment?.mentor || null;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch mentor');
    }
  }
);

// Grievances
export const fetchGrievances = createAsyncThunk(
  'student/fetchGrievances',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.grievances;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getGrievances(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch grievances');
    }
  }
);

export const createGrievance = createAsyncThunk(
  'student/createGrievance',
  async (grievanceData, { rejectWithValue }) => {
    try {
      const response = await studentService.submitGrievance(grievanceData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create grievance');
    }
  }
);

// Self-identified internships
export const fetchSelfIdentified = createAsyncThunk(
  'student/fetchSelfIdentified',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.student.lastFetched.selfIdentified;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.LISTS)) {
        return { cached: true };
      }

      const response = await studentService.getSelfIdentified(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch self-identified internships');
    }
  }
);

// Application actions
export const withdrawApplication = createAsyncThunk(
  'student/withdrawApplication',
  async (applicationId, { rejectWithValue }) => {
    try {
      // Use student service endpoint - withdraw is handled via update with status
      const response = await studentService.withdrawApplication(applicationId);
      return { id: applicationId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to withdraw application');
    }
  }
);

export const updateApplication = createAsyncThunk(
  'student/updateApplication',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      // Applications are managed via student portal
      const response = await studentService.updateApplication(id, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update application');
    }
  }
);

// Monthly report submission
export const submitMonthlyReport = createAsyncThunk(
  'student/submitMonthlyReport',
  async ({ reportId, data }, { rejectWithValue }) => {
    try {
      const response = await studentService.updateMonthlyReport(reportId, data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit report');
    }
  }
);

export const uploadReportFile = createAsyncThunk(
  'student/uploadReportFile',
  async ({ file, documentData = {} }, { rejectWithValue }) => {
    try {
      const response = await studentService.uploadDocument(file, documentData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload report');
    }
  }
);

export const deleteMonthlyReport = createAsyncThunk(
  'student/deleteMonthlyReport',
  async (reportId, { rejectWithValue }) => {
    try {
      await studentService.deleteMonthlyReport(reportId);
      return { id: reportId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete report');
    }
  }
);

// Self-identified internship submission
export const submitSelfIdentified = createAsyncThunk(
  'student/submitSelfIdentified',
  async (data, { rejectWithValue }) => {
    try {
      const response = await studentService.submitSelfIdentified(data);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit self-identified internship');
    }
  }
);

// Joining report actions
export const uploadJoiningLetter = createAsyncThunk(
  'student/uploadJoiningLetter',
  async ({ applicationId, file }, { rejectWithValue }) => {
    try {
      const response = await studentService.uploadJoiningLetter(applicationId, file);
      return { id: applicationId, ...response };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to upload joining report');
    }
  }
);

export const deleteJoiningLetter = createAsyncThunk(
  'student/deleteJoiningLetter',
  async (applicationId, { rejectWithValue }) => {
    try {
      await studentService.deleteJoiningLetter(applicationId);
      return { id: applicationId };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete joining report');
    }
  }
);

// Fetch single internship details
export const fetchInternshipDetails = createAsyncThunk(
  'student/fetchInternshipDetails',
  async (internshipId, { rejectWithValue }) => {
    try {
      const response = await studentService.getInternshipDetails(internshipId);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch internship details');
    }
  }
);

const studentSlice = createSlice({
  name: 'student',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Dashboard
      .addCase(fetchStudentDashboard.pending, (state) => {
        state.dashboard.loading = true;
        state.dashboard.error = null;
      })
      .addCase(fetchStudentDashboard.fulfilled, (state, action) => {
        state.dashboard.loading = false;
        if (!action.payload.cached) {
          state.dashboard.stats = action.payload;
          state.lastFetched.dashboard = Date.now();
        }
      })
      .addCase(fetchStudentDashboard.rejected, (state, action) => {
        state.dashboard.loading = false;
        state.dashboard.error = action.payload;
      })

      // Profile
      .addCase(fetchStudentProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(fetchStudentProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        if (!action.payload.cached) {
          state.profile.data = action.payload;
          state.lastFetched.profile = Date.now();
        }
      })
      .addCase(fetchStudentProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })
      .addCase(updateProfile.pending, (state) => {
        state.profile.loading = true;
        state.profile.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile.loading = false;
        state.profile.data = action.payload;
        state.lastFetched.profile = Date.now();
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.profile.loading = false;
        state.profile.error = action.payload;
      })

      // My Internships
      .addCase(fetchMyInternships.pending, (state) => {
        state.internships.loading = true;
        state.internships.error = null;
      })
      .addCase(fetchMyInternships.fulfilled, (state, action) => {
        state.internships.loading = false;
        if (!action.payload.cached) {
          state.internships.list = action.payload.data || action.payload;
          state.lastFetched.internships = Date.now();
        }
      })
      .addCase(fetchMyInternships.rejected, (state, action) => {
        state.internships.loading = false;
        state.internships.error = action.payload;
      })

      // Available Internships - REMOVED (industry internship browsing removed)
      // Apply for internship - REMOVED (industry internship browsing removed)

      // Reports
      .addCase(fetchMyReports.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(fetchMyReports.fulfilled, (state, action) => {
        state.reports.loading = false;
        if (!action.payload.cached) {
          // Handle different response formats
          const payload = action.payload;
          if (Array.isArray(payload)) {
            state.reports.list = payload;
          } else if (payload.reports && Array.isArray(payload.reports)) {
            state.reports.list = payload.reports;
          } else if (payload.data && Array.isArray(payload.data)) {
            state.reports.list = payload.data;
          } else {
            state.reports.list = [];
          }
          state.lastFetched.reports = Date.now();
        }
      })
      .addCase(fetchMyReports.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(createReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(createReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        // Ensure state.reports.list is an array
        if (!Array.isArray(state.reports.list)) {
          state.reports.list = [];
        }
        state.reports.list = [action.payload, ...state.reports.list];
        // Invalidate all caches that contain report counts
        state.lastFetched.reports = null;
        state.lastFetched.dashboard = null;
        state.lastFetched.applications = null;
        state.lastFetched.profile = null;
      })
      .addCase(createReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })
      .addCase(updateReport.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(updateReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        // Ensure state.reports.list is an array
        if (!Array.isArray(state.reports.list)) {
          state.reports.list = [];
        }
        const index = state.reports.list.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reports.list[index] = action.payload;
        }
        // Invalidate all caches that contain report counts
        state.lastFetched.reports = null;
        state.lastFetched.dashboard = null;
        state.lastFetched.applications = null;
        state.lastFetched.profile = null;
      })
      .addCase(updateReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Enrollments
      .addCase(fetchEnrollments.pending, (state) => {
        state.enrollments.loading = true;
        state.enrollments.error = null;
      })
      .addCase(fetchEnrollments.fulfilled, (state, action) => {
        state.enrollments.loading = false;
        if (!action.payload.cached) {
          state.enrollments.list = action.payload.data || action.payload;
          state.lastFetched.enrollments = Date.now();
        }
      })
      .addCase(fetchEnrollments.rejected, (state, action) => {
        state.enrollments.loading = false;
        state.enrollments.error = action.payload;
      })

      // Applications - handle response structure: { applications, total, page, limit, totalPages }
      .addCase(fetchApplications.pending, (state) => {
        state.applications.loading = true;
        state.applications.error = null;
      })
      .addCase(fetchApplications.fulfilled, (state, action) => {
        state.applications.loading = false;
        if (!action.payload.cached) {
          // Handle backend response structure
          state.applications.list = action.payload.applications || action.payload.data || action.payload;
          state.lastFetched.applications = Date.now();
        }
      })
      .addCase(fetchApplications.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Mentor
      .addCase(fetchMentor.pending, (state) => {
        state.mentor.loading = true;
        state.mentor.error = null;
      })
      .addCase(fetchMentor.fulfilled, (state, action) => {
        state.mentor.loading = false;
        if (!action.payload?.cached) {
          state.mentor.data = action.payload;
          state.lastFetched.mentor = Date.now();
        }
      })
      .addCase(fetchMentor.rejected, (state, action) => {
        state.mentor.loading = false;
        state.mentor.error = action.payload;
      })

      // Grievances
      .addCase(fetchGrievances.pending, (state) => {
        state.grievances.loading = true;
        state.grievances.error = null;
      })
      .addCase(fetchGrievances.fulfilled, (state, action) => {
        state.grievances.loading = false;
        if (!action.payload?.cached) {
          // Ensure we always get an array
          const data = action.payload?.data || action.payload?.grievances || action.payload;
          state.grievances.list = Array.isArray(data) ? data : [];
          state.lastFetched.grievances = Date.now();
        }
      })
      .addCase(fetchGrievances.rejected, (state, action) => {
        state.grievances.loading = false;
        state.grievances.error = action.payload;
      })
      .addCase(createGrievance.pending, (state) => {
        state.grievances.loading = true;
      })
      .addCase(createGrievance.fulfilled, (state, action) => {
        state.grievances.loading = false;
        state.grievances.list = [action.payload, ...state.grievances.list];
        state.lastFetched.grievances = null; // Invalidate cache after mutation
      })
      .addCase(createGrievance.rejected, (state, action) => {
        state.grievances.loading = false;
        state.grievances.error = action.payload;
      })

      // Application actions
      .addCase(withdrawApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(withdrawApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        state.applications.list = state.applications.list.filter(
          app => app.id !== action.payload.id
        );
        state.lastFetched.applications = null; // Invalidate cache after mutation
      })
      .addCase(withdrawApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })
      .addCase(updateApplication.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(updateApplication.fulfilled, (state, action) => {
        state.applications.loading = false;
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = action.payload;
        }
        state.lastFetched.applications = null; // Invalidate cache after mutation
      })
      .addCase(updateApplication.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Monthly report submission
      .addCase(submitMonthlyReport.pending, (state) => {
        state.reports.loading = true;
      })
      .addCase(submitMonthlyReport.fulfilled, (state, action) => {
        state.reports.loading = false;
        const index = state.reports.list.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.reports.list[index] = action.payload;
        }
        // Invalidate all caches that contain report counts
        state.lastFetched.reports = null;
        state.lastFetched.dashboard = null;
        state.lastFetched.applications = null;
        state.lastFetched.profile = null;
      })
      .addCase(submitMonthlyReport.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Upload report file
      .addCase(uploadReportFile.pending, (state) => {
        state.reports.loading = true;
        state.reports.error = null;
      })
      .addCase(uploadReportFile.fulfilled, (state) => {
        state.reports.loading = false;
      })
      .addCase(uploadReportFile.rejected, (state, action) => {
        state.reports.loading = false;
        state.reports.error = action.payload;
      })

      // Self-identified internships
      .addCase(fetchSelfIdentified.pending, (state) => {
        state.selfIdentified.loading = true;
        state.selfIdentified.error = null;
      })
      .addCase(fetchSelfIdentified.fulfilled, (state, action) => {
        state.selfIdentified.loading = false;
        if (!action.payload.cached) {
          // Handle response structure: { applications, total, page, limit, totalPages }
          state.selfIdentified.list = action.payload.applications || action.payload.data || action.payload;
          state.lastFetched.selfIdentified = Date.now();
        }
      })
      .addCase(fetchSelfIdentified.rejected, (state, action) => {
        state.selfIdentified.loading = false;
        state.selfIdentified.error = action.payload;
      })

      // Delete monthly report
      .addCase(deleteMonthlyReport.fulfilled, (state, action) => {
        // Ensure state.reports.list is an array
        if (!Array.isArray(state.reports.list)) {
          state.reports.list = [];
        }
        state.reports.list = state.reports.list.filter(r => r.id !== action.payload.id);
        // Invalidate all caches that contain report counts
        state.lastFetched.reports = null;
        state.lastFetched.dashboard = null;
        state.lastFetched.applications = null;
        state.lastFetched.profile = null;
      })

      // Submit self-identified
      .addCase(submitSelfIdentified.pending, (state) => {
        state.applications.loading = true;
      })
      .addCase(submitSelfIdentified.fulfilled, (state, action) => {
        state.applications.loading = false;
        state.applications.list = [action.payload, ...state.applications.list];
        state.lastFetched.applications = null;
        state.lastFetched.selfIdentified = null;
      })
      .addCase(submitSelfIdentified.rejected, (state, action) => {
        state.applications.loading = false;
        state.applications.error = action.payload;
      })

      // Upload joining Report
      .addCase(uploadJoiningLetter.fulfilled, (state, action) => {
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index] = { ...state.applications.list[index], ...action.payload };
        }
        state.lastFetched.applications = null;
      })

      // Delete joining report
      .addCase(deleteJoiningLetter.fulfilled, (state, action) => {
        const index = state.applications.list.findIndex(app => app.id === action.payload.id);
        if (index !== -1) {
          state.applications.list[index].joiningLetterUrl = null;
        }
        state.lastFetched.applications = null;
      });
  },
});

export default studentSlice.reducer;
