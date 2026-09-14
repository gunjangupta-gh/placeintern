export interface BulkInternshipReportRowDto {
  studentId?: string;
  rollNumber?: string;
  enrollmentStatus?: string;
  companyName?: string;
  organizationWebsite?: string;
  modeOfInternship?: string;
  industrySector?: string;
  isWorkInPunjab?: string;
  workDistrict?: string;
  workState?: string;
  hrName?: string;
  hrPhoneNumber?: string;
  isStipendOffered?: string;
  stipendAmountPerMonth?: string;
  isOfferLetterReceived?: string;
  offerLetterUrl?: string;
  facultyMentorEmail?: string;
}

export interface BulkInternshipReportRowError {
  row: number;
  student?: string;
  field?: string;
  error: string;
}

export interface BulkInternshipReportRowWarning {
  row: number;
  student?: string;
  field?: string;
  message: string;
}

export interface BulkInternshipReportValidationResultDto {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: BulkInternshipReportRowError[];
  warnings: BulkInternshipReportRowWarning[];
}

export interface BulkInternshipReportResultDto {
  total: number;
  success: number;
  failed: number;
  successRecords: Array<{ row: number; student?: string; companyName?: string }>;
  failedRecords: Array<{ row: number; student?: string; companyName?: string; error: string }>;
  processingTime: number;
}
