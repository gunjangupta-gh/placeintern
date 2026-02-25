import 'dotenv/config';
import * as path from 'path';
import { promises as fs } from 'fs';
import ExcelJS from 'exceljs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const REPORT_MONTHS = [1, 2] as const;

const MONTH_NAME: Record<number, string> = {
  1: 'January',
  2: 'February',
};

function parseYearFromArgs(defaultYear: number): number {
  const yearArg = process.argv.find((arg) => arg.startsWith('--year='));
  if (!yearArg) return defaultYear;

  const value = Number(yearArg.split('=')[1]);
  if (!Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error('Invalid year. Use --year=YYYY (e.g., --year=2026).');
  }

  return value;
}

function toIsoDate(value?: Date | null): string {
  if (!value) return '';
  return value.toISOString().split('T')[0];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment.');
  }

  const currentYear = new Date().getFullYear();
  const reportYear = parseYearFromArgs(currentYear);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    console.log(`Generating Jan-Feb report for year ${reportYear}...`);

    const janStart = new Date(Date.UTC(reportYear, 0, 1, 0, 0, 0, 0));
    const marStart = new Date(Date.UTC(reportYear, 2, 1, 0, 0, 0, 0));

    const monthlyReports = await prisma.monthlyReport.findMany({
      where: {
        reportYear,
        reportMonth: { in: [...REPORT_MONTHS] },
        isDeleted: false,
        OR: [
          { submittedAt: { not: null } },
          { reportFileUrl: { not: null } },
          { status: { not: 'DRAFT' } },
        ],
      },
      select: {
        id: true,
        reportMonth: true,
        reportYear: true,
        monthName: true,
        status: true,
        submittedAt: true,
        reportFileUrl: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            institutionId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                rollNumber: true,
                Institution: {
                  select: {
                    name: true,
                    shortName: true,
                  },
                },
              },
            },
            Institution: {
              select: {
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
      orderBy: [
        { student: { user: { name: 'asc' } } },
        { reportMonth: 'asc' },
      ],
    });

    const studentMonthSet = new Map<string, Set<number>>();
    for (const report of monthlyReports) {
      const userId = report.student.user?.id;
      if (!userId) continue;
      if (!studentMonthSet.has(userId)) {
        studentMonthSet.set(userId, new Set<number>());
      }
      studentMonthSet.get(userId)?.add(report.reportMonth);
    }

    const facultyVisitLogs = await prisma.facultyVisitLog.findMany({
      where: {
        isDeleted: false,
        status: 'COMPLETED',
        OR: [
          {
            visitDate: {
              gte: janStart,
              lt: marStart,
            },
          },
          {
            AND: [
              { visitDate: null },
              { visitYear: reportYear },
              { visitMonth: { in: [...REPORT_MONTHS] } },
            ],
          },
        ],
      },
      select: {
        id: true,
        visitMonth: true,
        visitYear: true,
        visitDate: true,
        status: true,
        visitType: true,
        createdAt: true,
        application: {
          select: {
            id: true,
            student: {
              select: {
                user: {
                  select: {
                    name: true,
                    rollNumber: true,
                  },
                },
              },
            },
          },
        },
        faculty: {
          select: {
            id: true,
            name: true,
            email: true,
            Institution: {
              select: {
                name: true,
                shortName: true,
              },
            },
          },
        },
      },
      orderBy: [{ faculty: { name: 'asc' } }, { visitDate: 'asc' }, { visitMonth: 'asc' }],
    });

    const facultyMonthSet = new Map<string, Set<number>>();
    for (const log of facultyVisitLogs) {
      const facultyId = log.faculty?.id;
      if (!facultyId) continue;

      const effectiveMonth =
        log.visitDate?.getUTCMonth() !== undefined
          ? log.visitDate.getUTCMonth() + 1
          : (log.visitMonth ?? -1);

      if (!REPORT_MONTHS.includes(effectiveMonth as (typeof REPORT_MONTHS)[number])) {
        continue;
      }

      if (!facultyMonthSet.has(facultyId)) {
        facultyMonthSet.set(facultyId, new Set<number>());
      }
      facultyMonthSet.get(facultyId)?.add(effectiveMonth);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PlaceIntern Backend';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 45 },
      { header: 'Value', key: 'value', width: 22 },
    ];

    const studentsWithBothMonths = Array.from(studentMonthSet.values()).filter(
      (months) => months.has(1) && months.has(2),
    ).length;

    const facultyWithBothMonths = Array.from(facultyMonthSet.values()).filter(
      (months) => months.has(1) && months.has(2),
    ).length;

    summarySheet.addRows([
      { metric: 'Report Year', value: reportYear },
      { metric: 'Monthly Report Entries (Jan+Feb)', value: monthlyReports.length },
      { metric: 'Distinct Students with Monthly Report Entries', value: studentMonthSet.size },
      { metric: 'Students with both Jan and Feb Monthly Reports', value: studentsWithBothMonths },
      { metric: 'Faculty Visit Log Entries (Jan+Feb, Completed)', value: facultyVisitLogs.length },
      { metric: 'Distinct Faculty with Visit Log Entries', value: facultyMonthSet.size },
      { metric: 'Faculty with both Jan and Feb Visit Logs', value: facultyWithBothMonths },
      { metric: 'Generated At', value: new Date().toISOString() },
    ]);

    const monthlySheet = workbook.addWorksheet('Student Monthly Reports');
    monthlySheet.columns = [
      { header: 'Student Name', key: 'studentName', width: 30 },
      { header: 'Roll Number', key: 'rollNumber', width: 18 },
      { header: 'Student Email', key: 'studentEmail', width: 30 },
      { header: 'Institution Name', key: 'institutionName', width: 35 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Submitted At', key: 'submittedAt', width: 14 },
      { header: 'Report File URL', key: 'reportFileUrl', width: 45 },
      { header: 'Has Jan+Feb', key: 'hasBothMonths', width: 14 },
      { header: 'Record Created At', key: 'createdAt', width: 14 },
    ];

    for (const report of monthlyReports) {
      const user = report.student.user;
      const institution =
        user?.Institution?.name ||
        user?.Institution?.shortName ||
        report.student.Institution?.name ||
        report.student.Institution?.shortName ||
        'N/A';

      const monthSet = user?.id ? studentMonthSet.get(user.id) : undefined;
      const hasBothMonths = monthSet ? monthSet.has(1) && monthSet.has(2) : false;

      monthlySheet.addRow({
        studentName: user?.name || 'N/A',
        rollNumber: user?.rollNumber || '',
        studentEmail: user?.email || '',
        institutionName: institution,
        month: report.monthName || MONTH_NAME[report.reportMonth] || String(report.reportMonth),
        year: report.reportYear,
        status: report.status,
        submittedAt: toIsoDate(report.submittedAt),
        reportFileUrl: report.reportFileUrl || '',
        hasBothMonths: hasBothMonths ? 'Yes' : 'No',
        createdAt: toIsoDate(report.createdAt),
      });
    }

    const visitsSheet = workbook.addWorksheet('Faculty Visit Logs');
    visitsSheet.columns = [
      { header: 'Faculty Name', key: 'facultyName', width: 30 },
      { header: 'Faculty Email', key: 'facultyEmail', width: 30 },
      { header: 'Institution Name', key: 'institutionName', width: 35 },
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Year', key: 'year', width: 10 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Visit Type', key: 'visitType', width: 14 },
      { header: 'Visit Date', key: 'visitDate', width: 14 },
      { header: 'Student Name', key: 'studentName', width: 30 },
      { header: 'Student Roll Number', key: 'studentRollNumber', width: 20 },
      { header: 'Has Jan+Feb', key: 'hasBothMonths', width: 14 },
      { header: 'Record Created At', key: 'createdAt', width: 14 },
    ];

    for (const log of facultyVisitLogs) {
      const faculty = log.faculty;
      const monthSet = faculty?.id ? facultyMonthSet.get(faculty.id) : undefined;
      const hasBothMonths = monthSet ? monthSet.has(1) && monthSet.has(2) : false;

      const effectiveMonth =
        log.visitDate?.getUTCMonth() !== undefined
          ? log.visitDate.getUTCMonth() + 1
          : (log.visitMonth ?? -1);

      if (!REPORT_MONTHS.includes(effectiveMonth as (typeof REPORT_MONTHS)[number])) {
        continue;
      }

      const effectiveYear = log.visitDate ? log.visitDate.getUTCFullYear() : log.visitYear;

      visitsSheet.addRow({
        facultyName: faculty?.name || 'N/A',
        facultyEmail: faculty?.email || '',
        institutionName:
          faculty?.Institution?.name || faculty?.Institution?.shortName || 'N/A',
        month: MONTH_NAME[effectiveMonth] || String(effectiveMonth),
        year: effectiveYear || '',
        status: log.status,
        visitType: log.visitType,
        visitDate: toIsoDate(log.visitDate),
        studentName: log.application?.student?.user?.name || 'N/A',
        studentRollNumber: log.application?.student?.user?.rollNumber || '',
        hasBothMonths: hasBothMonths ? 'Yes' : 'No',
        createdAt: toIsoDate(log.createdAt),
      });
    }

    for (const sheet of [summarySheet, monthlySheet, visitsSheet]) {
      const header = sheet.getRow(1);
      header.font = { bold: true };
      header.alignment = { vertical: 'middle', horizontal: 'left' };
      header.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' },
        };
      });
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const outputDir = path.join(process.cwd(), 'reports');
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(
      outputDir,
      `jan-feb-student-monthly-and-faculty-visit-report-${reportYear}.xlsx`,
    );

    await workbook.xlsx.writeFile(outputPath);

    console.log('Report generated successfully.');
    console.log(`File: ${outputPath}`);
    console.log(`Monthly report rows: ${monthlyReports.length}`);
    console.log(`Faculty visit log rows: ${facultyVisitLogs.length}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to generate report:', error);
  process.exit(1);
});
