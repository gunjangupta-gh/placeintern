import API from './api';

export const credentialsService = {
  /**
   * Reset password for a single user
   * @param {string} userId - The ID of the user
   * @returns {Promise} Response with reset details
   */
  async resetUserPassword(userId) {
    const response = await API.post('/auth/admin/reset-password', { userId });
    return response.data;
  },

  /**
   * Bulk reset passwords for multiple users
   * @param {string[]} userIds - Array of user IDs
   * @returns {Promise} Response with bulk reset results
   */
  async bulkResetPasswords(userIds) {
    const response = await API.post('/auth/admin/bulk-reset', { userIds });
    return response.data;
  },

  /**
   * Get users for password reset with filters
   * @param {Object} params - Query parameters for filtering users
   * @returns {Promise} Response with user list
   */
  async getUsersForReset(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/users${queryParams ? `?${queryParams}` : ''}`);
    return response.data;
  },

  /**
   * Search users by name, email, or institution
   * @param {string} searchTerm - Search term
   * @returns {Promise} Response with filtered users
   */
  async searchUsers(searchTerm) {
    const response = await API.get(`/users/search?q=${encodeURIComponent(searchTerm)}`);
    return response.data;
  },

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise} Response with user details
   */
  async getUserById(userId) {
    const response = await API.get(`/users/${userId}`);
    return response.data;
  },
};

export default credentialsService;
