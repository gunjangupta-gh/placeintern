#!/bin/bash
# ============================================
# CMS Load Testing Script for Linux/Mac
# ============================================

# Default values
BASE_URL="${BASE_URL:-http://localhost:8080}"
TEST_TYPE="quick"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        --type)
            TEST_TYPE="$2"
            shift 2
            ;;
        --help)
            echo ""
            echo -e "${BLUE}CMS Load Testing Script${NC}"
            echo "======================="
            echo ""
            echo "Usage: ./run-tests.sh [options]"
            echo ""
            echo "Options:"
            echo "  --url URL     Target server URL (default: http://localhost:8080)"
            echo "  --type TYPE   Test type: quick, full, smoke, stress (default: quick)"
            echo "  --help        Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./run-tests.sh"
            echo "  ./run-tests.sh --url http://production-server:8080"
            echo "  ./run-tests.sh --type full"
            echo "  ./run-tests.sh --url http://staging:8080 --type stress"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   CMS Load Testing${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "   Target: ${GREEN}$BASE_URL${NC}"
echo -e "   Test Type: ${GREEN}$TEST_TYPE${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}ERROR: k6 is not installed!${NC}"
    echo ""
    echo "Install k6 using one of these methods:"
    echo "  - Mac: brew install k6"
    echo "  - Ubuntu/Debian: sudo apt install k6"
    echo "  - Docker: docker run --rm -i grafana/k6 run -"
    echo "  - Download: https://k6.io/docs/getting-started/installation/"
    echo ""
    exit 1
fi

# Verify server is accessible
echo "Checking server connectivity..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health" 2>/dev/null)

if [ -z "$HTTP_STATUS" ] || [ "$HTTP_STATUS" = "000" ]; then
    echo -e "${YELLOW}WARNING: Could not reach $BASE_URL/health${NC}"
    echo "Make sure your server is running."
    echo ""
    read -p "Continue anyway? (y/N): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}Server responded with status: $HTTP_STATUS${NC}"
fi

echo ""
echo "Starting $TEST_TYPE test..."
echo ""

# Get script directory and tests directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$SCRIPT_DIR/../tests"

# Run appropriate test
case $TEST_TYPE in
    quick)
        k6 run --env BASE_URL="$BASE_URL" "$TESTS_DIR/quick-test.js"
        ;;
    full)
        k6 run --env BASE_URL="$BASE_URL" "$TESTS_DIR/load-test.js"
        ;;
    smoke)
        k6 run --env BASE_URL="$BASE_URL" --vus 5 --duration 30s "$TESTS_DIR/quick-test.js"
        ;;
    stress)
        k6 run --env BASE_URL="$BASE_URL" --vus 500 --duration 2m "$TESTS_DIR/quick-test.js"
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo "Valid types: quick, full, smoke, stress"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Test completed! Check the generated report files.${NC}"
echo ""
