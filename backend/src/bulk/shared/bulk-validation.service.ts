import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export interface ValidationError {
  row: number;
  field?: string;
  value?: string;
  error: string;
}

export interface ValidationWarning {
  row: number;
  field?: string;
  message: string;
}

@Injectable()
export class BulkValidationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format (Indian format)
   */
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/[\s-]/g, ''));
  }

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Check if email exists in database
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  /**
   * Check if enrollment number exists
   */
  async enrollmentExists(enrollmentNumber: string): Promise<boolean> {
    const student = await this.prisma.student.findFirst({
      where: { admissionNumber: enrollmentNumber },
    });
    return !!student;
  }

  /**
   * Check if institution code exists
   */
  async institutionCodeExists(code: string): Promise<boolean> {
    const institution = await this.prisma.institution.findUnique({
      where: { code },
    });
    return !!institution;
  }

  /**
   * Get batch by name and institution
   */
  async getBatchByName(batchName: string, institutionId: string): Promise<any> {
    return this.prisma.batch.findFirst({
      where: {
        name: batchName,
        institutionId,
      },
    });
  }

  /**
   * Get branch by name
   */
  async getBranchByName(branchName: string): Promise<any> {
    return this.prisma.branch.findFirst({
      where: {
        name: {
          equals: branchName,
          mode: 'insensitive',
        },
      },
    });
  }

  /**
   * Validate required field
   */
  validateRequired(value: any, fieldName: string, row: number): ValidationError | null {
    if (value === null || value === undefined || String(value).trim() === '') {
      return {
        row,
        field: fieldName,
        value: String(value),
        error: `${fieldName} is required`,
      };
    }
    return null;
  }

  /**
   * Validate enum value
   */
  validateEnum(value: string, allowedValues: string[], fieldName: string, row: number): ValidationError | null {
    if (value && !allowedValues.includes(value)) {
      return {
        row,
        field: fieldName,
        value,
        error: `Invalid ${fieldName}. Must be one of: ${allowedValues.join(', ')}`,
      };
    }
    return null;
  }

  /**
   * Validate number range
   */
  validateRange(
    value: number,
    min: number,
    max: number,
    fieldName: string,
    row: number,
  ): ValidationError | null {
    if (value !== undefined && value !== null && (value < min || value > max)) {
      return {
        row,
        field: fieldName,
        value: String(value),
        error: `${fieldName} must be between ${min} and ${max}`,
      };
    }
    return null;
  }

  /**
   * Find duplicate values in array
   */
  findDuplicates<T>(
    array: T[],
    keyExtractor: (item: T) => any,
  ): Map<any, number[]> {
    const seen = new Map<any, number[]>();

    array.forEach((item, index) => {
      const key = keyExtractor(item);
      if (key !== undefined && key !== null && key !== '') {
        const indices = seen.get(key) || [];
        indices.push(index);
        seen.set(key, indices);
      }
    });

    // Filter to only duplicates
    const duplicates = new Map<any, number[]>();
    seen.forEach((indices, key) => {
      if (indices.length > 1) {
        duplicates.set(key, indices);
      }
    });

    return duplicates;
  }

  /**
   * Clean and trim string value
   */
  cleanString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    const cleaned = String(value).trim();
    return cleaned === '' ? undefined : cleaned;
  }

  /**
   * Parse number from string
   */
  parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Batch validate emails against database
   */
  async batchValidateEmails(emails: string[]): Promise<Map<string, boolean>> {
    const uniqueEmails = [...new Set(emails.filter(e => e))];

    const existingUsers = await this.prisma.user.findMany({
      where: {
        email: {
          in: uniqueEmails,
        },
      },
      select: {
        email: true,
      },
    });

    const existingEmailSet = new Set(existingUsers.map(u => u.email));
    const result = new Map<string, boolean>();

    uniqueEmails.forEach(email => {
      result.set(email, existingEmailSet.has(email));
    });

    return result;
  }

  /**
   * Batch validate enrollment numbers against database
   */
  async batchValidateEnrollments(enrollments: string[]): Promise<Map<string, boolean>> {
    const uniqueEnrollments = [...new Set(enrollments.filter(e => e))];

    const existingStudents = await this.prisma.student.findMany({
      where: {
        admissionNumber: {
          in: uniqueEnrollments,
        },
      },
      select: {
        admissionNumber: true,
      },
    });

    const existingEnrollmentSet = new Set(existingStudents.map(s => s.admissionNumber));
    const result = new Map<string, boolean>();

    uniqueEnrollments.forEach(enrollment => {
      result.set(enrollment, existingEnrollmentSet.has(enrollment));
    });

    return result;
  }
}
