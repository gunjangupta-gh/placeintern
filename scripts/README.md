# Database Backup & Restore Guide

This guide explains how to restore a PostgreSQL backup dump to your local Docker database and export the data to Excel.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Restoring PostgreSQL Backup](#restoring-postgresql-backup)
3. [Connecting with pgAdmin](#connecting-with-pgadmin)
4. [Exporting to Excel](#exporting-to-excel)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Install Docker Desktop

Download and install Docker Desktop from: https://www.docker.com/products/docker-desktop/

After installation:
- Start Docker Desktop
- Wait for it to fully initialize (whale icon in system tray stops animating)
- Verify installation:
  ```bash
  docker --version
  ```

### 2. Start PostgreSQL Container

```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

Verify the container is running:
```bash
docker ps --filter "name=postgres"
```

Expected output:
```
NAMES                STATUS                   PORTS
cms-postgres-dev     Up X minutes (healthy)   0.0.0.0:5432->5432/tcp
```

### 3. Install Node.js Dependencies (for Excel export)

```bash
npm install exceljs pg
```

---

## Restoring PostgreSQL Backup

### Method 1: Using PowerShell Script (Recommended)

```powershell
.\scripts\restore-pg-backup.ps1
```

This interactive script will:
1. List available backup files in `.\backups\`
2. Let you select which backup to restore
3. Confirm before proceeding
4. Automatically restore the database

**Or specify a backup file directly:**
```powershell
.\scripts\restore-pg-backup.ps1 .\backups\latest.dump
```

### Method 2: Using Batch Script

```batch
.\scripts\restore-pg-backup.bat
```

### Method 3: Manual Steps

#### Step 1: Copy Backup File to Container

```bash
docker cp ".\backups\latest.dump" cms-postgres-dev:/tmp/backup.dump
```

#### Step 2: Verify File Was Copied

```bash
docker exec cms-postgres-dev sh -c "ls -la /tmp/backup.dump"
```

#### Step 3: Create Target Database

```bash
# Connect to PostgreSQL and create database
docker exec cms-postgres-dev sh -c "psql -U postgres -c 'CREATE DATABASE placeintern_db;'"
```

If database already exists and you want to recreate it:
```bash
# Terminate existing connections
docker exec cms-postgres-dev sh -c "psql -U postgres -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'placeintern_db' AND pid <> pg_backend_pid();\""

# Drop and recreate
docker exec cms-postgres-dev sh -c "psql -U postgres -c 'DROP DATABASE IF EXISTS placeintern_db;'"
docker exec cms-postgres-dev sh -c "psql -U postgres -c 'CREATE DATABASE placeintern_db;'"
```

#### Step 4: Restore the Backup

```bash
docker exec cms-postgres-dev sh -c "pg_restore -U postgres -d placeintern_db --no-owner --no-privileges /tmp/backup.dump"
```

**Flags explained:**
| Flag | Description |
|------|-------------|
| `-U postgres` | Connect as user "postgres" |
| `-d placeintern_db` | Target database name |
| `--no-owner` | Don't set ownership (uses current user) |
| `--no-privileges` | Skip privilege restoration |

#### Step 5: Verify Restoration

```bash
# List all tables
docker exec cms-postgres-dev sh -c "psql -U postgres -d placeintern_db -c '\dt'"

# Check row counts
docker exec cms-postgres-dev sh -c "psql -U postgres -d placeintern_db -c 'SELECT COUNT(*) FROM donations;'"
```

#### Step 6: Clean Up

```bash
docker exec cms-postgres-dev sh -c "rm -f /tmp/backup.dump"
```

---

## Connecting with pgAdmin

### Connection Settings

| Field | Value |
|-------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `placeintern_db` |
| **Username** | `postgres` |
| **Password** | `postgres123` |

### Steps in pgAdmin

1. Open pgAdmin
2. Right-click **"Servers"** → **"Register"** → **"Server"**
3. **General tab:**
   - Name: `PlaceIntern Local`
4. **Connection tab:**
   - Host: `localhost`
   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: `postgres`
   - Password: `postgres123`
   - Check "Save password"
5. Click **"Save"**

### If Password Authentication Fails

Reset the password:
```bash
docker exec cms-postgres-dev sh -c "psql -U postgres -c \"ALTER USER postgres WITH PASSWORD 'postgres123';\""
```

---

## Exporting to Excel

### Using the Export Script

```bash
node scripts/export-db-to-excel.js
```

**Output:** `.\backups\placeintern_db_YYYY-MM-DDTHH-MM-SS.xlsx`

### What the Script Does

1. **Connects to Database**
   ```
   postgresql://postgres:postgres123@localhost:5432/placeintern_db
   ```

2. **Retrieves All Tables**
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   ```

3. **For Each Table:**
   - Creates a new worksheet (sheet) with the table name
   - Fetches all rows: `SELECT * FROM "table_name"`
   - Adds bold headers with gray background
   - Converts data types for Excel compatibility:
     - `NULL` → empty string
     - Objects/Arrays → JSON string
     - **`*_cents` columns → divided by 100** (e.g., 5000 → 50.00)
   - Applies currency formatting (`#,##0.00`) to amount columns
   - Adds auto-filter to headers

4. **Saves the Excel File**

### Data Transformations

| Original Column | Excel Column | Transformation |
|-----------------|--------------|----------------|
| `amount_cents` | `amount` | Value ÷ 100 |
| `amount_exchange_value_cents` | `amount_exchange_value` | Value ÷ 100 |
| `created_at` (timestamp) | `created_at` | Preserved as date |
| `JSON/Object fields` | Same | Converted to JSON string |
| `NULL` values | Same | Empty cell |

### Excel File Structure

```
placeintern_db_2026-05-07T06-36-41.xlsx
├── addresses (58,715 rows)
├── ar_internal_metadata (1 row)
├── campaigns (3,331 rows)
├── donations (64,367 rows)
├── redactor2_assets (3,191 rows)
├── schema_migrations (45 rows)
└── users (3,933 rows)
```

### Customizing the Export

Edit `scripts/export-db-to-excel.js` to:

**Change database connection:**
```javascript
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'your_database_name',
  user: 'postgres',
  password: 'your_password',
};
```

**Export specific tables only:**
```javascript
const tables = ['donations', 'users']; // Instead of fetching all
```

**Change output path:**
```javascript
const outputPath = path.join(__dirname, '..', 'exports', `myexport.xlsx`);
```

---

## Troubleshooting

### Docker Issues

**"Docker is not recognized"**
- Ensure Docker Desktop is installed and running
- Open a new terminal after installation
- Add Docker to PATH if needed

**"Container not running"**
```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

**"Database does not exist"**
```bash
docker exec cms-postgres-dev sh -c "psql -U postgres -c 'CREATE DATABASE placeintern_db;'"
```

### Path Issues on Windows

If you see paths like `C:/Users/...` when running commands inside Docker, use `sh -c`:
```bash
# Wrong (path translation issue)
docker exec cms-postgres-dev ls /tmp/

# Correct
docker exec cms-postgres-dev sh -c "ls /tmp/"
```

### pg_restore Errors

**"pg_restore: error: input file does not appear to be a valid archive"**
- The backup might be in plain SQL format instead of custom format
- Use `psql` instead:
  ```bash
  docker exec cms-postgres-dev sh -c "psql -U postgres -d placeintern_db < /tmp/backup.sql"
  ```

**"role does not exist"**
- Add `--no-owner` flag to skip ownership restoration

**"permission denied"**
- Add `--no-privileges` flag to skip privilege restoration

### Excel Export Issues

**"Cannot find module 'pg'"**
```bash
npm install exceljs pg
```

**"Connection refused"**
- Ensure PostgreSQL container is running
- Check the port mapping (should be 5432:5432)

---

## Quick Reference

### Common Commands

```bash
# Start PostgreSQL container
docker compose -f docker-compose.dev.yml up -d postgres

# Connect to database CLI
docker exec -it cms-postgres-dev psql -U postgres -d placeintern_db

# List databases
docker exec cms-postgres-dev sh -c "psql -U postgres -c '\l'"

# List tables
docker exec cms-postgres-dev sh -c "psql -U postgres -d placeintern_db -c '\dt'"

# Restore backup
.\scripts\restore-pg-backup.ps1

# Export to Excel
node scripts/export-db-to-excel.js
```

### File Locations

| File | Purpose |
|------|---------|
| `backups/*.dump` | PostgreSQL backup files |
| `backups/*.xlsx` | Exported Excel files |
| `scripts/restore-pg-backup.ps1` | PowerShell restore script |
| `scripts/restore-pg-backup.bat` | Batch restore script |
| `scripts/export-db-to-excel.js` | Excel export script |
