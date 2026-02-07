# CMS Complete Deployment Guide

A comprehensive guide to deploy the College Management System using Docker.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Project Structure](#3-project-structure)
4. [Quick Start](#4-quick-start)
5. [Environment Configuration](#5-environment-configuration)
6. [Deployment Options](#6-deployment-options)
7. [Production VPS Deployment](#7-production-vps-deployment)
8. [SSL Certificate Setup](#8-ssl-certificate-setup)
9. [CI/CD with GitHub Actions](#9-cicd-with-github-actions)
10. [Maintenance & Operations](#10-maintenance--operations)
11. [Database Management](#11-database-management)
12. [Backup & Restore](#12-backup--restore)
13. [Monitoring & Health Checks](#13-monitoring--health-checks)
14. [Troubleshooting](#14-troubleshooting)
15. [Security Checklist](#15-security-checklist)

---

## 1. Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
│                                  │                                       │
│                                  ▼                                       │
│                        ┌─────────────────┐                              │
│                        │      Nginx      │                              │
│                        │  Reverse Proxy  │ Port 80/443                  │
│                        │  SSL + Caching  │                              │
│                        └────────┬────────┘                              │
│                                 │                                        │
│         ┌───────────────────────┼───────────────────────┐               │
│         │                       │                       │                │
│         ▼                       ▼                       ▼                │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐          │
│  │  Frontend   │        │   Backend   │        │    MinIO    │          │
│  │   React     │        │   NestJS    │        │  S3 Storage │          │
│  │   Nginx     │        │  PM2 Cluster│        │             │          │
│  │   :80       │        │    :8000    │        │  :9000/9001 │          │
│  └─────────────┘        └──────┬──────┘        └─────────────┘          │
│                                │                                         │
│                    ┌───────────┴───────────┐                            │
│                    │                       │                             │
│                    ▼                       ▼                             │
│           ┌─────────────┐         ┌─────────────┐                       │
│           │   MongoDB   │         │ DragonflyDB │                       │
│           │   8.0 LTS   │         │   (Redis)   │                       │
│           │   :27017    │         │    :6379    │                       │
│           └─────────────┘         └─────────────┘                       │
│                                                                          │
│                         Docker Network (cms-network)                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Frontend | React 19 + Vite + Tailwind | Latest |
| Backend | NestJS + Prisma | Latest |
| Database | MongoDB | 8.0 LTS |
| Cache | DragonflyDB (Redis-compatible) | v1.24.0 |
| Storage | MinIO (S3-compatible) | Latest |
| Process Manager | PM2 | Latest |
| Web Server | Nginx | 1.27-alpine |
| Container | Docker + Docker Compose | Latest |

### Docker Images

| Service | Image | Source |
|---------|-------|--------|
| Frontend | `ghcr.io/nikhil2247/cms-new/frontend` | GitHub Container Registry |
| Backend | `ghcr.io/nikhil2247/cms-new/backend` | GitHub Container Registry |
| MongoDB | `mongo:8.0` | Docker Hub |
| DragonflyDB | `docker.dragonflydb.io/dragonflydb/dragonfly:v1.24.0` | Docker Hub |
| MinIO | `minio/minio:latest` | Docker Hub |

### Production compose specifics

To make deployment and troubleshooting easier, here are the exact details used by `docker-compose.prod.yml` in this repository.

| Service | Container name | Host ports | Volumes (inside Compose) | Healthcheck |
|--------:|:---------------:|:----------:|:------------------------:|:----------- |
| Frontend | `cms-frontend` | `5173:80` | (no persistent volumes) | `wget --spider http://127.0.0.1:80/health` |
| Backend | `cms-backend` | `8000:8000` | `backend-uploads:/app/uploads`, `backend-logs:/app/logs` | `wget --spider http://127.0.0.1:8000/health` |
| MongoDB | `cms-mongodb` | `27017:27017` | `mongodb-data:/data/db`, `mongodb-config:/data/configdb` | `mongosh --quiet ... "db.adminCommand('ping')"` |
| Dragonfly | `cms-dragonfly` | `6379:6379` | `dragonfly-data:/data` | `redis-cli ping` |
| MinIO | `cms-minio` | `9000:9000` (API), `9001:9001` (console) | `minio-data:/data` | `curl -f http://localhost:9000/minio/health/live` |
| MinIO Init | `cms-minio-init` | (no host port) | (no persistent volumes) | runs once to create bucket on startup |

**Network and volumes**

- Docker network name: `cms-prod-network` (Compose uses `cms-network` with driver bridge and `name: cms-prod-network`).
- Named volumes (created by Compose):
  - `cms-prod-mongodb-data` (mounted as `mongodb-data`)
  - `cms-prod-mongodb-config` (mounted as `mongodb-config`)
  - `cms-prod-dragonfly-data` (mounted as `dragonfly-data`)
  - `cms-prod-minio-data` (mounted as `minio-data`)
  - `cms-prod-backend-uploads` (mounted as `backend-uploads`)
  - `cms-prod-backend-logs` (mounted as `backend-logs`)

**Important notes**

- The backend image runs as user `appuser` inside the container and depends on `mongodb`, `dragonfly`, and the `minio-init` job for startup ordering & readiness.
- Healthchecks are defined for each service and used by Compose `depends_on` conditions; this helps the backend wait for DB/cache availability.
- The frontend is served by an internal Nginx at container port `80` and is exposed on host port `5173` by default in the production compose file.

---

## 2. Prerequisites

### For Local Development

- **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux)
- **Git**
- **Node.js 20+** (optional, for running without Docker)

### For Production VPS

- **Ubuntu 22.04+** or **Debian 12+**
- **2+ vCPU, 4+ GB RAM, 40+ GB SSD**
- **Domain name** pointed to your server IP
- **SSH access** to the server

### Verify Docker Installation

```bash
# Check Docker
docker --version
# Expected: Docker version 24.x or higher

# Check Docker Compose
docker compose version
# Expected: Docker Compose version v2.x
```

---

## 3. Project Structure

```
cms-new/
├── backend/
│   ├── Dockerfile              # Backend Docker image
│   ├── ecosystem.config.js     # PM2 cluster configuration
│   ├── prisma/                 # Database schema
│   ├── src/                    # NestJS source code
│   ├── .env                    # Development config (gitignored)
│   └── .env.example            # Development template
│
├── frontend/
│   ├── Dockerfile              # Frontend Docker image
│   ├── nginx.conf              # Frontend Nginx config
│   ├── src/                    # React source code
│   ├── .env                    # Development config (gitignored)
│   └── .env.example            # Development template
│
├── nginx/                      # Reverse proxy configuration
│   ├── nginx.conf              # Main Nginx config
│   ├── conf.d/                 # Site configuration
│   ├── snippets/               # Location blocks
│   └── ssl/                    # SSL certificates
│
├── docker/
│   ├── mongo-init.js           # MongoDB initialization
│   └── seed-data.js            # Database seeding script
│
├── scripts/
│   ├── deploy-all.ps1          # Windows deployment script
│   ├── deploy-all.sh           # Linux/Mac deployment script
│   ├── setup-vps.sh            # VPS automated setup
│   └── setup-ssl.sh            # SSL certificate setup
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions CI/CD
│
├── docker-compose.yml          # Local build deployment
├── docker-compose.dev.yml      # Development infrastructure only
├── docker-compose.prod.yml     # Production with GHCR images
│
├── .env                        # Master config (gitignored)
├── .env.docker                 # Docker deployment template
├── .env.production             # Production template
│
└── DEPLOYMENT_GUIDE.md         # This file
```

### Environment Files

| File | Purpose | Used By |
|------|---------|---------|
| `.env` | **Master configuration** (single source of truth) | All Docker deployments |
| `.env.docker` | Docker template (synced from .env) | Template only |
| `.env.production` | Production template (synced from .env) | Template only |
| `backend/.env` | Local backend development | `npm run start:dev` |
| `frontend/.env` | Local frontend development | `npm run dev` |

---

## 4. Quick Start

### One-Command Deployment

**Windows (PowerShell):**
```powershell
# Production deployment (uses GHCR pre-built images)
.\scripts\deploy-all.ps1 prod

# Or build from source locally
.\scripts\deploy-all.ps1 start
```

**Linux/Mac:**
```bash
# Production deployment (uses GHCR pre-built images)
./scripts/deploy-all.sh prod

# Or build from source locally
./scripts/deploy-all.sh start
```

### All Available Commands

| Command | Description |
|---------|-------------|
| `prod` | Deploy using GHCR images (recommended for production) |
| `start` | Build and start from local source code |
| `stop` | Stop all services |
| `restart` | Restart all services |
| `pull` | Pull latest GHCR images |
| `build` | Build images locally (no cache) |
| `status` | Show service status |
| `logs [service]` | View logs (optionally for specific service) |
| `health` | Check all service health |
| `shell [service]` | Open shell in container (default: backend) |
| `dev` | Start development infrastructure only |
| `dev-stop` | Stop development infrastructure |
| `sync-env` | Sync all .env files from master |
| `clean` | Remove all containers and volumes |

### Quick Access URLs (After Deployment)

| Service | Local URL | Production URL |
|---------|-----------|----------------|
| Frontend | http://localhost:80 | https://your-domain.com |
| Backend API | http://localhost:8000/api | https://your-domain.com/api |
| API Docs | http://localhost:8000/api/docs | https://your-domain.com/api/docs |
| Health Check | http://localhost:8000/health | https://your-domain.com/health |
| MinIO Console | http://localhost:9001 | Internal only |

---

## 5. Environment Configuration

### Master Environment File (`.env`)

The root `.env` file is the **single source of truth** for all configuration. When you run `deploy-all.ps1 prod` or `deploy-all.sh prod`, it automatically syncs this to other env files.

```env
# =============================================================================
# CMS - Master Environment Configuration
# =============================================================================

# --- Core Configuration ---
NODE_ENV=production
PORT=8000
BACKEND_PORT=8000
VERSION=latest

# --- Frontend Configuration ---
VITE_API_BASE_URL=https://api.sukeerat.com
VITE_APP_NAME="CMS Portal"
VITE_APP_ENV=production
FRONTEND_URL=http://localhost:5173

# --- CORS Configuration ---
ALLOWED_ORIGINS=http://localhost:5173,https://placeintern.com,https://sukeerat.com
CORS_ORIGIN=http://localhost:5173

# --- Database Configuration (MongoDB) ---
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=Admin@1234
MONGO_DATABASE=cms_db
DATABASE_URL=mongodb://admin:Admin@1234@mongodb:27017/cms_db?authSource=admin

# --- Cache Configuration (DragonflyDB) ---
REDIS_URL=redis://dragonfly:6379
REDIS_HOST=dragonfly
REDIS_PORT=6379

# --- JWT Configuration ---
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRATION=30m
JWT_REFRESH_EXPIRATION=7d

# --- MinIO (S3-compatible Storage) ---
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
AWS_S3_BUCKET=cms-uploads
AWS_REGION=us-east-1
AWS_S3_ENDPOINT=http://minio:9000
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=cms-uploads
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# --- Rate Limiting ---
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# --- Logging ---
LOG_LEVEL=warn

# --- PM2 Configuration ---
PM2_INSTANCES=max

# --- Email Configuration ---
MAIL_USER=your-email@gmail.com
MAIL_PASS=your-app-password

# --- Google OAuth ---
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/redirect

# --- Port Configuration (Docker) ---
FRONTEND_PORT=80
MONGODB_PORT=27017
DRAGONFLY_PORT=6379
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
```

### Generate Secure Passwords

```bash
# Generate JWT secret (64 characters)
openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64

# Generate database password (32 characters)
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32

# Generate MinIO password (32 characters)
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32
```

---

## 6. Deployment Options

### Option A: Production Deployment (GHCR Images) - Recommended

Uses pre-built images from GitHub Container Registry. Fastest deployment method.

```powershell
# Windows
.\scripts\deploy-all.ps1 prod

# Linux/Mac
./scripts/deploy-all.sh prod
```

**What happens:**
1. Syncs environment files from master `.env`
2. Pulls latest images from `ghcr.io/nikhil2247/cms-new/`
3. Starts all containers
4. Displays service URLs

### Option B: Local Build Deployment

Builds images from local source code. Use when you've made code changes.

```powershell
# Windows
.\scripts\deploy-all.ps1 start

# Linux/Mac
./scripts/deploy-all.sh start
```

**What happens:**
1. Syncs environment files
2. Builds Docker images from `./backend` and `./frontend`
3. Starts all containers

### Option C: Development Mode

Starts only infrastructure services (MongoDB, DragonflyDB, MinIO). Run frontend and backend locally with hot-reload.

```powershell
# Windows
.\scripts\deploy-all.ps1 dev

# Linux/Mac
./scripts/deploy-all.sh dev
```

**Then run locally:**
```bash
# Terminal 1 - Backend
cd backend
npm install
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

---

## 7. Production VPS Deployment

### Step 1: Prepare Your Domain

1. Purchase a domain (e.g., `cms.example.com`)
2. Create DNS A records:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |
| A | api | YOUR_SERVER_IP |

3. Wait 5-10 minutes for DNS propagation

### Step 2: Connect to VPS

```bash
ssh root@YOUR_SERVER_IP
```

### Step 3: Run Automated Setup

```bash
# Clone repository
git clone https://github.com/nikhil2247/cms-new.git /opt/cms
cd /opt/cms

# Make scripts executable
chmod +x scripts/*.sh

# Run VPS setup (installs Docker, configures firewall, etc.)
./scripts/setup-vps.sh cms.example.com admin@example.com
```

### Step 4: Configure Environment

```bash
# Edit the master .env file
nano /opt/cms/.env

# Update these values:
# - DOMAIN
# - JWT_SECRET (generate secure one)
# - MONGO_ROOT_PASSWORD
# - MINIO_ROOT_PASSWORD
# - ALLOWED_ORIGINS
# - FRONTEND_URL
# - CORS_ORIGIN
# - GOOGLE_CLIENT_ID (if using OAuth)
# - MAIL_USER/MAIL_PASS (if using email)
```

### Step 5: Deploy

```bash
cd /opt/cms
./scripts/deploy-all.sh prod
```

### Step 6: Setup SSL

```bash
./scripts/setup-ssl.sh cms.example.com admin@example.com
```

### Step 7: Verify

```bash
# Check container status
docker compose -f docker-compose.prod.yml ps

# Check health
curl https://cms.example.com/health

# View logs
./scripts/deploy-all.sh logs
```

---

## 8. SSL Certificate Setup

### Automatic Setup

SSL is configured automatically when you run `setup-vps.sh` with a domain.

### Manual SSL Setup

```bash
cd /opt/cms
chmod +x scripts/setup-ssl.sh
./scripts/setup-ssl.sh your-domain.com your-email@example.com
```

### Renew Certificate

```bash
# Automatic renewal is configured via cron
# Manual renewal:
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

### Check Certificate Status

```bash
docker compose -f docker-compose.prod.yml run --rm certbot certificates
```

---

## 9. CI/CD with GitHub Actions

### Setup GitHub Actions

#### Step 1: Add Repository Secrets

Go to: Repository → Settings → Secrets and variables → Actions

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | VPS IP address |
| `DEPLOY_USER` | SSH username (usually `root`) |
| `DEPLOY_SSH_KEY` | Private SSH key (PEM format) |
| `DEPLOY_PORT` | SSH port (default: `22`) |
| `GHCR_TOKEN` | GitHub token for container registry |

#### Step 2: Generate SSH Key

```bash
# On local machine
ssh-keygen -t ed25519 -C "github-actions" -f github-actions-key

# Copy public key to server
ssh-copy-id -i github-actions-key.pub root@YOUR_SERVER_IP

# Add private key content to DEPLOY_SSH_KEY secret
cat github-actions-key
```

### Workflow Triggers

| Trigger | Action |
|---------|--------|
| Push to `main` | Build, push to GHCR, deploy to production |
| Push to `develop` | Build and test only |
| Pull Request | Run tests |
| Manual dispatch | Deploy to selected environment |

---

## 10. Maintenance & Operations

### Service Management

```bash
# Using deploy script
./scripts/deploy-all.sh status      # View status
./scripts/deploy-all.sh logs        # View all logs
./scripts/deploy-all.sh logs backend # View backend logs
./scripts/deploy-all.sh health      # Health check
./scripts/deploy-all.sh restart     # Restart all
./scripts/deploy-all.sh stop        # Stop all

# Direct Docker commands
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml restart backend
docker stats
```

### Update Application

```bash
cd /opt/cms

# Pull latest images from GHCR
./scripts/deploy-all.sh pull

# Redeploy
./scripts/deploy-all.sh prod

# Or if building from source
git pull origin main
./scripts/deploy-all.sh start
```

### PM2 Management (Inside Backend Container)

```bash
# Enter backend container
docker exec -it cms-backend sh

# View PM2 status
pm2 status

# View PM2 logs
pm2 logs

# Restart PM2 processes
pm2 restart all

# Exit container
exit
```

### Database Access

```bash
# MongoDB shell
docker exec -it cms-mongodb mongosh -u admin -p YOUR_PASSWORD

# Common commands
use cms_db
db.User.find().limit(5)
db.stats()

# Redis CLI
docker exec -it cms-dragonfly redis-cli
ping
keys *
```

---

## 11. Database Management

### Database Seeding (Development Only)

```bash
# Run seed script
docker compose exec -T mongodb mongosh -u admin -p Admin@1234 --authenticationDatabase admin < docker/seed-data.js

# Verify
docker compose exec -T mongodb mongosh -u admin -p Admin@1234 --authenticationDatabase admin --eval "
db = db.getSiblingDB('cms_db');
print('Users: ' + db.User.countDocuments());
print('Students: ' + db.Student.countDocuments());
print('Institutions: ' + db.Institution.countDocuments());
"
```

### Test Login Credentials (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| System Admin | `nikhil97798@gmail.com` | `@Nikhil123kumar` |
| State Directorate | `dtepunjab.internship@gmail.com` | `Dtepunjab@directorate` |
| Principal | `principal@gpludhiana.edu.in` | `password@1234` |
| TPO | `tpo@gpludhiana.edu.in` | `password@1234` |
| Student | Any roll number + `@student.com` | `password@1234` |

### Collection Names (Prisma uses PascalCase)

| Prisma Model | MongoDB Collection |
|--------------|-------------------|
| User | `User` |
| Student | `Student` |
| Institution | `Institution` |
| Branch | `Branch` |

---

## 12. Backup & Restore

### Automated Backups

Configured by setup script:
- Runs daily at 2 AM
- Stored in `/opt/cms/backups/`
- Keeps last 7 days

### Manual Backup

```bash
cd /opt/cms
mkdir -p backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MongoDB
docker exec cms-mongodb mongodump \
  --out /data/backup \
  --authenticationDatabase admin \
  -u admin \
  -p YOUR_MONGO_PASSWORD

# Copy to host
docker cp cms-mongodb:/data/backup ./backups/mongodb_$DATE

# Compress
tar -czf backups/backup_$DATE.tar.gz -C backups mongodb_$DATE
rm -rf backups/mongodb_$DATE

echo "Backup saved: backups/backup_$DATE.tar.gz"
```

### Restore Database

```bash
cd /opt/cms
DATE=20241224_020000  # Replace with your backup date

# Extract
tar -xzf backups/backup_$DATE.tar.gz -C backups/

# Stop backend
docker compose -f docker-compose.prod.yml stop backend

# Copy to container
docker cp backups/mongodb_$DATE cms-mongodb:/data/restore

# Restore
docker exec cms-mongodb mongorestore \
  /data/restore \
  --authenticationDatabase admin \
  -u admin \
  -p YOUR_MONGO_PASSWORD \
  --drop

# Start backend
docker compose -f docker-compose.prod.yml start backend

# Clean up
rm -rf backups/mongodb_$DATE
```

---

## 13. Monitoring & Health Checks

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Basic health check |
| `/health/db` | Database health |
| `/health/redis` | Redis health |
| `/health/detailed` | Full system health |
| `/health/ready` | Readiness probe |
| `/health/live` | Liveness probe |

### Check System Health

```bash
# Using deploy script
./scripts/deploy-all.sh health

# Manual
curl -s http://localhost:8000/health | jq

# Detailed
curl -s http://localhost:8000/health/detailed | jq
```

### Monitor Resources

```bash
# Docker stats
docker stats

# Disk usage
df -h
docker system df

# Memory
free -h

# CPU
uptime
```

---

## 14. Troubleshooting

### Container Won't Start

```bash
# Check logs
./scripts/deploy-all.sh logs backend

# Check ports
netstat -tlnp | grep -E '80|8000|27017|6379|9000'

# Restart Docker
systemctl restart docker

# Rebuild
./scripts/deploy-all.sh clean
./scripts/deploy-all.sh prod
```

### Database Connection Failed

```bash
# Check MongoDB logs
docker logs cms-mongodb --tail=50

# Test connection
docker exec cms-mongodb mongosh --eval "db.adminCommand('ping')"

# Restart MongoDB
docker compose -f docker-compose.prod.yml restart mongodb
```

### Backend Health Check Failing

```bash
# Check logs
docker logs cms-backend --tail=100

# Check PM2 inside container
docker exec cms-backend pm2 status
docker exec cms-backend pm2 logs

# Restart
docker compose -f docker-compose.prod.yml restart backend
```

### Out of Disk Space

```bash
# Check usage
df -h

# Clean Docker
docker system prune -a --volumes

# Remove old backups
find /opt/cms/backups -name "*.tar.gz" -mtime +7 -delete
```

### Reset Everything

```bash
cd /opt/cms
./scripts/deploy-all.sh clean

# Fresh start
./scripts/deploy-all.sh prod
```

---

## 15. Security Checklist

### Before Going Live

- [ ] Changed `JWT_SECRET` to secure random string (64+ characters)
- [ ] Changed `MONGO_ROOT_PASSWORD` to strong password
- [ ] Changed `MINIO_ROOT_PASSWORD` to strong password
- [ ] SSL certificate installed and working
- [ ] HTTP redirects to HTTPS
- [ ] Firewall enabled (ports 22, 80, 443 only)
- [ ] Fail2Ban running
- [ ] `NODE_ENV=production` set
- [ ] CORS configured for your domain only
- [ ] Rate limiting enabled
- [ ] Backups configured and tested
- [ ] `.env` file permissions set to 600

### Verify Security

```bash
# Check firewall
ufw status

# Check Fail2Ban
fail2ban-client status

# Check open ports
netstat -tlnp

# Check file permissions
ls -la /opt/cms/.env
# Should show: -rw------- (600)
```

---

## Quick Reference

### Deploy Commands

```bash
# Production (GHCR images) - Recommended
./scripts/deploy-all.sh prod

# Build from source
./scripts/deploy-all.sh start

# Development infrastructure
./scripts/deploy-all.sh dev

# Stop
./scripts/deploy-all.sh stop

# Logs
./scripts/deploy-all.sh logs

# Health
./scripts/deploy-all.sh health

# Clean everything
./scripts/deploy-all.sh clean
```

### Important Paths

| Path | Description |
|------|-------------|
| `/opt/cms` | Application root (production) |
| `/opt/cms/.env` | Master environment configuration |
| `/opt/cms/backups` | Backup files |
| `/opt/cms/scripts` | Deployment scripts |

### Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local build deployment |
| `docker-compose.dev.yml` | Development infrastructure only |
| `docker-compose.prod.yml` | Production with GHCR images |

---

## Support

If you encounter issues:

1. Check logs: `./scripts/deploy-all.sh logs`
2. Check health: `./scripts/deploy-all.sh health`
3. Verify environment: `cat .env`
4. Check container status: `./scripts/deploy-all.sh status`
5. Review this guide's troubleshooting section
6. Check GitHub Issues for known problems
