import API from './api';

/**
 * Student Service
 * API methods for student operations - synced with backend student.controller.ts
 */
export const studentService = {
  // =====================
  // Dashboard
  // =====================
  async getDashboard() {
    const response = await API.get('/student/dashboard');
    return response.data;
  },

  // =====================
  // Profile
  // =====================
  async getProfile() {
    const response = await API.get('/student/profile');
    return response.data;
  },

  async updateProfile(data) {
    const response = await API.put('/student/profile', data);
    return response.data;
  },

  async uploadProfileImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/student/profile/image', formData);
    return response.data;
  },

  // =====================
  // Internships - REMOVED
  // =====================
  // Industry internship browsing methods removed.
  // Use self-identified internship methods instead.

  // =====================
  // Applications
  // =====================
  async getApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/applications?${queryParams}` : '/student/applications';
    const response = await API.get(url);
    return response.data;
  },

  async getApplicationDetails(applicationId) {
    const response = await API.get(`/student/applications/${applicationId}`);
    return response.data;
  },

  async withdrawApplication(applicationId) {
    const response = await API.post(`/student/applications/${applicationId}/withdraw`);
    return response.data;
  },

  async updateApplication(applicationId, data) {
    const response = await API.put(`/student/applications/${applicationId}`, data);
    return response.data;
  },

  async uploadJoiningLetter(applicationId, file) {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.put(`/student/applications/${applicationId}/joining-letter`, formData);
    return response.data;
  },

  async deleteJoiningLetter(applicationId) {
    const response = await API.delete(`/student/applications/${applicationId}/joining-letter`);
    return response.data;
  },

  // =====================
  // Self-Identified Internships
  // =====================
  async submitSelfIdentified(data) {
    const response = await API.post('/student/self-identified', data);
    return response.data;
  },

  async getSelfIdentified(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/self-identified?${queryParams}` : '/student/self-identified';
    const response = await API.get(url);
    return response.data;
  },

  // =====================
  // Monthly Reports
  // =====================
  async getMonthlyReports(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/monthly-reports?${queryParams}` : '/student/monthly-reports';
    const response = await API.get(url);
    return response.data;
  },

  async submitMonthlyReport(data) {
    const response = await API.post('/student/monthly-reports', data);
    return response.data;
  },

  async updateMonthlyReport(reportId, data) {
    const response = await API.put(`/student/monthly-reports/${reportId}`, data);
    return response.data;
  },

  async deleteMonthlyReport(reportId) {
    const response = await API.delete(`/student/monthly-reports/${reportId}`);
    return response.data;
  },

  // =====================
  // Documents
  // =====================
  async getDocuments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/documents?${queryParams}` : '/student/documents';
    const response = await API.get(url);
    return response.data;
  },

  async uploadDocument(file, documentData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(documentData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/student/documents', formData);
    return response.data;
  },

  async deleteDocument(documentId) {
    const response = await API.delete(`/student/documents/${documentId}`);
    return response.data;
  },

  // =====================
  // Grievances
  // =====================
  async submitGrievance(data) {
    const response = await API.post('/student/grievances', data);
    return response.data;
  },

  async getGrievances(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/grievances?${queryParams}` : '/student/grievances';
    const response = await API.get(url);
    return response.data;
  },

  // =====================
  // Support Tickets - Use helpSupportService instead
  // =====================
  // REMOVED: submitTechnicalQuery - Students should use helpSupportService.createTicket()
  // POST /support/tickets - Create ticket (all authenticated users)
  // GET /support/tickets/my-tickets - Get user's own tickets

  // =====================
  // Mentor
  // =====================
  async getMyMentor() {
    const response = await API.get('/student/my-mentor');
    return response.data;
  },

  // =====================
  // Companies
  // =====================
  async getCompanies(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/companies?${queryParams}` : '/student/companies';
    const response = await API.get(url);
    return response.data;
  },

  // =====================
  // Unmasked Contact Details (for masked reveal feature)
  // =====================
  /**
   * Get the current user's own unmasked contact details.
   * Used to reveal masked phone numbers, emails in the profile page.
   * @returns {Promise<{email: string, phoneNo: string, parentContact?: string}>}
   */
  async getOwnUnmaskedContact() {
    const response = await API.get('/auth/me/unmasked-contact');
    return response.data;
  },

  // =====================
  // Enrollments
  // =====================
  async getEnrollments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/student/enrollments?${queryParams}` : '/student/enrollments';
    const response = await API.get(url);
    return response.data;
  },

  // =====================
  // Legacy aliases (for backward compatibility)
  // =====================
  async getMyReports(params = {}) {
    return this.getMonthlyReports(params);
  },

  async createReport(data) {
    return this.submitMonthlyReport(data);
  },

  async updateReport(id, data) {
    return this.updateMonthlyReport(id, data);
  },
};

export default studentService;
