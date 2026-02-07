-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PRINCIPAL', 'ACCOUNTANT', 'ADMISSION_OFFICER', 'EXAMINATION_OFFICER', 'TEACHER', 'PLACEMENT_OFFICER', 'PMS_OFFICER', 'EXTRACURRICULAR_HEAD', 'STUDENT', 'INDUSTRY', 'INDUSTRY_SUPERVISOR', 'STATE_DIRECTORATE', 'FACULTY_SUPERVISOR', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'HOLD', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('FIRST_YEAR', 'LEET');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('GENERAL', 'OBC', 'ST', 'SC');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MARKSHEET_10TH', 'MARKSHEET_12TH', 'CASTE_CERTIFICATE', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PAID', 'PARTIAL', 'PENDING', 'WAIVED');

-- CreateEnum
CREATE TYPE "ScholarshipType" AS ENUM ('CMS50', 'CMS60', 'CMS70', 'CMS80', 'CMS90', 'PMS', 'FWS');

-- CreateEnum
CREATE TYPE "ScholarshipStatus" AS ENUM ('APPROVED', 'REJECTED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "PlacementStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'REJECTED', 'JOINED');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('POLYTECHNIC', 'ENGINEERING_COLLEGE', 'UNIVERSITY', 'DEGREE_COLLEGE', 'ITI', 'SKILL_CENTER');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTRATION', 'USER_PROFILE_UPDATE', 'PASSWORD_CHANGE', 'PASSWORD_RESET', 'USER_ACTIVATION', 'USER_DEACTIVATION', 'USER_DELETION', 'STUDENT_PROFILE_VIEW', 'STUDENT_PROFILE_UPDATE', 'STUDENT_DOCUMENT_UPLOAD', 'STUDENT_DOCUMENT_DELETE', 'INTERNSHIP_CREATE', 'INTERNSHIP_UPDATE', 'INTERNSHIP_DELETE', 'INTERNSHIP_ACTIVATE', 'INTERNSHIP_DEACTIVATE', 'INTERNSHIP_VIEW', 'INTERNSHIP_SEARCH', 'APPLICATION_SUBMIT', 'APPLICATION_UPDATE', 'APPLICATION_WITHDRAW', 'APPLICATION_VIEW', 'APPLICATION_APPROVE', 'APPLICATION_REJECT', 'APPLICATION_BULK_ACTION', 'INDUSTRY_REGISTER', 'INDUSTRY_PROFILE_UPDATE', 'INDUSTRY_APPROVAL', 'INDUSTRY_REJECTION', 'INDUSTRY_VIEW_APPLICANTS', 'MENTOR_ASSIGN', 'MENTOR_UNASSIGN', 'MENTOR_UPDATE', 'MONTHLY_FEEDBACK_SUBMIT', 'MONTHLY_FEEDBACK_UPDATE', 'COMPLETION_FEEDBACK_SUBMIT', 'FEEDBACK_VIEW', 'VISIT_LOG_CREATE', 'VISIT_LOG_UPDATE', 'VISIT_LOG_DELETE', 'VISIT_LOG_VIEW', 'FACULTY_ASSIGNMENT', 'MONTHLY_REPORT_SUBMIT', 'MONTHLY_REPORT_UPDATE', 'MONTHLY_REPORT_APPROVE', 'MONTHLY_REPORT_REJECT', 'MONTHLY_REPORT_DELETE', 'JOINING_LETTER_UPLOAD', 'JOINING_LETTER_VERIFY', 'JOINING_LETTER_REJECT', 'JOINING_LETTER_DELETE', 'REPORT_GENERATE', 'REPORT_DOWNLOAD', 'REPORT_VIEW', 'BULK_OPERATION', 'DATA_EXPORT', 'DATA_IMPORT', 'INSTITUTION_CREATE', 'INSTITUTION_UPDATE', 'INSTITUTION_DELETE', 'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'CONFIGURATION_CHANGE', 'PERMISSION_CHANGE', 'UNAUTHORIZED_ACCESS', 'FAILED_LOGIN', 'SUSPICIOUS_ACTIVITY', 'DATA_BREACH_ATTEMPT', 'GRIEVANCE_SUBMIT', 'GRIEVANCE_UPDATE', 'GRIEVANCE_RESOLVE', 'TECHNICAL_QUERY_SUBMIT', 'TECHNICAL_QUERY_RESOLVE', 'COMPLIANCE_CHECK', 'AUDIT_TRAIL_ACCESS', 'PRIVACY_POLICY_UPDATE', 'CONSENT_GIVEN', 'CONSENT_WITHDRAWN');

-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('AUTHENTICATION', 'PROFILE_MANAGEMENT', 'INTERNSHIP_WORKFLOW', 'APPLICATION_PROCESS', 'FEEDBACK_SYSTEM', 'ADMINISTRATIVE', 'SECURITY', 'COMPLIANCE', 'SYSTEM', 'DATA_MANAGEMENT', 'SUPPORT', 'USER_MANAGEMENT', 'SYSTEM_ADMIN');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ReferredByType" AS ENUM ('STATE_DIRECTORATE', 'FACULTY_SUPERVISOR', 'PRINCIPAL', 'PLACEMENT_OFFICER', 'SYSTEM_ADMIN', 'INDUSTRY_PARTNER', 'ALUMNI', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferralType" AS ENUM ('INDUSTRY_PARTNERSHIP', 'PLACEMENT_ASSISTANCE', 'INTERNSHIP_PROVIDER', 'GUEST_LECTURER', 'MENTOR', 'SKILL_TRAINER', 'EQUIPMENT_SPONSOR', 'SCHOLARSHIP_PROVIDER', 'RESEARCH_COLLABORATOR', 'CURRICULUM_ADVISOR', 'ALUMNI_NETWORK', 'STARTUP_INCUBATOR', 'OTHER');

-- CreateEnum
CREATE TYPE "ReferralApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('INFORMATION_TECHNOLOGY', 'SOFTWARE_DEVELOPMENT', 'MANUFACTURING', 'AUTOMOTIVE', 'ELECTRONICS', 'TELECOMMUNICATIONS', 'CONSTRUCTION', 'CIVIL_ENGINEERING', 'MECHANICAL_ENGINEERING', 'ELECTRICAL_ENGINEERING', 'ENERGY_UTILITIES', 'HEALTHCARE', 'PHARMACEUTICALS', 'FINANCE_BANKING', 'EDUCATION', 'RESEARCH_DEVELOPMENT', 'GOVERNMENT', 'STARTUP', 'CONSULTING', 'MEDIA_ADVERTISING', 'RETAIL', 'HOSPITALITY', 'LOGISTICS_SUPPLY_CHAIN', 'AGRICULTURE', 'TEXTILES', 'CHEMICALS', 'AEROSPACE', 'DEFENSE', 'OTHER');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('STARTUP', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "InternshipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPROVED', 'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'JOINED', 'COMPLETED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('PHYSICAL', 'VIRTUAL', 'TELEPHONIC');

-- CreateEnum
CREATE TYPE "VisitLogStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FeeReportType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER_WISE', 'INSTITUTION_WISE', 'BRANCH_WISE', 'SCHOLARSHIP_WISE', 'CATEGORY_WISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "IndustryRequestType" AS ENUM ('INTERNSHIP_PARTNERSHIP', 'BULK_INTERNSHIP_REQUEST', 'GUEST_LECTURE', 'INDUSTRY_VISIT', 'PLACEMENT_DRIVE', 'SKILL_DEVELOPMENT_PROGRAM', 'CURRICULUM_COLLABORATION', 'RESEARCH_COLLABORATION', 'EQUIPMENT_DONATION', 'SCHOLARSHIP_SPONSORSHIP', 'FACULTY_TRAINING', 'STUDENT_MENTORSHIP', 'PROJECT_COLLABORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceType" AS ENUM ('FACULTY_VISIT', 'MONTHLY_FEEDBACK', 'COMPLETION_FEEDBACK', 'DOCUMENTATION', 'ATTENDANCE', 'OVERALL_INTERNSHIP');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('COMPLIANT', 'NON_COMPLIANT', 'PARTIALLY_COMPLIANT', 'PENDING_REVIEW', 'OVERDUE', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "ComplianceGrade" AS ENUM ('EXCELLENT', 'GOOD', 'AVERAGE', 'POOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'UNDER_REVIEW', 'IN_PROGRESS', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "StateReportCategory" AS ENUM ('EXECUTIVE_SUMMARY', 'PERFORMANCE_ANALYTICS', 'COMPLIANCE_REPORT', 'INDUSTRY_ENGAGEMENT', 'STUDENT_PLACEMENT_ANALYSIS', 'INSTITUTIONAL_COMPARISON', 'TREND_ANALYSIS', 'QUALITY_METRICS', 'FEEDBACK_ANALYSIS', 'GEOGRAPHIC_ANALYSIS', 'MONTHLY_SUMMARY', 'ANNUAL_REVIEW');

-- CreateEnum
CREATE TYPE "GrievanceCategory" AS ENUM ('INTERNSHIP_RELATED', 'MENTOR_RELATED', 'INDUSTRY_RELATED', 'PAYMENT_ISSUE', 'WORKPLACE_HARASSMENT', 'WORK_CONDITION', 'DOCUMENTATION', 'WORK_ENVIRONMENT', 'SAFETY_CONCERN', 'HARASSMENT', 'MENTORSHIP', 'LEARNING_OPPORTUNITY', 'DISCRIMINATION', 'WORK_HOURS', 'OTHER');

-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'IN_PROGRESS', 'ADDRESSED', 'RESOLVED', 'CLOSED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "GrievancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('MENTOR', 'PRINCIPAL', 'STATE_DIRECTORATE');

-- CreateEnum
CREATE TYPE "MonthlyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED');

-- CreateEnum
CREATE TYPE "TechnicalQueryStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TechnicalQueryPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('TECHNICAL_ISSUES', 'ACCOUNT_PROFILE', 'FEATURE_GUIDANCE', 'DATA_REPORTS', 'INTERNSHIP_QUERIES', 'GENERAL_INQUIRIES');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "BulkJobType" AS ENUM ('STUDENTS', 'USERS', 'INSTITUTIONS', 'SELF_INTERNSHIPS');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED', 'RESTORED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNo" TEXT,
    "rollNumber" TEXT,
    "dob" TEXT,
    "branchName" TEXT,
    "designation" TEXT,
    "role" "Role",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetPasswordToken" TEXT,
    "resetPasswordExpiry" TIMESTAMP(3),
    "institutionId" TEXT,
    "consent" BOOLEAN DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "loginCount" INTEGER NOT NULL DEFAULT 0,
    "previousLoginAt" TIMESTAMP(3),
    "hasChangedDefaultPassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "profileImage" TEXT,
    "userId" TEXT NOT NULL,
    "rollNumber" TEXT,
    "branchId" TEXT,
    "branchName" TEXT,
    "admissionNumber" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "contact" TEXT,
    "address" TEXT,
    "pinCode" TEXT,
    "tehsil" TEXT,
    "district" TEXT,
    "city" TEXT,
    "dob" TEXT,
    "state" TEXT,
    "parentName" TEXT,
    "parentContact" TEXT,
    "motherName" TEXT,
    "gender" TEXT,
    "currentYear" INTEGER,
    "currentSemester" INTEGER,
    "currentSemesterMarks" DOUBLE PRECISION,
    "tenthper" DOUBLE PRECISION,
    "twelthper" DOUBLE PRECISION,
    "diplomaPercentage" DOUBLE PRECISION,
    "totalBacklogs" INTEGER DEFAULT 0,
    "clearanceStatus" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "batchId" TEXT,
    "admissionType" "AdmissionType",
    "category" "Category",
    "scholarshipId" TEXT,
    "feeStructureId" TEXT,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_preferences" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "preferredFields" TEXT[],
    "preferredLocations" TEXT[],
    "preferredDurations" TEXT[],
    "minimumStipend" DOUBLE PRECISION,
    "isRemotePreferred" BOOLEAN NOT NULL DEFAULT false,
    "additionalRequirements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "admissionType" "AdmissionType" NOT NULL,
    "scholarshipScheme" "ScholarshipType" NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "df" DOUBLE PRECISION NOT NULL,
    "sf" DOUBLE PRECISION NOT NULL,
    "security" DOUBLE PRECISION NOT NULL,
    "tf" DOUBLE PRECISION NOT NULL,
    "total" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "feeStructureId" TEXT,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FeeStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "institutionId" TEXT,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignments" BOOLEAN NOT NULL DEFAULT true,
    "attendance" BOOLEAN NOT NULL DEFAULT true,
    "examSchedules" BOOLEAN NOT NULL DEFAULT true,
    "announcements" BOOLEAN NOT NULL DEFAULT true,
    "grades" BOOLEAN NOT NULL DEFAULT true,
    "internships" BOOLEAN NOT NULL DEFAULT true,
    "placements" BOOLEAN NOT NULL DEFAULT true,
    "feeReminders" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "reason" TEXT,
    "isFullInvalidation" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "type" "ScholarshipType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "ScholarshipStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "institutionId" TEXT,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "syllabusYear" INTEGER NOT NULL,
    "semesterNumber" TEXT,
    "branchName" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "subjectCode" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "subjectType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,
    "branchId" TEXT,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamResult" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobRole" TEXT NOT NULL,
    "salary" DOUBLE PRECISION,
    "offerDate" TIMESTAMP(3) NOT NULL,
    "status" "PlacementStatus" NOT NULL DEFAULT 'OFFERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "section" TEXT,
    "academicYear" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "institutionId" TEXT,

    CONSTRAINT "ClassAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "shortName" TEXT,
    "type" "InstitutionType" NOT NULL DEFAULT 'POLYTECHNIC',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT DEFAULT 'Punjab',
    "district" TEXT,
    "pinCode" TEXT,
    "country" TEXT DEFAULT 'India',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "alternatePhone" TEXT,
    "website" TEXT,
    "establishedYear" INTEGER,
    "affiliatedTo" TEXT,
    "recognizedBy" TEXT,
    "naacGrade" TEXT,
    "autonomousStatus" BOOLEAN NOT NULL DEFAULT false,
    "totalStudentSeats" INTEGER,
    "totalStaffSeats" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_settings" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "academicYearStart" TEXT NOT NULL,
    "academicYearEnd" TEXT NOT NULL,
    "currentAcademicYear" TEXT NOT NULL,
    "totalSemesters" INTEGER NOT NULL DEFAULT 6,
    "minInternshipDuration" INTEGER NOT NULL DEFAULT 8,
    "maxInternshipDuration" INTEGER NOT NULL DEFAULT 26,
    "mandatoryVisitsCount" INTEGER NOT NULL DEFAULT 4,
    "feedbackFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowSelfRegistration" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "code" TEXT NOT NULL,
    "hodId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "userRole" "Role" NOT NULL,
    "userName" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "changedFields" TEXT[],
    "description" TEXT,
    "category" "AuditCategory" NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'LOW',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "institutionId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calendar" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "institutionId" TEXT,

    CONSTRAINT "Calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "institutionId" TEXT,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignmentReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedBy" TEXT,
    "deactivationReason" TEXT,
    "academicYear" TEXT NOT NULL,
    "semester" TEXT,
    "specialInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "mentor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_records" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "complianceType" "ComplianceType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "requiredVisits" INTEGER DEFAULT 0,
    "completedVisits" INTEGER DEFAULT 0,
    "lastVisitDate" TIMESTAMP(3),
    "nextVisitDue" TIMESTAMP(3),
    "requiredFeedbacks" INTEGER DEFAULT 0,
    "completedFeedbacks" INTEGER DEFAULT 0,
    "lastFeedbackDate" TIMESTAMP(3),
    "nextFeedbackDue" TIMESTAMP(3),
    "complianceScore" DOUBLE PRECISION,
    "complianceGrade" "ComplianceGrade",
    "remarks" TEXT,
    "actionRequired" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "academicYear" TEXT NOT NULL,
    "semester" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyDescription" TEXT,
    "industryType" "IndustryType" NOT NULL,
    "establishedYear" INTEGER,
    "companySize" "CompanySize" NOT NULL,
    "employeeCount" INTEGER,
    "contactPersonName" TEXT NOT NULL,
    "contactPersonTitle" TEXT NOT NULL,
    "primaryEmail" TEXT NOT NULL,
    "alternateEmail" TEXT,
    "primaryPhone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "website" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "registrationNumber" TEXT NOT NULL,
    "panNumber" TEXT NOT NULL,
    "gstNumber" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "referredById" TEXT,
    "referralDate" TIMESTAMP(3),
    "referralNotes" TEXT,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internships" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detailedDescription" TEXT,
    "fieldOfWork" TEXT NOT NULL,
    "numberOfPositions" INTEGER NOT NULL,
    "duration" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "workLocation" TEXT NOT NULL,
    "isRemoteAllowed" BOOLEAN NOT NULL DEFAULT false,
    "eligibleBranches" TEXT[],
    "minimumPercentage" DOUBLE PRECISION,
    "eligibleSemesters" TEXT[],
    "isStipendProvided" BOOLEAN NOT NULL DEFAULT false,
    "stipendAmount" DOUBLE PRECISION,
    "stipendDetails" TEXT,
    "requiredSkills" TEXT[],
    "preferredSkills" TEXT[],
    "totalFacultyVisits" INTEGER DEFAULT 4,
    "status" "InternshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "industryId" TEXT NOT NULL,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_applications" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "internshipId" TEXT,
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverLetter" TEXT,
    "resume" TEXT,
    "additionalInfo" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedDate" TIMESTAMP(3),
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "selectionDate" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "hasJoined" BOOLEAN NOT NULL DEFAULT false,
    "joiningDate" TIMESTAMP(3),
    "completionDate" TIMESTAMP(3),
    "mentorId" TEXT,
    "mentorAssignedAt" TIMESTAMP(3),
    "mentorAssignedBy" TEXT,
    "isSelfIdentified" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "companyAddress" TEXT,
    "companyContact" TEXT,
    "companyEmail" TEXT,
    "hrName" TEXT,
    "hrDesignation" TEXT,
    "hrContact" TEXT,
    "hrEmail" TEXT,
    "internshipStatus" TEXT,
    "joiningLetterUrl" TEXT,
    "joiningLetterUploadedAt" TIMESTAMP(3),
    "facultyMentorName" TEXT,
    "facultyMentorContact" TEXT,
    "facultyMentorEmail" TEXT,
    "facultyMentorDesignation" TEXT,
    "internshipDuration" TEXT,
    "stipend" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "jobProfile" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewRemarks" TEXT,
    "notes" TEXT,
    "proposedFirstVisit" TIMESTAMP(3),
    "secondVisit" TIMESTAMP(3),
    "reportsGenerated" BOOLEAN NOT NULL DEFAULT false,
    "totalExpectedReports" INTEGER,
    "totalExpectedVisits" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_feedbacks" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "industryId" TEXT,
    "studentId" TEXT,
    "internshipId" TEXT,
    "imageUrl" TEXT,
    "feedbackMonth" TIMESTAMP(3) NOT NULL,
    "attendanceRating" INTEGER,
    "performanceRating" INTEGER,
    "punctualityRating" INTEGER,
    "technicalSkillsRating" INTEGER,
    "strengths" TEXT,
    "areasForImprovement" TEXT,
    "tasksAssigned" TEXT,
    "tasksCompleted" TEXT,
    "overallComments" TEXT,
    "overallRating" INTEGER,
    "reportUrl" TEXT,
    "workDescription" TEXT,
    "skillsLearned" TEXT,
    "challenges" TEXT,
    "supervisorFeedback" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_reports" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reportMonth" INTEGER NOT NULL,
    "reportYear" INTEGER NOT NULL,
    "monthName" TEXT,
    "reportFileUrl" TEXT,
    "status" "MonthlyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "submissionWindowStart" TIMESTAMP(3),
    "submissionWindowEnd" TIMESTAMP(3),
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "isLateSubmission" BOOLEAN NOT NULL DEFAULT false,
    "daysLate" INTEGER,
    "periodStartDate" TIMESTAMP(3),
    "periodEndDate" TIMESTAMP(3),
    "isPartialMonth" BOOLEAN NOT NULL DEFAULT false,
    "isFinalReport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completion_feedbacks" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "studentFeedback" TEXT,
    "studentRating" INTEGER,
    "skillsLearned" TEXT,
    "careerImpact" TEXT,
    "wouldRecommend" BOOLEAN,
    "studentSubmittedAt" TIMESTAMP(3),
    "industryFeedback" TEXT,
    "industryRating" INTEGER,
    "finalPerformance" TEXT,
    "recommendForHire" BOOLEAN,
    "industrySubmittedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completionCertificate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "industryId" TEXT,

    CONSTRAINT "completion_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_visit_logs" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "internshipId" TEXT,
    "facultyId" TEXT,
    "visitLocation" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "gpsAccuracy" DOUBLE PRECISION,
    "signedDocumentUrl" TEXT,
    "visitNumber" INTEGER,
    "visitDate" TIMESTAMP(3),
    "visitDuration" TEXT,
    "visitType" "VisitType" NOT NULL DEFAULT 'PHYSICAL',
    "status" "VisitLogStatus" NOT NULL DEFAULT 'SCHEDULED',
    "studentPerformance" TEXT,
    "workEnvironment" TEXT,
    "industrySupport" TEXT,
    "skillsDevelopment" TEXT,
    "attendanceStatus" TEXT,
    "workQuality" TEXT,
    "organisationFeedback" TEXT,
    "projectTopics" TEXT,
    "titleOfProjectWork" TEXT,
    "assistanceRequiredFromInstitute" TEXT,
    "responseFromOrganisation" TEXT,
    "remarksOfOrganisationSupervisor" TEXT,
    "significantChangeInPlan" TEXT,
    "observationsAboutStudent" TEXT,
    "feedbackSharedWithStudent" TEXT,
    "studentProgressRating" INTEGER,
    "industryCooperationRating" INTEGER,
    "workEnvironmentRating" INTEGER,
    "mentoringSupportRating" INTEGER,
    "overallSatisfactionRating" INTEGER,
    "issuesIdentified" TEXT,
    "recommendations" TEXT,
    "actionRequired" TEXT,
    "filesUrl" TEXT,
    "visitPhotos" TEXT[],
    "meetingMinutes" TEXT,
    "attendeesList" TEXT[],
    "reportSubmittedTo" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "nextVisitDate" TIMESTAMP(3),
    "visitMonth" INTEGER,
    "visitYear" INTEGER,
    "requiredByDate" TIMESTAMP(3),
    "isMonthlyVisit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faculty_visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "state_reports" (
    "id" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "reportCategory" "StateReportCategory",
    "reportPeriod" TEXT NOT NULL,
    "reportTitle" TEXT,
    "reportDescription" TEXT,
    "institutionIds" TEXT[],
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "totalInternships" INTEGER NOT NULL,
    "totalApplications" INTEGER NOT NULL,
    "totalPlacements" INTEGER NOT NULL,
    "institutionCount" INTEGER NOT NULL,
    "industryCount" INTEGER NOT NULL,
    "totalStudents" INTEGER,
    "totalFaculty" INTEGER,
    "applicationToPlacementRatio" DOUBLE PRECISION,
    "placementRate" DOUBLE PRECISION,
    "completionRate" DOUBLE PRECISION,
    "industryParticipationRate" DOUBLE PRECISION,
    "averageStipend" DOUBLE PRECISION,
    "medianStipend" DOUBLE PRECISION,
    "branchWiseData" JSONB,
    "institutionWiseData" JSONB,
    "performanceMetrics" JSONB,
    "industryWiseData" JSONB,
    "geographicData" JSONB,
    "trendData" JSONB,
    "complianceData" JSONB,
    "sections" JSONB,
    "selfIdentifiedData" JSONB,
    "reportFileUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_reports" (
    "id" TEXT NOT NULL,
    "reportType" "FeeReportType" NOT NULL,
    "reportPeriod" TEXT NOT NULL,
    "reportTitle" TEXT,
    "reportDescription" TEXT,
    "institutionIds" TEXT[],
    "branchIds" TEXT[],
    "semesterIds" TEXT[],
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "totalFeesDue" DOUBLE PRECISION NOT NULL,
    "totalFeesCollected" DOUBLE PRECISION NOT NULL,
    "totalOutstanding" DOUBLE PRECISION NOT NULL,
    "collectionRate" DOUBLE PRECISION NOT NULL,
    "totalStudents" INTEGER NOT NULL,
    "totalFeeRecords" INTEGER NOT NULL,
    "paidCount" INTEGER NOT NULL,
    "partialCount" INTEGER NOT NULL,
    "pendingCount" INTEGER NOT NULL,
    "waivedCount" INTEGER NOT NULL,
    "averageFeePerStudent" DOUBLE PRECISION,
    "medianFeePerStudent" DOUBLE PRECISION,
    "highestFeeCollected" DOUBLE PRECISION,
    "lowestFeeCollected" DOUBLE PRECISION,
    "scholarshipBeneficiaries" INTEGER,
    "totalScholarshipAmount" DOUBLE PRECISION,
    "institutionWiseData" JSONB,
    "branchWiseData" JSONB,
    "semesterWiseData" JSONB,
    "scholarshipWiseData" JSONB,
    "categoryWiseData" JSONB,
    "admissionTypeWiseData" JSONB,
    "trendData" JSONB,
    "performanceMetrics" JSONB,
    "reportFileUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fee_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "industry_requests" (
    "id" TEXT NOT NULL,
    "requestType" "IndustryRequestType" NOT NULL,
    "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "expectedOutcome" TEXT,
    "industryId" TEXT,
    "targetIndustryType" "IndustryType",
    "preferredLocation" TEXT,
    "preferredCompanySize" "CompanySize",
    "referredById" TEXT,
    "referredByType" "ReferredByType",
    "referralDate" TIMESTAMP(3),
    "referralNotes" TEXT,
    "referralApplicationId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "requestDeadline" TIMESTAMP(3),
    "expectedResponseBy" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'SENT',
    "statusHistory" JSONB[],
    "responseMessage" TEXT,
    "respondedAt" TIMESTAMP(3),
    "responseAttachments" TEXT[],
    "assignedTo" TEXT,
    "internalNotes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_applications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "referralType" "ReferralType" NOT NULL,
    "targetAudience" TEXT[],
    "industryId" TEXT NOT NULL,
    "qualifications" TEXT NOT NULL,
    "experienceDetails" TEXT NOT NULL,
    "references" JSONB,
    "proposedBenefits" TEXT NOT NULL,
    "status" "ReferralApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComments" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "rejectedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsageLimit" INTEGER,
    "institutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approved_referrals" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "referralType" "ReferralType" NOT NULL,
    "industryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsageLimit" INTEGER,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "tags" TEXT[],
    "category" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approved_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "GrievanceCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "GrievancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "GrievanceStatus" NOT NULL DEFAULT 'PENDING',
    "internshipId" TEXT,
    "industryId" TEXT,
    "facultySupervisorId" TEXT,
    "assignedToId" TEXT,
    "actionRequested" TEXT,
    "preferredContactMethod" TEXT,
    "submittedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addressedDate" TIMESTAMP(3),
    "resolvedDate" TIMESTAMP(3),
    "resolution" TEXT,
    "comments" TEXT,
    "attachments" TEXT[],
    "escalationLevel" "EscalationLevel" NOT NULL DEFAULT 'MENTOR',
    "escalationHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "escalatedById" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "previousAssignees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceStatusHistory" (
    "id" TEXT NOT NULL,
    "grievanceId" TEXT NOT NULL,
    "fromStatus" "GrievanceStatus",
    "toStatus" "GrievanceStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "escalationLevel" "EscalationLevel",
    "escalatedToId" TEXT,
    "remarks" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_queries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TechnicalQueryStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TechnicalQueryPriority" NOT NULL DEFAULT 'MEDIUM',
    "resolution" TEXT,
    "institutionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submitterRole" "Role" NOT NULL,
    "submitterName" TEXT NOT NULL,
    "submitterEmail" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "statusHistory" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closureRemarks" TEXT,
    "institutionId" TEXT,
    "lastResponseAt" TIMESTAMP(3),
    "lastResponseById" TEXT,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_responses" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "responderId" TEXT NOT NULL,
    "responderRole" "Role" NOT NULL,
    "responderName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "category" "SupportCategory" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL,
    "searchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bulk_jobs" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "BulkJobType" NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "originalName" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorReport" JSONB,
    "successReport" JSONB,
    "warnings" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "processingTime" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "institutionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "description" TEXT,
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT,
    "sortBy" TEXT,
    "sortOrder" TEXT,
    "createdBy" TEXT NOT NULL,
    "institutionId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportName" TEXT,
    "configuration" JSONB NOT NULL,
    "fileUrl" TEXT,
    "format" TEXT NOT NULL,
    "totalRecords" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "institutionId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_blacklist" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "refreshTokenHash" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "description" TEXT,
    "size" INTEGER NOT NULL,
    "storageLocations" TEXT[],
    "minioKey" TEXT,
    "localPath" TEXT,
    "status" "BackupStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRun" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_institutionId_role_idx" ON "User"("institutionId", "role");

-- CreateIndex
CREATE INDEX "User_active_idx" ON "User"("active");

-- CreateIndex
CREATE INDEX "User_lastLoginAt_idx" ON "User"("lastLoginAt");

-- CreateIndex
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");

-- CreateIndex
CREATE INDEX "User_institutionId_active_idx" ON "User"("institutionId", "active");

-- CreateIndex
CREATE INDEX "User_institutionId_role_active_idx" ON "User"("institutionId", "role", "active");

-- CreateIndex
CREATE INDEX "User_role_active_createdAt_idx" ON "User"("role", "active", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "Student_institutionId_idx" ON "Student"("institutionId");

-- CreateIndex
CREATE INDEX "Student_batchId_idx" ON "Student"("batchId");

-- CreateIndex
CREATE INDEX "Student_branchId_idx" ON "Student"("branchId");

-- CreateIndex
CREATE INDEX "Student_institutionId_batchId_idx" ON "Student"("institutionId", "batchId");

-- CreateIndex
CREATE INDEX "Student_institutionId_branchId_idx" ON "Student"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "Student_clearanceStatus_idx" ON "Student"("clearanceStatus");

-- CreateIndex
CREATE INDEX "Student_isActive_idx" ON "Student"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "internship_preferences_studentId_key" ON "internship_preferences"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE INDEX "Batch_institutionId_idx" ON "Batch"("institutionId");

-- CreateIndex
CREATE INDEX "Batch_isActive_idx" ON "Batch"("isActive");

-- CreateIndex
CREATE INDEX "Document_studentId_idx" ON "Document"("studentId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "FeeStructure_institutionId_idx" ON "FeeStructure"("institutionId");

-- CreateIndex
CREATE INDEX "FeeStructure_isActive_idx" ON "FeeStructure"("isActive");

-- CreateIndex
CREATE INDEX "FeeStructure_institutionId_isActive_idx" ON "FeeStructure"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_admissionType_scholarshipScheme_semesterNumber_key" ON "FeeStructure"("admissionType", "scholarshipScheme", "semesterNumber");

-- CreateIndex
CREATE INDEX "Fee_studentId_idx" ON "Fee"("studentId");

-- CreateIndex
CREATE INDEX "Fee_semesterId_idx" ON "Fee"("semesterId");

-- CreateIndex
CREATE INDEX "Fee_institutionId_idx" ON "Fee"("institutionId");

-- CreateIndex
CREATE INDEX "Fee_status_idx" ON "Fee"("status");

-- CreateIndex
CREATE INDEX "Fee_studentId_semesterId_idx" ON "Fee"("studentId", "semesterId");

-- CreateIndex
CREATE INDEX "Fee_institutionId_status_idx" ON "Fee"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "BlacklistedToken_userId_idx" ON "BlacklistedToken"("userId");

-- CreateIndex
CREATE INDEX "BlacklistedToken_expiresAt_idx" ON "BlacklistedToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Scholarship_institutionId_idx" ON "Scholarship"("institutionId");

-- CreateIndex
CREATE INDEX "Scholarship_type_idx" ON "Scholarship"("type");

-- CreateIndex
CREATE INDEX "Scholarship_status_idx" ON "Scholarship"("status");

-- CreateIndex
CREATE INDEX "Semester_institutionId_idx" ON "Semester"("institutionId");

-- CreateIndex
CREATE INDEX "Semester_number_idx" ON "Semester"("number");

-- CreateIndex
CREATE INDEX "Semester_isActive_idx" ON "Semester"("isActive");

-- CreateIndex
CREATE INDEX "Subject_institutionId_idx" ON "Subject"("institutionId");

-- CreateIndex
CREATE INDEX "Subject_branchId_idx" ON "Subject"("branchId");

-- CreateIndex
CREATE INDEX "Subject_subjectCode_idx" ON "Subject"("subjectCode");

-- CreateIndex
CREATE INDEX "Subject_institutionId_branchId_idx" ON "Subject"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

-- CreateIndex
CREATE INDEX "ExamResult_semesterId_idx" ON "ExamResult"("semesterId");

-- CreateIndex
CREATE INDEX "ExamResult_subjectId_idx" ON "ExamResult"("subjectId");

-- CreateIndex
CREATE INDEX "ExamResult_studentId_semesterId_idx" ON "ExamResult"("studentId", "semesterId");

-- CreateIndex
CREATE INDEX "Placement_studentId_idx" ON "Placement"("studentId");

-- CreateIndex
CREATE INDEX "Placement_institutionId_idx" ON "Placement"("institutionId");

-- CreateIndex
CREATE INDEX "Placement_status_idx" ON "Placement"("status");

-- CreateIndex
CREATE INDEX "Placement_studentId_status_idx" ON "Placement"("studentId", "status");

-- CreateIndex
CREATE INDEX "Placement_institutionId_status_idx" ON "Placement"("institutionId", "status");

-- CreateIndex
CREATE INDEX "ClassAssignment_teacherId_idx" ON "ClassAssignment"("teacherId");

-- CreateIndex
CREATE INDEX "ClassAssignment_batchId_idx" ON "ClassAssignment"("batchId");

-- CreateIndex
CREATE INDEX "ClassAssignment_institutionId_idx" ON "ClassAssignment"("institutionId");

-- CreateIndex
CREATE INDEX "ClassAssignment_teacherId_isActive_idx" ON "ClassAssignment"("teacherId", "isActive");

-- CreateIndex
CREATE INDEX "ClassAssignment_institutionId_isActive_idx" ON "ClassAssignment"("institutionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institution_settings_institutionId_key" ON "institution_settings"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_category_timestamp_idx" ON "AuditLog"("category", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_institutionId_idx" ON "AuditLog"("institutionId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Calendar_institutionId_idx" ON "Calendar"("institutionId");

-- CreateIndex
CREATE INDEX "Calendar_startDate_idx" ON "Calendar"("startDate");

-- CreateIndex
CREATE INDEX "Calendar_institutionId_startDate_idx" ON "Calendar"("institutionId", "startDate");

-- CreateIndex
CREATE INDEX "Notice_institutionId_idx" ON "Notice"("institutionId");

-- CreateIndex
CREATE INDEX "Notice_createdAt_idx" ON "Notice"("createdAt");

-- CreateIndex
CREATE INDEX "Notice_institutionId_createdAt_idx" ON "Notice"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "mentor_assignments_studentId_idx" ON "mentor_assignments"("studentId");

-- CreateIndex
CREATE INDEX "mentor_assignments_mentorId_idx" ON "mentor_assignments"("mentorId");

-- CreateIndex
CREATE INDEX "mentor_assignments_isActive_idx" ON "mentor_assignments"("isActive");

-- CreateIndex
CREATE INDEX "mentor_assignments_mentorId_isActive_idx" ON "mentor_assignments"("mentorId", "isActive");

-- CreateIndex
CREATE INDEX "mentor_assignments_studentId_isActive_idx" ON "mentor_assignments"("studentId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "industries_userId_key" ON "industries"("userId");

-- CreateIndex
CREATE INDEX "industries_institutionId_idx" ON "industries"("institutionId");

-- CreateIndex
CREATE INDEX "industries_isVerified_idx" ON "industries"("isVerified");

-- CreateIndex
CREATE INDEX "industries_isApproved_idx" ON "industries"("isApproved");

-- CreateIndex
CREATE INDEX "industries_isVerified_isApproved_idx" ON "industries"("isVerified", "isApproved");

-- CreateIndex
CREATE INDEX "industries_referredById_idx" ON "industries"("referredById");

-- CreateIndex
CREATE INDEX "industries_companyName_idx" ON "industries"("companyName");

-- CreateIndex
CREATE INDEX "industries_city_state_idx" ON "industries"("city", "state");

-- CreateIndex
CREATE INDEX "industries_institutionId_isApproved_idx" ON "industries"("institutionId", "isApproved");

-- CreateIndex
CREATE INDEX "internships_industryId_idx" ON "internships"("industryId");

-- CreateIndex
CREATE INDEX "internships_institutionId_idx" ON "internships"("institutionId");

-- CreateIndex
CREATE INDEX "internships_status_idx" ON "internships"("status");

-- CreateIndex
CREATE INDEX "internships_isActive_idx" ON "internships"("isActive");

-- CreateIndex
CREATE INDEX "internships_applicationDeadline_idx" ON "internships"("applicationDeadline");

-- CreateIndex
CREATE INDEX "internships_industryId_status_idx" ON "internships"("industryId", "status");

-- CreateIndex
CREATE INDEX "internships_institutionId_status_idx" ON "internships"("institutionId", "status");

-- CreateIndex
CREATE INDEX "internships_institutionId_status_isActive_idx" ON "internships"("institutionId", "status", "isActive");

-- CreateIndex
CREATE INDEX "internship_applications_studentId_idx" ON "internship_applications"("studentId");

-- CreateIndex
CREATE INDEX "internship_applications_internshipId_idx" ON "internship_applications"("internshipId");

-- CreateIndex
CREATE INDEX "internship_applications_status_idx" ON "internship_applications"("status");

-- CreateIndex
CREATE INDEX "internship_applications_studentId_status_idx" ON "internship_applications"("studentId", "status");

-- CreateIndex
CREATE INDEX "internship_applications_internshipId_status_idx" ON "internship_applications"("internshipId", "status");

-- CreateIndex
CREATE INDEX "internship_applications_mentorId_idx" ON "internship_applications"("mentorId");

-- CreateIndex
CREATE INDEX "internship_applications_isSelfIdentified_idx" ON "internship_applications"("isSelfIdentified");

-- CreateIndex
CREATE INDEX "internship_applications_applicationDate_idx" ON "internship_applications"("applicationDate");

-- CreateIndex
CREATE INDEX "internship_applications_mentorId_appliedDate_idx" ON "internship_applications"("mentorId", "appliedDate");

-- CreateIndex
CREATE INDEX "internship_applications_isSelfIdentified_status_application_idx" ON "internship_applications"("isSelfIdentified", "status", "applicationDate");

-- CreateIndex
CREATE INDEX "internship_applications_studentId_internshipId_idx" ON "internship_applications"("studentId", "internshipId");

-- CreateIndex
CREATE INDEX "internship_applications_internshipId_status_isSelfIdentifie_idx" ON "internship_applications"("internshipId", "status", "isSelfIdentified");

-- CreateIndex
CREATE INDEX "internship_applications_mentorId_isSelfIdentified_status_idx" ON "internship_applications"("mentorId", "isSelfIdentified", "status");

-- CreateIndex
CREATE INDEX "internship_applications_applicationDate_status_idx" ON "internship_applications"("applicationDate", "status");

-- CreateIndex
CREATE INDEX "internship_applications_studentId_status_isSelfIdentified_idx" ON "internship_applications"("studentId", "status", "isSelfIdentified");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_applicationId_idx" ON "monthly_feedbacks"("applicationId");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_studentId_idx" ON "monthly_feedbacks"("studentId");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_industryId_idx" ON "monthly_feedbacks"("industryId");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_internshipId_idx" ON "monthly_feedbacks"("internshipId");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_feedbackMonth_idx" ON "monthly_feedbacks"("feedbackMonth");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_applicationId_feedbackMonth_idx" ON "monthly_feedbacks"("applicationId", "feedbackMonth");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_studentId_feedbackMonth_idx" ON "monthly_feedbacks"("studentId", "feedbackMonth");

-- CreateIndex
CREATE INDEX "monthly_feedbacks_studentId_internshipId_feedbackMonth_idx" ON "monthly_feedbacks"("studentId", "internshipId", "feedbackMonth");

-- CreateIndex
CREATE INDEX "monthly_reports_applicationId_idx" ON "monthly_reports"("applicationId");

-- CreateIndex
CREATE INDEX "monthly_reports_studentId_idx" ON "monthly_reports"("studentId");

-- CreateIndex
CREATE INDEX "monthly_reports_status_idx" ON "monthly_reports"("status");

-- CreateIndex
CREATE INDEX "monthly_reports_reportMonth_reportYear_idx" ON "monthly_reports"("reportMonth", "reportYear");

-- CreateIndex
CREATE INDEX "monthly_reports_dueDate_idx" ON "monthly_reports"("dueDate");

-- CreateIndex
CREATE INDEX "monthly_reports_applicationId_status_idx" ON "monthly_reports"("applicationId", "status");

-- CreateIndex
CREATE INDEX "monthly_reports_studentId_status_idx" ON "monthly_reports"("studentId", "status");

-- CreateIndex
CREATE INDEX "monthly_reports_status_dueDate_idx" ON "monthly_reports"("status", "dueDate");

-- CreateIndex
CREATE INDEX "monthly_reports_studentId_reportMonth_reportYear_idx" ON "monthly_reports"("studentId", "reportMonth", "reportYear");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reports_applicationId_reportMonth_reportYear_key" ON "monthly_reports"("applicationId", "reportMonth", "reportYear");

-- CreateIndex
CREATE UNIQUE INDEX "completion_feedbacks_applicationId_key" ON "completion_feedbacks"("applicationId");

-- CreateIndex
CREATE INDEX "completion_feedbacks_industryId_idx" ON "completion_feedbacks"("industryId");

-- CreateIndex
CREATE INDEX "completion_feedbacks_isCompleted_idx" ON "completion_feedbacks"("isCompleted");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_applicationId_idx" ON "faculty_visit_logs"("applicationId");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_internshipId_idx" ON "faculty_visit_logs"("internshipId");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_facultyId_idx" ON "faculty_visit_logs"("facultyId");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_visitDate_idx" ON "faculty_visit_logs"("visitDate");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_applicationId_visitDate_idx" ON "faculty_visit_logs"("applicationId", "visitDate");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_facultyId_visitDate_idx" ON "faculty_visit_logs"("facultyId", "visitDate");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_visitMonth_visitYear_idx" ON "faculty_visit_logs"("visitMonth", "visitYear");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_applicationId_status_idx" ON "faculty_visit_logs"("applicationId", "status");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_facultyId_status_idx" ON "faculty_visit_logs"("facultyId", "status");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_visitMonth_visitYear_status_idx" ON "faculty_visit_logs"("visitMonth", "visitYear", "status");

-- CreateIndex
CREATE INDEX "faculty_visit_logs_applicationId_isMonthlyVisit_status_idx" ON "faculty_visit_logs"("applicationId", "isMonthlyVisit", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approved_referrals_applicationId_key" ON "approved_referrals"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "approved_referrals_referralCode_key" ON "approved_referrals"("referralCode");

-- CreateIndex
CREATE INDEX "Grievance_studentId_idx" ON "Grievance"("studentId");

-- CreateIndex
CREATE INDEX "Grievance_status_idx" ON "Grievance"("status");

-- CreateIndex
CREATE INDEX "Grievance_internshipId_idx" ON "Grievance"("internshipId");

-- CreateIndex
CREATE INDEX "Grievance_assignedToId_idx" ON "Grievance"("assignedToId");

-- CreateIndex
CREATE INDEX "Grievance_studentId_status_idx" ON "Grievance"("studentId", "status");

-- CreateIndex
CREATE INDEX "Grievance_escalationLevel_idx" ON "Grievance"("escalationLevel");

-- CreateIndex
CREATE INDEX "GrievanceStatusHistory_grievanceId_idx" ON "GrievanceStatusHistory"("grievanceId");

-- CreateIndex
CREATE INDEX "GrievanceStatusHistory_changedById_idx" ON "GrievanceStatusHistory"("changedById");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "support_tickets_submittedById_idx" ON "support_tickets"("submittedById");

-- CreateIndex
CREATE INDEX "support_tickets_assignedToId_idx" ON "support_tickets"("assignedToId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_institutionId_idx" ON "support_tickets"("institutionId");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "support_tickets_submittedById_status_idx" ON "support_tickets"("submittedById", "status");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "support_responses_ticketId_idx" ON "support_responses"("ticketId");

-- CreateIndex
CREATE INDEX "support_responses_responderId_idx" ON "support_responses"("responderId");

-- CreateIndex
CREATE INDEX "support_responses_createdAt_idx" ON "support_responses"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "faq_articles_slug_key" ON "faq_articles"("slug");

-- CreateIndex
CREATE INDEX "faq_articles_category_idx" ON "faq_articles"("category");

-- CreateIndex
CREATE INDEX "faq_articles_isPublished_idx" ON "faq_articles"("isPublished");

-- CreateIndex
CREATE INDEX "faq_articles_viewCount_idx" ON "faq_articles"("viewCount");

-- CreateIndex
CREATE INDEX "faq_articles_category_isPublished_idx" ON "faq_articles"("category", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "bulk_jobs_jobId_key" ON "bulk_jobs"("jobId");

-- CreateIndex
CREATE INDEX "bulk_jobs_institutionId_idx" ON "bulk_jobs"("institutionId");

-- CreateIndex
CREATE INDEX "bulk_jobs_createdById_idx" ON "bulk_jobs"("createdById");

-- CreateIndex
CREATE INDEX "bulk_jobs_status_idx" ON "bulk_jobs"("status");

-- CreateIndex
CREATE INDEX "bulk_jobs_type_idx" ON "bulk_jobs"("type");

-- CreateIndex
CREATE INDEX "bulk_jobs_createdAt_idx" ON "bulk_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "bulk_jobs_institutionId_status_idx" ON "bulk_jobs"("institutionId", "status");

-- CreateIndex
CREATE INDEX "bulk_jobs_institutionId_type_idx" ON "bulk_jobs"("institutionId", "type");

-- CreateIndex
CREATE INDEX "bulk_jobs_createdById_status_idx" ON "bulk_jobs"("createdById", "status");

-- CreateIndex
CREATE INDEX "generated_reports_generatedBy_idx" ON "generated_reports"("generatedBy");

-- CreateIndex
CREATE INDEX "generated_reports_expiresAt_idx" ON "generated_reports"("expiresAt");

-- CreateIndex
CREATE INDEX "generated_reports_status_idx" ON "generated_reports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "token_blacklist_tokenHash_key" ON "token_blacklist"("tokenHash");

-- CreateIndex
CREATE INDEX "token_blacklist_expiresAt_idx" ON "token_blacklist"("expiresAt");

-- CreateIndex
CREATE INDEX "user_sessions_userId_idx" ON "user_sessions"("userId");

-- CreateIndex
CREATE INDEX "user_sessions_invalidatedAt_idx" ON "user_sessions"("invalidatedAt");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "backup_records_createdAt_idx" ON "backup_records"("createdAt");

-- CreateIndex
CREATE INDEX "backup_records_status_idx" ON "backup_records"("status");

-- CreateIndex
CREATE INDEX "backup_schedules_isActive_idx" ON "backup_schedules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "system_configs"("category");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_preferences" ADD CONSTRAINT "internship_preferences_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAssignment" ADD CONSTRAINT "ClassAssignment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_settings" ADD CONSTRAINT "institution_settings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calendar" ADD CONSTRAINT "Calendar_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_assignments" ADD CONSTRAINT "mentor_assignments_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industries" ADD CONSTRAINT "industries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industries" ADD CONSTRAINT "industries_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industries" ADD CONSTRAINT "industries_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internships" ADD CONSTRAINT "internships_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_feedbacks" ADD CONSTRAINT "monthly_feedbacks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "internship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_feedbacks" ADD CONSTRAINT "monthly_feedbacks_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_feedbacks" ADD CONSTRAINT "monthly_feedbacks_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_feedbacks" ADD CONSTRAINT "monthly_feedbacks_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "internship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_feedbacks" ADD CONSTRAINT "completion_feedbacks_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "internship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completion_feedbacks" ADD CONSTRAINT "completion_feedbacks_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_visit_logs" ADD CONSTRAINT "faculty_visit_logs_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "internship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_visit_logs" ADD CONSTRAINT "faculty_visit_logs_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faculty_visit_logs" ADD CONSTRAINT "faculty_visit_logs_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_requests" ADD CONSTRAINT "industry_requests_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_requests" ADD CONSTRAINT "industry_requests_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_requests" ADD CONSTRAINT "industry_requests_referralApplicationId_fkey" FOREIGN KEY ("referralApplicationId") REFERENCES "referral_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_requests" ADD CONSTRAINT "industry_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "industry_requests" ADD CONSTRAINT "industry_requests_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_applications" ADD CONSTRAINT "referral_applications_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_applications" ADD CONSTRAINT "referral_applications_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_applications" ADD CONSTRAINT "referral_applications_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_applications" ADD CONSTRAINT "referral_applications_rejectedBy_fkey" FOREIGN KEY ("rejectedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_applications" ADD CONSTRAINT "referral_applications_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_referrals" ADD CONSTRAINT "approved_referrals_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "referral_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approved_referrals" ADD CONSTRAINT "approved_referrals_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_internshipId_fkey" FOREIGN KEY ("internshipId") REFERENCES "internships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "industries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_facultySupervisorId_fkey" FOREIGN KEY ("facultySupervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grievance" ADD CONSTRAINT "Grievance_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceStatusHistory" ADD CONSTRAINT "GrievanceStatusHistory_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "Grievance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceStatusHistory" ADD CONSTRAINT "GrievanceStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_queries" ADD CONSTRAINT "technical_queries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_queries" ADD CONSTRAINT "technical_queries_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_responses" ADD CONSTRAINT "support_responses_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_responses" ADD CONSTRAINT "support_responses_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_articles" ADD CONSTRAINT "faq_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
