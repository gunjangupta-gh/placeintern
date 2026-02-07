#!/bin/bash

# =============================================================================
# CMS Master Deployment Script (Linux/Mac)
# =============================================================================
# Single command to deploy the entire CMS stack
# Usage: ./scripts/deploy-all.sh [command] [service]
# =============================================================================

set -e

# =============================================================================
# CONFIGURATION
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Compose files
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"
COMPOSE_PROD="$PROJECT_ROOT/docker-compose.prod.yml"
COMPOSE_DEV="$PROJECT_ROOT/docker-compose.dev.yml"

# State file to track deployment mode
STATE_FILE="$PROJECT_ROOT/.deploy-state"

# Load .env if exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Ports with defaults
FRONTEND_PORT=${FRONTEND_PORT:-80}
BACKEND_PORT=${BACKEND_PORT:-8000}
MINIO_PORT=${MINIO_API_PORT:-9000}
MINIO_CONSOLE_PORT=${MINIO_CONSOLE_PORT:-9001}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

print_header() {
    local title="${1:-CMS Master Deployment}"
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  $title${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${YELLOW}→ $1${NC}"; }
print_step() { echo -e "${BLUE}▶ $1${NC}"; }
print_warn() { echo -e "${MAGENTA}! $1${NC}"; }

# Get current deployment mode
get_deploy_mode() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
        return
    fi
    # Auto-detect based on running containers
    if docker ps --filter "name=cms-" --format "{{.Names}}" 2>/dev/null | grep -q .; then
        echo "prod"
    else
        echo "local"
    fi
}

# Save deployment mode
set_deploy_mode() {
    echo -n "$1" > "$STATE_FILE"
}

# Get the right compose command based on mode
get_compose_cmd() {
    local mode="${1:-$(get_deploy_mode)}"
    case "$mode" in
        prod) echo "docker compose -f $COMPOSE_PROD" ;;
        dev)  echo "docker compose -f $COMPOSE_DEV" ;;
        *)    echo "docker compose -f $COMPOSE_FILE" ;;
    esac
}

# Check Docker is running
check_docker() {
    print_step "Checking Docker..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed."
        print_info "Install: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running."
        print_info "Start Docker and try again."
        exit 1
    fi

    print_success "Docker is running"
}

# Validate environment
validate_environment() {
    print_step "Validating environment..."

    local master_env="$PROJECT_ROOT/.env"
    local docker_env="$PROJECT_ROOT/.env.docker"

    # Check if .env exists, create from template if not
    if [ ! -f "$master_env" ]; then
        if [ -f "$docker_env" ]; then
            print_warn "Master .env not found. Creating from .env.docker..."
            cp "$docker_env" "$master_env"
        else
            print_error "No .env file found! Please create one from .env.docker template."
            return 1
        fi
    fi

    # Check critical variables
    local missing=""
    for var in DATABASE_URL JWT_SECRET MONGO_ROOT_USER MONGO_ROOT_PASSWORD; do
        if [ -z "${!var}" ]; then
            missing="$missing $var"
        fi
    done

    if [ -n "$missing" ]; then
        print_warn "Missing environment variables:$missing"
        print_info "Please check your .env file"
    fi

    print_success "Environment validated"
    return 0
}

# Sync environment files
sync_env_files() {
    print_step "Syncing environment files..."

    local master_env="$PROJECT_ROOT/.env"

    if [ ! -f "$master_env" ]; then
        print_error "Master .env file not found!"
        return 1
    fi

    cp "$master_env" "$PROJECT_ROOT/.env.docker"
    cp "$master_env" "$PROJECT_ROOT/.env.production"

    print_success "Environment files synchronized"
    return 0
}

# Wait for containers to be healthy
wait_for_healthy() {
    local compose_cmd="$1"
    local timeout=${2:-120}
    local elapsed=0
    local interval=5

    print_step "Waiting for services to be healthy..."

    while [ $elapsed -lt $timeout ]; do
        sleep $interval
        elapsed=$((elapsed + interval))

        # Check if all containers are running
        local running=$(eval "$compose_cmd ps --format json 2>/dev/null" | grep -c '"State":"running"' || echo 0)

        if [ "$running" -ge 4 ]; then
            print_success "All services are running!"
            return 0
        fi

        echo -n "."
    done

    echo ""
    print_warn "Some services may still be starting. Check with: ./deploy-all.sh status"
    return 0
}

