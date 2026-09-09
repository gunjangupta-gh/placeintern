import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Role, AuditAction, AuditCategory, AuditSeverity, Designation } from '../../generated/prisma/client';
import { BulkUserRowDto, BulkUserResultDto, BulkUserValidationResultDto } from './dto/bulk-user.dto';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';
import {
  findInstitutionByName,
  resolveValidDefaultInstitutionId,
  findBranchByName,
} from '../../core/common/utils/institution-matcher.util';

// Valid roles that can be used in the bulk upload template.
const ROLE_MAPPING: Record<string, Role> = {
  TEACHER: Role.TEACHER,
  FACULTY_SUPERVISOR: Role.TEACHER,
  ADMIN_STAFF: Role.ADMIN_STAFF,
};
const validRoles = Object.keys(ROLE_MAPPING);

/**
 * Generate password: first 4 letters of name (lowercase) + @ + first 4 digits of phone
 * Returns null if phone is not available or doesn't have enough digits
 */
function generateCustomPassword(name: string, phone?: string): string | null {
  if (!phone) {
    return null;
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 4) {
    return null;
  }

  // Get first 4 letters of name (remove spaces, take first 4 chars, lowercase)
  const nameClean = name.replace(/\s+/g, '').toLowerCase();
  const namePart = nameClean.substring(0, 4);

  // Get first 4 digits of phone
  const phonePart = phoneDigits.substring(0, 4);

  return `${namePart}@${phonePart}`;
}

/**
 * Normalize designation text and map it to Designation enum
 */
