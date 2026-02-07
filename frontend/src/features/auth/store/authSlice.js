import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../services/auth.service';
import { tokenStorage } from '../../../utils/tokenManager';
import { RESET_STORE } from '../../../app/store/actions';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const extractToken = (resp) => resp?.access_token || resp?.accessToken || resp?.token || null;
const extractRefreshToken = (resp) => resp?.refresh_token || resp?.refreshToken || null;

// Initial state
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  lastFetched: {
    user: null,
  },
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      const token = extractToken(response);
      const refreshToken = extractRefreshToken(response);
      const user = response?.user || null;

      // Store tokens in centralized token manager
      if (token) {
        tokenStorage.setToken(token);
      }
      if (refreshToken) {
        tokenStorage.setRefreshToken(refreshToken);
      }

      return { ...response, token, refreshToken, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const refreshTkn = tokenStorage.getRefreshToken();
      const response = await authService.refreshToken(refreshTkn);
      const token = extractToken(response);
      const newRefreshToken = extractRefreshToken(response);

      if (token) {
        tokenStorage.setToken(token);
      }
      if (newRefreshToken) {
        tokenStorage.setRefreshToken(newRefreshToken);
      }

      return { ...response, token };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Token refresh failed');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.auth.lastFetched.user;

      // Check cache unless forced refresh
      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.PROFILE)) {
        return { cached: true };
      }

      const response = await authService.getProfile();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user');
    }
  }
);

// Logout thunk - clears everything and redirects to login
export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { dispatch }) => {
    try {
      // Try to call backend logout (optional - may fail if token expired)
      await authService.logout();
    } catch (error) {
      // Ignore logout API errors - we still want to clear local state
    }

    // Clear all storage (preserves theme)
    tokenStorage.clear();

    // Dispatch reset store action to clear all Redux state
    dispatch({ type: RESET_STORE });

    // Redirect to login page
    window.location.href = '/login';

    return null;
  }
);

// Alias for backward compatibility - uses same thunk to avoid duplicate API calls
export const fetchProfile = getCurrentUser;

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      state.lastFetched.user = null; // Clear cache on logout
      // Clear all tokens via centralized manager
      tokenStorage.clear();
    },
    setCredentials: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isAuthenticated = true;
      if (token) {
        tokenStorage.setToken(token);
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
      })
      // Get Current User (also handles fetchProfile as it's an alias)
      .addCase(getCurrentUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.loading = false;
        if (!action.payload?.cached) {
          state.user = action.payload.user || action.payload;
          state.isAuthenticated = true;
          state.lastFetched.user = Date.now();
        }
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { logout, setCredentials, clearError } = authSlice.actions;
export default authSlice.reducer;
