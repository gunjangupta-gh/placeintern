import { apiClient } from '../../../services/api';
import { API_ENDPOINTS } from '../../../utils/constants';

/**
 * Authentication Service
 * Handles all auth-related API calls including MFA
 */
export const authService = {
  login: async (credentials) => {
    const response = await apiClient.post(API_ENDPOINTS.LOGIN, credentials);
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post(API_ENDPOINTS.LOGOUT);
    return response.data;
  },

  logoutAllDevices: async () => {
    const response = await apiClient.post('/auth/logout-all-devices');
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get(API_ENDPOINTS.PROFILE);
    return response.data;
  },

  refreshToken: async (refreshToken) => {
    const response = await apiClient.post(API_ENDPOINTS.REFRESH, { refresh_token: refreshToken });
    return response.data;
  },

  extendSession: async (refreshToken) => {
    const response = await apiClient.post('/auth/extend-session', { refresh_token: refreshToken });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data;
  },

  verifyResetToken: async (token) => {
    const response = await apiClient.get(`/auth/verify-reset-token/${token}`);
    return response.data;
  },

  resetPassword: async (token, newPassword) => {
    const response = await apiClient.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  changePassword: async (oldPassword, newPassword) => {
    const response = await apiClient.post('/auth/change-password', { oldPassword, newPassword });
    return response.data;
  },

  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  // MFA Methods
  getMfaStatus: async () => {
    const response = await apiClient.get(API_ENDPOINTS.MFA_STATUS);
    return response.data;
  },

  setupMfa: async () => {
    const response = await apiClient.post(API_ENDPOINTS.MFA_SETUP);
    return response.data; // Returns { secret, qrCodeUrl, backupCodes }
  },

  enableMfa: async (code) => {
    const response = await apiClient.post(API_ENDPOINTS.MFA_ENABLE, { code });
    return response.data;
  },

  disableMfa: async (code) => {
    const response = await apiClient.post(API_ENDPOINTS.MFA_DISABLE, { code });
    return response.data;
  },

  verifyMfa: async (userId, code) => {
    const response = await apiClient.post(API_ENDPOINTS.MFA_VERIFY, { userId, code });
    return response.data;
  },

  // MFA Login - complete login after MFA verification
  loginWithMfa: async (userId, code) => {
    const response = await apiClient.post('/auth/login/mfa', { userId, code });
    return response.data;
  },
};
