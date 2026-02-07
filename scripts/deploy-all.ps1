# =============================================================================
# CMS Master Deployment Script (Windows PowerShell)
# =============================================================================
# Single command to deploy the entire CMS stack
# Usage: .\scripts\deploy-all.ps1 [command] [service]
# =============================================================================

param(
    [Parameter(Position=0)]
    [string]$Command = "help",

    [Parameter(Position=1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

# =============================================================================
# CONFIGURATION
# =============================================================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Compose files
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
$ComposeProd = Join-Path $ProjectRoot "docker-compose.prod.yml"
$ComposeDev = Join-Path $ProjectRoot "docker-compose.dev.yml"

# State file to track deployment mode
$StateFile = Join-Path $ProjectRoot ".deploy-state"

# Load .env if exists
$envFile = Join-Path $ProjectRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "env:$key" -Value $value -ErrorAction SilentlyContinue
        }
    }
}

# Ports with defaults
$FrontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "80" }
$BackendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }
$MinioPort = if ($env:MINIO_API_PORT) { $env:MINIO_API_PORT } else { "9000" }
$MinioConsolePort = if ($env:MINIO_CONSOLE_PORT) { $env:MINIO_CONSOLE_PORT } else { "9001" }

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Write-Header {
    param([string]$Title = "CMS Master Deployment")
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "   $Title" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success { param([string]$Msg) Write-Host "[OK] $Msg" -ForegroundColor Green }
function Write-Err { param([string]$Msg) Write-Host "[X] $Msg" -ForegroundColor Red }
function Write-Info { param([string]$Msg) Write-Host "[->] $Msg" -ForegroundColor Yellow }
function Write-Step { param([string]$Msg) Write-Host "[>>] $Msg" -ForegroundColor Blue }
function Write-Warn { param([string]$Msg) Write-Host "[!] $Msg" -ForegroundColor Magenta }

# Get current deployment mode
function Get-DeployMode {
    if (Test-Path $StateFile) {
        return Get-Content $StateFile -Raw
    }
    # Auto-detect based on running containers
    $prodContainers = docker ps --filter "name=cms-" --format "{{.Names}}" 2>$null
    if ($prodContainers) {
        return "prod"
    }
    return "local"
}

# Save deployment mode
function Set-DeployMode {
    param([string]$Mode)
    $Mode | Out-File -FilePath $StateFile -NoNewline
}

# Get the right compose command based on mode
function Get-ComposeCmd {
    param([string]$Mode = "")
    if (-not $Mode) { $Mode = Get-DeployMode }

    switch ($Mode) {
        "prod" { return "docker compose -f `"$ComposeProd`"" }
        "dev"  { return "docker compose -f `"$ComposeDev`"" }
        default { return "docker compose -f `"$ComposeFile`"" }
    }
}

# Check Docker is running
function Test-Docker {
    Write-Step "Checking Docker..."
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Docker not running" }
        Write-Success "Docker is running"
        return $true
    }
    catch {
        Write-Err "Docker is not running. Please start Docker Desktop."
        Write-Info "Download: https://www.docker.com/products/docker-desktop"
        return $false
    }
}

# Validate environment
function Test-Environment {
    Write-Step "Validating environment..."

    $masterEnv = Join-Path $ProjectRoot ".env"
    $dockerEnv = Join-Path $ProjectRoot ".env.docker"

    # Check if .env exists, create from template if not
    if (-not (Test-Path $masterEnv)) {
        if (Test-Path $dockerEnv) {
            Write-Warn "Master .env not found. Creating from .env.docker..."
            Copy-Item $dockerEnv $masterEnv
        } else {
            Write-Err "No .env file found! Please create one from .env.docker template."
            return $false
        }
    }

    # Check critical variables
    $criticalVars = @("DATABASE_URL", "JWT_SECRET", "MONGO_ROOT_USER", "MONGO_ROOT_PASSWORD")
    $missing = @()

    foreach ($var in $criticalVars) {
        $value = [Environment]::GetEnvironmentVariable($var)
        if (-not $value) {
            $missing += $var
        }
    }

    if ($missing.Count -gt 0) {
        Write-Warn "Missing environment variables: $($missing -join ', ')"
        Write-Info "Please check your .env file"
    }

    Write-Success "Environment validated"
    return $true
}

# Sync environment files
function Sync-EnvFiles {
    Write-Step "Syncing environment files..."

    $masterEnv = Join-Path $ProjectRoot ".env"

    if (-not (Test-Path $masterEnv)) {
        Write-Err "Master .env file not found!"
        return $false
    }

    Copy-Item $masterEnv (Join-Path $ProjectRoot ".env.docker") -Force
    Copy-Item $masterEnv (Join-Path $ProjectRoot ".env.production") -Force

    Write-Success "Environment files synchronized"
    return $true
}

# Wait for containers to be healthy
function Wait-ForHealthy {
    param(
        [string]$ComposeCmd,
        [int]$TimeoutSeconds = 120
    )

    Write-Step "Waiting for services to be healthy..."

    $elapsed = 0
    $interval = 5

    while ($elapsed -lt $TimeoutSeconds) {
        Start-Sleep -Seconds $interval
        $elapsed += $interval

        # Check container health
        $unhealthy = Invoke-Expression "$ComposeCmd ps --format json 2>`$null" |
            ConvertFrom-Json |
            Where-Object { $_.Health -eq "unhealthy" -or $_.State -ne "running" }

        if (-not $unhealthy) {
            $healthy = Invoke-Expression "$ComposeCmd ps --format json 2>`$null" |
                ConvertFrom-Json |
                Where-Object { $_.Health -eq "healthy" -or $_.State -eq "running" }

            if ($healthy.Count -ge 4) {
                Write-Success "All services are healthy!"
                return $true
            }
        }

        Write-Host "." -NoNewline
    }

    Write-Host ""
    Write-Warn "Some services may still be starting. Check with: .\deploy-all.ps1 status"
    return $true
}

# =============================================================================
# DEPLOYMENT COMMANDS
# =============================================================================

# Production deployment (GHCR images)
function Start-Production {
    Write-Header "Production Deployment (GHCR)"

    if (-not (Test-Docker)) { exit 1 }
    if (-not (Test-Environment)) { exit 1 }
    Sync-EnvFiles

    Set-Location $ProjectRoot
    Set-DeployMode "prod"

    Write-Info "Pulling latest images from GHCR..."
    docker compose -f $ComposeProd pull
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to pull images. Check your network connection."
        exit 1
    }

    Write-Info "Starting containers..."
    docker compose -f $ComposeProd up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to start containers."
        exit 1
    }

    Wait-ForHealthy -ComposeCmd "docker compose -f `"$ComposeProd`""

    Show-URLs
    Get-Status
}

# Local build deployment
function Start-Local {
    Write-Header "Local Build Deployment"

    if (-not (Test-Docker)) { exit 1 }
    if (-not (Test-Environment)) { exit 1 }
    Sync-EnvFiles

    Set-Location $ProjectRoot
    Set-DeployMode "local"

    Write-Info "Building and starting containers..."
    docker compose -f $ComposeFile up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Failed to build/start containers."
        exit 1
    }

    Wait-ForHealthy -ComposeCmd "docker compose -f `"$ComposeFile`""

    Show-URLs
    Get-Status
}

# Development infrastructure only
function Start-Dev {
    Write-Header "Development Infrastructure"

    if (-not (Test-Docker)) { exit 1 }

    Set-Location $ProjectRoot
    Set-DeployMode "dev"

    Write-Info "Starting infrastructure containers..."
    docker compose -f $ComposeDev up -d

    Start-Sleep -Seconds 5

    Write-Host ""
    Write-Success "Development infrastructure ready!"
    Write-Host ""
    Write-Host "Services:" -ForegroundColor Yellow
    Write-Host "  MongoDB:     mongodb://localhost:27017" -ForegroundColor Blue
    Write-Host "  DragonflyDB: redis://localhost:6379" -ForegroundColor Blue
    Write-Host "  MinIO API:   http://localhost:9000" -ForegroundColor Blue
    Write-Host "  MinIO UI:    http://localhost:9001" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  cd backend && npm install && npm run start:dev"
    Write-Host "  cd frontend && npm install && npm run dev"
}

# Stop all services
function Stop-Services {
    Write-Header "Stopping Services"

    Set-Location $ProjectRoot
    $mode = Get-DeployMode

    Write-Info "Stopping containers..."

    # Stop all possible compose configurations
    docker compose -f $ComposeFile down 2>$null
    docker compose -f $ComposeProd down 2>$null
    docker compose -f $ComposeDev down 2>$null

    Write-Success "All services stopped"
}

# Restart services
function Restart-Services {
    Write-Header "Restarting Services"

    $mode = Get-DeployMode
    Write-Info "Current mode: $mode"

    Stop-Services

    switch ($mode) {
        "prod"  { Start-Production }
        "dev"   { Start-Dev }
        default { Start-Local }
    }
}

# Pull latest images
function Pull-Images {
    Write-Header "Pulling GHCR Images"

    if (-not (Test-Docker)) { exit 1 }

    Set-Location $ProjectRoot
    docker compose -f $ComposeProd pull

    Write-Success "Images pulled successfully!"
    Write-Info "Run '.\deploy-all.ps1 prod' to deploy"
}

# Build images locally
function Build-Images {
    Write-Header "Building Images"

    if (-not (Test-Docker)) { exit 1 }
    Sync-EnvFiles

    Set-Location $ProjectRoot
    docker compose -f $ComposeFile build --no-cache --parallel

    Write-Success "Images built successfully!"
}

# Show service status
function Get-Status {
    Write-Step "Service Status:"
    Write-Host ""

    Set-Location $ProjectRoot
    $mode = Get-DeployMode
    $cmd = Get-ComposeCmd -Mode $mode

    Invoke-Expression "$cmd ps"
}

# Show logs
function Get-Logs {
    Set-Location $ProjectRoot
    $mode = Get-DeployMode
    $cmd = Get-ComposeCmd -Mode $mode

    if ($Service) {
        Invoke-Expression "$cmd logs -f --tail=100 $Service"
    } else {
        Invoke-Expression "$cmd logs -f --tail=100"
    }
}

# Health check
function Test-Health {
    Write-Header "Health Check"

    $results = @()

    # Backend
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$BackendPort/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Success "Backend (port $BackendPort) - Healthy"
        $results += $true
    } catch {
        Write-Err "Backend (port $BackendPort) - Not responding"
        $results += $false
    }

    # Frontend
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Success "Frontend (port $FrontendPort) - Healthy"
        $results += $true
    } catch {
        Write-Err "Frontend (port $FrontendPort) - Not responding"
        $results += $false
    }

    # MongoDB
    $mongoResult = docker exec cms-mongodb mongosh --quiet --eval "db.adminCommand('ping')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "MongoDB - Healthy"
        $results += $true
    } else {
        Write-Err "MongoDB - Not responding"
        $results += $false
    }

    # DragonflyDB
    $redisResult = docker exec cms-dragonfly redis-cli ping 2>&1
    if ($redisResult -match "PONG") {
        Write-Success "DragonflyDB - Healthy"
        $results += $true
    } else {
        Write-Err "DragonflyDB - Not responding"
        $results += $false
    }

    # MinIO
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$MinioPort/minio/health/live" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Write-Success "MinIO (port $MinioPort) - Healthy"
        $results += $true
    } catch {
        Write-Err "MinIO (port $MinioPort) - Not responding"
        $results += $false
    }

    Write-Host ""
    $healthy = ($results | Where-Object { $_ }).Count
    $total = $results.Count

    if ($healthy -eq $total) {
        Write-Success "All $total services are healthy!"
    } else {
        Write-Warn "$healthy/$total services healthy"
    }
}

