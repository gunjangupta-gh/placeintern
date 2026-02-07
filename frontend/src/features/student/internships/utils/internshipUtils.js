/**
 * Shared Internship Utilities
 * Common functions for internship-related components
 */

/**
 * Status color mappings for internship applications
 */
export const APPLICATION_STATUS_COLORS = {
  PENDING: 'gold',
  APPLIED: 'processing',
  UNDER_REVIEW: 'processing',
  SHORTLISTED: 'blue',
  INTERVIEW_SCHEDULED: 'cyan',
  SELECTED: 'green',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'default',
  WITHDRAWN: 'default',
};

/**
 * Get color for application status
 * @param {string} status - Application status
 * @returns {string} Ant Design tag color
 */
export const getStatusColor = (status) => {
  const normalizedStatus = status?.toUpperCase();
  return APPLICATION_STATUS_COLORS[normalizedStatus] || 'default';
};

/**
 * Get display text for status
 * @param {string} status - Application status
 * @returns {string} Human readable status
 */
export const getStatusText = (status) => {
  const statusMap = {
    PENDING: 'Pending',
    APPLIED: 'Applied',
    UNDER_REVIEW: 'Under Review',
    SHORTLISTED: 'Shortlisted',
    INTERVIEW_SCHEDULED: 'Interview Scheduled',
    SELECTED: 'Selected',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    WITHDRAWN: 'Withdrawn',
  };
  return statusMap[status?.toUpperCase()] || status;
};

/**
 * Internship type colors
 */
export const INTERNSHIP_TYPE_COLORS = {
  FULL_TIME: 'blue',
  PART_TIME: 'cyan',
  REMOTE: 'purple',
  HYBRID: 'geekblue',
  ON_SITE: 'green',
};

/**
 * Get color for internship type
 * @param {string} type - Internship type
 * @returns {string} Ant Design tag color
 */
export const getTypeColor = (type) => {
  const normalizedType = type?.toUpperCase().replace(/[- ]/g, '_');
  return INTERNSHIP_TYPE_COLORS[normalizedType] || 'default';
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return new Date(date).toLocaleDateString('en-IN', defaultOptions);
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Format stipend/salary for display
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: INR)
 * @returns {string} Formatted amount
 */
export const formatStipend = (amount, currency = 'INR') => {
  if (!amount && amount !== 0) return 'Unpaid';
  if (amount === 0) return 'Unpaid';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format duration for display
 * @param {number} weeks - Duration in weeks
 * @returns {string} Formatted duration
 */
export const formatDuration = (weeks) => {
  if (!weeks) return 'N/A';

  if (weeks < 4) {
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  const months = Math.round(weeks / 4);
  return `${months} month${months > 1 ? 's' : ''}`;
};

/**
 * Check if deadline has passed
 * @param {string|Date} deadline - Application deadline
 * @returns {boolean} True if deadline has passed
 */
export const isDeadlinePassed = (deadline) => {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
};

/**
 * Get days remaining until deadline
 * @param {string|Date} deadline - Application deadline
 * @returns {number} Days remaining (negative if passed)
 */
export const getDaysRemaining = (deadline) => {
  if (!deadline) return null;

  const deadlineDate = new Date(deadline);
  const today = new Date();
  const diffTime = deadlineDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
};

/**
 * Get deadline urgency level
 * @param {string|Date} deadline - Application deadline
 * @returns {'expired'|'urgent'|'warning'|'normal'} Urgency level
 */
export const getDeadlineUrgency = (deadline) => {
  const days = getDaysRemaining(deadline);

  if (days === null) return 'normal';
  if (days < 0) return 'expired';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'warning';
  return 'normal';
};

/**
 * Check eligibility based on criteria
 * @param {object} student - Student data
 * @param {object} internship - Internship data
 * @returns {object} Eligibility result with isEligible and reasons
 */
export const checkEligibility = (student, internship) => {
  const reasons = [];

  // Check branch eligibility
  if (internship.eligibleBranches?.length > 0) {
    if (!internship.eligibleBranches.includes(student.branch)) {
      reasons.push(`Branch ${student.branch} not eligible`);
    }
  }

  // Check semester eligibility
  if (internship.eligibleSemesters?.length > 0) {
    if (!internship.eligibleSemesters.includes(student.semester)) {
      reasons.push(`Semester ${student.semester} not eligible`);
    }
  }

  // Check minimum percentage
  if (internship.minimumPercentage) {
    if (student.percentage < internship.minimumPercentage) {
      reasons.push(`Minimum ${internship.minimumPercentage}% required`);
    }
  }

  // Check CGPA
  if (internship.minimumCGPA) {
    if (student.cgpa < internship.minimumCGPA) {
      reasons.push(`Minimum ${internship.minimumCGPA} CGPA required`);
    }
  }

  return {
    isEligible: reasons.length === 0,
    reasons,
  };
};

/**
 * File type validation for resume uploads
 * @param {File} file - File to validate
 * @returns {object} Validation result with isValid and message
 */
export const validateResumeFile = (file) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      message: 'Only PDF, DOC, and DOCX files are allowed',
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      message: 'File size must be less than 5MB',
    };
  }

  return { isValid: true, message: '' };
};

/**
 * Get file icon based on file type
 * @param {string} fileName - File name or URL
 * @returns {string} Icon component name
 */
export const getFileIconType = (fileName) => {
  if (!fileName) return 'FileOutlined';

  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'FilePdfOutlined';
    case 'doc':
    case 'docx':
      return 'FileWordOutlined';
    case 'xls':
    case 'xlsx':
      return 'FileExcelOutlined';
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return 'FileImageOutlined';
    default:
      return 'FileOutlined';
  }
};

/**
 * Sort internships by various criteria
 * @param {Array} internships - Array of internships
 * @param {string} sortBy - Sort criteria
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} Sorted internships
 */
export const sortInternships = (internships, sortBy = 'deadline', order = 'asc') => {
  if (!internships?.length) return [];

  return [...internships].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'deadline':
        comparison = new Date(a.applicationDeadline) - new Date(b.applicationDeadline);
        break;
      case 'stipend':
        comparison = (a.stipend || 0) - (b.stipend || 0);
        break;
      case 'duration':
        comparison = (a.durationWeeks || 0) - (b.durationWeeks || 0);
        break;
      case 'title':
        comparison = a.title?.localeCompare(b.title) || 0;
        break;
      case 'company':
        comparison = a.company?.name?.localeCompare(b.company?.name) || 0;
        break;
      default:
        comparison = 0;
    }

    return order === 'desc' ? -comparison : comparison;
  });
};

/**
 * Filter internships by search text
 * @param {Array} internships - Array of internships
 * @param {string} searchText - Search text
 * @returns {Array} Filtered internships
 */
export const filterBySearch = (internships, searchText) => {
  if (!searchText?.trim()) return internships;

  const search = searchText.toLowerCase().trim();

  return internships.filter((internship) => {
    return (
      internship.title?.toLowerCase().includes(search) ||
      internship.company?.name?.toLowerCase().includes(search) ||
      internship.location?.toLowerCase().includes(search) ||
      internship.description?.toLowerCase().includes(search) ||
      internship.skills?.some((skill) => skill.toLowerCase().includes(search))
    );
  });
};
