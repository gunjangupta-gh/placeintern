# Quick Fix Summary - MinIO Configuration

## ✅ What Was Fixed

1. **imageUtils.js** - Now uses `VITE_MINIO_ENDPOINT` and `VITE_MINIO_BUCKET` instead of non-existent `VITE_UPLOADS_URL`

2. **docker-compose.yml** - Added MinIO build args to frontend service

3. **.env (root)** - Updated with correct production values for placeintern.com

4. **frontend/.env.example** - Added production value examples

5. **.github/workflows/ci-cd.yml** - Added MinIO build args to Docker-based CI/CD

6. **.github/workflows/deploy.yml** - Added MinIO env vars to VPS deployment workflow (PM2)

## 🚀 Next Steps - Using Your VPS Deployment

### ✅ Method 1: Auto Deploy via GitHub Actions (Recommended)

Your **deploy.yml** will do everything automatically:

```bash
git add .
git commit -m "Fix MinIO endpoint configuration"
git push origin main

# GitHub Actions automatically:
# ✅ Pulls code on VPS
# ✅ Builds with correct env vars  
# ✅ Reloads PM2
# ✅ Health checks
```

### Method 2: Manual VPS Deployment

```bash
# SSH to your server
ssh your-vps

cd /root/placeintern/placeintern/frontend

# Build with env vars
VITE_MINIO_ENDPOINT=https://files.placeintern.com \
VITE_MINIO_BUCKET=placeintern-uploads \
npm run build

pm2 reload frontend
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
