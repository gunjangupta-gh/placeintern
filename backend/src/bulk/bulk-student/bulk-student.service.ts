import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  AdmissionType,
  AuditAction,
  AuditCategory,
  AuditSeverity,
  Category,
} from '../../generated/prisma/client';
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

/** How many students to create concurrently in a bulk upload batch. DB-round-trip latency
 *  dominates row creation time, so running independent rows concurrently (rather than one
 *  at a time) is what makes large uploads fast. Kept modest to stay within Prisma's connection pool. */
const BULK_CREATE_CONCURRENCY = 15;

/** Rows pre-formatted as Excel dropdowns in the template (rows 2..N). */
const TEMPLATE_DROPDOWN_ROWS = 2000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];

/** Accepted spellings (lowercased, non-alphanumerics stripped) -> canonical enum value */
const CATEGORY_ALIASES: Record<string, Category> = {
  general: Category.GENERAL,
  gen: Category.GENERAL,
  ur: Category.GENERAL,
  unreserved: Category.GENERAL,
  obc: Category.OBC,
  sc: Category.SC,
  st: Category.ST,
};
const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST'];

const ADMISSION_TYPE_ALIASES: Record<string, AdmissionType> = {
  firstyear: AdmissionType.FIRST_YEAR,
  '1styear': AdmissionType.FIRST_YEAR,
  regular: AdmissionType.FIRST_YEAR,
  leet: AdmissionType.LEET,
  lateralentry: AdmissionType.LEET,
  lateral: AdmissionType.LEET,
};
const ADMISSION_TYPE_OPTIONS = ['First Year', 'LEET'];

/** Scholarship cell values meaning "no scholarship" (the column itself is optional) */
const NO_SCHOLARSHIP_VALUES = new Set(['none', 'no', 'na', 'nil', 'notapplicable']);

function aliasKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Returns a 10-digit Indian mobile number, or null if the value is not one. */
function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

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

interface RowError {
  field: string;
  value?: string;
  error: string;
}

interface ResolvedRow {
  rollNumber: string;
  email: string;
  phone: string;
  gender: string;
  category: Category;
  admissionType: AdmissionType;
  scholarshipId?: string;
  batchId: string;
  institutionId: string;
  institutionName: string | null;
  branchId: string;
  branchName: string;
}

