# MinIO Configuration Fix Guide

## Problem Summary

The frontend application was hitting `localhost:9000` instead of `https://files.placeintern.com` even after setting environment variables on the server. This was caused by:

1. **Code Issue**: `imageUtils.js` was looking for `VITE_UPLOADS_URL` environment variable, but the Dockerfile and env files were using `VITE_MINIO_ENDPOINT` and `VITE_MINIO_BUCKET`.

2. **Build Issue**: The Docker image was built without proper MinIO environment variables, so the production values weren't embedded in the built app. The `docker-compose.yml` was missing MinIO build args.

3. **Vite Limitation**: Vite replaces environment variables at BUILD time, not runtime. So updating env files on the server after the image is built has no effect.

## Fixes Applied

### 1. Updated imageUtils.js ✅

**File**: `frontend/src/utils/imageUtils.js`

Changed from looking for `VITE_UPLOADS_URL` to using `VITE_MINIO_ENDPOINT` and `VITE_MINIO_BUCKET`:

```javascript
const getUploadsBaseUrl = () => {
  // Use environment variables for MinIO endpoint and bucket
  const minioEndpoint = import.meta.env.VITE_MINIO_ENDPOINT || 'https://files.placeintern.com';
  const minioBucket = import.meta.env.VITE_MINIO_BUCKET || 'placeintern-uploads';
  return `${minioEndpoint}/${minioBucket}`;
};
```

### 2. Updated docker-compose.yml ✅

**File**: `docker-compose.yml`

