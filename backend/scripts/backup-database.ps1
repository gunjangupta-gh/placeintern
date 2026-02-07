# ============================================================================
# PostgreSQL Database Backup Script (PowerShell)
# ============================================================================
# Usage: .\backup-database.ps1 [-BackupDir <path>] [-KeepDays <days>]
#
# This script creates a timestamped backup of the CMS PostgreSQL database.
# ============================================================================

param(
    [string]$BackupDir = "",
    [int]$KeepDays = 7,
    [switch]$SkipCleanup
)

# --- Configuration ---
$DB_HOST = $env:DB_HOST ?? "localhost"
$DB_PORT = $env:DB_PORT ?? "5432"
$DB_NAME = $env:DB_NAME ?? "cms_db"
$DB_USER = $env:DB_USER ?? "postgres"
$DB_PASSWORD = $env:DB_PASSWORD ?? "postgres123"

# --- Set backup directory ---
if ([string]::IsNullOrEmpty($BackupDir)) {
    $BackupDir = Join-Path $PSScriptRoot "..\backups"
}

# --- Create backup directory if needed ---
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    Write-Host "Created backup directory: $BackupDir" -ForegroundColor Green
}

# --- Generate timestamp ---
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupDir "cms_backup_$Timestamp.sql"

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Database Backup" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Database:    $DB_NAME"
Write-Host "Host:        ${DB_HOST}:${DB_PORT}"
Write-Host "Backup file: $BackupFile"
Write-Host "Timestamp:   $Timestamp"
Write-Host ""

# --- Set password environment variable ---
$env:PGPASSWORD = $DB_PASSWORD

try {
    # --- Check if pg_dump exists ---
    $pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if (!$pgDump) {
        # Try common PostgreSQL installation paths on Windows
        $pgPaths = @(
            "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\14\bin\pg_dump.exe",
            "C:\Program Files\PostgreSQL\13\bin\pg_dump.exe"
        )
        foreach ($path in $pgPaths) {
            if (Test-Path $path) {
                $pgDump = $path
                break
            }
        }
        if (!$pgDump) {
            throw "pg_dump not found. Please ensure PostgreSQL client tools are installed and in PATH."
        }
    }

    Write-Host "Creating backup..." -ForegroundColor Yellow

    # --- Run pg_dump ---
    $pgDumpPath = if ($pgDump -is [System.Management.Automation.ApplicationInfo]) { $pgDump.Source } else { $pgDump }

    $process = Start-Process -FilePath $pgDumpPath `
        -ArgumentList "-h", $DB_HOST, "-p", $DB_PORT, "-U", $DB_USER, "-d", $DB_NAME, "-F", "p", "-f", $BackupFile `
        -Wait -NoNewWindow -PassThru

    if ($process.ExitCode -ne 0) {
        throw "pg_dump failed with exit code $($process.ExitCode)"
    }

    # --- Get file info ---
    $fileInfo = Get-Item $BackupFile
    $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

    Write-Host ""
    Write-Host "Backup completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backup file: $BackupFile"
    Write-Host "File size:   $fileSizeMB MB ($($fileInfo.Length) bytes)"

    # --- Try to compress ---
    $compressedFile = "$BackupFile.gz"
    try {
        Write-Host ""
        Write-Host "Compressing backup..." -ForegroundColor Yellow

        # Use .NET compression
        $inputStream = [System.IO.File]::OpenRead($BackupFile)
        $outputStream = [System.IO.File]::Create($compressedFile)
        $gzipStream = New-Object System.IO.Compression.GZipStream($outputStream, [System.IO.Compression.CompressionMode]::Compress)

        $inputStream.CopyTo($gzipStream)

        $gzipStream.Close()
        $outputStream.Close()
        $inputStream.Close()

        $compressedInfo = Get-Item $compressedFile
        $compressedSizeMB = [math]::Round($compressedInfo.Length / 1MB, 2)
        $compressionRatio = [math]::Round((1 - ($compressedInfo.Length / $fileInfo.Length)) * 100, 1)

        Write-Host "Compressed file: $compressedFile"
        Write-Host "Compressed size: $compressedSizeMB MB ($($compressedInfo.Length) bytes)"
        Write-Host "Compression:     $compressionRatio% reduction"

        # Remove uncompressed file
        Remove-Item $BackupFile -Force
        Write-Host "Removed uncompressed backup file." -ForegroundColor Gray
    }
    catch {
        Write-Host "Compression failed, keeping uncompressed file." -ForegroundColor Yellow
    }

    # --- Cleanup old backups ---
    if (!$SkipCleanup) {
        Write-Host ""
        Write-Host "Cleaning up backups older than $KeepDays days..." -ForegroundColor Yellow

        $cutoffDate = (Get-Date).AddDays(-$KeepDays)
        $oldBackups = Get-ChildItem -Path $BackupDir -Filter "cms_backup_*" |
            Where-Object { $_.LastWriteTime -lt $cutoffDate }

        if ($oldBackups.Count -gt 0) {
            $oldBackups | Remove-Item -Force
            Write-Host "Removed $($oldBackups.Count) old backup(s)." -ForegroundColor Green
        }
        else {
            Write-Host "No old backups to clean up." -ForegroundColor Gray
        }
    }

    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "Backup process completed successfully" -ForegroundColor Green
    Write-Host "============================================================================" -ForegroundColor Cyan

}
catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "  1. PostgreSQL is running"
    Write-Host "  2. pg_dump is installed and accessible"
    Write-Host "  3. Database credentials are correct"
    exit 1
}
finally {
    # Clear password from environment
    $env:PGPASSWORD = $null
}
