import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Configuration (same as monthly-cycle.config.ts)
const MIN_DAYS_FOR_INCLUSION = 10;
const FIRST_MONTH_MIN_DAYS = 15;
const MAX_MONTHS = 24;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthlyCycle {
  monthNumber: number;
  monthName: string;
  year: number;
  reportDueDate: Date;
  visitDueDate: Date;
  daysInMonth: number;
  isFirstMonth: boolean;
  isLastMonth: boolean;
  isIncluded: boolean;
}

/**
 * Get the last day of a given month
 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate days in a specific month for the internship period
 */
function calculateDaysInMonth(
  year: number,
  month: number,
  startDate: Date,
  endDate: Date,
): number {
  const monthStart = new Date(year, month - 1, 1);
  monthStart.setHours(0, 0, 0, 0);

  const lastDay = getLastDayOfMonth(year, month);
  const monthEnd = new Date(year, month - 1, lastDay);
  monthEnd.setHours(23, 59, 59, 999);

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const effectiveStart = start > monthStart ? start : monthStart;
  const effectiveEnd = end < monthEnd ? end : monthEnd;

  if (effectiveStart > monthEnd || effectiveEnd < monthStart) {
    return 0;
  }

  const days = Math.floor(
    (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;

  return Math.max(0, days);
}

/**
 * Get report due date (5th of next month)
 */
function getReportDueDate(year: number, month: number): Date {
  let nextMonth = month + 1;
  let nextYear = year;

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }

  const dueDate = new Date(nextYear, nextMonth - 1, 5);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

/**
 * Get visit due date (last day of month)
 */
function getVisitDueDate(year: number, month: number): Date {
  const lastDay = getLastDayOfMonth(year, month);
  const dueDate = new Date(year, month - 1, lastDay);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

/**
 * Calculate expected months for an internship (same logic as monthly-cycle.util.ts)
 */
function calculateExpectedMonths(startDate: Date, endDate: Date): MonthlyCycle[] {
  if (!startDate || !endDate) return [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (end < start) return [];

  const allMonths: MonthlyCycle[] = [];
  const includedMonths: MonthlyCycle[] = [];

  let currentYear = start.getFullYear();
  let currentMonth = start.getMonth() + 1;
  let monthCount = 0;

  while (monthCount < MAX_MONTHS) {
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    monthStart.setHours(0, 0, 0, 0);

    const lastDay = getLastDayOfMonth(currentYear, currentMonth);
    const monthEnd = new Date(currentYear, currentMonth - 1, lastDay);
    monthEnd.setHours(23, 59, 59, 999);

    if (monthStart > end) break;

    const daysInMonth = calculateDaysInMonth(currentYear, currentMonth, start, end);

    if (daysInMonth > 0) {
      const isFirstMonth = allMonths.length === 0;
      const isLastMonth = end >= monthStart && end <= monthEnd;
      const isIncluded = isFirstMonth
        ? daysInMonth > FIRST_MONTH_MIN_DAYS
        : isLastMonth
          ? daysInMonth > 0
          : daysInMonth > MIN_DAYS_FOR_INCLUSION;

      const cycle: MonthlyCycle = {
        monthNumber: currentMonth,
        monthName: MONTH_NAMES[currentMonth - 1],
        year: currentYear,
        reportDueDate: getReportDueDate(currentYear, currentMonth),
        visitDueDate: getVisitDueDate(currentYear, currentMonth),
        daysInMonth,
        isFirstMonth,
        isLastMonth,
        isIncluded,
      };

      allMonths.push(cycle);

      if (isIncluded) {
        includedMonths.push(cycle);
      }
    }

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    monthCount++;
  }

  if (allMonths.length > 0) {
    allMonths[allMonths.length - 1].isLastMonth = true;
  }

  if (includedMonths.length > 0) {
    includedMonths[includedMonths.length - 1].isLastMonth = true;
  }

  return includedMonths;
}

/**
 * Generate a random date within a month
 */
function getRandomDateInMonth(year: number, month: number): Date {
  const lastDay = getLastDayOfMonth(year, month);
  const randomDay = Math.floor(Math.random() * lastDay) + 1;
  return new Date(year, month - 1, randomDay, 10, 0, 0);
}

/**
 * Main seed function
 */
async function main() {
  console.log('=== Seeding Dummy Monthly Reports & Faculty Visits ===\n');

  // Get all internship applications with valid start and end dates
  const applications = await prisma.internshipApplication.findMany({
    where: {
      AND: [
        { startDate: { not: null } },
        { endDate: { not: null } },
      ],
    },
    select: {
      id: true,
      studentId: true,
      startDate: true,
      endDate: true,
      mentorId: true,
      totalExpectedReports: true,
      totalExpectedVisits: true,
      submittedReportsCount: true,
      completedVisitsCount: true,
      student: {
        select: {
          id: true,
          userId: true,
          user: {
            select: { name: true },
          },
          // Get active mentor assignment for the student
          mentorAssignments: {
            where: { isActive: true },
            select: { mentorId: true },
            take: 1,
          },
        },
      },
    },
  });

  console.log(`Found ${applications.length} applications with valid dates\n`);

  let totalReportsCreated = 0;
  let totalVisitsCreated = 0;
  let applicationsProcessed = 0;
  let skippedApplications = 0;

  for (const app of applications) {
    if (!app.startDate || !app.endDate) continue;

    const studentName = app.student?.user?.name || 'Unknown';
    const expectedMonths = calculateExpectedMonths(app.startDate, app.endDate);

    if (expectedMonths.length === 0) {
      skippedApplications++;
      continue;
    }

    // Get faculty ID from mentor assignment (preferred) or application mentorId
    const facultyId = app.student?.mentorAssignments?.[0]?.mentorId || app.mentorId;

    console.log(`\nProcessing: ${studentName} (${expectedMonths.length} expected months)`);
    console.log(`  Start: ${app.startDate.toISOString().split('T')[0]}, End: ${app.endDate.toISOString().split('T')[0]}`);
    console.log(`  Faculty ID: ${facultyId ? facultyId.substring(0, 8) + '...' : 'NULL'}`);

    let reportsCreated = 0;
    let visitsCreated = 0;

    for (const month of expectedMonths) {
      // Check if monthly report already exists for this month/year
      const existingReport = await prisma.monthlyReport.findFirst({
        where: {
          applicationId: app.id,
          reportMonth: month.monthNumber,
          reportYear: month.year,
        },
      });

      if (!existingReport) {
        // Create monthly report
        const submittedAt = getRandomDateInMonth(month.year, month.monthNumber);

        // Calculate period dates
        const periodStartDate = new Date(month.year, month.monthNumber - 1, 1);
        const lastDay = getLastDayOfMonth(month.year, month.monthNumber);
        const periodEndDate = new Date(month.year, month.monthNumber - 1, lastDay);

        await prisma.monthlyReport.create({
          data: {
            applicationId: app.id,
            studentId: app.studentId,
            reportMonth: month.monthNumber,
            reportYear: month.year,
            monthName: month.monthName,
            status: 'APPROVED',
            submittedAt: submittedAt,
            isApproved: true,
            approvedAt: new Date(submittedAt.getTime() + 24 * 60 * 60 * 1000), // Approved next day
            dueDate: month.reportDueDate,
            submissionWindowStart: new Date(month.year, month.monthNumber, 1), // 1st of next month
            submissionWindowEnd: month.reportDueDate,
            isOverdue: false,
            isLateSubmission: false,
            periodStartDate,
            periodEndDate,
            isPartialMonth: month.isFirstMonth || month.isLastMonth,
            isFinalReport: month.isLastMonth,
            reportFileUrl: `https://storage.example.com/reports/${app.id}/${month.year}-${month.monthNumber}.pdf`,
          },
        });
        reportsCreated++;
      }

      // Check if faculty visit already exists for this month/year
      const existingVisit = await prisma.facultyVisitLog.findFirst({
        where: {
          applicationId: app.id,
          visitMonth: month.monthNumber,
          visitYear: month.year,
        },
      });

      if (!existingVisit) {
        // Create faculty visit log
        const visitDate = getRandomDateInMonth(month.year, month.monthNumber);

        await prisma.facultyVisitLog.create({
          data: {
            applicationId: app.id,
            facultyId: facultyId,
            visitMonth: month.monthNumber,
            visitYear: month.year,
            visitDate: visitDate,
            visitType: 'PHYSICAL',
            status: 'COMPLETED',
            isMonthlyVisit: true,
            requiredByDate: month.visitDueDate,
            visitNumber: expectedMonths.indexOf(month) + 1,
            visitDuration: '2 hours',
            visitLocation: 'Company Office',
            studentPerformance: 'Good progress on assigned tasks',
            workEnvironment: 'Professional and supportive',
            industrySupport: 'Adequate mentorship provided',
            skillsDevelopment: 'Learning new technologies',
            attendanceStatus: 'Regular',
            workQuality: 'Satisfactory',
            studentProgressRating: Math.floor(Math.random() * 2) + 4, // 4-5
            industryCooperationRating: Math.floor(Math.random() * 2) + 4,
            workEnvironmentRating: Math.floor(Math.random() * 2) + 4,
            mentoringSupportRating: Math.floor(Math.random() * 2) + 4,
            overallSatisfactionRating: Math.floor(Math.random() * 2) + 4,
            observationsAboutStudent: `The student has shown consistent progress during ${month.monthName} ${month.year}. They are actively engaged in their assigned tasks and demonstrate a good understanding of the work requirements.`,
            feedbackSharedWithStudent: `Feedback was shared with the student regarding their progress in ${month.monthName}. They were advised to continue their current pace of work and focus on improving their technical skills further.`,
            isDeleted: false,
          },
        });
        visitsCreated++;
      }
    }

    // Update counters on the application
    const totalExpected = expectedMonths.length;

    // Count actual reports and visits created
    const actualReportsCount = await prisma.monthlyReport.count({
      where: {
        applicationId: app.id,
        status: 'APPROVED',
        isDeleted: false,
      },
    });

    const actualVisitsCount = await prisma.facultyVisitLog.count({
      where: {
        applicationId: app.id,
        status: 'COMPLETED',
        isDeleted: false,
      },
    });

    // Update the application with correct counts
    await prisma.internshipApplication.update({
      where: { id: app.id },
      data: {
        totalExpectedReports: totalExpected,
        totalExpectedVisits: totalExpected,
        submittedReportsCount: actualReportsCount,
        completedVisitsCount: actualVisitsCount,
        expectedCountsLastCalculated: new Date(),
      },
    });

    totalReportsCreated += reportsCreated;
    totalVisitsCreated += visitsCreated;
    applicationsProcessed++;

    console.log(`  Created: ${reportsCreated} reports, ${visitsCreated} visits`);
    console.log(`  Counters updated: expected=${totalExpected}, reports=${actualReportsCount}, visits=${actualVisitsCount}`);
  }

  console.log('\n=== Seed Complete ===');
  console.log(`
Summary:
  - Applications Processed: ${applicationsProcessed}
  - Applications Skipped: ${skippedApplications}
  - Monthly Reports Created: ${totalReportsCreated}
  - Faculty Visits Created: ${totalVisitsCreated}
  `);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
