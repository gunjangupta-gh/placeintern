/**
 * Database Discrepancy Audit Script
 * Run with: npx tsx prisma/migrations/audit-discrepancies.ts
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('========================================');
  console.log('  DATABASE DISCREPANCY AUDIT');
  console.log('========================================\n');

  // 1. INTERNSHIP APPLICATIONS
  console.log('--- INTERNSHIP APPLICATIONS ---');
  const [totalApps, activeApps, inactiveApps, selfIdentified, selfIdentifiedActive, selfIdentifiedInactive] = await Promise.all([
    prisma.internshipApplication.count(),
    prisma.internshipApplication.count({ where: { isActive: true } }),
    prisma.internshipApplication.count({ where: { isActive: false } }),
    prisma.internshipApplication.count({ where: { isSelfIdentified: true } }),
    prisma.internshipApplication.count({ where: { isSelfIdentified: true, isActive: true } }),
    prisma.internshipApplication.count({ where: { isSelfIdentified: true, isActive: false } }),
  ]);
  console.log('Total applications:', totalApps);
  console.log('Active:', activeApps, '| Inactive:', inactiveApps);
  console.log('Self-identified total:', selfIdentified);
  console.log('Self-identified active:', selfIdentifiedActive, '| Self-identified inactive:', selfIdentifiedInactive);

  // Apps with active vs inactive users
  const [appsActiveUser, appsInactiveUser] = await Promise.all([
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { user: { active: true } } } }),
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { user: { active: false } } } }),
  ]);
  console.log('Active self-id apps with active user:', appsActiveUser);
  console.log('Active self-id apps with INACTIVE user:', appsInactiveUser);

  // Apps from inactive institutions
  const appsInactiveInst = await prisma.internshipApplication.count({
    where: { isActive: true, isSelfIdentified: true, student: { user: { active: true }, Institution: { isActive: false } } },
  });
  console.log('Active self-id apps from INACTIVE institution:', appsInactiveInst);

  // Apps missing dates
  const [noStartDate, noEndDate, noBothDates] = await Promise.all([
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, startDate: null } }),
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, endDate: null } }),
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, startDate: null, endDate: null } }),
  ]);
  console.log('Active self-id missing startDate:', noStartDate);
  console.log('Active self-id missing endDate:', noEndDate);
  console.log('Active self-id missing BOTH dates:', noBothDates);

  // Status breakdown
  const statusBreakdown = await prisma.internshipApplication.groupBy({
    by: ['status'],
    where: { isActive: true, isSelfIdentified: true },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\nStatus breakdown (active self-id):');
  statusBreakdown.forEach(s => console.log('  ' + s.status + ':', s._count.id));

  // Phase breakdown
  const phaseBreakdown = await prisma.internshipApplication.groupBy({
    by: ['internshipPhase'],
    where: { isActive: true, isSelfIdentified: true },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\nPhase breakdown (active self-id):');
  phaseBreakdown.forEach(s => console.log('  ' + (s.internshipPhase || 'NULL') + ':', s._count.id));

  // Duplicate check: students with multiple active applications
  const studentsWithMultiple = await prisma.internshipApplication.groupBy({
    by: ['studentId'],
    where: { isActive: true, isSelfIdentified: true },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  console.log('\nStudents with MULTIPLE active self-id apps:', studentsWithMultiple.length);
  if (studentsWithMultiple.length > 0 && studentsWithMultiple.length <= 20) {
    for (const s of studentsWithMultiple) {
      console.log('  studentId:', s.studentId, '| count:', s._count.id);
    }
  }

  // 2. MONTHLY REPORTS
  console.log('\n--- MONTHLY REPORTS ---');
  const [totalReports, deletedReports, activeReports] = await Promise.all([
    prisma.monthlyReport.count(),
    prisma.monthlyReport.count({ where: { isDeleted: true } }),
    prisma.monthlyReport.count({ where: { isDeleted: false } }),
  ]);
  console.log('Total reports:', totalReports);
  console.log('Active (not deleted):', activeReports, '| Soft-deleted:', deletedReports);

  const reportStatusBreakdown = await prisma.monthlyReport.groupBy({
    by: ['status'],
    where: { isDeleted: false },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\nReport status breakdown (non-deleted):');
  reportStatusBreakdown.forEach(s => console.log('  ' + s.status + ':', s._count.id));

  // Orphaned reports
  const reportsWithInactiveApp = await prisma.monthlyReport.count({
    where: { isDeleted: false, application: { isActive: false } },
  });
  const reportsWithInactiveUser = await prisma.monthlyReport.count({
    where: { isDeleted: false, student: { user: { active: false } } },
  });
  console.log('\nReports linked to INACTIVE applications:', reportsWithInactiveApp);
  console.log('Reports linked to INACTIVE users:', reportsWithInactiveUser);

  // Duplicate reports
  const duplicateReports = await prisma.monthlyReport.groupBy({
    by: ['applicationId', 'reportMonth', 'reportYear'],
    where: { isDeleted: false },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  console.log('Duplicate reports (same app + month + year):', duplicateReports.length);
  if (duplicateReports.length > 0 && duplicateReports.length <= 10) {
    duplicateReports.forEach(d => console.log('  appId:', d.applicationId, '| month:', d.reportMonth, '/' + d.reportYear, '| count:', d._count.id));
  }

  // 3. FACULTY VISIT LOGS
  console.log('\n--- FACULTY VISIT LOGS ---');
  const [totalVisits, deletedVisits, activeVisits] = await Promise.all([
    prisma.facultyVisitLog.count(),
    prisma.facultyVisitLog.count({ where: { isDeleted: true } }),
    prisma.facultyVisitLog.count({ where: { isDeleted: false } }),
  ]);
  console.log('Total visits:', totalVisits);
  console.log('Active (not deleted):', activeVisits, '| Soft-deleted:', deletedVisits);

  const visitStatusBreakdown = await prisma.facultyVisitLog.groupBy({
    by: ['status'],
    where: { isDeleted: false },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  console.log('\nVisit status breakdown (non-deleted):');
  visitStatusBreakdown.forEach(s => console.log('  ' + s.status + ':', s._count.id));

  const visitsNoFaculty = await prisma.facultyVisitLog.count({
    where: { isDeleted: false, facultyId: null },
  });
  console.log('\nVisits with NO faculty assigned:', visitsNoFaculty);

  const visitsInactiveApp = await prisma.facultyVisitLog.count({
    where: { isDeleted: false, application: { isActive: false } },
  });
  const visitsInactiveUser = await prisma.facultyVisitLog.count({
    where: { isDeleted: false, application: { student: { user: { active: false } } } },
  });
  console.log('Visits linked to INACTIVE applications:', visitsInactiveApp);
  console.log('Visits linked to INACTIVE users:', visitsInactiveUser);

  // 4. MENTOR ASSIGNMENTS
  console.log('\n--- MENTOR ASSIGNMENTS ---');
  const [totalAssignments, activeAssignments, inactiveAssignments] = await Promise.all([
    prisma.mentorAssignment.count(),
    prisma.mentorAssignment.count({ where: { isActive: true } }),
    prisma.mentorAssignment.count({ where: { isActive: false } }),
  ]);
  console.log('Total assignments:', totalAssignments);
  console.log('Active:', activeAssignments, '| Inactive:', inactiveAssignments);

  const studentsMultipleMentors = await prisma.mentorAssignment.groupBy({
    by: ['studentId'],
    where: { isActive: true },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });
  console.log('Students with MULTIPLE active mentors:', studentsMultipleMentors.length);

  const assignmentsInactiveStudent = await prisma.mentorAssignment.count({
    where: { isActive: true, student: { user: { active: false } } },
  });
  const assignmentsInactiveMentor = await prisma.mentorAssignment.count({
    where: { isActive: true, mentor: { active: false } },
  });
  console.log('Active assignments with INACTIVE student:', assignmentsInactiveStudent);
  console.log('Active assignments with INACTIVE mentor:', assignmentsInactiveMentor);

  const studentsNoMentor = await prisma.student.count({
    where: {
      user: { active: true },
      internshipApplications: { some: { isActive: true, isSelfIdentified: true } },
      mentorAssignments: { none: { isActive: true } },
    },
  });
  console.log('Students with active internship but NO mentor:', studentsNoMentor);

  // 5. JOINING LETTERS
  console.log('\n--- JOINING LETTERS ---');
  const [jlTotal, jlUploaded, jlMissing] = await Promise.all([
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { user: { active: true } } } }),
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { user: { active: true } }, joiningLetterUrl: { not: null, notIn: [''] } } }),
    prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { user: { active: true } }, OR: [{ joiningLetterUrl: null }, { joiningLetterUrl: '' }] } }),
  ]);
  console.log('Expected (active self-id, active user):', jlTotal);
  console.log('Uploaded:', jlUploaded, '| Missing:', jlMissing);
  console.log('Upload rate:', jlTotal > 0 ? Math.round((jlUploaded / jlTotal) * 100) + '%' : 'N/A');

  // 6. INSTITUTION BREAKDOWN
  console.log('\n--- INSTITUTION BREAKDOWN (top 15) ---');
  const institutions = await prisma.institution.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  const instResults: Array<{ name: string; code: string | null; students: number; internships: number; jl: number; reports: number; visits: number; mentored: number }> = [];

  for (const inst of institutions) {
    const [students, internships, jl, reports, visits, mentored] = await Promise.all([
      prisma.student.count({ where: { institutionId: inst.id, user: { active: true } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { institutionId: inst.id, user: { active: true } } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { institutionId: inst.id, user: { active: true } }, joiningLetterUrl: { not: null, notIn: [''] } } }),
      prisma.monthlyReport.count({ where: { isDeleted: false, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] }, student: { institutionId: inst.id, user: { active: true } } } }),
      prisma.facultyVisitLog.count({ where: { isDeleted: false, status: 'COMPLETED', application: { isActive: true, student: { institutionId: inst.id, user: { active: true } } } } }),
      prisma.student.count({ where: { institutionId: inst.id, user: { active: true }, mentorAssignments: { some: { isActive: true } } } }),
    ]);
    instResults.push({ name: inst.name, code: inst.code, students, internships, jl, reports, visits, mentored });
  }

  instResults.sort((a, b) => b.internships - a.internships);

  console.log('Code'.padEnd(12) + 'Students'.padStart(9) + 'Interns'.padStart(9) + '  JL'.padStart(6) + 'Reports'.padStart(9) + 'Visits'.padStart(8) + 'Mentored'.padStart(10));
  console.log('-'.repeat(63));
  instResults.slice(0, 15).forEach(i => {
    console.log(
      (i.code || i.name.substring(0, 10)).padEnd(12) +
      String(i.students).padStart(9) +
      String(i.internships).padStart(9) +
      String(i.jl).padStart(6) +
      String(i.reports).padStart(9) +
      String(i.visits).padStart(8) +
      String(i.mentored).padStart(10)
    );
  });

  // 7. CURRENT MONTH SPECIFICS
  const now = new Date();
  const targetMonth = now.getMonth() + 1;
  const targetYear = now.getFullYear();
  const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
  const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  console.log('\n--- CURRENT MONTH (' + targetMonth + '/' + targetYear + ') ---');

  const [reportsThisMonth, visitsThisMonth, internshipsThisMonth] = await Promise.all([
    prisma.monthlyReport.count({
      where: { isDeleted: false, reportMonth: targetMonth, reportYear: targetYear, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'] }, student: { user: { active: true }, Institution: { isActive: true } } },
    }),
    prisma.facultyVisitLog.count({
      where: { isDeleted: false, status: 'COMPLETED', visitDate: { gte: startOfMonth, lte: endOfMonth }, application: { student: { user: { active: true }, Institution: { isActive: true } } } },
    }),
    prisma.internshipApplication.count({
      where: {
        isActive: true, isSelfIdentified: true, status: 'APPROVED',
        startDate: { not: null, lte: endOfMonth },
        student: { user: { active: true }, Institution: { isActive: true } },
        OR: [{ endDate: { gte: startOfMonth } }, { endDate: null }],
      },
    }),
  ]);

  console.log('Internships in training this month:', internshipsThisMonth);
  console.log('Reports submitted this month:', reportsThisMonth);
  console.log('Visits completed this month:', visitsThisMonth);

  // Internships ending in first 10 days (excluded by monthly cycle)
  const excludedByMonthlyCycle = await prisma.internshipApplication.count({
    where: {
      isActive: true, isSelfIdentified: true, status: 'APPROVED',
      startDate: { not: null },
      student: { user: { active: true }, Institution: { isActive: true } },
      endDate: { gte: startOfMonth, lte: new Date(targetYear, targetMonth - 1, 10, 23, 59, 59, 999) },
    },
  });
  console.log('Excluded by monthly cycle (end date <= 10th):', excludedByMonthlyCycle);
  console.log('Expected for reports/visits:', internshipsThisMonth - excludedByMonthlyCycle);

  console.log('\n========================================');
  console.log('  AUDIT COMPLETE');
  console.log('========================================');
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
