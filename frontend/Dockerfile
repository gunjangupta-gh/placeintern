# Frontend Dockerfile with Nginx
# Node 22 LTS for building (consistent with backend)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_BASE_URL=http://localhost:8000/api
ARG VITE_APP_NAME="PlaceIntern Portal"
ARG VITE_APP_ENV=production
ARG VITE_MINIO_ENDPOINT=http://minio:9000
ARG VITE_MINIO_BUCKET=cms-uploads

# Set environment variables for build
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_MINIO_ENDPOINT=$VITE_MINIO_ENDPOINT
ENV VITE_MINIO_BUCKET=$VITE_MINIO_BUCKET

# Build the application
RUN npm run build

# Production stage with Nginx (stable alpine version)
FROM nginx:1.27-alpine AS production

# Install wget for health checks
RUN apk add --no-cache wget

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/health || exit 1

# Start nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
