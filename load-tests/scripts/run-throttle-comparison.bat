@echo off
setlocal enabledelayedexpansion

REM ============================================
REM Throttle Comparison Test Runner
REM ============================================
REM This script runs load tests with and without throttle
REM to compare performance and find breaking points.
REM
REM Prerequisites:
REM   1. K6 installed (choco install k6 OR winget install k6)
REM   2. Backend server running
REM   3. .env configured with THROTTLE_ENABLED setting
REM
REM Usage:
REM   run-throttle-comparison.bat [URL] [MAX_VUS]
REM
REM Example:
REM   run-throttle-comparison.bat http://localhost:8000 500
REM ============================================

set URL=%1
set MAX_VUS=%2

if "%URL%"=="" set URL=http://localhost:8000
if "%MAX_VUS%"=="" set MAX_VUS=500

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "TESTS_DIR=%SCRIPT_DIR%..\tests"
set "REPORTS_DIR=%SCRIPT_DIR%..\reports"

echo.
echo ============================================================
echo          THROTTLE COMPARISON TEST SUITE
echo ============================================================
echo.
echo  Target Server:  %URL%
echo  Max VUs:        %MAX_VUS%
echo.
echo  This test suite will:
echo    1. Run throttle test (find throttle limits)
echo    2. Run crash test (find server breaking point)
echo.
echo  Make sure your backend server is running!
echo.
echo ============================================================
echo.

REM Check if k6 is installed
where k6 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: k6 is not installed!
    echo.
    echo Install k6 using one of these methods:
    echo   - choco install k6
    echo   - winget install k6
    echo   - Download from https://k6.io/docs/get-started/installation/
    echo.
    exit /b 1
)

REM Check if server is responding
echo Checking server health...
curl -s -o nul -w "%%{http_code}" %URL%/health > temp_status.txt
set /p STATUS=<temp_status.txt
del temp_status.txt

if "%STATUS%"=="200" (
    echo [OK] Server is responding
) else (
    echo [WARNING] Server health check returned: %STATUS%
    echo.
    set /p CONTINUE="Continue anyway? (y/n): "
    if /i not "!CONTINUE!"=="y" exit /b 1
)

echo.
echo ============================================================
echo  PHASE 1: THROTTLE TEST
echo ============================================================
echo  Testing throttle behavior under increasing load...
echo.

k6 run --env BASE_URL=%URL% --env MAX_VUS=%MAX_VUS% "%TESTS_DIR%\throttle-test.js"
if exist throttle-report.json move throttle-report.json "%REPORTS_DIR%\" >nul

echo.
echo Throttle test complete. Report saved to reports\throttle-report.json
echo.

set /p RUN_CRASH="Run crash test? This will stress the server aggressively. (y/n): "
if /i not "%RUN_CRASH%"=="y" goto :skip_crash

echo.
echo ============================================================
echo  PHASE 2: CRASH TEST
echo ============================================================
echo  WARNING: This test will push the server to its limits!
echo  Only run this in test/staging environments.
echo.

k6 run --env BASE_URL=%URL% --env MAX_VUS=%MAX_VUS% "%TESTS_DIR%\crash-test.js"
if exist crash-report.json move crash-report.json "%REPORTS_DIR%\" >nul

echo.
echo Crash test complete. Report saved to reports\crash-report.json
echo.

:skip_crash

echo.
echo ============================================================
echo  TEST SUITE COMPLETE
echo ============================================================
echo.
echo  Reports generated in reports/ folder:
echo    - throttle-report.json  (Throttle behavior analysis)
echo    - crash-report.json     (Server crash point analysis)
echo.
echo  View results:
echo    type "%REPORTS_DIR%\throttle-report.json"
echo    type "%REPORTS_DIR%\crash-report.json"
echo.
echo ============================================================

endlocal
