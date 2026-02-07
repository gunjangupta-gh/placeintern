# Security & Production Configuration

## Overview

This document outlines the security features and production-ready configurations implemented in the CMS backend.

## Security Features

### 1. Rate Limiting (Throttling)

**Implementation**: `src/core/common/guards/throttle.guard.ts`

- Protects against brute force attacks and DDoS
- Tracks requests by user ID (authenticated) or IP address (unauthenticated)
- Default: 100 requests per minute per user/IP
- Configurable via environment variables (`THROTTLE_TTL`, `THROTTLE_LIMIT`)

**Usage**:
```typescript
// Global rate limiting is automatically applied
// To customize for specific routes:
@UseGuards(CustomThrottleGuard)
@Throttle(10, 60000) // 10 requests per minute
@Get('sensitive-endpoint')
async sensitiveOperation() {}
```

### 2. XSS Protection

**Implementation**: `src/core/common/interceptors/security.interceptor.ts`

- Sanitizes all incoming request bodies
- Removes malicious scripts, iframes, and event handlers
- Prevents stored XSS attacks
- Adds security headers to all responses

**Protected Against**:
- `<script>` tags
- `<iframe>` tags
- Event handlers (onclick, onload, etc.)
- `javascript:` protocol
- `data:text/html` URLs

### 3. Input Sanitization

**Implementation**: `src/core/common/pipes/sanitize.pipe.ts`

- Validates file uploads (type and size)
- Sanitizes string inputs
- Prevents prototype pollution attacks
- Maximum file size: 10MB (configurable)

**Allowed File Types**:
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, DOCX, DOC, XLSX, XLS
- Data: CSV

### 4. Global Exception Handling

**Implementation**: `src/core/common/filters/all-exceptions.filter.ts`

- Catches all exceptions throughout the application
- Logs errors with contextual information
- Sanitizes error messages in production
- Hides sensitive information from error responses
- Ready for Sentry integration

**Features**:
- Different log levels based on error severity
- Production vs Development error messages
- Tracks user, IP, timestamp, and request context
- Prevents information leakage

### 5. Request/Response Logging

**Implementation**: `src/core/common/interceptors/logging.interceptor.ts`

- Logs all HTTP requests and responses
- Tracks request duration
- Identifies slow requests (> 1 second)
- Logs user information for auditing
- Handles proxy scenarios for accurate IP detection

### 6. Security Headers

**Implementation**: `src/main.ts` (using Helmet)

- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Enables browser XSS filter
- `X-Frame-Options: DENY` - Prevents clickjacking
- `Strict-Transport-Security` - Enforces HTTPS (HSTS)
- `Cache-Control` - Prevents caching of sensitive data

### 7. CORS Configuration

**Implementation**: `src/main.ts`

- Whitelist-based origin validation
- Configurable via `ALLOWED_ORIGINS` environment variable
- Supports credentials (cookies, authorization headers)
- Restricted HTTP methods
- Custom headers support (`x-institution-id`)

### 8. Input Validation

**Implementation**: Global ValidationPipe in `src/main.ts`

- Automatic DTO validation using class-validator
- Whitelist mode (removes unknown properties)
- Forbids non-whitelisted properties
- Type transformation enabled

## Production Configuration

### Environment Variables

See `.env.example` for complete configuration. Key security variables:

```env
# Security
NODE_ENV=production
JWT_SECRET=<strong-secret-minimum-32-chars>
JWT_REFRESH_SECRET=<strong-secret-minimum-32-chars>
SESSION_SECRET=<strong-secret-minimum-32-chars>

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Change all default secrets (JWT, session, webhook)
- [ ] Configure allowed CORS origins
- [ ] Set up HTTPS/SSL certificates
- [ ] Configure database connection pooling
- [ ] Set up Redis for caching and sessions
- [ ] Configure email SMTP settings
- [ ] Set up Cloudinary or S3 for file storage
- [ ] Configure Firebase for push notifications
- [ ] Set up error tracking (Sentry)
- [ ] Enable database backups
- [ ] Configure log aggregation
- [ ] Set up monitoring and health checks
- [ ] Review and adjust rate limits
- [ ] Configure firewall rules
- [ ] Set up DDoS protection (Cloudflare, AWS Shield)

## Deployment

### Docker

```dockerfile
# Use production NODE_ENV
ENV NODE_ENV=production

# Don't run as root
USER node

# Use .env file for secrets (never commit .env)
# Use Docker secrets or environment variables
```

### Reverse Proxy (Nginx)

```nginx
# Enable HTTPS
ssl_protocols TLSv1.2 TLSv1.3;

# Proxy headers
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Rate limiting at proxy level
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

## Monitoring

### Error Tracking

Uncomment Sentry integration in `all-exceptions.filter.ts`:

```typescript
private sendToSentry(exception: any, context: any): void {
  Sentry.captureException(exception, { extra: context });
}
```

### Health Checks

- Endpoint: `/health` (to be implemented)
- Checks: Database, Redis, External APIs
- Use for load balancer health checks

### Metrics

- Request duration
- Error rates
- Rate limit violations
- File upload sizes
- Database query performance

## Security Best Practices

1. **Secrets Management**: Never commit secrets to Git. Use environment variables or secret management services (AWS Secrets Manager, HashiCorp Vault).

2. **Database Security**:
   - Use prepared statements (Prisma does this automatically)
   - Implement row-level security
   - Regular backups
   - Encrypted connections

3. **Authentication**:
   - Use bcrypt for password hashing (10+ rounds)
   - Implement refresh token rotation
   - Session timeout (default: 1 hour)
   - Multi-factor authentication (to be implemented)

4. **Authorization**:
   - Role-based access control (RBAC)
   - Principle of least privilege
   - Validate permissions on every request

5. **File Uploads**:
   - Validate file types and sizes
   - Scan for malware (to be implemented)
   - Store files outside web root
   - Use signed URLs for downloads

6. **API Security**:
   - Rate limiting per endpoint
   - Request size limits
   - Timeout configurations
   - API versioning

## Compliance

### GDPR Considerations

- User data encryption at rest
- Right to be forgotten (data deletion)
- Data export functionality
- Audit logs for data access
- Cookie consent (frontend)

### Security Headers Score

Test your deployment: https://securityheaders.com/

Expected score: A+ with all headers properly configured.

## Incident Response

1. **Detection**: Monitor logs and error tracking
2. **Containment**: Rate limiting and IP blocking
3. **Investigation**: Audit logs and error context
4. **Recovery**: Database backups and rollback procedures
5. **Post-Mortem**: Document and improve security measures

## Updates and Patches

- Regular dependency updates (`npm audit`)
- Security patch monitoring
- NestJS framework updates
- Database driver updates
- Operating system patches

## Support

For security issues, contact: security@yourdomain.com

Never disclose security vulnerabilities publicly.
