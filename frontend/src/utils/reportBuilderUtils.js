// Report Builder Utility Functions
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

// ============================================
// Report Type & Category Definitions
// ============================================

export const REPORT_CATEGORIES = {
  MENTOR: {
    key: "MENTOR",
    label: "Mentor Reports",
    description: "Reports related to mentor assignments and utilization",
    icon: "TeamOutlined",
  },
  STUDENT: {
    key: "STUDENT",
    label: "Student Reports",
    description: "Student directory and internship status reports",
    icon: "UserOutlined",
  },
  INTERNSHIP: {
    key: "INTERNSHIP",
    label: "Internship Reports",
    description: "Internship applications and placement analytics",
    icon: "LaptopOutlined",
  },
  COMPLIANCE: {
    key: "COMPLIANCE",
    label: "Compliance Reports",
    description: "Faculty visits, feedback, and reporting compliance",
    icon: "SafetyOutlined",
  },
  INSTITUTE: {
    key: "INSTITUTE",
    label: "Institute Reports",
    description: "Institution-level summaries and comparisons",
    icon: "BankOutlined",
  },
  USER_ACTIVITY: {
    key: "USER_ACTIVITY",
    label: "User Activity Reports",
    description: "User login history and system access tracking",
    icon: "HistoryOutlined",
  },
  PENDING: {
    key: "PENDING",
    label: "Pending Items Reports",
    description: "Outstanding visits, feedback, and reports",
    icon: "ExclamationCircleOutlined",
  },
};

export const REPORT_STATUS = {
  PENDING: {
    key: "pending",
    label: "Pending",
    color: "default",
    description: "Report is queued for processing",
  },
  PROCESSING: {
    key: "processing",
    label: "Processing",
    color: "processing",
    description: "Report is being generated",
  },
  COMPLETED: {
    key: "completed",
    label: "Completed",
    color: "success",
    description: "Report is ready for download",
  },
  FAILED: {
    key: "failed",
    label: "Failed",
    color: "error",
    description: "Report generation failed",
  },
};

export const EXPORT_FORMATS = {
  excel: {
    key: "excel",
    label: "Excel",
    extension: "xlsx",
    icon: "FileExcelOutlined",
    description: "Microsoft Excel spreadsheet with formatting",
  },
  csv: {
    key: "csv",
    label: "CSV",
    extension: "csv",
    icon: "FileTextOutlined",
    description: "Comma-separated values for data analysis",
  },
  pdf: {
    key: "pdf",
    label: "PDF",
    extension: "pdf",
    icon: "FilePdfOutlined",
    description: "Portable document format for printing",
  },
  json: {
    key: "json",
    label: "JSON",
    extension: "json",
    icon: "CodeOutlined",
    description: "Raw JSON data for developers",
  },
};

export const FILTER_TYPES = {
  SELECT: "select",
  MULTI_SELECT: "multiSelect",
  DATE_RANGE: "dateRange",
  BOOLEAN: "boolean",
  TEXT: "text",
  NUMBER: "number",
};

// ============================================
// Status & Display Helpers
// ============================================

/**
 * Get status configuration for a report status
 * @param {string} status - Status key
 * @returns {Object} Status configuration
 */
export const getStatusConfig = (status) => {
  return REPORT_STATUS[status?.toUpperCase()] || REPORT_STATUS.PENDING;
};

/**
 * Get category configuration
 * @param {string} category - Category key
 * @returns {Object} Category configuration
 */
export const getCategoryConfig = (category) => {
  return REPORT_CATEGORIES[category] || {
    key: category,
    label: formatLabel(category),
    icon: "FileTextOutlined",
  };
};

/**
 * Get format configuration
 * @param {string} format - Format key
 * @returns {Object} Format configuration
 */
export const getFormatConfig = (format) => {
  return EXPORT_FORMATS[format] || EXPORT_FORMATS.excel;
};

/**
 * Format a snake_case or SCREAMING_CASE string to Title Case
 * @param {string} str - String to format
 * @returns {string} Formatted string
 */
