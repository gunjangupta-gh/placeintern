import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsUUID,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enum for visit types (should match your schema)
export enum VisitType {
  PHYSICAL = 'PHYSICAL',
  VIRTUAL = 'VIRTUAL',
  PHONE = 'PHONE',
}

export enum VisitStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ReportStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ApprovalStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ==================== Visit Log DTOs ====================

export class CreateVisitLogDto {
  @ApiPropertyOptional({ description: 'Application ID (either applicationId or studentId is required)' })
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional({ description: 'Student ID (either applicationId or studentId is required)' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty({ description: 'Type of visit', enum: VisitType })
  @IsEnum(VisitType)
  visitType: VisitType;

  @ApiPropertyOptional({ description: 'Location of the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  visitLocation?: string;

  @ApiPropertyOptional({ description: 'Date of the visit (defaults to now)' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Status of the visit (defaults to COMPLETED)', enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  // GPS Coordinates
  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in meters' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsAccuracy?: number;

  // Signed Document
  @ApiPropertyOptional({ description: 'URL to signed document' })
  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;

  // Visit Details
  @ApiPropertyOptional({ description: 'Visit duration (e.g., "2 hours")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  visitDuration?: string;

  // Observations
  @ApiPropertyOptional({ description: 'Student performance observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  studentPerformance?: string;

  @ApiPropertyOptional({ description: 'Work environment observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workEnvironment?: string;

  @ApiPropertyOptional({ description: 'Industry support observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  industrySupport?: string;

  @ApiPropertyOptional({ description: 'Skills development observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  skillsDevelopment?: string;

  @ApiPropertyOptional({ description: 'Attendance status' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  attendanceStatus?: string;

  @ApiPropertyOptional({ description: 'Work quality assessment' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workQuality?: string;

  @ApiPropertyOptional({ description: 'Organisation feedback' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  organisationFeedback?: string;

  @ApiPropertyOptional({ description: 'Project topics' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  projectTopics?: string;

  // New fields from the form
  @ApiPropertyOptional({ description: 'Title of Project/Work' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleOfProjectWork?: string;

  @ApiPropertyOptional({ description: 'Assistance Required from the Institute' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  assistanceRequiredFromInstitute?: string;

  @ApiPropertyOptional({ description: 'Response from the Organisation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responseFromOrganisation?: string;

  @ApiPropertyOptional({ description: 'Remarks of Organisation Supervisor' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarksOfOrganisationSupervisor?: string;

  @ApiPropertyOptional({ description: 'Any significant change with respect to the plan of project/work' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  significantChangeInPlan?: string;

  @ApiPropertyOptional({ description: 'Observations about the Student' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observationsAboutStudent?: string;

  @ApiPropertyOptional({ description: 'Feedback shared with the Student' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedbackSharedWithStudent?: string;

  // Ratings (1-5 scale)
  @ApiPropertyOptional({ description: 'Student progress rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  studentProgressRating?: number;

  @ApiPropertyOptional({ description: 'Industry cooperation rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  industryCooperationRating?: number;

  @ApiPropertyOptional({ description: 'Work environment rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  workEnvironmentRating?: number;

  @ApiPropertyOptional({ description: 'Mentoring support rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  mentoringSupportRating?: number;

  @ApiPropertyOptional({ description: 'Overall satisfaction rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  overallSatisfactionRating?: number;

  // Issues and Recommendations
  @ApiPropertyOptional({ description: 'Issues identified' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issuesIdentified?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Action required' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  actionRequired?: string;

  @ApiPropertyOptional({ description: 'Files URL' })
  @IsOptional()
  @IsString()
  filesUrl?: string;

  // Documentation
  @ApiPropertyOptional({ description: 'Visit photos URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitPhotos?: string[];

  @ApiPropertyOptional({ description: 'Meeting minutes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  meetingMinutes?: string;

  @ApiPropertyOptional({ description: 'Attendees list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeesList?: string[];

  // Administrative
  @ApiPropertyOptional({ description: 'Report submitted to' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reportSubmittedTo?: string;

  @ApiPropertyOptional({ description: 'Follow up required' })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ description: 'Next visit date' })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  // Monthly Visit Tracking
  @ApiPropertyOptional({ description: 'Visit month (1-12)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  visitMonth?: number;

  @ApiPropertyOptional({ description: 'Visit year' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  visitYear?: number;

  @ApiPropertyOptional({ description: 'Required by date' })
  @IsOptional()
  @IsDateString()
  requiredByDate?: string;

  @ApiPropertyOptional({ description: 'Is monthly visit' })
  @IsOptional()
  @IsBoolean()
  isMonthlyVisit?: boolean;
}

export class UpdateVisitLogDto {
  @ApiPropertyOptional({ description: 'Type of visit', enum: VisitType })
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;

  @ApiPropertyOptional({ description: 'Location of the visit' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  visitLocation?: string;

  @ApiPropertyOptional({ description: 'Date of the visit' })
  @IsOptional()
  @IsDateString()
  visitDate?: string;

  @ApiPropertyOptional({ description: 'Status of the visit', enum: VisitStatus })
  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  // GPS Coordinates
  @ApiPropertyOptional({ description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @ApiPropertyOptional({ description: 'GPS accuracy in meters' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsAccuracy?: number;

  // Signed Document
  @ApiPropertyOptional({ description: 'URL to signed document' })
  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;

  // Visit Details
  @ApiPropertyOptional({ description: 'Visit duration (e.g., "2 hours")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  visitDuration?: string;

  // Observations
  @ApiPropertyOptional({ description: 'Student performance observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  studentPerformance?: string;

  @ApiPropertyOptional({ description: 'Work environment observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workEnvironment?: string;

  @ApiPropertyOptional({ description: 'Industry support observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  industrySupport?: string;

  @ApiPropertyOptional({ description: 'Skills development observations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  skillsDevelopment?: string;

  @ApiPropertyOptional({ description: 'Attendance status' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  attendanceStatus?: string;

  @ApiPropertyOptional({ description: 'Work quality assessment' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  workQuality?: string;

  @ApiPropertyOptional({ description: 'Organisation feedback' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  organisationFeedback?: string;

  @ApiPropertyOptional({ description: 'Project topics' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  projectTopics?: string;

  // New fields from the form
  @ApiPropertyOptional({ description: 'Title of Project/Work' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titleOfProjectWork?: string;

  @ApiPropertyOptional({ description: 'Assistance Required from the Institute' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  assistanceRequiredFromInstitute?: string;

  @ApiPropertyOptional({ description: 'Response from the Organisation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  responseFromOrganisation?: string;

  @ApiPropertyOptional({ description: 'Remarks of Organisation Supervisor' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarksOfOrganisationSupervisor?: string;

  @ApiPropertyOptional({ description: 'Any significant change with respect to the plan of project/work' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  significantChangeInPlan?: string;

  @ApiPropertyOptional({ description: 'Observations about the Student' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observationsAboutStudent?: string;

  @ApiPropertyOptional({ description: 'Feedback shared with the Student' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedbackSharedWithStudent?: string;

  // Ratings (1-5 scale)
  @ApiPropertyOptional({ description: 'Student progress rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  studentProgressRating?: number;

  @ApiPropertyOptional({ description: 'Industry cooperation rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  industryCooperationRating?: number;

  @ApiPropertyOptional({ description: 'Work environment rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  workEnvironmentRating?: number;

  @ApiPropertyOptional({ description: 'Mentoring support rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  mentoringSupportRating?: number;

  @ApiPropertyOptional({ description: 'Overall satisfaction rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  overallSatisfactionRating?: number;

  // Issues and Recommendations
  @ApiPropertyOptional({ description: 'Issues identified' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  issuesIdentified?: string;

  @ApiPropertyOptional({ description: 'Recommendations' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Action required' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  actionRequired?: string;

  @ApiPropertyOptional({ description: 'Files URL' })
  @IsOptional()
  @IsString()
  filesUrl?: string;

  // Documentation
  @ApiPropertyOptional({ description: 'Visit photos URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visitPhotos?: string[];

  @ApiPropertyOptional({ description: 'Meeting minutes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  meetingMinutes?: string;

  @ApiPropertyOptional({ description: 'Attendees list' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attendeesList?: string[];

  // Administrative
  @ApiPropertyOptional({ description: 'Report submitted to' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reportSubmittedTo?: string;

  @ApiPropertyOptional({ description: 'Follow up required' })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({ description: 'Next visit date' })
  @IsOptional()
  @IsDateString()
  nextVisitDate?: string;

  // Monthly Visit Tracking
  @ApiPropertyOptional({ description: 'Visit month (1-12)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  visitMonth?: number;

  @ApiPropertyOptional({ description: 'Visit year' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  visitYear?: number;

  @ApiPropertyOptional({ description: 'Required by date' })
  @IsOptional()
  @IsDateString()
  requiredByDate?: string;

  @ApiPropertyOptional({ description: 'Is monthly visit' })
  @IsOptional()
  @IsBoolean()
  isMonthlyVisit?: boolean;
}

// ==================== Monthly Report DTOs ====================

export class ReviewMonthlyReportDto {
  @ApiProperty({ description: 'Review status', enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ description: 'Reviewer remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason for rejection (required if status is REJECTED)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class ApproveMonthlyReportDto {
  @ApiPropertyOptional({ description: 'Approval remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class RejectMonthlyReportDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

// ==================== Approval DTOs ====================

export class UpdateSelfIdentifiedApprovalDto {
  @ApiProperty({ description: 'Approval status', enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Approval remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ApiPropertyOptional({ description: 'Reason for rejection (required if status is REJECTED)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ==================== Feedback DTOs ====================

export class SubmitMonthlyFeedbackDto {
  @ApiProperty({ description: 'Student ID' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'Month for the feedback (1-12)' })
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @ApiProperty({ description: 'Year for the feedback' })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  year: number;

  @ApiProperty({ description: 'Performance rating (1-5)' })
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  performanceRating: number;

  @ApiPropertyOptional({ description: 'Attendance rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  attendanceRating?: number;

  @ApiPropertyOptional({ description: 'Communication rating (1-5)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  communicationRating?: number;

  @ApiProperty({ description: 'Detailed feedback comments' })
  @IsString()
  @MinLength(20, { message: 'Feedback must be at least 20 characters' })
  @MaxLength(5000)
  feedback: string;

  @ApiPropertyOptional({ description: 'Areas for improvement' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  areasForImprovement?: string;

  @ApiPropertyOptional({ description: 'Strengths observed' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  strengths?: string;
}

// ==================== Internship DTOs ====================

export class UpdateInternshipDto {
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @ApiPropertyOptional({ description: 'Internship title/position' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Faculty remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  facultyRemarks?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyAddress?: string;

  @ApiPropertyOptional({ description: 'Company contact number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyContact?: string;

  @ApiPropertyOptional({ description: 'Company email' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyEmail?: string;

  @ApiPropertyOptional({ description: 'HR name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hrName?: string;

  @ApiPropertyOptional({ description: 'HR designation' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hrDesignation?: string;

  @ApiPropertyOptional({ description: 'HR contact number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  hrContact?: string;

  @ApiPropertyOptional({ description: 'HR email' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hrEmail?: string;

  @ApiPropertyOptional({ description: 'Stipend amount' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  stipend?: number;

  @ApiPropertyOptional({ description: 'Job profile/description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  jobProfile?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Location of internship' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ description: 'Application status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Is student selected' })
  @IsOptional()
  @IsBoolean()
  isSelected?: boolean;

  @ApiPropertyOptional({ description: 'Review remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ApiPropertyOptional({ description: 'Joining date' })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ description: 'Internship duration in months' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  internshipDuration?: number;

  @ApiPropertyOptional({ description: 'Date when application was reviewed' })
  @IsOptional()
  @IsDateString()
  reviewedAt?: string;

  @ApiPropertyOptional({ description: 'Review remarks/comments' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewRemarks?: string;
}

// ==================== Joining Letter DTOs ====================

export class VerifyJoiningLetterDto {
  @ApiPropertyOptional({ description: 'Verification remarks' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class RejectJoiningLetterDto {
  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

// ==================== File Upload DTOs ====================

export class UploadVisitDocumentDto {
  @ApiProperty({ description: 'Type of document (e.g., visit-photo, signed-document)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  documentType: string;
}

// ==================== Student Management DTOs ====================

export class UpdateStudentDto {
  @ApiPropertyOptional({ description: 'Student name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Student email' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Profile image URL' })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiPropertyOptional({ description: 'Student contact number' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contact?: string;

  @ApiPropertyOptional({ description: 'Roll number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rollNumber?: string;

  @ApiPropertyOptional({ description: 'Date of birth (stored as string)' })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiPropertyOptional({ description: 'Gender' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Admission type' })
  @IsOptional()
  @IsString()
  admissionType?: string;

  @ApiPropertyOptional({ description: 'Current year' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentYear?: number;

  @ApiPropertyOptional({ description: 'Current semester' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentSemester?: number;

  @ApiPropertyOptional({ description: 'Parent name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentName?: string;

  @ApiPropertyOptional({ description: 'Parent contact' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  parentContact?: string;

  @ApiPropertyOptional({ description: 'Mother name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  motherName?: string;

  @ApiPropertyOptional({ description: 'Address' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'City' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ description: 'State' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'District' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @ApiPropertyOptional({ description: 'Tehsil' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tehsil?: string;

  @ApiPropertyOptional({ description: 'Pin code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  pinCode?: string;

  @ApiPropertyOptional({ description: 'Batch ID' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ description: 'Branch ID' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Clearance status' })
  @IsOptional()
  @IsString()
  clearanceStatus?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UploadStudentDocumentDto {
  @ApiProperty({ description: 'Document type (e.g., MARKSHEET_10TH, MARKSHEET_12TH, CASTE_CERTIFICATE, PHOTO, OTHER)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  type: string;
}

export class ToggleStudentStatusDto {
  @ApiProperty({ description: 'New active status' })
  @IsBoolean()
  isActive: boolean;
}
