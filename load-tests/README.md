# CMS Load Testing Suite

Tools to measure your server's capacity and find its breaking point.

## Folder Structure

```
load-tests/
├── tests/              # K6 test scripts
│   ├── quick-test.js   # Quick capacity finder (10→300 users)
│   ├── load-test.js    # Full load test suite
│   ├── throttle-test.js # Throttle behavior testing
│   └── crash-test.js   # Server crash point finder
├── scripts/            # Runner scripts
│   ├── run-tests.bat/.sh           # General test runner
│   ├── run-throttle-comparison.bat/.sh  # Throttle comparison runner
│   └── docker-run-test.bat         # Docker-based runner
├── config/             # Configuration files
│   └── artillery-config.yml        # Artillery configuration
├── reports/            # Generated reports (gitignored)
│   └── .gitignore
└── README.md
```

## Quick Start

### Option 1: Using k6 (Recommended)

```bash
# Install k6
# Windows: choco install k6  OR  winget install k6
# Mac: brew install k6
# Linux: sudo apt install k6

# Run quick capacity test
k6 run tests/quick-test.js

# Run against specific server
k6 run --env BASE_URL=http://your-server:8080 tests/quick-test.js
```

### Option 2: Using Runner Scripts

```bash
# Windows
scripts\run-tests.bat --url http://localhost:8080 --type quick

# Linux/Mac
./scripts/run-tests.sh --url http://localhost:8080 --type quick
```

### Option 3: Using Docker (No installation)

```bash
# Windows
scripts\docker-run-test.bat http://host.docker.internal:8080

# Linux/Mac
docker run --rm -i -v $(pwd):/load-tests grafana/k6 run \
  --env BASE_URL=http://host.docker.internal:8080 \
  /load-tests/tests/quick-test.js
```

### Option 4: Using Artillery (npm-based)

```bash
npm install -g artillery
artillery run config/artillery-config.yml
```

## Available Tests

| Test | Command | Description |
|------|---------|-------------|
| **Quick** | `scripts/run-tests --type quick` | 8-minute capacity finder (10→300 users) |
| **Smoke** | `scripts/run-tests --type smoke` | 30-second sanity check (5 users) |
| **Full** | `scripts/run-tests --type full` | 11-minute comprehensive suite |
| **Stress** | `scripts/run-tests --type stress` | 2-minute max stress (500 users) |

## Test Scripts

### tests/quick-test.js

Gradually ramps up from 10 to 300 users to find your server's capacity:

```
10 → 25 → 50 → 75 → 100 → 150 → 200 → 250 → 300 users
```

Outputs estimated capacity based on error rate and response times.

### tests/load-test.js

Full test suite with multiple scenarios:
- Smoke test (1 user)
- Load test (0→50→100 users)
- Stress test (0→500 users)
- Spike test (sudden 500 user spike)

## Understanding Results

### Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Error Rate | <1% | 1-5% | >5% |
| P95 Response | <500ms | 500-1000ms | >1000ms |
| P99 Response | <1000ms | 1-2000ms | >2000ms |

### Capacity Estimation

Based on the quick test results:

| Error Rate | P95 Time | Estimated Capacity |
|------------|----------|-------------------|
| <1% | <500ms | 300+ users |
| <5% | <1000ms | 150-300 users |
| <10% | <2000ms | 75-150 users |
| <20% | any | 25-75 users |
| >20% | any | <25 users |

## Customization

### Testing Your Actual Endpoints

Edit `tests/load-test.js` and modify the `apiEndpoints` function:

```javascript
const endpoints = [
  '/api/v1/your-endpoint',
  '/api/v1/another-endpoint',
];
```

### Adding Authentication

Set environment variables:

```bash
k6 run --env BASE_URL=http://localhost:8080 \
       --env TEST_EMAIL=real@email.com \
       --env TEST_PASSWORD=realpassword \
       tests/load-test.js
```

### Custom Virtual Users & Duration

```bash
# 100 users for 5 minutes
k6 run --vus 100 --duration 5m tests/quick-test.js

# Gradual ramp to 200 users
k6 run --stage 1m:50,2m:100,2m:200,1m:0 tests/quick-test.js
```

## Output Reports

Tests generate JSON reports in the `reports/` folder:
- `capacity-report.json` - Capacity estimation
- `throttle-report.json` - Throttle behavior analysis
- `crash-report.json` - Server crash point analysis

### HTML Report

```bash
k6 run --out json=reports/results.json tests/quick-test.js

# Convert to HTML (requires k6-reporter)
# See: https://github.com/benc-uk/k6-reporter
```

## For 2GB/2vCPU Server

Based on your resource constraints, expect:

