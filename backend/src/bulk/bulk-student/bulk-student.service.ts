import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { BulkStudentRowDto, BulkStudentResultDto, BulkStudentValidationResultDto } from './dto/bulk-student.dto';
import { UserService, CreateStudentData } from '../../domain/user/user.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import {
  MatchableInstitution,
  MatchableBranch,
  findInstitutionByName,
  resolveValidDefaultInstitutionId,
  findBranchByName,
} from '../../core/common/utils/institution-matcher.util';

/**
 * Students are uploaded without email/phone/DOB/gender. Roll number is the login
 * identifier (see AuthService.validateStudentByRollNumber). A stable, unique dummy
 * email is still generated because User.email backs a unique DB index and other
 * features may read it - it is never used for login.
 */
function generateDummyEmail(rollNumber: string): string {
  const sanitized = rollNumber
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
  return `${sanitized || 'student'}@placeintern.com`;
}

/** How many students to create concurrently in a bulk upload batch. DB-round-trip latency
 *  dominates row creation time, so running independent rows concurrently (rather than one
 *  at a time) is what makes large uploads fast. Kept modest to stay within Prisma's connection pool. */
const BULK_CREATE_CONCURRENCY = 15;

async function processInChunks<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(worker));
    results.push(...chunkResults);
  }
  return results;
}

