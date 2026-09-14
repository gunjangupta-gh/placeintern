import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ExcelUtils } from '../../core/common/utils/excel.util';
import { EnrollmentStatus, InternshipMode, Role } from '../../generated/prisma/client';
import {
  BulkInternshipReportRowDto,
  BulkInternshipReportValidationResultDto,
  BulkInternshipReportResultDto,
  BulkInternshipReportRowError,
  BulkInternshipReportRowWarning,
} from './dto/bulk-internship-report.dto';

const HEADERS = {
  studentId: 'Student ID (do not edit)',
  rollNumber: 'Roll Number',
  studentName: 'Student Name',
  branch: 'Branch',
  semester: 'Semester',
  email: 'Email',
  phone: 'Phone',
  enrollmentStatus: 'Enrollment Status (Enrolled / Dropped Out)',
  companyName: 'Company Name*',
  organizationWebsite: 'Organization Website',
  modeOfInternship: 'Mode of Internship (Online / Offline)',
  industrySector: 'Industry Sector',
  isWorkInPunjab: 'Work In Punjab (Yes / No)',
  workDistrict: 'Work District (if in Punjab)',
  workState: 'Work State (if outside Punjab)',
  hrName: 'HR Name',
  hrPhoneNumber: 'HR Phone Number',
  isStipendOffered: 'Stipend Offered (Yes / No)',
  stipendAmountPerMonth: 'Stipend Amount Per Month (₹)',
  isOfferLetterReceived: 'Offer Letter Received (Yes / No)',
  offerLetterUrl: 'Offer Letter URL',
  facultyMentorEmail: 'Faculty Mentor Email',
} as const;

const TEMPLATE_HEADER_ORDER = Object.values(HEADERS);

