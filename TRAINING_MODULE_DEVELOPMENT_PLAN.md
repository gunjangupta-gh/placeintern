# Training Calendar & Development Portal - Development Plan

## Overview

This document outlines the development plan for integrating the Training Calendar & Development Portal into the existing PlaceIntern system. The plan follows existing architectural patterns to ensure seamless integration without affecting the current system.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Backend Domain Layer](#2-phase-1-backend-domain-layer)
3. [Phase 2: Backend API Layer](#3-phase-2-backend-api-layer)
4. [Phase 3: Frontend State & Services](#4-phase-3-frontend-state--services)
5. [Phase 4: Frontend UI Components](#5-phase-4-frontend-ui-components)
6. [Phase 5: Integration & Testing](#6-phase-5-integration--testing)
7. [File Structure](#7-file-structure)
8. [API Endpoints Reference](#8-api-endpoints-reference)
9. [Database Migration](#9-database-migration)

---

## 1. Architecture Overview

### Role Mapping & Permissions

| Role | Existing Role | Permissions |
|------|---------------|-------------|
| **State Director** | `STATE_DIRECTORATE` | **FULL MANAGEMENT** - Create/Edit/Delete trainings, Create/Manage feedback forms, Issue certificates, View all reports & analytics, Publish trainings |
| **Principal** | `PRINCIPAL` | **REVIEW & APPROVE** - View trainings (read-only), Approve/Reject applications from institution faculty, Review/Approve lesson plans, View institution participation reports |
| **Faculty/Teacher** | `TEACHER` | **PARTICIPATE** - View training calendar, Apply for trainings, Mark attendance, Submit feedback, Create & submit lesson plans, Download certificates |

### Permission Matrix

| Feature | State | Principal | Faculty |
|---------|:-----:|:---------:|:-------:|
| **Training Management** |
| Create Training | ✅ | ❌ | ❌ |
| Edit Training | ✅ | ❌ | ❌ |
| Delete Training | ✅ | ❌ | ❌ |
| Publish/Unpublish Training | ✅ | ❌ | ❌ |
| View Training Calendar | ✅ | ✅ | ✅ |
| View Training Details | ✅ | ✅ | ✅ |
| **Feedback Form Management** |
| Create Feedback Form | ✅ | ❌ | ❌ |
| Edit Feedback Form | ✅ | ❌ | ❌ |
| Delete Feedback Form | ✅ | ❌ | ❌ |
| Assign Form to Training | ✅ | ❌ | ❌ |
| View Feedback Forms | ✅ | ✅ (read-only) | ❌ |
| **Applications** |
| Apply for Training | ❌ | ❌ | ✅ |
| Withdraw Application | ❌ | ❌ | ✅ |
| View Own Applications | ❌ | ❌ | ✅ |
| Review/Approve Applications | ✅ (all) | ✅ (institution) | ❌ |
| **Attendance** |
| Mark Own Attendance | ❌ | ❌ | ✅ |
| View Own Attendance | ❌ | ❌ | ✅ |
| Mark Bulk Attendance | ✅ | ❌ | ❌ |
| View Attendance Reports | ✅ (all) | ✅ (institution) | ❌ |
| **Feedback Responses** |
| Submit Feedback | ❌ | ❌ | ✅ |
| View Own Feedback | ❌ | ❌ | ✅ |
| View All Feedback/Analytics | ✅ | ❌ | ❌ |
| **Lesson Plans** |
| Create Lesson Plan | ❌ | ❌ | ✅ |
| Edit Own Lesson Plan | ❌ | ❌ | ✅ |
| Submit Lesson Plan | ❌ | ❌ | ✅ |
| View Own Lesson Plans | ❌ | ❌ | ✅ |
| Review/Approve Lesson Plans | ✅ (all) | ✅ (institution) | ❌ |
| **Certificates** |
| Issue Certificates | ✅ | ❌ | ❌ |
| Revoke Certificates | ✅ | ❌ | ❌ |
| View Own Certificates | ❌ | ❌ | ✅ |
| Download Own Certificate | ❌ | ❌ | ✅ |
| **Reports & Analytics** |
| View All Reports | ✅ | ❌ | ❌ |
| View Institution Reports | ✅ | ✅ | ❌ |
| Export Data | ✅ | ✅ (institution) | ❌ |

### Integration Points

```
Existing System                    Training Module
─────────────────                  ───────────────
User Model          ◄──────────►   Training relations
Branch Model        ◄──────────►   Target disciplines
Institution Model   ◄──────────►   Participation tracking
Notification System ◄──────────►   Training notifications
Audit System        ◄──────────►   Training audit logs
File Storage        ◄──────────►   Certificates, attachments
```

---

## 2. Phase 1: Backend Domain Layer

### 2.1 Create Domain Modules

Create business logic modules following existing patterns in `src/domain/`.

#### 2.1.1 Training Domain Module

**Location:** `src/domain/training/`

```
src/domain/training/
├── training.module.ts
├── training.service.ts
├── dto/
│   ├── create-training.dto.ts
│   ├── update-training.dto.ts
│   ├── training-filter.dto.ts
│   └── index.ts
├── interfaces/
│   └── training.interface.ts
└── constants/
    └── training.constants.ts
```

**Key Service Methods:**

```typescript
// training.service.ts
class TrainingService {
  // CRUD Operations
  create(dto: CreateTrainingDto, userId: string): Promise<Training>
  findAll(filters: TrainingFilterDto): Promise<PaginatedResult<Training>>
  findOne(id: string): Promise<Training>
  update(id: string, dto: UpdateTrainingDto): Promise<Training>
  delete(id: string): Promise<void>

  // Calendar Operations
  getCalendar(year: number, month?: number, branchIds?: string[]): Promise<Training[]>
  getUpcoming(limit: number): Promise<Training[]>

  // Publishing
  publish(id: string): Promise<Training>
  unpublish(id: string): Promise<Training>

  // Statistics
  getTrainingStats(trainingId: string): Promise<TrainingStats>
}
```

#### 2.1.2 Training Application Domain Module

**Location:** `src/domain/training-application/`

```
src/domain/training-application/
├── training-application.module.ts
├── training-application.service.ts
├── dto/
│   ├── create-application.dto.ts
│   ├── review-application.dto.ts
│   └── application-filter.dto.ts
└── interfaces/
    └── application.interface.ts
```

**Key Service Methods:**

```typescript
// training-application.service.ts
class TrainingApplicationService {
  // Faculty Operations
  apply(trainingId: string, dto: CreateApplicationDto, userId: string): Promise<TrainingApplication>
  withdraw(applicationId: string, userId: string): Promise<void>
  getMyApplications(userId: string, filters: ApplicationFilterDto): Promise<TrainingApplication[]>

  // Review Operations (Principal/State)
  review(applicationId: string, dto: ReviewApplicationDto, reviewerId: string): Promise<TrainingApplication>
  bulkReview(applicationIds: string[], status: ApplicationStatus, reviewerId: string): Promise<void>

  // Queries
  getApplicationsByTraining(trainingId: string, status?: ApplicationStatus): Promise<TrainingApplication[]>
  getApplicationsByInstitution(institutionId: string, filters: ApplicationFilterDto): Promise<TrainingApplication[]>

  // Capacity Check
  checkCapacity(trainingId: string): Promise<{ available: number; total: number }>
}
```

#### 2.1.3 Training Attendance Domain Module

**Location:** `src/domain/training-attendance/`

```
src/domain/training-attendance/
├── training-attendance.module.ts
├── training-attendance.service.ts
├── dto/
│   ├── mark-attendance.dto.ts
│   └── attendance-filter.dto.ts
└── interfaces/
    └── attendance.interface.ts
```

**Key Service Methods:**

```typescript
// training-attendance.service.ts
class TrainingAttendanceService {
  // Mark Attendance
  markAttendance(trainingId: string, userId: string, dto: MarkAttendanceDto): Promise<TrainingAttendance>
  markBulkAttendance(trainingId: string, userIds: string[], date: Date): Promise<void>

  // Queries
  getAttendanceByTraining(trainingId: string, date?: Date): Promise<TrainingAttendance[]>
  getAttendanceByUser(userId: string): Promise<TrainingAttendance[]>
  getAttendanceReport(trainingId: string): Promise<AttendanceReport>

  // Verification
  verifyAttendance(trainingId: string, userId: string): Promise<boolean>
}
```

#### 2.1.4 Feedback Domain Module

**Location:** `src/domain/feedback/`

```
src/domain/feedback/
├── feedback.module.ts
├── feedback-form.service.ts
├── feedback-response.service.ts
├── dto/
│   ├── create-feedback-form.dto.ts
│   ├── update-feedback-form.dto.ts
│   ├── submit-feedback.dto.ts
│   └── feedback-filter.dto.ts
└── interfaces/
    ├── feedback-form.interface.ts
    └── feedback-response.interface.ts
```

**Key Service Methods:**

```typescript
// feedback-form.service.ts
class FeedbackFormService {
  create(dto: CreateFeedbackFormDto, userId: string): Promise<FeedbackForm>
  findAll(purpose?: FeedbackFormPurpose): Promise<FeedbackForm[]>
  findOne(id: string): Promise<FeedbackForm>
  update(id: string, dto: UpdateFeedbackFormDto): Promise<FeedbackForm>
  delete(id: string): Promise<void>
  publish(id: string): Promise<FeedbackForm>
  duplicate(id: string, newTitle: string): Promise<FeedbackForm>
}

// feedback-response.service.ts
class FeedbackResponseService {
  submit(dto: SubmitFeedbackDto, userId: string): Promise<FeedbackResponse>
  getByTraining(trainingId: string): Promise<FeedbackResponse[]>
  getByUser(userId: string): Promise<FeedbackResponse[]>
  getAggregatedResults(feedbackFormId: string, trainingId?: string): Promise<AggregatedFeedback>
  hasSubmitted(userId: string, feedbackFormId: string, trainingId?: string): Promise<boolean>
}
```

#### 2.1.5 Lesson Plan Domain Module

**Location:** `src/domain/lesson-plan/`

```
src/domain/lesson-plan/
├── lesson-plan.module.ts
├── lesson-plan.service.ts
├── dto/
│   ├── create-lesson-plan.dto.ts
│   ├── update-lesson-plan.dto.ts
│   ├── review-lesson-plan.dto.ts
│   └── lesson-plan-filter.dto.ts
└── interfaces/
    └── lesson-plan.interface.ts
```

**Key Service Methods:**

```typescript
// lesson-plan.service.ts
class LessonPlanService {
  // Faculty Operations
  create(dto: CreateLessonPlanDto, userId: string): Promise<LessonPlan>
  update(id: string, dto: UpdateLessonPlanDto, userId: string): Promise<LessonPlan>
  submit(id: string, userId: string): Promise<LessonPlan>
  getMyLessonPlans(userId: string, filters: LessonPlanFilterDto): Promise<LessonPlan[]>

  // Review Operations (Principal/State)
  review(id: string, dto: ReviewLessonPlanDto, reviewerId: string): Promise<LessonPlan>
  getForReview(institutionId?: string, status?: LessonPlanStatus): Promise<LessonPlan[]>

  // Queries
  getByTraining(trainingId: string): Promise<LessonPlan[]>
  getPendingCount(userId: string): Promise<number>
  getOverdue(userId: string): Promise<LessonPlan[]>
}
```

#### 2.1.6 Training Certificate Domain Module

**Location:** `src/domain/training-certificate/`

```
src/domain/training-certificate/
├── training-certificate.module.ts
├── training-certificate.service.ts
├── dto/
│   ├── issue-certificate.dto.ts
│   └── certificate-filter.dto.ts
├── templates/
│   └── certificate.template.hbs
└── interfaces/
    └── certificate.interface.ts
```

**Key Service Methods:**

```typescript
// training-certificate.service.ts
class TrainingCertificateService {
  // Issuance
  issue(trainingId: string, userId: string, issuerId: string): Promise<TrainingCertificate>
  bulkIssue(trainingId: string, userIds: string[], issuerId: string): Promise<void>

  // Generation
  generateCertificatePdf(certificateId: string): Promise<Buffer>

  // Queries
  getMyCertificates(userId: string): Promise<TrainingCertificate[]>
  getByTraining(trainingId: string): Promise<TrainingCertificate[]>

  // Verification
  verify(certificateNumber: string): Promise<CertificateVerification>

  // Revocation
  revoke(certificateId: string, reason: string): Promise<void>

  // Download tracking
  trackDownload(certificateId: string): Promise<void>
}
```

---

## 3. Phase 2: Backend API Layer

### 3.1 State Directorate API Module (FULL MANAGEMENT)

**Location:** `src/api/state/training/`

```
src/api/state/training/
├── state-training.module.ts
├── state-training.controller.ts        # Training CRUD + Publishing
├── state-feedback-form.controller.ts   # Feedback Form CRUD (State Only)
├── state-application.controller.ts     # Application review (all institutions)
├── state-lesson-plan.controller.ts     # Lesson plan review (all institutions)
├── state-attendance.controller.ts      # Attendance management
├── state-certificate.controller.ts     # Certificate issuance
└── state-reports.controller.ts         # Reports & Analytics
```

**Endpoints:**

```typescript
// state-training.controller.ts - TRAINING CRUD (State Only)
@Controller('state/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateTrainingController {
  // Training CRUD - STATE ONLY
  @Post()                           // Create training
  @Get()                            // List all trainings
  @Get(':id')                       // Get training details
  @Patch(':id')                     // Update training
  @Delete(':id')                    // Delete training
  @Post(':id/publish')              // Publish training
  @Post(':id/unpublish')            // Unpublish training
}

// state-feedback-form.controller.ts - FEEDBACK FORM CRUD (State Only)
@Controller('state/feedback-forms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateFeedbackFormController {
  // Feedback Form CRUD - STATE ONLY
  @Post()                           // Create feedback form
  @Get()                            // List all feedback forms
  @Get(':id')                       // Get form details
  @Patch(':id')                     // Update form
  @Delete(':id')                    // Delete form
  @Post(':id/publish')              // Publish form
  @Post(':id/duplicate')            // Duplicate form
  @Post(':id/assign/:trainingId')   // Assign form to training
}

// state-application.controller.ts - APPLICATION REVIEW (All Institutions)
@Controller('state/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateApplicationController {
  @Get(':id/applications')          // Get all applications for training
  @Get('applications')              // Get all applications (with filters)
  @Patch('applications/:id/review') // Review single application
  @Post('applications/bulk-review') // Bulk review applications
}

// state-attendance.controller.ts - ATTENDANCE MANAGEMENT
@Controller('state/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateAttendanceController {
  @Get(':id/attendance')            // Get attendance report
  @Post(':id/attendance/mark')      // Bulk mark attendance
  @Get('attendance/report')         // Overall attendance report
}

// state-certificate.controller.ts - CERTIFICATE ISSUANCE (State Only)
@Controller('state/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateCertificateController {
  @Post(':id/certificates/issue')   // Issue certificates
  @Post(':id/certificates/bulk-issue') // Bulk issue certificates
  @Get(':id/certificates')          // List certificates for training
  @Patch('certificates/:id/revoke') // Revoke certificate
  @Get('certificates/:number/verify') // Verify certificate
}

// state-lesson-plan.controller.ts - LESSON PLAN REVIEW (All Institutions)
@Controller('state/lesson-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateLessonPlanController {
  @Get()                            // Get all lesson plans (with filters)
  @Get(':id')                       // Get lesson plan details
  @Patch(':id/review')              // Review lesson plan
}

// state-reports.controller.ts - REPORTS & ANALYTICS (State Only)
@Controller('state/training/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STATE_DIRECTORATE)
export class StateReportsController {
  @Get('dashboard')                 // Dashboard statistics
  @Get('participation')             // Participation report (all institutions)
  @Get('feedback-analysis')         // Feedback analytics
  @Get('lesson-plan-compliance')    // Lesson plan submission compliance
  @Get('institution-wise')          // Institution-wise breakdown
  @Get('export')                    // Export reports
}
```

### 3.2 Principal API Module (VIEW & APPROVE - Institution Scope Only)

**Location:** `src/api/principal/training/`

```
src/api/principal/training/
├── principal-training.module.ts
├── principal-training.controller.ts    # View trainings (READ-ONLY)
├── principal-application.controller.ts # Review applications (institution only)
├── principal-lesson-plan.controller.ts # Review lesson plans (institution only)
└── principal-reports.controller.ts     # Institution reports
```

**Endpoints:**

```typescript
// principal-training.controller.ts - VIEW ONLY (No Create/Edit/Delete)
@Controller('principal/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalTrainingController {
  // View Trainings - READ ONLY
  @Get('calendar')                  // View training calendar
  @Get('calendar/:year/:month')     // Month-specific calendar
  @Get('upcoming')                  // Upcoming trainings
  @Get(':id')                       // View training details (no edit)

  // View Feedback Forms - READ ONLY (no create/edit)
  @Get('feedback-forms')            // View available feedback forms
  @Get('feedback-forms/:id')        // View form details
}

// principal-application.controller.ts - REVIEW APPLICATIONS (Institution Faculty Only)
@Controller('principal/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalApplicationController {
  // Applications - Institution Faculty Only
  @Get('applications')              // Get applications from institution faculty
  @Get('applications/:id')          // Application details
  @Patch('applications/:id/review') // Approve/Reject application
  @Post('applications/bulk-review') // Bulk approve/reject

  // Attendance - Institution Faculty Only (View)
  @Get('attendance')                // Institution faculty attendance records
  @Get(':id/attendance')            // Attendance for specific training
}

// principal-lesson-plan.controller.ts - REVIEW LESSON PLANS (Institution Faculty Only)
@Controller('principal/lesson-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalLessonPlanController {
  // Lesson Plans - Institution Faculty Only
  @Get()                            // Get lesson plans from institution faculty
  @Get(':id')                       // View lesson plan details
  @Patch(':id/review')              // Review/Approve lesson plan
}

// principal-reports.controller.ts - INSTITUTION REPORTS ONLY
@Controller('principal/training/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PRINCIPAL)
export class PrincipalReportsController {
  @Get('dashboard')                 // Institution training dashboard
  @Get('participation')             // Institution participation stats
  @Get('faculty-summary')           // Faculty-wise training summary
  @Get('compliance')                // Lesson plan compliance (institution)
  @Get('export')                    // Export institution reports
}
```

### 3.3 Faculty API Module (PARTICIPANT - Own Data Only)

**Location:** `src/api/faculty/training/`

```
src/api/faculty/training/
├── faculty-training.module.ts
├── faculty-training.controller.ts      # View calendar, Apply
├── faculty-attendance.controller.ts    # Mark own attendance
├── faculty-feedback.controller.ts      # Submit feedback
├── faculty-lesson-plan.controller.ts   # Create/manage own lesson plans
└── faculty-certificate.controller.ts   # View/download own certificates
```

**Endpoints:**

```typescript
// faculty-training.controller.ts - VIEW & APPLY
@Controller('faculty/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyTrainingController {
  // Calendar & Discovery - VIEW ONLY
  @Get('calendar')                  // View training calendar
  @Get('calendar/:year/:month')     // Month-specific calendar
  @Get('upcoming')                  // Upcoming trainings
  @Get(':id')                       // Training details

  // Applications - OWN ONLY
  @Post(':id/apply')                // Apply for training
  @Delete('applications/:id')       // Withdraw own application
  @Get('my-applications')           // My applications only

  // Dashboard
  @Get('dashboard')                 // My training dashboard
}

// faculty-attendance.controller.ts - MARK OWN ATTENDANCE
@Controller('faculty/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyAttendanceController {
  // Attendance - OWN ONLY
  @Post(':id/attendance/mark')      // Mark my attendance
  @Get('my-attendance')             // My attendance history only
}

// faculty-feedback.controller.ts - SUBMIT FEEDBACK
@Controller('faculty/training')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyFeedbackController {
  // Feedback - SUBMIT ONLY (no view others)
  @Get(':id/feedback/form')         // Get feedback form for training
  @Post(':id/feedback')             // Submit my feedback
  @Get(':id/feedback/my')           // View my submitted feedback
}

// faculty-lesson-plan.controller.ts - CREATE & MANAGE OWN LESSON PLANS
@Controller('faculty/lesson-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyLessonPlanController {
  // Lesson Plans - OWN ONLY
  @Post()                           // Create lesson plan
  @Get()                            // My lesson plans only
  @Get(':id')                       // My lesson plan details
  @Patch(':id')                     // Update my lesson plan (if draft)
  @Post(':id/submit')               // Submit for review
  @Get('pending')                   // My pending lesson plans
  @Get('overdue')                   // My overdue lesson plans
}

// faculty-certificate.controller.ts - VIEW & DOWNLOAD OWN CERTIFICATES
@Controller('faculty/certificates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class FacultyCertificateController {
  // Certificates - OWN ONLY
  @Get()                            // My certificates only
  @Get(':id')                       // My certificate details
  @Get(':id/download')              // Download my certificate
}
```

### 3.4 Note on Feedback Forms

> **Important:** Feedback Forms are managed exclusively by State Directorate.
> - **Create/Edit/Delete:** State only (`/api/state/feedback-forms`)
> - **View (read-only):** Principal can view (`/api/principal/training/feedback-forms`)
> - **Faculty:** Cannot see feedback form templates, only fills the form when submitting feedback

---

## 4. Phase 3: Frontend State & Services

### 4.1 Redux Slice for Training

**Location:** `src/features/training/store/trainingSlice.js`

```javascript
// trainingSlice.js
const initialState = {
  // Calendar
  calendar: {
    trainings: [],
    loading: false,
    error: null,
    lastFetched: null,
  },

  // Selected Training
  currentTraining: {
    data: null,
    loading: false,
    error: null,
  },

  // Applications
  applications: {
    list: [],
    loading: false,
    error: null,
    lastFetched: null,
  },

  // Attendance
  attendance: {
    records: [],
    loading: false,
    error: null,
  },

  // Lesson Plans
  lessonPlans: {
    list: [],
    loading: false,
    error: null,
    lastFetched: null,
  },

  // Certificates
  certificates: {
    list: [],
    loading: false,
    error: null,
  },

  // Dashboard Stats
  dashboard: {
    stats: null,
    loading: false,
    error: null,
    lastFetched: null,
  },

  // Filters
  filters: {
    year: new Date().getFullYear(),
    month: null,
    branchIds: [],
    deliveryMode: null,
    status: null,
  },
};

// Async Thunks
export const fetchTrainingCalendar = createAsyncThunk(...)
export const fetchTrainingDetails = createAsyncThunk(...)
export const applyForTraining = createAsyncThunk(...)
export const fetchMyApplications = createAsyncThunk(...)
export const markAttendance = createAsyncThunk(...)
export const submitFeedback = createAsyncThunk(...)
export const fetchLessonPlans = createAsyncThunk(...)
export const submitLessonPlan = createAsyncThunk(...)
export const fetchCertificates = createAsyncThunk(...)
export const fetchDashboardStats = createAsyncThunk(...)
```

### 4.2 API Services

**Location:** `src/services/training.service.js`

```javascript
// training.service.js
import apiClient from './api';

const TrainingService = {
  // Calendar
  getCalendar: (year, month, filters) =>
    apiClient.get('/faculty/training/calendar', { params: { year, month, ...filters } }),

  getUpcoming: (limit = 5) =>
    apiClient.get('/faculty/training/upcoming', { params: { limit } }),

  getTrainingDetails: (id) =>
    apiClient.get(`/faculty/training/${id}`),

  // Applications
  apply: (trainingId, data) =>
    apiClient.post(`/faculty/training/${trainingId}/apply`, data),

  withdrawApplication: (applicationId) =>
    apiClient.delete(`/faculty/training/applications/${applicationId}`),

  getMyApplications: (filters) =>
    apiClient.get('/faculty/training/my-applications', { params: filters }),

  // Attendance
  markAttendance: (trainingId) =>
    apiClient.post(`/faculty/training/${trainingId}/attendance/mark`),

  getMyAttendance: () =>
    apiClient.get('/faculty/training/my-attendance'),

  // Feedback
  getFeedbackForm: (trainingId) =>
    apiClient.get(`/faculty/training/${trainingId}/feedback/form`),

  submitFeedback: (trainingId, responses) =>
    apiClient.post(`/faculty/training/${trainingId}/feedback`, { responses }),

  // Lesson Plans
  createLessonPlan: (data) =>
    apiClient.post('/faculty/training/lesson-plans', data),

  updateLessonPlan: (id, data) =>
    apiClient.patch(`/faculty/training/lesson-plans/${id}`, data),

  submitLessonPlan: (id) =>
    apiClient.post(`/faculty/training/lesson-plans/${id}/submit`),

  getMyLessonPlans: (filters) =>
    apiClient.get('/faculty/training/lesson-plans', { params: filters }),

  // Certificates
  getMyCertificates: () =>
    apiClient.get('/faculty/training/certificates'),

  downloadCertificate: (id) =>
    apiClient.get(`/faculty/training/certificates/${id}/download`, { responseType: 'blob' }),

  // Dashboard
  getDashboard: () =>
    apiClient.get('/faculty/training/dashboard'),
};

export default TrainingService;
```

**Location:** `src/services/training-admin.service.js`

```javascript
// training-admin.service.js (for State Directorate)
import apiClient from './api';

const TrainingAdminService = {
  // Training CRUD
  createTraining: (data) => apiClient.post('/state/training', data),
  updateTraining: (id, data) => apiClient.patch(`/state/training/${id}`, data),
  deleteTraining: (id) => apiClient.delete(`/state/training/${id}`),
  publishTraining: (id) => apiClient.post(`/state/training/${id}/publish`),

  // Applications
  getApplications: (trainingId, filters) =>
    apiClient.get(`/state/training/${trainingId}/applications`, { params: filters }),

  reviewApplications: (trainingId, data) =>
    apiClient.post(`/state/training/${trainingId}/applications/review`, data),

  // Attendance
  getAttendanceReport: (trainingId) =>
    apiClient.get(`/state/training/${trainingId}/attendance`),

  markBulkAttendance: (trainingId, userIds) =>
    apiClient.post(`/state/training/${trainingId}/attendance/mark`, { userIds }),

  // Certificates
  issueCertificates: (trainingId, userIds) =>
    apiClient.post(`/state/training/${trainingId}/certificates/issue`, { userIds }),

  // Reports
  getDashboardStats: () => apiClient.get('/state/training/dashboard/stats'),
  getParticipationReport: (filters) =>
    apiClient.get('/state/training/reports/participation', { params: filters }),
  getFeedbackAnalysis: (trainingId) =>
    apiClient.get('/state/training/reports/feedback-analysis', { params: { trainingId } }),

  // Feedback Forms
  createFeedbackForm: (data) => apiClient.post('/shared/feedback/forms', data),
  getFeedbackForms: () => apiClient.get('/shared/feedback/forms'),
  updateFeedbackForm: (id, data) => apiClient.patch(`/shared/feedback/forms/${id}`, data),
  deleteFeedbackForm: (id) => apiClient.delete(`/shared/feedback/forms/${id}`),
};

export default TrainingAdminService;
```

---

## 5. Phase 4: Frontend UI Components

### 5.1 Faculty Training Feature

**Location:** `src/features/faculty/training/`

```
src/features/faculty/training/
├── index.js                          # Feature exports
├── pages/
│   ├── TrainingCalendarPage.jsx      # Main calendar view
│   ├── TrainingDetailsPage.jsx       # Training details & apply
│   ├── MyApplicationsPage.jsx        # Application tracking
│   ├── MyLessonPlansPage.jsx         # Lesson plan management
│   ├── LessonPlanEditorPage.jsx      # Create/edit lesson plan
│   ├── MyCertificatesPage.jsx        # Certificate downloads
│   └── TrainingDashboardPage.jsx     # Training overview
├── components/
│   ├── calendar/
│   │   ├── TrainingCalendar.jsx      # Calendar component
│   │   ├── CalendarFilters.jsx       # Filter controls
│   │   ├── TrainingCard.jsx          # Training session card
│   │   └── CalendarLegend.jsx        # Color legend
│   ├── application/
│   │   ├── ApplicationForm.jsx       # Apply for training
│   │   ├── ApplicationCard.jsx       # Application status card
│   │   └── ApplicationTimeline.jsx   # Status timeline
│   ├── attendance/
│   │   ├── AttendanceMarker.jsx      # Mark attendance button
│   │   └── AttendanceHistory.jsx     # Attendance records
│   ├── feedback/
│   │   ├── FeedbackForm.jsx          # Dynamic feedback form
│   │   ├── RatingInput.jsx           # Star/scale rating
│   │   └── FeedbackSuccess.jsx       # Submission success
│   ├── lesson-plan/
│   │   ├── LessonPlanForm.jsx        # Lesson plan editor
│   │   ├── LessonPlanCard.jsx        # Plan summary card
│   │   └── LessonPlanStatus.jsx      # Status badge
│   └── certificate/
│       ├── CertificateCard.jsx       # Certificate display
│       └── CertificateDownload.jsx   # Download button
└── hooks/
    ├── useTrainingCalendar.js
    ├── useTrainingApplication.js
    └── useLessonPlan.js
```

### 5.2 Principal Training Feature

**Location:** `src/features/principal/training/`

```
src/features/principal/training/
├── index.js
├── pages/
│   ├── TrainingOverviewPage.jsx      # Institution training overview
│   ├── ApplicationReviewPage.jsx     # Review faculty applications
│   ├── LessonPlanReviewPage.jsx      # Review lesson plans
│   └── ParticipationReportPage.jsx   # Participation analytics
├── components/
│   ├── ApplicationReviewTable.jsx    # Applications list with actions
│   ├── ApplicationReviewModal.jsx    # Review modal
│   ├── LessonPlanReviewTable.jsx     # Lesson plans for review
│   ├── LessonPlanReviewModal.jsx     # Review modal
│   ├── ParticipationChart.jsx        # Participation metrics
│   └── FacultyTrainingStatus.jsx     # Faculty-wise status
└── hooks/
    ├── useApplicationReview.js
    └── useLessonPlanReview.js
```

### 5.3 State Directorate Training Feature

**Location:** `src/features/state/training/`

```
src/features/state/training/
├── index.js
├── pages/
│   ├── TrainingManagementPage.jsx    # Training CRUD
│   ├── CreateTrainingPage.jsx        # Create new training
│   ├── EditTrainingPage.jsx          # Edit training
│   ├── TrainingDetailsPage.jsx       # View with admin actions
│   ├── ApplicationManagementPage.jsx # Manage applications
│   ├── AttendanceManagementPage.jsx  # Manage attendance
│   ├── CertificateManagementPage.jsx # Issue certificates
│   ├── FeedbackFormManagementPage.jsx# Manage feedback forms
│   ├── FeedbackAnalyticsPage.jsx     # Analyze feedback
│   ├── TrainingReportsPage.jsx       # Generate reports
│   └── TrainingDashboardPage.jsx     # Admin dashboard
├── components/
│   ├── training/
│   │   ├── TrainingForm.jsx          # Create/edit form
│   │   ├── TrainingTable.jsx         # Training list
│   │   ├── BranchSelector.jsx        # Multi-select branches
│   │   └── LearningOutcomesEditor.jsx
│   ├── application/
│   │   ├── ApplicationTable.jsx      # Bulk review table
│   │   ├── BulkReviewModal.jsx       # Bulk approve/reject
│   │   └── ApplicationFilters.jsx
│   ├── attendance/
│   │   ├── AttendanceDashboard.jsx   # Real-time view
│   │   ├── AttendanceTable.jsx       # Attendance records
│   │   └── BulkAttendanceModal.jsx
│   ├── certificate/
│   │   ├── CertificateTable.jsx      # Issued certificates
│   │   ├── IssueCertificateModal.jsx # Bulk issue
│   │   └── CertificatePreview.jsx
│   ├── feedback/
│   │   ├── FeedbackFormBuilder.jsx   # Form builder UI
│   │   ├── QuestionEditor.jsx        # Question types
│   │   ├── FeedbackFormTable.jsx     # Forms list
│   │   └── FeedbackAnalytics.jsx     # Charts & insights
│   └── reports/
│       ├── ParticipationReport.jsx
│       ├── TrainingEffectivenessReport.jsx
│       └── ExportOptions.jsx
└── hooks/
    ├── useTrainingManagement.js
    ├── useFeedbackFormBuilder.js
    └── useTrainingReports.js
```

### 5.4 Shared Training Components

**Location:** `src/components/training/`

```
src/components/training/
├── TrainingStatusBadge.jsx           # Status indicator
├── DeliveryModeBadge.jsx             # Online/Offline/Hybrid
├── DifficultyBadge.jsx               # Beginner/Intermediate/Advanced
├── BranchTags.jsx                    # Target disciplines display
├── TrainingDateRange.jsx             # Date display component
├── CapacityIndicator.jsx             # Available seats
├── ApplicationDeadline.jsx           # Countdown/deadline display
├── LearningOutcomesList.jsx          # Outcomes display
└── TrainingEmptyState.jsx            # No trainings message
```

### 5.5 Route Configuration

**Add to:** `src/app/routes/AppRoutes.jsx`

```javascript
// Faculty Training Routes
{
  path: 'training',
  element: <ProtectedRoute allowedRoles={[ROLES.FACULTY]} />,
  children: [
    { index: true, element: <TrainingDashboardPage /> },
    { path: 'calendar', element: <TrainingCalendarPage /> },
    { path: ':id', element: <TrainingDetailsPage /> },
    { path: 'applications', element: <MyApplicationsPage /> },
    { path: 'lesson-plans', element: <MyLessonPlansPage /> },
    { path: 'lesson-plans/new/:trainingId', element: <LessonPlanEditorPage /> },
    { path: 'lesson-plans/:id/edit', element: <LessonPlanEditorPage /> },
    { path: 'certificates', element: <MyCertificatesPage /> },
  ],
},

// Principal Training Routes
{
  path: 'training',
  element: <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]} />,
  children: [
    { index: true, element: <TrainingOverviewPage /> },
    { path: 'applications', element: <ApplicationReviewPage /> },
    { path: 'lesson-plans', element: <LessonPlanReviewPage /> },
    { path: 'reports', element: <ParticipationReportPage /> },
  ],
},

// State Training Routes
{
  path: 'training',
  element: <ProtectedRoute allowedRoles={[ROLES.STATE]} />,
  children: [
    { index: true, element: <TrainingDashboardPage /> },
    { path: 'manage', element: <TrainingManagementPage /> },
    { path: 'create', element: <CreateTrainingPage /> },
    { path: ':id/edit', element: <EditTrainingPage /> },
    { path: ':id', element: <TrainingDetailsPage /> },
    { path: ':id/applications', element: <ApplicationManagementPage /> },
    { path: ':id/attendance', element: <AttendanceManagementPage /> },
    { path: ':id/certificates', element: <CertificateManagementPage /> },
    { path: 'feedback-forms', element: <FeedbackFormManagementPage /> },
    { path: 'analytics', element: <FeedbackAnalyticsPage /> },
    { path: 'reports', element: <TrainingReportsPage /> },
  ],
},
```

---

## 6. Phase 5: Integration & Testing

### 6.1 Notification Integration

Add training notifications to existing notification system:

```typescript
// Add to notification types
enum NotificationType {
  // ... existing types
  TRAINING_PUBLISHED = 'TRAINING_PUBLISHED',
  TRAINING_APPLICATION_STATUS = 'TRAINING_APPLICATION_STATUS',
  TRAINING_REMINDER = 'TRAINING_REMINDER',
  TRAINING_ATTENDANCE_REQUIRED = 'TRAINING_ATTENDANCE_REQUIRED',
  LESSON_PLAN_DUE = 'LESSON_PLAN_DUE',
  LESSON_PLAN_REVIEWED = 'LESSON_PLAN_REVIEWED',
  CERTIFICATE_ISSUED = 'CERTIFICATE_ISSUED',
}
```

### 6.2 Audit Integration

Add training audit actions:

```typescript
// Add to AuditAction enum
enum AuditAction {
  // ... existing actions
  TRAINING_CREATE = 'TRAINING_CREATE',
  TRAINING_UPDATE = 'TRAINING_UPDATE',
  TRAINING_DELETE = 'TRAINING_DELETE',
  TRAINING_PUBLISH = 'TRAINING_PUBLISH',
  TRAINING_APPLICATION_SUBMIT = 'TRAINING_APPLICATION_SUBMIT',
  TRAINING_APPLICATION_REVIEW = 'TRAINING_APPLICATION_REVIEW',
  TRAINING_ATTENDANCE_MARK = 'TRAINING_ATTENDANCE_MARK',
  TRAINING_FEEDBACK_SUBMIT = 'TRAINING_FEEDBACK_SUBMIT',
  LESSON_PLAN_SUBMIT = 'LESSON_PLAN_SUBMIT',
  LESSON_PLAN_REVIEW = 'LESSON_PLAN_REVIEW',
  CERTIFICATE_ISSUE = 'CERTIFICATE_ISSUE',
  CERTIFICATE_DOWNLOAD = 'CERTIFICATE_DOWNLOAD',
}
```

### 6.3 Sidebar Menu Integration

Add to existing sidebar menus:

```javascript
// Faculty Sidebar
{
  key: 'training',
  icon: <CalendarOutlined />,
  label: 'Training',
  children: [
    { key: 'training-dashboard', label: 'Dashboard', path: '/app/training' },
    { key: 'training-calendar', label: 'Calendar', path: '/app/training/calendar' },
    { key: 'my-applications', label: 'My Applications', path: '/app/training/applications' },
    { key: 'lesson-plans', label: 'Lesson Plans', path: '/app/training/lesson-plans' },
    { key: 'certificates', label: 'Certificates', path: '/app/training/certificates' },
  ],
}

// Principal Sidebar
{
  key: 'training',
  icon: <CalendarOutlined />,
  label: 'Training',
  children: [
    { key: 'training-overview', label: 'Overview', path: '/app/training' },
    { key: 'application-review', label: 'Applications', path: '/app/training/applications' },
    { key: 'lesson-plan-review', label: 'Lesson Plans', path: '/app/training/lesson-plans' },
    { key: 'training-reports', label: 'Reports', path: '/app/training/reports' },
  ],
}

// State Sidebar
{
  key: 'training',
  icon: <CalendarOutlined />,
  label: 'Training Calendar',
  children: [
    { key: 'training-dashboard', label: 'Dashboard', path: '/app/training' },
    { key: 'manage-trainings', label: 'Manage Trainings', path: '/app/training/manage' },
    { key: 'feedback-forms', label: 'Feedback Forms', path: '/app/training/feedback-forms' },
    { key: 'training-analytics', label: 'Analytics', path: '/app/training/analytics' },
    { key: 'training-reports', label: 'Reports', path: '/app/training/reports' },
  ],
}
```

### 6.4 Testing Strategy

```
Testing Layers:
├── Unit Tests
│   ├── Backend Services (Jest)
│   ├── Frontend Components (React Testing Library)
│   └── Redux Slices (Jest)
├── Integration Tests
│   ├── API Endpoints (Supertest)
│   └── Database Operations (Prisma)
├── E2E Tests (Playwright/Cypress)
│   ├── Faculty Training Flow
│   ├── Principal Review Flow
│   └── State Management Flow
└── Manual Testing
    ├── Cross-browser testing
    ├── Mobile responsiveness
    └── Role-based access verification
```

---

## 7. File Structure

### Backend Complete Structure

```
src/
├── domain/
│   ├── training/
│   │   ├── training.module.ts
│   │   ├── training.service.ts
│   │   └── dto/
│   ├── training-application/
│   │   ├── training-application.module.ts
│   │   ├── training-application.service.ts
│   │   └── dto/
│   ├── training-attendance/
│   │   ├── training-attendance.module.ts
│   │   ├── training-attendance.service.ts
│   │   └── dto/
│   ├── feedback/
│   │   ├── feedback.module.ts
│   │   ├── feedback-form.service.ts
│   │   ├── feedback-response.service.ts
│   │   └── dto/
│   ├── lesson-plan/
│   │   ├── lesson-plan.module.ts
│   │   ├── lesson-plan.service.ts
│   │   └── dto/
│   └── training-certificate/
│       ├── training-certificate.module.ts
│       ├── training-certificate.service.ts
│       ├── dto/
│       └── templates/
├── api/
│   ├── state/
│   │   └── training/
│   │       ├── state-training.module.ts
│   │       ├── state-training.controller.ts
│   │       ├── state-feedback.controller.ts
│   │       ├── state-lesson-plan.controller.ts
│   │       ├── state-certificate.controller.ts
│   │       └── state-training-reports.controller.ts
│   ├── principal/
│   │   └── training/
│   │       ├── principal-training.module.ts
│   │       ├── principal-training.controller.ts
│   │       └── principal-lesson-plan.controller.ts
│   ├── faculty/
│   │   └── training/
│   │       ├── faculty-training.module.ts
│   │       ├── faculty-training.controller.ts
│   │       ├── faculty-feedback.controller.ts
│   │       ├── faculty-lesson-plan.controller.ts
│   │       └── faculty-certificate.controller.ts
│   └── shared/
│       └── feedback/
│           ├── shared-feedback.module.ts
│           └── shared-feedback.controller.ts
```

### Frontend Complete Structure

```
src/
├── features/
│   ├── faculty/
│   │   └── training/
│   │       ├── index.js
│   │       ├── pages/
│   │       ├── components/
│   │       └── hooks/
│   ├── principal/
│   │   └── training/
│   │       ├── index.js
│   │       ├── pages/
│   │       ├── components/
│   │       └── hooks/
│   └── state/
│       └── training/
│           ├── index.js
│           ├── pages/
│           ├── components/
│           └── hooks/
├── components/
│   └── training/
│       ├── TrainingStatusBadge.jsx
│       ├── DeliveryModeBadge.jsx
│       └── ...
├── services/
│   ├── training.service.js
│   └── training-admin.service.js
└── store/
    └── slices/
        └── trainingSlice.js
```

---

## 8. API Endpoints Reference

### State Directorate Endpoints - FULL MANAGEMENT

#### Training CRUD (`/api/state/training`) - State Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create training |
| GET | `/` | List all trainings |
| GET | `/:id` | Get training details |
| PATCH | `/:id` | Update training |
| DELETE | `/:id` | Delete training |
| POST | `/:id/publish` | Publish training |
| POST | `/:id/unpublish` | Unpublish training |

#### Feedback Forms (`/api/state/feedback-forms`) - State Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create feedback form |
| GET | `/` | List all feedback forms |
| GET | `/:id` | Get form details |
| PATCH | `/:id` | Update form |
| DELETE | `/:id` | Delete form |
| POST | `/:id/publish` | Publish form |
| POST | `/:id/duplicate` | Duplicate form |
| POST | `/:id/assign/:trainingId` | Assign form to training |

#### Application Review (`/api/state/training`) - All Institutions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/applications` | Get all applications |
| GET | `/:id/applications` | Get applications for training |
| PATCH | `/applications/:id/review` | Review application |
| POST | `/applications/bulk-review` | Bulk review |

#### Attendance (`/api/state/training`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/attendance` | Get attendance report |
| POST | `/:id/attendance/mark` | Bulk mark attendance |
| GET | `/attendance/report` | Overall attendance report |

#### Certificates (`/api/state/training`) - State Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/certificates/issue` | Issue certificates |
| POST | `/:id/certificates/bulk-issue` | Bulk issue certificates |
| GET | `/:id/certificates` | List certificates |
| PATCH | `/certificates/:id/revoke` | Revoke certificate |
| GET | `/certificates/:number/verify` | Verify certificate |

#### Lesson Plans (`/api/state/lesson-plans`) - All Institutions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all lesson plans |
| GET | `/:id` | Get lesson plan details |
| PATCH | `/:id/review` | Review lesson plan |

#### Reports (`/api/state/training/reports`) - State Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard statistics |
| GET | `/participation` | Participation report |
| GET | `/feedback-analysis` | Feedback analytics |
| GET | `/lesson-plan-compliance` | Compliance report |
| GET | `/institution-wise` | Institution breakdown |
| GET | `/export` | Export reports |

---

### Principal Endpoints - VIEW & APPROVE (Institution Scope)

#### Training View (`/api/principal/training`) - Read Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar` | View training calendar |
| GET | `/calendar/:year/:month` | Month calendar |
| GET | `/upcoming` | Upcoming trainings |
| GET | `/:id` | View training details |
| GET | `/feedback-forms` | View feedback forms (read-only) |
| GET | `/feedback-forms/:id` | View form details |

#### Application Review (`/api/principal/training`) - Institution Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/applications` | Institution applications |
| GET | `/applications/:id` | Application details |
| PATCH | `/applications/:id/review` | Approve/Reject |
| POST | `/applications/bulk-review` | Bulk review |
| GET | `/attendance` | Institution attendance |
| GET | `/:id/attendance` | Training attendance |

#### Lesson Plan Review (`/api/principal/lesson-plans`) - Institution Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Institution lesson plans |
| GET | `/:id` | Lesson plan details |
| PATCH | `/:id/review` | Review/Approve |

#### Reports (`/api/principal/training/reports`) - Institution Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Institution dashboard |
| GET | `/participation` | Participation stats |
| GET | `/faculty-summary` | Faculty-wise summary |
| GET | `/compliance` | Compliance report |
| GET | `/export` | Export reports |

---

### Faculty Endpoints - PARTICIPATE (Own Data Only)

#### Training & Applications (`/api/faculty/training`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar` | View training calendar |
| GET | `/calendar/:year/:month` | Month calendar |
| GET | `/upcoming` | Upcoming trainings |
| GET | `/:id` | Training details |
| POST | `/:id/apply` | Apply for training |
| DELETE | `/applications/:id` | Withdraw application |
| GET | `/my-applications` | My applications |
| GET | `/dashboard` | My dashboard |

#### Attendance (`/api/faculty/training`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:id/attendance/mark` | Mark my attendance |
| GET | `/my-attendance` | My attendance history |

#### Feedback (`/api/faculty/training`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:id/feedback/form` | Get feedback form |
| POST | `/:id/feedback` | Submit my feedback |
| GET | `/:id/feedback/my` | View my feedback |

#### Lesson Plans (`/api/faculty/lesson-plans`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create lesson plan |
| GET | `/` | My lesson plans |
| GET | `/:id` | Lesson plan details |
| PATCH | `/:id` | Update (if draft) |
| POST | `/:id/submit` | Submit for review |
| GET | `/pending` | My pending plans |
| GET | `/overdue` | My overdue plans |

#### Certificates (`/api/faculty/certificates`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | My certificates |
| GET | `/:id` | Certificate details |
| GET | `/:id/download` | Download certificate |

---

## 9. Database Migration

### Migration Command

```bash
# Generate migration
npx prisma migrate dev --name add_training_module

# Apply to production
npx prisma migrate deploy
```

### Seed Data (Optional)

```typescript
// prisma/seed-training.ts
async function seedTrainingData() {
  // Create sample feedback form
  const feedbackForm = await prisma.feedbackForm.create({
    data: {
      title: 'Training Feedback Form',
      purpose: 'TRAINING',
      isPublished: true,
      createdById: adminUserId,
      questions: [
        { id: 'q1', type: 'rating', question: 'How relevant was this training?', required: true, min: 1, max: 5 },
        { id: 'q2', type: 'rating', question: 'Rate trainer quality', required: true, min: 1, max: 5 },
        { id: 'q3', type: 'text', question: 'Key takeaways', required: true },
        { id: 'q4', type: 'text', question: 'Suggestions for improvement', required: false },
      ],
    },
  });

  // Create sample training
  const training = await prisma.training.create({
    data: {
      title: 'Advanced CNC Programming',
      description: 'Learn industry-standard CNC programming techniques',
      providedBy: 'Industry Partner XYZ',
      trainerName: 'John Doe',
      startDate: new Date('2026-03-15'),
      endDate: new Date('2026-03-17'),
      duration: 24,
      applicationDeadline: new Date('2026-03-01'),
      deliveryMode: 'OFFLINE',
      venue: 'Training Lab, Building 3',
      capacity: 40,
      difficulty: 'INTERMEDIATE',
      learningOutcomes: ['Master CNC programming', 'Operate modern machines'],
      feedbackFormId: feedbackForm.id,
      createdById: stateDirectorId,
      isPublished: true,
      publishedAt: new Date(),
    },
  });
}
```

---

## Development Checklist

### Phase 1: Backend Domain (Week 1-2)
- [ ] Create Training domain module
- [ ] Create TrainingApplication domain module
- [ ] Create TrainingAttendance domain module
- [ ] Create Feedback domain module
- [ ] Create LessonPlan domain module
- [ ] Create TrainingCertificate domain module
- [ ] Write unit tests for all services

### Phase 2: Backend API (Week 2-3)
- [ ] Create State training API module
- [ ] Create Principal training API module
- [ ] Create Faculty training API module
- [ ] Create Shared feedback API module
- [ ] Add Swagger documentation
- [ ] Write integration tests

### Phase 3: Frontend State & Services (Week 3-4)
- [ ] Create training Redux slice
- [ ] Create training services
- [ ] Create training-admin services
- [ ] Add to store configuration

### Phase 4: Frontend UI (Week 4-6)
- [ ] Build Faculty training pages
- [ ] Build Principal training pages
- [ ] Build State training pages
- [ ] Create shared components
- [ ] Add routes configuration
- [ ] Update sidebar menus

### Phase 5: Integration (Week 6-7)
- [ ] Integrate notifications
- [ ] Integrate audit logging
- [ ] Add email templates
- [ ] E2E testing
- [ ] Performance optimization
- [ ] Documentation

---

## Notes

1. **No Breaking Changes**: All new code is additive - existing functionality remains untouched
2. **Follows Existing Patterns**: Uses same architecture, naming conventions, and coding standards
3. **Role-Based Separation**: Clear separation between Faculty, Principal, and State features
4. **Global Feedback System**: Feedback forms are reusable across trainings and other contexts
5. **Scalable Design**: Easy to extend with additional features like training categories, prerequisites tracking, etc.
