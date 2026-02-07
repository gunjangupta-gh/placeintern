#!/bin/bash

# ============================================
# Throttle Comparison Test Runner
# ============================================
# This script runs load tests with and without throttle
# to compare performance and find breaking points.
#
# Prerequisites:
#   1. K6 installed (brew install k6 OR apt install k6)
#   2. Backend server running
#   3. .env configured with THROTTLE_ENABLED setting
#
# Usage:
#   ./run-throttle-comparison.sh [URL] [MAX_VUS]
#
# Example:
#   ./run-throttle-comparison.sh http://localhost:8000 500
# ============================================

URL="${1:-http://localhost:8000}"
MAX_VUS="${2:-500}"

# Get script directory and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/../tests"
REPORTS_DIR="$SCRIPT_DIR/../reports"

echo ""
echo "============================================================"
echo "         THROTTLE COMPARISON TEST SUITE"
echo "============================================================"
echo ""
echo "  Target Server:  $URL"
echo "  Max VUs:        $MAX_VUS"
echo ""
echo "  This test suite will:"
echo "    1. Run throttle test (find throttle limits)"
echo "    2. Run crash test (find server breaking point)"
echo ""
echo "  Make sure your backend server is running!"
echo ""
echo "============================================================"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo "ERROR: k6 is not installed!"
    echo ""
    echo "Install k6 using one of these methods:"
    echo "  - brew install k6"
    echo "  - apt install k6"
    echo "  - Download from https://k6.io/docs/get-started/installation/"
    echo ""
    exit 1
fi

# Check if server is responding
echo "Checking server health..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL/health")

if [ "$STATUS" == "200" ]; then
    echo "[OK] Server is responding"
else
    echo "[WARNING] Server health check returned: $STATUS"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 1
    fi
fi

echo ""
echo "============================================================"
echo " PHASE 1: THROTTLE TEST"
echo "============================================================"
echo " Testing throttle behavior under increasing load..."
echo ""

k6 run --env BASE_URL="$URL" --env MAX_VUS="$MAX_VUS" "$TESTS_DIR/throttle-test.js"
[ -f throttle-report.json ] && mv throttle-report.json "$REPORTS_DIR/"

echo ""
echo "Throttle test complete. Report saved to reports/throttle-report.json"
echo ""

read -p "Run crash test? This will stress the server aggressively. (y/n): " RUN_CRASH

if [ "$RUN_CRASH" == "y" ] || [ "$RUN_CRASH" == "Y" ]; then
    echo ""
    echo "============================================================"
    echo " PHASE 2: CRASH TEST"
    echo "============================================================"
    echo " WARNING: This test will push the server to its limits!"
    echo " Only run this in test/staging environments."
    echo ""

    k6 run --env BASE_URL="$URL" --env MAX_VUS="$MAX_VUS" "$TESTS_DIR/crash-test.js"
    [ -f crash-report.json ] && mv crash-report.json "$REPORTS_DIR/"

    echo ""
    echo "Crash test complete. Report saved to reports/crash-report.json"
    echo ""
fi

echo ""
echo "============================================================"
echo " TEST SUITE COMPLETE"
echo "============================================================"
echo ""
echo " Reports generated in reports/ folder:"
echo "   - throttle-report.json  (Throttle behavior analysis)"
echo "   - crash-report.json     (Server crash point analysis)"
echo ""
echo " View results:"
echo "   cat $REPORTS_DIR/throttle-report.json"
echo "   cat $REPORTS_DIR/crash-report.json"
echo ""
echo "============================================================"
