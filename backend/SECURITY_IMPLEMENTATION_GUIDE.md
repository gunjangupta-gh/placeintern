# Security Implementation Guide
## Remaining Items for 100% Compliance

**Document Version:** 1.0
**Last Updated:** January 2026
**Target Compliance:** MeitY Annexure-2 & CERT-In Guidelines

---

## Table of Contents

1. [SSL/TLS Certificate Setup](#1-ssltls-certificate-setup)
2. [Web Application Firewall (WAF)](#2-web-application-firewall-waf)
3. [SIEM Integration](#3-siem-integration)
4. [Error Tracking (Sentry)](#4-error-tracking-sentry)
5. [Network Segmentation](#5-network-segmentation)
6. [Database Security](#6-database-security)
7. [Backup & Disaster Recovery](#7-backup--disaster-recovery)
8. [VAPT & Penetration Testing](#8-vapt--penetration-testing)
9. [Email Security (SPF/DKIM/DMARC)](#9-email-security-spfdkimdmarc)
10. [Monitoring & Alerting](#10-monitoring--alerting)

---

## 1. SSL/TLS Certificate Setup

### Priority: CRITICAL
### Estimated Time: 1-2 hours

### Option A: Let's Encrypt (Free)

#### Step 1: Install Certbot
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### Step 2: Obtain Certificate
```bash
# For Nginx
sudo certbot --nginx -d yourdomain.gov.in -d www.yourdomain.gov.in

# For standalone (if no web server running)
sudo certbot certonly --standalone -d yourdomain.gov.in
```

#### Step 3: Configure Nginx for HTTPS
Create/edit `/etc/nginx/sites-available/cms-backend`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.gov.in www.yourdomain.gov.in;
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    server_name yourdomain.gov.in www.yourdomain.gov.in;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/yourdomain.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.gov.in/privkey.pem;

    # SSL Configuration (Strong Security)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers (additional to Helmet)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Proxy to Node.js Backend
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Support
    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Step 4: Enable and Test
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cms-backend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Set up auto-renewal
sudo certbot renew --dry-run
```

#### Step 5: Add Cron for Auto-Renewal
```bash
# Edit crontab
sudo crontab -e

# Add this line (renews at 2:30 AM daily)
30 2 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

### Option B: Commercial SSL (Government CA)

For government projects, you may need certificates from:
- NIC CA (National Informatics Centre)
- eMudhra
- Capricorn CA

Contact your IT department for the certificate issuance process.

---

## 2. Web Application Firewall (WAF)

### Priority: HIGH
### Estimated Time: 2-4 hours

### Option A: Cloudflare WAF (Recommended for Quick Setup)

#### Step 1: Sign Up for Cloudflare
1. Go to https://cloudflare.com
2. Add your domain
3. Update nameservers at your registrar

#### Step 2: Enable WAF
1. Go to Security → WAF
2. Enable "Managed Rules"
3. Enable "OWASP Core Rule Set"

#### Step 3: Configure Rules
```
Recommended Settings:
- SQL Injection: Block
- XSS: Block
- Remote File Inclusion: Block
- PHP Injection: Block
- Command Injection: Block
- Anomaly Score Threshold: Medium (25)
```

#### Step 4: Configure Rate Limiting
1. Go to Security → Rate Limiting
2. Create rules:
   - Login endpoint: 5 requests/minute
   - API endpoints: 100 requests/minute
   - Block duration: 10 minutes

### Option B: AWS WAF (If using AWS)

#### Step 1: Create Web ACL
```bash
aws wafv2 create-web-acl \
  --name cms-waf \
  --scope REGIONAL \
  --default-action Block={} \
  --visibility-config SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=cms-waf
```

#### Step 2: Add Managed Rules
```bash
# Add AWS Managed Rules
aws wafv2 update-web-acl \
  --name cms-waf \
  --scope REGIONAL \
  --rules '[
    {
      "Name": "AWS-AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "AWS-AWSManagedRulesSQLiRuleSet",
      "Priority": 2,
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesSQLiRuleSet"
        }
      },
      "OverrideAction": {"None": {}},
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "SQLiRuleSet"
      }
    }
  ]'
```

### Option C: ModSecurity (Self-Hosted)

#### Step 1: Install ModSecurity
```bash
# Ubuntu/Debian
sudo apt install libapache2-mod-security2

# For Nginx
sudo apt install libnginx-mod-http-modsecurity
```

#### Step 2: Configure ModSecurity
```bash
# Copy recommended config
sudo cp /etc/modsecurity/modsecurity.conf-recommended /etc/modsecurity/modsecurity.conf

# Edit config
sudo nano /etc/modsecurity/modsecurity.conf

# Change: SecRuleEngine DetectionOnly
# To: SecRuleEngine On
```

#### Step 3: Install OWASP Core Rule Set
```bash
cd /etc/modsecurity
sudo git clone https://github.com/coreruleset/coreruleset.git
sudo cp coreruleset/crs-setup.conf.example coreruleset/crs-setup.conf
```

#### Step 4: Include Rules in Nginx
```nginx
# In nginx.conf or site config
modsecurity on;
modsecurity_rules_file /etc/modsecurity/modsecurity.conf;
modsecurity_rules_file /etc/modsecurity/coreruleset/crs-setup.conf;
modsecurity_rules_file /etc/modsecurity/coreruleset/rules/*.conf;
```

---

## 3. SIEM Integration

### Priority: MEDIUM
### Estimated Time: 1-2 days

### Option A: ELK Stack (Elasticsearch, Logstash, Kibana)

#### Step 1: Install Elasticsearch
```bash
# Import GPG key
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add -

# Add repository
echo "deb https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list

# Install
sudo apt update
sudo apt install elasticsearch
sudo systemctl enable elasticsearch
sudo systemctl start elasticsearch
```

#### Step 2: Install Logstash
```bash
sudo apt install logstash
```

#### Step 3: Create Logstash Pipeline
Create `/etc/logstash/conf.d/cms-logs.conf`:

```ruby
input {
  file {
    path => "/var/log/cms-backend/*.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  if [level] == "error" {
    mutate {
      add_tag => ["error", "alert"]
    }
  }

  # Parse request ID
  if [requestId] {
    mutate {
      add_field => { "trace_id" => "%{requestId}" }
    }
  }

  # Geolocate IP addresses
  if [clientIp] {
    geoip {
      source => "clientIp"
      target => "geoip"
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "cms-logs-%{+YYYY.MM.dd}"
  }
}
```

#### Step 4: Install Kibana
```bash
sudo apt install kibana
sudo systemctl enable kibana
sudo systemctl start kibana
```

#### Step 5: Configure Application Logging
Update your application to output JSON logs:

```typescript
// src/config/logger.config.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const loggerConfig = WinstonModule.createLogger({
  transports: [
    new winston.transports.File({
      filename: '/var/log/cms-backend/app.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
    new winston.transports.File({
      filename: '/var/log/cms-backend/error.log',
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});
```

#### Step 6: Create Security Dashboard in Kibana
1. Open Kibana (http://localhost:5601)
2. Go to Dashboard → Create
3. Add visualizations:
   - Failed login attempts over time
   - Requests by IP address
   - Error rate by endpoint
   - Geographic distribution of requests
   - Rate limit violations

### Option B: AWS CloudWatch (If using AWS)

#### Step 1: Install CloudWatch Agent
```bash
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

#### Step 2: Configure Agent
Create `/opt/aws/amazon-cloudwatch-agent/etc/config.json`:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/cms-backend/app.log",
            "log_group_name": "cms-backend",
            "log_stream_name": "{instance_id}/app",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/cms-backend/error.log",
            "log_group_name": "cms-backend",
            "log_stream_name": "{instance_id}/error",
            "timezone": "UTC"
          }
        ]
      }
    }
  }
}
```

#### Step 3: Create Alarms
```bash
# Failed login alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "HighFailedLogins" \
  --metric-name "FailedLoginAttempts" \
  --namespace "CMS/Security" \
  --statistic Sum \
  --period 300 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:region:account:security-alerts
```

---

## 4. Error Tracking (Sentry)

### Priority: MEDIUM
### Estimated Time: 1-2 hours

#### Step 1: Create Sentry Account
1. Go to https://sentry.io
2. Create organization and project (Node.js)
3. Get your DSN

#### Step 2: Install Sentry SDK
```bash
cd backend
npm install @sentry/node @sentry/tracing
```

#### Step 3: Initialize Sentry
Create `src/config/sentry.config.ts`:

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export function initSentry() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      integrations: [
        new ProfilingIntegration(),
      ],
      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      // Error Sampling
      sampleRate: 1.0, // 100% of errors
      // Profiling
      profilesSampleRate: 0.1,
      // Filter sensitive data
      beforeSend(event) {
        // Remove sensitive data
        if (event.request?.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
        if (event.request?.data) {
          const sensitiveFields = ['password', 'token', 'secret', 'aadhaar', 'pan'];
          for (const field of sensitiveFields) {
            if (event.request.data[field]) {
              event.request.data[field] = '[REDACTED]';
            }
          }
        }
        return event;
      },
    });

    console.log('Sentry initialized');
  }
}
```

#### Step 4: Update main.ts
```typescript
// src/main.ts
import { initSentry } from './config/sentry.config';
import * as Sentry from '@sentry/node';

async function bootstrap() {
  // Initialize Sentry first
  initSentry();

  const app = await NestFactory.create(AppModule);

  // Add Sentry error handler
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());

  // ... rest of configuration
}
```

#### Step 5: Update Exception Filter
```typescript
// src/core/common/filters/all-exceptions.filter.ts
import * as Sentry from '@sentry/node';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // ... existing code

    // Send to Sentry
    if (status >= 500 && process.env.SENTRY_DSN) {
      Sentry.captureException(exception, {
        extra: {
          requestId,
          path: request.url,
          method: request.method,
          userId: getUserId(request),
        },
      });
    }

    // ... rest of code
  }
}
```

#### Step 6: Add Environment Variable
```env
# .env
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## 5. Network Segmentation

### Priority: MEDIUM
### Estimated Time: 4-8 hours

### For AWS VPC

#### Step 1: Create VPC Structure
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=cms-vpc}]'

# Create Subnets
# Public subnet (for load balancer)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cms-public-1}]'

# Private subnet (for application)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cms-private-app-1}]'

# Private subnet (for database)
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.3.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=cms-private-db-1}]'
```

#### Step 2: Create Security Groups
```bash
# Load Balancer SG (public)
aws ec2 create-security-group --group-name cms-lb-sg --description "Load Balancer SG" --vpc-id vpc-xxx
aws ec2 authorize-security-group-ingress --group-id sg-lb --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id sg-lb --protocol tcp --port 80 --cidr 0.0.0.0/0

# Application SG (private)
aws ec2 create-security-group --group-name cms-app-sg --description "Application SG" --vpc-id vpc-xxx
aws ec2 authorize-security-group-ingress --group-id sg-app --protocol tcp --port 5000 --source-group sg-lb

# Database SG (private)
aws ec2 create-security-group --group-name cms-db-sg --description "Database SG" --vpc-id vpc-xxx
aws ec2 authorize-security-group-ingress --group-id sg-db --protocol tcp --port 5432 --source-group sg-app

# Redis SG (private)
aws ec2 create-security-group --group-name cms-redis-sg --description "Redis SG" --vpc-id vpc-xxx
aws ec2 authorize-security-group-ingress --group-id sg-redis --protocol tcp --port 6379 --source-group sg-app
```

### Network Architecture Diagram
```
                    ┌─────────────────────────────────────────────┐
                    │              INTERNET                       │
                    └─────────────────┬───────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────────┐
                    │         PUBLIC SUBNET (10.0.1.0/24)         │
                    │    ┌─────────────────────────────────┐      │
                    │    │   Load Balancer / WAF / CDN     │      │
                    │    │   (HTTPS:443 only)              │      │
                    │    └─────────────────────────────────┘      │
                    └─────────────────┬───────────────────────────┘
                                      │ Port 5000
                    ┌─────────────────▼───────────────────────────┐
                    │      PRIVATE SUBNET - APP (10.0.2.0/24)     │
                    │    ┌─────────────────────────────────┐      │
                    │    │      NestJS Backend Server       │      │
                    │    │      (Node.js + PM2)             │      │
                    │    └─────────────────────────────────┘      │
                    └───────────┬─────────────────┬───────────────┘
                                │                 │
               Port 5432        │                 │ Port 6379
                    ┌───────────▼───────┐   ┌─────▼───────────────┐
                    │ PRIVATE - DB      │   │ PRIVATE - CACHE     │
                    │ (10.0.3.0/24)     │   │ (10.0.4.0/24)       │
                    │ ┌───────────────┐ │   │ ┌─────────────────┐ │
                    │ │  PostgreSQL   │ │   │ │ Redis/Dragonfly │ │
                    │ └───────────────┘ │   │ └─────────────────┘ │
                    └───────────────────┘   └─────────────────────┘
```

---

## 6. Database Security

### Priority: HIGH
### Estimated Time: 2-4 hours

#### Step 1: Enable SSL Connections
```bash
# PostgreSQL - edit postgresql.conf
ssl = on
ssl_cert_file = '/etc/ssl/certs/server.crt'
ssl_key_file = '/etc/ssl/private/server.key'
ssl_ca_file = '/etc/ssl/certs/ca.crt'
```

#### Step 2: Update Database URL
```env
# .env
DATABASE_URL=postgresql://user:password@host:5432/cms_db?schema=public&sslmode=require
```

#### Step 3: Enable Encryption at Rest
```sql
-- For AWS RDS, enable during creation or modify:
-- AWS Console → RDS → Modify → Enable Encryption

-- For self-hosted, use LUKS encryption on disk
```

#### Step 4: Create Read-Only User for Reporting
```sql
-- Create read-only role
CREATE ROLE cms_readonly;
GRANT CONNECT ON DATABASE cms_db TO cms_readonly;
GRANT USAGE ON SCHEMA public TO cms_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cms_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cms_readonly;

-- Create user with read-only role
CREATE USER reporting_user WITH PASSWORD 'strong_password_here';
GRANT cms_readonly TO reporting_user;
```

#### Step 5: Enable Query Logging
```bash
# postgresql.conf
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000  # Log queries taking > 1 second
```

---

## 7. Backup & Disaster Recovery

### Priority: HIGH
### Estimated Time: 4-8 hours

#### Step 1: Create Backup Script
Create `/opt/scripts/backup-cms.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backups/cms"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database credentials
DB_HOST="localhost"
DB_NAME="cms_db"
DB_USER="postgres"

# MinIO credentials
MINIO_ALIAS="myminio"
MINIO_BUCKET="cms-backups"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
echo "Starting database backup..."
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/db_$DATE.dump

# Compress backup
gzip $BACKUP_DIR/db_$DATE.dump

# Encrypt backup
gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/backup-passphrase \
    $BACKUP_DIR/db_$DATE.dump.gz

# Remove unencrypted backup
rm $BACKUP_DIR/db_$DATE.dump.gz

# Upload to MinIO/S3
mc cp $BACKUP_DIR/db_$DATE.dump.gz.gpg $MINIO_ALIAS/$MINIO_BUCKET/database/

# Backup MinIO files
echo "Starting MinIO backup..."
mc mirror myminio/cms-uploads $BACKUP_DIR/minio_$DATE/

# Compress MinIO backup
tar -czf $BACKUP_DIR/minio_$DATE.tar.gz -C $BACKUP_DIR minio_$DATE
rm -rf $BACKUP_DIR/minio_$DATE

# Encrypt MinIO backup
gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /etc/backup-passphrase \
    $BACKUP_DIR/minio_$DATE.tar.gz
rm $BACKUP_DIR/minio_$DATE.tar.gz

# Upload to remote storage
mc cp $BACKUP_DIR/minio_$DATE.tar.gz.gpg $MINIO_ALIAS/$MINIO_BUCKET/files/

# Cleanup old local backups
find $BACKUP_DIR -name "*.gpg" -mtime +$RETENTION_DAYS -delete

# Log completion
echo "Backup completed: $DATE" >> /var/log/cms-backup.log

# Verify backup
echo "Verifying backup..."
gpg --batch --passphrase-file /etc/backup-passphrase -d $BACKUP_DIR/db_$DATE.dump.gz.gpg | gunzip | pg_restore --list > /dev/null
if [ $? -eq 0 ]; then
    echo "Backup verification: SUCCESS" >> /var/log/cms-backup.log
else
    echo "Backup verification: FAILED" >> /var/log/cms-backup.log
    # Send alert
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"CMS Backup Verification Failed!"}' \
        $SLACK_WEBHOOK_URL
