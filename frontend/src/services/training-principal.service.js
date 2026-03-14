import API from './api';

/**
 * Training Service (Principal)
 * API methods for principal training operations
 */
const trainingPrincipalService = {
  // Trainings
  async getTrainings(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training?${queryParams}` : '/principal/training';
    const response = await API.get(url);
    return response.data;
  },

  async getTrainingDetails(id) {
    const response = await API.get(`/principal/training/${id}`);
    return response.data;
  },

  async getTrainingStats(id) {
    const response = await API.get(`/principal/training/${id}/stats`);
    return response.data;
  },

  async getTrainingAttendance(id, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/principal/training/${id}/attendance?${queryParams}`
      : `/principal/training/${id}/attendance`;
    const response = await API.get(url);
    return response.data;
  },

  async getCalendar(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training/calendar?${queryParams}` : '/principal/training/calendar';
    const response = await API.get(url);
    return response.data;
  },

  async getUpcoming(limit = 10) {
    const response = await API.get(`/principal/training/upcoming?limit=${limit}`);
    return response.data;
  },

  // Applications
  async getApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training/applications?${queryParams}` : '/principal/training/applications';
    const response = await API.get(url);
    return response.data;
  },

  async getApplication(id) {
    const response = await API.get(`/principal/training/applications/${id}`);
    return response.data;
  },

  async reviewApplication(id, data) {
    const response = await API.patch(`/principal/training/applications/${id}/review`, data);
    return response.data;
  },

  async bulkReviewApplications(data) {
    const response = await API.post('/principal/training/applications/bulk-review', data);
    return response.data;
  },

  async getTrainingApplications(trainingId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/principal/training/applications/training/${trainingId}?${queryParams}`
      : `/principal/training/applications/training/${trainingId}`;
    const response = await API.get(url);
    return response.data;
  },

  async getApplicationStats() {
    const response = await API.get('/principal/training/applications/stats');
    return response.data;
  },

  // Lesson Plans
  async getLessonPlans(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training/lesson-plans?${queryParams}` : '/principal/training/lesson-plans';
    const response = await API.get(url);
    return response.data;
  },

  async getLessonPlan(id) {
    const response = await API.get(`/principal/training/lesson-plans/${id}`);
    return response.data;
  },

  async reviewLessonPlan(id, data) {
    const response = await API.patch(`/principal/training/lesson-plans/${id}/review`, data);
    return response.data;
  },

  async getTrainingLessonPlans(trainingId) {
    const response = await API.get(`/principal/training/lesson-plans/training/${trainingId}`);
    return response.data;
  },

  async getPendingLessonPlans() {
    const response = await API.get('/principal/training/lesson-plans/pending');
    return response.data;
  },

  async getLessonPlanStats() {
    const response = await API.get('/principal/training/lesson-plans/stats');
    return response.data;
  },

  // Reports
  async getDashboard() {
    const response = await API.get('/principal/training/reports/dashboard');
    return response.data;
  },

  async getAttendanceReport(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training/reports/attendance?${queryParams}` : '/principal/training/reports/attendance';
    const response = await API.get(url);
    return response.data;
  },

  async getCertificates() {
    const response = await API.get('/principal/training/reports/certificates');
    return response.data;
  },

  async getParticipationReport() {
    const response = await API.get('/principal/training/reports/participation');
    return response.data;
  },

  async getFeedbackSummary(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/training/reports/feedback?${queryParams}` : '/principal/training/reports/feedback';
    const response = await API.get(url);
    return response.data;
  },

  // Test Responses
  async getTestSummary() {
    const response = await API.get('/principal/training/test-responses/summary');
    return response.data;
  },

  async getPreTestResponses(trainingId) {
    const response = await API.get(`/principal/training/test-responses/pre-test/${trainingId}`);
    return response.data;
  },

  async getPostTestResponses(trainingId) {
    const response = await API.get(`/principal/training/test-responses/post-test/${trainingId}`);
    return response.data;
  },

  // Feedback Responses
  async getFeedbackResponseSummary() {
    const response = await API.get('/principal/training/feedback/summary');
    return response.data;
  },

  async getTrainingFeedbackResponses(trainingId) {
    const response = await API.get(`/principal/training/feedback/${trainingId}`);
    return response.data;
  },

  // Recommendations
  async getRecommendations(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/principal/training/recommendations?${queryParams}`
      : '/principal/training/recommendations';
    const response = await API.get(url);
    return response.data;
  },

  async getRecommendation(id) {
    const response = await API.get(`/principal/training/recommendations/${id}`);
    return response.data;
  },

  async reviewRecommendation(id, data) {
    const response = await API.patch(`/principal/training/recommendations/${id}/review`, data);
    return response.data;
  },
};

export default trainingPrincipalService;
export { trainingPrincipalService };
