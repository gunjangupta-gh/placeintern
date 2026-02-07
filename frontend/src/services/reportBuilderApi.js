// Report Builder API Service
// Aligned with backend API contract from report-builder.controller.ts
import API from "./api";
import { downloadBlob } from "../utils/downloadUtils";

// Re-export for convenience (some components import it from this module)
export { downloadBlob };

// ============================================
// Error Handling Helper
// ============================================

/**
 * Wrap API call with error handling
 * @param {Function} apiCall - API call function
 * @param {string} errorMessage - Default error message
 * @returns {Promise} Result or throws formatted error
 */
const handleApiCall = async (apiCall, errorMessage = "API request failed") => {
  try {
    return await apiCall();
  } catch (error) {
    const message = error.response?.data?.message || error.message || errorMessage;
    console.error(`[ReportBuilder API] ${errorMessage}:`, message);
    throw new Error(message);
  }
};

// ============================================
// Report Catalog & Configuration
// ============================================

// API base path - matches backend @Controller('shared/reports')
const API_PATH = '/shared/reports';

/**
 * Get the full catalog of available reports grouped by category
 * Backend returns: { success: true, data: { CategoryLabel: [...reports] } }
 * @returns {Promise} Catalog object grouped by category
 */
export const getReportCatalog = async () => {
  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/catalog`);
    const catalogData = response.data?.data || response.data || {};
    return { data: catalogData };
  }, "Failed to load report catalog");
};

/**
 * Get detailed configuration for a specific report type
 * @param {string} reportType - The report type identifier (e.g., 'mentor-list')
 * @returns {Promise} API response with report configuration
 */
export const getReportConfig = async (reportType) => {
  if (!reportType) {
    throw new Error("Report type is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/config/${reportType}`);
    return { data: response.data?.data || response.data };
  }, `Failed to load configuration for ${reportType}`);
};

/**
 * Get available filter values for dynamic filters
 * Backend returns: { success: true, data: [{ value, label }] }
 * @param {string} reportType - The report type identifier
 * @param {string} filterId - The filter identifier
 * @param {string} institutionId - Optional institution ID for dependent filters
 * @returns {Promise} API response with filter options array
 */
export const getFilterValues = async (reportType, filterId, institutionId) => {
  if (!reportType || !filterId) {
    return { data: [] };
  }

  return handleApiCall(async () => {
    let url = `${API_PATH}/filters/${reportType}/${filterId}`;
    if (institutionId) {
      url += `?institutionId=${institutionId}`;
    }
    const response = await API.get(url);
    return { data: response.data?.data || [] };
  }, `Failed to load filter values for ${filterId}`);
};

// ============================================
// Report Generation
// ============================================

/**
 * Generate a report asynchronously (queued via BullMQ)
 * Returns immediately with report ID, poll status to check completion
 * @param {Object} payload - Report generation configuration
 * @returns {Promise} API response with report ID and status 'pending'
 */
export const generateReport = async (payload) => {
  if (!payload?.type) {
    throw new Error("Report type is required");
  }
  if (!payload?.format) {
    throw new Error("Export format is required");
  }

  return handleApiCall(async () => {
    const response = await API.post(`${API_PATH}/generate`, payload);
    return { data: response.data?.data || response.data };
  }, "Failed to generate report");
};

/**
 * Generate a report synchronously (immediate, 60s timeout)
 * Use only for small reports - async is recommended for production
 * @param {Object} payload - Report generation configuration
 * @returns {Promise} API response with generated report
 */
export const generateReportSync = async (payload) => {
  if (!payload?.type) {
    throw new Error("Report type is required");
  }
  if (!payload?.format) {
    throw new Error("Export format is required");
  }

  return handleApiCall(async () => {
    const response = await API.post(`${API_PATH}/generate-sync`, payload);
    return { data: response.data?.data || response.data };
  }, "Failed to generate report (sync mode)");
};

// ============================================
// Report Status & Retrieval
// ============================================

/**
 * Get full report details by ID
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response with full report details
 */
export const getReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/${reportId}`);
    return { data: response.data?.data || response.data };
  }, "Failed to load report details");
};

/**
 * Get lightweight report status for polling
 * Backend returns: { id, status, totalRecords, errorMessage, fileUrl }
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response with status info
 */
export const getReportStatus = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/${reportId}/status`);
    return { data: response.data?.data || response.data };
  }, "Failed to fetch report status");
};

/**
 * Get user's report generation history
 * @param {Object} params - Pagination params { page, limit }
 * @returns {Promise} API response with report history
 */
export const getReportHistory = async (params = {}) => {
  return handleApiCall(async () => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    const queryString = queryParams.toString();
    const url = queryString ? `${API_PATH}?${queryString}` : API_PATH;
    const response = await API.get(url);
    return response.data?.data || response.data || { data: [], total: 0 };
  }, "Failed to load report history");
};

/**
 * Delete a generated report
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response
 */
export const deleteReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.delete(`${API_PATH}/report/${reportId}`);
    return response.data;
  }, "Failed to delete report");
};

// ============================================
// Queue Management
// ============================================

/**
 * Get queue statistics (waiting, active, completed, failed, delayed)
 * @returns {Promise} Queue statistics
 */
export const getQueueStats = async () => {
  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/queue/stats`);
    return { data: response.data?.data || response.data };
  }, "Failed to get queue statistics");
};

/**
 * Get active/pending reports for current user
 * @returns {Promise} Array of active reports
 */
export const getActiveReports = async () => {
  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/queue/active`);
    return { data: response.data?.data || [] };
  }, "Failed to get active reports");
};

/**
 * Get failed/cancelled reports for current user
 * @returns {Promise} Array of failed reports
 */
