import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { BulkUserRowDto, BulkUserResultDto, BulkUserValidationResultDto } from './dto/bulk-user.dto';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

// Valid roles that can be used in the bulk upload template.
const ROLE_MAPPING: Record<string, Role> = {
  TEACHER: Role.TEACHER,
  FACULTY_SUPERVISOR: Role.TEACHER,
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
 * Normalize institution name for comparison
 */
function normalizeInstitutionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/govt\.?/g, 'government')
    .replace(/governement/g, 'government')
    .replace(/poly\.?/g, 'polytechnic')
    .replace(/coll\.?/g, 'college')
    .replace(/inst\.?/g, 'institute')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize branch/course name for comparison
 */
function normalizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps course/branch names from Excel to database shortName codes
 * Database branches: AA, AS, CE, CSE, ECE, EE, IT, LT, ME
 */
const COURSE_TO_BRANCH_CODE: Record<string, string> = {
  // CSE - Computer Science and Engineering
  'computer science': 'CSE',
  'computer science and engineering': 'CSE',
  'computer science engineering': 'CSE',
  'computer engineering': 'CSE',
  'cse': 'CSE',
  'cs': 'CSE',

  // IT - Information Technology
  'information technology': 'IT',
  'it': 'IT',
  'infotech': 'IT',

  // ECE - Electronics and Communication Engineering
  'electronics': 'ECE',
  'electronics and communication': 'ECE',
  'electronics and communication engineering': 'ECE',
  'electronics and communications': 'ECE',
  'electronics and communications engineering': 'ECE',
  'electronics & communication': 'ECE',
  'electronics & communications': 'ECE',
  'ece': 'ECE',
  'ec': 'ECE',

  // EE - Electrical Engineering
  'electrical': 'EE',
  'electrical engineering': 'EE',
  'ee': 'EE',
  'elect': 'EE',

  // ME - Mechanical Engineering
  'mechanical': 'ME',
  'mechanical engineering': 'ME',
  'me': 'ME',
  'mech': 'ME',

  // CE - Civil Engineering
  'civil': 'CE',
  'civil engineering': 'CE',
  'ce': 'CE',

  // AA - Architectural Assistantship
  'architectural assistantship': 'AA',
  'architecture': 'AA',
  'architectural': 'AA',
  'aa': 'AA',
  'arch': 'AA',

  // AS - Applied Science
  'applied science': 'AS',
  'applied sciences': 'AS',
  'as': 'AS',
  'science': 'AS',

  // LT - Leather Technology
  'leather': 'LT',
  'leather technology': 'LT',
  'lt': 'LT',
};

/**
 * Get the branch code from a course/branch name
 * Returns the database shortName code (AA, AS, CE, CSE, ECE, EE, IT, LT, ME)
 */
