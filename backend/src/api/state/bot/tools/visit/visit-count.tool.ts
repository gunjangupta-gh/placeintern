import { z } from "zod";
import { BaseTool } from "../base.tool";
import { PrismaService } from "../../../../../core/database/prisma.service";
import { VisitType, VisitLogStatus, Prisma } from "../../../../../generated/prisma/client";

/**
 * Schema for visit count tool input
 */
const VisitCountSchema = z.object({
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
  facultyId: z
    .string()
    .optional()
    .describe("Faculty ID to filter visits by specific faculty member"),
  facultyName: z
    .string()
    .optional()
    .describe("Faculty name to filter visits (partial match supported)"),
});

type VisitCountInput = z.infer<typeof VisitCountSchema>;

/**
 * Tool to count faculty visits with various filters
 * Use this for queries like:
 * - "How many visits this month?"
 * - "Total faculty visits to Government Polytechnic?"
 * - "Physical visits count?"
 * - "Completed visits in May 2026?"
 */
export class VisitCountTool extends BaseTool {
  name = "visit_count";
  description = `Count faculty visits with optional filters. Use this tool when user asks:
    - "How many visits..."
    - "Total visits..."
    - "Visit count..."
    - "Number of faculty visits..."
    - "How many physical/virtual/telephonic visits..."
    - "Visits this month/year..."
    - "Completed/scheduled visits..."`;

  schema = VisitCountSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: VisitCountInput): Promise<string> {
    try {
      const where: Prisma.FacultyVisitLogWhereInput = {
        isDeleted: false,
      };

      // Build institution filter via application -> student -> user -> institution
      if (input.institutionName) {
        const institution = await this.prisma.institution.findFirst({
          where: {
            OR: [
              { name: { contains: input.institutionName, mode: "insensitive" } },
              { shortName: { contains: input.institutionName, mode: "insensitive" } },
              { code: { contains: input.institutionName, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true },
        });

        if (!institution) {
          return this.errorResponse(
            `Institution not found`,
            `No institution found matching "${input.institutionName}"`
          );
        }

        // Filter visits where the application's student belongs to this institution
        where.application = {
          student: {
            institutionId: institution.id,
          },
        };
      }

      // Filter by visit type
      if (input.visitType) {
        where.visitType = input.visitType as VisitType;
      }

      // Filter by status
      if (input.status) {
        where.status = input.status as VisitLogStatus;
      }

      // Filter by month and year
      if (input.month || input.year) {
        const currentDate = new Date();
        const filterMonth = input.month ?? currentDate.getMonth() + 1;
        const filterYear = input.year ?? currentDate.getFullYear();

        where.visitMonth = filterMonth;
        where.visitYear = filterYear;
      }

      // Filter by faculty ID
      if (input.facultyId) {
        where.facultyId = input.facultyId;
      }

      // Filter by faculty name
      if (input.facultyName) {
        const faculty = await this.prisma.user.findFirst({
          where: {
            name: { contains: input.facultyName, mode: "insensitive" },
            role: { in: ["TEACHER", "PRINCIPAL", "FACULTY_COORDINATOR"] },
          },
          select: { id: true, name: true },
        });

        if (!faculty) {
          return this.errorResponse(
            `Faculty not found`,
            `No faculty found matching "${input.facultyName}"`
          );
        }

        where.facultyId = faculty.id;
      }

      // Execute count query
      const count = await this.prisma.facultyVisitLog.count({ where });

      // Build filter description for response
      const filtersApplied: Record<string, unknown> = {};
      if (input.institutionName) filtersApplied.institution = input.institutionName;
      if (input.visitType) filtersApplied.visitType = input.visitType;
      if (input.status) filtersApplied.status = input.status;
      if (input.month) filtersApplied.month = input.month;
      if (input.year) filtersApplied.year = input.year;
      if (input.facultyId) filtersApplied.facultyId = input.facultyId;
      if (input.facultyName) filtersApplied.facultyName = input.facultyName;

      return this.successResponse({
        count,
        formattedCount: this.formatNumber(count),
        filtersApplied: this.buildFilterDescription(filtersApplied),
        filters: filtersApplied,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse("Failed to count visits", errorMessage);
    }
  }
}
