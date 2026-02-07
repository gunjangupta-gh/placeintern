import API from './api';

export const bulkService = {
  // Institution bulk upload
  async uploadInstitutions(file, onProgress, useAsync = false) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post(`/bulk/institutions/upload?async=${useAsync}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },
  async validateInstitutions(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await API.post('/bulk/institutions/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async downloadInstitutionTemplate() {
    const response = await API.get('/bulk/institutions/template', { responseType: 'blob' });
    return response.data;
  },

  // User bulk upload
  async uploadUsers(file, onProgress, useAsync = false, institutionId = null) {
    const formData = new FormData();
    formData.append('file', file);
    let url = `/bulk/users/upload?async=${useAsync}`;
    if (institutionId) {
      url += `&institutionId=${institutionId}`;
    }
    const response = await API.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },
  async validateUsers(file, institutionId = null) {
    const formData = new FormData();
    formData.append('file', file);
    let url = '/bulk/users/validate';
    if (institutionId) {
      url += `?institutionId=${institutionId}`;
    }
    const response = await API.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async downloadUserTemplate() {
    const response = await API.get('/bulk/users/template', { responseType: 'blob' });
    return response.data;
  },

  // Student bulk upload
  async uploadStudents(file, onProgress, useAsync = false, institutionId = null) {
    const formData = new FormData();
    formData.append('file', file);
    let url = `/bulk/students/upload?async=${useAsync}`;
    if (institutionId) {
      url += `&institutionId=${institutionId}`;
    }
    const response = await API.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
    return response.data;
  },
  async validateStudents(file, institutionId = null) {
    const formData = new FormData();
    formData.append('file', file);
    let url = '/bulk/students/validate';
    if (institutionId) {
      url += `?institutionId=${institutionId}`;
    }
    const response = await API.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  async downloadStudentTemplate() {
    const response = await API.get('/bulk/students/template', { responseType: 'blob' });
    return response.data;
  },

  // Generic template download (used by principal portal)
  async downloadTemplate(type) {
    const response = await API.get(`/bulk/templates/${type}`, {
      responseType: 'blob',
    });
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${type}-template.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return response.data;
  },

  // Bulk job tracking
  async getJobs(params = {}) {
    const response = await API.get('/bulk/jobs', { params });
    return response.data;
  },
  async getActiveJobs() {
    const response = await API.get('/bulk/jobs/active');
    return response.data;
  },
  async getMyJobs(limit = 10) {
    const response = await API.get('/bulk/jobs/my-jobs', { params: { limit } });
    return response.data;
  },
  async getJobStats() {
    const response = await API.get('/bulk/jobs/stats');
    return response.data;
  },
  async getJobById(id) {
    const response = await API.get(`/bulk/jobs/${id}`);
    return response.data;
  },
  async cancelJob(id) {
    const response = await API.post(`/bulk/jobs/${id}/cancel`);
    return response.data;
  },
  async retryJob(id) {
    const response = await API.post(`/bulk/jobs/${id}/retry`);
    return response.data;
  },
};