function mapDesignationToEnum(designation?: string): Designation | undefined {
  if (!designation) {
    return undefined;
  }

  const normalized = designation
    .toLowerCase()
    .replace(/[().,\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const direct = normalized.toUpperCase().replace(/\s+/g, '_');
  if ((Designation as any)[direct]) {
    return (Designation as any)[direct] as Designation;
  }

  const mapping: Array<{ terms: string[]; value: Designation }> = [
    { terms: ['principal'], value: Designation.PRINCIPAL },
    { terms: ['hod', 'head of department'], value: Designation.HOD },
    { terms: ['senior lecturer', 'sr lecturer'], value: Designation.SENIOR_LECTURER },
    { terms: ['lecturer'], value: Designation.LECTURER },
    { terms: ['assistant professor'], value: Designation.ASSISTANT_PROFESSOR },
    { terms: ['foreman instructor'], value: Designation.FOREMAN_INSTRUCTOR },
    { terms: ['workshop instructor'], value: Designation.WORKSHOP_INSTRUCTOR },
    { terms: ['workshop superintendent'], value: Designation.WORKSHOP_SUPERINTENDENT },
    { terms: ['workshop foreman'], value: Designation.WORKSHOP_FOREMAN },
    { terms: ['lab technician', 'laboratory technician'], value: Designation.LAB_TECHNICIAN },
    { terms: ['technician'], value: Designation.TECHNICIAN },
    { terms: ['instructor'], value: Designation.INSTRUCTOR },
    { terms: ['system analyst'], value: Designation.SYSTEM_ANALYST },
    { terms: ['placement officer', 'training and placement officer', 'tpo'], value: Designation.TPO },
    { terms: ['programmer assistant', 'programmer'], value: Designation.PROGRAMMER },
    { terms: ['library assistant', 'librarian'], value: Designation.LIBRARIAN },
    { terms: ['senior assistant', 'sr assistant'], value: Designation.SR_ASSTT },
    { terms: ['clerk'], value: Designation.CLERK },
    { terms: ['assistant', 'office assistant', 'junior assistant'], value: Designation.JUNIOR_ASSTT },
    { terms: ['other'], value: Designation.OTHER },
  ];

  for (const item of mapping) {
    if (item.terms.some((term) => normalized.includes(term))) {
      return item.value;
    }
  }

  return undefined;
}

@Injectable()
export class BulkUserService {
  private readonly logger = new Logger(BulkUserService.name);

  // Valid roles that can be used in bulk upload
  private readonly validRoles = ['TEACHER', 'ADMIN_STAFF'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parse CSV/Excel file and extract user data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkUserRowDto[]> {
    try {
      const { workbook } = await ExcelUtils.read(buffer);

      // Convert to JSON
      const rawData = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

      // Map CSV columns to DTO fields (supporting multiple column name formats)
      const users: BulkUserRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(
          row['Name'] || row['name'] || row['Full Name'] ||
          row['Name of the Faculty'] || row['Name of Faculty'] || row['Faculty Name'] ||
          row['Name of Facuty'] // Handle typo
        ),
        email: this.cleanString(
          row['Email'] || row['email'] || row['E-mail'] || row['Mail']
        )?.toLowerCase(),
        phone: this.cleanString(
          row['Phone'] || row['phone'] || row['Contact'] ||
          row['Contact Number'] || row['Mobile'] || row['Mobile No']
        ),
        role: this.cleanString(row['Role'] || row['role'])?.toUpperCase() || 'TEACHER',
        designation: this.cleanString(row['Designation'] || row['designation']),
        department: this.cleanString(
          row['Department'] || row['department']
        ),
        employeeId: this.cleanString(row['Employee ID'] || row['employeeId'] || row['Employee Id']),
        institutionName: this.cleanString(
          row['Institution'] || row['institution'] || row['Institution Name'] ||
          row['Name of the College'] || row['College'] || row['College Name'] || row['Institute'] ||
          row['Institute Name'] || row['College/Institute'] || row['Institute/College'] ||
          row['Name of Institute'] || row['Name of Institution'] || row['Institution Code'] ||
          row['College Code'] || row['Institute Code'] || row['Code']
        ),
        branchName: this.cleanString(
          row['Branch'] || row['branch'] || row['Course'] || row['course']
        ),
      }));

      return users;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate user data before processing
   * Includes institution matching validation
   */
  async validateUsers(users: BulkUserRowDto[], defaultInstitutionId: string | null): Promise<BulkUserValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; message: string }> = [];
    const warnings: string[] = [];
    const data: any[] = [];

    // Fetch all institutions for matching
    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true },
    });
    const sanitizedDefaultInstitutionId = resolveValidDefaultInstitutionId(
      defaultInstitutionId,
      allInstitutions,
    );

    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      warnings.push(
        `Default institution id \"${defaultInstitutionId}\" is invalid. Institution will be resolved from Excel per row.`,
      );
    }

    // Extract all emails for batch query
    const allEmails = users
      .map((u) => u.email?.toLowerCase())
      .filter((email): email is string => !!email);

    // Batch query to check existing emails
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // Track duplicate emails in file
    const emailFirstOccurrence = new Map<string, number>();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Prepare row data for preview
      const rowData: any = {
        row: rowNumber,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        designation: user.designation,
        institution: user.institutionName,
        branch: user.branchName,
      };

      // Required field validation
      if (!user.name || user.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: user.name,
          message: 'Name is required',
        });
      }

      if (!user.email || user.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          message: 'Email is required',
        });
      } else if (!this.isValidEmail(user.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          message: 'Invalid email format',
        });
      }

      if (!user.role || user.role.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          message: 'Role is required',
        });
      } else if (!validRoles.includes(user.role)) {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }

      // Phone is required for password generation
      if (!user.phone || user.phone.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'phone',
          value: user.phone,
          message: 'Phone is required for password generation',
        });
      } else {
        const phoneDigits = user.phone.replace(/\D/g, '');
        if (phoneDigits.length < 4) {
          errors.push({
            row: rowNumber,
            field: 'phone',
            value: user.phone,
            message: 'Phone must have at least 4 digits for password generation',
          });
        }
      }

      // Check duplicate email in file
      if (user.email) {
        const emailLower = user.email.toLowerCase();
        const firstRow = emailFirstOccurrence.get(emailLower);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: user.email,
            message: `Duplicate email in file (also found in row ${firstRow})`,
          });
        } else {
          emailFirstOccurrence.set(emailLower, rowNumber);
        }

        // Check existing email in database
        if (existingEmailSet.has(emailLower)) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: user.email,
            message: 'Email already exists in the system',
          });
        }
      }

      // Institution validation - check if it can be matched
      if (!sanitizedDefaultInstitutionId) {
        // No valid default institution - must resolve from Excel
        if (!user.institutionName || user.institutionName.trim() === '') {
          errors.push({
            row: rowNumber,
            field: 'institution',
            value: '',
            message: 'Institution name is required (use "Name of the College" column)',
          });
        } else {
          const matchedInstitution = findInstitutionByName(user.institutionName, allInstitutions);
          if (!matchedInstitution) {
            errors.push({
              row: rowNumber,
              field: 'institution',
              value: user.institutionName,
              message: `Institution not found: "${user.institutionName}"`,
            });
          } else {
            rowData.institutionMatched = matchedInstitution.name;
          }
        }
      } else if (user.institutionName && user.institutionName.trim() !== '') {
        // If institution is provided in Excel, validate it explicitly to avoid linking to wrong institution
        const matchedInstitution = findInstitutionByName(user.institutionName, allInstitutions);
        if (!matchedInstitution) {
          errors.push({
            row: rowNumber,
            field: 'institution',
            value: user.institutionName,
            message: `Institution not found: "${user.institutionName}"`,
          });
        } else {
          rowData.institutionMatched = matchedInstitution.name;
        }
      }

      data.push(rowData);
    }

    const uniqueErrorRows = new Set(errors.map((e) => e.row)).size;

    return {
      isValid: errors.length === 0,
      total: users.length,
      valid: users.length - uniqueErrorRows,
      invalid: uniqueErrorRows,
      errors,
      warnings,
      data,
    };
  }

  /**
   * Bulk upload users with batch processing
   * Supports partial success - valid records are created, invalid ones are skipped
   */
  async bulkUploadUsers(
    users: BulkUserRowDto[],
    defaultInstitutionId: string | null,
    createdBy: string,
  ): Promise<BulkUserResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // Fetch all institutions for matching and validate default institution id
    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true },
    });

    const sanitizedDefaultInstitutionId = resolveValidDefaultInstitutionId(
      defaultInstitutionId,
      allInstitutions,
    );

    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      this.logger.warn(
        `Ignoring invalid default institution id \"${defaultInstitutionId}\" during bulk user upload`,
      );
    }

    // Audit: Bulk user upload initiated
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkUserUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      userId: createdBy,
      institutionId: sanitizedDefaultInstitutionId,
      description: `Bulk user upload started: ${users.length} users`,
      newValues: {
        operation: 'bulk_user_upload_started',
        totalUsers: users.length,
        createdBy,
      },
    }).catch(() => {});

    // Get existing emails for validation
    const allEmails = users.map(u => u.email?.toLowerCase()).filter(Boolean) as string[];
    const existingUsers = await this.prisma.user.findMany({
      where: { email: { in: allEmails } },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map(u => u.email?.toLowerCase()));

    // Fetch all branches for matching (include shortName and code for better matching)
    const allBranches = await this.prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true },
    });

    // Track processed emails within the file
    const processedEmails = new Set<string>();

    // Process users one by one for partial success
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNumber = i + 2;

      // Per-row validation
      const rowErrors: string[] = [];

      // Required field validation
      if (!user.name?.trim()) {
        rowErrors.push('Name is required');
      }
      if (!user.email?.trim()) {
        rowErrors.push('Email is required');
      } else if (!this.isValidEmail(user.email)) {
        rowErrors.push('Invalid email format');
      }
      if (!user.role?.trim()) {
        rowErrors.push('Role is required');
      } else if (!validRoles.includes(user.role.toUpperCase())) {
        rowErrors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      // Phone is required for password generation
      if (!user.phone?.trim()) {
        rowErrors.push('Phone is required for password generation');
      } else {
        const phoneDigits = user.phone.replace(/\D/g, '');
        if (phoneDigits.length < 4) {
          rowErrors.push('Phone must have at least 4 digits');
        }
      }

      // Check for duplicates in database
      if (user.email && existingEmailSet.has(user.email.toLowerCase())) {
        rowErrors.push('Email already exists in database');
      }

      // Check for duplicates within the file
      if (user.email && processedEmails.has(user.email.toLowerCase())) {
        rowErrors.push('Duplicate email in file');
      }

      // If validation failed, add to failed records
      if (rowErrors.length > 0) {
        failedRecords.push({
          row: rowNumber,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          institution: user.institutionName,
          error: rowErrors.join('; '),
        });
        continue;
      }

      // Mark as processed
      if (user.email) processedEmails.add(user.email.toLowerCase());

      // Try to create the user
      try {
        // Determine institution ID
        let targetInstitutionId = sanitizedDefaultInstitutionId;
        let targetInstitutionName: string | null = null;

        if (user.institutionName && user.institutionName.trim() !== '') {
          const matchedInstitution = findInstitutionByName(user.institutionName, allInstitutions);
          if (matchedInstitution) {
            targetInstitutionId = matchedInstitution.id;
            targetInstitutionName = matchedInstitution.name;
          } else {
            // Do not silently fallback when a row explicitly provides institution name
            failedRecords.push({
              row: rowNumber,
              name: user.name,
              email: user.email,
              phone: user.phone,
              role: user.role,
              institution: user.institutionName,
              error: `Institution not found: "${user.institutionName}"`,
            });
            continue;
          }
        } else if (!sanitizedDefaultInstitutionId) {
          // No institution provided and no default
          failedRecords.push({
            row: rowNumber,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            institution: '',
            error: 'Institution is required (use "Name of the College" column)',
          });
          continue;
        }

        // Find branch if provided
        let branchId: string | null = null;
        let branchName: string | null = null;

        if (user.branchName && targetInstitutionId) {
          const matchedBranch = findBranchByName(user.branchName, targetInstitutionId, allBranches);
          if (matchedBranch) {
            branchId = matchedBranch.id;
            branchName = matchedBranch.name;
          } else {
            branchName = user.branchName; // Store name even if not matched
          }
        }

        // Create user
        const createdUser = await this.createUser(user, targetInstitutionId!, branchId, branchName);

        successRecords.push({
          row: rowNumber,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          designation: user.designation,
          institution: targetInstitutionName || user.institutionName,
          branch: branchName,
          userId: createdUser.id,
          password: createdUser.plainPassword,
          warning: createdUser.warning,
        });

        // Add to existing set
        if (user.email) existingEmailSet.add(user.email.toLowerCase());

        this.logger.log(`User created: ${user.email} (Row ${rowNumber})`);
      } catch (error) {
        failedRecords.push({
          row: rowNumber,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          institution: user.institutionName,
          error: error.message,
        });

        this.logger.error(`Failed to create user: ${user.email}`, error.stack);
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    if (failedRecords.length > 0) {
      const grouped = new Map<string, number>();
      for (const row of failedRecords) {
        const key = String(row.error || 'Unknown error').split(';')[0].trim();
        grouped.set(key, (grouped.get(key) || 0) + 1);
      }
      const topReasons = Array.from(grouped.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([reason, count]) => `${count}x ${reason}`)
        .join(' | ');
      this.logger.warn(`Bulk user upload top failure reasons: ${topReasons}`);
    }

    // Audit completion
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkUserUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: createdBy,
      institutionId: sanitizedDefaultInstitutionId,
      description: `Bulk user upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_user_upload_completed',
        totalUsers: users.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
      },
    }).catch(() => {});

    return {
      total: users.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single user
   */
  private async createUser(
    userDto: BulkUserRowDto,
    institutionId: string,
    branchId?: string | null,
    branchName?: string | null,
  ) {
    const role = ROLE_MAPPING[userDto.role] || Role.TEACHER;
    const designationEnum = mapDesignationToEnum(userDto.designation);

    // Staff capacity validation (warning only - non-blocking)
    let warningText: string | undefined;

    if (branchId) {
      // Get current academic year (format: "2024-25")
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth(); // 0-indexed
      // Academic year starts in July, so if before July, use previous year
      const academicStartYear = currentMonth < 6 ? currentYear - 1 : currentYear;
      const academicYear = `${academicStartYear}-${(academicStartYear + 1).toString().slice(-2)}`;

      const capacity = await this.prisma.branchStaffCapacity.findFirst({
        where: {
          institutionId,
          branchId,
          isActive: true,
          academicYear,
        },
      });

      if (capacity && capacity.sanctionedPosts > 0) {
        // Count current regular staff (not guest faculty)
        const currentCount = await this.prisma.user.count({
          where: {
            institutionId,
            branchId,
            role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR, Role.ADMIN_STAFF] },
            active: true,
            guestTeacher: { not: true },
          },
        });

        if (currentCount >= capacity.sanctionedPosts) {
          warningText = `Staff capacity exceeded: ${currentCount + 1} filled posts for ${capacity.sanctionedPosts} sanctioned posts.`;
          this.logger.warn(`Staff capacity exceeded for institution: ${institutionId}, branch: ${branchId}`);
        }
      }
    }

    // Generate custom password
    const plainPassword = generateCustomPassword(userDto.name, userDto.phone);
    if (!plainPassword) {
      throw new Error('Cannot generate password: Phone is required with at least 4 digits');
    }
    const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        name: userDto.name,
        email: userDto.email,
        password: hashedPassword,
        role,
        phoneNo: userDto.phone,
        designation: userDto.designation,
        designationEnum,
        active: true,
        institutionId,
        branchId: branchId || null,
        branchName: branchName || userDto.branchName || userDto.department || null,
        hasChangedDefaultPassword: false,
      },
    });

    return { ...user, plainPassword, warning: warningText };
  }

  /**
   * Download template for bulk user upload
   */
  async getTemplate(): Promise<Buffer> {
    const templateData = [
      {
        'Name of the Faculty': 'John Doe',
        'Email': 'john.doe@example.com',
        'Contact Number': '9876543210',
        'Name of the College': 'Government Polytechnic College Amritsar',
        'Course': 'Computer Science',
        'Designation': 'Professor',
        'Role': 'TEACHER',
      },
      {
        'Name of the Faculty': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '9876543211',
        'Role': 'TEACHER',
        'Designation': 'Assistant Professor',
      },
    ];

    const instructionsData = [
      { Field: 'Name of the Faculty', Required: 'Yes', Description: 'Full name of the faculty member', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique)', Example: 'john.doe@example.com' },
      { Field: 'Contact Number', Required: 'Yes', Description: 'Phone number (min 4 digits) - used for password', Example: '9876543210' },
      { Field: 'Name of the College', Required: 'Yes*', Description: '*Required for State Directorate. Auto-matches to institution.', Example: 'Government Polytechnic College Amritsar' },
      { Field: 'Course', Required: 'No', Description: 'Branch/Course name (auto-matches to branch)', Example: 'Computer Science' },
      { Field: 'Designation', Required: 'No', Description: 'Job designation', Example: 'Professor' },
      { Field: 'Role', Required: 'No', Description: 'TEACHER, FACULTY_SUPERVISOR, or ADMIN_STAFF (defaults to TEACHER)', Example: 'TEACHER' },
    ];

    const passwordInfo = [
      { Info: 'Password Format', Details: 'First 4 letters of name (lowercase) + @ + First 4 digits of phone' },
      { Info: 'Example', Details: 'Name: John Doe, Phone: 9876543210 -> Password: john@9876' },
      { Info: 'Important', Details: 'Phone number is REQUIRED and must have at least 4 digits' },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Users', data: templateData },
      { name: 'Instructions', data: instructionsData },
      { name: 'Password Info', data: passwordInfo },
    ]);
  }

  /**
   * Helper: Clean string values
   */
  private cleanString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return String(value).trim();
  }

  /**
   * Helper: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate Excel file for successfully created users with credentials
   */
  async generateCreatedUsersExcel(successRecords: any[]): Promise<Buffer> {
    const data = successRecords.map((record) => ({
      'Row': record.row,
      'Name': record.name,
      'Email': record.email,
      'Phone': record.phone || '',
      'Password': record.password,
      'Role': record.role,
      'Designation': record.designation || '',
      'Institution': record.institution || '',
      'Branch': record.branch || '',
    }));

    return ExcelUtils.createFromJson([
      { name: 'Created Users', data },
    ]);
  }

  /**
   * Generate Excel file for failed/error users
   */
  async generateErrorUsersExcel(failedRecords: any[]): Promise<Buffer> {
    const data = failedRecords.map((record) => ({
      'Row': record.row,
      'Name': record.name || '',
      'Email': record.email || '',
      'Phone': record.phone || '',
      'Role': record.role || '',
      'Institution': record.institution || '',
      'Error': record.error,
    }));

    return ExcelUtils.createFromJson([
      { name: 'Failed Users', data },
    ]);
  }
}