# Shell access
function Get-Shell {
    $svc = if ($Service) { $Service } else { "backend" }

    Set-Location $ProjectRoot
    $mode = Get-DeployMode
    $cmd = Get-ComposeCmd -Mode $mode

    Write-Info "Opening shell in '$svc' container..."
    Invoke-Expression "$cmd exec $svc sh"
}

# Clean everything
function Clear-All {
    Write-Header "Cleanup"

    $confirm = Read-Host "This will remove ALL containers, volumes, and data. Continue? (y/N)"

    if ($confirm -eq 'y' -or $confirm -eq 'Y') {
        Set-Location $ProjectRoot

        Write-Info "Stopping all containers..."
        docker compose -f $ComposeFile down -v --remove-orphans 2>$null
        docker compose -f $ComposeProd down -v --remove-orphans 2>$null
        docker compose -f $ComposeDev down -v --remove-orphans 2>$null

        Write-Info "Cleaning Docker resources..."
        docker image prune -f
        docker volume prune -f

        # Remove state file
        if (Test-Path $StateFile) { Remove-Item $StateFile }

        Write-Success "Cleanup complete!"
    } else {
        Write-Info "Cancelled"
    }
}

# Stop dev infrastructure
function Stop-Dev {
    Write-Header "Stopping Dev Infrastructure"

    Set-Location $ProjectRoot
    docker compose -f $ComposeDev down

    Write-Success "Development infrastructure stopped"
}

