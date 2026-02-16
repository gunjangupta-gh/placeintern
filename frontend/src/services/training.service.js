import API from './api';

/**
 * Training Service (Faculty)
 * API methods for faculty training operations
 */
const trainingService = {
  buildQueryParams(params = {}) {
    const entries = Object.entries(params).filter(([_, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'string') return value.trim() !== '';
      return true;
    });
    return new URLSearchParams(entries).toString();
  },
  // Trainings
  async getTrainings(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const url = queryParams ? `/faculty/training?${queryParams}` : '/faculty/training';
    const response = await API.get(url);
    return response.data;
  },

  async getTrainingDetails(id) {
    const response = await API.get(`/faculty/training/${id}`);
    return response.data;
  },

  async getCalendar(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const url = queryParams ? `/faculty/training/calendar?${queryParams}` : '/faculty/training/calendar';
    const response = await API.get(url);
    return response.data;
  },

  async getUpcoming(limit = 10) {
    const response = await API.get(`/faculty/training/upcoming?limit=${limit}`);
    return response.data;
  },

  async getMyTrainings() {
    const response = await API.get('/faculty/training/my-trainings');
    return response.data;
  },

  async checkEligibility(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/eligibility`);
    return response.data;
  },

  // Applications
  async getMyApplications(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const url = queryParams ? `/faculty/training/applications?${queryParams}` : '/faculty/training/applications';
    const response = await API.get(url);
    return response.data;
  },

  async getApplication(id) {
    const response = await API.get(`/faculty/training/applications/${id}`);
    return response.data;
  },

  async apply(data) {
    const response = await API.post('/faculty/training/applications', data);
    return response.data;
  },

  async withdrawApplication(id) {
    const response = await API.delete(`/faculty/training/applications/${id}`);
    return response.data;
  },

  async getApplicationStatus(trainingId) {
    const response = await API.get(`/faculty/training/applications/training/${trainingId}/status`);
    return response.data;
  },

  // Attendance
  async getMyAttendance() {
    const response = await API.get('/faculty/training/attendance');
    return response.data;
  },

  async getTrainingAttendance(trainingId) {
    const response = await API.get(`/faculty/training/attendance/training/${trainingId}`);
    return response.data;
  },

  async markSelfAttendance(data) {
    const response = await API.post('/faculty/training/attendance/mark', data);
    return response.data;
  },

  async getAttendanceSummary() {
    const response = await API.get('/faculty/training/attendance/summary');
    return response.data;
  },

  // Feedback
  async getFeedbackForm(trainingId) {
    const response = await API.get(`/faculty/training/feedback/training/${trainingId}/form`);
    return response.data;
  },

  async submitFeedback(trainingId, data) {
    const response = await API.post(`/faculty/training/feedback/training/${trainingId}/submit`, data);
    return response.data;
  },

  async getFeedbackStatus(trainingId) {
    const response = await API.get(`/faculty/training/feedback/training/${trainingId}/status`);
    return response.data;
  },

  async getMyFeedbackResponses() {
    const response = await API.get('/faculty/training/feedback/my-responses');
    return response.data;
  },

  async getPendingFeedback() {
    const response = await API.get('/faculty/training/feedback/pending');
    return response.data;
  },

  // Lesson Plans
  async getMyLessonPlans(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const url = queryParams ? `/faculty/training/lesson-plans?${queryParams}` : '/faculty/training/lesson-plans';
    const response = await API.get(url);
    return response.data;
  },

  async getLessonPlan(id) {
    const response = await API.get(`/faculty/training/lesson-plans/${id}`);
    return response.data;
  },

  async createLessonPlan(data) {
    const response = await API.post('/faculty/training/lesson-plans', data);
    return response.data;
  },

  async updateLessonPlan(id, data) {
    const response = await API.patch(`/faculty/training/lesson-plans/${id}`, data);
    return response.data;
  },

  async deleteLessonPlan(id) {
    const response = await API.delete(`/faculty/training/lesson-plans/${id}`);
    return response.data;
  },

  async submitLessonPlan(id) {
    const response = await API.post(`/faculty/training/lesson-plans/${id}/submit`);
    return response.data;
  },

  async getTrainingLessonPlans(trainingId) {
    const response = await API.get(`/faculty/training/lesson-plans/training/${trainingId}`);
    return response.data;
  },

  // Certificates
  async getMyCertificates() {
    const response = await API.get('/faculty/training/certificates');
    return response.data;
  },

  async getCertificate(id) {
    const response = await API.get(`/faculty/training/certificates/${id}`);
    return response.data;
  },

  async downloadCertificate(id) {
    const response = await API.get(`/faculty/training/certificates/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async getTrainingCertificate(trainingId) {
    const response = await API.get(`/faculty/training/certificates/training/${trainingId}`);
    return response.data;
  },

  // Pre-Test
  async getPreTestForm(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/pre-test`);
    return response.data;
  },

  async getPreTestStatus(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/pre-test/status`);
    return response.data;
  },

  async submitPreTest(trainingId, data) {
    const response = await API.post(`/faculty/training/${trainingId}/pre-test/submit`, data);
    return response.data;
  },

  // Post-Test
  async getPostTestForm(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/post-test`);
    return response.data;
  },

  async getPostTestStatus(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/post-test/status`);
    return response.data;
  },

  async submitPostTest(trainingId, data) {
    const response = await API.post(`/faculty/training/${trainingId}/post-test/submit`, data);
    return response.data;
  },

  // Combined Test Status
  async getTestStatuses(trainingId) {
    const response = await API.get(`/faculty/training/${trainingId}/tests/status`);
    return response.data;
  },

  async getPendingTests() {
    const response = await API.get('/faculty/training/tests/pending');
    return response.data;
  },

  // Recommendations
  async getMyRecommendations(params = {}) {
    const queryParams = this.buildQueryParams(params);
    const url = queryParams ? `/faculty/training/recommendations?${queryParams}` : '/faculty/training/recommendations';
    const response = await API.get(url);
    return response.data;
  },

  async getRecommendation(id) {
    const response = await API.get(`/faculty/training/recommendations/${id}`);
    return response.data;
  },

  async createRecommendation(data) {
    const response = await API.post('/faculty/training/recommendations', data);
    return response.data;
  },

  async updateRecommendation(id, data) {
    const response = await API.patch(`/faculty/training/recommendations/${id}`, data);
    return response.data;
  },

  async deleteRecommendation(id) {
    const response = await API.delete(`/faculty/training/recommendations/${id}`);
    return response.data;
  },
};

export default trainingService;
export { trainingService };
