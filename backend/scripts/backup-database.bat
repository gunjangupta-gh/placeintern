@echo off
REM ============================================================================
REM PostgreSQL Database Backup Script
REM ============================================================================
REM Usage: backup-database.bat [backup_dir]
REM
REM This script creates a timestamped backup of the CMS PostgreSQL database.
REM Requires pg_dump to be in PATH or PostgreSQL bin directory to be configured.
REM ============================================================================

setlocal enabledelayedexpansion

REM --- Configuration (modify these as needed) ---
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=cms_db
set DB_USER=postgres
set DB_PASSWORD=postgres123

REM --- Backup directory (use argument or default) ---
if "%~1"=="" (
    set BACKUP_DIR=%~dp0..\backups
) else (
    set BACKUP_DIR=%~1
)

REM --- Create backup directory if it doesn't exist ---
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
    echo Created backup directory: %BACKUP_DIR%
)

REM --- Generate timestamp for filename ---
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%

REM --- Backup filename ---
set BACKUP_FILE=%BACKUP_DIR%\cms_backup_%TIMESTAMP%.sql
set BACKUP_FILE_COMPRESSED=%BACKUP_DIR%\cms_backup_%TIMESTAMP%.sql.gz

echo ============================================================================
echo PostgreSQL Database Backup
echo ============================================================================
echo.
echo Database: %DB_NAME%
echo Host: %DB_HOST%:%DB_PORT%
echo Backup file: %BACKUP_FILE%
echo Timestamp: %TIMESTAMP%
echo.

REM --- Set password for pg_dump ---
set PGPASSWORD=%DB_PASSWORD%

REM --- Create backup using pg_dump ---
echo Creating backup...
pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F p -f "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Backup completed successfully!
    echo.

    REM --- Get file size ---
    for %%A in ("%BACKUP_FILE%") do set FILE_SIZE=%%~zA
    echo Backup file size: !FILE_SIZE! bytes
    echo Location: %BACKUP_FILE%

    REM --- Optional: Compress the backup if gzip is available ---
    where gzip >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Compressing backup...
        gzip -k "%BACKUP_FILE%"
        if exist "%BACKUP_FILE_COMPRESSED%" (
            for %%A in ("%BACKUP_FILE_COMPRESSED%") do set COMPRESSED_SIZE=%%~zA
            echo Compressed file size: !COMPRESSED_SIZE! bytes
            echo Compressed location: %BACKUP_FILE_COMPRESSED%

            REM --- Remove uncompressed file after successful compression ---
            del "%BACKUP_FILE%"
            echo Removed uncompressed backup file.
        )
    ) else (
        echo.
        echo Note: gzip not found. Backup saved as uncompressed SQL file.
    )
) else (
    echo.
    echo ERROR: Backup failed!
    echo Please check:
    echo   1. PostgreSQL is running
    echo   2. pg_dump is in your PATH
    echo   3. Database credentials are correct
    exit /b 1
)

echo.
echo ============================================================================
echo Backup process completed
echo ============================================================================

REM --- Cleanup old backups (keep last 7 days) ---
echo.
echo Cleaning up backups older than 7 days...
forfiles /p "%BACKUP_DIR%" /s /m cms_backup_*.sql* /d -7 /c "cmd /c del @path" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Old backups cleaned up.
) else (
    echo No old backups to clean up.
)

endlocal
