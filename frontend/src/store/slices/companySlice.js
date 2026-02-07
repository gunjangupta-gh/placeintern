import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { apiClient } from '../../services/api';

const initialState = {
  companies: [],
  loading: false,
  error: null,
};

export const fetchCompanies = createAsyncThunk('company/fetchCompanies', async (_, { rejectWithValue }) => {
  // Try common endpoints; fall back to empty list if not available.
  const candidates = ['/faculty/companies', '/companies'];

  for (const url of candidates) {
    try {
      const response = await apiClient.get(url);
      const payload = response?.data?.data ?? response?.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.companies)) return payload.companies;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    } catch {
      // try next
    }
  }

  return rejectWithValue('Failed to fetch companies');
});

const companySlice = createSlice({
  name: 'company',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanies.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCompanies.fulfilled, (state, action) => {
        state.loading = false;
        state.companies = action.payload || [];
      })
      .addCase(fetchCompanies.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error?.message || 'Failed to fetch companies';
      });
  },
});

export default companySlice.reducer;
