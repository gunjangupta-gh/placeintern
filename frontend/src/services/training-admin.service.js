import API from './api';

/**
 * Training Admin Service (State Directorate)
 * API methods for state training operations
 */
const trainingAdminService = {
  // Trainings
  async createTraining(data) {
    const response = await API.post('/state/training', data);
    return response.data;
  },

  async getTrainings(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/training?${queryParams}` : '/state/training';
    const response = await API.get(url);
    return response.data;
  },

  async getTrainingDetails(id) {
    const response = await API.get(`/state/training/${id}`);
    return response.data;
  },

  async getTrainingStats(id) {
    const response = await API.get(`/state/training/${id}/stats`);
    return response.data;
  },

  async updateTraining(id, data) {
    const response = await API.patch(`/state/training/${id}`, data);
    return response.data;
  },

  async deleteTraining(id) {
    const response = await API.delete(`/state/training/${id}`);
    return response.data;
  },

  async publishTraining(id) {
    const response = await API.post(`/state/training/${id}/publish`);
    return response.data;
  },

  async unpublishTraining(id) {
    const response = await API.post(`/state/training/${id}/unpublish`);
    return response.data;
  },

  // Applications
  async getAllApplications(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/training/applications/all?${queryParams}` : '/state/training/applications/all';
    const response = await API.get(url);
    return response.data;
  },

  async getTrainingApplications(trainingId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/training/${trainingId}/applications?${queryParams}`
      : `/state/training/${trainingId}/applications`;
    const response = await API.get(url);
    return response.data;
  },

  async getApplication(id) {
    const response = await API.get(`/state/training/applications/${id}`);
    return response.data;
  },

  async reviewApplication(id, data) {
    const response = await API.patch(`/state/training/applications/${id}/review`, data);
    return response.data;
  },

  async bulkReviewApplications(data) {
    const response = await API.post('/state/training/applications/bulk-review', data);
    return response.data;
  },

  // Attendance
  async getTrainingAttendance(trainingId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/training/${trainingId}/attendance?${queryParams}`
      : `/state/training/${trainingId}/attendance`;
    const response = await API.get(url);
    return response.data;
  },

  async markBulkAttendance(trainingId, data) {
    const response = await API.post(`/state/training/${trainingId}/attendance/mark`, data);
    return response.data;
  },

  // Certificates
  async getTrainingCertificates(trainingId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/training/${trainingId}/certificates?${queryParams}`
      : `/state/training/${trainingId}/certificates`;
    const response = await API.get(url);
    return response.data;
  },

  async issueCertificate(trainingId, userId) {
    const response = await API.post(`/state/training/${trainingId}/certificates/issue`, { userId });
    return response.data;
  },

  async bulkIssueCertificates(trainingId, data) {
    const response = await API.post(`/state/training/${trainingId}/certificates/bulk-issue`, data);
    return response.data;
  },

  async revokeCertificate(id, data) {
    const response = await API.patch(`/state/training/certificates/${id}/revoke`, data);
    return response.data;
  },

  async verifyCertificate(number) {
    const response = await API.get(`/state/training/certificates/${number}/verify`);
    return response.data;
  },

  // Lesson Plans
  async getLessonPlans(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/training/lesson-plans?${queryParams}` : '/state/training/lesson-plans';
    const response = await API.get(url);
    return response.data;
  },

  async getLessonPlan(id) {
    const response = await API.get(`/state/training/lesson-plans/${id}`);
    return response.data;
  },

  async getTrainingLessonPlans(trainingId) {
    const response = await API.get(`/state/training/${trainingId}/lesson-plans`);
    return response.data;
  },

  async reviewLessonPlan(id, data) {
    const response = await API.patch(`/state/training/lesson-plans/${id}/review`, data);
    return response.data;
  },

  // Feedback Forms
  async createFeedbackForm(data) {
    const response = await API.post('/state/feedback-forms', data);
    return response.data;
  },

  async getFeedbackForms(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/feedback-forms?${queryParams}` : '/state/feedback-forms';
    const response = await API.get(url);
    return response.data;
  },

  async getFeedbackForm(id) {
    const response = await API.get(`/state/feedback-forms/${id}`);
    return response.data;
  },

  async updateFeedbackForm(id, data) {
    const response = await API.patch(`/state/feedback-forms/${id}`, data);
    return response.data;
  },

  async deleteFeedbackForm(id) {
    const response = await API.delete(`/state/feedback-forms/${id}`);
    return response.data;
  },

  async publishFeedbackForm(id) {
    const response = await API.post(`/state/feedback-forms/${id}/publish`);
    return response.data;
  },

  async duplicateFeedbackForm(id, title) {
    const response = await API.post(`/state/feedback-forms/${id}/duplicate`, { title });
    return response.data;
  },

  async assignFeedbackForm(formId, trainingId) {
    const response = await API.post(`/state/feedback-forms/${formId}/assign/${trainingId}`);
    return response.data;
  },

  async getFeedbackResponses(formId, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/feedback-forms/${formId}/responses?${queryParams}`
      : `/state/feedback-forms/${formId}/responses`;
    const response = await API.get(url);
    return response.data;
  },

  async getTrainingFeedbackResponses(trainingId) {
    const response = await API.get(`/state/feedback-forms/training/${trainingId}/responses`);
    return response.data;
  },

  async getFeedbackStats(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/feedback-forms/stats?${queryParams}` : '/state/feedback-forms/stats';
    const response = await API.get(url);
    return response.data;
  },

  // Reports (State)
  async getDashboard() {
    const response = await API.get('/state/training/reports/dashboard');
    return response.data;
  },

  async getCalendar(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/training/reports/calendar?${queryParams}` : '/state/training/reports/calendar';
    const response = await API.get(url);
    return response.data;
  },

  async getUpcoming(limit = 10) {
    const response = await API.get(`/state/training/reports/upcoming?limit=${limit}`);
    return response.data;
  },

  async getAttendanceReport(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/training/reports/attendance?${queryParams}`
      : '/state/training/reports/attendance';
    const response = await API.get(url);
    return response.data;
  },
};

export default trainingAdminService;
export { trainingAdminService };
