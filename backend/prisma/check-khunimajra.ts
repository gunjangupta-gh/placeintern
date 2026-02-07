import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Use local database
const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres123@localhost:5432/cms_db',
  max: 5,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function checkKhunimajra() {
  // Find Khunimajra institution
  const institution = await prisma.institution.findFirst({
    where: {
      OR: [
        { name: { contains: 'khunimajra', mode: 'insensitive' } },
        { shortName: { contains: 'khunimajra', mode: 'insensitive' } },
        { code: { contains: 'khunimajra', mode: 'insensitive' } }
      ]
    }
  });

  if (!institution) {
    console.log('Institution not found. Searching for similar names...');
    const allInstitutions = await prisma.institution.findMany({
      select: { id: true, name: true, code: true, shortName: true }
    });
    console.log('Available institutions:');
    allInstitutions.forEach(i => console.log(`  - ${i.name} (${i.code})`));
    return;
  }

  console.log('='.repeat(60));
  console.log('INSTITUTION DETAILS');
  console.log('='.repeat(60));
  console.log('ID:', institution.id);
  console.log('Name:', institution.name);
  console.log('Code:', institution.code);
  console.log('');

  // Get students count
  const studentsCount = await prisma.student.count({
    where: { institutionId: institution.id }
  });

  const activeStudentsCount = await prisma.student.count({
    where: {
      institutionId: institution.id,
      user: { active: true }
    }
  });

  console.log('Total Students:', studentsCount);
  console.log('Active Students:', activeStudentsCount);

  // Get internship applications for this institution
  const applications = await prisma.internshipApplication.findMany({
    where: {
      student: { institutionId: institution.id }
    },
    include: {
      student: {
        include: {
          user: { select: { name: true, rollNumber: true, active: true, branchName: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log('Total Applications:', applications.length);
  console.log('');

  // Check for discrepancies
  console.log('='.repeat(60));
  console.log('STATUS BREAKDOWN');
  console.log('='.repeat(60));

  const statusCounts: Record<string, number> = {};
  const phaseCounts: Record<string, number> = {};

  applications.forEach(app => {
    statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    phaseCounts[app.internshipPhase] = (phaseCounts[app.internshipPhase] || 0) + 1;
  });

  console.log('By Application Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log('');
  console.log('By Internship Phase:');
  Object.entries(phaseCounts).forEach(([phase, count]) => {
    console.log(`  ${phase}: ${count}`);
  });
  console.log('');

  // Check for potential issues
  console.log('='.repeat(60));
  console.log('POTENTIAL DISCREPANCIES');
  console.log('='.repeat(60));

  // 1. Applications with JOINED/APPROVED status but NOT_STARTED phase
  const mismatch1 = applications.filter(a =>
    ['JOINED', 'APPROVED', 'SELECTED'].includes(a.status) && a.internshipPhase === 'NOT_STARTED'
  );
  console.log(`\n1. Status JOINED/APPROVED/SELECTED but Phase NOT_STARTED: ${mismatch1.length}`);
  if (mismatch1.length > 0) {
    mismatch1.slice(0, 5).forEach(a => {
      console.log(`   - ${a.student.user?.name} (${a.student.user?.rollNumber})`);
      console.log(`     Status: ${a.status}, Phase: ${a.internshipPhase}`);
      console.log(`     Company: ${a.companyName || 'N/A'}`);
    });
    if (mismatch1.length > 5) console.log(`   ... and ${mismatch1.length - 5} more`);
  }

  // 2. Applications with COMPLETED status but not COMPLETED phase
  const mismatch2 = applications.filter(a =>
    a.status === 'COMPLETED' && a.internshipPhase !== 'COMPLETED'
  );
  console.log(`\n2. Status COMPLETED but Phase not COMPLETED: ${mismatch2.length}`);
  if (mismatch2.length > 0) {
    mismatch2.slice(0, 5).forEach(a => {
      console.log(`   - ${a.student.user?.name} (${a.student.user?.rollNumber})`);
      console.log(`     Status: ${a.status}, Phase: ${a.internshipPhase}`);
    });
  }

  // 3. Applications without start/end dates but in ACTIVE phase
  const mismatch3 = applications.filter(a =>
    a.internshipPhase === 'ACTIVE' && (!a.startDate || !a.endDate)
  );
  console.log(`\n3. Phase ACTIVE but missing start/end dates: ${mismatch3.length}`);
  if (mismatch3.length > 0) {
    mismatch3.slice(0, 5).forEach(a => {
      console.log(`   - ${a.student.user?.name} (${a.student.user?.rollNumber})`);
      console.log(`     Start: ${a.startDate || 'MISSING'}, End: ${a.endDate || 'MISSING'}`);
    });
  }

  // 4. Inactive users with active applications
  const mismatch4 = applications.filter(a =>
    a.isActive && a.student.user?.active === false
  );
  console.log(`\n4. Active applications for inactive users: ${mismatch4.length}`);
  if (mismatch4.length > 0) {
    mismatch4.slice(0, 5).forEach(a => {
      console.log(`   - ${a.student.user?.name} (${a.student.user?.rollNumber})`);
      console.log(`     User Active: ${a.student.user?.active}, App Active: ${a.isActive}`);
    });
  }

  // 5. Duplicate applications per student
  const studentAppCounts: Record<string, number> = {};
  applications.forEach(a => {
    studentAppCounts[a.studentId] = (studentAppCounts[a.studentId] || 0) + 1;
  });
  const duplicates = Object.entries(studentAppCounts).filter(([_, count]) => count > 1);
  console.log(`\n5. Students with multiple applications: ${duplicates.length}`);
  if (duplicates.length > 0) {
    for (const [studentId, count] of duplicates.slice(0, 5)) {
      const apps = applications.filter(a => a.studentId === studentId);
      const student = apps[0].student;
      console.log(`   - ${student.user?.name} (${student.user?.rollNumber}): ${count} applications`);
      apps.forEach(a => {
        console.log(`     * Status: ${a.status}, Phase: ${a.internshipPhase}, Company: ${a.companyName || 'N/A'}`);
      });
    }
    if (duplicates.length > 5) console.log(`   ... and ${duplicates.length - 5} more students with duplicates`);
  }

  // 6. Self-identified without company name
  const mismatch5 = applications.filter(a =>
    a.isSelfIdentified && !a.companyName
  );
  console.log(`\n6. Self-identified internships without company name: ${mismatch5.length}`);

  // 7. Applications with joiningDate but phase is NOT_STARTED
  const mismatch6 = applications.filter(a =>
    a.joiningDate && a.internshipPhase === 'NOT_STARTED'
  );
  console.log(`\n7. Has joining date but Phase is NOT_STARTED: ${mismatch6.length}`);
  if (mismatch6.length > 0) {
    mismatch6.slice(0, 5).forEach(a => {
      console.log(`   - ${a.student.user?.name} (${a.student.user?.rollNumber})`);
      console.log(`     Joining Date: ${a.joiningDate}, Phase: ${a.internshipPhase}`);
    });
  }

  // 8. Students without any internship application
  const studentsWithApps = new Set(applications.map(a => a.studentId));
  const studentsWithoutApps = await prisma.student.count({
    where: {
      institutionId: institution.id,
      id: { notIn: Array.from(studentsWithApps) }
    }
  });
  console.log(`\n8. Students without any internship application: ${studentsWithoutApps}`);

  console.log('');
  console.log('='.repeat(60));
  console.log('CHECK COMPLETE');
  console.log('='.repeat(60));

  await prisma.$disconnect();
  await pool.end();
}

checkKhunimajra().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
