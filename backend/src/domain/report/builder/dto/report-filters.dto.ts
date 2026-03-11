import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsUUID,
  IsArray,
  IsDateString,
  IsIn,
  Min,
  Max,
  ValidateNested,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Transform string 'true'/'false' to boolean
 */
const TransformBoolean = () =>
  Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  });

/**
 * Transform string to number
 */
const TransformNumber = () =>
  Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    const num = Number(value);
    return isNaN(num) ? value : num;
  });

// ============================================
// BASE FILTER DTO
// ============================================

/**
 * Base filter with common fields for all reports
 */
export class BaseReportFilterDto {
  @IsOptional()
  @IsUUID('4', { message: 'Institution ID must be a valid UUID' })
  institutionId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date must be a valid ISO date string' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO date string' })
  endDate?: string;
}

// ============================================
// STUDENT REPORT FILTERS
// ============================================

/**
 * Filters for Student Directory Report
 */
export class StudentDirectoryFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Current year must be a number' })
  @Min(1, { message: 'Year must be between 1 and 6' })
  @Max(6, { message: 'Year must be between 1 and 6' })
  currentYear?: number;

  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Current semester must be a number' })
  @Min(1, { message: 'Semester must be between 1 and 12' })
  @Max(12, { message: 'Semester must be between 1 and 12' })
  currentSemester?: number;

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'Academic year must be a string' })
  @MaxLength(20, { message: 'Academic year cannot exceed 20 characters' })
  academicYear?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Mentor ID must be a valid UUID' })
  mentorId?: string;
}

/**
 * Filters for Student Compliance Report
 */
export class StudentComplianceFilterDto extends BaseReportFilterDto {
}

// ============================================
// INTERNSHIP REPORT FILTERS
// ============================================

/**
 * Filters for Internship Report
 */
export class InternshipReportFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'isSelfIdentified must be a boolean value' })
  isSelfIdentified?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'Mentor ID must be a valid UUID' })
  mentorId?: string;

  @IsOptional()
  @IsIn(
    ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'JOINED', 'COMPLETED', 'WITHDRAWN', 'APPROVED'],
    { message: 'Invalid application status' },
  )
  status?: string;

  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'REJECTED'], {
    message: 'Invalid verification status',
  })
  verificationStatus?: string;
}

/**
 * Filters for Self-Identified Internships Report
 * Extends InternshipReportFilterDto with start date range and institution name filters
 * Note: Frontend sends startDateRange: [start, end], backend controller transforms to startDateStart/startDateEnd
 */
export class SelfIdentifiedInternshipFilterDto extends InternshipReportFilterDto {
  @IsOptional()
  @IsString({ message: 'Institution name must be a string' })
  @MaxLength(200, { message: 'Institution name cannot exceed 200 characters' })
  institutionName?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date start must be a valid ISO date string' })
  startDateStart?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date end must be a valid ISO date string' })
  startDateEnd?: string;

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive?: boolean;
}

/**
 * Filters for Internship by Institution Report
 * Supports district, city, and internship start date range filters
 * Note: Frontend sends startDateRange: [start, end], backend controller transforms to startDateStart/startDateEnd
 */
export class InternshipByInstitutionFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsString({ message: 'District must be a string' })
  @MaxLength(200, { message: 'District cannot exceed 200 characters' })
  district?: string;

  @IsOptional()
  @IsString({ message: 'City must be a string' })
  @MaxLength(200, { message: 'City cannot exceed 200 characters' })
  city?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date start must be a valid ISO date string' })
  startDateStart?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Start date end must be a valid ISO date string' })
  startDateEnd?: string;
}

// ============================================
// FACULTY/MENTOR REPORT FILTERS
// ============================================

/**
 * Filters for Faculty Visit Report
 */
