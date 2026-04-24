import { PrismaClient, ScholarshipCategory } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const SCHOLARSHIPS: Array<{
  code: string;
  name: string;
  category: ScholarshipCategory;
  cmsPercent: number | null;
}> = [
  {
    code: 'FWS',
    name: 'Fee Waiver Scholarship',
    category: ScholarshipCategory.FWS,
    cmsPercent: null,
  },
  {
    code: 'PMS',
    name: 'Post Matric Scholarship',
    category: ScholarshipCategory.PMS,
    cmsPercent: null,
  },
  {
    code: 'CMS50',
    name: 'Chief Minister Scholarship 50%',
    category: ScholarshipCategory.CMS,
    cmsPercent: 50,
  },
  {
    code: 'CMS60',
    name: 'Chief Minister Scholarship 60%',
    category: ScholarshipCategory.CMS,
    cmsPercent: 60,
  },
  {
    code: 'CMS70',
    name: 'Chief Minister Scholarship 70%',
    category: ScholarshipCategory.CMS,
    cmsPercent: 70,
  },
  {
    code: 'CMS80',
    name: 'Chief Minister Scholarship 80%',
    category: ScholarshipCategory.CMS,
    cmsPercent: 80,
  },
  {
    code: 'CMS90',
    name: 'Chief Minister Scholarship 90%',
    category: ScholarshipCategory.CMS,
    cmsPercent: 90,
  },
];

async function main() {
  console.log('Starting scholarship seed...');

  let created = 0;
  let updated = 0;

  for (const scholarship of SCHOLARSHIPS) {
    const existing = await prisma.scholarship.findUnique({
      where: { code: scholarship.code },
      select: { id: true },
    });

    if (!existing) {
      await prisma.scholarship.create({
        data: scholarship,
      });
      created++;
      console.log(`Created scholarship: ${scholarship.code}`);
      continue;
    }

    await prisma.scholarship.update({
      where: { code: scholarship.code },
      data: scholarship,
    });
    updated++;
    console.log(`Updated scholarship: ${scholarship.code}`);
  }

  console.log('\nScholarship seed complete.');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Total configured: ${SCHOLARSHIPS.length}`);
}

main()
  .catch((error) => {
    console.error('Scholarship seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
