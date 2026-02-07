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
  console.log('\n=== REPORT STATUSES ===');
  const reportStatuses = await prisma.monthlyReport.groupBy({
    by: ['status'],
    _count: { id: true },
    where: { isDeleted: false },
  });
  reportStatuses.forEach(r => console.log(`${r.status}: ${r._count.id} reports`));
  
  console.log('\n=== VISIT STATUSES ===');
  const visitStatuses = await prisma.facultyVisitLog.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  visitStatuses.forEach(v => console.log(`${v.status}: ${v._count.id} visits`));
  
  await pool.end();
}

main().catch(console.error);