export class FacultyVisitFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsUUID('4', { message: 'Faculty ID must be a valid UUID' })
  facultyId?: string;

  @IsOptional()
  @IsIn(['PHYSICAL', 'VIRTUAL', 'HYBRID'], {
    message: 'Visit type must be PHYSICAL, VIRTUAL, or HYBRID',
  })
  visitType?: string;

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'followUpRequired must be a boolean value' })
  followUpRequired?: boolean;
}

/**
 * Filters for Mentor List Report
 */
export class MentorListFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'hasAssignedStudents must be a boolean value' })
  hasAssignedStudents?: boolean;

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'includePrincipal must be a boolean value' })
  includePrincipal?: boolean;
}

// ============================================
// MONTHLY REPORT FILTERS
// ============================================

/**
 * Filters for Monthly Report
 */
export class MonthlyReportFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsUUID('4', { message: 'Student ID must be a valid UUID' })
  studentId?: string;

  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Month must be a number' })
  @Min(1, { message: 'Month must be between 1 and 12' })
  @Max(12, { message: 'Month must be between 1 and 12' })
  month?: number;

  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Year must be a number' })
  @Min(2020, { message: 'Year must be 2020 or later' })
  @Max(2100, { message: 'Year must be before 2100' })
  year?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'], {
    message: 'Invalid report status',
  })
  status?: string;
}

// ============================================
// PLACEMENT REPORT FILTERS
// ============================================

/**
 * Filters for Placement Report
 */
export class PlacementReportFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Minimum salary must be a number' })
  @Min(0, { message: 'Minimum salary cannot be negative' })
  minSalary?: number;

  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'Maximum salary must be a number' })
  @Min(0, { message: 'Maximum salary cannot be negative' })
  maxSalary?: number;

  @IsOptional()
  @IsIn(['OFFERED', 'ACCEPTED', 'JOINED', 'DECLINED'], {
    message: 'Invalid placement status',
  })
  status?: string;
}

// ============================================
// USER ACTIVITY REPORT FILTERS
// ============================================

/**
 * Valid user roles for filtering
 */
const VALID_ROLES = [
  'STUDENT',
  'TEACHER',
  'FACULTY_SUPERVISOR',
  'PRINCIPAL',
  'STATE_DIRECTORATE',
  'INDUSTRY',
  'SYSTEM_ADMIN',
] as const;

/**
 * Filters for User Login Activity Report
 */
export class UserLoginActivityFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsArray({ message: 'Role must be an array of roles' })
  @IsIn(VALID_ROLES, { each: true, message: 'Invalid role value' })
  role?: string[];

  @IsOptional()
  @IsIn(['logged_in', 'never_logged_in'], {
    message: 'Login status must be logged_in or never_logged_in',
  })
  loginStatus?: string;

  @IsOptional()
  @IsIn(['changed', 'default'], {
    message: 'Password status must be changed or default',
  })
  passwordStatus?: string;

  @IsOptional()
  @IsIn(['active_7', 'active_30', 'inactive_30', 'inactive_90'], {
    message: 'Invalid activity status',
  })
  activityStatus?: string;

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'isActive must be a boolean value' })
  isActive?: boolean;
}

/**
 * Filters for User Session History Report
 */
export class UserSessionHistoryFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId?: string;

  @IsOptional()
  @IsIn(['active', 'expired', 'invalidated'], {
    message: 'Session status must be active, expired, or invalidated',
  })
  sessionStatus?: string;
}

/**
 * Filters for Never Logged In Users Report
 */
export class NeverLoggedInUsersFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsArray({ message: 'Role must be an array of roles' })
  @IsIn(VALID_ROLES, { each: true, message: 'Invalid role value' })
  role?: string[];

  @IsOptional()
  @IsDateString({}, { message: 'createdAfter must be a valid ISO date string' })
  createdAfter?: string;

  @IsOptional()
  @IsDateString({}, { message: 'createdBefore must be a valid ISO date string' })
  createdBefore?: string;
}