@Injectable()
export class BulkStudentService {
  private readonly logger = new Logger(BulkStudentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parse CSV/Excel file and extract student data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkStudentRowDto[]> {
    try {
      const { workbook } = await ExcelUtils.read(buffer);

      // Convert to JSON
      const rawData = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

      // Map CSV columns to DTO fields
      const students: BulkStudentRowDto[] = rawData.map((row: any) => ({
        rollNumber: this.cleanString(row['Roll Number'] || row['rollNumber'] || row['Roll No'] || row['Roll No.']),
        name: this.cleanString(row['Name'] || row['name'] || row['Student Name']),
        admissionYear: this.parseNumber(row['Admission Year'] || row['admissionYear'] || row['Year of Admission']),
        batchName: this.cleanString(row['Batch'] || row['batch'] || row['Batch Name']),
        institutionName: this.cleanString(
          row['Institution'] || row['institution'] || row['Institution Name'] ||
          row['Name of the College'] || row['College'] || row['College Name'] || row['Institute'] ||
          row['Institute Name'] || row['College/Institute'] || row['Institute/College'] ||
          row['Name of Institute'] || row['Name of Institution'] || row['Institution Code'] ||
          row['College Code'] || row['Institute Code'],
        ),
        branchName: this.cleanString(row['Branch'] || row['branch'] || row['Course'] || row['course']),
      }));

      return students;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate student data before processing
   */
  async validateStudents(
    students: BulkStudentRowDto[],
    defaultInstitutionId: string | null,
  ): Promise<BulkStudentValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];
    const warnings: Array<{ row: number; field?: string; message: string }> = [];

    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true },
    });
    const allBranches = await this.prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true },
    });
    const batchMap = await this.userService.getBatchMap();
    const batches = await this.prisma.batch.findMany({ where: { isActive: true }, select: { name: true } });

    const sanitizedDefaultInstitutionId = resolveValidDefaultInstitutionId(defaultInstitutionId, allInstitutions);
    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      warnings.push({
        row: 0,
        message: `Default institution id "${defaultInstitutionId}" is invalid. Institution will be resolved from Excel per row.`,
      });
    }

    const allRollNumbers = students.map((s) => s.rollNumber?.trim()).filter((v): v is string => !!v);
    const existingRollNumberSet = await this.userService.findExistingRollNumbers(allRollNumbers);
    const rollNumberFirstOccurrence = new Map<string, number>();

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      if (!student.name || student.name.trim() === '') {
        errors.push({ row: rowNumber, field: 'name', value: student.name, error: 'Name is required' });
      }

      if (!student.rollNumber || student.rollNumber.trim() === '') {
        errors.push({ row: rowNumber, field: 'rollNumber', value: student.rollNumber, error: 'Roll number is required' });
      } else {
        const rollNumber = student.rollNumber.trim();
        const firstRow = rollNumberFirstOccurrence.get(rollNumber);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'rollNumber',
            value: rollNumber,
            error: `Duplicate roll number in file (also found in row ${firstRow})`,
          });
        } else {
          rollNumberFirstOccurrence.set(rollNumber, rowNumber);
        }

        if (existingRollNumberSet.has(rollNumber)) {
          errors.push({
            row: rowNumber,
            field: 'rollNumber',
            value: rollNumber,
            error: 'Roll number already exists in the system',
          });
        }
      }

      if (!student.admissionYear) {
        errors.push({ row: rowNumber, field: 'admissionYear', value: '', error: 'Admission year is required' });
      } else if (student.admissionYear < 2000 || student.admissionYear > 2100) {
        errors.push({
          row: rowNumber,
          field: 'admissionYear',
          value: String(student.admissionYear),
          error: 'Admission year must be between 2000 and 2100',
        });
      }

      // Batch validation (required)
      if (!student.batchName || student.batchName.trim() === '') {
        errors.push({ row: rowNumber, field: 'batchName', value: '', error: 'Batch is required' });
      } else if (!batchMap.has(student.batchName.trim().toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: 'batchName',
          value: student.batchName,
          error: `Batch "${student.batchName.trim()}" not found in the system. Available batches: ${batches.map((b) => b.name).join(', ')}`,
        });
      }

      // Institution resolution
      let resolvedInstitution: MatchableInstitution | null = null;
      if (student.institutionName && student.institutionName.trim() !== '') {
        resolvedInstitution = findInstitutionByName(student.institutionName, allInstitutions);
        if (!resolvedInstitution) {
          errors.push({
            row: rowNumber,
            field: 'institutionName',
            value: student.institutionName,
            error: `Institution not found: "${student.institutionName}"`,
          });
        }
      } else if (!sanitizedDefaultInstitutionId) {
        errors.push({
          row: rowNumber,
          field: 'institutionName',
          value: '',
          error: 'College Name is required (use the "College Name" column)',
        });
      }

      // Optional: branch/course
      if (student.branchName && student.branchName.trim() !== '') {
        const institutionIdForBranch = resolvedInstitution?.id || sanitizedDefaultInstitutionId;
        const matchedBranch = institutionIdForBranch
          ? findBranchByName(student.branchName, institutionIdForBranch, allBranches as MatchableBranch[])
          : null;
        if (!matchedBranch) {
          warnings.push({
            row: rowNumber,
            field: 'branchName',
            message: `Branch "${student.branchName}" not found. Student will be created without branch assignment.`,
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map((e) => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: students.length,
      validRows: students.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
      warnings,
    };
  }

  /**
   * Bulk upload students with batch processing
   * Supports partial success - valid records are created, invalid ones are skipped
   */
  async bulkUploadStudents(
    students: BulkStudentRowDto[],
    defaultInstitutionId: string | null,
    createdBy: string,
    performedByUserId?: string,
  ): Promise<BulkStudentResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkStudentUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId: defaultInstitutionId || undefined,
      description: `Bulk student upload started: ${students.length} students`,
      newValues: {
        operation: 'bulk_student_upload_started',
        totalStudents: students.length,
        createdBy,
      },
    }).catch(() => {});

    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true },
    });
    const allBranches = await this.prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true },
    });
    const batchMap = await this.userService.getBatchMap();

    // Precompute intake capacity data ONCE for the whole batch (instead of per-row inside
    // UserService.createStudent) - this is what makes large uploads fast, since it turns
    // 3 sequential DB round-trips per row into 2 queries total for the entire file.
    const activeIntakes = await this.prisma.branchIntake.findMany({
      where: { isActive: true },
      select: { institutionId: true, branchId: true, batchId: true, academicYear: true, sanctionedSeats: true, feeWaiverSeats: true },
    });
    const intakeLimitMap = new Map<string, number>();
    for (const intake of activeIntakes) {
      if (!intake.institutionId || !intake.branchId) continue;
      const limit = (intake.sanctionedSeats || 0) + (intake.feeWaiverSeats || 0);
      if (intake.batchId) intakeLimitMap.set(`${intake.institutionId}_${intake.branchId}_${intake.batchId}`, limit);
      if (intake.academicYear) intakeLimitMap.set(`${intake.institutionId}_${intake.branchId}_${intake.academicYear}`, limit);
    }

    const currentStudentCounts = await this.prisma.student.groupBy({
      by: ['institutionId', 'branchId', 'batchId'],
      where: { user: { active: true }, branchId: { not: null }, batchId: { not: null } },
      _count: { id: true },
    });
    const currentCountMap = new Map<string, number>();
    for (const c of currentStudentCounts) {
      if (c.institutionId && c.branchId && c.batchId) {
        currentCountMap.set(`${c.institutionId}_${c.branchId}_${c.batchId}`, c._count.id);
      }
    }
    const incomingCountMap = new Map<string, number>();

    const sanitizedDefaultInstitutionId = resolveValidDefaultInstitutionId(defaultInstitutionId, allInstitutions);
    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      this.logger.warn(`Ignoring invalid default institution id "${defaultInstitutionId}" during bulk student upload`);
    }

    const allRollNumbers = students.map((s) => s.rollNumber?.trim()).filter((v): v is string => !!v);
    const existingRollNumberSet = await this.userService.findExistingRollNumbers(allRollNumbers);
    const processedRollNumbers = new Set<string>();

    interface ToCreate {
      rowNumber: number;
      student: BulkStudentRowDto;
      rollNumber: string;
      targetInstitutionId: string;
      targetInstitutionName: string | null;
      batchId: string;
      branchId?: string;
      branchName?: string;
      warning?: string;
    }
    const toCreate: ToCreate[] = [];

    // Phase 1: validate & resolve every row (cheap, CPU-only, sequential - no DB writes yet)
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNumber = i + 2;
      const rollNumber = student.rollNumber?.trim();

      const rowErrors: string[] = [];

      if (!student.name?.trim()) {
        rowErrors.push('Name is required');
      }
      if (!rollNumber) {
        rowErrors.push('Roll number is required');
      }
      if (!student.admissionYear) {
        rowErrors.push('Admission year is required');
      } else if (student.admissionYear < 2000 || student.admissionYear > 2100) {
        rowErrors.push('Admission year must be between 2000 and 2100');
      }

      if (rollNumber && existingRollNumberSet.has(rollNumber)) {
        rowErrors.push('Roll number already exists in database');
      }
      if (rollNumber && processedRollNumbers.has(rollNumber)) {
        rowErrors.push('Duplicate roll number in file');
      }

      // Resolve batch (required)
      let batchId: string | undefined;
      if (!student.batchName?.trim()) {
        rowErrors.push('Batch is required');
      } else {
        batchId = batchMap.get(student.batchName.trim().toLowerCase());
        if (!batchId) {
          rowErrors.push(`Batch "${student.batchName.trim()}" not found`);
        }
      }

      // Resolve institution
      let targetInstitutionId = sanitizedDefaultInstitutionId;
      let targetInstitutionName: string | null = null;

      if (student.institutionName && student.institutionName.trim() !== '') {
        const matchedInstitution = findInstitutionByName(student.institutionName, allInstitutions);
        if (matchedInstitution) {
          targetInstitutionId = matchedInstitution.id;
          targetInstitutionName = matchedInstitution.name;
        } else {
          rowErrors.push(`Institution not found: "${student.institutionName}"`);
        }
      } else if (!sanitizedDefaultInstitutionId) {
        rowErrors.push('College Name is required (use the "College Name" column)');
      }

      if (rowErrors.length > 0) {
        failedRecords.push({
          row: rowNumber,
          name: student.name,
          rollNumber,
          institution: student.institutionName,
          error: rowErrors.join('; '),
        });
        continue;
      }

      processedRollNumbers.add(rollNumber);
      existingRollNumberSet.add(rollNumber);

      // Resolve branch (optional, non-blocking)
      let branchId: string | undefined;
      let branchName: string | undefined;
      if (student.branchName && targetInstitutionId) {
        const matchedBranch = findBranchByName(student.branchName, targetInstitutionId, allBranches as MatchableBranch[]);
        if (matchedBranch) {
          branchId = matchedBranch.id;
          branchName = matchedBranch.name;
        }
      }

      // Intake capacity check (warning only) using the precomputed maps
      let warning: string | undefined;
      if (targetInstitutionId && branchId && batchId) {
        const exactKey = `${targetInstitutionId}_${branchId}_${batchId}`;
        const nameKey = `${targetInstitutionId}_${branchId}_${student.batchName?.trim()}`;
        const limit = intakeLimitMap.get(exactKey) ?? intakeLimitMap.get(nameKey);

        if (limit !== undefined) {
          const currentCount = currentCountMap.get(exactKey) || 0;
          const incomingCount = incomingCountMap.get(exactKey) || 0;

          if (currentCount + incomingCount >= limit) {
            warning = `Intake capacity exceeded: ${currentCount + incomingCount + 1} active students for ${limit} available seats.`;
          }
          incomingCountMap.set(exactKey, incomingCount + 1);
        }
      }

      toCreate.push({
        rowNumber,
        student,
        rollNumber,
        targetInstitutionId,
        targetInstitutionName,
        batchId,
        branchId,
        branchName,
        warning,
      });
    }

    // Phase 2: create the validated rows concurrently (in bounded chunks) - this is the part
    // that was previously a fully sequential loop and dominated wall-clock time on large files.
    await processInChunks(toCreate, BULK_CREATE_CONCURRENCY, async (entry) => {
      try {
        const result = await this.createStudent(
          entry.student,
          entry.targetInstitutionId,
          entry.rollNumber,
          entry.batchId,
          entry.branchId,
          entry.branchName,
          entry.warning,
        );

        successRecords.push({
          row: entry.rowNumber,
          name: entry.student.name,
          rollNumber: entry.rollNumber,
          institution: entry.targetInstitutionName || entry.student.institutionName,
          branch: entry.branchName,
          studentId: result.student.id,
          userId: result.user.id,
          temporaryPassword: result.temporaryPassword,
          warning: result.warning,
        });

        this.logger.log(`Student created: ${entry.rollNumber} (Row ${entry.rowNumber})`);
      } catch (error) {
        failedRecords.push({
          row: entry.rowNumber,
          name: entry.student.name,
          rollNumber: entry.rollNumber,
          institution: entry.student.institutionName,
          error: error.message,
        });

        this.logger.error(`Failed to create student: ${entry.rollNumber} (Row ${entry.rowNumber})`, error.stack);
      }
    });

    // Keep results ordered by original row number regardless of concurrent completion order
    successRecords.sort((a, b) => a.row - b.row);
    failedRecords.sort((a, b) => a.row - b.row);

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    this.auditService.log({
      action: AuditAction.USER_REGISTRATION,
      entityType: 'BulkStudentUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId: sanitizedDefaultInstitutionId || undefined,
      description: `Bulk student upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_student_upload_completed',
        totalStudents: students.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
        createdBy,
        failedRollNumbers: failedRecords.map((r) => r.rollNumber).filter(Boolean),
      },
    }).catch(() => {});

    return {
      total: students.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single student - delegates to domain UserService
   */
  private async createStudent(
    studentDto: BulkStudentRowDto,
    institutionId: string,
    rollNumber: string,
    batchId: string,
    branchId?: string,
    branchName?: string,
    precomputedWarning?: string,
  ) {
    const studentData: CreateStudentData = {
      name: studentDto.name,
      email: generateDummyEmail(rollNumber),
      rollNumber,
      batchId,
      branchId,
      branchName: branchName || studentDto.branchName,
      admissionYear: studentDto.admissionYear,
    };

    // Delegate to domain service (skip validation + the per-row intake capacity lookup,
    // since bulk already validated and precomputed intake capacity for the whole batch)
    return this.userService.createStudent(institutionId, studentData, {
      skipValidation: true,
      skipIntakeCapacityCheck: true,
      precomputedWarning,
    });
  }

  /**
   * Download template for bulk student upload
   */
  async getTemplate(): Promise<Buffer> {
    const templateData = [
      {
        'Roll Number': 'R2023001',
        'Name': 'John Doe',
        'Admission Year': 2025,
        'Batch': '2023-2026',
        'College Name': 'Government Polytechnic College Amritsar',
        'Course': 'Computer Science',
      },
      {
        'Roll Number': 'R2023002',
        'Name': 'Jane Smith',
        'Admission Year': 2025,
        'Batch': '2023-2026',
        'College Name': 'Government Polytechnic College Amritsar',
        'Course': 'Electronics',
      },
    ];

    const instructionsData = [
      { Field: 'Roll Number', Required: 'Yes', Description: 'Unique roll number - also used as the student login ID', Example: 'R2023001' },
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the student', Example: 'John Doe' },
      { Field: 'Admission Year', Required: 'Yes', Description: 'Year of admission (e.g., 2025). Used to calculate current year/semester.', Example: '2025' },
      { Field: 'Batch', Required: 'Yes', Description: 'Batch name, must match an existing batch (e.g., "2023-2026")', Example: '2023-2026' },
      { Field: 'College Name', Required: 'Yes*', Description: '*Required for State Directorate. Auto-matches to institution.', Example: 'Government Polytechnic College Amritsar' },
      { Field: 'Course', Required: 'No', Description: 'Branch/Course name (auto-matches to branch)', Example: 'Computer Science' },
    ];

    const loginInfo = [
      { Info: 'Login', Details: 'Students log in with Roll Number + Password (no email needed).' },
      { Info: 'Password Format', Details: 'First 4 letters of name (lowercase) + last 4 characters of roll number + "@123"' },
      { Info: 'Example', Details: 'Name: John Doe, Roll Number: R2023001 -> Password: john3001@123' },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Students', data: templateData },
      { name: 'Instructions', data: instructionsData },
      { name: 'Login Info', data: loginInfo },
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
   * Helper: Parse number values
   */
  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }
}
