import API from './api';

/**
 * Faculty Service
 * API methods for faculty operations
 */
export const facultyService = {
  // Dashboard
  async getDashboard() {
    const response = await API.get('/faculty/dashboard');
    return response.data;
  },

  // Current month compliance stats (uses monthly inclusion rules)
  async getCurrentMonthStats() {
    const response = await API.get('/faculty/dashboard/monthly-stats');
    return response.data;
  },

  // Profile
  async getProfile() {
    const response = await API.get('/faculty/profile');
    return response.data;
  },

  // Assigned Students - Fetch all without pagination
  async getAssignedStudents(params = {}) {
    const queryParams = new URLSearchParams();
    // Set a high limit to fetch all students at once
    queryParams.append('limit', params.limit || '1000');
    queryParams.append('page', '1');
    if (params.search) queryParams.append('search', params.search);

    const url = `/faculty/students?${queryParams.toString()}`;
    const response = await API.get(url);
    return response.data;
  },

  async getStudentDetails(studentId) {
    const response = await API.get(`/faculty/students/${studentId}`);
    return response.data;
  },

  async getStudentProgress(studentId) {
    const response = await API.get(`/faculty/students/${studentId}/progress`);
    return response.data;
  },

  /**
   * Get unmasked contact details for a student.
   * Used to reveal masked phone numbers, emails, etc.
   */
  async getUnmaskedContactDetails(studentId) {
    const response = await API.get(`/faculty/students/${studentId}/unmasked-contact`);
    return response.data;
  },

  // Student Management
  async updateStudent(studentId, data) {
    const response = await API.put(`/faculty/students/${studentId}`, data);
    return response.data;
  },

  async uploadStudentDocument(studentId, file, type) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post(`/faculty/students/${studentId}/documents`, formData);
    return response.data;
  },

  async toggleStudentStatus(studentId) {
    const response = await API.patch(`/faculty/students/${studentId}/toggle-status`);
    return response.data;
  },

  async resetStudentPassword(studentId) {
    const response = await API.post(`/faculty/students/${studentId}/reset-password`);
    return response.data;
  },

  // Visit Logs
  async getVisitLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.studentId) queryParams.append('studentId', params.studentId);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/visit-logs?${queryString}` : '/faculty/visit-logs';
    const response = await API.get(url);
    return response.data;
  },

  async getVisitLogById(id) {
    const response = await API.get(`/faculty/visit-logs/${id}`);
    return response.data;
  },

  async createVisitLog(data) {
    const response = await API.post('/faculty/visit-logs', data);
    return response.data;
  },

  async updateVisitLog(id, data) {
    const response = await API.put(`/faculty/visit-logs/${id}`, data);
    return response.data;
  },

  async deleteVisitLog(id) {
    const response = await API.delete(`/faculty/visit-logs/${id}`);
    return response.data;
  },

  // Upload visit document (photo or signed document)
  async uploadVisitDocument(file, documentType = 'visit-photo') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/faculty/visit-logs/upload-document', formData);
    return response.data;
  },

  // Monthly Reports
  async getMonthlyReports(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/monthly-reports?${queryString}` : '/faculty/monthly-reports';
    const response = await API.get(url);
    return response.data;
  },

  // Removed: Auto-approval implemented - reviewMonthlyReport no longer needed
  // async reviewMonthlyReport(id, reviewData) {
  //   const response = await API.put(`/faculty/monthly-reports/${id}/review`, reviewData);
  //   return response.data;
  // },

  // Self-Identified Approvals
  async getSelfIdentifiedApprovals(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/approvals/self-identified?${queryString}` : '/faculty/approvals/self-identified';
    const response = await API.get(url);
    return response.data;
  },

  async updateSelfIdentifiedApproval(id, data) {
    const response = await API.put(`/faculty/approvals/self-identified/${id}`, data);
    return response.data;
  },

  // Feedback
  async submitMonthlyFeedback(data) {
    const response = await API.post('/faculty/feedback/monthly', data);
    return response.data;
  },

  async getFeedbackHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.studentId) queryParams.append('studentId', params.studentId);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/feedback/history?${queryString}` : '/faculty/feedback/history';
    const response = await API.get(url);
    return response.data;
  },

  // Internship Management
  async getStudentInternships(studentId) {
    const response = await API.get(`/faculty/students/${studentId}/internships`);
    return response.data;
  },

  async updateInternship(internshipId, data) {
    const response = await API.put(`/faculty/internships/${internshipId}`, data);
    return response.data;
  },

  async deleteInternship(internshipId) {
    const response = await API.delete(`/faculty/internships/${internshipId}`);
    return response.data;
  },

  // Joining Report Management
  async getJoiningLetters(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.studentId) queryParams.append('studentId', params.studentId);
    if (params.status) queryParams.append('status', params.status);

    const queryString = queryParams.toString();
    const url = queryString ? `/faculty/joining-letters?${queryString}` : '/faculty/joining-letters';
    const response = await API.get(url);
    return response.data;
  },

  async verifyJoiningLetter(letterId, data) {
    const response = await API.put(`/faculty/joining-letters/${letterId}/verify`, data);
    return response.data;
  },

  async rejectJoiningLetter(letterId, reason) {
    const response = await API.put(`/faculty/joining-letters/${letterId}/reject`, { reason });
    return response.data;
  },

  async deleteJoiningLetter(letterId) {
    const response = await API.delete(`/faculty/joining-letters/${letterId}`);
    return response.data;
  },

  async uploadJoiningLetter(applicationId, file) {
    const formData = new FormData();
    formData.append('file', file);

    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post(`/faculty/joining-letters/${applicationId}/upload`, formData);
    return response.data;
  },

  // Monthly Report approval actions
  async approveMonthlyReport(reportId, remarks) {
    const response = await API.put(`/faculty/monthly-reports/${reportId}/approve`, { remarks });
    return response.data;
  },

  async rejectMonthlyReport(reportId, reason) {
    const response = await API.put(`/faculty/monthly-reports/${reportId}/reject`, { reason });
    return response.data;
  },

  async deleteMonthlyReport(reportId) {
    const response = await API.delete(`/faculty/monthly-reports/${reportId}`);
    return response.data;
  },

  // Upload monthly report for a student (multipart/form-data)
  async uploadMonthlyReport(formData) {
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/faculty/monthly-reports/upload', formData);
    return response.data;
  },

  // Note: submitFeedback removed - use submitMonthlyFeedback instead

  // Create assignment for a student
  async createAssignment(data) {
    const response = await API.post('/faculty/assignments', data);
    return response.data;
  },

  async downloadMonthlyReport(reportId) {
    const response = await API.get(`/faculty/monthly-reports/${reportId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Get presigned URL to view monthly report
  async viewMonthlyReport(reportId) {
    const response = await API.get(`/faculty/monthly-reports/${reportId}/view`);
    return response.data;
  },
};

export default facultyService;