# Show URLs
show_urls() {
    echo ""
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}Services Available:${NC}"
    echo -e "  Frontend:   ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
    echo -e "  Backend:    ${BLUE}http://localhost:${BACKEND_PORT}/api${NC}"
    echo -e "  API Docs:   ${BLUE}http://localhost:${BACKEND_PORT}/api/docs${NC}"
    echo -e "  Health:     ${BLUE}http://localhost:${BACKEND_PORT}/health${NC}"
    echo -e "  MinIO UI:   ${BLUE}http://localhost:${MINIO_CONSOLE_PORT}${NC}"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo ""
}

# =============================================================================
# DEPLOYMENT COMMANDS
# =============================================================================

# Production deployment (GHCR images)
start_production() {
    print_header "Production Deployment (GHCR)"

    check_docker
    validate_environment || exit 1
    sync_env_files

    cd "$PROJECT_ROOT"
    set_deploy_mode "prod"

    print_info "Pulling latest images from GHCR..."
    if ! docker compose -f "$COMPOSE_PROD" pull; then
        print_error "Failed to pull images. Check your network connection."
        exit 1
    fi

    print_info "Starting containers..."
    if ! docker compose -f "$COMPOSE_PROD" up -d; then
        print_error "Failed to start containers."
        exit 1
    fi

    wait_for_healthy "docker compose -f $COMPOSE_PROD"

    show_urls
    show_status
}

# Local build deployment
start_local() {
    print_header "Local Build Deployment"

    check_docker
    validate_environment || exit 1
    sync_env_files

    cd "$PROJECT_ROOT"
    set_deploy_mode "local"

    print_info "Building and starting containers..."
    if ! docker compose -f "$COMPOSE_FILE" up -d --build; then
        print_error "Failed to build/start containers."
        exit 1
    fi

    wait_for_healthy "docker compose -f $COMPOSE_FILE"

    show_urls
    show_status
}

# Development infrastructure only
start_dev() {
    print_header "Development Infrastructure"

    check_docker

    cd "$PROJECT_ROOT"
    set_deploy_mode "dev"

    print_info "Starting infrastructure containers..."
    docker compose -f "$COMPOSE_DEV" up -d

    sleep 5

    echo ""
    print_success "Development infrastructure ready!"
    echo ""
    echo -e "${YELLOW}Services:${NC}"
    echo -e "  MongoDB:     ${BLUE}mongodb://localhost:27017${NC}"
    echo -e "  DragonflyDB: ${BLUE}redis://localhost:6379${NC}"
    echo -e "  MinIO API:   ${BLUE}http://localhost:9000${NC}"
    echo -e "  MinIO UI:    ${BLUE}http://localhost:9001${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  cd backend && npm install && npm run start:dev"
    echo "  cd frontend && npm install && npm run dev"
}

# Stop all services
stop_services() {
    print_header "Stopping Services"

    cd "$PROJECT_ROOT"

    print_info "Stopping containers..."

    # Stop all possible compose configurations
    docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
    docker compose -f "$COMPOSE_PROD" down 2>/dev/null || true
    docker compose -f "$COMPOSE_DEV" down 2>/dev/null || true

    print_success "All services stopped"
}

# Restart services
restart_services() {
    print_header "Restarting Services"

    local mode=$(get_deploy_mode)
    print_info "Current mode: $mode"

    stop_services

    case "$mode" in
        prod) start_production ;;
        dev)  start_dev ;;
        *)    start_local ;;
    esac
}

# Pull latest images
pull_images() {
    print_header "Pulling GHCR Images"

    check_docker

    cd "$PROJECT_ROOT"
    docker compose -f "$COMPOSE_PROD" pull

    print_success "Images pulled successfully!"
    print_info "Run './deploy-all.sh prod' to deploy"
}

# Build images locally
build_images() {
    print_header "Building Images"

    check_docker
    sync_env_files

    cd "$PROJECT_ROOT"
    docker compose -f "$COMPOSE_FILE" build --no-cache --parallel

    print_success "Images built successfully!"
}

# Show service status
show_status() {
    print_step "Service Status:"
    echo ""

    cd "$PROJECT_ROOT"
    local mode=$(get_deploy_mode)
    local cmd=$(get_compose_cmd "$mode")

    eval "$cmd ps"
}

# Show logs
show_logs() {
    cd "$PROJECT_ROOT"
    local mode=$(get_deploy_mode)
    local cmd=$(get_compose_cmd "$mode")
    local service="$2"

    if [ -n "$service" ]; then
        eval "$cmd logs -f --tail=100 $service"
    else
        eval "$cmd logs -f --tail=100"
    fi
}