@Injectable()
export class InternshipReportBulkService {
  private readonly logger = new Logger(InternshipReportBulkService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getTemplate(institutionId: string): Promise<Buffer> {
    const students = await this.prisma.student.findMany({
      where: { institutionId, user: { active: true } },
      select: {
        id: true,
        admissionNumber: true,
        currentSemester: true,
        user: {
          select: { name: true, rollNumber: true, email: true, phoneNo: true, branchName: true },
        },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const rows = students.map((s) => [
      s.id,
      s.user?.rollNumber || s.admissionNumber || '',
      s.user?.name || '',
      s.user?.branchName || '',
      s.currentSemester ?? '',
      s.user?.email || '',
      s.user?.phoneNo || '',
      '', // enrollmentStatus - defaults to Enrolled if left blank
      '', // companyName
      '', // organizationWebsite
      '', // modeOfInternship
      '', // industrySector
      '', // isWorkInPunjab
      '', // workDistrict
      '', // workState
      '', // hrName
      '', // hrPhoneNumber
      '', // isStipendOffered
      '', // stipendAmountPerMonth
      '', // isOfferLetterReceived
      '', // offerLetterUrl
      '', // facultyMentorEmail
    ]);

    const instructions = [
      ['Field', 'Required', 'Notes'],
      [HEADERS.studentId, 'System reference', 'Do not edit or delete this column — it is used to match each row back to the student.'],
      [HEADERS.rollNumber, 'Reference only', 'Shown for your convenience; not used for matching.'],
      [HEADERS.companyName, 'Yes', 'Name of the organisation where the student interned.'],
      [HEADERS.enrollmentStatus, 'No', 'Enrolled or Dropped Out. Defaults to Enrolled if left blank.'],
      [HEADERS.modeOfInternship, 'No', 'Online or Offline.'],
      [HEADERS.isWorkInPunjab, 'No', 'Yes or No. If Yes, fill Work District. If No, fill Work State.'],
      [HEADERS.isStipendOffered, 'No', 'Yes or No. If Yes, fill Stipend Amount Per Month.'],
      [HEADERS.isOfferLetterReceived, 'No', 'Yes or No.'],
      [HEADERS.facultyMentorEmail, 'No', 'Must be the email of a Teacher / Faculty Coordinator in your institution.'],
    ];

    return ExcelUtils.buildWorkbook((workbook) => {
      const sheet = workbook.addWorksheet('Internship Confirmation');
      sheet.addRow(TEMPLATE_HEADER_ORDER);
      sheet.getRow(1).font = { bold: true };
      rows.forEach((row) => sheet.addRow(row));
      TEMPLATE_HEADER_ORDER.forEach((header, index) => {
        sheet.getColumn(index + 1).width = Math.min(Math.max(header.length + 2, 14), 40);
      });
      sheet.getColumn(1).hidden = true;

      const instructionsSheet = workbook.addWorksheet('Instructions');
      instructions.forEach((row) => instructionsSheet.addRow(row));
      instructionsSheet.getRow(1).font = { bold: true };
      instructionsSheet.getColumn(1).width = 40;
      instructionsSheet.getColumn(2).width = 18;
      instructionsSheet.getColumn(3).width = 70;
    });
  }

  async parseUploadedFile(buffer: Buffer): Promise<BulkInternshipReportRowDto[]> {
    const { workbook } = await ExcelUtils.read(buffer);
    const rawRows = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

    return rawRows.map((row) => ({
      studentId: this.clean(this.field(row, HEADERS.studentId)),
      rollNumber: this.clean(this.field(row, HEADERS.rollNumber)),
      enrollmentStatus: this.clean(this.field(row, HEADERS.enrollmentStatus)),
      companyName: this.clean(this.field(row, HEADERS.companyName)),
      organizationWebsite: this.clean(this.field(row, HEADERS.organizationWebsite)),
      modeOfInternship: this.clean(this.field(row, HEADERS.modeOfInternship)),
      industrySector: this.clean(this.field(row, HEADERS.industrySector)),
      isWorkInPunjab: this.clean(this.field(row, HEADERS.isWorkInPunjab)),
      workDistrict: this.clean(this.field(row, HEADERS.workDistrict)),
      workState: this.clean(this.field(row, HEADERS.workState)),
      hrName: this.clean(this.field(row, HEADERS.hrName)),
      hrPhoneNumber: this.clean(this.field(row, HEADERS.hrPhoneNumber)),
      isStipendOffered: this.clean(this.field(row, HEADERS.isStipendOffered)),
      stipendAmountPerMonth: this.clean(this.field(row, HEADERS.stipendAmountPerMonth)),
      isOfferLetterReceived: this.clean(this.field(row, HEADERS.isOfferLetterReceived)),
      offerLetterUrl: this.clean(this.field(row, HEADERS.offerLetterUrl)),
      facultyMentorEmail: this.clean(this.field(row, HEADERS.facultyMentorEmail)),
    }));
  }

  async validate(
    rows: BulkInternshipReportRowDto[],
    institutionId: string,
  ): Promise<BulkInternshipReportValidationResultDto> {
    const errors: BulkInternshipReportRowError[] = [];
    const warnings: BulkInternshipReportRowWarning[] = [];

    const { studentByIdOrRoll, mentorByEmail } = await this.loadLookups(institutionId);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const student = this.resolveStudent(row, studentByIdOrRoll);
      const label = row.rollNumber || row.studentId;

      if (!student) {
        errors.push({ row: rowNumber, student: label, error: 'Student not found in your institution (Student ID column may be missing or edited)' });
        continue;
      }

      if (!row.companyName) {
        errors.push({ row: rowNumber, student: label, field: 'companyName', error: 'Company name is required' });
      }

      const rowErrors = this.validateOptionalFields(row, rowNumber, label, mentorByEmail);
      errors.push(...rowErrors.errors);
      warnings.push(...rowErrors.warnings);
    }

    const uniqueErrorRows = new Set(errors.map((e) => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: rows.length,
      validRows: rows.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
      warnings,
    };
  }

  async upload(
    rows: BulkInternshipReportRowDto[],
    institutionId: string,
    createdBy: string,
  ): Promise<BulkInternshipReportResultDto> {
    const startTime = Date.now();
    const successRecords: BulkInternshipReportResultDto['successRecords'] = [];
    const failedRecords: BulkInternshipReportResultDto['failedRecords'] = [];

    const { studentByIdOrRoll, mentorByEmail } = await this.loadLookups(institutionId);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const label = row.rollNumber || row.studentId;

      const student = this.resolveStudent(row, studentByIdOrRoll);
      if (!student) {
        failedRecords.push({ row: rowNumber, student: label, companyName: row.companyName, error: 'Student not found in your institution' });
        continue;
      }

      if (!row.companyName) {
        failedRecords.push({ row: rowNumber, student: label, error: 'Company name is required' });
        continue;
      }

      const { errors } = this.validateOptionalFields(row, rowNumber, label, mentorByEmail);
      if (errors.length > 0) {
        failedRecords.push({
          row: rowNumber,
          student: label,
          companyName: row.companyName,
          error: errors.map((e) => e.error).join('; '),
        });
        continue;
      }

      try {
        const isWorkInPunjab = this.parseYesNo(row.isWorkInPunjab);
        const isStipendOffered = this.parseYesNo(row.isStipendOffered);
        const isOfferLetterReceived = this.parseYesNo(row.isOfferLetterReceived);
        const facultyMentorId = row.facultyMentorEmail
          ? mentorByEmail.get(row.facultyMentorEmail.toLowerCase())?.id
          : undefined;

        await this.prisma.internshipReport.create({
          data: {
            studentId: student.id,
            institutionId,
            enrollmentStatus: this.parseEnrollmentStatus(row.enrollmentStatus) ?? EnrollmentStatus.ENROLLED,
            companyName: row.companyName!,
            organizationWebsite: row.organizationWebsite || null,
            modeOfInternship: this.parseInternshipMode(row.modeOfInternship),
            industrySector: row.industrySector || null,
            isWorkInPunjab: isWorkInPunjab ?? null,
            workDistrict: isWorkInPunjab === true ? row.workDistrict || null : null,
            workState: isWorkInPunjab === false ? row.workState || null : null,
            hrName: row.hrName || null,
            hrPhoneNumber: row.hrPhoneNumber || null,
            isStipendOffered: isStipendOffered ?? null,
            stipendAmountPerMonth: isStipendOffered ? this.parseNumber(row.stipendAmountPerMonth) : null,
            isOfferLetterReceived: isOfferLetterReceived ?? null,
            offerLetterUrl: isOfferLetterReceived ? row.offerLetterUrl || null : null,
            facultyMentorId: facultyMentorId || null,
            createdBy,
          },
        });

        successRecords.push({ row: rowNumber, student: label, companyName: row.companyName });
      } catch (error) {
        this.logger.error(`Failed to create internship report (row ${rowNumber}): ${error.message}`, error.stack);
        failedRecords.push({ row: rowNumber, student: label, companyName: row.companyName, error: error.message });
      }
    }

    return {
      total: rows.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime: Date.now() - startTime,
    };
  }

  // ---- helpers ----

  private async loadLookups(institutionId: string) {
    const students = await this.prisma.student.findMany({
      where: { institutionId, user: { active: true } },
      select: { id: true, admissionNumber: true, user: { select: { rollNumber: true } } },
    });

    const studentByIdOrRoll = new Map<string, { id: string }>();
    for (const s of students) {
      studentByIdOrRoll.set(s.id, s);
      if (s.user?.rollNumber) studentByIdOrRoll.set(s.user.rollNumber.toLowerCase(), s);
      if (s.admissionNumber) studentByIdOrRoll.set(s.admissionNumber.toLowerCase(), s);
    }

    const mentors = await this.prisma.user.findMany({
      where: { institutionId, role: { in: [Role.TEACHER, Role.FACULTY_COORDINATOR] } },
      select: { id: true, email: true },
    });
    const mentorByEmail = new Map(mentors.filter((m) => m.email).map((m) => [m.email!.toLowerCase(), m]));

    return { studentByIdOrRoll, mentorByEmail };
  }

  private resolveStudent(
    row: BulkInternshipReportRowDto,
    studentByIdOrRoll: Map<string, { id: string }>,
  ): { id: string } | undefined {
    if (row.studentId && studentByIdOrRoll.has(row.studentId)) {
      return studentByIdOrRoll.get(row.studentId);
    }
    if (row.rollNumber && studentByIdOrRoll.has(row.rollNumber.toLowerCase())) {
      return studentByIdOrRoll.get(row.rollNumber.toLowerCase());
    }
    return undefined;
  }

  private validateOptionalFields(
    row: BulkInternshipReportRowDto,
    rowNumber: number,
    label: string | undefined,
    mentorByEmail: Map<string, { id: string }>,
  ): { errors: BulkInternshipReportRowError[]; warnings: BulkInternshipReportRowWarning[] } {
    const errors: BulkInternshipReportRowError[] = [];
    const warnings: BulkInternshipReportRowWarning[] = [];

    if (row.enrollmentStatus && !this.parseEnrollmentStatus(row.enrollmentStatus)) {
      errors.push({ row: rowNumber, student: label, field: 'enrollmentStatus', error: `Invalid enrollment status "${row.enrollmentStatus}" (expected Enrolled or Dropped Out)` });
    }

    if (row.modeOfInternship && !this.parseInternshipMode(row.modeOfInternship)) {
      errors.push({ row: rowNumber, student: label, field: 'modeOfInternship', error: `Invalid mode "${row.modeOfInternship}" (expected Online or Offline)` });
    }

    const isWorkInPunjab = this.parseYesNoOrError(row.isWorkInPunjab, rowNumber, label, 'isWorkInPunjab', errors);
    if (isWorkInPunjab === true && !row.workDistrict) {
      errors.push({ row: rowNumber, student: label, field: 'workDistrict', error: 'Work District is required when Work In Punjab is Yes' });
    }
    if (isWorkInPunjab === false && !row.workState) {
      errors.push({ row: rowNumber, student: label, field: 'workState', error: 'Work State is required when Work In Punjab is No' });
    }

    const isStipendOffered = this.parseYesNoOrError(row.isStipendOffered, rowNumber, label, 'isStipendOffered', errors);
    if (isStipendOffered === true) {
      const amount = this.parseNumber(row.stipendAmountPerMonth);
      if (amount === undefined || amount < 0) {
        errors.push({ row: rowNumber, student: label, field: 'stipendAmountPerMonth', error: 'Stipend Amount Per Month is required (and must be a positive number) when Stipend Offered is Yes' });
      }
    }

    const isOfferLetterReceived = this.parseYesNoOrError(row.isOfferLetterReceived, rowNumber, label, 'isOfferLetterReceived', errors);
    if (isOfferLetterReceived === true && !row.offerLetterUrl) {
      errors.push({ row: rowNumber, student: label, field: 'offerLetterUrl', error: 'Offer Letter URL is required when Offer Letter Received is Yes' });
    }

    if (row.facultyMentorEmail && !mentorByEmail.has(row.facultyMentorEmail.toLowerCase())) {
      warnings.push({ row: rowNumber, student: label, field: 'facultyMentorEmail', message: `Faculty mentor email "${row.facultyMentorEmail}" not found among Teachers/Faculty Coordinators in your institution — will be saved without a linked mentor` });
    }

    return { errors, warnings };
  }

  private parseYesNoOrError(
    value: string | undefined,
    rowNumber: number,
    label: string | undefined,
    field: string,
    errors: BulkInternshipReportRowError[],
  ): boolean | undefined {
    if (!value) return undefined;
    const parsed = this.parseYesNo(value);
    if (parsed === undefined) {
      errors.push({ row: rowNumber, student: label, field, error: `Invalid value "${value}" for ${field} (expected Yes or No)` });
    }
    return parsed;
  }

  private parseYesNo(value: string | undefined): boolean | undefined {
    if (!value) return undefined;
    const v = value.trim().toLowerCase();
    if (['yes', 'y', 'true'].includes(v)) return true;
    if (['no', 'n', 'false'].includes(v)) return false;
    return undefined;
  }

  private parseEnrollmentStatus(value: string | undefined): EnrollmentStatus | undefined {
    if (!value) return undefined;
    const v = value.trim().toLowerCase();
    if (v === 'enrolled') return EnrollmentStatus.ENROLLED;
    if (v === 'dropped out' || v === 'dropped_out' || v === 'droppedout') return EnrollmentStatus.DROPPED_OUT;
    return undefined;
  }

  private parseInternshipMode(value: string | undefined): InternshipMode | undefined {
    if (!value) return undefined;
    const v = value.trim().toLowerCase();
    if (v === 'online') return InternshipMode.ONLINE;
    if (v === 'offline') return InternshipMode.OFFLINE;
    return undefined;
  }

  private parseNumber(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const n = Number(value);
    return isNaN(n) ? undefined : n;
  }

  private field(row: Record<string, any>, header: string): any {
    return row[header];
  }

  private clean(value: any): string | undefined {
    if (value === null || value === undefined) return undefined;
    const str = String(value).trim();
    return str === '' ? undefined : str;
  }
}
