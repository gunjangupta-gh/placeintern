import API from './api';

export const grievanceService = {
  /**
   * Get all grievances with optional filtering
   * @param {Object} params - Query parameters (status, category, priority, etc.)
   * @returns {Promise} - List of grievances
   */
  async getAll(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/grievances?${queryParams}`);
    return response.data;
  },

  /**
   * Get grievances by institution ID
   * @param {string} institutionId - Institution ID
   * @returns {Promise} - List of grievances for the institution
   */
  async getByInstitution(institutionId) {
    const response = await API.get(`/grievances/institution/${institutionId}`);
    return response.data;
  },

  /**
   * Get grievances by user ID
   * @param {string} userId - User ID
   * @returns {Promise} - List of user's grievances
   */
  async getByUser(userId) {
    const response = await API.get(`/grievances/user/${userId}`);
    return response.data;
  },

  /**
   * Get grievances by student ID
   * @param {string} studentId - Student ID
   * @returns {Promise} - List of student's grievances
   */
  async getByStudentId(studentId) {
    const response = await API.get(`/grievances/student/${studentId}`);
    return response.data;
  },

  /**
   * Get grievances assigned to faculty member
   * @param {string} userId - Faculty user ID
   * @returns {Promise} - List of assigned grievances
   */
  async getByFaculty(userId) {
    const response = await API.get(`/grievances/faculty/${userId}`);
    return response.data;
  },

  /**
   * Get a single grievance by ID
   * @param {string} id - Grievance ID
   * @returns {Promise} - Grievance details
   */
  async getById(id) {
    const response = await API.get(`/grievances/${id}`);
    return response.data;
  },

  /**
   * Get escalation chain for a grievance
   * @param {string} id - Grievance ID
   * @returns {Promise} - Escalation chain details
   */
  async getEscalationChain(id) {
    const response = await API.get(`/grievances/${id}/escalation-chain`);
    return response.data;
  },

  /**
   * Submit a new grievance
   * @param {Object} data - Grievance data (category, title, description, severity, etc.)
   * @returns {Promise} - Created grievance
   */
  async submit(data) {
    const response = await API.post('/grievances', data);
    return response.data;
  },

  /**
   * Respond to a grievance
   * @param {string} id - Grievance ID
   * @param {string} response - Response text
   * @param {string} newStatus - Optional new status
   * @param {string[]} attachments - Optional attachments
   * @returns {Promise} - Updated grievance
   */
  async respond(id, responseText, newStatus = null, attachments = []) {
    const data = { response: responseText, attachments };
    if (newStatus) data.newStatus = newStatus;
    const res = await API.post(`/grievances/${id}/respond`, data);
    return res.data;
  },

  /**
   * Escalate a grievance to the next level
   * @param {string} id - Grievance ID
   * @param {string} reason - Reason for escalation
   * @param {string} escalateToId - Optional user ID to escalate to
   * @returns {Promise} - Updated grievance
   */
  async escalate(id, reason, escalateToId = null) {
    const data = { reason };
    if (escalateToId) data.escalateToId = escalateToId;
    const response = await API.post(`/grievances/${id}/escalate`, data);
    return response.data;
  },

  /**
   * Update grievance status
   * @param {string} id - Grievance ID
   * @param {string} status - New status
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated grievance
   */
  async updateStatus(id, status, remarks = null) {
    const data = { status };
    if (remarks) data.remarks = remarks;
    const response = await API.patch(`/grievances/${id}/status`, data);
    return response.data;
  },

  /**
   * Assign grievance to a user
   * @param {string} id - Grievance ID
   * @param {string} assigneeId - User ID to assign to
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated grievance
   */
  async assign(id, assigneeId, remarks = null) {
    const data = { assigneeId };
    if (remarks) data.remarks = remarks;
    const response = await API.patch(`/grievances/${id}/assign`, data);
    return response.data;
  },

  /**
   * Get grievance statistics
   * @param {string} institutionId - Optional institution ID
   * @returns {Promise} - Statistics object
   */
  async getStatistics(institutionId = null) {
    const params = institutionId ? `?institutionId=${institutionId}` : '';
    const response = await API.get(`/grievances/statistics${params}`);
    return response.data;
  },

  /**
   * Get assignable users for grievance assignment
   * @param {string} institutionId - Institution ID
   * @returns {Promise} - List of assignable users
   */
  async getAssignableUsers(institutionId) {
    const response = await API.get(`/grievances/assignable-users/list?institutionId=${institutionId}`);
    return response.data;
  },

  /**
   * Close a grievance
   * @param {string} id - Grievance ID
   * @param {string} remarks - Optional remarks
   * @returns {Promise} - Updated grievance
   */
  async close(id, remarks = null) {
    const data = remarks ? { remarks } : {};
    const response = await API.patch(`/grievances/${id}/close`, data);
    return response.data;
  },

  /**
   * Reject a grievance
   * @param {string} id - Grievance ID
   * @param {string} reason - Rejection reason
   * @returns {Promise} - Updated grievance
   */
  async reject(id, reason) {
    const response = await API.patch(`/grievances/${id}/reject`, { reason });
    return response.data;
  },
};

export default grievanceService;
