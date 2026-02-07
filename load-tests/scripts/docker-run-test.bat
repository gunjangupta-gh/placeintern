@echo off
REM Run load test using Docker (no installation required)
REM Usage: docker-run-test.bat [server-url]

set "BASE_URL=%~1"
if "%BASE_URL%"=="" set "BASE_URL=http://host.docker.internal:8080"

echo.
echo Running load test via Docker...
echo Target: %BASE_URL%
echo.

REM Get the load-tests root directory (parent of scripts folder)
set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%.."

docker run --rm -i ^
    --add-host=host.docker.internal:host-gateway ^
    -v "%ROOT_DIR%:/load-tests" ^
    grafana/k6 run ^
    --env BASE_URL=%BASE_URL% ^
    /load-tests/tests/quick-test.js

echo.
echo Test completed!
