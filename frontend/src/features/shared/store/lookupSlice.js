import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import lookupService from '../../../services/lookup.service';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

/**
 * Lookup Slice - Manages global master data
 * - Departments (global)
 * - Branches (global)
 * - Batches (global)
 * - Institutions (for dropdowns)
 * - Roles (static)
 */

const initialState = {
  // Departments
  departments: {
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
  // Branches
  branches: {
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
  // Batches
  batches: {
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
  // Institutions
  institutions: {
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
  // Roles (static data)
  roles: {
    data: [],
    loading: false,
    error: null,
  },
  // Industries (for dropdowns)
  industries: {
    data: [],
    loading: false,
    error: null,
    lastFetched: null,
  },
};

// ==========================================
// Async Thunks
// ==========================================

export const fetchDepartments = createAsyncThunk(
  'lookup/fetchDepartments',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (isCacheValid(lookup.departments.lastFetched, CACHE_DURATIONS.MASTER_DATA)) {
        return { cached: true, data: lookup.departments.data };
      }
      const response = await lookupService.getDepartments();
      return { cached: false, data: response.departments || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch departments');
    }
  }
);

export const fetchBranches = createAsyncThunk(
  'lookup/fetchBranches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (isCacheValid(lookup.branches.lastFetched, CACHE_DURATIONS.MASTER_DATA)) {
        return { cached: true, data: lookup.branches.data };
      }
      const response = await lookupService.getBranches();
      return { cached: false, data: response.branches || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch branches');
    }
  }
);

export const fetchBatches = createAsyncThunk(
  'lookup/fetchBatches',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (isCacheValid(lookup.batches.lastFetched, CACHE_DURATIONS.MASTER_DATA)) {
        return { cached: true, data: lookup.batches.data };
      }
      const response = await lookupService.getBatches();
      return { cached: false, data: response.batches || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch batches');
    }
  }
);

export const fetchInstitutions = createAsyncThunk(
  'lookup/fetchInstitutions',
  async (includeInactive = false, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (!includeInactive && isCacheValid(lookup.institutions.lastFetched, CACHE_DURATIONS.MASTER_DATA)) {
        return { cached: true, data: lookup.institutions.data };
      }
      const response = await lookupService.getInstitutions(includeInactive);
      return { cached: false, data: response.institutions || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch institutions');
    }
  }
);

export const fetchRoles = createAsyncThunk(
  'lookup/fetchRoles',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (lookup.roles.data.length > 0) {
        return { cached: true, data: lookup.roles.data };
      }
      const response = await lookupService.getRoles();
      return { cached: false, data: response.roles || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch roles');
    }
  }
);

export const fetchIndustries = createAsyncThunk(
  'lookup/fetchIndustries',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { lookup } = getState();
      if (isCacheValid(lookup.industries.lastFetched, CACHE_DURATIONS.LOOKUP)) {
        return { cached: true, data: lookup.industries.data };
      }
      const response = await lookupService.getIndustries();
      return { cached: false, data: response.industries || [] };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch industries');
    }
  }
);

// Fetch all lookup data at once
export const fetchAllLookupData = createAsyncThunk(
  'lookup/fetchAll',
  async (_, { dispatch }) => {
    await Promise.all([
      dispatch(fetchDepartments()),
      dispatch(fetchBranches()),
      dispatch(fetchBatches()),
      dispatch(fetchInstitutions()),
      dispatch(fetchRoles()),
    ]);
    return true;
  }
);

// ==========================================
// Slice
// ==========================================