Added MinIO build args to the frontend service:

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      VITE_API_BASE_URL: ${VITE_API_BASE_URL:-http://localhost:8000/api}
      VITE_APP_NAME: ${VITE_APP_NAME:-PlaceIntern Portal}
      VITE_APP_ENV: ${VITE_APP_ENV:-production}
      VITE_MINIO_ENDPOINT: ${VITE_MINIO_ENDPOINT:-https://files.placeintern.com}
      VITE_MINIO_BUCKET: ${VITE_MINIO_BUCKET:-placeintern-uploads}
```

### 3. Updated .env.example ✅

**File**: `frontend/.env.example`

Added production value examples:

```env
# MinIO Configuration (for file uploads)
# Development (local MinIO): http://localhost:9000
# Production: https://files.placeintern.com
VITE_MINIO_ENDPOINT=http://localhost:9000
VITE_MINIO_BUCKET=cms-uploads
# Production values:
# VITE_MINIO_ENDPOINT=https://files.placeintern.com
# VITE_MINIO_BUCKET=placeintern-uploads
```

## How to Deploy the Fix

### Option 1: Local Build & Push (Recommended)

If you have the repository locally and Docker installed:

1. **Create/Update your .env file in the project root:**

```bash
# Create .env file with production values
cat > .env << EOF
VITE_API_BASE_URL=https://api.placeintern.com/api
VITE_APP_NAME="PlaceIntern Portal"
VITE_APP_ENV=production
VITE_MINIO_ENDPOINT=https://files.placeintern.com
VITE_MINIO_BUCKET=placeintern-uploads
EOF
```

2. **Rebuild the frontend Docker image:**

```bash
# Build the image with production values
docker compose build frontend

# Or build with explicit build args
docker build \
  --build-arg VITE_API_BASE_URL=https://api.placeintern.com/api \
  --build-arg VITE_APP_NAME="PlaceIntern Portal" \
  --build-arg VITE_APP_ENV=production \
  --build-arg VITE_MINIO_ENDPOINT=https://files.placeintern.com \
  --build-arg VITE_MINIO_BUCKET=placeintern-uploads \
  -t cms-frontend:latest \
  -f frontend/Dockerfile \
  frontend/
```

3. **Tag and push to GitHub Container Registry:**

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Tag the image
docker tag cms-frontend:latest ghcr.io/nikhil2247/cms-new/frontend:latest

# Push the image
docker push ghcr.io/nikhil2247/cms-new/frontend:latest
```

4. **Deploy on server:**

```bash
# On your server, pull the new image
docker compose -f docker-compose.prod.yml pull frontend

# Restart the frontend service
docker compose -f docker-compose.prod.yml up -d frontend

# Or if using app.yml
docker compose -f docker-compose.app.yml pull frontend
docker compose -f docker-compose.app.yml up -d frontend
```

### Option 2: GitHub Actions CI/CD

If you have GitHub Actions set up:

1. **Commit and push these changes:**

```bash
git add .
git commit -m "Fix MinIO endpoint configuration for production"
git push origin main
```

2. **GitHub Actions will automatically:**
   - Build the Docker image with correct env vars
   - Push to GitHub Container Registry
   - (If configured) Deploy to your server

3. **On server, pull and restart:**

```bash
docker compose pull frontend
docker compose up -d frontend
```

### Option 3: Build on Server (Not Recommended - Resource intensive)

If you must build on the server:

1. **SSH into your server and navigate to project directory:**

```bash
cd /path/to/placeintern
```

2. **Pull latest code:**

```bash
git pull origin main
```

3. **Create .env file with production values:**

```bash
cat > .env << EOF
VITE_API_BASE_URL=https://api.placeintern.com/api
VITE_APP_NAME="PlaceIntern Portal"
VITE_APP_ENV=production
VITE_MINIO_ENDPOINT=https://files.placeintern.com
VITE_MINIO_BUCKET=placeintern-uploads

# Add other required env vars...
EOF
```

4. **Build and restart:**

```bash
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d frontend
```

## Verification

After deploying, verify the fix:

1. **Check the running container logs:**

```bash
docker logs cms-frontend
```

2. **Inspect the built files (optional):**

```bash
# Check what MinIO URL is embedded in the built JS
docker exec cms-frontend cat /usr/share/nginx/html/assets/*.js | grep -o 'files.placeintern.com'
```

3. **Test in browser:**
   - Open your app in browser
   - Open Developer Tools (F12)
   - Go to Network tab
   - Upload or view an image
   - Check if requests go to `files.placeintern.com` instead of `localhost:9000`

4. **Check specific image URLs:**
   - Inspect any image element
   - URL should be: `https://files.placeintern.com/placeintern-uploads/...`
   - NOT: `http://localhost:9000/cms-uploads/...`

## Environment Variables Summary

For **production deployment**, ensure these are set:

```env
# Frontend Production Environment Variables
VITE_API_BASE_URL=https://api.placeintern.com/api
VITE_APP_NAME="PlaceIntern Portal"
VITE_APP_ENV=production
VITE_MINIO_ENDPOINT=https://files.placeintern.com
VITE_MINIO_BUCKET=placeintern-uploads
```

For **local development**, use:

```env
# Frontend Development Environment Variables
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME="PlaceIntern Portal"
VITE_APP_ENV=development
VITE_MINIO_ENDPOINT=http://localhost:9000
VITE_MINIO_BUCKET=cms-uploads
```

## Important Notes

### Why Env Vars Must Be Set at Build Time

**Vite (the build tool) replaces all `import.meta.env.*` references with actual values during the build process.** This means:

- ✅ Setting env vars during Docker build (build args) → Works
- ❌ Setting env vars after Docker image is built → Has no effect
- ❌ Setting env vars in docker-compose runtime environment → Has no effect for frontend
- ❌ Changing .env file on server after build → Has no effect

### Backend vs Frontend Environment Variables

- **Backend**: Can use runtime environment variables (they're read when the Node.js process starts)
- **Frontend**: Must use build-time environment variables (Vite embeds them in the compiled JavaScript)

### Docker Image Best Practices

1. **Always rebuild frontend image when changing env vars**
2. **Use different tags for dev and prod** (e.g., `frontend:dev`, `frontend:prod`)
3. **Store production env vars in GitHub Secrets** for CI/CD
4. **Never commit production .env files** to the repository

## Troubleshooting

### Still seeing localhost:9000?

1. **Clear browser cache** - Old JS files might be cached
2. **Force reload** - Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)
3. **Check if new image is running:**
   ```bash
   docker images | grep frontend
   docker ps | grep frontend
   ```
4. **Verify image creation date** matches your build time
5. **Check container logs** for any errors

### CORS errors after fixing MinIO?

If MinIO bucket or endpoint changed, update backend MinIO configuration:

```yaml
# In docker-compose.prod.yml backend service
environment:
  - MINIO_ENDPOINT=https://files.placeintern.com
  - MINIO_BUCKET=placeintern-uploads
```

And ensure MinIO CORS is configured properly:

```bash
# Connect to MinIO and set CORS
mc alias set minio https://files.placeintern.com <access-key> <secret-key>
mc anonymous set-json cors.json minio/placeintern-uploads
```

## Summary

The fix involved:
1. ✅ Updating code to use correct env var names
2. ✅ Adding MinIO build args to docker-compose.yml  
3. ✅ Documenting proper production values
4. 🔄 **You need to rebuild and redeploy the frontend image**

After rebuilding with the correct environment variables, your app will use `https://files.placeintern.com/placeintern-uploads` instead of `localhost:9000`.
