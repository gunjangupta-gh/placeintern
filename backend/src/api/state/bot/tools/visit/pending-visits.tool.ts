import { z } from "zod";
import { BaseTool } from "../base.tool";
import { PrismaService } from "../../../../../core/database/prisma.service";
import { Prisma } from "../../../../../generated/prisma/client";

/**
 * Schema for pending visits tool input
 */
const PendingVisitsSchema = z.object({
  institutionName: z
    .string()
    .optional()
    .describe("Institution name to filter (partial match supported)"),
  month: z
    .number()
    .min(1)
    .max(12)
    .optional()
    .describe("Month number (1-12) to check pending visits for"),
  year: z
    .number()
    .optional()
    .describe("Year to check pending visits for (e.g., 2026)"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe("Maximum number of pending visits to return"),
  includeOverdueOnly: z
    .boolean()
    .default(false)
    .optional()
    .describe("If true, only return overdue visits (past requiredByDate)"),
});

type PendingVisitsInput = z.infer<typeof PendingVisitsSchema>;

interface PendingVisitItem {
  visitId: string;
  studentName: string;
  studentRollNumber: string | null;
  institutionName: string;
  branchName: string | null;
  companyName: string | null;
  facultyName: string | null;
  visitMonth: number | null;
  visitYear: number | null;
  requiredByDate: Date | null;
  daysOverdue: number;
  status: string;
}

/**
 * Tool for getting pending/overdue faculty visits
 * Use this for queries like:
 * - "Pending visits this month"
 * - "Overdue faculty visits"
 * - "Which visits are due?"
 * - "Pending visits for Government Polytechnic"
 */
export class PendingVisitsTool extends BaseTool {
  name = "pending_visits";
  description = `Get list of pending or overdue faculty visits. Use this tool when user asks:
    - "Pending visits..."
    - "Overdue visits..."
    - "Due visits..."
    - "Which visits are pending..."
    - "Visits that haven't been completed..."
    - "Missing visits..."
    - "Visits due this month..."`;

  schema = PendingVisitsSchema;

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async _call(input: PendingVisitsInput): Promise<string> {
    try {
      const now = new Date();
      const currentMonth = input.month ?? now.getMonth() + 1;
      const currentYear = input.year ?? now.getFullYear();
      const limit = input.limit ?? 20;

      // Build where clause for pending/scheduled visits
      const where: Prisma.FacultyVisitLogWhereInput = {
        isDeleted: false,
        status: { in: ["SCHEDULED", "DRAFT", "IN_PROGRESS"] },
      };

      // Filter by institution if provided
      let institutionId: string | null = null;
      let institutionName: string | null = null;

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

        institutionId = institution.id;
        institutionName = institution.name;

        where.application = {
          student: {
            institutionId: institution.id,
          },
        };
      }

      // Filter by month/year if provided
      if (input.month) {
        where.visitMonth = input.month;
      }
      if (input.year) {
        where.visitYear = input.year;
      }

      // If includeOverdueOnly, only get visits where requiredByDate is past
      if (input.includeOverdueOnly) {
        where.requiredByDate = {
          lt: now,
        };
      }

      // Fetch pending visits
      const pendingVisits = await this.prisma.facultyVisitLog.findMany({
        where,
        take: limit,
        orderBy: [
          { requiredByDate: "asc" },
          { visitMonth: "asc" },
        ],
        select: {
          id: true,
          visitMonth: true,
          visitYear: true,
          status: true,
          requiredByDate: true,
          faculty: {
            select: {
              name: true,
            },
          },
          application: {
            select: {
              companyName: true,
              student: {
                select: {
                  user: {
                    select: {
                      name: true,
                      rollNumber: true,
                      branchName: true,
                    },
                  },
                  Institution: {
                    select: {
                      name: true,
                      shortName: true,
                    },
                  },
                  branch: {
                    select: {
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

      // Transform results
      const pendingList: PendingVisitItem[] = pendingVisits.map((visit) => {
        const student = visit.application?.student;
        const institution = student?.Institution;
        const branch = student?.branch;

        // Calculate days overdue
        let daysOverdue = 0;
        if (visit.requiredByDate && visit.requiredByDate < now) {
          const diffTime = now.getTime() - visit.requiredByDate.getTime();
          daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return {
          visitId: visit.id,
          studentName: student?.user?.name || "Unknown",
          studentRollNumber: student?.user?.rollNumber || null,
          institutionName:
            institution?.shortName || institution?.name || "Unknown Institution",
          branchName:
            branch?.shortName ||
            branch?.name ||
            student?.user?.branchName ||
            null,
          companyName: visit.application?.companyName || null,
          facultyName: visit.faculty?.name || null,
          visitMonth: visit.visitMonth,
          visitYear: visit.visitYear,
          requiredByDate: visit.requiredByDate,
          daysOverdue,
          status: visit.status,
        };
      });

      // Count summary statistics
      const totalPending = pendingList.length;
      const overdueCount = pendingList.filter((v) => v.daysOverdue > 0).length;
      const upcomingCount = totalPending - overdueCount;

      // Group by institution for summary
      const byInstitution: Map<string, number> = new Map();
      for (const visit of pendingList) {
        const inst = visit.institutionName;
        byInstitution.set(inst, (byInstitution.get(inst) || 0) + 1);
      }

      const institutionSummary = Array.from(byInstitution.entries())
        .map(([name, count]) => ({ institution: name, pendingCount: count }))
        .sort((a, b) => b.pendingCount - a.pendingCount)
        .slice(0, 5);

      // Build filter description
      const filtersApplied: Record<string, unknown> = {};
      if (input.institutionName) filtersApplied.institution = input.institutionName;
      if (input.month) filtersApplied.month = input.month;
      if (input.year) filtersApplied.year = input.year;
      if (input.includeOverdueOnly) filtersApplied.overdueOnly = true;

      // Format month/year for display
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const periodDisplay = `${monthNames[currentMonth - 1]} ${currentYear}`;

      return this.successResponse({
        period: periodDisplay,
        totalPending,
        formattedTotal: this.formatNumber(totalPending),
        overdueCount,
        upcomingCount,
        summary: {
          totalPending,
          overdueCount,
          upcomingCount,
          topInstitutions: institutionSummary,
        },
        visits: pendingList.map((visit) => ({
          ...visit,
          requiredByDate: visit.requiredByDate?.toISOString() || null,
          visitPeriod: visit.visitMonth && visit.visitYear
            ? `${monthNames[visit.visitMonth - 1]} ${visit.visitYear}`
            : null,
          overdueStatus: visit.daysOverdue > 0
            ? `${visit.daysOverdue} days overdue`
            : "On track",
        })),
        filtersApplied: this.buildFilterDescription(filtersApplied),
        filters: filtersApplied,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return this.errorResponse("Failed to get pending visits", errorMessage);
    }
  }
}
