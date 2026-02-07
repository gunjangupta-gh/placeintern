@echo off
REM ============================================
REM CMS Load Testing Script for Windows
REM ============================================

setlocal enabledelayedexpansion

REM Default values
set "BASE_URL=http://localhost:8080"
set "TEST_TYPE=quick"

REM Parse arguments
:parse_args
if "%~1"=="" goto :run_test
if /i "%~1"=="--url" (
    set "BASE_URL=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--type" (
    set "TEST_TYPE=%~2"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--help" goto :show_help
shift
goto :parse_args

:show_help
echo.
echo CMS Load Testing Script
echo =======================
echo.
echo Usage: run-tests.bat [options]
echo.
echo Options:
echo   --url URL     Target server URL (default: http://localhost:8080)
echo   --type TYPE   Test type: quick, full, smoke, stress (default: quick)
echo   --help        Show this help message
echo.
echo Examples:
echo   run-tests.bat
echo   run-tests.bat --url http://production-server:8080
echo   run-tests.bat --type full
echo   run-tests.bat --url http://staging:8080 --type stress
echo.
exit /b 0

:run_test
echo.
echo ============================================
echo    CMS Load Testing
echo ============================================
echo    Target: %BASE_URL%
echo    Test Type: %TEST_TYPE%
echo ============================================
echo.

REM Check if k6 is installed
where k6 >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: k6 is not installed!
    echo.
    echo Install k6 using one of these methods:
    echo   - Windows: choco install k6
    echo   - Windows: winget install k6
    echo   - Download: https://k6.io/docs/getting-started/installation/
    echo.
    exit /b 1
)

REM Verify server is accessible
echo Checking server connectivity...
curl -s -o nul -w "%%{http_code}" "%BASE_URL%/health" > temp_status.txt 2>nul
set /p STATUS=<temp_status.txt
del temp_status.txt 2>nul

if "%STATUS%"=="" (
    echo WARNING: Could not reach %BASE_URL%/health
    echo Make sure your server is running.
    echo.
    set /p CONTINUE="Continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" exit /b 1
) else (
    echo Server responded with status: %STATUS%
)

echo.
echo Starting %TEST_TYPE% test...
echo.

REM Get script directory
set "SCRIPT_DIR=%~dp0"

REM Run appropriate test
if /i "%TEST_TYPE%"=="quick" (
    k6 run --env BASE_URL=%BASE_URL% "%SCRIPT_DIR%..\tests\quick-test.js"
) else if /i "%TEST_TYPE%"=="full" (
    k6 run --env BASE_URL=%BASE_URL% "%SCRIPT_DIR%..\tests\load-test.js"
) else if /i "%TEST_TYPE%"=="smoke" (
    k6 run --env BASE_URL=%BASE_URL% --vus 5 --duration 30s "%SCRIPT_DIR%..\tests\quick-test.js"
) else if /i "%TEST_TYPE%"=="stress" (
    k6 run --env BASE_URL=%BASE_URL% --vus 500 --duration 2m "%SCRIPT_DIR%..\tests\quick-test.js"
) else (
    echo Unknown test type: %TEST_TYPE%
    echo Valid types: quick, full, smoke, stress
    exit /b 1
)

echo.
echo Test completed! Check the generated report files.
echo.

endlocal
