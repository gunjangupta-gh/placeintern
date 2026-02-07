import API from './api';

/**
 * System Alerts Service
 * API methods for user-facing system alerts (announcements from admin)
 */
const SystemAlertsService = {
  /**
   * Get active alerts for the current user based on their role
   * @returns {Promise<Object>} Response with active alerts
   */
  getMyAlerts: async () => {
    const response = await API.get('/system-alerts/my-alerts');
    return response.data;
  },

  /**
   * Dismiss an alert for the current user
   * @param {string} alertId - Alert ID to dismiss
   * @returns {Promise<Object>} Success response
   */
  dismissAlert: async (alertId) => {
    const response = await API.post(`/system-alerts/${alertId}/dismiss`);
    return response.data;
  },
};

export default SystemAlertsService;
