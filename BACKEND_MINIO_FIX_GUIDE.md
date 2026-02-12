# Backend MinIO Public Endpoint Fix

## Problem

Your backend was generating presigned URLs with `localhost:9000` because it only had one MinIO endpoint configuration. The backend needs:

1. **Internal endpoint** (`http://minio:9000`) - for backend-to-MinIO communication (Docker network)
2. **Public endpoint** (`https://files.placeintern.com`) - for client-facing presigned URLs

## Solution Implemented

### Code Changes

✅ **FileStorageService** - Added `MINIO_PUBLIC_ENDPOINT` support
- Now generates presigned URLs with the public endpoint
- Automatically replaces internal endpoint with public one in URLs

✅ **Environment Configuration** - Added `MINIO_PUBLIC_ENDPOINT` variable
- `.env` files updated
- Docker compose files updated

### Files Modified

1. `backend/src/infrastructure/file-storage/file-storage.service.ts` - Added public endpoint logic
2. `backend/.env.example` - Added MINIO_PUBLIC_ENDPOINT
3. `.env` (root) - Added MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com
4. `docker-compose.yml` - Added env var
5. `docker-compose.prod.yml` - Added env var
6. `docker-compose.app.yml` - Added env var

## Deployment Steps

### For VPS Deployment (PM2)

1. **SSH into your server:**
```bash
ssh your-vps
```

2. **Update backend .env file:**
```bash
cd /root/placeintern/placeintern/backend

# Add this line to your .env file:
nano .env
```

Add or update these lines in the `.env` file:
```bash
# Internal endpoint (Docker network or localhost)
MINIO_ENDPOINT=http://localhost:9000

# Public endpoint for client-facing URLs
MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com

# Other MinIO config
MINIO_BUCKET=placeintern-uploads
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_REGION=us-east-1
```

3. **Now deploy via GitHub Actions:**
```bash
# On your local machine, commit and push
git add .
git commit -m "Add backend MinIO public endpoint support"
git push origin main

# GitHub Actions will automatically:
# - Pull code on VPS
# - Install deps
# - Generate Prisma client
# - Build backend
# - Reload PM2
```

4. **Or deploy manually on server:**
```bash
cd /root/placeintern/placeintern/backend

# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Build
npm run build

# Reload PM2
pm2 reload backend

# Check logs
pm2 logs backend --lines 50
```

### For Docker Deployment

1. **Ensure environment variables are set:**

In your root `.env` file (already updated):
```bash
MINIO_ENDPOINT=http://minio:9000
MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com
MINIO_BUCKET=placeintern-uploads
```

2. **Rebuild and restart backend:**
```bash
docker compose build backend
docker compose up -d backend

# Or if using prod compose:
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d backend
```

## Verification

### 1. Check Backend Logs
```bash
# PM2
pm2 logs backend --lines 100

# Docker
docker logs cms-backend --tail 100
```

Look for:
```
MinIO Storage Service - Initializing...
Endpoint: http://localhost:9000  (or http://minio:9000)
Bucket: placeintern-uploads
```

### 2. Test Presigned URL Generation

Open your app and check any document/image URL in the browser DevTools:

**Before fix:**
```
http://localhost:9000/placeintern-uploads/...?X-Amz-Algorithm=...
```

**After fix:**
```
https://files.placeintern.com/placeintern-uploads/...?X-Amz-Algorithm=...
```

### 3. API Test

You can also test directly:
```bash
# Get a presigned URL from your API
curl -X GET "https://api.placeintern.com/api/shared/documents/presigned-url?url=https://files.placeintern.com/placeintern-uploads/test.jpg" \
  -H "Authorization: Bearer YOUR_TOKEN"

# The returned URL should start with https://files.placeintern.com
```

## How It Works

### Before (❌)

```typescript
// Backend only knew about internal endpoint
MINIO_ENDPOINT=http://minio:9000

// Generated presigned URL:
http://minio:9000/bucket/file.jpg?signature=...
// ❌ Clients can't access this!
```

### After (✅)

```typescript
// Backend knows both endpoints
MINIO_ENDPOINT=http://minio:9000              // Internal use
MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com  // Client URLs

// Generated presigned URL:
https://files.placeintern.com/bucket/file.jpg?signature=...
// ✅ Clients can access this!
```

### Code Flow

1. Backend connects to MinIO using `MINIO_ENDPOINT` (internal)
2. When generating presigned URL, AWS SDK creates URL with `MINIO_ENDPOINT`
3. Our code replaces `MINIO_ENDPOINT` with `MINIO_PUBLIC_ENDPOINT`
4. Client receives URL with public endpoint

```typescript
// In file-storage.service.ts
async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
  const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
  
  // 🔧 Magic happens here!
  if (this.publicEndpoint !== this.endpoint) {
    return presignedUrl.replace(this.endpoint, this.publicEndpoint);
  }
  return presignedUrl;
}
```

## Troubleshooting

### Still seeing localhost:9000?

1. **Check if env var is set:**
```bash
# PM2
pm2 env backend | grep MINIO

# Docker
docker exec cms-backend env | grep MINIO
```

2. **Verify backend was rebuilt:**
```bash
# PM2
pm2 list
pm2 describe backend | grep restart

# Docker
docker ps | grep backend
docker inspect cms-backend | grep -A 5 MINIO
```

3. **Clear any caches:**
```bash
# Frontend cache
rm -rf frontend/dist
cd frontend && npm run build

# Backend cache (if exists)
pm2 flush backend
```

4. **Check MinIO is accessible publicly:**
```bash
curl -I https://files.placeintern.com/placeintern-uploads/
# Should return 403 or list of files, not connection error
```

### MinIO CORS Issues?

If MinIO blocks requests, you need to configure CORS on MinIO:

```bash
# Install MinIO Client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

# Configure alias
./mc alias set myminio https://files.placeintern.com minioadmin minioadmin123

# Set CORS policy
./mc anonymous set-json bucket-policy.json myminio/placeintern-uploads
```

`bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::placeintern-uploads/*"]
    }
  ]
}
```

## Summary

✅ Backend now supports separate internal and public MinIO endpoints
✅ Presigned URLs will use `https://files.placeintern.com`
✅ No more `localhost:9000` URLs for clients

**Next Step:** Deploy the backend with the updated code and environment variables!