# Health check
check_health() {
    print_header "Health Check"

    local healthy=0
    local total=5

    # Backend
    if curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1; then
        print_success "Backend (port $BACKEND_PORT) - Healthy"
        ((healthy++))
    else
        print_error "Backend (port $BACKEND_PORT) - Not responding"
    fi

    # Frontend
    if curl -sf "http://localhost:${FRONTEND_PORT}" > /dev/null 2>&1; then
        print_success "Frontend (port $FRONTEND_PORT) - Healthy"
        ((healthy++))
    else
        print_error "Frontend (port $FRONTEND_PORT) - Not responding"
    fi

    # MongoDB
    if docker exec cms-mongodb mongosh --quiet --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        print_success "MongoDB - Healthy"
        ((healthy++))
    else
        print_error "MongoDB - Not responding"
    fi

    # DragonflyDB
    if docker exec cms-dragonfly redis-cli ping 2>&1 | grep -q "PONG"; then
        print_success "DragonflyDB - Healthy"
        ((healthy++))
    else
        print_error "DragonflyDB - Not responding"
    fi

    # MinIO
    if curl -sf "http://localhost:${MINIO_PORT}/minio/health/live" > /dev/null 2>&1; then
        print_success "MinIO (port $MINIO_PORT) - Healthy"
        ((healthy++))
    else
        print_error "MinIO (port $MINIO_PORT) - Not responding"
    fi

    echo ""
    if [ $healthy -eq $total ]; then
        print_success "All $total services are healthy!"
    else
        print_warn "$healthy/$total services healthy"
    fi
}

# Shell access
open_shell() {
    local service="${2:-backend}"

    cd "$PROJECT_ROOT"
    local mode=$(get_deploy_mode)
    local cmd=$(get_compose_cmd "$mode")

    print_info "Opening shell in '$service' container..."
    eval "$cmd exec $service sh"
}

# Clean everything
clean_all() {
    print_header "Cleanup"

    read -p "This will remove ALL containers, volumes, and data. Continue? (y/N) " -n 1 -r
    echo ""

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$PROJECT_ROOT"

        print_info "Stopping all containers..."
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
        docker compose -f "$COMPOSE_PROD" down -v --remove-orphans 2>/dev/null || true
        docker compose -f "$COMPOSE_DEV" down -v --remove-orphans 2>/dev/null || true

        print_info "Cleaning Docker resources..."
        docker image prune -f
        docker volume prune -f

        # Remove state file
        rm -f "$STATE_FILE"

        print_success "Cleanup complete!"
    else
        print_info "Cancelled"
    fi
}

# Stop dev infrastructure
stop_dev() {
    print_header "Stopping Dev Infrastructure"

    cd "$PROJECT_ROOT"
    docker compose -f "$COMPOSE_DEV" down

    print_success "Development infrastructure stopped"
}

# Show help
show_help() {
    print_header "Help"

    echo -e "Usage: $0 [command] [service]"
    echo ""
    echo -e "${YELLOW}DEPLOYMENT:${NC}"
    echo -e "  ${GREEN}prod${NC}        Deploy using GHCR images (recommended for production)"
    echo "  start       Build and deploy from local source code"
    echo "  dev         Start only infrastructure (MongoDB, Redis, MinIO)"
    echo ""
    echo -e "${YELLOW}MANAGEMENT:${NC}"
    echo "  stop        Stop all running services"
    echo "  restart     Restart services (preserves deployment mode)"
    echo "  status      Show container status"
    echo "  logs        View logs (optionally specify service)"
    echo "  health      Check health of all services"
    echo "  shell       Open shell in container (default: backend)"
    echo ""
    echo -e "${YELLOW}MAINTENANCE:${NC}"
    echo "  pull        Pull latest GHCR images"
    echo "  build       Build images locally (no cache)"
    echo "  sync-env    Sync .env files from master"
    echo "  clean       Remove all containers and volumes"
    echo "  dev-stop    Stop dev infrastructure"
    echo ""
    echo -e "${YELLOW}EXAMPLES:${NC}"
    echo "  $0 prod              # Production deployment"
    echo "  $0 start             # Local build deployment"
    echo "  $0 logs backend      # View backend logs"
    echo "  $0 shell mongodb     # MongoDB shell"
    echo "  $0 health            # Check all services"
    echo ""
    echo -e "${MAGENTA}CURRENT MODE: $(get_deploy_mode)${NC}"
}

# =============================================================================
# MAIN
# =============================================================================

case "${1:-help}" in
    prod)     start_production ;;
    start)    start_local ;;
    stop)     stop_services ;;
    restart)  restart_services ;;
    pull)     pull_images ;;
    build)    build_images ;;
    status)   show_status ;;
    logs)     show_logs "$@" ;;
    health)   check_health ;;
    shell)    open_shell "$@" ;;
    dev)      start_dev ;;
    dev-stop) stop_dev ;;
    sync-env) sync_env_files ;;
    clean)    clean_all ;;
    help)     show_help ;;
    *)        show_help ;;
esac