export const formatLabel = (str) => {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {string} [format] - Dayjs format string
 * @returns {string} Formatted date
 */
export const formatDate = (date, format = "MMM DD, YYYY") => {
  if (!date) return "-";
  return dayjs(date).format(format);
};

/**
 * Format date with time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return "-";
  return dayjs(date).format("MMM DD, YYYY HH:mm");
};

/**
 * Get relative time from now
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return "-";
  return dayjs(date).fromNow();
};

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return "-";
  return num.toLocaleString();
};

// ============================================
// Report Generation Helpers
// ============================================

/**
 * Check if value is a Dayjs or Moment object
 * @param {any} value - Value to check
 * @returns {boolean} True if date object
 */
const isDateObject = (value) => {
  if (!value) return false;
  // Check for Dayjs (used by Ant Design v5)
  if (value.$isDayjsObject || value.$d instanceof Date) return true;
  // Check for Moment (legacy)
  if (value._isAMomentObject) return true;
  // Check for native Date
  if (value instanceof Date) return true;
  return false;
};

/**
 * Format date object to string
 * @param {any} dateObj - Date object (Dayjs, Moment, or Date)
 * @returns {string} Formatted date string
 */
const formatDateToString = (dateObj) => {
  if (!dateObj) return null;
  // Dayjs or Moment objects have format method
  if (typeof dateObj.format === 'function') {
    return dateObj.format("YYYY-MM-DD");
  }
  // Native Date
  if (dateObj instanceof Date) {
    return dateObj.toISOString().split('T')[0];
  }
  return String(dateObj);
};

/**
 * Build report configuration from form values
 * @param {Object} formValues - Form values
 * @param {Object} reportConfig - Report type configuration
 * @returns {Object} Report generation payload
 */
export const buildReportPayload = (formValues, reportConfig) => {
  const {
    reportType,
    columns,
    filters,
    groupBy,
    sortBy,
    sortOrder,
    format,
  } = formValues;

  // Process filters to extract values
  const processedFilters = {};
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        // Handle date range filters (array of Dayjs/Moment objects)
        if (Array.isArray(value) && value.length === 2 && isDateObject(value[0])) {
          processedFilters[key] = {
            from: formatDateToString(value[0]),
            to: formatDateToString(value[1]),
          };
        } else if (isDateObject(value)) {
          // Single date
          processedFilters[key] = formatDateToString(value);
        } else {
          processedFilters[key] = value;
        }
      }
    });
  }

  return {
    reportType,
    columns: columns || reportConfig?.columns?.map((c) => c.id) || [],
    filters: processedFilters,
    groupBy: groupBy || undefined,
    sortBy: sortBy || undefined,
    sortOrder: sortOrder || undefined,
    format: format || "excel",
  };
};

/**
 * Build template from current configuration
 * @param {Object} config - Current report configuration
 * @param {string} name - Template name
 * @param {string} [description] - Template description
 * @param {boolean} [isPublic] - Whether template is public
 * @returns {Object} Template payload
 */
export const buildTemplatePayload = (config, name, description, isPublic = false) => {
  return {
    name,
    description,
    reportType: config.reportType,
    columns: config.columns,
    filters: config.filters,
    groupBy: config.groupBy,
    sortBy: config.sortBy,
    sortOrder: config.sortOrder,
    isPublic,
  };
};

/**
 * Apply template to form
 * @param {Object} template - Template data
 * @param {Function} setFormValues - Form setter function
 */
