# Complete MinIO Configuration Fix

## ✅ What Was Fixed

### Frontend Fixes
1. **imageUtils.js** - Now uses `VITE_MINIO_ENDPOINT` and `VITE_MINIO_BUCKET` instead of non-existent `VITE_UPLOADS_URL`
2. **docker-compose.yml** - Added MinIO build args to frontend service
3. **frontend/.env.example** - Added production value examples
4. **.github/workflows/ci-cd.yml** - Added MinIO build args to Docker-based CI/CD
5. **.github/workflows/deploy.yml** - Added MinIO env vars to VPS deployment workflow (PM2)

### Backend Fixes (⚠️ Main Issue!)
6. **file-storage.service.ts** - Added `MINIO_PUBLIC_ENDPOINT` support for generating correct presigned URLs
7. **backend/.env.example** - Added MINIO_PUBLIC_ENDPOINT configuration
8. **.env (root)** - Added MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com
9. **docker-compose files** - Added MINIO_PUBLIC_ENDPOINT env var to backend services

## 🚀 Deploy Both Frontend & Backend

### ✅ Step 1: Update Server Environment

**SSH to your server and update backend .env:**
```bash
ssh your-vps
cd /root/placeintern/placeintern/backend
nano .env
```

**Add this line:**
```bash
MINIO_PUBLIC_ENDPOINT=https://files.placeintern.com
```

### ✅ Step 2: Deploy via GitHub Actions (Auto)

```bash
git add .
git commit -m "Fix MinIO configuration for frontend and backend"
git push origin main

# GitHub Actions automatically deploys:
# ✅ Pulls code on VPS
# ✅ Builds frontend with correct env vars
# ✅ Rebuilds backend with new code
# ✅ Reloads both PM2 processes
```

### ✅ Step 3: Verify

After deployment (2-3 minutes):

1. **Open your app** (Ctrl+Shift+R to force refresh)
2. **Check image URLs** - Should show `https://files.placeintern.com`
3. **Test file downloads** - Presigned URLs should work

```bash
# Check logs on server:
ssh your-vps
pm2 logs backend --lines 50
pm2 logs frontend --lines 50
```

```bash
# Just commit and push these changes
git add .
git commit -m "Fix MinIO endpoint configuration"
git push origin main

# GitHub Actions will automatically:
# - Build new Docker image with correct env vars
# - Push to ghcr.io registry

# Then on your server:
ssh your-server
cd /path/to/project
docker compose -f docker-compose.prod.yml pull frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

### Method 2: Manual Build & Deploy

```bash
# 1. Build locally with production values
docker build \
  --build-arg VITE_API_BASE_URL=https://api.placeintern.com/api \
  --build-arg VITE_APP_ENV=production \
  --build-arg VITE_MINIO_ENDPOINT=https://files.placeintern.com \
  --build-arg VITE_MINIO_BUCKET=placeintern-uploads \
  -t ghcr.io/nikhil2247/cms-new/frontend:latest \
  -f frontend/Dockerfile frontend/

# 2. Push to registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
docker push ghcr.io/nikhil2247/cms-new/frontend:latest

# 3. Deploy on server
ssh your-server
cd /path/to/project
docker compose pull frontend
docker compose up -d frontend
```

### Method 3: Build on Server (If you have enough RAM)

```bash
# On your server
cd /path/to/project
git pull origin main

# Make sure .env has these values:
VITE_MINIO_ENDPOINT=https://files.placeintern.com
VITE_MINIO_BUCKET=placeintern-uploads

# Build and restart
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

## 🔍 Verify the Fix

1. Open your app in browser (Ctrl+Shift+R to force refresh)
2. Open DevTools → Network tab
3. Navigate to a page with images
4. Check that image URLs now show: `https://files.placeintern.com/placeintern-uploads/...`
5. No more `localhost:9000` requests!

## 📝 Important Notes

- **Vite embeds env vars at build time** - changing .env after build does nothing
- **Always rebuild frontend when changing env vars**
- **Clear browser cache** if you still see old URLs
- The backend MinIO config (`MINIO_ENDPOINT=http://minio:9000`) is correct - it's for internal Docker network

## ❓ Still Having Issues?

See detailed troubleshooting in [MINIO_FIX_GUIDE.md](MINIO_FIX_GUIDE.md)
