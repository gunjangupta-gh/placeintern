import API from './api';

/**
 * Admin Service
 * API methods for system admin operations
 */
export const adminService = {
  // ==================== HEALTH & METRICS ====================

  async getDetailedHealth() {
    const response = await API.get('/system-admin/health/detailed');
    return response.data;
  },

  async getRealtimeMetrics() {
    const response = await API.get('/system-admin/metrics/realtime');
    return response.data;
  },

  async getHealthReport() {
    const response = await API.get('/system-admin/health/report');
    return response.data;
  },

  async getQuickStatus() {
    const response = await API.get('/system-admin/health/quick');
    return response.data;
  },

  async getAlertHistory(limit = 50) {
    const response = await API.get(`/system-admin/health/alerts?limit=${limit}`);
    return response.data;
  },

  async getUptimeStats() {
    const response = await API.get('/system-admin/health/uptime');
    return response.data;
  },

  async getSystemMetrics() {
    const response = await API.get('/system-admin/health/metrics');
    return response.data;
  },

  async getThresholds() {
    const response = await API.get('/system-admin/health/thresholds');
    return response.data;
  },

  async updateThresholds(thresholds) {
    const response = await API.put('/system-admin/health/thresholds', thresholds);
    return response.data;
  },

  async getServiceDetails(name) {
    const response = await API.get(`/system-admin/health/service/${name}`);
    return response.data;
  },

  // ==================== BACKUP MANAGEMENT ====================

  async createBackup(data) {
    const response = await API.post('/system-admin/backup/create', data);
    return response.data;
  },

  async listBackups(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/backup/list?${queryParams}` : '/system-admin/backup/list';
    const response = await API.get(url);
    return response.data;
  },

  async getBackupDownloadUrl(id) {
    const response = await API.get(`/system-admin/backup/download/${id}`);
    return response.data;
  },

  async restoreBackup(id, options = {}) {
    const { confirmRestore = true, confirmationText = 'RESTORE', dropExisting = true } = options;
    const response = await API.post(`/system-admin/backup/restore/${id}`, {
      confirmRestore,
      confirmationText,
      dropExisting,
    });
    return response.data;
  },

  async uploadBackup(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/system-admin/backup/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },

  async deleteBackup(id) {
    const response = await API.delete(`/system-admin/backup/${id}`);
    return response.data;
  },

  async getBackupDetails(id) {
    const response = await API.get(`/system-admin/backup/${id}/details`);
    return response.data;
  },

  async updateBackupStatus(id, status) {
    const response = await API.put(`/system-admin/backup/${id}/status`, { status });
    return response.data;
  },

  async cleanupStaleBackups() {
    const response = await API.post('/system-admin/backup/cleanup-stale');
    return response.data;
  },

  // ==================== BACKUP SCHEDULES ====================

  async listBackupSchedules() {
    const response = await API.get('/system-admin/backup/schedules');
    return response.data;
  },

  async getScheduleStatus() {
    const response = await API.get('/system-admin/backup/schedules/status');
    return response.data;
  },

  async createBackupSchedule(data) {
    const response = await API.post('/system-admin/backup/schedules', data);
    return response.data;
  },

  async updateBackupSchedule(id, data) {
    const response = await API.put(`/system-admin/backup/schedules/${id}`, data);
    return response.data;
  },

  async deleteBackupSchedule(id) {
    const response = await API.delete(`/system-admin/backup/schedules/${id}`);
    return response.data;
  },

  async triggerBackupSchedule(id) {
    const response = await API.post(`/system-admin/backup/schedules/${id}/trigger`);
    return response.data;
  },

  // ==================== USER MANAGEMENT ====================

  async getUsers(params = {}) {
    // Backend expects `isActive` as query param for filtering users
    // (even though the stored field is `active`).
    const normalizedParams = { ...params };
    if (normalizedParams.isActive == null && normalizedParams.active != null) {
      normalizedParams.isActive = normalizedParams.active;
      delete normalizedParams.active;
    }

    const cleanParams = Object.fromEntries(
      Object.entries(normalizedParams).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/users?${queryParams}` : '/system-admin/users';
    const response = await API.get(url);
    return response.data;
  },

  async getUserById(id) {
    const response = await API.get(`/system-admin/users/${id}`);
    return response.data;
  },

  async createUser(data) {
    const response = await API.post('/system-admin/users', data);
    return response.data;
  },

  async updateUser(id, data) {
    // Backend expects `active` in body for updates (UpdateUserDto).
    const normalizedData = { ...data };
    if (normalizedData.active == null && normalizedData.isActive != null) {
      normalizedData.active = normalizedData.isActive;
      delete normalizedData.isActive;
    }
    const response = await API.put(`/system-admin/users/${id}`, normalizedData);
    return response.data;
  },

  async deleteUser(id, permanent = false) {
    const response = await API.delete(`/system-admin/users/${id}?permanent=${permanent}`);
    return response.data;
  },

  async bulkUserAction(data) {
    const response = await API.post('/system-admin/users/bulk', data);
    return response.data;
  },

  async resetUserPassword(id) {
    const response = await API.post(`/system-admin/users/${id}/reset-password`);
    return response.data;
  },

  // ==================== SESSION MANAGEMENT ====================

  async getActiveSessions(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/sessions?${queryParams}` : '/system-admin/sessions';
    const response = await API.get(url);
    return response.data;
  },

  async getSessionStats() {
    const response = await API.get('/system-admin/sessions/stats');
    return response.data;
  },

  async terminateSession(id) {
    const response = await API.delete(`/system-admin/sessions/${id}`);
    return response.data;
  },

  async terminateAllSessions(options = {}) {
    const response = await API.post('/system-admin/sessions/terminate-all', options);
    return response.data;
  },

  async terminateUserSessions(userId) {
    const response = await API.post(`/system-admin/sessions/terminate-user/${userId}`);
    return response.data;
  },

  // ==================== ANALYTICS & INSIGHTS ====================

  async getDashboardSummary() {
    const response = await API.get('/system-admin/analytics/dashboard');
    return response.data;
  },

  async getLoginAnalytics(days = 30) {
    const response = await API.get(`/system-admin/analytics/login?days=${days}`);
    return response.data;
  },

  async getSuspiciousActivities(days = 7) {
    const response = await API.get(`/system-admin/analytics/suspicious-activities?days=${days}`);
    return response.data;
  },

  async getSystemTrends(days = 30) {
    const response = await API.get(`/system-admin/analytics/trends?days=${days}`);
    return response.data;
  },

  async getUserActivityHeatmap(userId = null) {
    const url = userId
      ? `/system-admin/analytics/activity-heatmap?userId=${userId}`
      : '/system-admin/analytics/activity-heatmap';
    const response = await API.get(url);
    return response.data;
  },

  // ==================== SYSTEM CONFIGURATION ====================

  async getAllConfigs() {
    const response = await API.get('/system-admin/config');
    return response.data;
  },

  async getConfigsByCategory(category) {
    const response = await API.get(`/system-admin/config/category/${category}`);
    return response.data;
  },

  async getConfig(key) {
    const response = await API.get(`/system-admin/config/${key}`);
    return response.data;
  },

  async setConfig(key, value) {
    const response = await API.put(`/system-admin/config/${key}`, { value });
    return response.data;
  },

  async bulkUpdateConfigs(updates) {
    const response = await API.put('/system-admin/config', { updates });
    return response.data;
  },

  async resetConfig(key) {
    const response = await API.post(`/system-admin/config/${key}/reset`);
    return response.data;
  },

  async resetAllConfigs() {
    const response = await API.post('/system-admin/config/reset-all');
    return response.data;
  },

  async exportConfigs() {
    const response = await API.get('/system-admin/config/export');
    return response.data;
  },

  async importConfigs(data) {
    const response = await API.post('/system-admin/config/import', data);
    return response.data;
  },

  // ==================== CACHE MANAGEMENT ====================

  async clearCache(options = {}) {
    const response = await API.post('/system-admin/cache/clear', options);
    return response.data;
  },

  async isFeatureEnabled(feature) {
    const response = await API.get(`/system-admin/config/feature/${feature}`);
    return response.data;
  },

  async isMaintenanceMode() {
    const response = await API.get('/system-admin/config/maintenance-mode');
    return response.data;
  },

  // ==================== SYSTEM ALERTS (User Announcements) ====================

  async getSystemAlerts(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/system-admin/alerts?${queryParams}` : '/system-admin/alerts';
    const response = await API.get(url);
    return response.data;
  },

  async getSystemAlertStats() {
    const response = await API.get('/system-admin/alerts/stats');
    return response.data;
  },

  async getSystemAlertById(id) {
    const response = await API.get(`/system-admin/alerts/${id}`);
    return response.data;
  },

  async createSystemAlert(data) {
    const response = await API.post('/system-admin/alerts', data);
    return response.data;
  },

  async updateSystemAlert(id, data) {
    const response = await API.put(`/system-admin/alerts/${id}`, data);
    return response.data;
  },

  async deleteSystemAlert(id) {
    const response = await API.delete(`/system-admin/alerts/${id}`);
    return response.data;
  },
};

export default adminService;
