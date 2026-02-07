import API from './api';

/**
 * Audit Service
 * API methods for audit log operations
 */
export const auditService = {
  /**
   * Get audit logs with filters and pagination
   * @param {Object} params - Query parameters
   * @param {string} params.userId - Filter by user ID
   * @param {string} params.action - Filter by action type
   * @param {string} params.entityType - Filter by entity type
   * @param {string} params.category - Filter by category
   * @param {string} params.startDate - Filter by start date (ISO string)
   * @param {string} params.endDate - Filter by end date (ISO string)
   * @param {string} params.institutionId - Filter by institution ID
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @returns {Promise<{logs: Array, total: number, page: number, totalPages: number}>}
   */
  async getLogs(params = {}) {
    const queryParams = new URLSearchParams();

    // Only add defined parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const url = queryString ? `/audit/logs?${queryString}` : '/audit/logs';
    const response = await API.get(url);
    return response.data;
  },

  /**
   * Get audit statistics
   * @param {Object} params - Query parameters
   * @param {string} params.startDate - Filter by start date (ISO string)
   * @param {string} params.endDate - Filter by end date (ISO string)
   * @param {string} params.institutionId - Filter by institution ID
   * @returns {Promise<{totalLogs: number, actionBreakdown: Array, entityTypeBreakdown: Array, userActivityBreakdown: Array, categoryBreakdown: Array}>}
   */
  async getStatistics(params = {}) {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const url = queryString ? `/audit/statistics?${queryString}` : '/audit/statistics';
    const response = await API.get(url);
    return response.data;
  },

  /**
   * Get entity audit trail
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @returns {Promise<Array>}
   */
  async getEntityTrail(entityType, entityId) {
    const response = await API.get(`/audit/entity-trail?entityType=${entityType}&entityId=${entityId}`);
    return response.data;
  },
};

export default auditService;
