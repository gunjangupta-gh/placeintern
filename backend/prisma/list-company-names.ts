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

const args = process.argv.slice(2);
const containsIndex = args.findIndex(arg => arg === '--contains');
const exactIndex = args.findIndex(arg => arg === '--exact');
const limitIndex = args.findIndex(arg => arg === '--limit');

const contains = containsIndex !== -1 ? (args[containsIndex + 1] || '').toLowerCase() : null;
const exact = exactIndex !== -1 ? (args[exactIndex + 1] || '').toLowerCase() : null;
const limit = limitIndex !== -1 ? Number(args[limitIndex + 1]) || null : null;

async function main() {
  console.log('\n============================================================');
  console.log('Company Names Listing Script');
  console.log('============================================================\n');

  if (contains) {
    console.log(`Filter: contains "${contains}"\n`);
  }

  if (exact) {
    console.log(`Filter: exact "${exact}"\n`);
  }

  const companyCounts = await prisma.internshipApplication.groupBy({
    by: ['companyName'],
    where: {
      isSelfIdentified: true,
      companyName: { not: null },
    },
    _count: true,
  });

  let results = companyCounts
    .map(entry => ({
      name: entry.companyName as string,
      count: entry._count,
    }))
    .sort((a, b) => b.count - a.count);

  if (contains) {
    results = results.filter(item => item.name.toLowerCase().includes(contains));
  }

  if (exact) {
    results = results.filter(item => item.name.toLowerCase() === exact);
  }

  if (limit) {
    results = results.slice(0, limit);
  }

  console.log(`Unique company names: ${results.length}\n`);

  results.forEach((item, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. ${item.name} (${item.count})`);
  });

  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