| Workload | Realistic Capacity |
|----------|-------------------|
| Read-heavy (browsing) | 200-300 users |
| Mixed (read/write) | 100-150 users |
| Write-heavy (uploads) | 50-75 users |

Run the quick test to get your actual numbers!

---

## Throttle Testing Suite

Special tests designed to evaluate your throttle/rate limiting system.

### Throttle Tests Overview

| Test | Command | Description |
|------|---------|-------------|
| **Throttle Test** | `k6 run tests/throttle-test.js` | Tests throttle behavior, finds when 429s start |
| **Crash Test** | `k6 run tests/crash-test.js` | Aggressively pushes server to find crash point |
| **Comparison** | `scripts/run-throttle-comparison.bat` | Runs both tests in sequence |

### Quick Start - Throttle Testing

```bash
# Windows
scripts\run-throttle-comparison.bat http://localhost:5000 500

# Linux/Mac
./scripts/run-throttle-comparison.sh http://localhost:5000 500
```

### tests/throttle-test.js

Tests how your throttle system protects the server:

- Gradually increases load from 1 to 500 users
- Measures time to first throttle (429 response)
- Measures time to first server error (5xx)
- Tracks max concurrent users before throttle kicks in
- Tests different throttle presets (dashboard, list, export, lightweight)

**Output:** `reports/throttle-report.json`

```bash
k6 run --env BASE_URL=http://localhost:5000 tests/throttle-test.js
```

### tests/crash-test.js

**WARNING: Designed to crash your server!** Only run in test environments.

- Aggressively ramps up to 1000+ users
- Minimal think time for maximum stress
- Detects crash via consecutive error threshold
- Reports exact crash point (VUs and time)

**Output:** `reports/crash-report.json`

```bash
k6 run --env BASE_URL=http://localhost:5000 --env MAX_VUS=1000 tests/crash-test.js
```

### Comparing With/Without Throttle

To compare performance with throttle enabled vs disabled:

1. **With Throttle Enabled** (default):
   ```bash
   # In your backend .env:
   THROTTLE_ENABLED=true

   # Run test
   k6 run tests/throttle-test.js
   # Results saved to reports/throttle-report.json
   ```

2. **With Throttle Disabled**:
   ```bash
   # In your backend .env:
   THROTTLE_ENABLED=false

   # Restart server, then run test
   k6 run tests/crash-test.js
   # Results saved to reports/crash-report.json
   ```

3. **Compare Results**:
   | Metric | With Throttle | Without Throttle |
   |--------|---------------|------------------|
   | Time to Crash | Never (protected) | X ms |
   | Max VUs | 500+ | Y users |
   | Error Rate | 429s only | 5xx errors |

### Understanding Throttle Test Results

#### Status Meanings

| Status | Meaning |
|--------|---------|
| `THROTTLE WORKING` | Throttle protected the server, 429s returned |
| `HEALTHY` | Server handled load without throttling |
| `DEGRADED` | High error rate but server still responding |
| `CRASHED` | Server stopped responding (5xx or timeouts) |

#### Key Metrics

| Metric | Description |
|--------|-------------|
| `timeToFirstThrottleMs` | When the first 429 was received |
| `maxVUsBeforeThrottle` | Concurrent users when throttle kicked in |
| `timeToServerCrashMs` | When server started returning 5xx |
| `maxVUsBeforeCrash` | Concurrent users when server crashed |
| `throttleRate` | Percentage of requests that got 429 |
| `crashRate` | Percentage of requests that got 5xx |

### Throttle Configuration Reference

Your backend uses these throttle presets (from `throttle.config.ts`):

| Preset | Default Limit | TTL | Use Case |
|--------|---------------|-----|----------|
| `dashboard` | 5/min | 60s | Dashboard views |
| `export` | 3/min | 60s | Report exports |
| `list` | 30/min | 60s | List/pagination |
| `mutation` | 10/min | 60s | Create/Update/Delete |
| `lightweight` | 60/min | 60s | Health checks, counts |
| `default` | 100/min | 60s | General endpoints |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:5000` | Server URL |
| `MAX_VUS` | `500` | Maximum virtual users |
| `THROTTLE_MODE` | `compare` | Test mode |
| `TEST_EMAIL` | (test creds) | Auth email |
| `TEST_PASSWORD` | (test creds) | Auth password |

### Sample Comparison Results

**With Throttle Enabled:**
```
Status: THROTTLE WORKING
Time to First Throttle: 45000ms
Max VUs Before Throttle: 100
Throttle Rate: 15%
Server Errors: 0
```

**Without Throttle:**
```
Status: CRASHED
Time to Crash: 120000ms
Max VUs Before Crash: 250
Error Rate: 45%
Server Errors: 2500
```

**Recommendation:** Enable throttle to protect your server from overload!
