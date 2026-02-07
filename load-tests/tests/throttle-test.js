/**
 * K6 Throttle Comparison Load Test
 *
 * This script tests the system to compare performance:
 * - WITH throttle enabled (protected mode)
 * - WITHOUT throttle (unprotected mode)
 *
 * It measures:
 * - Time to first failure
 * - Concurrent user limits
 * - Response times under load
 * - 429 (Too Many Requests) rate with throttle
 * - Server crash point without throttle
 *
 * Usage:
 *   k6 run throttle-test.js
 *   k6 run --env BASE_URL=http://localhost:8000 throttle-test.js
 *   k6 run --env THROTTLE_MODE=enabled throttle-test.js
 *   k6 run --env THROTTLE_MODE=disabled throttle-test.js
 *
 * Environment Variables:
 *   BASE_URL        - Server URL (default: http://localhost:8000)
 *   THROTTLE_MODE   - 'enabled', 'disabled', or 'compare' (default: compare)
 *   TEST_EMAIL      - Test user email
 *   TEST_PASSWORD   - Test user password
 *   MAX_VUS         - Maximum virtual users to test (default: 500)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ============================================
// CONFIGURATION
// ============================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const THROTTLE_MODE = __ENV.THROTTLE_MODE || 'compare';
const MAX_VUS = parseInt(__ENV.MAX_VUS) || 500;

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

// ============================================
// CUSTOM METRICS
// ============================================
// General metrics
const errorRate = new Rate('error_rate');
const successRate = new Rate('success_rate');
const responseTime = new Trend('response_time');
const requestsPerSecond = new Rate('requests_per_second');

// Throttle-specific metrics
const throttledRequests = new Counter('throttled_requests_429');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const serverErrors = new Counter('server_errors_5xx');

// Timing metrics
const timeToFirstError = new Gauge('time_to_first_error_ms');
const timeToFirstThrottle = new Gauge('time_to_first_throttle_ms');
const timeToServerCrash = new Gauge('time_to_server_crash_ms');

// Capacity metrics
const maxConcurrentBeforeThrottle = new Gauge('max_concurrent_before_throttle');
const maxConcurrentBeforeCrash = new Gauge('max_concurrent_before_crash');

// ============================================
// TEST SCENARIOS - Aggressive Ramp-up to Find Limits
// ============================================
export const options = {
  scenarios: {
    // Phase 1: Quick ramp to find throttle limit
    throttle_finder: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 10 },    // Warm up
        { duration: '10s', target: 25 },    // Light load
        { duration: '10s', target: 50 },    // Moderate
        { duration: '10s', target: 100 },   // High
        { duration: '10s', target: 150 },   // Very high
        { duration: '10s', target: 200 },   // Stress
        { duration: '10s', target: 300 },   // Heavy stress
        { duration: '10s', target: 400 },   // Extreme
        { duration: '10s', target: 500 },   // Breaking point
        { duration: '30s', target: 500 },   // Sustain max
        { duration: '10s', target: 0 },     // Ramp down
      ],
      tags: { phase: 'throttle_finder' },
    },
  },

  thresholds: {
    // We're testing limits, so allow high error rates
    http_req_duration: ['p(50)<5000'],    // At least 50% under 5s
    'http_req_duration{endpoint:health}': ['p(95)<1000'],
  },

  // Don't abort on errors - we want to find the breaking point
  noConnectionReuse: false,
  userAgent: 'K6-ThrottleTest/1.0',
};

// ============================================
// TRACKING VARIABLES
// ============================================
let testStartTime = null;
let firstErrorTime = null;
let firstThrottleTime = null;
let firstCrashTime = null;
let maxVUsBeforeThrottle = 0;
let maxVUsBeforeCrash = 0;
let currentVUs = 0;

// ============================================
// HELPER FUNCTIONS
// ============================================
// Token cache per role
const tokenCache = {
  state: { token: null, expiry: 0 },
  principal: { token: null, expiry: 0 },
  student: { token: null, expiry: 0 },
};

function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Test-Mode': 'throttle-test',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function authenticateRole(role) {
  const cache = tokenCache[role];
  if (cache && cache.token && Date.now() < cache.expiry) {
    return cache.token;
  }

  const creds = CREDENTIALS[role];
  if (!creds) return null;

  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: creds.email, password: creds.password }),
    { headers: getHeaders(), tags: { endpoint: 'auth' }, timeout: '15s' }
  );

  if (response.status === 200 || response.status === 201) {
    try {
      const body = JSON.parse(response.body);
      const token = body.accessToken || body.access_token || body.token;
      tokenCache[role] = { token: token, expiry: Date.now() + 4 * 60 * 1000 };
      return token;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function recordMetrics(response, endpoint) {
  const now = Date.now();
  const elapsed = now - testStartTime;

  responseTime.add(response.timings.duration);

  if (response.status === 429) {
    // Throttled
    throttledRequests.add(1);
    if (!firstThrottleTime) {
      firstThrottleTime = elapsed;
      timeToFirstThrottle.add(elapsed);
      maxVUsBeforeThrottle = currentVUs;
      maxConcurrentBeforeThrottle.add(currentVUs);
      console.log(`[${elapsed}ms] First throttle (429) at ${currentVUs} VUs`);
    }
    return 'throttled';
  } else if (response.status >= 500) {
    // Server error
    serverErrors.add(1);
    failedRequests.add(1);
    errorRate.add(true);
    if (!firstCrashTime) {
      firstCrashTime = elapsed;
      timeToServerCrash.add(elapsed);
      maxVUsBeforeCrash = currentVUs;
      maxConcurrentBeforeCrash.add(currentVUs);
      console.log(`[${elapsed}ms] First server error (5xx) at ${currentVUs} VUs`);
    }
    return 'crashed';
  } else if (response.status >= 400) {
    // Client error (not throttle)
    failedRequests.add(1);
    errorRate.add(true);
    if (!firstErrorTime) {
      firstErrorTime = elapsed;
      timeToFirstError.add(elapsed);
    }
    return 'error';
  } else if (response.status >= 200 && response.status < 300) {
    // Success
    successfulRequests.add(1);
    successRate.add(true);
    errorRate.add(false);
    return 'success';
  } else {
    return 'unknown';
  }
}

// ============================================
// TEST ENDPOINTS
// ============================================
function testHealthEndpoint() {
  const response = http.get(`${BASE_URL}/health`, {
    headers: getHeaders(),
    tags: { endpoint: 'health' },
    timeout: '10s',
  });

  check(response, {
    'health responds': (r) => r.status < 500,
  });

  return recordMetrics(response, 'health');
}

function testDashboardEndpoint() {
  // Test dashboard endpoints which have throttle: dashboard preset (limit: 5)
  // Each endpoint requires a specific role
  const dashboards = [
    { path: '/principal/dashboard', role: 'principal' },
    { path: '/state/dashboard', role: 'state' },
    { path: '/student/dashboard', role: 'student' },
  ];

  const selected = dashboards[Math.floor(Math.random() * dashboards.length)];
  const token = authenticateRole(selected.role);

  if (!token) {
    failedRequests.add(1);
    return 'auth_failed';
  }

  const response = http.get(`${BASE_URL}${selected.path}`, {
    headers: getHeaders(token),
    tags: { endpoint: 'dashboard' },
    timeout: '15s',
  });

  check(response, {
    'dashboard responds': (r) => r.status !== 0,
  });

  return recordMetrics(response, 'dashboard');
}

function testListEndpoint() {
  // Test list endpoints which have throttle: list preset (limit: 30)
  // Each endpoint requires a specific role
  const listEndpoints = [
    { path: '/shared/notifications', role: 'student' },
    { path: '/state/institutions', role: 'state' },
    { path: '/principal/students', role: 'principal' },
    { path: '/shared/lookup/institutions', role: 'student' },
  ];

  const selected = listEndpoints[Math.floor(Math.random() * listEndpoints.length)];
  const token = authenticateRole(selected.role);

  if (!token) {
    failedRequests.add(1);
    return 'auth_failed';
  }

  const response = http.get(`${BASE_URL}${selected.path}?page=1&limit=10`, {
    headers: getHeaders(token),
    tags: { endpoint: 'list' },
    timeout: '15s',
  });

  check(response, {
    'list responds': (r) => r.status !== 0,
  });

  return recordMetrics(response, 'list');
}

function testExportEndpoint() {
  // Test report/export endpoints which have throttle: export preset (limit: 3)
  // Using state role for report endpoints
  const token = authenticateRole('state');

  if (!token) {
    failedRequests.add(1);
    return 'auth_failed';
  }

  const response = http.get(`${BASE_URL}/shared/reports/storage/health`, {
    headers: getHeaders(token),
    tags: { endpoint: 'export' },
    timeout: '30s',
  });

  check(response, {
    'export responds': (r) => r.status !== 0,
  });

  return recordMetrics(response, 'export');
}

function testLightweightEndpoint() {
  // Test lightweight endpoints which have throttle: lightweight preset (limit: 60)
  // All use student role for shared endpoints
  const token = authenticateRole('student');

  if (!token) {
    failedRequests.add(1);
    return 'auth_failed';
  }

  const endpoints = [
    '/shared/notifications/unread-count',
    '/shared/lookup/batches',
    '/shared/lookup/branches',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const response = http.get(`${BASE_URL}${endpoint}`, {
    headers: getHeaders(token),
    tags: { endpoint: 'lightweight' },
    timeout: '10s',
  });

  check(response, {
    'lightweight responds': (r) => r.status !== 0,
  });

  return recordMetrics(response, 'lightweight');
}

// ============================================
// MAIN TEST EXECUTION
// ============================================
export function setup() {
  testStartTime = Date.now();

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              THROTTLE COMPARISON LOAD TEST                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target Server:    ${BASE_URL.padEnd(40)} ║`);
  console.log(`║  Throttle Mode:    ${THROTTLE_MODE.padEnd(40)} ║`);
  console.log(`║  Max VUs:          ${String(MAX_VUS).padEnd(40)} ║`);
  console.log('║  Auth Mode:        Role-based (state, principal, student)    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('Starting test... Watch for throttle (429) and crash (5xx) events.');
  console.log('');

  // Verify server is up
  const healthResponse = http.get(`${BASE_URL}/health`, { timeout: '10s' });
  if (healthResponse.status !== 200) {
    console.warn(`⚠ Warning: Health check returned ${healthResponse.status}`);
  } else {
    console.log('✓ Server is responding');
  }

  // Test authentication for each role
  const roles = ['state', 'principal', 'student'];
  let authSuccess = 0;
  for (const role of roles) {
    const token = authenticateRole(role);
    if (token) {
      console.log(`✓ ${role} authentication successful`);
      authSuccess++;
    } else {
      console.log(`⚠ ${role} authentication failed`);
    }
  }

  return {
    startTime: testStartTime,
    authSuccess: authSuccess,
  };
}

export default function (data) {
  currentVUs = __VU;

  // Distribute requests across different throttle categories
  // Each function handles its own role-based authentication
  const scenario = Math.random();

  if (scenario < 0.30) {
    // 30% - Health checks (no throttle typically)
    testHealthEndpoint();
  } else if (scenario < 0.50) {
    // 20% - Dashboard (throttle: dashboard - limit 5)
    testDashboardEndpoint();
  } else if (scenario < 0.70) {
    // 20% - List operations (throttle: list - limit 30)
    testListEndpoint();
  } else if (scenario < 0.85) {
    // 15% - Lightweight (throttle: lightweight - limit 60)
    testLightweightEndpoint();
  } else {
    // 15% - Export (throttle: export - limit 3) - Most restrictive
    testExportEndpoint();
  }

  // Minimal think time for stress testing
  sleep(Math.random() * 0.5 + 0.1); // 0.1-0.6 seconds
}

export function teardown(data) {
  console.log('');
  console.log('Test completed. Generating report...');
}

// ============================================
// CUSTOM SUMMARY REPORT
// ============================================
export function handleSummary(data) {
  const duration = data.state?.testRunDurationMs || 0;
  const vus = data.metrics.vus_max?.values?.max || 0;
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const rps = data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0;
  const avgTime = data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0;
  const p50Time = data.metrics.http_req_duration?.values['p(50)']?.toFixed(2) || 0;
  const p95Time = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const p99Time = data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0;
  const maxTime = data.metrics.http_req_duration?.values?.max?.toFixed(2) || 0;

  const throttled = data.metrics.throttled_requests_429?.values?.count || 0;
  const successful = data.metrics.successful_requests?.values?.count || 0;
  const failed = data.metrics.failed_requests?.values?.count || 0;
  const serverErrs = data.metrics.server_errors_5xx?.values?.count || 0;

  const ttFirstThrottle = data.metrics.time_to_first_throttle_ms?.values?.value || 'N/A';
  const ttServerCrash = data.metrics.time_to_server_crash_ms?.values?.value || 'N/A';
  const maxVUsThrottle = data.metrics.max_concurrent_before_throttle?.values?.value || vus;
  const maxVUsCrash = data.metrics.max_concurrent_before_crash?.values?.value || vus;

  const totalErrors = throttled + failed;
  const errorPct = reqs > 0 ? ((totalErrors / reqs) * 100).toFixed(2) : 0;
  const throttlePct = reqs > 0 ? ((throttled / reqs) * 100).toFixed(2) : 0;
  const crashPct = reqs > 0 ? ((serverErrs / reqs) * 100).toFixed(2) : 0;

  // Determine system status
  let status = 'UNKNOWN';
  let statusColor = '';
  let recommendation = '';

  if (serverErrs > 0) {
    status = 'CRASHED';
    recommendation = `Server crashed at ${maxVUsCrash} concurrent users. ` +
                     `Time to crash: ${ttServerCrash}ms. ` +
                     'Consider enabling/tuning throttle or scaling resources.';
  } else if (throttled > 0 && parseFloat(crashPct) === 0) {
    status = 'THROTTLE WORKING';
    recommendation = `Throttle protected the server. First throttle at ${maxVUsThrottle} VUs. ` +
                     `${throttlePct}% of requests were throttled (429). ` +
                     'Server remained stable throughout the test.';
  } else if (parseFloat(errorPct) < 5) {
    status = 'HEALTHY';
    recommendation = `Server handled ${vus} concurrent users with ${errorPct}% error rate. ` +
                     'Consider testing with higher load to find limits.';
  } else {
    status = 'DEGRADED';
    recommendation = `Server showing ${errorPct}% error rate. ` +
                     'Performance degradation detected. Review server resources.';
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    THROTTLE TEST RESULTS                              ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                         LOAD METRICS                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Test Duration:              ${String(Math.round(duration/1000) + 's').padEnd(20)}                   ║`);
  console.log(`║  Max Virtual Users:          ${String(vus).padEnd(20)}                   ║`);
  console.log(`║  Total Requests:             ${String(reqs).padEnd(20)}                   ║`);
  console.log(`║  Requests/Second:            ${String(rps).padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                       RESPONSE TIMES                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Average:                    ${String(avgTime + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P50 (Median):               ${String(p50Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P95:                        ${String(p95Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P99:                        ${String(p99Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  Max:                        ${String(maxTime + 'ms').padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                      THROTTLE METRICS                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Successful Requests:        ${String(successful).padEnd(20)}                   ║`);
  console.log(`║  Throttled (429):            ${String(throttled + ' (' + throttlePct + '%)').padEnd(20)}                   ║`);
  console.log(`║  Server Errors (5xx):        ${String(serverErrs + ' (' + crashPct + '%)').padEnd(20)}                   ║`);
  console.log(`║  Other Failures:             ${String(failed).padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                       BREAKING POINTS                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Time to First Throttle:     ${String(ttFirstThrottle === 'N/A' ? 'Never' : ttFirstThrottle + 'ms').padEnd(20)}                   ║`);
  console.log(`║  Max VUs Before Throttle:    ${String(maxVUsThrottle).padEnd(20)}                   ║`);
  console.log(`║  Time to Server Crash:       ${String(ttServerCrash === 'N/A' ? 'Never' : ttServerCrash + 'ms').padEnd(20)}                   ║`);
  console.log(`║  Max VUs Before Crash:       ${String(maxVUsCrash).padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                          STATUS                                       ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  System Status:              ${status.padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  // Word wrap recommendation
  const maxLineLen = 66;
  const words = recommendation.split(' ');
  let currentLine = '';
  const lines = [];

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxLineLen) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });
  if (currentLine) lines.push(currentLine);

  lines.forEach(line => {
    console.log(`║  ${line.padEnd(68)} ║`);
  });

  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      throttleMode: THROTTLE_MODE,
      maxVUs: MAX_VUS,
    },
    load: {
      testDurationMs: duration,
      maxVirtualUsers: vus,
      totalRequests: reqs,
      requestsPerSecond: parseFloat(rps),
    },
    responseTimes: {
      average: parseFloat(avgTime),
      p50: parseFloat(p50Time),
      p95: parseFloat(p95Time),
      p99: parseFloat(p99Time),
      max: parseFloat(maxTime),
    },
    throttle: {
      successfulRequests: successful,
      throttledRequests: throttled,
      throttleRate: parseFloat(throttlePct),
      serverErrors: serverErrs,
      crashRate: parseFloat(crashPct),
      otherFailures: failed,
    },
    breakingPoints: {
      timeToFirstThrottleMs: ttFirstThrottle === 'N/A' ? null : ttFirstThrottle,
      maxVUsBeforeThrottle: maxVUsThrottle,
      timeToServerCrashMs: ttServerCrash === 'N/A' ? null : ttServerCrash,
      maxVUsBeforeCrash: maxVUsCrash,
    },
    status: status,
    recommendation: recommendation,
  };

  return {
    'throttle-report.json': JSON.stringify(report, null, 2),
    stdout: generateTextReport(report),
  };
}

function generateTextReport(report) {
  return `
THROTTLE TEST REPORT
====================
Generated: ${report.timestamp}

Configuration:
  - Target: ${report.config.baseUrl}
  - Mode: ${report.config.throttleMode}
  - Max VUs: ${report.config.maxVUs}

Results:
  - Status: ${report.status}
  - Max Concurrent Users: ${report.load.maxVirtualUsers}
  - Requests/sec: ${report.load.requestsPerSecond}
  - Throttle Rate: ${report.throttle.throttleRate}%
  - Crash Rate: ${report.throttle.crashRate}%

Breaking Points:
  - Time to Throttle: ${report.breakingPoints.timeToFirstThrottleMs || 'Never'}ms
  - Max VUs Before Throttle: ${report.breakingPoints.maxVUsBeforeThrottle}
  - Time to Crash: ${report.breakingPoints.timeToServerCrashMs || 'Never'}ms
  - Max VUs Before Crash: ${report.breakingPoints.maxVUsBeforeCrash}

Recommendation:
${report.recommendation}
`;
}
