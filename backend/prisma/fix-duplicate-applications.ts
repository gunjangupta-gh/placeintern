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

async function fixDuplicateApplications() {
  console.log('='.repeat(60));
  console.log('FIX DUPLICATE INTERNSHIP APPLICATIONS');
  console.log('='.repeat(60));
  console.log('');

  // Find all students with multiple applications
  const allApplications = await prisma.internshipApplication.findMany({
    include: {
      student: {
        include: {
          user: { select: { name: true, rollNumber: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Group by studentId
  const studentAppMap: Record<string, typeof allApplications> = {};
  allApplications.forEach(app => {
    if (!studentAppMap[app.studentId]) {
      studentAppMap[app.studentId] = [];
    }
    studentAppMap[app.studentId].push(app);
  });

  // Find duplicates
  const duplicates = Object.entries(studentAppMap).filter(([_, apps]) => apps.length > 1);

  if (duplicates.length === 0) {
    console.log('No duplicate applications found.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  console.log(`Found ${duplicates.length} students with duplicate applications:\n`);

  let totalDeleted = 0;

  for (const [studentId, apps] of duplicates) {
    const student = apps[0].student;
    console.log(`Student: ${student.user?.name} (${student.user?.rollNumber})`);
    console.log(`  Total applications: ${apps.length}`);

    // Keep the most recent application (first one since sorted by createdAt desc)
    const keepApp = apps[0];
    const deleteApps = apps.slice(1);

    console.log(`  Keeping: ID=${keepApp.id.slice(0, 8)}... Company=${keepApp.companyName}, Created=${keepApp.createdAt.toISOString().split('T')[0]}`);

    for (const app of deleteApps) {
      console.log(`  Deleting: ID=${app.id.slice(0, 8)}... Company=${app.companyName}, Created=${app.createdAt.toISOString().split('T')[0]}`);

      try {
        // Delete related records first (due to foreign key constraints)
        await prisma.monthlyReport.deleteMany({
          where: { applicationId: app.id }
        });

        await prisma.facultyVisitLog.deleteMany({
          where: { applicationId: app.id }
        });

        // Delete the duplicate application
        await prisma.internshipApplication.delete({
          where: { id: app.id }
        });

        totalDeleted++;
        console.log(`    ✓ Deleted successfully`);
      } catch (error: any) {
        console.log(`    ✗ Error: ${error.message}`);
      }
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`SUMMARY: Deleted ${totalDeleted} duplicate applications`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
  await pool.end();
}

fixDuplicateApplications().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
