/**
 * Fix Email Conflicts Script
 * Fixes the 3 students that had duplicate email conflicts during migration
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres123@localhost:5432/cms_db?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

interface StudentFix {
  rollNumber: string;
  name: string;
  email: string;
  contact: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  parentName: string;
  parentContact: string;
  gender: string;
  category: string;
  currentYear: number;
  currentSemester: number;
  isActive: boolean;
}

const studentsToFix: StudentFix[] = [
  {
    rollNumber: '230226102539',
    name: 'SAVITA RANI',
    email: 'preeti3112002@gmail.com',
    contact: '7009248975',
    dob: '2006-01-31',
    address: 'Hoshiarpur',
    city: 'Hoshiarpur',
    state: 'Punjab',
    pinCode: '146001',
    parentName: 'BHOLE SAHNI',
    parentContact: '7340809379',
    gender: 'Female',
    category: 'GENERAL',
    currentYear: 3,
    currentSemester: 5,
    isActive: true,
  },
  {
    rollNumber: '231585307158',
    name: 'LOVEPREET SINGH',
    email: 'gsingh71100@gmail.com',
    contact: '7658846167',
    dob: '2005-05-13',
    address: 'Dhanaula',
    city: 'Dhanula',
    state: 'Punjab',
    pinCode: '141801',
    parentName: 'Baljeet singh',
    parentContact: '7986393012',
    gender: 'Male',
    category: 'SC',
    currentYear: 2,
    currentSemester: 3,
    isActive: false,
  },
  {
    rollNumber: '231939508283',
    name: 'Simranjeet Kaur',
    email: 'navkiran11111111@gmail.com',
    contact: '81468 51820',
    dob: '2005-08-08',
    address: 'Nanak nagar karabara',
    city: 'City',
    state: 'Punjab',
    pinCode: '141001',
    parentName: 'Harjeet singh',
    parentContact: '81468 51820',
    gender: 'Female',
    category: 'SC',
    currentYear: 3,
    currentSemester: 5,
    isActive: true,
  },
];

async function main() {
  console.log('=== Fixing Email Conflicts ===\n');

  for (const studentData of studentsToFix) {
    console.log(`\nProcessing: ${studentData.name} (${studentData.rollNumber})`);

    // Find the user by rollNumber
    const user = await prisma.user.findFirst({
      where: { rollNumber: studentData.rollNumber },
    });

    if (!user) {
      console.log(`  ❌ User not found for rollNumber: ${studentData.rollNumber}`);
      continue;
    }

    console.log(`  Found User ID: ${user.id}, Current Email: ${user.email}`);

    // Find the student record
    const student = await prisma.student.findFirst({
      where: { userId: user.id },
    });

    // Check if the target email is already used by another user
    const existingUserWithEmail = await prisma.user.findFirst({
      where: {
        email: studentData.email,
        id: { not: user.id }
      },
      select: { id: true, name: true, rollNumber: true, role: true }
    });

    if (existingUserWithEmail) {
      console.log(`  ⚠️ Email ${studentData.email} is used by another user:`);
      console.log(`     User ID: ${existingUserWithEmail.id}`);
      console.log(`     Name: ${existingUserWithEmail.name}`);
      console.log(`     Roll: ${existingUserWithEmail.rollNumber}`);
      console.log(`     Role: ${existingUserWithEmail.role}`);

      // Check if the other user is a duplicate student
      if (existingUserWithEmail.role === 'STUDENT') {
        // Generate a unique email for the conflicting user to free up the email
        const conflictEmail = `duplicate_${existingUserWithEmail.id.slice(0, 8)}@removed.local`;
        console.log(`  🔄 Updating conflicting user's email to: ${conflictEmail}`);

        await prisma.user.update({
          where: { id: existingUserWithEmail.id },
          data: {
            email: conflictEmail,
            active: false // Deactivate duplicate
          }
        });
      }
    }

    // Now update the correct user with the proper email and data
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email: studentData.email,
          name: studentData.name,
          phoneNo: studentData.contact,
          dob: studentData.dob,
          active: studentData.isActive,
        },
      });
      console.log(`  ✅ User updated with email: ${studentData.email}`);

      // Update student record too
      if (student) {
        await prisma.student.update({
          where: { id: student.id },
          data: {
            address: studentData.address,
            city: studentData.city,
            state: studentData.state,
            pinCode: studentData.pinCode,
            parentName: studentData.parentName,
            parentContact: studentData.parentContact,
            gender: studentData.gender,
            category: studentData.category as any,
            currentYear: studentData.currentYear,
            currentSemester: studentData.currentSemester,
          },
        });
        console.log(`  ✅ Student record updated`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error updating: ${error.message}`);
    }
  }

  // Final summary
  console.log('\n=== Summary ===');
  for (const studentData of studentsToFix) {
    const user = await prisma.user.findFirst({
      where: { rollNumber: studentData.rollNumber },
      select: { id: true, name: true, email: true, rollNumber: true, active: true }
    });
    console.log(`${studentData.rollNumber}: ${user?.email} (active: ${user?.active})`);
  }
}

main()
  .then(async () => {
    console.log('\n✅ Fix completed!');
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error('Error:', error);
    await prisma.$disconnect();
    await pool.end();
  });
