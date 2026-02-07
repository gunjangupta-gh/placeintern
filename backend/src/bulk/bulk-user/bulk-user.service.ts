import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Role, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { BulkUserRowDto, BulkUserResultDto, BulkUserValidationResultDto } from './dto/bulk-user.dto';
import { ExcelUtils, addSheetFromJson, createWorkbook, writeToBuffer } from '../../core/common/utils/excel.util';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { BCRYPT_SALT_ROUNDS } from '../../core/auth/services/auth.service';

// Valid roles that can be used in the bulk upload template.
// Keep this list intentionally small/safe.
const ROLE_MAPPING: Record<string, Role> = {
  TEACHER: Role.TEACHER,
  FACULTY_SUPERVISOR: Role.TEACHER,
};
const validRoles = Object.keys(ROLE_MAPPING);

@Injectable()
export class BulkUserService {
  private readonly logger = new Logger(BulkUserService.name);

  // Valid roles that can be used in bulk upload
  private readonly validRoles = ['TEACHER', 'FACULTY_SUPERVISOR'];

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

      // Map CSV columns to DTO fields
      const users: BulkUserRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(row['Name'] || row['name'] || row['Full Name']),
        email: this.cleanString(row['Email'] || row['email'])?.toLowerCase(),
        phone: this.cleanString(row['Phone'] || row['phone'] || row['Contact']),
        role: this.cleanString(row['Role'] || row['role'])?.toUpperCase(),
        designation: this.cleanString(row['Designation'] || row['designation']),
        department: this.cleanString(row['Department'] || row['department']),
        employeeId: this.cleanString(row['Employee ID'] || row['employeeId'] || row['Employee Id']),
      }));

      return users;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate user data before processing
   * OPTIMIZED: Uses batch queries instead of N+1, O(n) duplicate detection with Maps
   */
  async validateUsers(users: BulkUserRowDto[], institutionId: string): Promise<BulkUserValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];

    // OPTIMIZATION: Extract all emails for batch query
    const allEmails = users
      .map((u) => u.email?.toLowerCase())
      .filter((email): email is string => !!email);

    // OPTIMIZATION: Batch query to check existing emails
    const existingUsers = await this.prisma.user.findMany({
      where: {
        email: { in: allEmails },
      },
      select: { email: true },
    });
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    // OPTIMIZATION: O(n) duplicate detection using Map instead of O(n²) findIndex
    const emailFirstOccurrence = new Map<string, number>();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required field validation
      if (!user.name || user.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: user.name,
          error: 'Name is required',
        });
      }

      if (!user.email || user.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          error: 'Email is required',
        });
      } else if (!this.isValidEmail(user.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: user.email,
          error: 'Invalid email format',
        });
      }

      if (!user.role || user.role.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          error: 'Role is required',
        });
      } else if (!validRoles.includes(user.role)) {
        errors.push({
          row: rowNumber,
          field: 'role',
          value: user.role,
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
        });
      }

      // OPTIMIZATION: O(1) duplicate email check in file using Map
      if (user.email) {
        const emailLower = user.email.toLowerCase();
        const firstRow = emailFirstOccurrence.get(emailLower);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: user.email,
            error: `Duplicate email in file (also found in row ${firstRow})`,
          });
        } else {
          emailFirstOccurrence.set(emailLower, rowNumber);
        }

        // OPTIMIZATION: O(1) check against pre-fetched existing emails
        if (existingEmailSet.has(emailLower)) {
          errors.push({
            row: rowNumber,
            field: 'email',
            value: user.email,
            error: 'Email already exists in the system',
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map((e) => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: users.length,
      validRows: users.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
    };
  }

  /**
   * Bulk upload users with batch processing
   * Supports partial success - valid records are created, invalid ones are skipped
   */
  async bulkUploadUsers(
    users: BulkUserRowDto[],
    institutionId: string,
    createdBy: string,
    performedByUserId?: string,
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
      userId: performedByUserId,
      institutionId,
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

    // Track processed emails within the file
    const processedEmails = new Set<string>();

    // Process users one by one for partial success
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

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
          role: user.role,
          error: rowErrors.join('; '),
        });
        continue;
      }

      // Mark as processed to detect duplicates within file
      if (user.email) processedEmails.add(user.email.toLowerCase());

      // Try to create the user
      try {
        const createdUser = await this.createUser(user, institutionId);

        successRecords.push({
          row: rowNumber,
          name: user.name,
          email: user.email,
          role: user.role,
          userId: createdUser.id,
        });

        // Add to existing set to prevent duplicates in subsequent rows
        if (user.email) existingEmailSet.add(user.email.toLowerCase());

        this.logger.log(`User created: ${user.email} (Row ${rowNumber})`);
      } catch (error) {
        failedRecords.push({
          row: rowNumber,
          name: user.name,
          email: user.email,
          role: user.role,
          error: error.message,
        });

        this.logger.error(`Failed to create user: ${user.email} (Row ${rowNumber})`, error.stack);
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    // Audit: Bulk user upload completed
    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkUserUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId,
      description: `Bulk user upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_user_upload_completed',
        totalUsers: users.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
        createdBy,
        failedEmails: failedRecords.map(r => r.email).filter(Boolean),
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
  private async createUser(userDto: BulkUserRowDto, institutionId: string) {
    const role = ROLE_MAPPING[userDto.role] || Role.TEACHER;

    // Generate default password
    const defaultPassword = 'Welcome@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, BCRYPT_SALT_ROUNDS);

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
        hasChangedDefaultPassword: false,
      },
    });

    return user;
  }

  /**
   * Download template for bulk user upload
   */
  async getTemplate(): Promise<Buffer> {
    const templateData = [
      {
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Phone': '9876543210',
        'Role': 'TEACHER',
        'Designation': 'Professor',
        'Department': 'Computer Science',
        'Employee ID': 'EMP001',
      },
      {
        'Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '9876543211',
        'Role': 'FACULTY_SUPERVISOR',
        'Designation': 'Assistant Professor',
        'Department': 'Electronics',
        'Employee ID': 'EMP002',
      },
    ];

    const instructionsData = [
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the user', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique)', Example: 'john.doe@example.com' },
      { Field: 'Phone', Required: 'No', Description: 'Contact phone number', Example: '9876543210' },
      { Field: 'Designation', Required: 'No', Description: 'Job designation', Example: 'Professor' },
      { Field: 'Department', Required: 'No', Description: 'Department name', Example: 'Computer Science' },
      { Field: 'Employee ID', Required: 'No', Description: 'Employee identification number', Example: 'EMP001' },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Users', data: templateData },
      { name: 'Instructions', data: instructionsData },
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
}
