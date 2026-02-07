import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../generated/prisma/client';
import { BulkInstitutionRowDto, BulkInstitutionResultDto, BulkInstitutionValidationResultDto } from './dto/bulk-institution.dto';
import { InstitutionService, CreateInstitutionData, CreatePrincipalData } from '../../domain/institution/institution.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { ExcelUtils } from '../../core/common/utils/excel.util';

@Injectable()
export class BulkInstitutionService {
  private readonly logger = new Logger(BulkInstitutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly institutionService: InstitutionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Parse CSV/Excel file and extract institution data
   */
  async parseFile(buffer: Buffer, filename: string): Promise<BulkInstitutionRowDto[]> {
    try {
      const { workbook } = await ExcelUtils.read(buffer);

      // Convert to JSON
      const rawData = ExcelUtils.sheetToJson<Record<string, any>>(workbook, 0, { defval: '' });

      // Map CSV columns to DTO fields
      const institutions: BulkInstitutionRowDto[] = rawData.map((row: any) => ({
        name: this.cleanString(row['Name'] || row['name'] || row['Institution Name']),
        code: this.cleanString(row['Code'] || row['code'] || row['Institution Code']),
        type: this.cleanString(row['Type'] || row['type']),
        email: this.cleanString(row['Email'] || row['email'])?.toLowerCase(),
        phone: this.cleanString(row['Phone'] || row['phone'] || row['Contact']),
        address: this.cleanString(row['Address'] || row['address']),
        city: this.cleanString(row['City'] || row['city']),
        state: this.cleanString(row['State'] || row['state']),
        pinCode: this.cleanString(row['Pin Code'] || row['pinCode'] || row['Pincode']),
        website: this.cleanString(row['Website'] || row['website']),
        principalName: this.cleanString(row['Principal Name'] || row['principalName']),
        principalEmail: this.cleanString(row['Principal Email'] || row['principalEmail'])?.toLowerCase(),
        principalPhone: this.cleanString(row['Principal Phone'] || row['principalPhone']),
      }));

      return institutions;
    } catch (error) {
      this.logger.error(`Error parsing file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  /**
   * Validate institution data before processing
   */
  async validateInstitutions(institutions: BulkInstitutionRowDto[]): Promise<BulkInstitutionValidationResultDto> {
    const errors: Array<{ row: number; field?: string; value?: string; error: string }> = [];

    // OPTIMIZATION: Extract all codes and emails for batch queries
    const allCodes = institutions
      .map((i) => i.code)
      .filter((code): code is string => !!code);
    const allPrincipalEmails = institutions
      .map((i) => i.principalEmail?.toLowerCase())
      .filter((email): email is string => !!email);

    // Use domain service for existing checks (batch queries)
    const [existingCodeSet, existingEmailSet] = await Promise.all([
      this.institutionService.findExistingCodes(allCodes),
      this.institutionService.findExistingEmails(allPrincipalEmails),
    ]);

    // O(n) duplicate detection using Maps
    const codeFirstOccurrence = new Map<string, number>();

    for (let i = 0; i < institutions.length; i++) {
      const institution = institutions[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required field validation
      if (!institution.name || institution.name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          value: institution.name,
          error: 'Institution name is required',
        });
      }

      if (!institution.code || institution.code.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'code',
          value: institution.code,
          error: 'Institution code is required',
        });
      }

      if (!institution.email || institution.email.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: institution.email,
          error: 'Email is required',
        });
      } else if (!this.isValidEmail(institution.email)) {
        errors.push({
          row: rowNumber,
          field: 'email',
          value: institution.email,
          error: 'Invalid email format',
        });
      }

      // Optional principal email validation
      if (institution.principalEmail && !this.isValidEmail(institution.principalEmail)) {
        errors.push({
          row: rowNumber,
          field: 'principalEmail',
          value: institution.principalEmail,
          error: 'Invalid principal email format',
        });
      }

      // Check for duplicate code in the file using O(n) approach with Map
      if (institution.code) {
        const codeLower = institution.code.toLowerCase();
        const firstRow = codeFirstOccurrence.get(codeLower);
        if (firstRow !== undefined) {
          errors.push({
            row: rowNumber,
            field: 'code',
            value: institution.code,
            error: `Duplicate institution code in file (also found in row ${firstRow})`,
          });
        } else {
          codeFirstOccurrence.set(codeLower, rowNumber);
        }

        // O(1) check against pre-fetched existing codes
        if (existingCodeSet.has(codeLower)) {
          errors.push({
            row: rowNumber,
            field: 'code',
            value: institution.code,
            error: 'Institution code already exists in the system',
          });
        }
      }

      // Check if principal email already exists
      if (institution.principalEmail) {
        const emailLower = institution.principalEmail.toLowerCase();
        // O(1) check against pre-fetched existing emails
        if (existingEmailSet.has(emailLower)) {
          errors.push({
            row: rowNumber,
            field: 'principalEmail',
            value: institution.principalEmail,
            error: 'Principal email already exists in the system',
          });
        }
      }
    }

    const uniqueErrorRows = new Set(errors.map(e => e.row)).size;

    return {
      isValid: errors.length === 0,
      totalRows: institutions.length,
      validRows: institutions.length - uniqueErrorRows,
      invalidRows: uniqueErrorRows,
      errors,
    };
  }

  /**
   * Bulk upload institutions with batch processing
   */
  async bulkUploadInstitutions(
    institutions: BulkInstitutionRowDto[],
    createdBy: string,
    performedByUserId?: string,
  ): Promise<BulkInstitutionResultDto> {
    const startTime = Date.now();
    const successRecords: any[] = [];
    const failedRecords: any[] = [];

    // Audit: Bulk institution upload initiated
    this.auditService.log({
      action: AuditAction.DATA_IMPORT,
      entityType: 'BulkInstitutionUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: AuditSeverity.HIGH,
      userId: performedByUserId,
      description: `Bulk institution upload started: ${institutions.length} institutions`,
      newValues: {
        operation: 'bulk_institution_upload_started',
        totalInstitutions: institutions.length,
        createdBy,
      },
    }).catch(() => {});

    // First, validate all institutions
    const validation = await this.validateInstitutions(institutions);

    if (!validation.isValid) {
      // If there are validation errors, return them without processing
      const processingTime = Date.now() - startTime;
      return {
        total: institutions.length,
        success: 0,
        failed: institutions.length,
        successRecords: [],
        failedRecords: validation.errors.map(err => ({
          row: err.row,
          name: institutions[err.row - 2]?.name,
          code: institutions[err.row - 2]?.code,
          error: err.error,
          details: err.field ? `Field: ${err.field}, Value: ${err.value}` : undefined,
        })),
        processingTime,
      };
    }

    // Process institutions in batches
    const batchSize = 5;
    for (let i = 0; i < institutions.length; i += batchSize) {
      const batch = institutions.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (institution, batchIndex) => {
          const rowNumber = i + batchIndex + 2;
          try {
            const result = await this.createInstitution(institution);

            successRecords.push({
              row: rowNumber,
              name: institution.name,
              code: institution.code,
              institutionId: result.institution.id,
              principalCreated: !!result.principal,
              principalUserId: result.principal?.id,
            });

            this.logger.log(`Institution created: ${institution.code} (Row ${rowNumber})`);
          } catch (error) {
            failedRecords.push({
              row: rowNumber,
              name: institution.name,
              code: institution.code,
              error: error.message,
              details: error.stack?.split('\n')[0],
            });

            this.logger.error(`Failed to create institution: ${institution.code} (Row ${rowNumber})`, error.stack);
          }
        }),
      );
    }

    const processingTime = Date.now() - startTime;

    this.logger.log(
      `Bulk upload completed: ${successRecords.length} success, ${failedRecords.length} failed in ${processingTime}ms`,
    );

    // Audit: Bulk institution upload completed
    this.auditService.log({
      action: AuditAction.DATA_IMPORT,
      entityType: 'BulkInstitutionUpload',
      category: AuditCategory.ADMINISTRATIVE,
      severity: failedRecords.length > 0 ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      userId: performedByUserId,
      description: `Bulk institution upload completed: ${successRecords.length} success, ${failedRecords.length} failed`,
      newValues: {
        operation: 'bulk_institution_upload_completed',
        totalInstitutions: institutions.length,
        successCount: successRecords.length,
        failedCount: failedRecords.length,
        processingTimeMs: processingTime,
        createdBy,
        createdCodes: successRecords.map(r => r.code).filter(Boolean),
        failedCodes: failedRecords.map(r => r.code).filter(Boolean),
      },
    }).catch(() => {});

    return {
      total: institutions.length,
      success: successRecords.length,
      failed: failedRecords.length,
      successRecords,
      failedRecords,
      processingTime,
    };
  }

  /**
   * Create a single institution and optionally create principal user
   * Delegates to domain InstitutionService
   */
  private async createInstitution(institutionDto: BulkInstitutionRowDto) {
    // Map DTO to domain CreateInstitutionData
    const institutionData: CreateInstitutionData = {
      name: institutionDto.name,
      code: institutionDto.code,
      type: this.institutionService.mapInstitutionType(institutionDto.type),
      email: institutionDto.email,
      phone: institutionDto.phone,
      address: institutionDto.address,
      city: institutionDto.city,
      state: institutionDto.state,
      pinCode: institutionDto.pinCode,
      website: institutionDto.website,
    };

    // Map principal data if provided
    let principalData: CreatePrincipalData | undefined;
    if (institutionDto.principalName && institutionDto.principalEmail) {
      principalData = {
        name: institutionDto.principalName,
        email: institutionDto.principalEmail,
        phone: institutionDto.principalPhone,
      };
    }

    // Delegate to domain service (skip validation since bulk already validated)
    return this.institutionService.createInstitution(
      institutionData,
      principalData,
      { skipValidation: true },
    );
  }

  /**
   * Download template for bulk institution upload
   */
  async getTemplate(): Promise<Buffer> {
    const templateData = [
      {
        'Name': 'ABC Engineering College',
        'Code': 'ABC001',
        'Type': 'ENGINEERING_COLLEGE',
        'Email': 'contact@abcengineering.edu',
        'Phone': '0121-2345678',
        'Address': '123 College Road',
        'City': 'Bangalore',
        'State': 'Karnataka',
        'Pin Code': '560001',
        'Website': 'https://www.abcengineering.edu',
        'Principal Name': 'Dr. John Smith',
        'Principal Email': 'principal@abcengineering.edu',
        'Principal Phone': '9876543210',
      },
      {
        'Name': 'XYZ Polytechnic',
        'Code': 'XYZ001',
        'Type': 'POLYTECHNIC',
        'Email': 'contact@xyzpolytechnic.edu',
        'Phone': '0121-9876543',
        'Address': '456 Tech Street',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Pin Code': '400001',
        'Website': 'https://www.xyzpolytechnic.edu',
        'Principal Name': 'Dr. Jane Doe',
        'Principal Email': 'principal@xyzpolytechnic.edu',
        'Principal Phone': '9876543211',
      },
    ];

    const instructionsData = [
      { Field: 'Name', Required: 'Yes', Description: 'Full name of the institution', Example: 'ABC Engineering College' },
      { Field: 'Code', Required: 'Yes', Description: 'Unique institution code', Example: 'ABC001' },
      { Field: 'Type', Required: 'No', Description: 'Institution type: POLYTECHNIC, ENGINEERING_COLLEGE, UNIVERSITY, DEGREE_COLLEGE, ITI, SKILL_CENTER', Example: 'ENGINEERING_COLLEGE' },
      { Field: 'Email', Required: 'Yes', Description: 'Institution contact email', Example: 'contact@abc.edu' },
      { Field: 'Phone', Required: 'No', Description: 'Institution contact phone', Example: '0121-2345678' },
      { Field: 'Address', Required: 'No', Description: 'Institution address', Example: '123 College Road' },
      { Field: 'City', Required: 'No', Description: 'City name', Example: 'Bangalore' },
      { Field: 'State', Required: 'No', Description: 'State name', Example: 'Karnataka' },
      { Field: 'Pin Code', Required: 'No', Description: 'Postal pin code', Example: '560001' },
      { Field: 'Website', Required: 'No', Description: 'Institution website URL', Example: 'https://www.abc.edu' },
      { Field: 'Principal Name', Required: 'No', Description: 'Principal full name (will create principal user)', Example: 'Dr. John Smith' },
      { Field: 'Principal Email', Required: 'No', Description: 'Principal email (required if creating principal)', Example: 'principal@abc.edu' },
      { Field: 'Principal Phone', Required: 'No', Description: 'Principal contact number', Example: '9876543210' },
    ];

    return ExcelUtils.createFromJson([
      { name: 'Institutions', data: templateData },
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
