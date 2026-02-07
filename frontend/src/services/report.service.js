import API from './api';

const API_PATH = '/shared/reports';

export const reportService = {
  // Catalog & Configuration
  async getCatalog() {
    const response = await API.get(`${API_PATH}/catalog`);
    return response.data?.data || response.data;
  },

  async getConfig(type) {
    const response = await API.get(`${API_PATH}/config/${type}`);
    return response.data?.data || response.data;
  },

  async getFilterValues(reportType, filterId, institutionId) {
    let url = `${API_PATH}/filters/${reportType}/${filterId}`;
    if (institutionId) {
      url += `?institutionId=${institutionId}`;
    }
    const response = await API.get(url);
    return response.data?.data || [];
  },

  // Report Generation
  async generateReport(data) {
    const response = await API.post(`${API_PATH}/generate`, data);
    return response.data?.data || response.data;
  },

  async generateReportSync(data) {
    const response = await API.post(`${API_PATH}/generate-sync`, data);
    return response.data?.data || response.data;
  },

  // Report Status & Retrieval
  async getReportStatus(id) {
    const response = await API.get(`${API_PATH}/${id}/status`);
    return response.data?.data || response.data;
  },

  async getReport(id) {
    const response = await API.get(`${API_PATH}/${id}`);
    return response.data?.data || response.data;
  },

  async downloadReport(id) {
    try {

      const response = await API.get(`${API_PATH}/${id}/download`, {
        responseType: 'blob',
        timeout: 60000, // 60 second timeout for large files
      });


      // Check if the response is an error (JSON instead of file)
      if (response.data.type === 'application/json') {
        const text = await response.data.text();
        console.error(`[ReportService] Received JSON error:`, text);
        try {
          const error = JSON.parse(text);
          throw new Error(error.message || 'Failed to download report');
        } catch {
          throw new Error(text || 'Failed to download report');
        }
      }

      // Validate we got actual file content
      if (!response.data || response.data.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      return response.data;
    } catch (error) {
      console.error(`[ReportService] Download error:`, error);

      // Handle axios error with blob response
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          console.error(`[ReportService] Error blob content:`, text);
          const errorData = JSON.parse(text);
          throw new Error(errorData.message || errorData.error || 'Failed to download report');
        } catch (parseError) {
          if (parseError.message && !parseError.message.includes('JSON')) {
            throw parseError;
          }
          // If parsing fails, use original error
          throw new Error(error.message || 'Failed to download report');
        }
      }

      // Handle network errors
      if (!error.response) {
        throw new Error('Unable to connect to server. Please try again later.');
      }

      throw error;
    }
  },

  async getHistory(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    const queryString = queryParams.toString();
    const url = queryString ? `${API_PATH}?${queryString}` : API_PATH;
    const response = await API.get(url);
    return response.data?.data || response.data;
  },

  // Template Management
  async saveTemplate(data) {
    const response = await API.post(`${API_PATH}/templates`, data);
    return response.data?.data || response.data;
  },

  async getTemplates(reportType) {
    let url = `${API_PATH}/templates/list`;
    if (reportType) {
      url += `?reportType=${reportType}`;
    }
    const response = await API.get(url);
    return response.data?.data || response.data || [];
  },

  async deleteTemplate(id) {
    const response = await API.delete(`${API_PATH}/templates/${id}`);
    return response.data;
  },

  // Queue Management
  async cancelReport(id) {
    const response = await API.post(`${API_PATH}/cancel/${id}`);
    return response.data;
  },

  async retryReport(id) {
    const response = await API.post(`${API_PATH}/retry/${id}`);
    return response.data;
  },

  async deleteReport(id) {
    const response = await API.delete(`${API_PATH}/report/${id}`);
    return response.data;
  },

  async getActiveReports() {
    const response = await API.get(`${API_PATH}/queue/active`);
    return response.data?.data || [];
  },

  async getFailedReports() {
    const response = await API.get(`${API_PATH}/queue/failed`);
    return response.data?.data || [];
  },

  async getQueueStats() {
    const response = await API.get(`${API_PATH}/queue/stats`);
    return response.data?.data || response.data;
  },

  // Utility - get download URL for direct linking
  getDownloadUrl(id) {
    const baseUrl = API.defaults.baseURL || '';
    return `${baseUrl}${API_PATH}/${id}/download`;
  },
};

export default reportService;
