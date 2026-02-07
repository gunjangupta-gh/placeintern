/**
 * Centralized API Endpoints Configuration for Load Testing
 *
 * This file defines all API endpoints used across all test scripts.
 * Update this file to match your actual API endpoints.
 */

// =============================================================================
// TEST CREDENTIALS (from seed.ts)
// =============================================================================

export const TEST_CREDENTIALS = {
  // State Directorate - has access to /state/* endpoints
  state: {
    email: 'dtepunjab.internship@gmail.com',
    password: 'Dtepunjab@directorate',
    role: 'STATE_DIRECTORATE',
  },

  // Principal - has access to /principal/* endpoints
  principal: {
    email: 'principal@gpludhiana.edu.in',
    password: 'password@1234',
    role: 'PRINCIPAL',
  },

  // Student - has access to /student/* endpoints
  // Roll number format: {year}{branchShortName}{instCodeSuffix}{studentNum}
  // Example: 2025CSE001000 for first CSE student at INST001
  student: {
    email: '2025cse001000@student.com',
    password: 'password@1234',
    role: 'STUDENT',
  },

  // Teacher/Faculty - has access to faculty endpoints
  teacher: {
    email: 'aarav.cse.1@gpludhiana.edu.in',
    password: 'password@1234',
    role: 'TEACHER',
  },

  // Industry - has access to /industry/* endpoints
  industry: {
    email: 'hr@tcs.com',
    password: 'password@1234',
    role: 'INDUSTRY',
  },
};

// =============================================================================
// PUBLIC ENDPOINTS (No authentication required)
// =============================================================================

