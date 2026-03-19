import { PrismaClient, Designation } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Mapping of existing designation strings to enum values
const DESIGNATION_MAPPING: Record<string, Designation> = {
  // Lecturer variations
  'lecturer': Designation.LECTURER,

  // Senior Lecturer variations
  'sr. lecturer': Designation.SENIOR_LECTURER,
  'sr.lecturer': Designation.SENIOR_LECTURER,
  'senior lecturer': Designation.SENIOR_LECTURER,
  'sen lecturer': Designation.SENIOR_LECTURER,

  // HOD variations
  'hod': Designation.HOD,

  // Principal variations
  'principal': Designation.PRINCIPAL,
  'now principal': Designation.PRINCIPAL,

  // Foreman Instructor variations
  'foreman instructor': Designation.FOREMAN_INSTRUCTOR,
  'forman instructor': Designation.FOREMAN_INSTRUCTOR,

  // Workshop roles
  'workshop instructor': Designation.WORKSHOP_INSTRUCTOR,
  'workshop superintendent': Designation.WORKSHOP_SUPERINTENDENT,
  'workshop foreman': Designation.WORKSHOP_FOREMAN,

  // Technician roles
  'lab technician': Designation.LAB_TECHNICIAN,
  'technician': Designation.TECHNICIAN,

  // IT roles
  'system analyst': Designation.SYSTEM_ANALYST,
  'system administrator': Designation.SYSTEM_ADMINISTRATOR,
  'system manager': Designation.SYSTEM_MANAGER,
  'programmer': Designation.PROGRAMMER,
  'network engineer': Designation.NETWORK_ENGINEER,
  'computer operator': Designation.COMPUTER_OPERATOR,

  // Other roles
  'instructor': Designation.INSTRUCTOR,
  'librarian': Designation.LIBRARIAN,
  'fashion designer': Designation.FASHION_DESIGNER,
  'senior fashion designer': Designation.FASHION_DESIGNER,
  'peon': Designation.PEON,
  'assistant prof (contractual basis)': Designation.ASSISTANT_PROFESSOR,
  'tpo': Designation.TPO,
};

function normalizeDesignation(designation: string | null): Designation | null {
  if (!designation) return null;

  const normalized = designation.trim().toLowerCase();

  // Check direct mapping
  if (DESIGNATION_MAPPING[normalized]) {
    return DESIGNATION_MAPPING[normalized];
  }

  // Check partial matches for common variations
  if (normalized.includes('lecturer') && (normalized.includes('sr') || normalized.includes('senior'))) {
    return Designation.SENIOR_LECTURER;
  }
  if (normalized.includes('lecturer')) {
    return Designation.LECTURER;
  }
  if (normalized.includes('hod') || normalized.includes('head of department')) {
    return Designation.HOD;
  }
  if (normalized.includes('principal')) {
    return Designation.PRINCIPAL;
  }
  if (normalized.includes('foreman') && normalized.includes('instructor')) {
    return Designation.FOREMAN_INSTRUCTOR;
  }
  if (normalized.includes('workshop') && normalized.includes('instructor')) {
    return Designation.WORKSHOP_INSTRUCTOR;
  }
  if (normalized.includes('workshop') && normalized.includes('superintendent')) {
    return Designation.WORKSHOP_SUPERINTENDENT;
  }
  if (normalized.includes('workshop') && normalized.includes('foreman')) {
    return Designation.WORKSHOP_FOREMAN;
  }
  if (normalized.includes('lab') && normalized.includes('technician')) {
    return Designation.LAB_TECHNICIAN;
  }
  if (normalized.includes('technician')) {
    return Designation.TECHNICIAN;
  }
  if (normalized.includes('system') && normalized.includes('analyst')) {
    return Designation.SYSTEM_ANALYST;
  }
  if (normalized.includes('system') && normalized.includes('admin')) {
    return Designation.SYSTEM_ADMINISTRATOR;
  }
  if (normalized.includes('system') && normalized.includes('manager')) {
    return Designation.SYSTEM_MANAGER;
  }
  if (normalized.includes('programmer')) {
    return Designation.PROGRAMMER;
  }
  if (normalized.includes('network') && normalized.includes('engineer')) {
    return Designation.NETWORK_ENGINEER;
  }
  if (normalized.includes('computer') && normalized.includes('operator')) {
    return Designation.COMPUTER_OPERATOR;
  }
  if (normalized.includes('librarian')) {
    return Designation.LIBRARIAN;
  }
  if (normalized.includes('fashion') && normalized.includes('designer')) {
    return Designation.FASHION_DESIGNER;
  }
  if (normalized.includes('instructor')) {
    return Designation.INSTRUCTOR;
  }
  if (normalized.includes('assistant') && normalized.includes('prof')) {
    return Designation.ASSISTANT_PROFESSOR;
  }
  if (normalized.includes('tpo') || normalized.includes('training') && normalized.includes('placement')) {
    return Designation.TPO;
  }
  if (normalized.includes('peon')) {
    return Designation.PEON;
  }

  // Everything else (garbage data like locations, courses, etc.) becomes OTHER
  return Designation.OTHER;
}

async function main() {
  console.log('=== Starting Designation Migration ===\n');

  // Get all users with designation (not null)
  const usersWithDesignation = await prisma.user.findMany({
    where: {
      designation: { not: null },
    },
    select: {
      id: true,
      designation: true,
      designationEnum: true,
    },
  });

  console.log(`Found ${usersWithDesignation.length} users with designation\n`);

  // Track statistics
  const stats: Record<string, number> = {};
  const mappingLog: { original: string; mapped: Designation }[] = [];
  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of usersWithDesignation) {
    // Skip if already has designationEnum
    if (user.designationEnum) {
      skippedCount++;
      continue;
    }

    const mappedDesignation = normalizeDesignation(user.designation);

    if (mappedDesignation) {
      await prisma.user.update({
        where: { id: user.id },
        data: { designationEnum: mappedDesignation },
      });

      updatedCount++;
      stats[mappedDesignation] = (stats[mappedDesignation] || 0) + 1;

      // Log first occurrence of each mapping for review
      const key = `${user.designation?.toLowerCase().trim()} -> ${mappedDesignation}`;
      if (!mappingLog.some(m => `${m.original.toLowerCase().trim()} -> ${m.mapped}` === key)) {
        mappingLog.push({ original: user.designation!, mapped: mappedDesignation });
      }
    }
  }

  console.log('=== Migration Statistics ===\n');
  console.log(`Total users processed: ${usersWithDesignation.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Skipped (already had enum): ${skippedCount}\n`);

  console.log('=== Designation Distribution ===\n');
  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [designation, count] of sortedStats) {
    console.log(`${designation}: ${count}`);
  }

  console.log('\n=== Sample Mappings (for review) ===\n');
  // Show some OTHER mappings for review
  const otherMappings = mappingLog.filter(m => m.mapped === Designation.OTHER).slice(0, 20);
  if (otherMappings.length > 0) {
    console.log('Mapped to OTHER:');
    otherMappings.forEach(m => console.log(`  "${m.original}" -> OTHER`));
  }

  console.log('\n=== Migration Complete ===');
}

main()
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