/** Lookup data loaded once per file and shared by every row. */
interface RowContext {
  allInstitutions: MatchableInstitution[];
  allBranches: MatchableBranch[];
  batchMap: Map<string, string>;
  batchNames: string[];
  /** aliasKey(code) and aliasKey(name) -> scholarship id */
  scholarshipMap: Map<string, string>;
  scholarshipCodes: string[];
  defaultInstitutionId: string | null;
  existingRollNumbers: Set<string>;
  existingEmails: Set<string>;
  seenRollNumbers: Map<string, number>;
  seenEmails: Map<string, number>;
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
        name: this.cleanString(row['Name'] || row['name'] || row['Student Name'] || row['Full Name']),
        email: this.cleanString(row['Email'] || row['email'] || row['E-mail'] || row['Email ID'])?.toLowerCase(),
        phone: this.cleanString(
          row['Contact Number'] || row['Contact No'] || row['Contact No.'] || row['Contact'] ||
          row['Phone'] || row['phone'] || row['Mobile'] || row['Mobile No'] || row['Phone Number'],
        ),
        gender: this.cleanString(row['Gender'] || row['gender'] || row['Sex']),
        category: this.cleanString(row['Category'] || row['category'] || row['Caste Category']),
        admissionType: this.cleanString(
          row['Admission Type'] || row['admissionType'] || row['Type of Admission'] || row['Admission Mode'],
        ),
        admissionYear: this.parseNumber(row['Admission Year'] || row['admissionYear'] || row['Year of Admission']),
        batchName: this.cleanString(row['Batch'] || row['batch'] || row['Batch Name']),
        scholarship: this.cleanString(row['Scholarship'] || row['scholarship'] || row['Scholarship Code']),
        institutionName: this.cleanString(
          row['Institution'] || row['institution'] || row['Institution Name'] ||
          row['Name of the College'] || row['College'] || row['College Name'] || row['Institute'] ||
          row['Institute Name'] || row['College/Institute'] || row['Institute/College'] ||
          row['Name of Institute'] || row['Name of Institution'] || row['Institution Code'] ||
          row['College Code'] || row['Institute Code'],
        ),
        branchName: this.cleanString(
          row['Course'] || row['course'] || row['Course Name'] || row['Branch'] || row['branch'],
        ),
      }));

      return students;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Load every lookup needed to validate rows, once per file.
   */
  private async buildRowContext(
    students: BulkStudentRowDto[],
    defaultInstitutionId: string | null,
  ): Promise<{ ctx: RowContext; warnings: Array<{ row: number; field?: string; message: string }> }> {
    const warnings: Array<{ row: number; field?: string; message: string }> = [];

    const allInstitutions = await this.prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true },
    });
    const allBranches = await this.prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true },
    });
    const batchMap = await this.userService.getBatchMap();
    const batches = await this.prisma.batch.findMany({ where: { isActive: true }, select: { name: true } });
    const scholarships = await this.prisma.scholarship.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });
    const scholarshipMap = new Map<string, string>();
    for (const s of scholarships) {
      scholarshipMap.set(aliasKey(s.code), s.id);
      scholarshipMap.set(aliasKey(s.name), s.id);
    }

    const sanitizedDefaultInstitutionId = resolveValidDefaultInstitutionId(defaultInstitutionId, allInstitutions);
    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      warnings.push({
        row: 0,
        message: `Default institution id "${defaultInstitutionId}" is invalid. Institution will be resolved from Excel per row.`,
      });
    }

    const allRollNumbers = students.map((s) => s.rollNumber?.trim()).filter((v): v is string => !!v);
    const existingRollNumbers = await this.userService.findExistingRollNumbers(allRollNumbers);

    const allEmails = students.map((s) => s.email?.trim().toLowerCase()).filter((v): v is string => !!v);
    const existingUsers = allEmails.length
      ? await this.prisma.user.findMany({ where: { email: { in: allEmails } }, select: { email: true } })
      : [];
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    return {
      ctx: {
        allInstitutions,
        allBranches: allBranches as MatchableBranch[],
        batchMap,
        batchNames: batches.map((b) => b.name),
        scholarshipMap,
        scholarshipCodes: scholarships.map((s) => s.code),
        defaultInstitutionId: sanitizedDefaultInstitutionId,
        existingRollNumbers: new Set(existingRollNumbers),
        existingEmails,
        seenRollNumbers: new Map(),
        seenEmails: new Map(),
      },
      warnings,
    };
  }

  /**
   * Validate one row and resolve its lookups (batch, college, course, enums). Every field is
   * required. Shared by validateStudents and bulkUploadStudents so both apply identical rules.
   */
  private resolveRow(
    student: BulkStudentRowDto,
    rowNumber: number,
    ctx: RowContext,
  ): { errors: RowError[]; resolved?: ResolvedRow } {
    const errors: RowError[] = [];

    // Name
    if (!student.name?.trim()) {
      errors.push({ field: 'name', value: student.name, error: 'Name is required' });
    }

    // Roll number
    const rollNumber = student.rollNumber?.trim();
    if (!rollNumber) {
      errors.push({ field: 'rollNumber', value: student.rollNumber, error: 'Roll number is required' });
    } else {
      const firstRow = ctx.seenRollNumbers.get(rollNumber);
      if (firstRow !== undefined) {
        errors.push({
          field: 'rollNumber',
          value: rollNumber,
          error: `Duplicate roll number in file (also found in row ${firstRow})`,
        });
      }
      if (ctx.existingRollNumbers.has(rollNumber)) {
        errors.push({ field: 'rollNumber', value: rollNumber, error: 'Roll number already exists in the system' });
      }
    }

    // Email
    const email = student.email?.trim().toLowerCase();
    if (!email) {
      errors.push({ field: 'email', value: student.email, error: 'Email is required' });
    } else if (!EMAIL_REGEX.test(email)) {
      errors.push({ field: 'email', value: email, error: 'Invalid email format' });
    } else {
      const firstRow = ctx.seenEmails.get(email);
      if (firstRow !== undefined) {
        errors.push({
          field: 'email',
          value: email,
          error: `Duplicate email in file (also found in row ${firstRow})`,
        });
      }
      if (ctx.existingEmails.has(email)) {
        errors.push({ field: 'email', value: email, error: 'Email already exists in the system' });
      }
    }

    // Contact number
    let phone: string | null = null;
    if (!student.phone?.trim()) {
      errors.push({ field: 'phone', value: student.phone, error: 'Contact number is required' });
    } else {
      phone = normalizePhone(student.phone);
      if (!phone) {
        errors.push({
          field: 'phone',
          value: student.phone,
          error: 'Contact number must be a valid 10-digit mobile number',
        });
      }
    }

    // Gender
    let gender: string | undefined;
    if (!student.gender?.trim()) {
      errors.push({ field: 'gender', value: student.gender, error: 'Gender is required' });
    } else {
      gender = GENDER_OPTIONS.find((g) => g.toLowerCase() === student.gender!.trim().toLowerCase());
      if (!gender) {
        errors.push({
          field: 'gender',
          value: student.gender,
          error: `Invalid gender "${student.gender.trim()}". Allowed: ${GENDER_OPTIONS.join(', ')}`,
        });
      }
    }

    // Category
    let category: Category | undefined;
    if (!student.category?.trim()) {
      errors.push({ field: 'category', value: student.category, error: 'Category is required' });
    } else {
      category = CATEGORY_ALIASES[aliasKey(student.category)];
      if (!category) {
        errors.push({
          field: 'category',
          value: student.category,
          error: `Invalid category "${student.category.trim()}". Allowed: ${CATEGORY_OPTIONS.join(', ')}`,
        });
      }
    }

    // Admission type
    let admissionType: AdmissionType | undefined;
    if (!student.admissionType?.trim()) {
      errors.push({ field: 'admissionType', value: student.admissionType, error: 'Admission type is required' });
    } else {
      admissionType = ADMISSION_TYPE_ALIASES[aliasKey(student.admissionType)];
      if (!admissionType) {
        errors.push({
          field: 'admissionType',
          value: student.admissionType,
          error: `Invalid admission type "${student.admissionType.trim()}". Allowed: ${ADMISSION_TYPE_OPTIONS.join(', ')}`,
        });
      }
    }

    // Scholarship (optional: blank or "None" means no scholarship)
    let scholarshipId: string | undefined;
    const scholarshipInput = student.scholarship?.trim();
    if (scholarshipInput && !NO_SCHOLARSHIP_VALUES.has(aliasKey(scholarshipInput))) {
      scholarshipId = ctx.scholarshipMap.get(aliasKey(scholarshipInput));
      if (!scholarshipId) {
        errors.push({
          field: 'scholarship',
          value: scholarshipInput,
          error: `Scholarship "${scholarshipInput}" not found. Allowed codes: ${ctx.scholarshipCodes.join(', ') || 'none configured'} (or leave blank)`,
        });
      }
    }

    // Admission year
    if (!student.admissionYear) {
      errors.push({ field: 'admissionYear', value: '', error: 'Admission year is required' });
    } else if (student.admissionYear < 2000 || student.admissionYear > 2100) {
      errors.push({
        field: 'admissionYear',
        value: String(student.admissionYear),
        error: 'Admission year must be between 2000 and 2100',
      });
    }

    // Batch
    let batchId: string | undefined;
    if (!student.batchName?.trim()) {
      errors.push({ field: 'batchName', value: '', error: 'Batch is required' });
    } else {
      batchId = ctx.batchMap.get(student.batchName.trim().toLowerCase());
      if (!batchId) {
        errors.push({
          field: 'batchName',
          value: student.batchName,
          error: `Batch "${student.batchName.trim()}" not found in the system. Available batches: ${ctx.batchNames.join(', ')}`,
        });
      }
    }

    // College
    let institution: MatchableInstitution | null = null;
    if (!student.institutionName?.trim()) {
      errors.push({
        field: 'institutionName',
        value: '',
        error: 'College Name is required (use the "College Name" column)',
      });
    } else {
      institution = findInstitutionByName(student.institutionName, ctx.allInstitutions);
      if (!institution) {
        errors.push({
          field: 'institutionName',
          value: student.institutionName,
          error: `Institution not found: "${student.institutionName}"`,
        });
      } else if (ctx.defaultInstitutionId && institution.id !== ctx.defaultInstitutionId) {
        // A principal (or a state user who picked a college) may only upload into that college
        errors.push({
          field: 'institutionName',
          value: student.institutionName,
          error: `College "${student.institutionName.trim()}" does not match the institution you are uploading for`,
        });
        institution = null;
      }
    }

    // Course (full name of the branch within the resolved college)
    let branch: MatchableBranch | null = null;
    if (!student.branchName?.trim()) {
      errors.push({ field: 'branchName', value: '', error: 'Course is required (use the full course name)' });
    } else if (institution) {
      branch = findBranchByName(student.branchName, institution.id, ctx.allBranches);
      if (!branch) {
        errors.push({
          field: 'branchName',
          value: student.branchName,
          error: `Course "${student.branchName.trim()}" not found for this college. Use the full course name from the "Courses" sheet of the template`,
        });
      }
    }

    if (errors.length > 0) {
      return { errors };
    }

    // Row is clean: reserve its identifiers so later rows can be flagged as duplicates
    ctx.seenRollNumbers.set(rollNumber!, rowNumber);
    ctx.seenEmails.set(email!, rowNumber);

    return {
      errors,
      resolved: {
        rollNumber: rollNumber!,
        email: email!,
        phone: phone!,
        gender: gender!,
        category: category!,
        admissionType: admissionType!,
        scholarshipId,
        batchId: batchId!,
        institutionId: institution!.id,
        institutionName: institution!.name,
        branchId: branch!.id,
        branchName: branch!.name,
      },
    };
  }

  /**
   * Validate student data before processing
   */
  async validateStudents(
    students: BulkStudentRowDto[],
    defaultInstitutionId: string | null,
  ): Promise<BulkStudentValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];
    const { ctx, warnings } = await this.buildRowContext(students, defaultInstitutionId);

    for (let i = 0; i < students.length; i++) {
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed
      const result = this.resolveRow(students[i], rowNumber, ctx);
      for (const e of result.errors) {
        errors.push({ row: rowNumber, ...e });
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

    const { ctx } = await this.buildRowContext(students, defaultInstitutionId);
    const sanitizedDefaultInstitutionId = ctx.defaultInstitutionId;
    if (defaultInstitutionId && !sanitizedDefaultInstitutionId) {
      this.logger.warn(`Ignoring invalid default institution id "${defaultInstitutionId}" during bulk student upload`);
    }

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

    interface ToCreate {
      rowNumber: number;
      student: BulkStudentRowDto;
      resolved: ResolvedRow;
      warning?: string;
    }
    const toCreate: ToCreate[] = [];

    // Phase 1: validate & resolve every row (cheap, CPU-only, sequential - no DB writes yet)
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNumber = i + 2;
      const { errors, resolved } = this.resolveRow(student, rowNumber, ctx);

      if (errors.length > 0 || !resolved) {
        failedRecords.push({
          row: rowNumber,
          name: student.name,
          rollNumber: student.rollNumber?.trim(),
          email: student.email,
          institution: student.institutionName,
          error: errors.map((e) => e.error).join('; '),
        });
        continue;
      }

      // Intake capacity check (warning only) using the precomputed maps
      let warning: string | undefined;
      const exactKey = `${resolved.institutionId}_${resolved.branchId}_${resolved.batchId}`;
      const nameKey = `${resolved.institutionId}_${resolved.branchId}_${student.batchName?.trim()}`;
      const limit = intakeLimitMap.get(exactKey) ?? intakeLimitMap.get(nameKey);

      if (limit !== undefined) {
        const currentCount = currentCountMap.get(exactKey) || 0;
        const incomingCount = incomingCountMap.get(exactKey) || 0;

        if (currentCount + incomingCount >= limit) {
          warning = `Intake capacity exceeded: ${currentCount + incomingCount + 1} active students for ${limit} available seats.`;
        }
        incomingCountMap.set(exactKey, incomingCount + 1);
      }

      toCreate.push({ rowNumber, student, resolved, warning });
    }

    // Phase 2: create the validated rows concurrently (in bounded chunks) - this is the part
    // that was previously a fully sequential loop and dominated wall-clock time on large files.
    await processInChunks(toCreate, BULK_CREATE_CONCURRENCY, async (entry) => {
      const { resolved } = entry;
      try {
        const result = await this.createStudent(entry.student, resolved, entry.warning);

        successRecords.push({
          row: entry.rowNumber,
          name: entry.student.name,
          rollNumber: resolved.rollNumber,
          email: resolved.email,
          institution: resolved.institutionName || entry.student.institutionName,
          branch: resolved.branchName,
          studentId: result.student.id,
          userId: result.user.id,
          temporaryPassword: result.temporaryPassword,
          warning: result.warning,
        });

        this.logger.log(`Student created: ${resolved.rollNumber} (Row ${entry.rowNumber})`);
      } catch (error) {
        failedRecords.push({
          row: entry.rowNumber,
          name: entry.student.name,
          rollNumber: resolved.rollNumber,
          email: resolved.email,
          institution: entry.student.institutionName,
          error: error.message,
        });

        this.logger.error(`Failed to create student: ${resolved.rollNumber} (Row ${entry.rowNumber})`, error.stack);
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
  private async createStudent(studentDto: BulkStudentRowDto, resolved: ResolvedRow, precomputedWarning?: string) {
    const studentData: CreateStudentData = {
      name: studentDto.name,
      email: resolved.email,
      phoneNo: resolved.phone,
      rollNumber: resolved.rollNumber,
      gender: resolved.gender,
      category: resolved.category,
      admissionType: resolved.admissionType,
      scholarshipId: resolved.scholarshipId,
      batchId: resolved.batchId,
      branchId: resolved.branchId,
      branchName: resolved.branchName,
      admissionYear: studentDto.admissionYear,
    };

    // Delegate to domain service (skip validation + the per-row intake capacity lookup,
    // since bulk already validated and precomputed intake capacity for the whole batch)
    return this.userService.createStudent(resolved.institutionId, studentData, {
      skipValidation: true,
      skipIntakeCapacityCheck: true,
      precomputedWarning,
    });
  }

  /**
   * Download template for bulk student upload.
   *
   * @param institutionId When set (principal), example rows and the "Courses" reference sheet
   *   are scoped to that college. When null (state/admin), all colleges are listed.
   */
  async getTemplate(institutionId?: string | null): Promise<Buffer> {
    const [institutions, branches, batches, scholarships] = await Promise.all([
      this.prisma.institution.findMany({
        where: institutionId ? { id: institutionId } : undefined,
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.branch.findMany({
        where: institutionId ? { OR: [{ institutionId }, { institutionId: null }] } : undefined,
        select: { id: true, name: true, shortName: true, code: true, institutionId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.batch.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } }),
      this.prisma.scholarship.findMany({
        where: { isActive: true },
        select: { code: true, name: true },
        orderBy: [{ category: 'asc' }, { code: 'asc' }],
      }),
    ]);

    // One reference row per college + course; global (institution-less) branches apply to every listed college
    const courseRows: Array<{ 'College Name': string; 'Course (Full Name)': string; 'Short Name': string }> = [];
    for (const inst of institutions) {
      for (const b of branches.filter((br) => br.institutionId === inst.id || br.institutionId === null)) {
        courseRows.push({ 'College Name': inst.name, 'Course (Full Name)': b.name, 'Short Name': b.shortName });
      }
    }

    // Example rows use real data from the system so the sample links cleanly
    const exampleCollege = institutions[0]?.name || 'Government Polytechnic College Amritsar';
    const exampleCourses = courseRows
      .filter((r) => r['College Name'] === exampleCollege)
      .map((r) => r['Course (Full Name)']);
    const exampleBatch = batches[batches.length - 1]?.name || '2023-2026';

    const templateData = [
      {
        'Roll Number': 'R2023001',
        'Name': 'John Doe',
        'Email': 'john.doe@example.com',
        'Contact Number': '9876543210',
        'Gender': 'Male',
        'Category': 'General',
        'Admission Type': 'First Year',
        'Admission Year': 2025,
        'Batch': exampleBatch,
        'College Name': exampleCollege,
        'Course': exampleCourses[0] || 'Computer Science and Engineering',
        'Scholarship': scholarships[0]?.code || '',
      },
      {
        'Roll Number': 'R2023002',
        'Name': 'Jane Smith',
        'Email': 'jane.smith@example.com',
        'Contact Number': '9876543211',
        'Gender': 'Female',
        'Category': 'SC',
        'Admission Type': 'LEET',
        'Admission Year': 2025,
        'Batch': exampleBatch,
        'College Name': exampleCollege,
        'Course': exampleCourses[1] || exampleCourses[0] || 'Electronics and Communication Engineering',
        'Scholarship': 'None',
      },
    ];

    const instructionsData = [
      { Field: 'Roll Number', Required: 'Yes', Description: 'Unique roll number - also used as the student login ID', Example: 'R2023001' },
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the student', Example: 'John Doe' },
      { Field: 'Email', Required: 'Yes', Description: 'Valid email address (must be unique across the system)', Example: 'john.doe@example.com' },
      { Field: 'Contact Number', Required: 'Yes', Description: '10-digit mobile number', Example: '9876543210' },
      { Field: 'Gender', Required: 'Yes', Description: `One of: ${GENDER_OPTIONS.join(', ')}`, Example: 'Male' },
      { Field: 'Category', Required: 'Yes', Description: `One of: ${CATEGORY_OPTIONS.join(', ')}`, Example: 'General' },
      { Field: 'Admission Type', Required: 'Yes', Description: `One of: ${ADMISSION_TYPE_OPTIONS.join(', ')}`, Example: 'First Year' },
      { Field: 'Admission Year', Required: 'Yes', Description: 'Year of admission (e.g., 2025). Used to calculate current year/semester.', Example: '2025' },
      { Field: 'Batch', Required: 'Yes', Description: 'Batch name, must match an existing batch (see "Batches" sheet)', Example: exampleBatch },
      { Field: 'College Name', Required: 'Yes', Description: 'Full college name, auto-matches to the institution (see "Courses" sheet)', Example: exampleCollege },
      { Field: 'Course', Required: 'Yes', Description: 'FULL course name exactly as listed in the "Courses" sheet for that college', Example: exampleCourses[0] || 'Computer Science and Engineering' },
      { Field: 'Scholarship', Required: 'No', Description: 'Scholarship code or name from the "Scholarships" sheet. Leave blank or write "None" if the student has no scholarship.', Example: scholarships[0]?.code || 'None' },
    ];

    const loginInfo = [
      { Info: 'Login', Details: 'Students log in with Roll Number + Password.' },
      { Info: 'Password Format', Details: 'First 4 letters of name (lowercase) + @ + last 4 characters of roll number' },
      { Info: 'Example', Details: 'Name: John Doe, Roll Number: R2023001 -> Password: john@3001' },
    ];

    return ExcelUtils.buildWorkbook((workbook) => {
      const students = ExcelUtils.addSheetFromJson(workbook, 'Students', templateData);
      ExcelUtils.addSheetFromJson(workbook, 'Instructions', instructionsData);
      ExcelUtils.addSheetFromJson(
        workbook,
        'Courses',
        courseRows.length ? courseRows : [{ 'College Name': '', 'Course (Full Name)': '', 'Short Name': '' }],
        { columnWidths: { 'College Name': 50, 'Course (Full Name)': 50, 'Short Name': 14 } },
      );
      ExcelUtils.addSheetFromJson(
        workbook,
        'Batches',
        batches.length ? batches.map((b) => ({ Batch: b.name })) : [{ Batch: exampleBatch }],
      );
      ExcelUtils.addSheetFromJson(
        workbook,
        'Scholarships',
        scholarships.length
          ? scholarships.map((s) => ({ Code: s.code, Name: s.name }))
          : [{ Code: '', Name: '' }],
        { columnWidths: { Code: 16, Name: 50 } },
      );
      ExcelUtils.addSheetFromJson(workbook, 'Login Info', loginInfo);

      // Dropdowns so users pick valid values instead of typing them
      const lastRow = TEMPLATE_DROPDOWN_ROWS + 1;
      const list = (col: string, formula: string) => {
        // exceljs groups a whole range under one <dataValidation>; the typings only expose per-cell
        (students as any).dataValidations.add(`${col}2:${col}${lastRow}`, {
          type: 'list',
          allowBlank: false,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: 'Please choose a value from the list.',
        });
      };
      list('E', `"${GENDER_OPTIONS.join(',')}"`);
      list('F', `"${CATEGORY_OPTIONS.join(',')}"`);
      list('G', `"${ADMISSION_TYPE_OPTIONS.join(',')}"`);
      if (batches.length) list('I', `Batches!$A$2:$A$${batches.length + 1}`);
      // Scholarship is optional, so blanks stay allowed
      if (scholarships.length) {
        (students as any).dataValidations.add(`L2:L${lastRow}`, {
          type: 'list',
          allowBlank: true,
          formulae: [`"None,${scholarships.map((s) => s.code).join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Invalid value',
          error: 'Please choose a scholarship code from the list, or leave blank.',
        });
      }
      // Course dropdown only when the list is unambiguous (single college)
      if (institutions.length === 1 && courseRows.length) {
        list('K', `Courses!$B$2:$B$${courseRows.length + 1}`);
      }
    });
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
