/**
 * K6 Comprehensive Load Test for CMS Backend
 *
 * Tests the entire system with realistic user scenarios:
 * - Anonymous users (health checks, login)
 * - Students (dashboard, profile, notifications)
 * - Principals (dashboard, students, branches)
 * - State Directorate (dashboard, institutions, compliance)
 *
 * Usage:
 *   k6 run tests/load-test.js
 *   k6 run --env BASE_URL=http://localhost:8000 tests/load-test.js
 *   k6 run --env TEST_EMAIL=user@email.com --env TEST_PASSWORD=pass tests/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// =============================================================================
// CONFIGURATION
// =============================================================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';

// Role-based credentials (from seed.ts)
const CREDENTIALS = {
  state: {
    email: __ENV.STATE_EMAIL || 'dtepunjab.internship@gmail.com',
    password: __ENV.STATE_PASSWORD || 'Dtepunjab@directorate',
  },
  principal: {
    email: __ENV.PRINCIPAL_EMAIL || 'principal@gpludhiana.edu.in',
    password: __ENV.PRINCIPAL_PASSWORD || 'password@1234',
  },
  student: {
    email: __ENV.STUDENT_EMAIL || '2025cse001000@student.com',
    password: __ENV.STUDENT_PASSWORD || 'password@1234',
  },
};

// Token cache per role (each role has separate rate limits)
const tokenCache = {
  state: { token: null, expiry: 0 },
  principal: { token: null, expiry: 0 },
  student: { token: null, expiry: 0 },
};

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('error_rate');
const throttleRate = new Rate('throttle_rate');
const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time_ms');
const successCount = new Counter('success_count');
const errorCount = new Counter('error_count');
const throttleCount = new Counter('throttle_count');
const authErrors = new Counter('auth_errors');

// Per-endpoint metrics
const dashboardLatency = new Trend('dashboard_latency');
const listLatency = new Trend('list_latency');
const authLatency = new Trend('auth_latency');
const healthLatency = new Trend('health_latency');

// =============================================================================
// API ENDPOINTS BY CATEGORY
// =============================================================================
const ENDPOINTS = {
  // Health checks (public)
  health: {
    basic: { path: '/health', timeout: '5s' },
    ready: { path: '/health/ready', timeout: '5s' },
    live: { path: '/health/live', timeout: '5s' },
    detailed: { path: '/health/detailed', timeout: '10s' },
    db: { path: '/health/db', timeout: '5s' },
  },

  // Authentication (public)
  auth: {
    login: { path: '/auth/login', timeout: '10s' },
    studentLogin: { path: '/auth/student-login', timeout: '10s' },
    refresh: { path: '/auth/refresh', timeout: '5s' },
    me: { path: '/auth/me', timeout: '5s' },
    logout: { path: '/auth/logout', timeout: '5s' },
  },

  // Notifications (authenticated)
  notifications: {
    list: { path: '/shared/notifications', timeout: '10s' },
    unreadCount: { path: '/shared/notifications/unread-count', timeout: '5s' },
    settings: { path: '/shared/notifications/settings', timeout: '5s' },
  },

  // Lookups (authenticated)
  lookup: {
    institutions: { path: '/shared/lookup/institutions', timeout: '10s' },
    batches: { path: '/shared/lookup/batches', timeout: '5s' },
    departments: { path: '/shared/lookup/departments', timeout: '5s' },
    branches: { path: '/shared/lookup/branches', timeout: '5s' },
  },

  // State Directorate
  state: {
    dashboard: { path: '/state/dashboard', timeout: '15s' },
    alerts: { path: '/state/dashboard/critical-alerts', timeout: '10s' },
    actions: { path: '/state/dashboard/actions', timeout: '10s' },
    compliance: { path: '/state/compliance/summary', timeout: '15s' },
    institutions: { path: '/state/institutions', timeout: '10s' },
    institutionsStats: { path: '/state/institutions/dashboard-stats', timeout: '15s' },
  },

  // Principal
  principal: {
    dashboard: { path: '/principal/dashboard', timeout: '15s' },
    alerts: { path: '/principal/dashboard/alerts', timeout: '10s' },
    mentorCoverage: { path: '/principal/dashboard/mentor-coverage', timeout: '10s' },
    compliance: { path: '/principal/dashboard/compliance', timeout: '10s' },
    institution: { path: '/principal/institution', timeout: '10s' },
    branches: { path: '/principal/branches', timeout: '10s' },
    students: { path: '/principal/students', timeout: '10s' },
  },

  // Student
  student: {
    dashboard: { path: '/student/dashboard', timeout: '15s' },
    profile: { path: '/student/profile', timeout: '10s' },
  },
};

// =============================================================================
// TEST SCENARIOS
// =============================================================================
export const options = {
  scenarios: {
    // Scenario 1: Smoke Test (sanity check)
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      startTime: '0s',
      tags: { scenario: 'smoke' },
    },

    // Scenario 2: Load Test (typical load)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 25 },   // Ramp to 25 users
        { duration: '2m', target: 50 },   // Ramp to 50 users
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 100 },  // Ramp to 100 users
        { duration: '2m', target: 100 },  // Stay at 100 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      startTime: '35s',
      tags: { scenario: 'load' },
    },

    // Scenario 3: Stress Test (find breaking point)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 300 },
        { duration: '1m', target: 300 },   // Sustain
        { duration: '30s', target: 400 },
        { duration: '1m', target: 400 },   // Sustain
        { duration: '30s', target: 0 },
      ],
      startTime: '11m',
      tags: { scenario: 'stress' },
    },

    // Scenario 4: Spike Test (sudden traffic burst)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },   // Normal load
        { duration: '10s', target: 300 },  // Spike!
        { duration: '1m', target: 300 },   // Hold spike
        { duration: '10s', target: 20 },   // Recover
        { duration: '30s', target: 20 },   // Verify recovery
        { duration: '10s', target: 0 },
      ],
      startTime: '16m',
      tags: { scenario: 'spike' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],
    error_rate: ['rate<0.15'],
    throttle_rate: ['rate<0.30'],  // Allow some throttling
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleResponse(response, endpointName, latencyMetric = null) {
  const status = response.status;
  const duration = response.timings.duration;

  if (latencyMetric) {
    latencyMetric.add(duration);
  }
  responseTime.add(duration);

  if (status === 429) {
    throttleCount.add(1);
    throttleRate.add(true);
    errorRate.add(false);  // Throttle is not an error
    successRate.add(false);
    return { success: false, throttled: true };
  } else if (status >= 200 && status < 300) {
    successCount.add(1);
    successRate.add(true);
    errorRate.add(false);
    throttleRate.add(false);
    return { success: true, throttled: false };
  } else if (status === 401 || status === 403) {
    authErrors.add(1);
    errorRate.add(true);
    successRate.add(false);
    throttleRate.add(false);
    return { success: false, throttled: false, authError: true };
  } else {
    errorCount.add(1);
    errorRate.add(true);
    successRate.add(false);
    throttleRate.add(false);
    return { success: false, throttled: false };
  }
}

function makeRequest(method, endpoint, token = null, body = null) {
  const url = `${BASE_URL}${endpoint.path}`;
  const params = {
    headers: getHeaders(token),
    timeout: endpoint.timeout,
    tags: { endpoint: endpoint.path },
  };

  let response;
  if (method === 'GET') {
    response = http.get(url, params);
  } else if (method === 'POST') {
    response = http.post(url, body ? JSON.stringify(body) : null, params);
  } else if (method === 'PUT') {
    response = http.put(url, body ? JSON.stringify(body) : null, params);
  }

  return response;
}

// =============================================================================
// TEST FUNCTIONS
// =============================================================================

function testHealthEndpoints() {
  group('Health Checks', () => {
    const endpoints = [
      ENDPOINTS.health.basic,
      ENDPOINTS.health.ready,
      ENDPOINTS.health.live,
    ];

    endpoints.forEach((ep) => {
      const res = makeRequest('GET', ep);
      handleResponse(res, ep.path, healthLatency);

      check(res, {
        [`${ep.path} is OK`]: (r) => r.status === 200,
        [`${ep.path} < 200ms`]: (r) => r.timings.duration < 200,
      });
    });
  });
}

function login(role) {
  // Check cache first
  const cache = tokenCache[role];
  if (cache && cache.token && Date.now() < cache.expiry) {
    return { accessToken: cache.token };
  }

  const creds = CREDENTIALS[role];
  if (!creds) return null;

  const res = http.post(
    `${BASE_URL}${ENDPOINTS.auth.login.path}`,
    JSON.stringify({ email: creds.email, password: creds.password }),
    {
      headers: getHeaders(),
      timeout: ENDPOINTS.auth.login.timeout,
      tags: { endpoint: '/auth/login' },
    }
  );

  handleResponse(res, '/auth/login', authLatency);

  if (res.status === 200 || res.status === 201) {
    try {
      const body = JSON.parse(res.body);
      const token = body.accessToken || body.access_token;
      // Cache the token
      tokenCache[role] = {
        token: token,
        expiry: Date.now() + 4 * 60 * 1000, // 4 minutes
      };
      return {
        accessToken: token,
        refreshToken: body.refreshToken || body.refresh_token,
        user: body.user,
      };
    } catch (e) {
      return null;
    }
  }
  return null;
}

function testAuthenticatedUser(token) {
  group('Authenticated User', () => {
    // Get current user
    const meRes = makeRequest('GET', ENDPOINTS.auth.me, token);
    handleResponse(meRes, '/auth/me', authLatency);
    check(meRes, {
      'get user profile': (r) => r.status === 200 || r.status === 401,
    });

    // Get notifications
    const notifRes = makeRequest('GET', ENDPOINTS.notifications.list, token);
    handleResponse(notifRes, '/shared/notifications', listLatency);
    check(notifRes, {
      'get notifications': (r) => r.status === 200 || r.status === 401,
    });

    // Get unread count (lightweight)
    const unreadRes = makeRequest('GET', ENDPOINTS.notifications.unreadCount, token);
    handleResponse(unreadRes, '/shared/notifications/unread-count', healthLatency);
    check(unreadRes, {
      'get unread count': (r) => r.status === 200 || r.status === 401,
    });
  });
}

function testLookups(token) {
  group('Lookup Data', () => {
    const lookups = [
      ENDPOINTS.lookup.institutions,
      ENDPOINTS.lookup.batches,
      ENDPOINTS.lookup.branches,
    ];

    lookups.forEach((ep) => {
      const res = makeRequest('GET', ep, token);
      handleResponse(res, ep.path, listLatency);
      check(res, {
        [`${ep.path} responds`]: (r) => r.status === 200 || r.status === 401,
      });
    });
  });
}

function testStateDashboard(token) {
  group('State Directorate', () => {
    // Dashboard (dashboard throttle)
    const dashRes = makeRequest('GET', ENDPOINTS.state.dashboard, token);
    handleResponse(dashRes, '/state/dashboard', dashboardLatency);
    check(dashRes, {
      'state dashboard': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Institutions list (list throttle)
    const instRes = makeRequest('GET', ENDPOINTS.state.institutions, token);
    handleResponse(instRes, '/state/institutions', listLatency);
    check(instRes, {
      'state institutions': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Compliance summary
    const compRes = makeRequest('GET', ENDPOINTS.state.compliance, token);
    handleResponse(compRes, '/state/compliance/summary', listLatency);
    check(compRes, {
      'state compliance': (r) => [200, 401, 403, 429].includes(r.status),
    });
  });
}

function testPrincipalDashboard(token) {
  group('Principal', () => {
    // Dashboard
    const dashRes = makeRequest('GET', ENDPOINTS.principal.dashboard, token);
    handleResponse(dashRes, '/principal/dashboard', dashboardLatency);
    check(dashRes, {
      'principal dashboard': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Students list
    const studRes = makeRequest('GET', ENDPOINTS.principal.students, token);
    handleResponse(studRes, '/principal/students', listLatency);
    check(studRes, {
      'principal students': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Branches
    const branchRes = makeRequest('GET', ENDPOINTS.principal.branches, token);
    handleResponse(branchRes, '/principal/branches', listLatency);
    check(branchRes, {
      'principal branches': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Alerts
    const alertRes = makeRequest('GET', ENDPOINTS.principal.alerts, token);
    handleResponse(alertRes, '/principal/dashboard/alerts', listLatency);
    check(alertRes, {
      'principal alerts': (r) => [200, 401, 403, 429].includes(r.status),
    });
  });
}

function testStudentDashboard(token) {
  group('Student Portal', () => {
    // Dashboard
    const dashRes = makeRequest('GET', ENDPOINTS.student.dashboard, token);
    handleResponse(dashRes, '/student/dashboard', dashboardLatency);
    check(dashRes, {
      'student dashboard': (r) => [200, 401, 403, 429].includes(r.status),
    });

    // Profile
    const profRes = makeRequest('GET', ENDPOINTS.student.profile, token);
    handleResponse(profRes, '/student/profile', listLatency);
    check(profRes, {
      'student profile': (r) => [200, 401, 403, 429].includes(r.status),
    });
  });
}

// =============================================================================
// MAIN TEST EXECUTION
// =============================================================================
export default function () {
  // Always test health endpoints (unauthenticated)
  testHealthEndpoints();
  sleep(0.3);

  // Random scenario selection for realistic traffic
  // Each role uses its own credentials for accurate rate limiting
  const scenario = Math.random();

  if (scenario < 0.20) {
    // 20% - Anonymous browsing (health checks only)
    sleep(Math.random() * 0.5);
  } else if (scenario < 0.45) {
    // 25% - Student user flow (using student credentials)
    const auth = login('student');
    if (auth?.accessToken) {
      testAuthenticatedUser(auth.accessToken);
      sleep(0.2);
      testStudentDashboard(auth.accessToken);
      sleep(0.2);
      testLookups(auth.accessToken);
    }
  } else if (scenario < 0.70) {
    // 25% - Principal user flow (using principal credentials)
    const auth = login('principal');
    if (auth?.accessToken) {
      testAuthenticatedUser(auth.accessToken);
      sleep(0.2);
      testPrincipalDashboard(auth.accessToken);
      sleep(0.2);
      testLookups(auth.accessToken);
    }
  } else if (scenario < 0.90) {
    // 20% - State directorate flow (using state credentials)
    const auth = login('state');
    if (auth?.accessToken) {
      testAuthenticatedUser(auth.accessToken);
      sleep(0.2);
      testStateDashboard(auth.accessToken);
      sleep(0.2);
      testLookups(auth.accessToken);
    }
  } else {
    // 10% - Mixed operations (random role)
    const roles = ['student', 'principal', 'state'];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const auth = login(role);
    if (auth?.accessToken) {
      testAuthenticatedUser(auth.accessToken);
      testLookups(auth.accessToken);
    }
  }

  // Think time (simulates real user behavior)
  sleep(Math.random() * 2 + 0.5);
}

// =============================================================================
// LIFECYCLE HOOKS
// =============================================================================
export function setup() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           CMS COMPREHENSIVE LOAD TEST                         ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target:     ${BASE_URL.padEnd(47)} ║`);
  console.log('║  Scenarios:  smoke → load → stress → spike                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify server is up
  try {
    const healthRes = http.get(`${BASE_URL}/health`, { timeout: '10s' });
    if (healthRes.status === 200) {
      console.log('✓ Server is responding');
    } else {
      console.log(`⚠ Health check returned ${healthRes.status}`);
    }
  } catch (e) {
    console.log(`⚠ Health check failed: ${e.message}`);
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = Math.round((Date.now() - data.startTime) / 1000);
  console.log('');
  console.log(`Test completed in ${duration}s`);
}

// =============================================================================
// SUMMARY REPORT
// =============================================================================
export function handleSummary(data) {
  const duration = data.state?.testRunDurationMs || 0;
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const rps = data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0;

  const avgTime = data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0;
  const p50Time = data.metrics.http_req_duration?.values['p(50)']?.toFixed(2) || 0;
  const p95Time = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const p99Time = data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0;

  const errors = data.metrics.error_count?.values?.count || 0;
  const throttles = data.metrics.throttle_count?.values?.count || 0;
  const successes = data.metrics.success_count?.values?.count || 0;

  const errorPct = reqs > 0 ? ((errors / reqs) * 100).toFixed(2) : 0;
  const throttlePct = reqs > 0 ? ((throttles / reqs) * 100).toFixed(2) : 0;
  const successPct = reqs > 0 ? ((successes / reqs) * 100).toFixed(2) : 0;

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                   LOAD TEST RESULTS                               ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Duration:        ${String(Math.round(duration / 1000) + 's').padEnd(20)}                      ║`);
  console.log(`║  Total Requests:  ${String(reqs).padEnd(20)}                      ║`);
  console.log(`║  Requests/sec:    ${String(rps).padEnd(20)}                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Avg Latency:     ${String(avgTime + 'ms').padEnd(20)}                      ║`);
  console.log(`║  P50 Latency:     ${String(p50Time + 'ms').padEnd(20)}                      ║`);
  console.log(`║  P95 Latency:     ${String(p95Time + 'ms').padEnd(20)}                      ║`);
  console.log(`║  P99 Latency:     ${String(p99Time + 'ms').padEnd(20)}                      ║`);
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log(`║  Successes:       ${String(successes + ' (' + successPct + '%)').padEnd(20)}                      ║`);
  console.log(`║  Errors:          ${String(errors + ' (' + errorPct + '%)').padEnd(20)}                      ║`);
  console.log(`║  Throttled:       ${String(throttles + ' (' + throttlePct + '%)').padEnd(20)}                      ║`);
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const report = {
    timestamp: new Date().toISOString(),
    config: { baseUrl: BASE_URL },
    results: {
      durationMs: duration,
      totalRequests: reqs,
      requestsPerSecond: parseFloat(rps),
    },
    latency: {
      avg: parseFloat(avgTime),
      p50: parseFloat(p50Time),
      p95: parseFloat(p95Time),
      p99: parseFloat(p99Time),
    },
    outcomes: {
      successes,
      errors,
      throttled: throttles,
      successRate: parseFloat(successPct),
      errorRate: parseFloat(errorPct),
      throttleRate: parseFloat(throttlePct),
    },
  };

  return {
    'load-test-report.json': JSON.stringify(report, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