export const applyTemplate = (template, setFormValues) => {
  setFormValues({
    reportType: template.reportType,
    columns: template.columns,
    filters: template.filters || {},
    groupBy: template.groupBy,
    sortBy: template.sortBy,
    sortOrder: template.sortOrder,
  });
};

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate report configuration
 * @param {Object} config - Report configuration (payload)
 * @param {Object} [reportDef] - Report definition with filter requirements
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export const validateReportConfig = (config, reportDef = null) => {
  const errors = [];

  if (!config.reportType) {
    errors.push("Report type is required");
  }

  if (!config.columns || config.columns.length === 0) {
    errors.push("At least one column must be selected");
  }

  if (!config.format) {
    errors.push("Export format is required");
  }

  // Validate required filters if report definition is provided
  if (reportDef?.filters) {
    const requiredFilters = reportDef.filters.filter((f) => f.required);
    for (const filter of requiredFilters) {
      const filterValue = config.filters?.[filter.id];
      if (filterValue === undefined || filterValue === null || filterValue === "") {
        errors.push(`${filter.label || formatLabel(filter.id)} is required`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate template data
 * @param {Object} template - Template data
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export const validateTemplate = (template) => {
  const errors = [];

  if (!template.name || template.name.trim() === "") {
    errors.push("Template name is required");
  }

  if (!template.reportType) {
    errors.push("Report type is required");
  }

  if (!template.columns || template.columns.length === 0) {
    errors.push("At least one column must be selected");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ============================================
// Storage Helpers
// ============================================

const STORAGE_KEYS = {
  ACTIVE_REPORTS: "reportBuilder_activeReports",
  RECENT_REPORTS: "reportBuilder_recentReports",
  PREFERENCES: "reportBuilder_preferences",
};

/**
 * Get active report jobs from local storage
 * @returns {string[]} Array of active report IDs
 */
export const getActiveReports = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_REPORTS);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

/**
 * Add report ID to active reports
 * @param {string} reportId - Report ID to add
 */
export const addActiveReport = (reportId) => {
  const active = getActiveReports();
  if (!active.includes(reportId)) {
    active.push(reportId);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_REPORTS, JSON.stringify(active));
  }
};

/**
 * Remove report ID from active reports
 * @param {string} reportId - Report ID to remove
 */
export const removeActiveReport = (reportId) => {
  const active = getActiveReports().filter((id) => id !== reportId);
  localStorage.setItem(STORAGE_KEYS.ACTIVE_REPORTS, JSON.stringify(active));
};

/**
 * Clear all active reports
 */
export const clearActiveReports = () => {
  localStorage.removeItem(STORAGE_KEYS.ACTIVE_REPORTS);
};

/**
 * Get user preferences
 * @returns {Object} User preferences
 */
export const getPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    return stored ? JSON.parse(stored) : { defaultFormat: "excel" };
  } catch {
    return { defaultFormat: "excel" };
  }
};

/**
 * Save user preferences
 * @param {Object} preferences - Preferences to save
 */
export const savePreferences = (preferences) => {
  localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
};

// ============================================
// Polling Helpers
// ============================================

/**
 * Create a polling interval manager
 * @param {Function} callback - Callback function to execute
 * @param {number} [interval=3000] - Polling interval in ms
 * @returns {Object} Polling controller
 */
export const createPoller = (callback, interval = 3000) => {
  let timerId = null;
  let isActive = false;

  return {
    start: () => {
      if (!isActive) {
        isActive = true;
        timerId = setInterval(callback, interval);
        callback(); // Execute immediately
      }
    },
    stop: () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
        isActive = false;
      }
    },
    isActive: () => isActive,
  };
};

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number
 * @param {number} [baseDelay=1000] - Base delay in ms
 * @param {number} [maxDelay=30000] - Maximum delay in ms
 * @returns {number} Delay in ms
 */
export const getBackoffDelay = (attempt, baseDelay = 1000, maxDelay = 30000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter
  return delay + Math.random() * 1000;
};

export default {
  // Constants
  REPORT_CATEGORIES,
  REPORT_STATUS,
  EXPORT_FORMATS,
  FILTER_TYPES,
  // Display Helpers
  getStatusConfig,
  getCategoryConfig,
  getFormatConfig,
  formatLabel,
  formatDate,
  formatDateTime,
  getRelativeTime,
  formatNumber,
  // Report Helpers
  buildReportPayload,
  buildTemplatePayload,
  applyTemplate,
  // Validation
  validateReportConfig,
  validateTemplate,
  // Storage
  getActiveReports,
  addActiveReport,
  removeActiveReport,
  clearActiveReports,
  getPreferences,
  savePreferences,
  // Polling
  createPoller,
  getBackoffDelay,
};
