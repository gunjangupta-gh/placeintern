import API from './api';

/**
 * Notification Service
 * Centralized API methods for notification operations
 */
const NotificationService = {
  /**
   * Get all notifications for the current user
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise<Object>} Response with notifications and pagination
   */
  getAll: (params = {}) => {
    return API.get('/shared/notifications', { params });
  },

  /**
   * Get notification by ID
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Notification details
   */
  getById: (id) => {
    return API.get(`/shared/notifications/${id}`);
  },

  /**
   * Get count of unread notifications
   * @returns {Promise<Object>} Response with unread count
   */
  getUnreadCount: () => {
    return API.get('/shared/notifications/unread-count');
  },

  /**
   * Mark a specific notification as read
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Updated notification
   */
  markAsRead: (id) => {
    return API.put(`/shared/notifications/${id}/read`);
  },

  /**
   * Mark all notifications as read for the current user
   * @returns {Promise<Object>} Success response
   */
  markAllAsRead: () => {
    return API.put('/shared/notifications/read-all');
  },

  /**
   * Mark multiple notifications as read
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Object>} Success response
   */
  markMultipleAsRead: (ids) => {
    return API.put('/shared/notifications/mark-read', { ids });
  },

  /**
   * Delete a specific notification
   * @param {string} id - Notification ID
   * @returns {Promise<Object>} Success response
   */
  delete: (id) => {
    return API.delete(`/shared/notifications/${id}`);
  },

  /**
   * Delete multiple notifications
   * @param {Array<string>} ids - Array of notification IDs
   * @returns {Promise<Object>} Success response
   */
  deleteMultiple: (ids) => {
    return API.post('/shared/notifications/delete-multiple', { ids });
  },

  /**
   * Clear all notifications for the current user
   * @returns {Promise<Object>} Success response
   */
  clearAll: () => {
    return API.delete('/shared/notifications/clear-all');
  },

  /**
   * Clear all read notifications
   * @returns {Promise<Object>} Success response
   */
  clearAllRead: () => {
    return API.delete('/shared/notifications/clear-read');
  },

  /**
   * Get notification settings for the current user
   * @returns {Promise<Object>} Notification settings
   */
  getSettings: () => {
    return API.get('/shared/notifications/settings');
  },

  /**
   * Update notification settings for the current user
   * @param {Object} data - Updated settings
   * @returns {Promise<Object>} Updated settings
   */
  updateSettings: (data) => {
    return API.put('/shared/notifications/settings', data);
  },

  // ============ NOTIFICATION SENDING METHODS ============

  /**
   * Send notification (generic)
   * @param {Object} data - { target, title, body, userId?, userIds?, role?, institutionId?, roleFilter?, sendEmail?, data? }
   * Target types: 'user', 'users', 'role', 'institution', 'broadcast'
   */
  send: (data) => {
    return API.post('/shared/notifications/send', data);
  },

  /**
   * Faculty: Send reminder to assigned students
   * @param {Object} data - { title, body, studentIds?, sendEmail?, data? }
   */
  sendStudentReminder: (data) => {
    return API.post('/shared/notifications/send/student-reminder', data);
  },

  /**
   * Principal: Send announcement to institution
   * @param {Object} data - { title, body, targetRoles?, sendEmail?, data? }
   */
  sendInstitutionAnnouncement: (data) => {
    return API.post('/shared/notifications/send/institution-announcement', data);
  },

  /**
   * State/Admin: Send system-wide announcement
   * @param {Object} data - { title, body, targetRoles?, sendEmail?, force?, data? }
   */
  sendSystemAnnouncement: (data) => {
    return API.post('/shared/notifications/send/system-announcement', data);
  },
};

export default NotificationService;
