import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient();

// Branch name mapping from full names to short forms
const branchMapping: Record<string, string> = {
  // Computer Science & Engineering
  'Computer Science Engineering': 'CSE',
  'Computer Science & Engineering': 'CSE',
  'Computer Science and Engineering': 'CSE',
  'Computer Science': 'CS',
  'Information Technology': 'IT',
  'Computer Engineering': 'CE',
  
  // Electronics & Electrical
  'Electronics and Communication Engineering': 'ECE',
  'Electronics & Communication Engineering': 'ECE',
  'Electronics Engineering': 'EE',
  'Electrical Engineering': 'EE',
  'Electrical and Electronics Engineering': 'EEE',
  'Electrical & Electronics Engineering': 'EEE',
  
  // Mechanical & Civil
  'Mechanical Engineering': 'ME',
  'Civil Engineering': 'CE',
  'Automobile Engineering': 'AE',
  'Production Engineering': 'PE',
  
  // Other branches
  'Chemical Engineering': 'CHE',
  'Biotechnology': 'BT',
  'Biomedical Engineering': 'BME',
  'Instrumentation Engineering': 'IE',
  'Instrumentation and Control Engineering': 'ICE',
  'Aerospace Engineering': 'AE',
  'Aeronautical Engineering': 'AE',
  
  // Diploma branches
  'Diploma in Computer Science': 'CSE',
  'Diploma in Mechanical Engineering': 'ME',
  'Diploma in Civil Engineering': 'CE',
  'Diploma in Electrical Engineering': 'EE',
  'Diploma in Electronics': 'ECE',
};

async function updateBranchNames() {
  console.log('🔄 Starting branch name update for students...\n');

  try {
    // Get all students with branchName
    const students = await prisma.student.findMany({
      where: {
        branchName: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        rollNumber: true,
        branchName: true,
        email: true,
      },
    });

    console.log(`📊 Found ${students.length} students with branch names\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    for (const student of students) {
      const currentBranch = student.branchName?.trim();
      
      if (!currentBranch) {
        skippedCount++;
        continue;
      }

      // Check if already in short form (2-4 uppercase letters)
      if (/^[A-Z]{2,4}$/.test(currentBranch)) {
        console.log(`⏩ Skipped: ${student.name} (${student.rollNumber}) - Already in short form: ${currentBranch}`);
        skippedCount++;
        continue;
      }

      // Find matching short form
      const shortForm = branchMapping[currentBranch];

      if (shortForm) {
        await prisma.student.update({
          where: { id: student.id },
          data: { branchName: shortForm },
        });
        console.log(`✅ Updated: ${student.name} (${student.rollNumber}) - ${currentBranch} → ${shortForm}`);
        updatedCount++;
      } else {
        console.log(`❌ Not found: ${student.name} (${student.rollNumber}) - No mapping for: "${currentBranch}"`);
        notFoundCount++;
      }
    }

    console.log('\n📈 Update Summary:');
    console.log(`   Total students checked: ${students.length}`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏩ Skipped (already short): ${skippedCount}`);
    console.log(`   ❌ Not found in mapping: ${notFoundCount}`);

    if (notFoundCount > 0) {
      console.log('\n⚠️  Some branch names were not found in the mapping.');
      console.log('   Please add them to the branchMapping object and run again.');
      
      // List unique unmapped branch names
      const unmappedBranches = students
        .filter(s => s.branchName && !branchMapping[s.branchName.trim()] && !/^[A-Z]{2,4}$/.test(s.branchName.trim()))
        .map(s => s.branchName?.trim())
        .filter((value, index, self) => self.indexOf(value) === index);
      
      if (unmappedBranches.length > 0) {
        console.log('\n   Unmapped branches:');
        unmappedBranches.forEach(branch => console.log(`   - "${branch}"`));
      }
    }

  } catch (error) {
    console.error('❌ Error updating branch names:', error);
    throw error;
  }
}

async function main() {
  try {
    await updateBranchNames();
    console.log('\n✅ Branch name update completed successfully!');
  } catch (error) {
    console.error('❌ Failed to update branch names:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