export const getFailedReports = async () => {
  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/queue/failed`);
    return { data: response.data?.data || [] };
  }, "Failed to get failed reports");
};

/**
 * Cancel a report generation
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response
 */
export const cancelReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.post(`${API_PATH}/cancel/${reportId}`);
    return response.data;
  }, "Failed to cancel report");
};

/**
 * Retry a failed report generation
 * @param {string} reportId - The report UUID
 * @returns {Promise} API response with new job ID
 */
export const retryReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.post(`${API_PATH}/retry/${reportId}`);
    return response.data;
  }, "Failed to retry report");
};

/**
 * Download/export a generated report (redirects to file URL)
 * @param {string} reportId - The report UUID
 * @returns {Promise} Download URL or blob
 */
export const exportReport = async (reportId) => {
  if (!reportId) {
    throw new Error("Report ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/${reportId}/download`, {
      responseType: 'blob',
      maxRedirects: 5,
    });
    return response;
  }, "Failed to download report");
};

/**
 * Get the download URL for a report
 * @param {string} reportId - The report UUID
 * @returns {string} The download URL
 */
export const getExportUrl = (reportId) => {
  if (!reportId) return '';
  const baseUrl = API.defaults.baseURL || '';
  return `${baseUrl}${API_PATH}/${reportId}/download`;
};

// ============================================
// Template Management
// ============================================

/**
 * Save a new report template
 * @param {Object} payload - Template data
 * @returns {Promise} API response with created template
 */
export const saveTemplate = async (payload) => {
  if (!payload?.name?.trim()) {
    throw new Error("Template name is required");
  }
  if (!payload?.reportType) {
    throw new Error("Report type is required");
  }

  return handleApiCall(async () => {
    const response = await API.post(`${API_PATH}/templates`, payload);
    return { data: transformTemplateResponse(response.data?.data || response.data) };
  }, "Failed to save template");
};

/**
 * Get all templates (user's and public)
 * @param {string} reportType - Optional filter by report type
 * @returns {Promise} API response with templates list
 */
export const getTemplates = async (reportType) => {
  return handleApiCall(async () => {
    let url = `${API_PATH}/templates/list`;
    if (reportType) {
      url += `?reportType=${reportType}`;
    }
    const response = await API.get(url);
    const templatesData = response.data?.data || response.data || [];
    const templates = Array.isArray(templatesData)
      ? templatesData.map(transformTemplateResponse)
      : [];
    return { data: templates };
  }, "Failed to load templates");
};

/**
 * Get a specific template by ID
 * @param {string} templateId - Template UUID
 * @returns {Promise} API response with template details
 */
export const getTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.get(`${API_PATH}/templates/${templateId}`);
    return { data: transformTemplateResponse(response.data?.data || response.data) };
  }, "Failed to load template");
};

/**
 * Update an existing template
 * @param {string} templateId - Template UUID
 * @param {Object} payload - Updated template data
 * @returns {Promise} API response with updated template
 */
export const updateTemplate = async (templateId, payload) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.put(`${API_PATH}/templates/${templateId}`, payload);
    return { data: transformTemplateResponse(response.data?.data || response.data) };
  }, "Failed to update template");
};

/**
 * Delete a template
 * @param {string} templateId - Template UUID
 * @returns {Promise} API response
 */
export const deleteTemplate = async (templateId) => {
  if (!templateId) {
    throw new Error("Template ID is required");
  }

  return handleApiCall(async () => {
    const response = await API.delete(`${API_PATH}/templates/${templateId}`);
    return response.data;
  }, "Failed to delete template");
};

/**
 * Transform backend template response to frontend format
 * Backend stores config in nested 'configuration' object
 * Frontend expects flat structure
 */
const transformTemplateResponse = (template) => {
  if (!template) return null;

  // Backend returns configuration as nested object
  const config = template.configuration || {};

  return {
    id: template.id,
    name: template.name,
    reportType: config.reportType || template.reportType,
    description: template.description,
    columns: config.columns || template.columns || [],
    filters: config.filters || template.filters || {},
    groupBy: config.groupBy || template.groupBy,
    sortBy: config.sortBy || template.sortBy,
    sortOrder: config.sortOrder || template.sortOrder,
    isPublic: template.isPublic || false,
    isOwner: template.isOwner !== undefined ? template.isOwner : true,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get format-specific file extension
 * @param {string} format - Export format
 * @returns {string} File extension
 */
export const getFileExtension = (format) => {
  const extensions = {
    excel: 'xlsx',
    csv: 'csv',
    pdf: 'pdf',
    json: 'json',
  };
  return extensions[format] || 'xlsx';
};

/**
 * Get format display name
 * @param {string} format - Export format
 * @returns {string} Display name
 */
export const getFormatDisplayName = (format) => {
  const names = {
    excel: 'Excel (.xlsx)',
    csv: 'CSV (.csv)',
    pdf: 'PDF (.pdf)',
    json: 'JSON (.json)',
  };
  return names[format] || format;
};

/**
 * Get MIME type for format
 * @param {string} format - Export format
 * @returns {string} MIME type
 */
export const getMimeType = (format) => {
  const mimeTypes = {
    excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    pdf: 'application/pdf',
    json: 'application/json',
  };
  return mimeTypes[format] || 'application/octet-stream';
};

export default {
  // Catalog & Config
  getReportCatalog,
  getReportConfig,
  getFilterValues,
  // Generation
  generateReport,
  generateReportSync,
  // Status & Retrieval
  getReport,
  getReportStatus,
  getReportHistory,
  deleteReport,
  exportReport,
  getExportUrl,
  // Queue Management
  getQueueStats,
  getActiveReports,
  getFailedReports,
  cancelReport,
  retryReport,
  // Templates
  saveTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  // Utilities
  getFileExtension,
  getFormatDisplayName,
  getMimeType,
  downloadBlob,
};
