import API from './api';

/**
 * State Service
 * API methods for state-level operations
 * Note: Response unwrapping is handled centrally in api.js interceptor
 */
export const stateService = {
  // Dashboard
  async getDashboard(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/dashboard?${queryParams}` : '/state/dashboard';
    const response = await API.get(url);
    return response.data;
  },

  // Dashboard - Critical Alerts
  async getCriticalAlerts() {
    const response = await API.get('/state/dashboard/critical-alerts');
    return response.data;
  },

  // Dashboard - Action Items
  async getActionItems() {
    const response = await API.get('/state/dashboard/actions');
    return response.data;
  },

  // Compliance Summary
  async getComplianceSummary() {
    const response = await API.get('/state/compliance/summary');
    return response.data;
  },

  // Monthly Compliance (Reports & Visits by Institution)
  async getMonthlyCompliance(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/compliance/monthly?${queryParams}` : '/state/compliance/monthly';
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionComplianceDetails(institutionId, params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams
      ? `/state/compliance/institution/${institutionId}?${queryParams}`
      : `/state/compliance/institution/${institutionId}`;
    const response = await API.get(url);
    return response.data;
  },

  async getAvailableComplianceMonths() {
    const response = await API.get('/state/compliance/monthly/available-months');
    return response.data;
  },

  // Get student documents with presigned URLs
  async getStudentDocuments(studentId) {
    const response = await API.get(`/state/students/${studentId}/documents`);
    return response.data;
  },

  // Get institution file explorer (all documents, joining reports, reports)
  async getInstitutionFileExplorer(institutionId) {
    const response = await API.get(`/state/institutions/${institutionId}/file-explorer`);
    return response.data;
  },

  // Get fresh presigned URL for a file (when cached URL has expired)
  async getFilePresignedUrl(fileType, fileId) {
    const response = await API.get(`/state/files/${fileType}/${fileId}/presigned-url`);
    return response.data;
  },

  // Institutions
  async getInstitutions(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/institutions?${queryParams}` : '/state/institutions';
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionsWithStats(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/institutions/dashboard-stats?${queryParams}` : '/state/institutions/dashboard-stats';
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionById(id) {
    const response = await API.get(`/state/institutions/${id}`);
    return response.data;
  },

  async createInstitution(data) {
    const response = await API.post('/state/institutions', data);
    return response.data;
  },

  async updateInstitution(id, data) {
    const response = await API.put(`/state/institutions/${id}`, data);
    return response.data;
  },

  async deleteInstitution(id) {
    const response = await API.delete(`/state/institutions/${id}`);
    return response.data;
  },

  // Institution Details
  async getInstitutionOverview(id) {
    const response = await API.get(`/state/institutions/${id}/overview`);
    return response.data;
  },

  async getInstitutionStudents(id, params = {}) {
    // Filter out undefined/null values to prevent "undefined" strings in query
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams
      ? `/state/institutions/${id}/students?${queryParams}`
      : `/state/institutions/${id}/students`;
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionCompanies(id, params = {}) {
    // Filter out undefined/null values to prevent "undefined" strings in query
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams
      ? `/state/institutions/${id}/companies?${queryParams}`
      : `/state/institutions/${id}/companies`;
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionFacultyPrincipal(id) {
    const response = await API.get(`/state/institutions/${id}/faculty-principal`);
    return response.data;
  },

  async deleteFaculty(facultyId) {
    const response = await API.delete(`/state/faculty/${facultyId}`);
    return response.data;
  },

  // Principals
  async getPrincipals(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/principals?${queryParams}` : '/state/principals';
    const response = await API.get(url);
    return response.data;
  },

  async createPrincipal(data) {
    const response = await API.post('/state/principals', data);
    return response.data;
  },

  async updatePrincipal(id, data) {
    const response = await API.put(`/state/principals/${id}`, data);
    return response.data;
  },

  async getPrincipalById(id) {
    const response = await API.get(`/state/principals/${id}`);
    return response.data;
  },

  async deletePrincipal(id) {
    const response = await API.delete(`/state/principals/${id}`);
    return response.data;
  },

  async togglePrincipalStatus(id) {
    const response = await API.patch(`/state/principals/${id}/toggle-status`);
    return response.data;
  },

  async resetPrincipalPassword(id) {
    const response = await API.post(`/state/principals/${id}/reset-password`);
    return response.data;
  },

  // Staff
  async getStaff(params = {}) {
    // Filter out undefined/null values to prevent "undefined" strings in query
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/staff?${queryParams}` : '/state/staff';
    const response = await API.get(url);
    return response.data;
  },

  async getStaffById(id) {
    const response = await API.get(`/state/staff/${id}`);
    return response.data;
  },

  async createStaff(data) {
    const response = await API.post('/state/staff', data);
    return response.data;
  },

  async updateStaff(id, data) {
    const response = await API.put(`/state/staff/${id}`, data);
    return response.data;
  },

  async deleteStaff(id) {
    const response = await API.delete(`/state/staff/${id}`);
    return response.data;
  },

  async resetStaffPassword(id) {
    const response = await API.post(`/state/staff/${id}/reset-password`);
    return response.data;
  },

  // Reports
  async getReports(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/reports/institutions?${queryParams}` : '/state/reports/institutions';
    const response = await API.get(url);
    return response.data;
  },

  async getReportById(id) {
    const response = await API.get(`/state/reports/${id}`);
    return response.data;
  },

  // Statistics
  async getStatistics(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/statistics?${queryParams}` : '/state/statistics';
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Top Performers
  async getTopPerformers(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/analytics/performers?${queryParams}` : '/state/analytics/performers';
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Top Industries
  async getTopIndustries(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/analytics/industries?${queryParams}` : '/state/analytics/industries';
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Monthly Stats
  async getMonthlyAnalytics(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/analytics/monthly?${queryParams}` : '/state/analytics/monthly';
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Institution Performance
  async getInstitutionPerformance(id, params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams
      ? `/state/analytics/institution/${id}?${queryParams}`
      : `/state/analytics/institution/${id}`;
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Monthly Report Stats
  async getMonthlyReportStats(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/analytics/reports?${queryParams}` : '/state/analytics/reports';
    const response = await API.get(url);
    return response.data;
  },

  // Analytics - Faculty Visit Stats
  async getFacultyVisitStats(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/analytics/visits?${queryParams}` : '/state/analytics/visits';
    const response = await API.get(url);
    return response.data;
  },

  // Audit Logs
  async getAuditLogs(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/audit-logs?${queryParams}` : '/state/audit-logs';
    const response = await API.get(url);
    return response.data;
  },

  // Placement Statistics
  async getPlacementStats() {
    const response = await API.get('/state/placements/stats');
    return response.data;
  },

  async getPlacementTrends(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/placements/trends?${queryParams}` : '/state/placements/trends';
    const response = await API.get(url);
    return response.data;
  },

  // Joining Report Stats
  async getJoiningLetterStats(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/joining-letters/stats?${queryParams}` : '/state/joining-letters/stats';
    const response = await API.get(url);
    return response.data;
  },

  // Visits by Type (for pie chart)
  async getVisitsByType(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/dashboard/visits-by-type?${queryParams}` : '/state/dashboard/visits-by-type';
    const response = await API.get(url);
    return response.data;
  },

  // Industry Approvals (stubbed - industry oversight removed)
  async getPendingIndustries(params = {}) {
    // Stubbed: Industry approval oversight removed from state level
    return { data: [], total: 0, pending: 0 };
  },

  async approveIndustry(id, approvedBy) {
    // Stubbed: Industry approval removed from state level
    throw new Error('Industry approval is no longer managed at state level');
  },

  async rejectIndustry(id, reason) {
    // Stubbed: Industry rejection removed from state level
    throw new Error('Industry rejection is no longer managed at state level');
  },

  // Export Dashboard Report
  async exportDashboard(params = {}) {
    const queryParams = new URLSearchParams(params).toString();
    const url = queryParams ? `/state/export/dashboard?${queryParams}` : '/state/export/dashboard';
    const response = await API.get(url);
    return response.data;
  },

  // Export as Blob for download
  async exportDashboardBlob(params = {}) {
    const queryParams = new URLSearchParams({ ...params, format: 'csv' }).toString();
    const url = `/state/export/dashboard?${queryParams}`;
    const response = await API.get(url, { responseType: 'blob' });
    return response.data;
  },

  // Mentor Management
  async getAllMentors(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/mentors?${queryParams}` : '/state/mentors';
    const response = await API.get(url);
    return response.data;
  },

  async getInstitutionMentors(institutionId) {
    const response = await API.get(`/state/institutions/${institutionId}/mentors`);
    return response.data;
  },

  async getInstitutionMentorOverview() {
    const response = await API.get('/state/mentors/institution-overview');
    return response.data;
  },

  async assignMentorToStudent(studentId, mentorId) {
    const response = await API.post(`/state/students/${studentId}/assign-mentor`, { mentorId });
    return response.data;
  },

  async removeMentorFromStudent(studentId) {
    const response = await API.delete(`/state/students/${studentId}/mentor`);
    return response.data;
  },

  async deleteStudent(studentId) {
    const response = await API.delete(`/state/students/${studentId}`);
    return response.data;
  },

  async toggleStudentStatus(studentId) {
    const response = await API.patch(`/state/students/${studentId}/toggle-status`);
    return response.data;
  },

  async toggleFacultyStatus(facultyId) {
    const response = await API.patch(`/state/faculty/${facultyId}/toggle-status`);
    return response.data;
  },

  // Users Management
  async getUsers(params = {}) {
    // Filter out undefined/null values to prevent "undefined" strings in query
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/users?${queryParams}` : '/state/users';
    const response = await API.get(url);
    return response.data;
  },

  async resetUserPassword(userId, role) {
    // Determine the correct endpoint based on role
    const isPrincipal = role === 'PRINCIPAL';
    const isStaff = [
      'TEACHER', 'FACULTY_COORDINATOR', 'ADMIN_STAFF', 'PLACEMENT_OFFICER',
      'ACCOUNTANT', 'ADMISSION_OFFICER', 'EXAMINATION_OFFICER',
      'PMS_OFFICER', 'EXTRACURRICULAR_HEAD'
    ].includes(role);

    let endpoint;
    if (isPrincipal) {
      endpoint = `/state/principals/${userId}/reset-password`;
    } else if (isStaff) {
      endpoint = `/state/staff/${userId}/reset-password`;
    } else {
      throw new Error('Cannot reset password for this user type');
    }

    const response = await API.post(endpoint);
    return response.data;
  },

  // ==================== STATE-WIDE COMPANIES OVERVIEW ====================

  // Get all companies across all institutions
  async getAllCompanies(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/companies?${queryParams}` : '/state/companies';
    const response = await API.get(url);
    return response.data;
  },

  // Get company details with all institutions and students
  async getCompanyDetails(companyId) {
    const response = await API.get(`/state/companies/${encodeURIComponent(companyId)}`);
    return response.data;
  },

  // ==================== COLLEGE-WISE BREAKDOWN ====================

  // Get college-wise breakdown for dashboard stats
  // type: 'students' | 'reports' | 'mentors' | 'visits'
  async getCollegeWiseBreakdown(type, params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams
      ? `/state/dashboard/college-breakdown/${type}?${queryParams}`
      : `/state/dashboard/college-breakdown/${type}`;
    const response = await API.get(url);
    return response.data;
  },

  // ==================== RESTORE CENTER ====================

  // Get summary of deleted items counts across all types
  async getDeletedItemsSummary(institutionId) {
    const params = institutionId ? `?institutionId=${institutionId}` : '';
    const response = await API.get(`/state/restore/summary${params}`);
    return response.data;
  },

  // Get deleted items by type with pagination and filters
  // type: 'monthly-reports' | 'faculty-visits' | 'documents'
  async getDeletedItems(type, params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams
      ? `/state/restore/${type}?${queryParams}`
      : `/state/restore/${type}`;
    const response = await API.get(url);
    return response.data;
  },

  // Restore a single deleted item
  async restoreItem(type, id) {
    const response = await API.post(`/state/restore/${type}/${id}`);
    return response.data;
  },

  // Bulk restore multiple deleted items
  async bulkRestoreItems(type, ids) {
    const response = await API.post(`/state/restore/${type}/bulk`, { ids });
    return response.data;
  },

  // ==================== STATE-WIDE STUDENTS ====================

  // Get all students across all institutions with filters and pagination
  async getAllStudents(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/students?${queryParams}` : '/state/students';
    const response = await API.get(url);
    return response.data;
  },

  // Get summary statistics for all students
  async getStudentsSummary() {
    const response = await API.get('/state/students/summary');
    return response.data;
  },

  // Get all students for export (no pagination)
  async getAllStudentsForExport(params = {}) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '')
    );
    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `/state/students/export?${queryParams}` : '/state/students/export';
    const response = await API.get(url);
    return response.data;
  },
};

export default stateService;
