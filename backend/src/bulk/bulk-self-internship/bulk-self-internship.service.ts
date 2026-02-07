import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  BulkSelfInternshipRowDto,
  BulkSelfInternshipResultDto,
  BulkSelfInternshipValidationResultDto,
} from './dto/bulk-self-internship.dto';
import { ApplicationStatus, InternshipPhase, AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExcelUtils } from '../../core/common/utils/excel.util';

@Injectable()
export class BulkSelfInternshipService {
  private readonly logger = new Logger(BulkSelfInternshipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parse CSV/Excel file and extract self-identified internship data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkSelfInternshipRowDto[]> {
    try {
      const { workbook } = await ExcelUtils.read(buffer);

      const rawData = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

      const internships: BulkSelfInternshipRowDto[] = rawData.map((row: any) => ({
        // Student identification
        studentEmail: this.cleanString(row['Student Email'] || row['Email'] || row['studentEmail'])?.toLowerCase(),
        studentRollNumber: this.cleanString(row['Roll Number'] || row['rollNumber'] || row['Roll No']),
        enrollmentNumber: this.cleanString(row['Enrollment Number'] || row['enrollmentNumber'] || row['Admission Number']),

        // Company information
        companyName: this.cleanString(row['Company Name'] || row['companyName'] || row['Company']),
        companyAddress: this.cleanString(row['Company Address'] || row['companyAddress']),
        companyContact: this.cleanString(row['Company Contact'] || row['companyContact'] || row['Company Phone']),
        companyEmail: this.cleanString(row['Company Email'] || row['companyEmail'])?.toLowerCase(),

        // HR information
        hrName: this.cleanString(row['HR Name'] || row['hrName'] || row['Contact Person']),
        hrDesignation: this.cleanString(row['HR Designation'] || row['hrDesignation']),
        hrContact: this.cleanString(row['HR Contact'] || row['hrContact'] || row['HR Phone']),
        hrEmail: this.cleanString(row['HR Email'] || row['hrEmail'])?.toLowerCase(),

        // Internship details
        jobProfile: this.cleanString(row['Job Profile'] || row['jobProfile'] || row['Role'] || row['Position']),
        stipend: this.cleanString(row['Stipend'] || row['stipend']),
        startDate: this.cleanString(row['Start Date'] || row['startDate']),
        endDate: this.cleanString(row['End Date'] || row['endDate']),
        duration: this.cleanString(row['Duration'] || row['duration']),

        // Faculty mentor details
        facultyMentorName: this.cleanString(row['Faculty Mentor Name'] || row['Mentor Name'] || row['facultyMentorName']),
        facultyMentorEmail: this.cleanString(row['Faculty Mentor Email'] || row['Mentor Email'] || row['facultyMentorEmail'])?.toLowerCase(),
        facultyMentorContact: this.cleanString(row['Faculty Mentor Contact'] || row['Mentor Contact'] || row['facultyMentorContact']),
        facultyMentorDesignation: this.cleanString(row['Faculty Mentor Designation'] || row['facultyMentorDesignation']),

        // Joining letter
        joiningLetterUrl: this.cleanString(row['Joining Letter URL'] || row['joiningLetterUrl']),
      }));

      return internships;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate internship data before processing
   * OPTIMIZED: Uses batch queries instead of N+1 individual queries
   */
  async validateInternships(
    internships: BulkSelfInternshipRowDto[],
    institutionId: string,
  ): Promise<BulkSelfInternshipValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];
    const warnings: Array<{ row: number; field?: string; message: string }> = [];

    // Fetch all ACTIVE students with ACTIVE users in the institution for validation
    const students = await this.prisma.student.findMany({
      where: { institutionId, user: { active: true } },
      select: {
        id: true,
        user: { select: { email: true, rollNumber: true } },
        admissionNumber: true,
      },
    });

    // Create maps for O(1) lookup
    const emailToStudentMap = new Map(
      students.map((s) => [s.user?.email?.toLowerCase(), s]),
    );
    const rollNumberToStudentMap = new Map(
      students.filter((s) => s.user?.rollNumber).map((s) => [s.user!.rollNumber!.toLowerCase(), s]),
    );
    const enrollmentToStudentMap = new Map(
      students.filter((s) => s.admissionNumber).map((s) => [s.admissionNumber.toLowerCase(), s]),
    );

    // Track duplicates in the file and collect valid student IDs for batch query
    const studentIdentifiers = new Set<string>();
    const validStudentIds: string[] = [];
    const rowToStudentId = new Map<number, string>();

    // FIRST PASS: Collect all valid student IDs and basic validation
    for (let i = 0; i < internships.length; i++) {
      const internship = internships[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      // Student identification - at least one required
      const hasStudentIdentifier =
        internship.studentEmail ||
        internship.studentRollNumber ||
        internship.enrollmentNumber;

      if (!hasStudentIdentifier) {
        errors.push({
          row: rowNumber,
          field: 'studentEmail',
          error: 'At least one student identifier (Email, Roll Number, or Enrollment Number) is required',
        });
        continue;
      }

      // Find the student
      let student = null;
      let identifier = '';

      if (internship.studentEmail) {
        student = emailToStudentMap.get(internship.studentEmail.toLowerCase());
        identifier = internship.studentEmail.toLowerCase();
      }
      if (!student && internship.studentRollNumber) {
        student = rollNumberToStudentMap.get(internship.studentRollNumber.toLowerCase());
        identifier = internship.studentRollNumber.toLowerCase();
      }
      if (!student && internship.enrollmentNumber) {
        student = enrollmentToStudentMap.get(internship.enrollmentNumber.toLowerCase());
        identifier = internship.enrollmentNumber.toLowerCase();
      }

      if (!student) {
        errors.push({
          row: rowNumber,
          field: 'studentEmail',
          value: internship.studentEmail || internship.studentRollNumber || internship.enrollmentNumber,
          error: 'Student not found in the system',
        });
        continue;
      }

      // Check for duplicate students in file
      if (studentIdentifiers.has(identifier)) {
        errors.push({
          row: rowNumber,
          field: 'studentEmail',
          value: identifier,
          error: 'Duplicate student entry in file',
        });
        continue;
      }
      studentIdentifiers.add(identifier);

      // Track valid student for batch query
      validStudentIds.push(student.id);
      rowToStudentId.set(rowNumber, student.id);

      // Required: Company name
      if (!internship.companyName || internship.companyName.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'companyName',
          error: 'Company name is required',
        });
      }

      // Validate email formats
      if (internship.companyEmail && !this.isValidEmail(internship.companyEmail)) {
        errors.push({
          row: rowNumber,
          field: 'companyEmail',
          value: internship.companyEmail,
          error: 'Invalid company email format',
        });
      }

      if (internship.hrEmail && !this.isValidEmail(internship.hrEmail)) {
        errors.push({
          row: rowNumber,
          field: 'hrEmail',
          value: internship.hrEmail,
          error: 'Invalid HR email format',
        });
      }

      if (internship.facultyMentorEmail && !this.isValidEmail(internship.facultyMentorEmail)) {
        errors.push({
          row: rowNumber,
          field: 'facultyMentorEmail',
          value: internship.facultyMentorEmail,
          error: 'Invalid faculty mentor email format',
        });
      }

      // Validate date format if provided
      if (internship.startDate && !this.isValidDate(internship.startDate)) {
        warnings.push({
          row: rowNumber,
          field: 'startDate',
          message: `Invalid date format: ${internship.startDate}. Expected format: YYYY-MM-DD`,
        });
      }

      if (internship.endDate && !this.isValidDate(internship.endDate)) {
        warnings.push({
          row: rowNumber,
          field: 'endDate',
          message: `Invalid date format: ${internship.endDate}. Expected format: YYYY-MM-DD`,
        });
      }
    }

    // BATCH QUERY: Check for existing active self-identified internships for all valid students at once (active applications only)
    if (validStudentIds.length > 0) {
      const existingApplications = await this.prisma.internshipApplication.findMany({
        where: {
          studentId: { in: validStudentIds },
          isSelfIdentified: true,
          isActive: true,
          status: {
            in: [ApplicationStatus.APPLIED, ApplicationStatus.APPROVED, ApplicationStatus.JOINED],
          },
        },
        select: {
          studentId: true,
        },
      });

      // Create a Set for O(1) lookup of students with existing applications
      const studentsWithExistingInternships = new Set(
        existingApplications.map((app) => app.studentId),
      );

      // Add warnings for students with existing internships
      for (const [rowNumber, studentId] of rowToStudentId) {
        if (studentsWithExistingInternships.has(studentId)) {
          warnings.push({
            row: rowNumber,
            field: 'studentEmail',
            message: `Student already has an active self-identified internship. New record will be created.`,
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map((e) => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: internships.length,
      validRows: internships.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
      warnings,
    };
  }

  /**
   * Bulk upload self-identified internships
   * Supports partial success - valid records are created, invalid ones are skipped
   */
  async bulkUploadInternships(
    internships: BulkSelfInternshipRowDto[],
    institutionId: string,
    createdBy: string,
    performedByUserId?: string,
  ): Promise<BulkSelfInternshipResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // Audit: Bulk self-identified internship upload initiated
    this.auditService.log({
      action: AuditAction.DATA_IMPORT,
      entityType: 'BulkSelfInternshipUpload',
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId,
      description: `Bulk self-internship upload started: ${internships.length} internships`,
      newValues: {
        operation: 'bulk_self_internship_upload_started',
        totalInternships: internships.length,
        createdBy,
      },
    }).catch(() => {});

    // Fetch all ACTIVE students with ACTIVE users for processing
    const students = await this.prisma.student.findMany({
      where: { institutionId, user: { active: true } },
      select: {
        id: true,
        user: { select: { email: true, rollNumber: true } },
        admissionNumber: true,
      },
    });

    const emailToStudentMap = new Map(
      students.map((s) => [s.user?.email?.toLowerCase(), s]),
    );
    const rollNumberToStudentMap = new Map(
      students.filter((s) => s.user?.rollNumber).map((s) => [s.user!.rollNumber!.toLowerCase(), s]),
    );
    const enrollmentToStudentMap = new Map(
      students.filter((s) => s.admissionNumber).map((s) => [s.admissionNumber.toLowerCase(), s]),
    );

    // Track processed student identifiers to detect duplicates within file
    const processedIdentifiers = new Set<string>();

    // Process internships one by one for partial success
    for (let i = 0; i < internships.length; i++) {
      const internship = internships[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      // Per-row validation
      const rowErrors: string[] = [];

      // Student identification - at least one required
      const hasStudentIdentifier =
        internship.studentEmail ||
        internship.studentRollNumber ||
        internship.enrollmentNumber;

      if (!hasStudentIdentifier) {
        rowErrors.push('At least one student identifier (Email, Roll Number, or Enrollment Number) is required');
      }

      // Company name is required
      if (!internship.companyName?.trim()) {
        rowErrors.push('Company name is required');
      }

      // Find student
      let student = null;
      let identifier = '';

      if (internship.studentEmail) {
        student = emailToStudentMap.get(internship.studentEmail.toLowerCase());
        identifier = internship.studentEmail.toLowerCase();
      }
      if (!student && internship.studentRollNumber) {
        student = rollNumberToStudentMap.get(internship.studentRollNumber.toLowerCase());
        identifier = internship.studentRollNumber.toLowerCase();
      }
      if (!student && internship.enrollmentNumber) {
        student = enrollmentToStudentMap.get(internship.enrollmentNumber.toLowerCase());
        identifier = internship.enrollmentNumber.toLowerCase();
      }

      if (hasStudentIdentifier && !student) {
        rowErrors.push('Student not found in the system');
      }

      // Check for duplicate within file
      if (identifier && processedIdentifiers.has(identifier)) {
        rowErrors.push('Duplicate student entry in file');
      }

      // Validate email formats if provided
      if (internship.companyEmail && !this.isValidEmail(internship.companyEmail)) {
        rowErrors.push('Invalid company email format');
      }
      if (internship.hrEmail && !this.isValidEmail(internship.hrEmail)) {
        rowErrors.push('Invalid HR email format');
      }
      if (internship.facultyMentorEmail && !this.isValidEmail(internship.facultyMentorEmail)) {
        rowErrors.push('Invalid faculty mentor email format');
      }

      // If validation failed, add to failed records
      if (rowErrors.length > 0) {
        failedRecords.push({
          row: rowNumber,
          studentEmail: internship.studentEmail || internship.studentRollNumber || internship.enrollmentNumber,
          companyName: internship.companyName,
          error: rowErrors.join('; '),
        });
        continue;
      }

      // Mark identifier as processed
      if (identifier) processedIdentifiers.add(identifier);

      // Try to create the internship record
      try {
        const now = new Date();

        // Robustness: avoid creating duplicate approved active self-identified internships
        // for a student (these are auto-approved in the new workflow).
        const existingApprovedSelfIdentified = await this.prisma.internshipApplication.findFirst({
          where: {
            studentId: student.id,
            isActive: true,
            isSelfIdentified: true,
            status: ApplicationStatus.APPROVED,
            internshipPhase: { in: [InternshipPhase.NOT_STARTED, InternshipPhase.ACTIVE] },
          },
          select: { id: true },
        });

        if (existingApprovedSelfIdentified) {
          failedRecords.push({
            row: rowNumber,
            studentEmail: internship.studentEmail || internship.studentRollNumber || internship.enrollmentNumber,
            companyName: internship.companyName,
            error: 'Student already has an approved self-identified internship',
          });
          continue;
        }

        await this.prisma.internshipApplication.create({
          data: {
            studentId: student.id,
            isSelfIdentified: true,
            // Self-identified internships are auto-approved
            status: ApplicationStatus.APPROVED,
            internshipPhase: internship.joiningLetterUrl
              ? InternshipPhase.ACTIVE
              : internship.startDate
                ? InternshipPhase.ACTIVE
                : InternshipPhase.NOT_STARTED,

            // Mark as reviewed/approved at import time
            reviewedAt: now,
            isActive: true,

            // Company information
            companyName: internship.companyName,
            companyAddress: internship.companyAddress || null,
            companyContact: internship.companyContact || null,
            companyEmail: internship.companyEmail || null,

            // HR information
            hrName: internship.hrName || null,
            hrDesignation: internship.hrDesignation || null,
            hrContact: internship.hrContact || null,
            hrEmail: internship.hrEmail || null,

            // Internship details
            jobProfile: internship.jobProfile || null,
            stipend: internship.stipend || null,
            startDate: internship.startDate ? new Date(internship.startDate) : null,
            endDate: internship.endDate ? new Date(internship.endDate) : null,
            internshipDuration: internship.duration || null,

            // Faculty mentor
            facultyMentorName: internship.facultyMentorName || null,
            facultyMentorEmail: internship.facultyMentorEmail || null,
            facultyMentorContact: internship.facultyMentorContact || null,
            facultyMentorDesignation: internship.facultyMentorDesignation || null,

            // Joining letter - auto-approve joining when letter is provided
            joiningLetterUrl: internship.joiningLetterUrl || null,
            joiningLetterUploadedAt: internship.joiningLetterUrl ? now : null,
            joiningDate: internship.joiningLetterUrl ? now : null,

            applicationDate: now,
            appliedDate: now,
          },
        });

        successRecords.push({
          row: rowNumber,
          studentEmail: internship.studentEmail || internship.studentRollNumber || internship.enrollmentNumber,
          companyName: internship.companyName,
        });

        this.logger.log(`Internship created: ${internship.companyName} for ${identifier} (Row ${rowNumber})`);
      } catch (error) {
        failedRecords.push({
          row: rowNumber,
          studentEmail: internship.studentEmail || internship.studentRollNumber || internship.enrollmentNumber,
          companyName: internship.companyName,
          error: error.message,
        });

        this.logger.error(`Failed to create internship: ${internship.companyName} (Row ${rowNumber})`, error.stack);
      }
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk self-internship upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    // Audit: Bulk self-identified internship upload completed
    this.auditService.log({
      action: AuditAction.DATA_IMPORT,
      entityType: 'BulkSelfInternshipUpload',
      category: AuditCategory.INTERNSHIP_WORKFLOW,
      severity: failedRecords.length > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
      userId: performedByUserId,
      institutionId,
      description: `Bulk self-internship upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_self_internship_upload_completed',
        totalInternships: internships.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
        createdBy,
        successfulCompanies: successRecords.map(r => r.companyName).filter(Boolean).slice(0, 10),
        failedStudentEmails: failedRecords.map(r => r.studentEmail).filter(Boolean),
      },
    }).catch(() => {});

    return {
      total: internships.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Get template for bulk upload
   */
  async getTemplate(): Promise<Buffer> {
    const templateData = [
      {
        'Student Email': 'student1@example.com',
        'Roll Number': 'R2023001',
        'Enrollment Number': 'EN2023001',
        'Company Name': 'Tech Corp Pvt Ltd',
        'Company Address': '123 Tech Park, City',
        'Company Contact': '9876543210',
        'Company Email': 'hr@techcorp.com',
        'HR Name': 'John Smith',
        'HR Designation': 'HR Manager',
        'HR Contact': '9876543211',
        'HR Email': 'john.smith@techcorp.com',
        'Job Profile': 'Software Developer Intern',
        'Stipend': '15000',
        'Start Date': '2024-01-15',
        'End Date': '2024-07-15',
        'Duration': '6 months',
        'Faculty Mentor Name': 'Dr. Jane Doe',
        'Faculty Mentor Email': 'jane.doe@college.edu',
        'Faculty Mentor Contact': '9876543212',
        'Faculty Mentor Designation': 'Assistant Professor',
        'Joining Letter URL': '',
      },
      {
        'Student Email': 'student2@example.com',
        'Roll Number': 'R2023002',
        'Enrollment Number': 'EN2023002',
        'Company Name': 'Innovation Labs',
        'Company Address': '456 Innovation Hub',
        'Company Contact': '9876543220',
        'Company Email': 'contact@innovationlabs.com',
        'HR Name': 'Sarah Johnson',
        'HR Designation': 'Talent Acquisition',
        'HR Contact': '9876543221',
        'HR Email': 'sarah@innovationlabs.com',
        'Job Profile': 'Data Science Intern',
        'Stipend': '20000',
        'Start Date': '2024-02-01',
        'End Date': '2024-08-01',
        'Duration': '6 months',
        'Faculty Mentor Name': 'Prof. Robert Wilson',
        'Faculty Mentor Email': 'robert.wilson@college.edu',
        'Faculty Mentor Contact': '9876543222',
        'Faculty Mentor Designation': 'Professor',
        'Joining Letter URL': '',
      },
    ];

    const instructionsData = [
      { Field: 'Student Email', Required: 'Yes*', Description: 'Student email address (at least one identifier required)', Example: 'student@example.com' },
      { Field: 'Roll Number', Required: 'Yes*', Description: 'Student roll number (alternative identifier)', Example: 'R2023001' },
      { Field: 'Enrollment Number', Required: 'Yes*', Description: 'Student enrollment/admission number (alternative identifier)', Example: 'EN2023001' },
      { Field: 'Company Name', Required: 'Yes', Description: 'Name of the company/organization', Example: 'Tech Corp Pvt Ltd' },
      { Field: 'Company Address', Required: 'No', Description: 'Full address of the company', Example: '123 Tech Park, City' },
      { Field: 'Company Contact', Required: 'No', Description: 'Company phone number', Example: '9876543210' },
      { Field: 'Company Email', Required: 'No', Description: 'Company email address', Example: 'hr@company.com' },
      { Field: 'HR Name', Required: 'No', Description: 'Name of HR/Contact person', Example: 'John Smith' },
      { Field: 'HR Designation', Required: 'No', Description: 'Designation of HR person', Example: 'HR Manager' },
      { Field: 'HR Contact', Required: 'No', Description: 'HR phone number', Example: '9876543211' },
      { Field: 'HR Email', Required: 'No', Description: 'HR email address', Example: 'hr@company.com' },
      { Field: 'Job Profile', Required: 'No', Description: 'Internship role/position', Example: 'Software Developer Intern' },
      { Field: 'Stipend', Required: 'No', Description: 'Monthly stipend amount', Example: '15000' },
      { Field: 'Start Date', Required: 'No', Description: 'Internship start date (YYYY-MM-DD)', Example: '2024-01-15' },
      { Field: 'End Date', Required: 'No', Description: 'Internship end date (YYYY-MM-DD)', Example: '2024-07-15' },
      { Field: 'Duration', Required: 'No', Description: 'Duration of internship', Example: '6 months' },
      { Field: 'Faculty Mentor Name', Required: 'No', Description: 'Assigned faculty mentor name', Example: 'Dr. Jane Doe' },
      { Field: 'Faculty Mentor Email', Required: 'No', Description: 'Faculty mentor email', Example: 'jane@college.edu' },
      { Field: 'Faculty Mentor Contact', Required: 'No', Description: 'Faculty mentor phone', Example: '9876543212' },
      { Field: 'Faculty Mentor Designation', Required: 'No', Description: 'Faculty mentor designation', Example: 'Assistant Professor' },
      { Field: 'Joining Letter URL', Required: 'No', Description: 'URL to uploaded joining letter', Example: 'https://...' },
      { Field: '', Required: '', Description: '', Example: '' },
      { Field: 'Notes:', Required: '', Description: '* At least one student identifier (Email, Roll Number, or Enrollment Number) is required', Example: '' },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Self-Identified Internships', data: templateData },
      { name: 'Instructions', data: instructionsData },
    ]);
  }

  // Helper methods
  private cleanString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return String(value).trim();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }
}