const lookupSlice = createSlice({
  name: 'lookup',
  initialState,
  reducers: {
    clearLookupCache: (state) => {
      state.departments.lastFetched = null;
      state.branches.lastFetched = null;
      state.batches.lastFetched = null;
      state.institutions.lastFetched = null;
      state.industries.lastFetched = null;
    },
    // For optimistic updates after CRUD operations
    addDepartment: (state, action) => {
      state.departments.data.push(action.payload);
    },
    updateDepartment: (state, action) => {
      const index = state.departments.data.findIndex(d => d.id === action.payload.id);
      if (index !== -1) {
        state.departments.data[index] = action.payload;
      }
    },
    removeDepartment: (state, action) => {
      state.departments.data = state.departments.data.filter(d => d.id !== action.payload);
    },
    addBranch: (state, action) => {
      state.branches.data.push(action.payload);
    },
    updateBranch: (state, action) => {
      const index = state.branches.data.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.branches.data[index] = action.payload;
      }
    },
    removeBranch: (state, action) => {
      state.branches.data = state.branches.data.filter(b => b.id !== action.payload);
    },
    addBatch: (state, action) => {
      state.batches.data.push(action.payload);
    },
    updateBatch: (state, action) => {
      const index = state.batches.data.findIndex(b => b.id === action.payload.id);
      if (index !== -1) {
        state.batches.data[index] = action.payload;
      }
    },
    removeBatch: (state, action) => {
      state.batches.data = state.batches.data.filter(b => b.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Departments
      .addCase(fetchDepartments.pending, (state) => {
        state.departments.loading = true;
        state.departments.error = null;
      })
      .addCase(fetchDepartments.fulfilled, (state, action) => {
        state.departments.loading = false;
        if (!action.payload.cached) {
          state.departments.data = action.payload.data;
          state.departments.lastFetched = Date.now();
        }
      })
      .addCase(fetchDepartments.rejected, (state, action) => {
        state.departments.loading = false;
        state.departments.error = action.payload;
      })

      // Branches
      .addCase(fetchBranches.pending, (state) => {
        state.branches.loading = true;
        state.branches.error = null;
      })
      .addCase(fetchBranches.fulfilled, (state, action) => {
        state.branches.loading = false;
        if (!action.payload.cached) {
          state.branches.data = action.payload.data;
          state.branches.lastFetched = Date.now();
        }
      })
      .addCase(fetchBranches.rejected, (state, action) => {
        state.branches.loading = false;
        state.branches.error = action.payload;
      })

      // Batches
      .addCase(fetchBatches.pending, (state) => {
        state.batches.loading = true;
        state.batches.error = null;
      })
      .addCase(fetchBatches.fulfilled, (state, action) => {
        state.batches.loading = false;
        if (!action.payload.cached) {
          state.batches.data = action.payload.data;
          state.batches.lastFetched = Date.now();
        }
      })
      .addCase(fetchBatches.rejected, (state, action) => {
        state.batches.loading = false;
        state.batches.error = action.payload;
      })

      // Institutions
      .addCase(fetchInstitutions.pending, (state) => {
        state.institutions.loading = true;
        state.institutions.error = null;
      })
      .addCase(fetchInstitutions.fulfilled, (state, action) => {
        state.institutions.loading = false;
        if (!action.payload.cached) {
          state.institutions.data = action.payload.data;
          state.institutions.lastFetched = Date.now();
        }
      })
      .addCase(fetchInstitutions.rejected, (state, action) => {
        state.institutions.loading = false;
        state.institutions.error = action.payload;
      })

      // Roles
      .addCase(fetchRoles.pending, (state) => {
        state.roles.loading = true;
        state.roles.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.roles.loading = false;
        if (!action.payload.cached) {
          state.roles.data = action.payload.data;
        }
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.roles.loading = false;
        state.roles.error = action.payload;
      })

      // Industries
      .addCase(fetchIndustries.pending, (state) => {
        state.industries.loading = true;
        state.industries.error = null;
      })
      .addCase(fetchIndustries.fulfilled, (state, action) => {
        state.industries.loading = false;
        if (!action.payload.cached) {
          state.industries.data = action.payload.data;
          state.industries.lastFetched = Date.now();
        }
      })
      .addCase(fetchIndustries.rejected, (state, action) => {
        state.industries.loading = false;
        state.industries.error = action.payload;
      });
  },
});

export const {
  clearLookupCache,
  addDepartment,
  updateDepartment,
  removeDepartment,
  addBranch,
  updateBranch,
  removeBranch,
  addBatch,
  updateBatch,
  removeBatch,
} = lookupSlice.actions;

export default lookupSlice.reducer;

// ==========================================
// Selectors
// ==========================================

export const selectDepartments = (state) => state.lookup.departments.data;
export const selectDepartmentsLoading = (state) => state.lookup.departments.loading;
export const selectActiveDepartments = (state) =>
  state.lookup.departments.data.filter(d => d.isActive);

export const selectBranches = (state) => state.lookup.branches.data;
export const selectBranchesLoading = (state) => state.lookup.branches.loading;
export const selectActiveBranches = (state) =>
  state.lookup.branches.data.filter(b => b.isActive);

export const selectBatches = (state) => state.lookup.batches.data;
export const selectBatchesLoading = (state) => state.lookup.batches.loading;
export const selectActiveBatches = (state) =>
  state.lookup.batches.data.filter(b => b.isActive);

export const selectInstitutions = (state) => state.lookup.institutions.data;
export const selectInstitutionsLoading = (state) => state.lookup.institutions.loading;
export const selectActiveInstitutions = (state) =>
  state.lookup.institutions.data.filter(i => i.isActive);

export const selectRoles = (state) => state.lookup.roles.data;
export const selectRolesLoading = (state) => state.lookup.roles.loading;

export const selectIndustries = (state) => state.lookup.industries.data;
export const selectIndustriesLoading = (state) => state.lookup.industries.loading;

// Get branch by ID
export const selectBranchById = (state, id) =>
  state.lookup.branches.data.find(b => b.id === id);

// Get department by ID
export const selectDepartmentById = (state, id) =>
  state.lookup.departments.data.find(d => d.id === id);

// Get batch by ID
export const selectBatchById = (state, id) =>
  state.lookup.batches.data.find(b => b.id === id);

// Get institution by ID
export const selectInstitutionById = (state, id) =>
  state.lookup.institutions.data.find(i => i.id === id);

// Check if lookup data is loaded
export const selectIsLookupLoaded = (state) =>
  state.lookup.departments.lastFetched !== null &&
  state.lookup.branches.lastFetched !== null &&
  state.lookup.batches.lastFetched !== null;
