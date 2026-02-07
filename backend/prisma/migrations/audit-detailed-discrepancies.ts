/**
 * Detailed Discrepancy List Script
 * Run with: npx tsx prisma/migrations/audit-detailed-discrepancies.ts
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const now = new Date();
  const targetMonth = now.getMonth() + 1;
  const targetYear = now.getFullYear();
  const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
  const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

  console.log('==========================================================');
  console.log('  DETAILED DISCREPANCY LIST — ' + targetMonth + '/' + targetYear);
  console.log('==========================================================\n');

  // ============================================================
  // 1. WITHDRAWN but still isActive = true
  // ============================================================
  console.log('--- 1. WITHDRAWN APPS STILL MARKED isActive=true ---');
  const withdrawnButActive = await prisma.internshipApplication.findMany({
    where: { isActive: true, status: 'WITHDRAWN' },
    select: {
      id: true, status: true, startDate: true, endDate: true,
      student: { select: { id: true, user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
    },
  });
  console.log('Count:', withdrawnButActive.length);
  withdrawnButActive.forEach(a => {
    console.log('  ID:', a.id);
    console.log('  Student:', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| Inst:', a.student.Institution?.code);
    console.log('  Status:', a.status, '| Start:', a.startDate?.toISOString().split('T')[0], '| End:', a.endDate?.toISOString().split('T')[0]);
    console.log('  ---');
  });

  // ============================================================
  // 2. INACTIVE apps (12 found) — what are they?
  // ============================================================
  console.log('\n--- 2. INACTIVE APPLICATIONS (isActive=false) ---');
  const inactiveApps = await prisma.internshipApplication.findMany({
    where: { isActive: false },
    select: {
      id: true, status: true, isActive: true, isSelfIdentified: true, startDate: true, endDate: true,
      student: { select: { id: true, user: { select: { name: true, rollNumber: true, active: true } }, Institution: { select: { code: true, isActive: true } } } },
    },
  });
  console.log('Count:', inactiveApps.length);
  inactiveApps.forEach(a => {
    console.log('  ID:', a.id);
    console.log('  Student:', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| UserActive:', a.student.user?.active);
    console.log('  Inst:', a.student.Institution?.code, '| InstActive:', a.student.Institution?.isActive);
    console.log('  AppStatus:', a.status, '| SelfID:', a.isSelfIdentified);
    console.log('  Start:', a.startDate?.toISOString().split('T')[0] || 'NULL', '| End:', a.endDate?.toISOString().split('T')[0] || 'NULL');
    console.log('  ---');
  });

  // ============================================================
  // 3. Faculty visit linked to INACTIVE application
  // ============================================================
  console.log('\n--- 3. VISITS LINKED TO INACTIVE APPLICATIONS ---');
  const orphanVisits = await prisma.facultyVisitLog.findMany({
    where: { isDeleted: false, application: { isActive: false } },
    select: {
      id: true, status: true, visitDate: true, visitNumber: true,
      facultyId: true,
      faculty: { select: { name: true } },
      application: {
        select: {
          id: true, isActive: true, status: true,
          student: { select: { user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
        },
      },
    },
  });
  console.log('Count:', orphanVisits.length);
  orphanVisits.forEach(v => {
    console.log('  Visit ID:', v.id);
    console.log('  Visit Status:', v.status, '| Date:', v.visitDate?.toISOString().split('T')[0] || 'NULL', '| Visit#:', v.visitNumber);
    console.log('  Faculty:', v.faculty?.name || 'NULL');
    console.log('  App ID:', v.application.id, '| AppActive:', v.application.isActive, '| AppStatus:', v.application.status);
    console.log('  Student:', v.application.student.user?.name, '| Roll:', v.application.student.user?.rollNumber, '| Inst:', v.application.student.Institution?.code);
    console.log('  ---');
  });

  // ============================================================
  // 4. 10 APPROVED internships NOT overlapping current month
  // ============================================================
  console.log('\n--- 4. APPROVED INTERNSHIPS NOT IN TRAINING THIS MONTH ---');
  const approvedNotThisMonth = await prisma.internshipApplication.findMany({
    where: {
      isActive: true, isSelfIdentified: true, status: 'APPROVED',
      student: { user: { active: true }, Institution: { isActive: true } },
      OR: [
        { startDate: null },
        { startDate: { gt: endOfMonth } },
        { endDate: { lt: startOfMonth } },
      ],
    },
    select: {
      id: true, startDate: true, endDate: true, internshipPhase: true, companyName: true,
      student: { select: { user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
    },
  });
  console.log('Count:', approvedNotThisMonth.length);
  approvedNotThisMonth.forEach(a => {
    const reason = !a.startDate ? 'No start date' :
      a.startDate > endOfMonth ? 'Starts after this month (' + a.startDate.toISOString().split('T')[0] + ')' :
      a.endDate && a.endDate < startOfMonth ? 'Ended before this month (' + a.endDate.toISOString().split('T')[0] + ')' : 'Unknown';
    console.log('  ID:', a.id);
    console.log('  Student:', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| Inst:', a.student.Institution?.code);
    console.log('  Company:', a.companyName || 'NULL', '| Phase:', a.internshipPhase);
    console.log('  Start:', a.startDate?.toISOString().split('T')[0] || 'NULL', '| End:', a.endDate?.toISOString().split('T')[0] || 'NULL');
    console.log('  Reason:', reason);
    console.log('  ---');
  });

  // ============================================================
  // 5. Institutions where Students != Internships count
  // ============================================================
  console.log('\n--- 5. INSTITUTIONS: STUDENT vs INTERNSHIP MISMATCH ---');
  const institutions = await prisma.institution.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });

  for (const inst of institutions) {
    const [students, approvedInternships, allActiveInternships] = await Promise.all([
      prisma.student.count({ where: { institutionId: inst.id, user: { active: true } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, status: 'APPROVED', student: { institutionId: inst.id, user: { active: true } } } }),
      prisma.internshipApplication.count({ where: { isActive: true, isSelfIdentified: true, student: { institutionId: inst.id, user: { active: true } } } }),
    ]);

    if (students !== allActiveInternships || allActiveInternships !== approvedInternships) {
      console.log('  ' + (inst.code || inst.name));
      console.log('    Active students:', students);
      console.log('    Active internships (all status):', allActiveInternships);
      console.log('    Active internships (APPROVED):', approvedInternships);
      console.log('    Gap (students - approved):', students - approvedInternships);

      // Find students without internship
      if (students > allActiveInternships) {
        const studentsWithout = await prisma.student.findMany({
          where: {
            institutionId: inst.id,
            user: { active: true },
            internshipApplications: { none: { isActive: true, isSelfIdentified: true } },
          },
          select: { id: true, user: { select: { name: true, rollNumber: true } } },
          take: 10,
        });
        console.log('    Students WITHOUT active internship:');
        studentsWithout.forEach(s => console.log('      -', s.user?.name, '| Roll:', s.user?.rollNumber));
      }

      // Find WITHDRAWN but active internships
      if (allActiveInternships > approvedInternships) {
        const withdrawnApps = await prisma.internshipApplication.findMany({
          where: { isActive: true, isSelfIdentified: true, status: { not: 'APPROVED' }, student: { institutionId: inst.id, user: { active: true } } },
          select: { id: true, status: true, student: { select: { user: { select: { name: true, rollNumber: true } } } } },
        });
        console.log('    Non-APPROVED active internships:');
        withdrawnApps.forEach(a => console.log('      -', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| Status:', a.status));
      }
      console.log('  ---');
    }
  }

  // ============================================================
  // 6. Mentor assignments for inactive/withdrawn internships
  // ============================================================
  console.log('\n--- 6. ACTIVE MENTOR ASSIGNMENTS FOR INACTIVE/WITHDRAWN APPS ---');
  const mentorAssignmentsNoActiveApp = await prisma.mentorAssignment.findMany({
    where: {
      isActive: true,
      student: {
        internshipApplications: { none: { isActive: true, status: 'APPROVED' } },
      },
    },
    select: {
      id: true,
      student: { select: { id: true, user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
      mentor: { select: { name: true } },
    },
    take: 20,
  });
  console.log('Count:', mentorAssignmentsNoActiveApp.length);
  mentorAssignmentsNoActiveApp.forEach(m => {
    console.log('  Assignment ID:', m.id);
    console.log('  Student:', m.student.user?.name, '| Roll:', m.student.user?.rollNumber, '| Inst:', m.student.Institution?.code);
    console.log('  Mentor:', m.mentor?.name);
    console.log('  ---');
  });

  // ============================================================
  // 7. Internships ending in first 10 days of current month
  // ============================================================
  console.log('\n--- 7. INTERNSHIPS ENDING IN FIRST 10 DAYS (excluded by monthly cycle) ---');
  const endingEarly = await prisma.internshipApplication.findMany({
    where: {
      isActive: true, isSelfIdentified: true, status: 'APPROVED',
      student: { user: { active: true }, Institution: { isActive: true } },
      endDate: { gte: startOfMonth, lte: new Date(targetYear, targetMonth - 1, 10, 23, 59, 59, 999) },
    },
    select: {
      id: true, startDate: true, endDate: true,
      student: { select: { user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
    },
  });
  console.log('Count:', endingEarly.length);
  endingEarly.forEach(a => {
    console.log('  Student:', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| Inst:', a.student.Institution?.code);
    console.log('  Start:', a.startDate?.toISOString().split('T')[0], '| End:', a.endDate?.toISOString().split('T')[0]);
    console.log('  Days in month:', a.endDate ? a.endDate.getDate() : 0);
    console.log('  ---');
  });

  // ============================================================
  // 8. Phase NOT_STARTED but have startDate in the past
  // ============================================================
  console.log('\n--- 8. PHASE=NOT_STARTED BUT START DATE IN THE PAST ---');
  const notStartedButPast = await prisma.internshipApplication.findMany({
    where: {
      isActive: true, isSelfIdentified: true,
      internshipPhase: 'NOT_STARTED',
      startDate: { lt: now },
    },
    select: {
      id: true, status: true, internshipPhase: true, startDate: true, endDate: true,
      student: { select: { user: { select: { name: true, rollNumber: true } }, Institution: { select: { code: true } } } },
    },
  });
  console.log('Count:', notStartedButPast.length);
  notStartedButPast.forEach(a => {
    console.log('  Student:', a.student.user?.name, '| Roll:', a.student.user?.rollNumber, '| Inst:', a.student.Institution?.code);
    console.log('  Status:', a.status, '| Phase:', a.internshipPhase);
    console.log('  Start:', a.startDate?.toISOString().split('T')[0], '| End:', a.endDate?.toISOString().split('T')[0]);
    console.log('  ---');
  });

  console.log('\n==========================================================');
  console.log('  DETAILED DISCREPANCY AUDIT COMPLETE');
  console.log('==========================================================');
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
