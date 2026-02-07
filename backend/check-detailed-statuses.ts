import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('\n=== DETAILED REPORT AND VISIT ANALYSIS ===\n');
  
  const totalInternships = await prisma.internshipApplication.count({
    where: { isActive: true, status: 'APPROVED' },
  });
  console.log(`Total Active Approved Internships: ${totalInternships}`);
  
  const totalReports = await prisma.monthlyReport.count({
    where: { isDeleted: false },
  });
  console.log(`Total Non-Deleted Reports: ${totalReports}`);
  
  const totalVisits = await prisma.facultyVisitLog.count();
  console.log(`Total Visits: ${totalVisits}`);
  
  console.log('\n=== REPORT STATUS BREAKDOWN ===');
  const reportStatuses = await prisma.monthlyReport.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { isDeleted: false },
  });
  reportStatuses.forEach(r => console.log(`  ${r.status}: ${r._count.id}`));
  
  console.log('\n=== VISIT STATUS BREAKDOWN ===');
  const visitStatuses = await prisma.facultyVisitLog.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  visitStatuses.forEach(v => console.log(`  ${v.status}: ${v._count.id}`));
  
  // Check if reports/visits are actually linked to internships
  const reportsWithInternships = await prisma.monthlyReport.count({
    where: {
      isDeleted: false,
      application: { isActive: true },
    },
  });
  console.log(`\nReports Linked to Active Internships: ${reportsWithInternships}`);
  
  const visitsWithInternships = await prisma.facultyVisitLog.count({
    where: {
      application: { isActive: true },
    },
  });
  console.log(`Visits Linked to Active Internships: ${visitsWithInternships}`);
  
  await pool.end();
}

main().catch(console.error);
