// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// User Roles (match backend values)
export const USER_ROLES = {
  STATE: 'STATE_DIRECTORATE',
  PRINCIPAL: 'PRINCIPAL',
  FACULTY: 'FACULTY',
  TEACHER: 'TEACHER',
  FACULTY_SUPERVISOR: 'FACULTY_SUPERVISOR',
  STUDENT: 'STUDENT',
  INDUSTRY: 'INDUSTRY',
  INDUSTRY_PARTNER: 'INDUSTRY_PARTNER',
  INDUSTRY_SUPERVISOR: 'INDUSTRY_SUPERVISOR',
};

// API Endpoints (base URL already includes /api prefix)
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  PROFILE: '/auth/profile',
  CHANGE_PASSWORD: '/auth/change-password',

  // MFA
  MFA_STATUS: '/auth/mfa/status',
  MFA_SETUP: '/auth/mfa/setup',
  MFA_ENABLE: '/auth/mfa/enable',
  MFA_DISABLE: '/auth/mfa/disable',
  MFA_VERIFY: '/auth/mfa/verify',

  // State
  STATE_DASHBOARD: '/state/dashboard',
  INSTITUTIONS: '/state/institutions',
  INSTITUTION_DETAILS: (id) => `/state/institutions/${id}`,

  // Principal
  PRINCIPAL_DASHBOARD: '/principal/dashboard',
  STUDENTS: '/principal/students',
  STAFF: '/principal/staff',
  MENTORS: '/principal/mentors',
  STUDENT_DETAILS: (id) => `/principal/students/${id}`,
  STAFF_DETAILS: (id) => `/principal/staff/${id}`,

  // Faculty
  FACULTY_DASHBOARD: '/faculty/dashboard',
  COURSES: '/faculty/courses',
  ASSIGNMENTS: '/faculty/assignments',

  // Student
  STUDENT_DASHBOARD: '/student/dashboard',
  STUDENT_PROFILE: '/student/profile',
  ENROLLMENTS: '/student/enrollments',

  // Industry
  INDUSTRY_DASHBOARD: '/industry/dashboard',

  // Shared
  NOTIFICATIONS: '/shared/notifications',
  UPLOAD: '/shared/upload',
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user_data',
  THEME: 'app_theme',
};

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Status
export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_TIME: 'DD/MM/YYYY HH:mm',
  API: 'YYYY-MM-DD',
  API_TIME: 'YYYY-MM-DD HH:mm:ss',
};