function getBranchCode(courseName: string): string | null {
  const normalized = normalizeBranchName(courseName);

  // Direct lookup
  if (COURSE_TO_BRANCH_CODE[normalized]) {
    return COURSE_TO_BRANCH_CODE[normalized];
  }

  // Try uppercase (for abbreviations like CSE, IT)
  const upper = courseName.toUpperCase().trim();
  if (COURSE_TO_BRANCH_CODE[upper.toLowerCase()]) {
    return COURSE_TO_BRANCH_CODE[upper.toLowerCase()];
  }

  // Try partial matching
  for (const [key, code] of Object.entries(COURSE_TO_BRANCH_CODE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  return null;
}

@Injectable()
export class BulkUserService {
  private readonly logger = new Logger(BulkUserService.name);

  // Valid roles that can be used in bulk upload
  private readonly validRoles = ['TEACHER'];

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
          row['Name of the College'] || row['College'] || row['College Name'] || row['Institute']
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
      select: { id: true, name: true, code: true },
    });

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
      if (!defaultInstitutionId) {
        // STATE_DIRECTORATE - must have institution in Excel
        if (!user.institutionName || user.institutionName.trim() === '') {
          errors.push({
            row: rowNumber,
            field: 'institution',
            value: '',
            message: 'Institution name is required (use "Name of the College" column)',
          });
        } else {
          // Try to match institution
          const matchedInstitution = this.findInstitutionByName(user.institutionName, allInstitutions);
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

    // Audit: Bulk user upload initiated
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkUserUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      userId: createdBy,
      institutionId: defaultInstitutionId,
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

    // Fetch all institutions for matching
    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true },
    });

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
        let targetInstitutionId = defaultInstitutionId;
        let targetInstitutionName: string | null = null;

        if (user.institutionName) {
          const matchedInstitution = this.findInstitutionByName(user.institutionName, allInstitutions);
          if (matchedInstitution) {
            targetInstitutionId = matchedInstitution.id;
            targetInstitutionName = matchedInstitution.name;
          } else if (!defaultInstitutionId) {
            // No match and no default - error
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
        } else if (!defaultInstitutionId) {
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
          const matchedBranch = this.findBranchByName(user.branchName, targetInstitutionId, allBranches);
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

    // Audit completion
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkUserUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: createdBy,
      institutionId: defaultInstitutionId,
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
   * Find institution by name (fuzzy matching)
   */
  private findInstitutionByName(
    institutionName: string,
    allInstitutions: Array<{ id: string; name: string | null; code: string | null }>
  ): { id: string; name: string | null } | null {
    if (!institutionName) return null;

    const normalizedSearch = normalizeInstitutionName(institutionName);

    // Try exact normalized match
    let match = allInstitutions.find(i =>
      normalizeInstitutionName(i.name || '') === normalizedSearch
    );
    if (match) return match;

    // Try partial match (one contains the other)
    match = allInstitutions.find(i => {
      const normalizedInst = normalizeInstitutionName(i.name || '');
      return normalizedInst.includes(normalizedSearch) || normalizedSearch.includes(normalizedInst);
    });
    if (match) return match;

    return null;
  }

  /**
   * Find branch by name within an institution (fuzzy matching with abbreviation support)
   * Handles short forms like AS, CSE, ME, etc.
   */
  private findBranchByName(
    branchName: string,
    institutionId: string,
    allBranches: Array<{ id: string; name: string; shortName: string; code: string; institutionId: string | null }>
  ): { id: string; name: string; shortName: string } | null {
    if (!branchName) return null;

    // Get branches for this institution OR global branches (institutionId is null)
    const availableBranches = allBranches.filter(b =>
      b.institutionId === institutionId || b.institutionId === null
    );

    const searchUpper = branchName.toUpperCase().trim();
    const normalized = normalizeBranchName(branchName);

    // 1. Try exact shortName match (e.g., "CSE" -> "CSE")
    let match = availableBranches.find(b =>
      b.shortName.toUpperCase() === searchUpper ||
      b.code.toUpperCase() === searchUpper
    );
    if (match) return match;

    // 2. Try mapping course name to branch code
    const branchCode = getBranchCode(branchName);
    if (branchCode) {
      match = availableBranches.find(b =>
        b.shortName.toUpperCase() === branchCode ||
        b.code.toUpperCase() === branchCode
      );
      if (match) return match;
    }

    // 3. Try exact name match
    match = availableBranches.find(b =>
      normalizeBranchName(b.name) === normalized
    );
    if (match) return match;

    // 4. Try partial name match
    match = availableBranches.find(b => {
      const branchNormalized = normalizeBranchName(b.name);
      return branchNormalized.includes(normalized) || normalized.includes(branchNormalized);
    });
    if (match) return match;

    // 5. Try matching shortName in search term (e.g., "CSE Department" -> "CSE")
    match = availableBranches.find(b =>
      searchUpper.includes(b.shortName.toUpperCase())
    );
    if (match) return match;

    return null;
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
        active: true,
        institutionId,
        branchId: branchId || null,
        branchName: branchName || userDto.branchName || userDto.department || null,
        hasChangedDefaultPassword: false,
      },
    });

    return { ...user, plainPassword };
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
        'Role': 'FACULTY_SUPERVISOR',
      },
    ];

    const instructionsData = [
      { Field: 'Name of the Faculty', Required: 'Yes', Description: 'Full name of the faculty member', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique)', Example: 'john.doe@example.com' },
      { Field: 'Contact Number', Required: 'Yes', Description: 'Phone number (min 4 digits) - used for password', Example: '9876543210' },
      { Field: 'Name of the College', Required: 'Yes*', Description: '*Required for State Directorate. Auto-matches to institution.', Example: 'Government Polytechnic College Amritsar' },
      { Field: 'Course', Required: 'No', Description: 'Branch/Course name (auto-matches to branch)', Example: 'Computer Science' },
      { Field: 'Designation', Required: 'No', Description: 'Job designation', Example: 'Professor' },
      { Field: 'Role', Required: 'No', Description: 'TEACHER or FACULTY_SUPERVISOR (defaults to TEACHER)', Example: 'TEACHER' },
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