export const PUBLIC_ENDPOINTS = {
  // Health checks
  health: {
    basic: '/health',
    database: '/health/db',
    redis: '/health/redis',
    detailed: '/health/detailed',
    memory: '/health/memory',
    disk: '/health/disk',
    ready: '/health/ready',
    live: '/health/live',
  },

  // Authentication
  auth: {
    login: '/auth/login',
    studentLogin: '/auth/student-login',
    register: '/auth/register',
    refresh: '/auth/refresh',
    extendSession: '/auth/extend-session',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
};

// =============================================================================
// AUTHENTICATED ENDPOINTS (Require valid JWT token)
// =============================================================================

export const AUTH_ENDPOINTS = {
  // User profile
  auth: {
    me: '/auth/me',
    logout: '/auth/logout',
    changePassword: '/auth/change-password',
    logoutAllDevices: '/auth/logout-all-devices',
  },

  // Notifications (all authenticated users)
  notifications: {
    list: '/shared/notifications',
    unreadCount: '/shared/notifications/unread-count',
    settings: '/shared/notifications/settings',
    markAllRead: '/shared/notifications/read-all',
  },

  // Lookup data (all authenticated users)
  lookup: {
    institutions: '/shared/lookup/institutions',
    batches: '/shared/lookup/batches',
    departments: '/shared/lookup/departments',
    branches: '/shared/lookup/branches',
    industries: '/shared/lookup/industries',
    roles: '/shared/lookup/roles',
  },

  // Reports
  reports: {
    storageHealth: '/shared/reports/storage/health',
  },
};

// =============================================================================
// ROLE-BASED ENDPOINTS
// =============================================================================

export const ROLE_ENDPOINTS = {
  // State Directorate endpoints
  state: {
    dashboard: '/state/dashboard',
    criticalAlerts: '/state/dashboard/critical-alerts',
    dashboardActions: '/state/dashboard/actions',
    complianceSummary: '/state/compliance/summary',
    institutions: '/state/institutions',
    institutionsWithStats: '/state/institutions/dashboard-stats',
  },

  // Principal endpoints
  principal: {
    dashboard: '/principal/dashboard',
    alerts: '/principal/dashboard/alerts',
    mentorCoverage: '/principal/dashboard/mentor-coverage',
    compliance: '/principal/dashboard/compliance',
    institution: '/principal/institution',
    branches: '/principal/branches',
    students: '/principal/students',
    studentsProgress: '/principal/students/progress',
  },

  // Student endpoints
  student: {
    dashboard: '/student/dashboard',
    profile: '/student/profile',
  },

  // Faculty endpoints
  faculty: {
    dashboard: '/faculty/dashboard',
  },

  // Industry endpoints
  industry: {
    dashboard: '/industry/dashboard',
  },
};

// =============================================================================
// ENDPOINT WEIGHTS (for realistic traffic distribution)
// =============================================================================

/**
 * Weights for public endpoints (unauthenticated traffic)
 * Higher weight = more frequent requests
 */
export const PUBLIC_WEIGHTS = {
  '/health': 0.30,
  '/health/ready': 0.20,
  '/health/live': 0.20,
  '/auth/login': 0.15,
  '/auth/refresh': 0.10,
  '/auth/student-login': 0.05,
};

/**
 * Weights for authenticated read endpoints
 * Simulates typical user browsing behavior
 */
export const READ_WEIGHTS = {
  // Dashboard views (most common)
  '/state/dashboard': 0.10,
  '/principal/dashboard': 0.15,
  '/student/dashboard': 0.15,

  // List/browsing operations
  '/shared/notifications': 0.10,
  '/shared/notifications/unread-count': 0.15,
  '/shared/lookup/institutions': 0.05,
  '/shared/lookup/batches': 0.05,
  '/shared/lookup/branches': 0.05,

  // Detail views
  '/principal/students': 0.08,
  '/state/institutions': 0.07,
  '/auth/me': 0.05,
};

/**
 * Weights for throttle testing (by preset type)
 */
export const THROTTLE_TEST_ENDPOINTS = {
  // Dashboard preset (limit: 5/min) - most restrictive
  dashboard: [
    { path: '/state/dashboard', weight: 0.35 },
    { path: '/principal/dashboard', weight: 0.35 },
    { path: '/student/dashboard', weight: 0.30 },
  ],

  // List preset (limit: 30/min) - moderate
  list: [
    { path: '/shared/notifications', weight: 0.25 },
    { path: '/principal/students', weight: 0.25 },
    { path: '/state/institutions', weight: 0.25 },
    { path: '/state/institutions/dashboard-stats', weight: 0.25 },
  ],

  // Lightweight preset (limit: 60/min) - permissive
  lightweight: [
    { path: '/shared/notifications/unread-count', weight: 0.40 },
    { path: '/health', weight: 0.30 },
    { path: '/health/ready', weight: 0.30 },
  ],

  // Export preset (limit: 3/min) - most restrictive
  export: [
    { path: '/shared/reports/generate', weight: 1.0 },
  ],
};

// =============================================================================
// TEST SCENARIOS
// =============================================================================

/**
 * Scenarios for different user types
 */
export const USER_SCENARIOS = {
  // Anonymous user (health checks, login attempts)
  anonymous: {
    endpoints: [
      { path: '/health', weight: 0.40 },
      { path: '/health/ready', weight: 0.20 },
      { path: '/auth/login', weight: 0.30 },
      { path: '/auth/refresh', weight: 0.10 },
    ],
  },

  // Student user browsing
  student: {
    endpoints: [
      { path: '/student/dashboard', weight: 0.30 },
      { path: '/student/profile', weight: 0.20 },
      { path: '/shared/notifications', weight: 0.20 },
      { path: '/shared/notifications/unread-count', weight: 0.20 },
      { path: '/auth/me', weight: 0.10 },
    ],
  },

  // Principal managing institution
  principal: {
    endpoints: [
      { path: '/principal/dashboard', weight: 0.25 },
      { path: '/principal/students', weight: 0.20 },
      { path: '/principal/branches', weight: 0.10 },
      { path: '/principal/dashboard/alerts', weight: 0.15 },
      { path: '/shared/notifications', weight: 0.15 },
      { path: '/shared/notifications/unread-count', weight: 0.10 },
      { path: '/auth/me', weight: 0.05 },
    ],
  },

  // State directorate overseeing all institutions
  stateDirectorate: {
    endpoints: [
      { path: '/state/dashboard', weight: 0.20 },
      { path: '/state/institutions', weight: 0.20 },
      { path: '/state/institutions/dashboard-stats', weight: 0.15 },
      { path: '/state/compliance/summary', weight: 0.15 },
      { path: '/shared/notifications', weight: 0.15 },
      { path: '/shared/notifications/unread-count', weight: 0.10 },
      { path: '/auth/me', weight: 0.05 },
    ],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Select a random endpoint based on weights
 * @param {Array} endpoints - Array of {path, weight} objects
 * @returns {string} Selected endpoint path
 */
export function selectWeightedEndpoint(endpoints) {
  const rand = Math.random();
  let cumWeight = 0;

  for (const ep of endpoints) {
    cumWeight += ep.weight;
    if (rand < cumWeight) return ep.path;
  }

  return endpoints[0].path;
}

/**
 * Get all endpoints as flat array with weights
 * @returns {Array} Array of {path, weight, timeout} objects
 */
export function getAllEndpointsWithWeights() {
  return [
    // Public health checks (high weight - always accessible)
    { path: '/health', weight: 0.15, timeout: '5s', auth: false },
    { path: '/health/ready', weight: 0.10, timeout: '5s', auth: false },
    { path: '/health/live', weight: 0.05, timeout: '5s', auth: false },

    // Dashboards (require auth, dashboard throttle)
    { path: '/state/dashboard', weight: 0.10, timeout: '15s', auth: true, throttle: 'dashboard' },
    { path: '/principal/dashboard', weight: 0.12, timeout: '15s', auth: true, throttle: 'dashboard' },
    { path: '/student/dashboard', weight: 0.12, timeout: '15s', auth: true, throttle: 'dashboard' },

    // Lists (require auth, list throttle)
    { path: '/shared/notifications', weight: 0.08, timeout: '10s', auth: true, throttle: 'list' },
    { path: '/state/institutions', weight: 0.06, timeout: '10s', auth: true, throttle: 'list' },
    { path: '/principal/students', weight: 0.06, timeout: '10s', auth: true, throttle: 'list' },

    // Lightweight queries (require auth, lightweight throttle)
    { path: '/shared/notifications/unread-count', weight: 0.08, timeout: '5s', auth: true, throttle: 'lightweight' },
    { path: '/shared/lookup/institutions', weight: 0.04, timeout: '5s', auth: true, throttle: 'lightweight' },
    { path: '/shared/lookup/batches', weight: 0.02, timeout: '5s', auth: true, throttle: 'lightweight' },
    { path: '/shared/lookup/branches', weight: 0.02, timeout: '5s', auth: true, throttle: 'lightweight' },
  ];
}

export default {
  PUBLIC_ENDPOINTS,
  AUTH_ENDPOINTS,
  ROLE_ENDPOINTS,
  PUBLIC_WEIGHTS,
  READ_WEIGHTS,
  THROTTLE_TEST_ENDPOINTS,
  USER_SCENARIOS,
  selectWeightedEndpoint,
  getAllEndpointsWithWeights,
};
