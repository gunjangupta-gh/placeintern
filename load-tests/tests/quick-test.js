/**
 * K6 Quick Capacity Test - Find Server Limits
 *
 * Quickly determines how many concurrent users your server can handle
 * by gradually increasing load from 10 to 300 users.
 *
 * Tests realistic API endpoints including:
 * - Health checks (public)
 * - Authentication
 * - Dashboard endpoints (with throttle limits)
 * - List/query endpoints
 *
 * Usage:
 *   k6 run tests/quick-test.js
 *   k6 run --env BASE_URL=http://localhost:8000 tests/quick-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

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

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('errors');
const throttleRate = new Rate('throttled');
const responseTime = new Trend('response_time');
const successCount = new Counter('successes');
const errorCount = new Counter('error_count');
const throttleCount = new Counter('throttle_count');

// =============================================================================
// API ENDPOINTS (weighted for realistic traffic)
// Each endpoint specifies which role is required to access it
// =============================================================================
const ENDPOINTS = [
  // Health checks (30% - always accessible, lightweight)
  { path: '/health', weight: 0.15, timeout: '5s', role: null },
  { path: '/health/ready', weight: 0.10, timeout: '5s', role: null },
  { path: '/health/live', weight: 0.05, timeout: '5s', role: null },

  // Dashboard endpoints (25% - dashboard throttle, heavier queries)
  { path: '/state/dashboard', weight: 0.08, timeout: '15s', role: 'state' },
  { path: '/principal/dashboard', weight: 0.10, timeout: '15s', role: 'principal' },
  { path: '/student/dashboard', weight: 0.07, timeout: '15s', role: 'student' },

  // List endpoints (25% - list throttle)
  { path: '/shared/notifications', weight: 0.08, timeout: '10s', role: 'student' },
  { path: '/state/institutions', weight: 0.06, timeout: '10s', role: 'state' },
  { path: '/principal/students', weight: 0.06, timeout: '10s', role: 'principal' },
  { path: '/shared/lookup/institutions', weight: 0.05, timeout: '10s', role: 'student' },

  // Lightweight queries (20% - lightweight throttle)
  { path: '/shared/notifications/unread-count', weight: 0.10, timeout: '5s', role: 'student' },
  { path: '/shared/lookup/batches', weight: 0.05, timeout: '5s', role: 'student' },
  { path: '/shared/lookup/branches', weight: 0.05, timeout: '5s', role: 'student' },
];

// =============================================================================
// TEST STAGES (Gradual ramp-up to find capacity)
// =============================================================================
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Warm up
    { duration: '30s', target: 25 },    // Light load
    { duration: '30s', target: 50 },    // Moderate load
    { duration: '30s', target: 75 },    // Medium load
    { duration: '30s', target: 100 },   // High load
    { duration: '30s', target: 150 },   // Very high load
    { duration: '30s', target: 200 },   // Stress
    { duration: '30s', target: 250 },   // Heavy stress
    { duration: '30s', target: 300 },   // Breaking point test
    { duration: '1m', target: 300 },    // Sustain max load
    { duration: '30s', target: 0 },     // Ramp down
  ],

  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% requests < 2s
    http_req_failed: ['rate<0.15'],     // Less than 15% errors
    errors: ['rate<0.20'],              // Allow some errors at high load
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================
// Token cache per role (each role has separate rate limits)
const tokenCache = {
  state: { token: null, expiry: 0 },
  principal: { token: null, expiry: 0 },
  student: { token: null, expiry: 0 },
};

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

function login(role) {
  // Get cached token for this role
  const cache = tokenCache[role];
  if (cache && cache.token && Date.now() < cache.expiry) {
    return cache.token;
  }

  const creds = CREDENTIALS[role];
  if (!creds) return null;

  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: creds.email, password: creds.password }),
    { headers: getHeaders(), timeout: '10s' }
  );

  if (res.status === 200 || res.status === 201) {
    try {
      const body = JSON.parse(res.body);
      const token = body.accessToken || body.access_token;
      tokenCache[role] = {
        token: token,
        expiry: Date.now() + 4 * 60 * 1000, // Cache for 4 minutes
      };
      return token;
    } catch (e) {
      return null;
    }
  }
  return null;
}

function selectEndpoint() {
  const rand = Math.random();
  let cumWeight = 0;

  for (const ep of ENDPOINTS) {
    cumWeight += ep.weight;
    if (rand < cumWeight) return ep;
  }
  return ENDPOINTS[0];
}

// =============================================================================
// MAIN TEST
// =============================================================================
export function setup() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║             QUICK CAPACITY TEST                               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target: ${BASE_URL.padEnd(51)} ║`);
  console.log('║  Ramp:   10 → 25 → 50 → 75 → 100 → 150 → 200 → 250 → 300     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Verify server
  try {
    const res = http.get(`${BASE_URL}/health`, { timeout: '10s' });
    if (res.status === 200) {
      console.log('✓ Server is responding');
    } else {
      console.log(`⚠ Health check returned ${res.status}`);
    }
  } catch (e) {
    console.log(`⚠ Health check failed: ${e.message}`);
  }

  return { startTime: Date.now() };
}

export default function () {
  const endpoint = selectEndpoint();
  let token = null;

  // Get token for role-specific endpoints
  if (endpoint.role) {
    token = login(endpoint.role);
    if (!token) {
      // Can't authenticate, skip this endpoint
      errorRate.add(true);
      return;
    }
  }

  // Make the request
  const url = `${BASE_URL}${endpoint.path}`;
  let response;

  try {
    response = http.get(url, {
      headers: getHeaders(token),
      timeout: endpoint.timeout,
      tags: { endpoint: endpoint.path },
    });
  } catch (e) {
    errorRate.add(true);
    errorCount.add(1);
    return;
  }

  // Record metrics
  responseTime.add(response.timings.duration);

  const status = response.status;
  if (status === 429) {
    // Throttled - expected under load
    throttleRate.add(true);
    throttleCount.add(1);
    errorRate.add(false);
  } else if (status >= 200 && status < 400) {
    errorRate.add(false);
    throttleRate.add(false);
    successCount.add(1);
  } else if (status === 401 || status === 403) {
    // Auth errors count as soft errors
    errorRate.add(true);
    throttleRate.add(false);
  } else {
    errorRate.add(true);
    throttleRate.add(false);
    errorCount.add(1);
  }

  // Checks for reporting
  check(response, {
    'status is acceptable': (r) => [200, 201, 401, 403, 429].includes(r.status),
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  // Simulate user think time
  sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds
}

// =============================================================================
// SUMMARY REPORT
// =============================================================================
export function handleSummary(data) {
  const vus = data.metrics.vus_max?.values?.max || 0;
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const rps = data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0;

  const avgTime = data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0;
  const p50Time = data.metrics.http_req_duration?.values['p(50)']?.toFixed(2) || 0;
  const p95Time = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const p99Time = data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0;

  const failRate = ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2);
  const throttled = data.metrics.throttle_count?.values?.count || 0;
  const errors = data.metrics.error_count?.values?.count || 0;
  const successes = data.metrics.successes?.values?.count || 0;

  // Calculate capacity estimation
  let capacity = 'Unknown';
  let recommendation = '';
  let status = 'UNKNOWN';

  const errorPct = parseFloat(failRate);
  const p95 = parseFloat(p95Time);

  if (errorPct < 1 && p95 < 500) {
    capacity = '300+ users';
    status = 'EXCELLENT';
    recommendation = 'Server handles load well. Consider testing higher loads.';
  } else if (errorPct < 5 && p95 < 1000) {
    capacity = '150-300 users';
    status = 'GOOD';
    recommendation = 'Good capacity. Monitor during peak hours.';
  } else if (errorPct < 10 && p95 < 2000) {
    capacity = '75-150 users';
    status = 'MODERATE';
    recommendation = 'Moderate capacity. Consider scaling for growth.';
  } else if (errorPct < 20) {
    capacity = '25-75 users';
    status = 'LIMITED';
    recommendation = 'Limited capacity. Optimize or scale resources.';
  } else {
    capacity = '<25 users';
    status = 'CRITICAL';
    recommendation = 'Server struggling. Immediate optimization needed.';
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SERVER CAPACITY TEST RESULTS                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Max Virtual Users:    ${String(vus).padEnd(10)}                          ║`);
  console.log(`║  Total Requests:       ${String(reqs).padEnd(10)}                          ║`);
  console.log(`║  Requests/second:      ${String(rps).padEnd(10)}                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Avg Response Time:    ${String(avgTime + 'ms').padEnd(10)}                          ║`);
  console.log(`║  P50 Response Time:    ${String(p50Time + 'ms').padEnd(10)}                          ║`);
  console.log(`║  P95 Response Time:    ${String(p95Time + 'ms').padEnd(10)}                          ║`);
  console.log(`║  P99 Response Time:    ${String(p99Time + 'ms').padEnd(10)}                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Successes:            ${String(successes).padEnd(10)}                          ║`);
  console.log(`║  Errors:               ${String(errors).padEnd(10)}                          ║`);
  console.log(`║  Throttled (429):      ${String(throttled).padEnd(10)}                          ║`);
  console.log(`║  Error Rate:           ${String(failRate + '%').padEnd(10)}                          ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  STATUS:               ${status.padEnd(39)} ║`);
  console.log(`║  ESTIMATED CAPACITY:   ${capacity.padEnd(39)} ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ${recommendation.padEnd(60)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const report = {
    timestamp: new Date().toISOString(),
    config: { baseUrl: BASE_URL },
    metrics: {
      maxVUs: vus,
      totalRequests: reqs,
      requestsPerSecond: parseFloat(rps),
      avgResponseTime: parseFloat(avgTime),
      p50ResponseTime: parseFloat(p50Time),
      p95ResponseTime: parseFloat(p95Time),
      p99ResponseTime: parseFloat(p99Time),
    },
    outcomes: {
      successes,
      errors,
      throttled,
      errorRate: parseFloat(failRate),
    },
    capacity: {
      status,
      estimate: capacity,
      recommendation,
    },
  };

  return {
    'capacity-report.json': JSON.stringify(report, null, 2),
  };
}
