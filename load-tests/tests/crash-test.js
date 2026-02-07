/**
 * K6 Server Crash Point Finder
 *
 * AGGRESSIVE load test designed to find the exact point where your server crashes.
 * This test will push the server to its absolute limits.
 *
 * ⚠️ WARNING: This test is designed to crash your server!
 * Only run this in a test/staging environment, NEVER in production.
 *
 * Usage:
 *   k6 run crash-test.js
 *   k6 run --env BASE_URL=http://localhost:8000 crash-test.js
 *   k6 run --env MAX_VUS=1000 crash-test.js
 *
 * Environment Variables:
 *   BASE_URL    - Server URL (default: http://localhost:8000)
 *   MAX_VUS     - Maximum virtual users (default: 1000)
 *   RAMP_TIME   - Time per ramp stage in seconds (default: 15)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// ============================================
// CONFIGURATION
// ============================================
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const MAX_VUS = parseInt(__ENV.MAX_VUS) || 1000;
const RAMP_TIME = parseInt(__ENV.RAMP_TIME) || 15;

// ============================================
// METRICS
// ============================================
const errorRate = new Rate('error_rate');
const responseTime = new Trend('response_time_ms');
const successCount = new Counter('success_count');
const errorCount = new Counter('error_count');
const timeoutCount = new Counter('timeout_count');
const serverErrorCount = new Counter('server_error_5xx');
const connectionErrorCount = new Counter('connection_errors');

const crashDetected = new Gauge('crash_detected');
const crashVUs = new Gauge('crash_vus');
const crashTimeMs = new Gauge('crash_time_ms');

// ============================================
// AGGRESSIVE RAMP-UP STAGES
// ============================================
function generateStages() {
  const stages = [];
  const vuSteps = [10, 25, 50, 100, 150, 200, 300, 400, 500, 600, 750, 1000];

  vuSteps.forEach(vus => {
    if (vus <= MAX_VUS) {
      stages.push({ duration: `${RAMP_TIME}s`, target: vus });
    }
  });

  // Sustain max load
  stages.push({ duration: '60s', target: MAX_VUS });

  // Keep pushing if server hasn't crashed
  stages.push({ duration: '30s', target: Math.min(MAX_VUS * 1.5, 2000) });

  // Ramp down
  stages.push({ duration: '10s', target: 0 });

  return stages;
}

export const options = {
  stages: generateStages(),

  thresholds: {
    // Very lenient thresholds - we're testing to destruction
    http_req_duration: ['p(50)<30000'], // 50% under 30s
  },

  // Connection settings for stress testing
  batch: 20,
  batchPerHost: 10,
  noConnectionReuse: false,
  noVUConnectionReuse: false,
};

// ============================================
// TRACKING
// ============================================
let testStartTime = null;
let crashed = false;
let crashedAt = { time: null, vus: null };
let consecutiveErrors = 0;
const CRASH_THRESHOLD = 50; // 50 consecutive errors = crash detected

// ============================================
// ROLE-BASED AUTHENTICATION (from seed.ts)
// ============================================
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
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function login(role) {
  const cache = tokenCache[role];
  if (cache && cache.token && Date.now() < cache.expiry) {
    return cache.token;
  }

  const creds = CREDENTIALS[role];
  if (!creds) return null;

  try {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email: creds.email, password: creds.password }),
      { headers: getHeaders(), timeout: '10s' }
    );

    if (res.status === 200 || res.status === 201) {
      const body = JSON.parse(res.body);
      const token = body.accessToken || body.access_token;
      tokenCache[role] = {
        token: token,
        expiry: Date.now() + 4 * 60 * 1000,
      };
      return token;
    }
  } catch (e) {
    // Login failed
  }
  return null;
}

// ============================================
// TEST ENDPOINTS (Real API paths with role requirements)
// ============================================
const ENDPOINTS = [
  // Health checks (public, lightweight) - 30%
  { path: '/health', weight: 0.15, timeout: '5s', role: null },
  { path: '/health/ready', weight: 0.10, timeout: '5s', role: null },
  { path: '/health/live', weight: 0.05, timeout: '5s', role: null },

  // Dashboard endpoints (role-specific, heavy) - 25%
  { path: '/state/dashboard', weight: 0.08, timeout: '15s', role: 'state' },
  { path: '/principal/dashboard', weight: 0.10, timeout: '15s', role: 'principal' },
  { path: '/student/dashboard', weight: 0.07, timeout: '15s', role: 'student' },

  // List/query endpoints (role-specific) - 25%
  { path: '/shared/notifications', weight: 0.08, timeout: '10s', role: 'student' },
  { path: '/state/institutions', weight: 0.06, timeout: '10s', role: 'state' },
  { path: '/principal/students', weight: 0.06, timeout: '10s', role: 'principal' },
  { path: '/shared/lookup/institutions', weight: 0.05, timeout: '10s', role: 'student' },

  // Lightweight queries (student role) - 20%
  { path: '/shared/notifications/unread-count', weight: 0.10, timeout: '5s', role: 'student' },
  { path: '/shared/lookup/batches', weight: 0.05, timeout: '5s', role: 'student' },
  { path: '/shared/lookup/branches', weight: 0.05, timeout: '5s', role: 'student' },
];

function selectEndpoint() {
  const rand = Math.random();
  let cumWeight = 0;

  for (const ep of ENDPOINTS) {
    cumWeight += ep.weight;
    if (rand < cumWeight) return ep;
  }
  return ENDPOINTS[0];
}

// ============================================
// MAIN TEST
// ============================================
export function setup() {
  testStartTime = Date.now();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              ⚠️  CRASH POINT FINDER TEST ⚠️                    ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  This test will push your server to its breaking point!      ║');
  console.log('║  Only run in test/staging environments.                       ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Target:     ${BASE_URL.padEnd(47)} ║`);
  console.log(`║  Max VUs:    ${String(MAX_VUS).padEnd(47)} ║`);
  console.log(`║  Ramp Time:  ${(RAMP_TIME + 's per stage').padEnd(47)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initial health check
  try {
    const healthRes = http.get(`${BASE_URL}/health`, { timeout: '10s' });
    if (healthRes.status === 200) {
      console.log('✓ Server is responding. Starting crash test...');
    } else {
      console.log(`⚠ Health check returned ${healthRes.status}`);
    }
  } catch (e) {
    console.log(`⚠ Health check failed: ${e.message}`);
  }

  return { startTime: testStartTime };
}

export default function (data) {
  if (crashed) {
    // Server already crashed, just record and return
    sleep(1);
    return;
  }

  const endpoint = selectEndpoint();
  const url = `${BASE_URL}${endpoint.path}`;

  // Get token for role-specific endpoints
  let token = null;
  if (endpoint.role) {
    token = login(endpoint.role);
    if (!token) {
      // Can't authenticate, skip but don't count as server error
      errorRate.add(true);
      return;
    }
  }

  let response;
  let status = 'unknown';

  try {
    response = http.get(url, {
      headers: getHeaders(token),
      timeout: endpoint.timeout,
      tags: { endpoint: endpoint.path },
    });

    responseTime.add(response.timings.duration);

    if (response.status === 0) {
      // Connection error
      status = 'connection_error';
      connectionErrorCount.add(1);
      errorCount.add(1);
      errorRate.add(true);
      consecutiveErrors++;
    } else if (response.status >= 500) {
      status = 'server_error';
      serverErrorCount.add(1);
      errorCount.add(1);
      errorRate.add(true);
      consecutiveErrors++;
    } else if (response.status === 429) {
      // Throttled - not an error for this test
      status = 'throttled';
      successCount.add(1);
      errorRate.add(false);
      consecutiveErrors = 0;
    } else if (response.status >= 200 && response.status < 400) {
      status = 'success';
      successCount.add(1);
      errorRate.add(false);
      consecutiveErrors = 0;
    } else {
      status = 'client_error';
      errorCount.add(1);
      errorRate.add(true);
      consecutiveErrors++;
    }
  } catch (e) {
    // Request exception (timeout, connection refused, etc.)
    status = 'exception';
    timeoutCount.add(1);
    errorCount.add(1);
    errorRate.add(true);
    consecutiveErrors++;
  }

  // Detect crash
  if (consecutiveErrors >= CRASH_THRESHOLD && !crashed) {
    crashed = true;
    crashedAt = {
      time: Date.now() - data.startTime,
      vus: __VU,
    };

    crashDetected.add(1);
    crashVUs.add(__VU);
    crashTimeMs.add(crashedAt.time);

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    🔴 CRASH DETECTED 🔴                       ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Time to crash:     ${String(crashedAt.time + 'ms').padEnd(40)} ║`);
    console.log(`║  VUs at crash:      ${String(crashedAt.vus).padEnd(40)} ║`);
    console.log(`║  Consecutive errors: ${String(consecutiveErrors).padEnd(39)} ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  // Minimal sleep for maximum stress
  sleep(Math.random() * 0.2 + 0.05); // 50-250ms
}

export function teardown(data) {
  const duration = Date.now() - data.startTime;

  console.log('');
  console.log('Test completed.');
  console.log(`Total duration: ${Math.round(duration / 1000)}s`);

  if (!crashed) {
    console.log('✓ Server survived the test!');
  }
}

// ============================================
// REPORT
// ============================================
export function handleSummary(data) {
  const duration = data.state?.testRunDurationMs || 0;
  const maxVUs = data.metrics.vus_max?.values?.max || 0;
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const rps = data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0;

  const avgTime = data.metrics.response_time_ms?.values?.avg?.toFixed(2) || 0;
  const p50Time = data.metrics.http_req_duration?.values['p(50)']?.toFixed(2) || 0;
  const p95Time = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const p99Time = data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0;
  const maxTime = data.metrics.http_req_duration?.values?.max?.toFixed(2) || 0;

  const successes = data.metrics.success_count?.values?.count || 0;
  const errors = data.metrics.error_count?.values?.count || 0;
  const timeouts = data.metrics.timeout_count?.values?.count || 0;
  const serverErrors = data.metrics.server_error_5xx?.values?.count || 0;
  const connErrors = data.metrics.connection_errors?.values?.count || 0;

  const didCrash = data.metrics.crash_detected?.values?.value > 0;
  const crashTime = data.metrics.crash_time_ms?.values?.value || null;
  const crashVUsVal = data.metrics.crash_vus?.values?.value || null;

  const errorPct = reqs > 0 ? ((errors / reqs) * 100).toFixed(2) : 0;

  let status, recommendation;
  if (didCrash) {
    status = 'CRASHED';
    recommendation = `Server crashed at ${crashVUsVal} concurrent users after ${crashTime}ms. ` +
                     `Enable or tune throttling to prevent this. ` +
                     `Consider: (1) Lowering throttle limits, (2) Adding more resources, ` +
                     `(3) Implementing circuit breakers.`;
  } else if (parseFloat(errorPct) > 20) {
    status = 'SEVERELY DEGRADED';
    recommendation = `Server showed ${errorPct}% error rate but didn't fully crash. ` +
                     `Max VUs tested: ${maxVUs}. Consider this your practical limit.`;
  } else if (parseFloat(errorPct) > 5) {
    status = 'DEGRADED';
    recommendation = `Server handled load with ${errorPct}% errors. ` +
                     `Throttle appears to be protecting the system.`;
  } else {
    status = 'SURVIVED';
    recommendation = `Server handled ${maxVUs} concurrent users with only ${errorPct}% errors! ` +
                     `Your server is robust. Consider testing with even higher load.`;
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CRASH TEST RESULTS                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Test Duration:              ${String(Math.round(duration/1000) + 's').padEnd(20)}                   ║`);
  console.log(`║  Max Virtual Users:          ${String(maxVUs).padEnd(20)}                   ║`);
  console.log(`║  Total Requests:             ${String(reqs).padEnd(20)}                   ║`);
  console.log(`║  Requests/Second:            ${String(rps).padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                       RESPONSE TIMES                                  ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Average:                    ${String(avgTime + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P50:                        ${String(p50Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P95:                        ${String(p95Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  P99:                        ${String(p99Time + 'ms').padEnd(20)}                   ║`);
  console.log(`║  Max:                        ${String(maxTime + 'ms').padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                        ERROR BREAKDOWN                                ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Successful:                 ${String(successes).padEnd(20)}                   ║`);
  console.log(`║  Total Errors:               ${String(errors + ' (' + errorPct + '%)').padEnd(20)}                   ║`);
  console.log(`║  Server Errors (5xx):        ${String(serverErrors).padEnd(20)}                   ║`);
  console.log(`║  Connection Errors:          ${String(connErrors).padEnd(20)}                   ║`);
  console.log(`║  Timeouts:                   ${String(timeouts).padEnd(20)}                   ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log('║                        CRASH ANALYSIS                                 ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Crash Detected:             ${String(didCrash ? 'YES 🔴' : 'NO ✓').padEnd(20)}                   ║`);
  if (didCrash) {
    console.log(`║  Time to Crash:              ${String(crashTime + 'ms').padEnd(20)}                   ║`);
    console.log(`║  VUs at Crash:               ${String(crashVUsVal).padEnd(20)}                   ║`);
  }
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  console.log(`║  STATUS: ${status.padEnd(60)} ║`);
  console.log('╠══════════════════════════════════════════════════════════════════════╣');

  // Word wrap recommendation
  const words = recommendation.split(' ');
  let line = '';
  words.forEach(word => {
    if ((line + ' ' + word).trim().length <= 66) {
      line = (line + ' ' + word).trim();
    } else {
      console.log(`║  ${line.padEnd(68)} ║`);
      line = word;
    }
  });
  if (line) console.log(`║  ${line.padEnd(68)} ║`);

  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const report = {
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      maxVUs: MAX_VUS,
      rampTime: RAMP_TIME,
    },
    results: {
      testDurationMs: duration,
      maxVirtualUsers: maxVUs,
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
    errors: {
      total: errors,
      errorRate: parseFloat(errorPct),
      serverErrors: serverErrors,
      connectionErrors: connErrors,
      timeouts: timeouts,
    },
    crash: {
      detected: didCrash,
      timeMs: crashTime,
      atVUs: crashVUsVal,
    },
    status: status,
    recommendation: recommendation,
  };

  return {
    'crash-report.json': JSON.stringify(report, null, 2),
  };
}
