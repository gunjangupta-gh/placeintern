import { StructuredTool } from '@langchain/core/tools';
import { PrismaService } from '../../../../core/database/prisma.service';

/**
 * Abstract base class for all bot tools.
 * Provides common functionality and ensures consistent tool implementation.
 */
export abstract class BaseTool extends StructuredTool {
  protected readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    super();
    this.prisma = prisma;
  }

  /**
   * Format a number with commas for display (e.g., 1234 -> "1,234")
   */
  protected formatNumber(num: number): string {
    return num.toLocaleString('en-IN');
  }

  /**
   * Get the current month name (e.g., "January", "February")
   */
  protected getCurrentMonth(): string {
    return new Date().toLocaleString('default', { month: 'long' });
  }

  /**
   * Get the current month number (1-12)
   */
  protected getCurrentMonthNumber(): number {
    return new Date().getMonth() + 1;
  }

  /**
   * Get the current year (e.g., 2026)
   */
  protected getCurrentYear(): number {
    return new Date().getFullYear();
  }

  /**
   * Get current month and year as an object
   */
  protected getCurrentPeriod(): { month: number; year: number; monthName: string } {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      monthName: now.toLocaleString('default', { month: 'long' }),
    };
  }

  /**
   * Get date range for a specific month/year
   */
  protected getMonthDateRange(month: number, year: number): { start: Date; end: Date } {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  /**
   * Create a successful response JSON string
   */
  protected successResponse(data: Record<string, unknown>): string {
    return JSON.stringify({
      success: true,
      ...data,
    });
  }

  /**
   * Create an error response JSON string
   */
  protected errorResponse(error: string, details?: string): string {
    return JSON.stringify({
      success: false,
      error,
      ...(details && { details }),
    });
  }

  /**
   * Build filter description from applied filters
   */
  protected buildFilterDescription(filters: Record<string, unknown>): string {
    const descriptions: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        descriptions.push(`${key}: ${value}`);
      }
    }

    return descriptions.length > 0 ? descriptions.join(', ') : 'none';
  }

  /**
   * Helper to get institution ID from name (fuzzy match)
   */
  protected async resolveInstitutionId(institutionName: string): Promise<string | null> {
    const institution = await this.prisma.institution.findFirst({
      where: {
        OR: [
          { name: { contains: institutionName, mode: 'insensitive' } },
          { shortName: { contains: institutionName, mode: 'insensitive' } },
          { code: { contains: institutionName, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return institution?.id || null;
  }

  /**
   * Helper to resolve branch ID from branch code
   */
  protected async resolveBranchId(branchCode: string): Promise<string | null> {
    const branch = await this.prisma.branch.findFirst({
      where: {
        OR: [
          { code: { equals: branchCode, mode: 'insensitive' } },
          { shortName: { equals: branchCode, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return branch?.id || null;
  }

  /**
   * Format a successful response (alias for successResponse)
   */
  protected formatSuccess<T>(data: T, filtersApplied?: string): string {
    return JSON.stringify({
      success: true,
      ...data,
      filtersApplied: filtersApplied || 'none',
    });
  }

  /**
   * Format an error response (alias for errorResponse)
   */
  protected formatError(message: string, details?: string): string {
    return this.errorResponse(message, details);
  }

  /**
   * Strategy 5: Tool Response Optimization
   * Create a compact response with only essential data
   * This reduces output tokens by removing redundant fields
   */
  protected compactResponse(data: Record<string, unknown>): string {
    // Remove null/undefined values and empty strings
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined && value !== '') {
        cleaned[key] = value;
      }
    }
    return JSON.stringify(cleaned);
  }

  /**
   * Create a minimal count response (Strategy 5)
   * Only returns the count and essential metadata
   */
  protected countResponse(count: number, filters?: string): string {
    return JSON.stringify({
      count,
      ...(filters && filters !== 'none' && { filters }),
    });
  }

  /**
   * Create a minimal breakdown response (Strategy 5)
   * Optimizes array output for token efficiency
   */
  protected breakdownResponse(
    breakdown: Array<{ name: string; count: number }>,
    total?: number,
  ): string {
    return JSON.stringify({
      total: total ?? breakdown.reduce((sum, item) => sum + item.count, 0),
      breakdown: breakdown.map((item) => ({ n: item.name, c: item.count })),
    });
  }

  /**
   * Get institution filter for Prisma queries
   * Supports partial name matching (case-insensitive)
   */
  protected getInstitutionFilter(institutionName?: string): object | undefined {
    if (!institutionName) return undefined;

    return {
      OR: [
        { name: { contains: institutionName, mode: 'insensitive' } },
        { shortName: { contains: institutionName, mode: 'insensitive' } },
        { code: { contains: institutionName, mode: 'insensitive' } },
      ],
    };
  }

  /**
   * Get current month and year (alias for getCurrentPeriod)
   */
  protected getCurrentMonthYear(): { month: number; year: number } {
    const now = new Date();
    return {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
  }

  /**
   * Get month name from month number (1-12)
   */
  protected getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[month - 1] || 'Unknown';
  }
}
