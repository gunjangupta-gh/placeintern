import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '../../../services/api';
import { CACHE_DURATIONS, isCacheValid } from '../../../utils/cacheConfig';

const initialState = {
  notifications: {
    list: [],
    unreadCount: 0,
    loading: false,
    error: null,
    lastFetched: null,
  },
  theme: 'light',
  sidebarCollapsed: false,
};

// Async thunks
export const fetchNotifications = createAsyncThunk(
  'shared/fetchNotifications',
  async (params, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const lastFetched = state.shared.notifications.lastFetched;

      if (!params?.forceRefresh && isCacheValid(lastFetched, CACHE_DURATIONS.ALERTS)) {
        return { cached: true };
      }

      const response = await apiClient.get('/shared/notifications');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch notifications');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'shared/markNotificationRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      await apiClient.put(`/shared/notifications/${notificationId}/read`);
      return notificationId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark as read');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'shared/markAllNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      await apiClient.put('/shared/notifications/read-all');
      return true;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to mark all as read');
    }
  }
);

const sharedSlice = createSlice({
  name: 'shared',
  initialState,
  reducers: {
    setNotifications: (state, action) => {
      state.notifications.list = action.payload;
      state.notifications.unreadCount = action.payload.filter((n) => !n.read).length;
    },
    markNotificationAsRead: (state, action) => {
      const notification = state.notifications.list.find((n) => n.id === action.payload);
      if (notification) {
        notification.read = true;
        state.notifications.unreadCount = Math.max(0, state.notifications.unreadCount - 1);
      }
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch notifications
      .addCase(fetchNotifications.pending, (state) => {
        state.notifications.loading = true;
        state.notifications.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.notifications.loading = false;
        if (!action.payload.cached) {
          state.notifications.list = action.payload.data || action.payload;
          state.notifications.unreadCount = (action.payload.data || action.payload).filter((n) => !n.read).length;
          state.notifications.lastFetched = Date.now();
        }
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.notifications.loading = false;
        state.notifications.error = action.payload;
      })

      // Mark notification read
      .addCase(markNotificationRead.pending, (state) => {
        state.notifications.loading = true;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.notifications.loading = false;
        const notification = state.notifications.list.find((n) => n.id === action.payload);
        if (notification && !notification.read) {
          notification.read = true;
          state.notifications.unreadCount = Math.max(0, state.notifications.unreadCount - 1);
        }
      })
      .addCase(markNotificationRead.rejected, (state, action) => {
        state.notifications.loading = false;
        state.notifications.error = action.payload;
      })

      // Mark all notifications read
      .addCase(markAllNotificationsRead.pending, (state) => {
        state.notifications.loading = true;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications.loading = false;
        state.notifications.list = state.notifications.list.map((n) => ({ ...n, read: true }));
        state.notifications.unreadCount = 0;
      })
      .addCase(markAllNotificationsRead.rejected, (state, action) => {
        state.notifications.loading = false;
        state.notifications.error = action.payload;
      });
  },
});

export const { setNotifications, toggleTheme, toggleSidebar } = sharedSlice.actions;

export default sharedSlice.reducer;
