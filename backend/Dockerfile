# Backend Dockerfile with PM2 for production
# Node 22 LTS - required for Prisma 7.x (needs Node 20.19+ or 22.12+)
FROM node:22-alpine AS builder

# Install build dependencies for native modules (bcrypt, sharp, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install PM2 globally and required tools including PostgreSQL client for migrations
RUN npm install -g pm2 && \
    apk add --no-cache wget curl libc6-compat postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

# Install production dependencies only
RUN npm ci --omit=dev

# Generate Prisma client in production (required for runtime)
RUN npx prisma generate

# Copy built application from builder (includes compiled generated client)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

# Copy PM2 ecosystem config
COPY ecosystem.config.js ./

# Create directories with proper permissions
RUN mkdir -p /app/uploads /app/logs /app/backups && \
    chmod 755 /app/uploads /app/logs /app/backups

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Change ownership of app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (default 8000 for production)
EXPOSE 8080

# Health check using wget (available in alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start with PM2 runtime (handles clustering)
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
