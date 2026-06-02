# PLACEINTERN - COMPREHENSIVE DOCUMENTATION

## PSBTE Digital Education Ecosystem

---

**Document Type:** Complete Technical & Business Documentation
**Version:** 3.0
**Date:** June 2026
**For:** Punjab State Board of Technical Education
**Classification:** Board-Level Documentation

---

# TABLE OF CONTENTS

1. [Executive Overview](#1-executive-overview)
2. [Current Platform Status](#2-current-platform-status)
3. [Technical Architecture](#3-technical-architecture)
4. [Existing Modules (Deployed)](#4-existing-modules-deployed)
5. [Future Modules (Planned)](#5-future-modules-planned)
6. [Infrastructure Costing](#6-infrastructure-costing)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Security & Compliance](#8-security--compliance)
9. [Why PlaceIntern](#9-why-placeintern)
10. [The Ask](#10-the-ask)

---

# 1. EXECUTIVE OVERVIEW

## What is PlaceIntern?

PlaceIntern is a **production-grade, operational** College Management System designed for managing internships, training programs, faculty monitoring, and student placement across polytechnic institutions under the Punjab State Board of Technical Education (PSBTE).

## Key Achievement

**Built and maintained entirely by a single engineer** - demonstrating efficient architecture, clean code practices, and the ability to deliver enterprise-grade functionality with minimal resources.

## Current Impact

| Metric | Value |
|--------|-------|
| **Polytechnic Colleges** | 26 institutions actively using |
| **Active Students** | 1,500+ |
| **Faculty Members** | 550+ |
| **Total Users** | 2,000+ |
| **System Uptime** | 99.5%+ |
| **Monthly Cost** | ~INR 9,000 |

## The Opportunity

PlaceIntern's proven architecture can evolve from an internship management platform into a **complete PSBTE Digital Education Ecosystem** covering:

- Admissions Management
- Academic Management
- Examination Management
- Fee Management
- AI-Powered Career Guidance
- Board-Wide Analytics

**This is not a proposal for a new system. This is a proposal to scale what is already working.**

---

# 2. CURRENT PLATFORM STATUS

## Production Statistics

| Category | Details |
|----------|---------|
| **Deployment Duration** | Live with real users |
| **Database Size** | ~2-5 GB |
| **API Response Time** | <200ms average |
| **Concurrent Capacity** | 500-1,000 users |
| **Daily API Requests** | 50,000-100,000 |
| **User Roles** | 7 distinct roles |

## What's Already Working

- Real students tracking real internships
- Real teachers approving real applications
- Real principals viewing real dashboards
- Real data driving real decisions
- Real AI assistant answering natural language queries

## Architecture Ratings

| Area | Rating |
|------|--------|
| Modern Stack | 9/10 |
| Security | 9/10 |
| Architecture | 8/10 |
| Database Design | 8/10 |
| API Design | 8/10 |
| Frontend | 8/10 |

---

# 3. TECHNICAL ARCHITECTURE

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.0.0 | UI Framework |
| Vite | 7.3.0 | Build Tool |
| Ant Design | 6.1.3 | UI Components |
| Tailwind CSS | 4.0.0 | Styling |
| Redux Toolkit | 2.5.0 | State Management |
| React Router | 7.1.1 | Routing |
| Socket.io Client | 4.8.3 | Real-time Communication |
| Recharts/Chart.js | Latest | Data Visualization |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 11.1.11 | API Framework |
| Prisma | 7.2.0 | ORM |
| TypeScript | 5.x | Type Safety |
| Passport | 11.0.5 | Authentication |
| Throttler | 6.4.0 | Rate Limiting |
| Terminus | 11.0.0 | Health Checks |
| BullMQ | 11.0.4 | Job Queues |

### Database & Storage
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 18 | Primary Database |
| DragonflyDB | Latest | Redis-compatible Cache |
| MinIO | Latest | S3-compatible Object Storage |

### AI/ML
| Technology | Version | Purpose |
|------------|---------|---------|
| LangChain | 1.1.48 | AI Framework |
| LangGraph | 1.3.2 | Agent Workflows |
| OpenAI GPT-4o-mini | Latest | Natural Language Processing |

## Deployment Architecture

```
                    Internet
                       |
                   [Nginx]
                  SSL Termination
                       |
        +--------------+--------------+
        |                             |
   [React Frontend]            [NestJS Backend]
   (Nginx Container)           (PM2 Cluster x2)
        |                             |
        |              +--------------+--------------+
        |              |              |              |
                  [PostgreSQL]  [DragonflyDB]    [MinIO]
                    Database       Cache         Storage
```

## Docker Infrastructure (~5GB Total)

| Container | Memory | Purpose |
|-----------|--------|---------|
| Backend | 1.5GB | NestJS + PM2 (2 instances) |
| Frontend | 512MB | React + Nginx |
| PostgreSQL | 2GB | Database (optimized) |
| DragonflyDB | 768MB | Redis-compatible cache |
| MinIO | 512MB | S3-compatible storage |

## Database Schema

**Total Models: 44+** including:
- User, Student, Institution, Branch, Batch
- InternshipApplication, MonthlyReport, FacultyVisitLog
- MentorAssignment, Training, TrainingApplication
- Grievance, SupportTicket, AuditLog
- Notification, SystemAlert, and more

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| NestJS over Express | Enterprise features, TypeScript-first, modularity |
| Prisma over TypeORM | Type safety, better migrations, excellent DX |
| PostgreSQL over MySQL | Full-text search, JSON support, extensions |
| DragonflyDB over Redis | Drop-in replacement, better memory efficiency |
| MinIO over cloud storage | Self-hosted, S3-compatible, no vendor lock-in |
| Docker Compose over K8s | Simpler for current scale, easy to maintain |
| Monolith over microservices | Faster development, easier deployment |

---

# 4. EXISTING MODULES (DEPLOYED)

All modules below are **fully implemented and currently in production**.

---

## 4.1 User Management Module

**Location:** `backend/src/core/auth/`, `backend/src/domain/user/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Multi-Role Authentication | 7 roles: Student, Faculty, Coordinator, Principal, State Admin, System Admin, Super Admin | Complete |
| JWT Session Management | Access tokens (30 min) + Refresh tokens (7 days) | Complete |
| MFA/2FA Support | TOTP-based two-factor authentication | Complete |
| Password Policies | History tracking, expiry, complexity requirements | Complete |
| Profile Management | User profiles with verification | Complete |
| RBAC | Role-based access control with granular permissions | Complete |
| Audit Trail | All login/logout and critical actions logged | Complete |
| Account Lockout | Failed login attempt protection | Complete |
| Session Management | Device tracking, force logout capability | Complete |
| Google OAuth | Social login integration | Complete |

---

## 4.2 Student Management Module

**Location:** `backend/src/api/student-portal/`, `backend/src/domain/academic/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Student Profiles | Personal/academic information management | Complete |
| Document Upload | MinIO-based secure document storage | Complete |
| Document Verification | Workflow for verifying uploaded documents | Complete |
| Batch Management | Batch creation and student enrollment | Complete |
| Scholarship Tracking | FWS, PMS, CMS scholarship management | Complete |
| PPO Tracking | Pre-Placement Offer management | Complete |
| Placement Interests | Student preferences for placements | Complete |
| Academic Results | Semester-wise result tracking | Complete |
| Semester Progression | Track student academic journey | Complete |
| Clearance Status | Exit/completion clearance management | Complete |

---

## 4.3 Faculty Management Module

**Location:** `backend/src/api/faculty/`, `backend/src/domain/mentor/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Faculty Profiles | Qualifications, experience tracking | Complete |
| Branch Assignment | Assignment to specific departments | Complete |
| 20+ Designations | Support for various faculty roles | Complete |
| Guest Teacher Tracking | Non-permanent faculty management | Complete |
| Training Applications | Faculty training requests | Complete |
| Mentor Assignments | Student mentorship mapping | Complete |
| Visit Logging | Internship visit records | Complete |
| Monthly Report Reviews | Review student progress reports | Complete |
| Training Attendance | Track faculty training participation | Complete |

---

## 4.4 Internship Management Module

**Location:** `backend/src/domain/internship/`, `backend/src/domain/report/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Internship Applications | Multi-step application workflow | Complete |
| Self-Identified Internships | Students can register own internships | Complete |
| Joining Letters | Generate/upload joining documentation | Complete |
| Mentor Assignment | Assign faculty mentors to students | Complete |
| Monthly Progress Reports | Students submit monthly updates | Complete |
| Faculty Visit Tracking | GPS-based visit verification | Complete |
| Photo Documentation | Visit photos with timestamps | Complete |
| Principal Feedback | Principal review of student progress | Complete |
| Completion Tracking | Track internship completion status | Complete |
| Certificate Generation | Completion certificates | Complete |
| Expected Cycle Management | Manage internship batches/cycles | Complete |

---

## 4.5 Training & Development Module

**Location:** `backend/src/domain/training/`, `backend/src/api/*/training/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Training Course Creation | Create and manage training programs | Complete |
| Training Calendar | Schedule and view training events | Complete |
| Application Submission | Faculty apply for trainings | Complete |
| Application Approval | Multi-level approval workflow | Complete |
| Location-Based Attendance | GPS-verified attendance | Complete |
| Pre-Assessment Tests | Timed tests before training | Complete |
| Post-Assessment Tests | Timed tests after training | Complete |
| Feedback Forms | Collect participant feedback | Complete |
| Lesson Plan Management | Training curriculum planning | Complete |
| Certificate Generation | Training completion certificates | Complete |
| Training Recommendations | AI-powered training suggestions | Complete |

---

## 4.6 Institution Management Module

**Location:** `backend/src/domain/institution/`, `backend/src/api/principal/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| College Profiles | Complete institution details | Complete |
| Branch Management | Department/branch CRUD | Complete |
| Intake Capacity | Student intake limits by branch | Complete |
| Staff Capacity | Faculty strength management | Complete |
| Coordinator Assignments | TPO/HOD assignments | Complete |
| Principal Dashboard | Institution-level analytics | Complete |
| Multi-College Support | 26 colleges currently | Complete |

---

## 4.7 Reporting & Analytics Module

**Location:** `backend/src/domain/report/`, `backend/src/api/shared/reports.service.ts`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Custom Report Builder | Build reports with filters | Complete |
| Report Templates | Pre-built report formats | Complete |
| State-Level Reports | Aggregated state statistics | Complete |
| Compliance Reports | Regulatory compliance tracking | Complete |
| Role-Specific Dashboards | Customized views per role | Complete |
| Internship Statistics | Comprehensive internship analytics | Complete |
| Training Analytics | Training program metrics | Complete |
| Excel Export | Download data as Excel | Complete |
| PDF Export | Generate PDF reports | Complete |
| Real-Time Updates | Live dashboard data | Complete |

---

## 4.8 Support Systems Module

**Location:** `backend/src/domain/support/`, `backend/src/infrastructure/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Grievance Submission | Students/faculty submit issues | Complete |
| Grievance Escalation | Mentor -> Principal -> State | Complete |
| Status Tracking | Track grievance resolution | Complete |
| In-App Notifications | Real-time in-app alerts | Complete |
| Email Notifications | Nodemailer integration | Complete |
| SMS Notifications | SMS gateway integration | Complete |
| Push Notifications | FCM (Firebase) integration | Complete |
| WebSocket Support | Real-time updates via Socket.io | Complete |
| Audit Logging | Comprehensive activity logs | Complete |
| Notice Board | Announcements and notices | Complete |
| Calendar Management | Event scheduling | Complete |
| Help & Support | User assistance system | Complete |

---

## 4.9 AI Assistant Module

**Location:** `backend/src/api/state/bot/`

### Features

| Feature | Description | Status |
|---------|-------------|--------|
| Natural Language Queries | Ask questions in plain English | Complete |
| Student Count Tools | "How many students in branch X?" | Complete |
| Student List Tools | "List students with internships" | Complete |
| Filter Capabilities | Complex filtering support | Complete |
| Context-Aware Responses | Understands conversation context | Complete |
| Role-Based Access | Data access based on user role | Complete |
| Conversation History | Track past conversations | Complete |
| Query Caching | Reduce API costs with caching | Complete |
| Token Management | Track and limit token usage | Complete |
| Rate Limiting | Prevent abuse | Complete |
| Batch Query Support | Process multiple queries | Complete |

---

# 5. FUTURE MODULES (PLANNED)

These modules represent the expansion path to a complete education ecosystem.

---

## 5.1 Admission Management Module

**Target:** Months 3-5 | **Complexity:** Medium | **Effort:** 2-3 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Online Application Forms | Multi-step validation, document upload | High |
| Application Fee Collection | Payment gateway integration | High |
| Document Verification Workflow | Admin verification with approval/rejection | High |
| Merit List Generation | Category-wise ranking with reservation logic | High |
| Counselling Scheduling | Slot booking for counselling sessions | Medium |
| Seat Allocation Algorithm | Automated seat assignment based on merit | High |
| Waitlist Management | Manage waiting candidates | Medium |
| Admission Letter Generation | Auto-generate admission letters | Medium |
| Admission Statistics | Dashboard for admission analytics | Medium |

### Integration Points
- Connects with Student Management for enrolled students
- Feeds into Fee Management for fee collection
- Links to Institution Management for capacity checks

---

## 5.2 Academic Management Module

**Target:** Months 6-8 | **Complexity:** Medium | **Effort:** 2-3 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Course Catalog | Curriculum and course definitions | High |
| Subject Management | Subject CRUD with credits/hours | High |
| Timetable Generation | Auto-generate with conflict detection | Medium |
| Classroom Scheduling | Room allocation system | Medium |
| Subject-wise Attendance | Daily attendance per subject | High |
| Attendance Reports | Student/class attendance analytics | High |
| Assignment Management | Create, submit, grade assignments | Medium |
| Assignment Deadlines | Deadline tracking with reminders | Medium |
| Lesson Planning | Faculty lesson plan tools | Low |
| Learning Outcomes | Map outcomes to courses | Low |

### Integration Points
- Links to Student Management for enrollment
- Connects with Examination for internal assessments
- Feeds Faculty Management for teaching assignments

---

## 5.3 Examination Management Module

**Target:** Months 9-12 | **Complexity:** High | **Effort:** 3-4 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Exam Registration | Student registration with eligibility checks | High |
| Exam Fee Payment | Integration with payment gateway | High |
| Hall Ticket Generation | PDF with QR codes, photos | High |
| Seating Plan Algorithm | Auto-generate seating arrangements | Medium |
| Internal Marks Entry | Subject-wise internal assessment | High |
| External Marks Entry | Secure external exam marks | High |
| Marks Moderation | Review and adjust marks | High |
| SGPA/CGPA Calculation | Automated result processing | High |
| Result Publishing | Controlled result release | High |
| Marksheet Generation | PDF marksheets with security | High |
| Revaluation Requests | Apply for revaluation | Medium |
| Revaluation Processing | Track revaluation status | Medium |
| Supplementary Exams | Manage backlog examinations | Medium |

### Security Requirements
- Role-based marks entry access
- Complete audit trail for modifications
- Double verification for result publishing
- Encrypted storage for exam data

### Integration Points
- Academic Management for eligibility
- Fee Management for exam fees
- Student Management for student data

---

## 5.4 Fee Management Module

**Target:** Months 13-15 | **Complexity:** Medium-High | **Effort:** 2-3 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Fee Structure Definition | Course/category/year-wise fees | High |
| Fee Components | Tuition, hostel, lab, exam fees | High |
| Online Payment Gateway | Razorpay/PayU integration | High |
| Payment Receipt Generation | PDF receipts with QR | High |
| Payment History | Student payment records | High |
| Scholarship Management | Scholarship application and disbursement | High |
| FWS/PMS/CMS Integration | Government scholarship tracking | High |
| Refund Processing | Handle fee refunds | Medium |
| Outstanding Dues | Track pending payments | High |
| Payment Reminders | Automated SMS/email reminders | Medium |
| Financial Reports | Collection, outstanding reports | High |
| Reconciliation Tools | Bank reconciliation | Medium |

### Integration Points
- Student Management for fee assignment
- Admission Management for admission fees
- Examination Management for exam fees

---

## 5.5 Digital Services Module

**Target:** Month 16-18 | **Complexity:** Medium | **Effort:** 2 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| E-Certificate Generation | Digital certificates with QR verification | High |
| Certificate Templates | Multiple certificate formats | High |
| QR Code Verification | Public verification portal | High |
| DigiLocker Integration | Push certificates to DigiLocker | Medium |
| DigiLocker Pull | Fetch documents from DigiLocker | Medium |
| Aadhaar e-KYC | Identity verification | Medium |
| Digital Signature | DSC integration for certificates | Low |
| Bulk Certificate Operations | Mass certificate generation | Medium |
| Certificate Revocation | Revoke invalid certificates | Low |

### Integration Points
- Examination Management for marksheets
- Training Module for training certificates
- Internship Module for completion certificates

---

## 5.6 Private Polytechnic Expansion Module

**Target:** Months 19-21 | **Complexity:** Medium | **Effort:** 3 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Multi-Tenant Architecture | Isolated data per institution | High |
| College Onboarding Wizard | Self-service college setup | High |
| Subscription Plans | Tiered pricing for features | Medium |
| Custom Branding | College logo, colors | Medium |
| Feature Toggles | Enable/disable modules per college | Medium |
| Admin Documentation | Self-help guides | Medium |
| Support Ticketing | College admin support | Medium |

---

## 5.7 Board-Wide Ecosystem Module

**Target:** Months 22-24 | **Complexity:** High | **Effort:** 3 months

### Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Board Dashboard | Aggregate statistics across all colleges | High |
| Cross-College Analytics | Compare performance across institutions | High |
| Policy Compliance Tracking | Monitor regulatory compliance | High |
| State-Wide Reports | Comprehensive state-level reporting | High |
| Data Aggregation Engine | Real-time data consolidation | High |
| Export Capabilities | PDF, Excel, API exports | High |
| Performance Benchmarking | Compare colleges against benchmarks | Medium |

---

# 6. INFRASTRUCTURE COSTING

## VPS/Cloud Hosting Providers (Monthly)

### Option 1: Hostinger VPS (Recommended for Cost)

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| KVM 1 | 1 | 4GB | 50GB NVMe | ~INR 599/month |
| KVM 2 | 2 | 8GB | 100GB NVMe | ~INR 799/month |
| KVM 4 | 4 | 16GB | 200GB NVMe | ~INR 1,099/month |
| KVM 8 | 8 | 32GB | 400GB NVMe | ~INR 2,199/month |

**Hostinger Benefits:**
- NVMe SSD storage (faster I/O)
- AMD EPYC processors
- 99.9% uptime guarantee
- Free weekly backups
- Kodee AI assistant included
- India data center available
- 1 Gb/s network speed

### Option 2: Hetzner (Best Value for Performance)

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| CX22 | 2 | 4GB | 40GB | ~INR 400/month |
| CX32 | 4 | 8GB | 80GB | ~INR 1,500/month |
| CX42 | 8 | 16GB | 160GB | ~INR 3,000/month |
| CX52 | 16 | 32GB | 320GB | ~INR 6,000/month |

### Option 3: Contabo (Budget Option)

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| S | 4 | 8GB | 200GB | ~INR 800/month |
| M | 6 | 16GB | 400GB | ~INR 1,500/month |
| L | 8 | 32GB | 800GB | ~INR 3,000/month |

### Option 4: DigitalOcean (Reliable, Higher Cost)

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| Basic | 2 | 4GB | 80GB | ~INR 2,000/month |
| General | 4 | 8GB | 160GB | ~INR 4,000/month |
| CPU-Opt | 8 | 16GB | 320GB | ~INR 8,000/month |

### Option 5: AWS Lightsail

| Plan | vCPU | RAM | Storage | Price |
|------|------|-----|---------|-------|
| Small | 1 | 2GB | 60GB | ~INR 1,750/month |
| Medium | 2 | 4GB | 80GB | ~INR 3,500/month |
| Large | 4 | 8GB | 160GB | ~INR 7,000/month |

---

## Hostinger Additional Services

### Hostinger Web Hosting (If needed for static sites)

| Plan | Price | Features |
|------|-------|----------|
| Premium | INR 149/month | 100 websites, 100GB SSD |
| Business | INR 249/month | 100 websites, 200GB NVMe, Free CDN |
| Cloud Startup | INR 699/month | 300 websites, 200GB NVMe, dedicated IP |

### Hostinger Email Hosting

| Plan | Price | Features |
|------|-------|----------|
| Business Email | INR 59/month | 10GB storage, custom domain |
| Enterprise Email | INR 149/month | 30GB storage, priority support |

### Hostinger Domain Registration

| Domain | Price |
|--------|-------|
| .com | ~INR 799/year |
| .in | ~INR 499/year |
| .org | ~INR 899/year |

---

## Database Costs

| Option | Monthly Cost |
|--------|--------------|
| Self-hosted PostgreSQL (on VPS) | Included |
| Hostinger Managed MySQL | Available with hosting plans |
| DigitalOcean Managed DB | ~INR 1,500-5,000/month |
| AWS RDS | ~INR 3,000-10,000/month |

**Recommendation:** Self-hosted PostgreSQL on VPS for cost efficiency.

---

## Object Storage

| Provider | 100GB | 500GB | 1TB |
|----------|-------|-------|-----|
| Cloudflare R2 | Free (10GB) | ~INR 400 | ~INR 800 |
| Backblaze B2 | ~INR 100 | ~INR 500 | ~INR 1,000 |
| MinIO (Self-hosted) | Included in VPS | Included | Included |
| AWS S3 | ~INR 200 | ~INR 1,000 | ~INR 2,000 |

**Recommendation:** Self-hosted MinIO or Cloudflare R2 (free egress).

---

## Email Services (Monthly)

| Volume | AWS SES | SendGrid | Mailgun |
|--------|---------|----------|---------|
| 10,000 emails | ~INR 100 | ~INR 1,500 | ~INR 2,500 |
| 50,000 emails | ~INR 500 | ~INR 4,000 | ~INR 6,000 |
| 100,000 emails | ~INR 1,000 | ~INR 7,500 | ~INR 10,000 |

**Recommendation:** AWS SES - most cost-effective.

---

## SMS Services (Monthly)

| Volume | MSG91 | Fast2SMS |
|--------|-------|----------|
| 10,000 SMS | ~INR 2,000 | ~INR 1,500 |
| 50,000 SMS | ~INR 8,000 | ~INR 6,000 |
| 100,000 SMS | ~INR 14,000 | ~INR 10,000 |

**Note:** SMS is typically the highest variable cost. Use push notifications (FCM - free) when possible.

---

## AI/OpenAI Costs (Monthly)

| Users | Queries/Month | GPT-4o-mini Cost |
|-------|---------------|------------------|
| 1,000 | 5,000 | ~INR 500 |
| 5,000 | 25,000 | ~INR 2,500 |
| 10,000 | 50,000 | ~INR 5,000 |

**Note:** Implement caching to reduce costs by 50-70%.

---

## Other Costs

| Item | Cost |
|------|------|
| SSL Certificate | FREE (Let's Encrypt) |
| Domain | ~INR 500-1,000/year |
| Monitoring | FREE (Self-hosted Prometheus/Grafana) |
| Backups | ~INR 500-1,000/month |

---

## TOTAL MONTHLY COST ESTIMATES

### Current Scale (2,000 users)

| Item | Hostinger | Hetzner | DigitalOcean |
|------|-----------|---------|--------------|
| VPS (KVM 2/CX32) | INR 799 | INR 1,500 | INR 4,000 |
| Storage (Self-hosted) | INR 0 | INR 0 | INR 0 |
| Email (AWS SES) | INR 500 | INR 500 | INR 500 |
| SMS | INR 2,000 | INR 2,000 | INR 2,000 |
| AI | INR 500 | INR 500 | INR 500 |
| Backups | INR 500 | INR 500 | INR 500 |
| **TOTAL** | **~INR 4,300** | **~INR 5,000** | **~INR 7,500** |

**Current Actual Cost:** ~INR 9,000/month (with buffer and additional services)

---

### Growth Scale (10,000 users)

| Item | Hostinger | Hetzner | DigitalOcean |
|------|-----------|---------|--------------|
| VPS (2 servers) | INR 2,200 | INR 6,000 | INR 16,000 |
| Storage (R2) | INR 500 | INR 500 | INR 500 |
| Email | INR 1,000 | INR 1,000 | INR 1,000 |
| SMS | INR 8,000 | INR 8,000 | INR 8,000 |
| AI | INR 2,500 | INR 2,500 | INR 2,500 |
| Backups | INR 1,000 | INR 1,000 | INR 1,000 |
| **TOTAL** | **~INR 15,200** | **~INR 19,000** | **~INR 29,000** |

**Estimated Range:** ~INR 15,000-30,000/month

---

### Board Scale (50,000 users)

| Item | Hostinger | Hetzner | DigitalOcean |
|------|-----------|---------|--------------|
| VPS (4 servers) | INR 8,800 | INR 24,000 | INR 64,000 |
| Managed DB | INR 10,000 | INR 10,000 | INR 10,000 |
| Storage (R2) | INR 2,000 | INR 2,000 | INR 2,000 |
| CDN | INR 3,000 | INR 3,000 | INR 3,000 |
| Email | INR 3,000 | INR 3,000 | INR 3,000 |
| SMS | INR 25,000 | INR 25,000 | INR 25,000 |
| AI | INR 10,000 | INR 10,000 | INR 10,000 |
| Backups | INR 3,000 | INR 3,000 | INR 3,000 |
| **TOTAL** | **~INR 64,800** | **~INR 80,000** | **~INR 120,000** |

**Estimated Range:** ~INR 65,000-120,000/month

---

## Annual Cost Summary

| Scale | Monthly (Hostinger) | Annual |
|-------|---------------------|--------|
| Current (2K users) | ~INR 5,000 | ~INR 60,000 |
| Growth (10K users) | ~INR 15,000 | ~INR 1.8 Lakhs |
| Board (50K users) | ~INR 65,000 | ~INR 7.8 Lakhs |

---

## Cost Comparison with Enterprise ERPs

| Solution | Monthly Cost | Annual Cost |
|----------|--------------|-------------|
| **PlaceIntern (Current)** | INR 9,000 | INR 1.08 Lakhs |
| **PlaceIntern (Board Scale)** | INR 65,000-100,000 | INR 7.8-12 Lakhs |
| SAP Education | INR 5-10 Lakhs | INR 60 Lakhs - 1.2 Cr |
| Oracle Student Cloud | INR 3-8 Lakhs | INR 36-96 Lakhs |
| Custom Enterprise ERP | INR 2-5 Lakhs | INR 24-60 Lakhs |

**PlaceIntern operates at 10-100x lower cost than enterprise alternatives.**

---

## Cost Optimization Tips

1. **Use Hostinger/Hetzner** - 50-70% cheaper than AWS/DigitalOcean
2. **Self-host database** - No managed DB fees
3. **Use Cloudflare R2** - Free egress saves bandwidth costs
4. **AWS SES for email** - 10-20x cheaper than alternatives
5. **Push notifications over SMS** - FCM is free
6. **Implement AI caching** - Reduce API calls by 50-70%
7. **Optimize queries** - Reduce compute requirements

---

# 7. IMPLEMENTATION ROADMAP

## 24-Month Single-Engineer Execution Plan

### Phase 1: Optimization (Months 1-2)

| Week | Focus |
|------|-------|
| 1-2 | Performance profiling, database query optimization |
| 3-4 | Critical bug fixes, error handling improvements |
| 5-6 | UI/UX refinements, accessibility improvements |
| 7-8 | Mobile responsiveness, cross-browser testing |

**Deliverable:** Stabilized, optimized platform
**Cost:** No change (~INR 9,000/month)

---

### Phase 2: Admissions Module (Months 3-5)

| Week | Focus |
|------|-------|
| 1-2 | Database schema design, application form UI |
| 3-4 | Document upload system, file storage setup |
| 5-6 | Merit calculation logic, ranking algorithm |
| 7-8 | Document verification workflow |
| 9-10 | Seat allocation logic, waitlist management |
| 11-12 | Testing, bug fixes, deployment |

**Deliverable:** Complete online admission system
**Cost:** +INR 2,000/month (storage increase)

---

### Phase 3: Academic Management (Months 6-8)

| Week | Focus |
|------|-------|
| 1-2 | Course/subject data model, CRUD operations |
| 3-4 | Timetable scheduling UI and logic |
| 5-6 | Attendance tracking module |
| 7-8 | Assignment management system |
| 9-10 | Reports and analytics |
| 11-12 | Testing, documentation, deployment |

**Deliverable:** Academic lifecycle tracking
**Cost:** +INR 3,000/month

---

### Phase 4: Examination Module (Months 9-12)

| Week | Focus |
|------|-------|
| 1-2 | Exam registration flow, database design |
| 3-4 | Hall ticket generation (PDF templates) |
| 5-6 | Seating plan algorithm |
| 7-8 | Internal assessment marks entry |
| 9-10 | External marks entry, security controls |
| 11-12 | Result calculation engine (SGPA/CGPA) |
| 13-14 | Result publishing, marksheet generation |
| 15-16 | Revaluation workflow, testing, deployment |

**Deliverable:** End-to-end examination management
**Cost:** +INR 5,000/month (peak load handling)

---

### Phase 5: Fee Management (Months 13-15)

| Week | Focus |
|------|-------|
| 1-2 | Fee structure data model, admin UI |
| 3-4 | Payment gateway integration (Razorpay) |
| 5-6 | Receipt generation, payment history |
| 7-8 | Scholarship application workflow |
| 9-10 | Financial reports and dashboards |
| 11-12 | Reconciliation tools, testing, deployment |

**Deliverable:** Automated fee collection
**Cost:** +INR 2,000/month + payment gateway fees (~2%)

---

### Phase 6: Private Expansion (Months 19-21)

| Week | Focus |
|------|-------|
| 1-2 | Tenant isolation review, data model updates |
| 3-4 | Onboarding wizard for new colleges |
| 5-6 | Subscription plans and billing |
| 7-8 | Customization options (branding, toggles) |
| 9-10 | Documentation for college admins |
| 11-12 | Pilot with 2-3 colleges, refinements |

**Deliverable:** Multi-tenant private college support
**Cost:** Scale-dependent

---

### Phase 7: Board Ecosystem (Months 22-24)

| Week | Focus |
|------|-------|
| 1-2 | Board dashboard requirements, data aggregation |
| 3-4 | Cross-college analytics views |
| 5-6 | Compliance tracking module |
| 7-8 | State-wide report generation |
| 9-10 | Export capabilities (PDF, Excel) |
| 11-12 | Performance optimization, deployment |

**Deliverable:** Board-wide unified platform
**Cost:** ~INR 75,000-100,000/month at full scale

---

## Timeline Summary

| Phase | Duration | Cumulative | Monthly Cost |
|-------|----------|------------|--------------|
| 1. Optimization | 2 months | Month 2 | INR 9,000 |
| 2. Admissions | 3 months | Month 5 | INR 11,000 |
| 3. Academic | 3 months | Month 8 | INR 14,000 |
| 4. Examinations | 4 months | Month 12 | INR 19,000 |
| 5. Fee Management | 3 months | Month 15 | INR 21,000 |
| 6. AI Enhancement | 3 months | Month 18 | INR 26,000-31,000 |
| 7. Private Expansion | 3 months | Month 21 | Scale-dependent |
| 8. Board Ecosystem | 3 months | Month 24 | INR 75,000-100,000 |

**Total Duration:** 24 months to complete PSBTE Digital Education Ecosystem

---

## Key Milestones

| Milestone | Target |
|-----------|--------|
| 50 colleges onboarded | Month 3 |
| Admissions live for 2027 intake | Month 6 |
| 10,000+ active users | Month 12 |
| Full feature parity with enterprise ERPs | Month 18 |
| Complete board-wide deployment | Month 24 |

---

# 8. SECURITY & COMPLIANCE

## Authentication & Access Control

| Feature | Implementation |
|---------|---------------|
| JWT Authentication | Access (30 min) + Refresh (7 days) tokens |
| MFA/2FA | TOTP-based two-factor authentication |
| RBAC | 7 roles with granular permissions |
| Account Lockout | Failed login attempt protection |
| Password Policies | History, expiry, complexity |
| Session Management | Device tracking, force logout |
| Token Blacklisting | Revoke compromised tokens |

## API Security

| Feature | Implementation |
|---------|---------------|
| Rate Limiting | 100 requests/minute per IP |
| Input Validation | class-validator + Zod |
| CORS Protection | Whitelisted origins only |
| Security Headers | Helmet middleware |
| Request Tracing | X-Request-Id for debugging |
| Body Size Limit | 10MB maximum |

## Data Protection

| Feature | Implementation |
|---------|---------------|
| Password Hashing | Bcrypt with salt |
| Data Encryption | AES-256 for sensitive data |
| Audit Logging | All critical actions logged |
| Backup Encryption | Encrypted backup storage |
| SSL/TLS | Let's Encrypt certificates |

## Health Monitoring

| Endpoint | Purpose |
|----------|---------|
| /health | Basic health check |
| /health/db | Database connectivity |
| /health/redis | Cache connectivity |
| /health/memory | Memory usage |
| /health/disk | Disk usage |
| /health/detailed | Comprehensive status |
| /health/ready | Kubernetes readiness |
| /health/live | Kubernetes liveness |

---

# 9. WHY PLACEINTERN

## Five Compelling Reasons

### 1. PROVEN
- Already working in production
- 26 colleges actively using it
- 2,000+ users validating daily
- 99.5%+ uptime demonstrated

### 2. EFFICIENT
- Built by single engineer
- ~INR 9,000/month operations
- No waste, no bloat
- Lean architecture

### 3. SCALABLE
- Designed for growth
- Architecture tested for 10x
- Clear path to 50,000+ users
- Cost-efficient scaling

### 4. OWNED
- No vendor dependency
- No per-user licensing
- No renewal negotiations
- Complete roadmap control

### 5. ADAPTABLE
- Customizable for PSBTE needs
- Rapid response to changes
- Direct development access
- No contractual limitations

---

## Comparison with Alternatives

| Capability | PlaceIntern | Enterprise ERP | New Project |
|------------|-------------|----------------|-------------|
| Status | Deployed | Needs procurement | Proposal stage |
| Users | 2,000+ | Zero | Zero |
| Time to Value | Immediate | 12-24 months | 18-36 months |
| Monthly Cost | INR 9,000 | INR 2-10 Lakhs | Unknown |
| Risk | Minimal (proven) | Medium (vendor) | High (unproven) |
| Customization | Full | Limited | Full |
| Vendor Lock-in | None | High | None |

---

# 10. THE ASK

## What We Need to Scale

### 1. Official Adoption
Recognize PlaceIntern as PSBTE's official digital platform:
- Formal board resolution
- Mandate for government polytechnics
- Recommendation for private polytechnics

### 2. Infrastructure Budget

| Phase | Monthly Budget | Users Supported |
|-------|----------------|-----------------|
| Immediate | INR 15,000 | 5,000 users |
| Year 1 | INR 25,000 | 10,000 users |
| Year 2 | INR 75,000-100,000 | 50,000+ users |

### 3. Private Polytechnic Expansion
- Board communication to private colleges
- Inclusion in compliance requirements
- Integration with board processes

### 4. Board-Level Mandate
- Timeline for mandatory registration
- Compliance monitoring through platform
- Reporting requirements via dashboards

---

## Our Commitment

With board support, we will:
- Scale to all government polytechnics within 6 months
- Expand to private polytechnics within 12 months
- Add new modules as per roadmap
- Maintain cost efficiency
- Continue lean, focused development

---

## The Decision

This is not a decision about building a new system.

This is a decision about **officially supporting and scaling** a system that:
- Is already deployed
- Is already working
- Is already trusted by 26 colleges
- Is already serving 2,000+ users
- Is already demonstrating value

---

# CONCLUSION

**PlaceIntern is not a proposal. It is a proven solution ready for expansion.**

---

**Document Prepared By:** PlaceIntern Development Team
**For:** Punjab State Board of Technical Education
**Date:** June 2026
**Version:** 3.0 (Comprehensive)

---

*This document consolidates all technical, financial, and strategic information about PlaceIntern into a single comprehensive reference.*
