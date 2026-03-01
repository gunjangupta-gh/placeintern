import API from './api';

/**
 * Training Service (Coordinator)
 * API methods for faculty coordinator training operations
 */
const trainingCoordinatorService = {
  // Applications
  async getApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/applications?${queryParams}`
      : '/coordinator/training/applications';
    const response = await API.get(url);
    return response.data;
  },

  async getApplication(id) {
    const response = await API.get(`/coordinator/training/applications/${id}`);
    return response.data;
  },

  async reviewApplication(id, data) {
    const response = await API.patch(`/coordinator/training/applications/${id}/review`, data);
    return response.data;
  },

  async bulkReviewApplications(data) {
    const response = await API.post('/coordinator/training/applications/bulk-review', data);
    return response.data;
  },

  async getTrainingApplications(trainingId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/applications/training/${trainingId}?${queryParams}`
      : `/coordinator/training/applications/training/${trainingId}`;
    const response = await API.get(url);
    return response.data;
  },

  async getApplicationStats() {
    const response = await API.get('/coordinator/training/applications/stats');
    return response.data;
  },

  // Lesson Plans
  async getLessonPlans(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/lesson-plans?${queryParams}`
      : '/coordinator/training/lesson-plans';
    const response = await API.get(url);
    return response.data;
  },

  async getLessonPlan(id) {
    const response = await API.get(`/coordinator/training/lesson-plans/${id}`);
    return response.data;
  },

  async reviewLessonPlan(id, data) {
    const response = await API.patch(`/coordinator/training/lesson-plans/${id}/review`, data);
    return response.data;
  },

  async getTrainingLessonPlans(trainingId) {
    const response = await API.get(`/coordinator/training/lesson-plans/training/${trainingId}`);
    return response.data;
  },

  async getPendingLessonPlans() {
    const response = await API.get('/coordinator/training/lesson-plans/pending');
    return response.data;
  },

  async getLessonPlanStats() {
    const response = await API.get('/coordinator/training/lesson-plans/stats');
    return response.data;
  },

  // Test Responses
  async getTestSummary() {
    const response = await API.get('/coordinator/training/test-responses/summary');
    return response.data;
  },

  async getPreTestResponses(trainingId) {
    const response = await API.get(`/coordinator/training/test-responses/pre-test/${trainingId}`);
    return response.data;
  },

  async getPostTestResponses(trainingId) {
    const response = await API.get(`/coordinator/training/test-responses/post-test/${trainingId}`);
    return response.data;
  },

  // Feedback Responses
  async getFeedbackSummary() {
    const response = await API.get('/coordinator/training/feedback/summary');
    return response.data;
  },

  async getTrainingFeedbackResponses(trainingId) {
    const response = await API.get(`/coordinator/training/feedback/${trainingId}`);
    return response.data;
  },

  // Recommendations
  async getRecommendations(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/recommendations?${queryParams}`
      : '/coordinator/training/recommendations';
    const response = await API.get(url);
    return response.data;
  },

  async getRecommendation(id) {
    const response = await API.get(`/coordinator/training/recommendations/${id}`);
    return response.data;
  },

  async reviewRecommendation(id, data) {
    const response = await API.patch(`/coordinator/training/recommendations/${id}/review`, data);
    return response.data;
  },

  // Reports
  async getDashboard() {
    const response = await API.get('/coordinator/training/reports/dashboard');
    return response.data;
  },

  async getAttendanceReport(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/reports/attendance?${queryParams}`
      : '/coordinator/training/reports/attendance';
    const response = await API.get(url);
    return response.data;
  },

  async getParticipationReport() {
    const response = await API.get('/coordinator/training/reports/participation');
    return response.data;
  },

  // Reminders
  async getPendingActions(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/coordinator/training/reminders/pending-actions?${queryParams}`
      : '/coordinator/training/reminders/pending-actions';
    const response = await API.get(url);
    return response.data;
  },

  async sendEnrollmentReminder(data) {
    const response = await API.post('/coordinator/training/reminders/enroll-training', data);
    return response.data;
  },

  async sendPreTestReminder(data) {
    const response = await API.post('/coordinator/training/reminders/pre-test', data);
    return response.data;
  },

  async sendPostTestReminder(data) {
    const response = await API.post('/coordinator/training/reminders/post-test', data);
    return response.data;
  },

  async sendLessonPlanReminder(data) {
    const response = await API.post('/coordinator/training/reminders/lesson-plan', data);
    return response.data;
  },

  async sendFeedbackReminder(data) {
    const response = await API.post('/coordinator/training/reminders/feedback', data);
    return response.data;
  },
};

export default trainingCoordinatorService;
export { trainingCoordinatorService };
