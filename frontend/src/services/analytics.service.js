import API from './api';

/**
 * Analytics Service
 * API methods for principal analytics and reports
 */
export const analyticsService = {
  // Institution analytics
  async getInstitutionAnalytics(institutionId) {
    const response = await API.get(`/principal/analytics?institutionId=${institutionId}`);
    return response.data;
  },

  async getStudentProgress(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/principal/students/progress?${queryParams}`);
    return response.data;
  },

  async getPendingReportsByMonth(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/principal/reports/pending-by-month?${queryParams}`);
    return response.data;
  },

  async getFacultyReports(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const response = await API.get(`/principal/faculty/reports?${queryParams}`);
    return response.data;
  },

  // Note: getFacultyProgressList and getFacultyProgressDetails moved to principal.service.js
  // Use principalService.getFacultyProgress() and principalService.getFacultyProgressDetails()
};

export default analyticsService;
