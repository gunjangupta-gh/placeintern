import API from './api';

const cleanParams = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''));

export const internshipReportService = {
  async getReports(params = {}) {
    const queryParams = new URLSearchParams(cleanParams(params)).toString();
    const url = queryParams ? `/internship-reports?${queryParams}` : '/internship-reports';
    const response = await API.get(url);
    return response.data;
  },

  async getReportById(id) {
    const response = await API.get(`/internship-reports/${id}`);
    return response.data;
  },

  async createReport(data) {
    const response = await API.post('/internship-reports', data);
    return response.data;
  },

  async updateReport(id, data) {
    const response = await API.patch(`/internship-reports/${id}`, data);
    return response.data;
  },

  async deleteReport(id) {
    const response = await API.delete(`/internship-reports/${id}`);
    return response.data;
  },

  // STATE_DIRECTORATE only
  async exportReports(params = {}) {
    const queryParams = new URLSearchParams(cleanParams(params)).toString();
    const url = queryParams ? `/internship-reports/export?${queryParams}` : '/internship-reports/export';
    const response = await API.get(url, { responseType: 'blob' });

    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', 'tpo-internship-report.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
    return response.data;
  },

  // Reuses the shared company master-data lookup (same one the student self-identified
  // internship form uses) so principals can search/autofill from existing companies.
  async getCompanies(params = {}) {
    const queryParams = new URLSearchParams(cleanParams(params)).toString();
    const url = queryParams ? `/student/companies?${queryParams}` : '/student/companies';
    const response = await API.get(url);
    return response.data;
  },
};