/**
 * Filters for Default Password Users Report
 */
export class DefaultPasswordUsersFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsArray({ message: 'Role must be an array of roles' })
  @IsIn(VALID_ROLES, { each: true, message: 'Invalid role value' })
  role?: string[];

  @IsOptional()
  @TransformBoolean()
  @IsBoolean({ message: 'hasLoggedIn must be a boolean value' })
  hasLoggedIn?: boolean;
}

/**
 * Filters for Inactive Users Report
 */
export class InactiveUsersFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsArray({ message: 'Role must be an array of roles' })
  @IsIn(VALID_ROLES, { each: true, message: 'Invalid role value' })
  role?: string[];

  @IsOptional()
  @TransformNumber()
  @IsNumber({}, { message: 'inactiveDays must be a number' })
  @Min(1, { message: 'inactiveDays must be at least 1' })
  @Max(365, { message: 'inactiveDays cannot exceed 365' })
  inactiveDays?: number;
}

/**
 * Filters for User Audit Log Report
 */
export class UserAuditLogFilterDto extends BaseReportFilterDto {
  @IsOptional()
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId?: string;

  @IsOptional()
  @IsString({ message: 'Entity type must be a string' })
  @MaxLength(100, { message: 'Entity type cannot exceed 100 characters' })
  entityType?: string;

  @IsOptional()
  @IsArray({ message: 'Action must be an array of actions' })
  @IsString({ each: true, message: 'Each action must be a string' })
  action?: string[];
}

// ============================================
// REPORT TYPE TO FILTER DTO MAPPING
// ============================================

/**
 * Maps report types to their corresponding filter DTO classes
 * Used for runtime validation
 */
export const REPORT_FILTER_DTO_MAP: Record<string, new () => BaseReportFilterDto> = {
  // Student Reports
  'student-directory': StudentDirectoryFilterDto,
  'student-compliance': StudentComplianceFilterDto,
  'student-by-branch': StudentDirectoryFilterDto,
  'student-progress': StudentDirectoryFilterDto,

  // Internship Reports
  'internship': InternshipReportFilterDto,
  'internship-applications': InternshipReportFilterDto,
  'internship-status': InternshipReportFilterDto,
  'self-identified-internship': SelfIdentifiedInternshipFilterDto,
  'self-identified-internships': SelfIdentifiedInternshipFilterDto,
  'internship-by-institution': InternshipByInstitutionFilterDto,

  // Faculty/Mentor Reports
  'faculty-visit': FacultyVisitFilterDto,
  'mentor-list': MentorListFilterDto,

  // Monthly Reports
  'monthly-report': MonthlyReportFilterDto,
  'monthly-report-status': MonthlyReportFilterDto,

  // Placement Reports
  'placement': PlacementReportFilterDto,

  // User Activity Reports
  'user-login-activity': UserLoginActivityFilterDto,
  'user-session-history': UserSessionHistoryFilterDto,
  'never-logged-in-users': NeverLoggedInUsersFilterDto,
  'default-password-users': DefaultPasswordUsersFilterDto,
  'inactive-users': InactiveUsersFilterDto,
  'user-audit-log': UserAuditLogFilterDto,
};

/**
 * Get the appropriate filter DTO class for a report type
 */
export function getFilterDtoClass(reportType: string): new () => BaseReportFilterDto {
  const normalizedType = reportType.toLowerCase().replace(/_/g, '-');

  // Try exact match first
  if (REPORT_FILTER_DTO_MAP[normalizedType]) {
    return REPORT_FILTER_DTO_MAP[normalizedType];
  }

  // Try partial matches for flexibility
  for (const [key, dtoClass] of Object.entries(REPORT_FILTER_DTO_MAP)) {
    if (normalizedType.includes(key) || key.includes(normalizedType)) {
      return dtoClass;
    }
  }

  // Default to base filter DTO
  return BaseReportFilterDto;
}
