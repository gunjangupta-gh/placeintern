import API from './api';

/**
 * Principal Service
 * API methods for principal operations
 * Note: Response unwrapping is handled centrally in api.js interceptor
 */
export const principalService = {
  // Dashboard
  async getDashboard(forceRefresh = false) {
    const url = forceRefresh ? '/principal/dashboard?refresh=true' : '/principal/dashboard';
    const response = await API.get(url);
    return response.data;
  },

  // Dashboard - Mentor Coverage
  async getMentorCoverage() {
    const response = await API.get('/principal/dashboard/mentor-coverage');
    return response.data;
  },

  // Dashboard - Compliance Metrics
  async getComplianceMetrics() {
    const response = await API.get('/principal/dashboard/compliance');
    return response.data;
  },

  // Dashboard - Enhanced Alerts
  async getAlertsEnhanced() {
    const response = await API.get('/principal/dashboard/alerts-enhanced');
    return response.data;
  },

  // Students
  async getStudents(params = {}) {
    // Filter out empty/undefined values to avoid sending "undefined" strings
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/students?${queryParams}` : '/principal/students';
    const response = await API.get(url);
    return response.data;
  },

  async getStudentById(id) {
    const response = await API.get(`/principal/students/${id}`);
    return response.data;
  },

  async getUnmaskedContactDetails(studentId) {
    const response = await API.get(`/principal/students/${studentId}/unmasked-contact`);
    return response.data;
  },

  async createStudent(data, profileImage = null) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (profileImage) {
      formData.append('profileImage', profileImage);
    }
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/principal/students', formData);
    return response.data;
  },

  async updateStudent(id, data, profileImage = null) {
    // Only use FormData if there's a profile image, otherwise send JSON
    if (profileImage) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // Convert booleans to strings for FormData
          formData.append(key, typeof value === 'boolean' ? String(value) : value);
        }
      });
      formData.append('profileImage', profileImage);
      // Don't set Content-Type header - let Axios set it automatically with the correct boundary
      const response = await API.put(`/principal/students/${id}`, formData);
      return response.data;
    }

    // Send JSON for regular updates (preserves boolean types)
    const response = await API.put(`/principal/students/${id}`, data);
    return response.data;
  },

  async deleteStudent(id) {
    const response = await API.delete(`/principal/students/${id}`);
    return response.data;
  },

  async toggleStudentStatus(studentId) {
    const response = await API.patch(`/principal/students/${studentId}/toggle-status`);
    return response.data;
  },

  async bulkUploadStudents(file) {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/principal/students/bulk-upload', formData);
    return response.data;
  },

  async bulkUploadStaff(file) {
    const formData = new FormData();
    formData.append('file', file);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post('/principal/staff/bulk-upload', formData);
    return response.data;
  },

  // Note: downloadTemplate moved to bulk.service.js

  // Staff
  async getStaff(params = {}) {
    // Backend principal staff list uses `isActive` as the query param
    // (it may come through as a string). Keep compatibility with callers
    // that pass `active`.
    const normalizedParams = { ...params };
    if (normalizedParams.isActive == null && normalizedParams.active != null) {
      normalizedParams.isActive = normalizedParams.active;
      delete normalizedParams.active;
    }

    const cleanParams = Object.fromEntries(
      Object.entries(normalizedParams).filter(([, v]) => v != null && v !== '')
    );

    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/staff?${queryParams}` : '/principal/staff';
    const response = await API.get(url);
    return response.data;
  },

  async getStaffById(id) {
    const response = await API.get(`/principal/staff/${id}`);
    return response.data;
  },

  async createStaff(data) {
    const response = await API.post('/principal/staff', data);
    return response.data;
  },

  async updateStaff(id, data) {
    const response = await API.put(`/principal/staff/${id}`, data);
    return response.data;
  },

  async deleteStaff(id) {
    const response = await API.delete(`/principal/staff/${id}`);
    return response.data;
  },

  async toggleStaffStatus(id) {
    const response = await API.patch(`/principal/staff/${id}/toggle-status`);
    return response.data;
  },

  // Mentors
  async getMentors(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors?${queryParams}` : '/principal/mentors';
    const response = await API.get(url);
    return response.data;
  },

  async assignMentor(data) {
    // data should contain: { mentorId, studentIds, academicYear, semester?, reason?, notes? }
    const response = await API.post('/principal/mentors/assign', data);
    return response.data;
  },

  async getMentorAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors/assignments?${queryParams}` : '/principal/mentors/assignments';
    const response = await API.get(url);
    return response.data;
  },

  async getExternalMentorAssignments(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/mentors/external-assignments?${queryParams}` : '/principal/mentors/external-assignments';
    const response = await API.get(url);
    return response.data;
  },

  async getMentorStats() {
    const response = await API.get('/principal/mentors/stats');
    return response.data;
  },

  // Joining Reports
  async getJoiningLetterStats() {
    const response = await API.get('/principal/joining-letters/stats');
    return response.data;
  },

  async getJoiningLettersByMentor() {
    const response = await API.get('/principal/joining-letters/by-mentor');
    return response.data;
  },

  async getJoiningLetters(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/joining-letters?${queryParams}` : '/principal/joining-letters';
    const response = await API.get(url);
    return response.data;
  },

  async getJoiningLetterActivity(limit = 10) {
    const response = await API.get(`/principal/joining-letters/activity?limit=${limit}`);
    return response.data;
  },

  async verifyJoiningLetter(applicationId, data = {}) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/verify`, data);
    return response.data;
  },

  async rejectJoiningLetter(applicationId, remarks) {
    const response = await API.put(`/principal/joining-letters/${applicationId}/reject`, { remarks });
    return response.data;
  },

  // Internship Stats with Company Details
  async getInternshipStats() {
    const response = await API.get('/principal/internships/stats');
    return response.data;
  },

  // Faculty Workload
  async getFacultyProgress(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/principal/faculty/progress?${queryParams}` : '/principal/faculty/progress';
    const response = await API.get(url);
    return response.data;
  },

  async getFacultyProgressDetails(facultyId) {
    const response = await API.get(`/principal/faculty/progress/${facultyId}`);
    return response.data;
  },

  async getFacultyVisitReports(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/faculty/reports?${queryParams}` : '/principal/faculty/reports';
    const response = await API.get(url);
    return response.data;
  },

  async getPrincipalVisitReports(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/principal/visit-logs?${queryParams}` : '/principal/visit-logs';
    const response = await API.get(url);
    return response.data;
  },

  // Internship Management
  async getInternshipById(applicationId) {
    // STUBBED: Industry/internship functionality removed
    return null;
  },

  async updateInternship(applicationId, data) {
    // STUBBED: Industry/internship functionality removed
    return { success: false, message: 'Internship management is currently unavailable' };
  },

  async bulkUpdateInternshipStatus(applicationIds, status, remarks = '') {
    // STUBBED: Industry/internship functionality removed
    return { success: false, message: 'Internship bulk operations are currently unavailable', updated: 0 };
  },

  async deleteInternship(applicationId) {
    const response = await API.delete(`/principal/internships/${applicationId}`);
    return response.data;
  },

  // Remove mentor from student
  async removeMentor(studentId) {
    const response = await API.delete(`/principal/students/${studentId}/mentor`);
    return response.data;
  },

  // Bulk unassign mentors
  async bulkUnassignMentors(studentIds) {
    const response = await API.post('/principal/mentors/bulk-unassign', { studentIds });
    return response.data;
  },

  // Auto-assign mentors
  async autoAssignMentors() {
    const response = await API.post('/principal/mentors/auto-assign');
    return response.data;
  },

  // Note: resetUserPassword moved to credentialsService
  // Use credentialsService.resetUserPassword(userId) instead

  // Student Documents
  async getStudentDocuments(studentId) {
    const response = await API.get(`/principal/students/${studentId}/documents`);
    return response.data;
  },

  async uploadStudentDocument(studentId, file, type) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    // Don't set Content-Type header - let Axios set it automatically with the correct boundary
    const response = await API.post(`/principal/students/${studentId}/documents`, formData);
    return response.data;
  },

  async deleteStudentDocument(studentId, documentId) {
    const response = await API.delete(`/principal/students/${studentId}/documents/${documentId}`);
    return response.data;
  },
};

export default principalService;
