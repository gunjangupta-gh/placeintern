import { z } from "zod";
import { BaseTool } from "../base.tool";
import { PrismaService } from "../../../../../core/database/prisma.service";
import { VisitType, VisitLogStatus, Prisma } from "../../../../../generated/prisma/client";

/**
 * Schema for visit breakdown tool input
 */
const VisitBreakdownSchema = z.object({
  groupBy: z
    .enum(["type", "institution", "month", "faculty", "status"])
    .describe("Dimension to group visits by"),
  institutionName: z
    .string()
    .optional()
    .describe("Institution name to filter (partial match supported)"),
  visitType: z
    .enum(["PHYSICAL", "VIRTUAL", "TELEPHONIC"])
    .optional()
    .describe("Type of visit to filter by"),
  month: z
    .number()
    .min(1)
    .max(12)
    .optional()
    .describe("Month number (1-12) to filter visits"),
  year: z
    .number()
    .optional()
    .describe("Year to filter visits (e.g., 2026)"),
  status: z
    .enum(["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .optional()
    .describe("Visit status to filter by"),
  limit: z
    .number()
    .min(1)
    .max(50)
    .default(10)
    .optional()
    .describe("Maximum number of groups to return"),
});

type VisitBreakdownInput = z.infer<typeof VisitBreakdownSchema>;

interface BreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

/**
 * Tool for visit breakdowns by various dimensions
 * Use this for queries like:
 * - "Physical vs virtual visits breakdown"
 * - "Visits by institution"
 * - "Monthly visit breakdown"
 * - "Which faculty has most visits?"
 */
export class VisitBreakdownTool extends BaseTool {
  name = "visit_breakdown";
  description = `Get visit counts grouped by different dimensions. Use this tool when user asks:
    - "Breakdown of visits by..."
    - "Physical vs virtual visits..."
    - "Visits by institution..."
    - "Monthly visit breakdown..."
    - "Which faculty/institution has most visits..."
    - "Visit distribution..."
    - "Compare visits by type/status..."`;

  schema = VisitBreakdownSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: VisitBreakdownInput): Promise<string> {
    try {
      const where: Prisma.FacultyVisitLogWhereInput = {
        isDeleted: false,
      };

      // Apply filters
      if (input.institutionName) {
        const institution = await this.prisma.institution.findFirst({
          where: {
            OR: [
              { name: { contains: input.institutionName, mode: "insensitive" } },
              { shortName: { contains: input.institutionName, mode: "insensitive" } },
              { code: { contains: input.institutionName, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        if (!institution) {
          return this.errorResponse(
            `Institution not found`,
            `No institution found matching "${input.institutionName}"`
          );
        }

        where.application = {
          student: {
            institutionId: institution.id,
          },
        };
      }

      if (input.visitType) {
        where.visitType = input.visitType as VisitType;
      }

      if (input.status) {
        where.status = input.status as VisitLogStatus;
      }

      if (input.month || input.year) {
        const currentDate = new Date();
        if (input.month) where.visitMonth = input.month;
        if (input.year) where.visitYear = input.year;
      }

      let breakdown: BreakdownItem[] = [];
      const limit = input.limit ?? 10;

      switch (input.groupBy) {
        case "type":
          breakdown = await this.getBreakdownByType(where);
          break;
        case "institution":
          breakdown = await this.getBreakdownByInstitution(where, limit);
          break;
        case "month":
          breakdown = await this.getBreakdownByMonth(where, input.year);
          break;
        case "faculty":
          breakdown = await this.getBreakdownByFaculty(where, limit);
          break;
        case "status":
          breakdown = await this.getBreakdownByStatus(where);
          break;
        default:
          return this.errorResponse("Invalid groupBy value", `Unknown groupBy: ${input.groupBy}`);
      }

      const totalCount = breakdown.reduce((sum, item) => sum + item.count, 0);

      // Build filter description
      const filtersApplied: Record<string, unknown> = { groupBy: input.groupBy };
      if (input.institutionName) filtersApplied.institution = input.institutionName;
      if (input.visitType) filtersApplied.visitType = input.visitType;
      if (input.status) filtersApplied.status = input.status;
      if (input.month) filtersApplied.month = input.month;
      if (input.year) filtersApplied.year = input.year;

      return this.successResponse({
        groupBy: input.groupBy,
        totalCount,
        formattedTotal: this.formatNumber(totalCount),
        breakdown: breakdown.map((item) => ({
          ...item,
          formattedCount: this.formatNumber(item.count),
          percentageFormatted: `${item.percentage.toFixed(1)}%`,
        })),
        filtersApplied: this.buildFilterDescription(filtersApplied),
        filters: filtersApplied,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse("Failed to get visit breakdown", errorMessage);
    }
  }

  /**
   * Get breakdown by visit type (PHYSICAL, VIRTUAL, TELEPHONIC)
   */
  private async getBreakdownByType(
    where: Prisma.FacultyVisitLogWhereInput
  ): Promise<BreakdownItem[]> {
    const types: VisitType[] = ["PHYSICAL", "VIRTUAL", "TELEPHONIC"];
    const results: BreakdownItem[] = [];
    let total = 0;

    for (const type of types) {
      const count = await this.prisma.facultyVisitLog.count({
        where: { ...where, visitType: type },
      });
      total += count;
      results.push({ label: type, count, percentage: 0 });
    }

    // Calculate percentages
    return results.map((item) => ({
      ...item,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Get breakdown by institution
   */
  private async getBreakdownByInstitution(
    where: Prisma.FacultyVisitLogWhereInput,
    limit: number
  ): Promise<BreakdownItem[]> {
    // Get all visits with institution info
    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
      select: {
        application: {
          select: {
            student: {
              select: {
                Institution: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Group by institution
    const institutionCounts: Map<string, { name: string; count: number }> = new Map();

    for (const visit of visits) {
      const institution = visit.application?.student?.Institution;
      if (institution) {
        const key = institution.id;
        const existing = institutionCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          institutionCounts.set(key, {
            name: institution.shortName || institution.name || "Unknown",
            count: 1,
          });
        }
      }
    }

    // Convert to array and sort
    const results = Array.from(institutionCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const total = results.reduce((sum, item) => sum + item.count, 0);

    return results.map((item) => ({
      label: item.name,
      count: item.count,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Get breakdown by month
   */
  private async getBreakdownByMonth(
    where: Prisma.FacultyVisitLogWhereInput,
    year?: number
  ): Promise<BreakdownItem[]> {
    const currentYear = year ?? new Date().getFullYear();
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const results: BreakdownItem[] = [];
    let total = 0;

    for (let month = 1; month <= 12; month++) {
      const count = await this.prisma.facultyVisitLog.count({
        where: {
          ...where,
          visitMonth: month,
          visitYear: currentYear,
        },
      });
      total += count;
      results.push({
        label: `${monthNames[month - 1]} ${currentYear}`,
        count,
        percentage: 0,
      });
    }

    // Calculate percentages and filter out zero counts
    return results
      .filter((item) => item.count > 0)
      .map((item) => ({
        ...item,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      }));
  }

  /**
   * Get breakdown by faculty
   */
  private async getBreakdownByFaculty(
    where: Prisma.FacultyVisitLogWhereInput,
    limit: number
  ): Promise<BreakdownItem[]> {
    // Get all visits with faculty info
    const visits = await this.prisma.facultyVisitLog.findMany({
      where,
      select: {
        facultyId: true,
        faculty: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by faculty
    const facultyCounts: Map<string, { name: string; count: number }> = new Map();

    for (const visit of visits) {
      if (visit.faculty) {
        const key = visit.faculty.id;
        const existing = facultyCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          facultyCounts.set(key, {
            name: visit.faculty.name || "Unknown Faculty",
            count: 1,
          });
        }
      }
    }

    // Convert to array and sort
    const results = Array.from(facultyCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const total = results.reduce((sum, item) => sum + item.count, 0);

    return results.map((item) => ({
      label: item.name,
      count: item.count,
      percentage: total > 0 ? (item.count / total) * 100 : 0,
    }));
  }

  /**
   * Get breakdown by status
   */
  private async getBreakdownByStatus(
    where: Prisma.FacultyVisitLogWhereInput
  ): Promise<BreakdownItem[]> {
    const statuses: VisitLogStatus[] = [
      "DRAFT",
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ];
    const results: BreakdownItem[] = [];
    let total = 0;

    for (const status of statuses) {
      const count = await this.prisma.facultyVisitLog.count({
        where: { ...where, status },
      });
      total += count;
      results.push({ label: status, count, percentage: 0 });
    }

    // Calculate percentages and filter out zero counts
    return results
      .filter((item) => item.count > 0)
      .map((item) => ({
        ...item,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      }));
  }
}
