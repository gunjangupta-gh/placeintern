/**
 * Student Internship Issues Report
 * Lists students without internships and those with incomplete/wrong internship details
 * Run with: npx tsx prisma/migrations/audit-students-internship-issues.ts
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('==========================================================');
  console.log('  STUDENT INTERNSHIP ISSUES REPORT');
  console.log('  Generated:', new Date().toISOString());
  console.log('==========================================================\n');

  // ============================================================
  // 1. STUDENTS WITHOUT ANY INTERNSHIP
  // ============================================================
  console.log('============================================================');
  console.log('1. STUDENTS WITHOUT ANY INTERNSHIP');
  console.log('============================================================');

  const studentsWithoutInternship = await prisma.student.findMany({
    where: {
      user: { active: true },
      Institution: { isActive: true },
      internshipApplications: { none: {} },
    },
    select: {
      id: true,
      admissionNumber: true,
      currentYear: true,
      currentSemester: true,
      user: {
        select: {
          name: true,
          rollNumber: true,
          email: true,
          phoneNo: true,
          branchName: true,
        },
      },
      Institution: {
        select: {
          code: true,
          name: true,
        },
      },
      branch: {
        select: {
          name: true,
          shortName: true,
        },
      },
      batch: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { Institution: { code: 'asc' } },
      { user: { rollNumber: 'asc' } },
    ],
  });

  console.log('\nTotal Count:', studentsWithoutInternship.length);
  console.log('\n--- DETAILED LIST ---\n');

  console.log('S.No | Institute | Roll Number | Name | Branch | Batch | Year | Semester | Email | Phone');
  console.log('-'.repeat(150));

  studentsWithoutInternship.forEach((s, index) => {
    console.log(
      `${(index + 1).toString().padStart(4)} | ` +
      `${(s.Institution?.code || 'N/A').padEnd(12)} | ` +
      `${(s.user?.rollNumber || 'N/A').padEnd(15)} | ` +
      `${(s.user?.name || 'N/A').padEnd(25)} | ` +
      `${(s.branch?.shortName || s.user?.branchName || 'N/A').padEnd(10)} | ` +
      `${(s.batch?.name || 'N/A').padEnd(8)} | ` +
      `${(s.currentYear?.toString() || 'N/A').padEnd(4)} | ` +
      `${(s.currentSemester?.toString() || 'N/A').padEnd(8)} | ` +
      `${(s.user?.email || 'N/A').padEnd(30)} | ` +
      `${s.user?.phoneNo || 'N/A'}`
    );
  });

  // Summary by institution
  console.log('\n--- SUMMARY BY INSTITUTION ---\n');
  const withoutInternshipByInst: Record<string, number> = {};
  studentsWithoutInternship.forEach(s => {
    const inst = s.Institution?.code || 'Unknown';
    withoutInternshipByInst[inst] = (withoutInternshipByInst[inst] || 0) + 1;
  });
  Object.entries(withoutInternshipByInst)
    .sort((a, b) => b[1] - a[1])
    .forEach(([inst, count]) => {
      console.log(`  ${inst}: ${count} students`);
    });

  // ============================================================
  // 2. STUDENTS WITH INCOMPLETE/WRONG INTERNSHIP DETAILS
  // ============================================================
  console.log('\n\n============================================================');
  console.log('2. STUDENTS WITH INCOMPLETE/WRONG INTERNSHIP DETAILS');
  console.log('============================================================');

  const internshipsWithIssues = await prisma.internshipApplication.findMany({
    where: {
      isActive: true,
      isSelfIdentified: true,
      student: {
        user: { active: true },
        Institution: { isActive: true },
      },
    },
    select: {
      id: true,
      status: true,
      internshipPhase: true,
      companyName: true,
      companyAddress: true,
      companyContact: true,
      companyEmail: true,
      hrName: true,
      hrContact: true,
      hrEmail: true,
      startDate: true,
      endDate: true,
      joiningLetterUrl: true,
      internshipDuration: true,
      jobProfile: true,
      student: {
        select: {
          id: true,
          admissionNumber: true,
          currentYear: true,
          currentSemester: true,
          user: {
            select: {
              name: true,
              rollNumber: true,
              email: true,
              phoneNo: true,
              branchName: true,
            },
          },
          Institution: {
            select: {
              code: true,
              name: true,
            },
          },
          branch: {
            select: {
              name: true,
              shortName: true,
            },
          },
          batch: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { student: { Institution: { code: 'asc' } } },
      { student: { user: { rollNumber: 'asc' } } },
    ],
  });

  // Check for various issues
  const issues: Array<{
    internship: typeof internshipsWithIssues[0];
    problems: string[];
  }> = [];

  internshipsWithIssues.forEach(app => {
    const problems: string[] = [];

    // Check for missing/invalid data
    if (!app.companyName || app.companyName.trim() === '') {
      problems.push('Missing company name');
    }
    if (!app.companyAddress || app.companyAddress.trim() === '') {
      problems.push('Missing company address');
    }
    if (!app.companyContact || app.companyContact.trim() === '') {
      problems.push('Missing company contact');
    }
    if (!app.companyEmail || app.companyEmail.trim() === '') {
      problems.push('Missing company email');
    }
    if (!app.hrName || app.hrName.trim() === '') {
      problems.push('Missing HR name');
    }
    if (!app.hrContact || app.hrContact.trim() === '') {
      problems.push('Missing HR contact');
    }
    if (!app.startDate) {
      problems.push('Missing start date');
    }
    if (!app.endDate) {
      problems.push('Missing end date');
    }
    if (!app.joiningLetterUrl || app.joiningLetterUrl.trim() === '') {
      problems.push('Missing joining letter');
    }
    if (!app.jobProfile || app.jobProfile.trim() === '') {
      problems.push('Missing job profile');
    }

    // Check for invalid dates
    if (app.startDate && app.endDate && app.endDate < app.startDate) {
      problems.push('End date is before start date');
    }

    // Check for suspiciously short duration (less than 1 week)
    if (app.startDate && app.endDate) {
      const durationDays = Math.floor((app.endDate.getTime() - app.startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (durationDays < 7) {
        problems.push(`Suspicious duration: ${durationDays} days`);
      }
    }

    // Check for placeholder/dummy data
    const dummyPatterns = ['test', 'dummy', 'abc', 'xyz', '123', 'asdf', 'qwerty', 'na', 'n/a', 'nil', 'none', '-', '.'];
    const checkDummy = (value: string | null | undefined) => {
      if (!value) return false;
      const lower = value.toLowerCase().trim();
      return dummyPatterns.some(p => lower === p || lower.includes('test'));
    };

    if (checkDummy(app.companyName)) {
      problems.push('Company name looks like dummy data');
    }
    if (checkDummy(app.hrName)) {
      problems.push('HR name looks like dummy data');
    }

    // Check for invalid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (app.companyEmail && !emailRegex.test(app.companyEmail)) {
      problems.push('Invalid company email format');
    }
    if (app.hrEmail && !emailRegex.test(app.hrEmail)) {
      problems.push('Invalid HR email format');
    }

    // Check for invalid phone format (should have at least 10 digits)
    const phoneRegex = /\d{10,}/;
    if (app.companyContact && !phoneRegex.test(app.companyContact.replace(/\D/g, ''))) {
      problems.push('Invalid company contact number');
    }
    if (app.hrContact && !phoneRegex.test(app.hrContact.replace(/\D/g, ''))) {
      problems.push('Invalid HR contact number');
    }

    if (problems.length > 0) {
      issues.push({ internship: app, problems });
    }
  });

  console.log('\nTotal Internships with Issues:', issues.length);
  console.log('Total Internships Checked:', internshipsWithIssues.length);
  console.log('\n--- DETAILED LIST ---\n');

  issues.forEach((issue, index) => {
    const app = issue.internship;
    const s = app.student;
    console.log(`${index + 1}. ${s.Institution?.code || 'N/A'} | ${s.user?.rollNumber || 'N/A'} | ${s.user?.name || 'N/A'}`);
    console.log(`   Branch: ${s.branch?.shortName || s.user?.branchName || 'N/A'} | Batch: ${s.batch?.name || 'N/A'} | Year: ${s.currentYear || 'N/A'}`);
    console.log(`   Company: ${app.companyName || 'NULL'}`);
    console.log(`   Company Contact: ${app.companyContact || 'NULL'} | Email: ${app.companyEmail || 'NULL'}`);
    console.log(`   HR: ${app.hrName || 'NULL'} | Contact: ${app.hrContact || 'NULL'}`);
    console.log(`   Start: ${app.startDate?.toISOString().split('T')[0] || 'NULL'} | End: ${app.endDate?.toISOString().split('T')[0] || 'NULL'}`);
    console.log(`   Joining Letter: ${app.joiningLetterUrl ? 'Yes' : 'NO'} | Job Profile: ${app.jobProfile || 'NULL'}`);
    console.log(`   Status: ${app.status} | Phase: ${app.internshipPhase}`);
    console.log(`   ISSUES: ${issue.problems.join(', ')}`);
    console.log('   ---');
  });

  // Summary by issue type
  console.log('\n--- SUMMARY BY ISSUE TYPE ---\n');
  const issueCounts: Record<string, number> = {};
  issues.forEach(issue => {
    issue.problems.forEach(p => {
      issueCounts[p] = (issueCounts[p] || 0) + 1;
    });
  });
  Object.entries(issueCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count}`);
    });

  // Summary by institution
  console.log('\n--- ISSUES BY INSTITUTION ---\n');
  const issuesByInst: Record<string, number> = {};
  issues.forEach(issue => {
    const inst = issue.internship.student.Institution?.code || 'Unknown';
    issuesByInst[inst] = (issuesByInst[inst] || 0) + 1;
  });
  Object.entries(issuesByInst)
    .sort((a, b) => b[1] - a[1])
    .forEach(([inst, count]) => {
      console.log(`  ${inst}: ${count} students with issues`);
    });

  // ============================================================
  // 3. COMBINED SUMMARY
  // ============================================================
  console.log('\n\n============================================================');
  console.log('3. COMBINED SUMMARY BY INSTITUTION');
  console.log('============================================================\n');

  const institutions = await prisma.institution.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  console.log('Institute | Total Students | Without Internship | With Issues | OK');
  console.log('-'.repeat(90));

  for (const inst of institutions) {
    const totalStudents = await prisma.student.count({
      where: { institutionId: inst.id, user: { active: true } },
    });

    const withoutInternship = studentsWithoutInternship.filter(
      s => s.Institution?.code === inst.code
    ).length;

    const withIssues = issues.filter(
      i => i.internship.student.Institution?.code === inst.code
    ).length;

    const ok = totalStudents - withoutInternship - withIssues;

    console.log(
      `${(inst.code || 'N/A').padEnd(12)} | ` +
      `${totalStudents.toString().padStart(14)} | ` +
      `${withoutInternship.toString().padStart(18)} | ` +
      `${withIssues.toString().padStart(11)} | ` +
      `${ok.toString().padStart(5)}`
    );
  }

  console.log('\n==========================================================');
  console.log('  REPORT COMPLETE');
  console.log('==========================================================');
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
