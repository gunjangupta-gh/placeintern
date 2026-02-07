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

/**
 * Seed Master Data - Creates global departments and branches
 * Branches: CSE, EE, ECE, ME, CE (Civil), LT (Leather Technology)
 */

const GLOBAL_BRANCHES = [
  { name: 'Computer Science & Engineering', shortName: 'CSE', code: 'CSE', duration: 3 },
  { name: 'Electrical Engineering', shortName: 'EE', code: 'EE', duration: 3 },
  { name: 'Electronics & Communication Engineering', shortName: 'ECE', code: 'ECE', duration: 3 },
  { name: 'Mechanical Engineering', shortName: 'ME', code: 'ME', duration: 3 },
  { name: 'Civil Engineering', shortName: 'CE', code: 'CE', duration: 3 },
  { name: 'Leather Technology', shortName: 'LT', code: 'LT', duration: 3 },
];

const GLOBAL_DEPARTMENTS = [
  { name: 'Computer Science & Engineering', shortName: 'CSE', code: 'DEPT-CSE' },
  { name: 'Electrical Engineering', shortName: 'EE', code: 'DEPT-EE' },
  { name: 'Electronics & Communication Engineering', shortName: 'ECE', code: 'DEPT-ECE' },
  { name: 'Mechanical Engineering', shortName: 'ME', code: 'DEPT-ME' },
  { name: 'Civil Engineering', shortName: 'CE', code: 'DEPT-CE' },
  { name: 'Leather Technology', shortName: 'LT', code: 'DEPT-LT' },
];

const GLOBAL_BATCHES = [
  { name: '2021-2024' },
  { name: '2022-2025' },
  { name: '2023-2026' },
  { name: '2024-2027' },
];

async function main() {
  console.log('🌱 Starting Master Data Seed...\n');

  // 1. Create Global Batches
  console.log('📅 Creating Global Batches...');
  for (const batchData of GLOBAL_BATCHES) {
    const existing = await prisma.batch.findFirst({
      where: { name: batchData.name },
    });

    if (!existing) {
      await prisma.batch.create({
        data: {
          name: batchData.name,
          isActive: true,
        },
      });
      console.log(`  ✅ Created batch: ${batchData.name}`);
    } else {
      console.log(`  ⏭️  Batch already exists: ${batchData.name}`);
    }
  }

  // 2. Create Global Departments
  console.log('\n🏛️ Creating Global Departments...');
  const departmentMap: Record<string, string> = {};

  for (const deptData of GLOBAL_DEPARTMENTS) {
    const existing = await prisma.department.findFirst({
      where: { code: deptData.code },
    });

    if (!existing) {
      const dept = await prisma.department.create({
        data: {
          name: deptData.name,
          shortName: deptData.shortName,
          code: deptData.code,
          isActive: true,
        },
      });
      departmentMap[deptData.shortName] = dept.id;
      console.log(`  ✅ Created department: ${deptData.name} (${deptData.shortName})`);
    } else {
      departmentMap[deptData.shortName] = existing.id;
      console.log(`  ⏭️  Department already exists: ${deptData.name}`);
    }
  }

  // 3. Create Global Branches
  console.log('\n🌿 Creating Global Branches...');
  const branchMap: Record<string, string> = {};

  for (const branchData of GLOBAL_BRANCHES) {
    const existing = await prisma.branch.findFirst({
      where: { code: branchData.code },
    });

    if (!existing) {
      const branch = await prisma.branch.create({
        data: {
          name: branchData.name,
          shortName: branchData.shortName,
          code: branchData.code,
          duration: branchData.duration,
          isActive: true,
        },
      });
      branchMap[branchData.shortName] = branch.id;
      console.log(`  ✅ Created branch: ${branchData.name} (${branchData.shortName})`);
    } else {
      branchMap[branchData.shortName] = existing.id;
      console.log(`  ⏭️  Branch already exists: ${branchData.name}`);
    }
  }

  // 4. Update Students with Global Branches
  console.log('\n👥 Updating Students with Global Branches...');

  // Get all students
  const students = await prisma.student.findMany({
    select: { id: true, branchName: true, branchId: true },
  });

  let updatedCount = 0;
  for (const student of students) {
    // Try to match by branchName first
    let matchedBranchId: string | null = null;

    if (student.branchName) {
      // Extract short name from branchName
      const branchNameUpper = student.branchName.toUpperCase();

      if (branchNameUpper.includes('COMPUTER') || branchNameUpper.includes('CSE')) {
        matchedBranchId = branchMap['CSE'];
      } else if (branchNameUpper.includes('ELECTRICAL') && !branchNameUpper.includes('ELECTRONICS')) {
        matchedBranchId = branchMap['EE'];
      } else if (branchNameUpper.includes('ELECTRONICS') || branchNameUpper.includes('ECE')) {
        matchedBranchId = branchMap['ECE'];
      } else if (branchNameUpper.includes('MECHANICAL') || branchNameUpper.includes('ME')) {
        matchedBranchId = branchMap['ME'];
      } else if (branchNameUpper.includes('CIVIL') || branchNameUpper.includes('CE')) {
        matchedBranchId = branchMap['CE'];
      } else if (branchNameUpper.includes('LEATHER') || branchNameUpper.includes('LT')) {
        matchedBranchId = branchMap['LT'];
      } else if (branchNameUpper.includes('IT') || branchNameUpper.includes('INFORMATION')) {
        // Map IT to CSE
        matchedBranchId = branchMap['CSE'];
      }
    }

    if (matchedBranchId) {
      await prisma.student.update({
        where: { id: student.id },
        data: { branchId: matchedBranchId },
      });
      updatedCount++;
    }
  }
  console.log(`  ✅ Updated ${updatedCount} students with global branches`);

  // 5. Update Users with Global Branch Names
  console.log('\n👤 Updating Users with Branch Names...');

  const users = await prisma.user.findMany({
    where: { branchName: { not: null } },
    select: { id: true, branchName: true },
  });

  let userUpdatedCount = 0;
  for (const user of users) {
    if (user.branchName) {
      const branchNameUpper = user.branchName.toUpperCase();
      let newBranchName: string | null = null;

      if (branchNameUpper.includes('IT') || branchNameUpper === 'IT') {
        newBranchName = 'CSE'; // Map IT to CSE
      }

      if (newBranchName) {
        await prisma.user.update({
          where: { id: user.id },
          data: { branchName: newBranchName },
        });
        userUpdatedCount++;
      }
    }
  }
  console.log(`  ✅ Updated ${userUpdatedCount} users with standardized branch names`);

  // 6. Summary
  console.log('\n🎉 Master Data Seed Complete!');
  console.log(`
  Summary:
  - Batches: ${GLOBAL_BATCHES.length}
  - Departments: ${GLOBAL_DEPARTMENTS.length}
  - Branches: ${GLOBAL_BRANCHES.length}
  - Students Updated: ${updatedCount}
  - Users Updated: ${userUpdatedCount}

  Global Branches:
  - CSE: Computer Science & Engineering
  - EE: Electrical Engineering
  - ECE: Electronics & Communication Engineering
  - ME: Mechanical Engineering
  - CE: Civil Engineering
  - LT: Leather Technology
  `);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