# Show URLs
function Show-URLs {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Services Available:" -ForegroundColor Green
    Write-Host "  Frontend:   http://localhost:$FrontendPort" -ForegroundColor Blue
    Write-Host "  Backend:    http://localhost:$BackendPort/api" -ForegroundColor Blue
    Write-Host "  API Docs:   http://localhost:$BackendPort/api/docs" -ForegroundColor Blue
    Write-Host "  Health:     http://localhost:$BackendPort/health" -ForegroundColor Blue
    Write-Host "  MinIO UI:   http://localhost:$MinioConsolePort" -ForegroundColor Blue
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

# Show help
function Show-Help {
    Write-Header "Help"

    Write-Host "Usage: .\deploy-all.ps1 [command] [service]" -ForegroundColor White
    Write-Host ""
    Write-Host "DEPLOYMENT:" -ForegroundColor Yellow
    Write-Host "  prod        Deploy using GHCR images (recommended for production)" -ForegroundColor Green
    Write-Host "  start       Build and deploy from local source code"
    Write-Host "  dev         Start only infrastructure (MongoDB, Redis, MinIO)"
    Write-Host ""
    Write-Host "MANAGEMENT:" -ForegroundColor Yellow
    Write-Host "  stop        Stop all running services"
    Write-Host "  restart     Restart services (preserves deployment mode)"
    Write-Host "  status      Show container status"
    Write-Host "  logs        View logs (optionally specify service)"
    Write-Host "  health      Check health of all services"
    Write-Host "  shell       Open shell in container (default: backend)"
    Write-Host ""
    Write-Host "MAINTENANCE:" -ForegroundColor Yellow
    Write-Host "  pull        Pull latest GHCR images"
    Write-Host "  build       Build images locally (no cache)"
    Write-Host "  sync-env    Sync .env files from master"
    Write-Host "  clean       Remove all containers and volumes"
    Write-Host "  dev-stop    Stop dev infrastructure"
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor Yellow
    Write-Host "  .\deploy-all.ps1 prod              # Production deployment"
    Write-Host "  .\deploy-all.ps1 start             # Local build deployment"
    Write-Host "  .\deploy-all.ps1 logs backend      # View backend logs"
    Write-Host "  .\deploy-all.ps1 shell mongodb     # MongoDB shell"
    Write-Host "  .\deploy-all.ps1 health            # Check all services"
    Write-Host ""
    Write-Host "CURRENT MODE: $(Get-DeployMode)" -ForegroundColor Magenta
}

# =============================================================================
# MAIN
# =============================================================================

switch ($Command.ToLower()) {
    "prod"     { Start-Production }
    "start"    { Start-Local }
    "stop"     { Stop-Services }
    "restart"  { Restart-Services }
    "pull"     { Pull-Images }
    "build"    { Build-Images }
    "status"   { Get-Status }
    "logs"     { Get-Logs }
    "health"   { Test-Health }
    "shell"    { Get-Shell }
    "dev"      { Start-Dev }
    "dev-stop" { Stop-Dev }
    "sync-env" { Sync-EnvFiles }
    "clean"    { Clear-All }
    "help"     { Show-Help }
    default    { Show-Help }
}