fi
```

#### Step 2: Schedule Backup Cron
```bash
# Edit crontab
sudo crontab -e

# Daily backup at 1 AM
0 1 * * * /opt/scripts/backup-cms.sh >> /var/log/cms-backup.log 2>&1
```

#### Step 3: Create Restore Script
Create `/opt/scripts/restore-cms.sh`:

```bash
#!/bin/bash

# Usage: ./restore-cms.sh <backup_date>
# Example: ./restore-cms.sh 20260101_010000

BACKUP_DATE=$1
BACKUP_DIR="/backups/cms"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: ./restore-cms.sh <backup_date>"
    echo "Available backups:"
    ls -la $BACKUP_DIR/*.gpg
    exit 1
fi

# Decrypt database backup
gpg --batch --passphrase-file /etc/backup-passphrase \
    -d $BACKUP_DIR/db_$BACKUP_DATE.dump.gz.gpg > /tmp/db_restore.dump.gz

gunzip /tmp/db_restore.dump.gz

# Restore database
echo "Restoring database..."
pg_restore -h localhost -U postgres -d cms_db -c /tmp/db_restore.dump

# Cleanup
rm /tmp/db_restore.dump

echo "Database restore completed!"
```

#### Step 4: Test Recovery Procedure
```bash
# Monthly recovery test
# 1. Create test environment
# 2. Restore from latest backup
# 3. Verify data integrity
# 4. Document results
```

---

## 8. VAPT & Penetration Testing

### Priority: HIGH (Compliance Requirement)
### Estimated Time: 2-4 weeks (external engagement)

#### Step 1: Engage CERT-In Empanelled Auditor
1. Visit https://www.cert-in.org.in/
2. Find list of empanelled auditors
3. Request quote for:
   - Web Application Penetration Testing
   - API Security Testing
   - Infrastructure Assessment

#### Step 2: Pre-VAPT Checklist
- [ ] Ensure all production systems are backed up
- [ ] Document all API endpoints
- [ ] Prepare test accounts with different roles
- [ ] Define scope and exclusions
- [ ] Set up isolated testing environment

#### Step 3: During VAPT
```
Typical Testing Areas:
1. Authentication & Session Management
2. Authorization & Access Control
3. Input Validation (XSS, SQLi, etc.)
4. Cryptographic Failures
5. Security Misconfiguration
6. Vulnerable Components
7. API Security
8. File Upload Security
9. Business Logic Flaws
```

#### Step 4: Remediation Timeline
| Severity | Remediation Timeline |
|----------|---------------------|
| Critical | 24-48 hours |
| High | 7 days |
| Medium | 30 days |
| Low | 90 days |

#### Step 5: Internal Security Scans
Run automated scans regularly:

```bash
# Install OWASP ZAP
docker pull owasp/zap2docker-stable

# Run baseline scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
    -t https://yourdomain.gov.in \
    -r scan-report.html

# Run full scan (takes longer)
docker run -t owasp/zap2docker-stable zap-full-scan.py \
    -t https://yourdomain.gov.in \
    -r full-scan-report.html
```

---

## 9. Email Security (SPF/DKIM/DMARC)

### Priority: MEDIUM
### Estimated Time: 2-4 hours

#### Step 1: Configure SPF Record
Add DNS TXT record:
```
Type: TXT
Host: @
Value: v=spf1 include:_spf.google.com include:amazonses.com ~all
```

#### Step 2: Configure DKIM
For Gmail/Google Workspace:
1. Go to Admin Console → Apps → Google Workspace → Gmail → Authenticate Email
2. Generate DKIM key
3. Add DNS record as instructed

For Amazon SES:
```bash
aws ses verify-domain-dkim --domain yourdomain.gov.in
```

Add the provided CNAME records.

#### Step 3: Configure DMARC
Add DNS TXT record:
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.gov.in; ruf=mailto:dmarc-forensics@yourdomain.gov.in; fo=1
```

#### Step 4: Update Email Service
```typescript
// src/infrastructure/email/email.service.ts
import * as nodemailer from 'nodemailer';
import * as dkim from 'nodemailer-dkim';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // DKIM signing
      dkim: {
        domainName: 'yourdomain.gov.in',
        keySelector: 'mail',
        privateKey: process.env.DKIM_PRIVATE_KEY,
      },
    });
  }
}
```

---

## 10. Monitoring & Alerting

### Priority: MEDIUM
### Estimated Time: 4-8 hours

#### Step 1: Install Prometheus
```bash
# Download and install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
sudo mv prometheus-2.45.0.linux-amd64 /opt/prometheus
```

#### Step 2: Configure Prometheus
Create `/opt/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'cms-backend'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['localhost:9187']
```

#### Step 3: Add NestJS Metrics Endpoint
```bash
npm install @willsoto/nestjs-prometheus prom-client
```

```typescript
// src/app.module.ts
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    // ... other imports
  ],
})
export class AppModule {}
```

#### Step 4: Create Alert Rules
Create `/opt/prometheus/alert_rules.yml`:
```yaml
groups:
  - name: cms-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"

      - alert: TooManyFailedLogins
        expr: increase(failed_login_attempts_total[15m]) > 50
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Possible brute force attack"
          description: "{{ $value }} failed login attempts in 15 minutes"

      - alert: DatabaseConnectionPoolExhausted
        expr: pg_stat_activity_count > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Database connection pool nearly exhausted"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space is running low"
```

#### Step 5: Configure AlertManager
Create `/opt/alertmanager/alertmanager.yml`:
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourdomain.gov.in'
  smtp_auth_username: 'alerts@yourdomain.gov.in'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'security-team'

receivers:
  - name: 'security-team'
    email_configs:
      - to: 'security@yourdomain.gov.in'
        send_resolved: true
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/xxx/xxx/xxx'
        channel: '#cms-alerts'
        send_resolved: true
```

#### Step 6: Install Grafana
```bash
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt update
sudo apt install grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

---

## Implementation Checklist

### Immediate (This Week)
- [ ] SSL/TLS Certificate Setup
- [ ] Update production .env with strong secrets
- [ ] Enable database SSL

### Short Term (2 Weeks)
- [ ] WAF Configuration (Cloudflare or AWS WAF)
- [ ] Sentry Error Tracking
- [ ] Backup Script Setup

### Medium Term (1 Month)
- [ ] SIEM Integration (ELK or CloudWatch)
- [ ] Network Segmentation
- [ ] Email Security (SPF/DKIM/DMARC)
- [ ] Monitoring & Alerting (Prometheus/Grafana)

### Long Term (3 Months)
- [ ] VAPT with CERT-In Empanelled Auditor
- [ ] Disaster Recovery Testing
- [ ] Security Training for Team

---

## Support & Resources

### Official Documentation
- CERT-In Guidelines: https://www.cert-in.org.in/
- MeitY Security Guidelines: https://www.meity.gov.in/
- OWASP: https://owasp.org/

### Tools
- Let's Encrypt: https://letsencrypt.org/
- Cloudflare: https://cloudflare.com/
- Sentry: https://sentry.io/
- OWASP ZAP: https://www.zaproxy.org/

### Emergency Contacts
- CERT-In Incident Reporting: incident@cert-in.org.in
- NIC Security: security@nic.in

---

**Document maintained by:** Security Team
**Next Review Date:** [Quarterly]
