/**
 * Report Definition Interfaces
 * Defines the structure for report configurations
 */

export interface ReportColumn {
  id: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  default: boolean;
  sortable?: boolean;
  width?: number;
  format?: string;
  description?: string;
}

export interface ReportFilterOption {
  label: string;
  value: string | number | boolean;
}

export interface ReportFilter {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'dateRange' | 'boolean';
  required: boolean;
  dynamic?: boolean;
  options?: ReportFilterOption[];
  defaultValue?: unknown;
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ReportDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  availableFor: string[];
  columns: ReportColumn[];
  filters: ReportFilter[];
  groupBy?: string[];
  sortableColumns?: string[];
  exportFormats: ('excel' | 'csv' | 'pdf' | 'json')[];
}

export interface ReportCatalogCategory {
  key: string;
  label: string;
  icon: string;
  reports: string[];
}

export interface ReportGenerationConfig {
  type: string;
  columns: string[];
  filters: Record<string, unknown>;
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  format: 'excel' | 'csv' | 'pdf' | 'json';
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: string;
  configuration: ReportGenerationConfig;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReportResult {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  fileUrl?: string;
  totalRecords?: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}
