import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const initialState = {
  institute: null,
  loading: false,
  error: null,
};

export const fetchInstituteAsync = createAsyncThunk('institute/fetchInstitute', async () => {
  // Best-effort: derive what we can from localStorage (keeps UI working even if
  // there isn't a dedicated API endpoint wired up yet).
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (!loginData) return null;

    const parsed = JSON.parse(loginData);
    const user = parsed?.user;

    return {
      institutionId: user?.institutionId ?? null,
      institutionName: user?.institutionName ?? user?.institution?.name ?? null,
    };
  } catch {
    return null;
  }
});

const instituteSlice = createSlice({
  name: 'institute',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchInstituteAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInstituteAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.institute = action.payload;
      })
      .addCase(fetchInstituteAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error?.message || 'Failed to fetch institute';
      });
  },
});

export const selectInstitute = (state) => state.institute?.institute ?? null;
export const selectInstituteLoading = (state) => state.institute?.loading ?? false;

export default instituteSlice.reducer;
