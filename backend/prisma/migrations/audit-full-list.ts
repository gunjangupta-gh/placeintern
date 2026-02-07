/**
 * Full Discrepancy List with Institution Names
 * Run with: npx tsx prisma/migrations/audit-full-list.ts
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const instAll = await prisma.institution.findMany({ select: { id: true, name: true, code: true } });
  const instMap = new Map(instAll.map(i => [i.id, i.name]));

  const now = new Date();
  const targetMonth = now.getMonth() + 1;
  const targetYear = now.getFullYear();
  const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
  const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  console.log('==========================================================');
  console.log('  FULL DISCREPANCY LIST WITH INSTITUTION NAMES');
  console.log('  Date: ' + targetMonth + '/' + targetYear);
  console.log('==========================================================');

  // ============================================================
  // 1. WITHDRAWN but isActive=true
  // ============================================================
  console.log('\n==============================================================');
  console.log('  1. WITHDRAWN APPS STILL MARKED isActive=true');
  console.log('==============================================================');
  const withdrawn = await prisma.internshipApplication.findMany({
    where: { isActive: true, status: 'WITHDRAWN' },
    select: {
      id: true, startDate: true, endDate: true, companyName: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } },
    },
  });
  console.log('Count: ' + withdrawn.length);
  withdrawn.forEach((a, i) => {
    console.log('\n  ' + (i + 1) + '. ' + (a.student.user?.name || '?'));
    console.log('     Roll: ' + (a.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(a.student.institutionId) || '?'));
    console.log('     Company: ' + (a.companyName || 'N/A'));
    console.log('     Dates: ' + (a.startDate?.toISOString().split('T')[0] || 'NULL') + ' to ' + (a.endDate?.toISOString().split('T')[0] || 'NULL'));
    console.log('     App ID: ' + a.id);
  });

  // ============================================================
  // 2. INACTIVE applications
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  2. INACTIVE APPLICATIONS (isActive=false)');
  console.log('==============================================================');
  const inactive = await prisma.internshipApplication.findMany({
    where: { isActive: false },
    select: {
      id: true, status: true, startDate: true, endDate: true, companyName: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true, active: true } } } },
    },
  });
  console.log('Count: ' + inactive.length);
  inactive.forEach((a, i) => {
    console.log('\n  ' + (i + 1) + '. ' + (a.student.user?.name || '?'));
    console.log('     Roll: ' + (a.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(a.student.institutionId) || '?'));
    console.log('     Status: ' + a.status + ' | User Active: ' + a.student.user?.active);
    console.log('     Company: ' + (a.companyName || 'N/A'));
    console.log('     Dates: ' + (a.startDate?.toISOString().split('T')[0] || 'NULL') + ' to ' + (a.endDate?.toISOString().split('T')[0] || 'NULL'));
    console.log('     App ID: ' + a.id);
  });

  // ============================================================
  // 3. Visits linked to inactive apps
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  3. VISITS LINKED TO INACTIVE APPLICATIONS');
  console.log('==============================================================');
  const orphanVisits = await prisma.facultyVisitLog.findMany({
    where: { isDeleted: false, application: { isActive: false } },
    select: {
      id: true, status: true, visitDate: true, visitNumber: true,
      faculty: { select: { name: true } },
      application: { select: { id: true, status: true, student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } } } },
    },
  });
  console.log('Count: ' + orphanVisits.length);
  orphanVisits.forEach((v, i) => {
    console.log('\n  ' + (i + 1) + '. Visit ID: ' + v.id);
    console.log('     Student: ' + (v.application.student.user?.name || '?'));
    console.log('     Roll: ' + (v.application.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(v.application.student.institutionId) || '?'));
    console.log('     Faculty: ' + (v.faculty?.name || 'NULL'));
    console.log('     Visit Date: ' + (v.visitDate?.toISOString().split('T')[0] || 'NULL') + ' | Visit Status: ' + v.status);
    console.log('     App ID: ' + v.application.id + ' | App Status: ' + v.application.status);
  });

  // ============================================================
  // 4. APPROVED internships not in training this month
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  4. APPROVED INTERNSHIPS NOT IN TRAINING THIS MONTH');
  console.log('==============================================================');
  const notThisMonth = await prisma.internshipApplication.findMany({
    where: {
      isActive: true, isSelfIdentified: true, status: 'APPROVED',
      student: { user: { active: true }, Institution: { isActive: true } },
      OR: [{ startDate: null }, { startDate: { gt: endOfMonth } }, { endDate: { lt: startOfMonth } }],
    },
    select: {
      id: true, startDate: true, endDate: true, internshipPhase: true, companyName: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } },
    },
  });
  console.log('Count: ' + notThisMonth.length);
  notThisMonth.forEach((a, i) => {
    const reason = !a.startDate ? 'No start date' :
      a.startDate > endOfMonth ? 'Starts after this month (' + a.startDate.toISOString().split('T')[0] + ')' :
      (a.endDate && a.endDate < startOfMonth) ? 'Ended before this month (' + a.endDate.toISOString().split('T')[0] + ')' : 'Unknown';
    console.log('\n  ' + (i + 1) + '. ' + (a.student.user?.name || '?'));
    console.log('     Roll: ' + (a.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(a.student.institutionId) || '?'));
    console.log('     Company: ' + (a.companyName || 'N/A'));
    console.log('     Phase: ' + (a.internshipPhase || 'NULL'));
    console.log('     Dates: ' + (a.startDate?.toISOString().split('T')[0] || 'NULL') + ' to ' + (a.endDate?.toISOString().split('T')[0] || 'NULL'));
    console.log('     Reason: ' + reason);
    console.log('     App ID: ' + a.id);
  });

  // ============================================================
  // 5. Institution mismatches
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  5. INSTITUTION STUDENT vs INTERNSHIP MISMATCHES');
  console.log('==============================================================');
  for (const inst of instAll) {
    const [students, allActive, approved] = await Promise.all([
      prisma.student.count({ where: { institutionId: inst.id, user: { active: true } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { institutionId: inst.id, user: { active: true } } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, status: 'APPROVED', student: { institutionId: inst.id, user: { active: true } } } }),
    ]);
    if (students === allActive && allActive === approved) continue;

    console.log('\n  ' + inst.name + ' (' + inst.code + ')');
    console.log('     Active Students: ' + students);
    console.log('     Active Internships (all status): ' + allActive);
    console.log('     Active Internships (APPROVED only): ' + approved);
    console.log('     Gap (students - approved): ' + (students - approved));

    if (students > allActive) {
      const noApp = await prisma.student.findMany({
        where: { institutionId: inst.id, user: { active: true }, internshipApplications: { none: { isActive: true, isSelfIdentified: true } } },
        select: { user: { select: { name: true, rollNumber: true } } },
        take: 20,
      });
      console.log('     Students WITHOUT any active internship:');
      noApp.forEach(s => console.log('       - ' + (s.user?.name || '?') + ' | Roll: ' + (s.user?.rollNumber || '?')));
    }
    if (allActive > approved) {
      const nonApproved = await prisma.internshipApplication.findMany({
        where: { isActive: true, isSelfIdentified: true, status: { not: 'APPROVED' }, student: { institutionId: inst.id, user: { active: true } } },
        select: { status: true, companyName: true, student: { select: { user: { select: { name: true, rollNumber: true } } } } },
      });
      console.log('     Non-APPROVED active internships:');
      nonApproved.forEach(a => console.log('       - ' + (a.student.user?.name || '?') + ' | Roll: ' + (a.student.user?.rollNumber || '?') + ' | Status: ' + a.status + ' | Company: ' + (a.companyName || 'N/A')));
    }
  }

  // ============================================================
  // 6. Orphaned mentor assignments
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  6. ACTIVE MENTOR ASSIGNMENTS WITH NO APPROVED INTERNSHIP');
  console.log('==============================================================');
  const orphanMentors = await prisma.mentorAssignment.findMany({
    where: { isActive: true, student: { internshipApplications: { none: { isActive: true, status: 'APPROVED' } } } },
    select: {
      id: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } },
      mentor: { select: { name: true } },
    },
  });
  console.log('Count: ' + orphanMentors.length);
  orphanMentors.forEach((m, i) => {
    console.log('\n  ' + (i + 1) + '. Student: ' + (m.student.user?.name || '?'));
    console.log('     Roll: ' + (m.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(m.student.institutionId) || '?'));
    console.log('     Mentor: ' + (m.mentor?.name || '?'));
    console.log('     Assignment ID: ' + m.id);
  });

  // ============================================================
  // 7. Phase NOT_STARTED but started
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  7. PHASE=NOT_STARTED BUT START DATE ALREADY PASSED');
  console.log('==============================================================');
  const stalePhase = await prisma.internshipApplication.findMany({
    where: { isActive: true, isSelfIdentified: true, internshipPhase: 'NOT_STARTED', startDate: { lt: now } },
    select: {
      id: true, status: true, startDate: true, endDate: true, companyName: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } },
    },
  });
  console.log('Count: ' + stalePhase.length);
  stalePhase.forEach((a, i) => {
    console.log('\n  ' + (i + 1) + '. ' + (a.student.user?.name || '?'));
    console.log('     Roll: ' + (a.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(a.student.institutionId) || '?'));
    console.log('     Company: ' + (a.companyName || 'N/A'));
    console.log('     Status: ' + a.status + ' | Phase: NOT_STARTED');
    console.log('     Dates: ' + (a.startDate?.toISOString().split('T')[0] || 'NULL') + ' to ' + (a.endDate?.toISOString().split('T')[0] || 'NULL'));
    console.log('     App ID: ' + a.id);
  });

  // ============================================================
  // 8. Invalid dates (end before start)
  // ============================================================
  console.log('\n\n==============================================================');
  console.log('  8. INVALID DATES (end date before start date)');
  console.log('==============================================================');
  const allApps = await prisma.internshipApplication.findMany({
    where: { isActive: true, isSelfIdentified: true, startDate: { not: null }, endDate: { not: null } },
    select: {
      id: true, startDate: true, endDate: true, status: true, companyName: true,
      student: { select: { institutionId: true, user: { select: { name: true, rollNumber: true } } } },
    },
  });
  const invalidDates = allApps.filter(a => a.endDate! < a.startDate!);
  console.log('Count: ' + invalidDates.length);
  invalidDates.forEach((a, i) => {
    console.log('\n  ' + (i + 1) + '. ' + (a.student.user?.name || '?'));
    console.log('     Roll: ' + (a.student.user?.rollNumber || '?'));
    console.log('     Institution: ' + (instMap.get(a.student.institutionId) || '?'));
    console.log('     Company: ' + (a.companyName || 'N/A'));
    console.log('     Status: ' + a.status);
    console.log('     Start: ' + a.startDate!.toISOString().split('T')[0] + ' | End: ' + a.endDate!.toISOString().split('T')[0] + ' (END BEFORE START!)');
    console.log('     App ID: ' + a.id);
  });

  console.log('\n\n==========================================================');
  console.log('  FULL AUDIT COMPLETE');
  console.log('==========================================================');
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
