/**
 * Export Student Internship Issues to CSV
 * Run with: npx tsx prisma/migrations/export-students-internship-issues-csv.ts
 */

import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Helper to escape CSV values
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const timestamp = new Date().toISOString().split('T')[0];
  const outputDir = path.join(__dirname, '../../exports');

  // Create exports directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating CSV exports...\n');

  // ============================================================
  // 1. STUDENTS WITHOUT ANY INTERNSHIP
  // ============================================================
  console.log('Fetching students without internship...');

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
      gender: true,
      parentName: true,
      parentContact: true,
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

  // Create CSV for students without internship
  const csv1Headers = [
    'S.No', 'Institute Code', 'Institute Name', 'Roll Number', 'Student Name',
    'Branch', 'Batch', 'Year', 'Semester', 'Gender', 'Email', 'Phone',
    'Parent Name', 'Parent Contact', 'Admission Number'
  ];

  const csv1Rows = studentsWithoutInternship.map((s, index) => [
    index + 1,
    escapeCSV(s.Institution?.code),
    escapeCSV(s.Institution?.name),
    escapeCSV(s.user?.rollNumber),
    escapeCSV(s.user?.name),
    escapeCSV(s.branch?.shortName || s.user?.branchName),
    escapeCSV(s.batch?.name),
    s.currentYear || '',
    s.currentSemester || '',
    escapeCSV(s.gender),
    escapeCSV(s.user?.email),
    escapeCSV(s.user?.phoneNo),
    escapeCSV(s.parentName),
    escapeCSV(s.parentContact),
    escapeCSV(s.admissionNumber),
  ].join(','));

  const csv1Content = [csv1Headers.join(','), ...csv1Rows].join('\n');
  const csv1Path = path.join(outputDir, `students-without-internship-${timestamp}.csv`);
  fs.writeFileSync(csv1Path, csv1Content, 'utf8');
  console.log(`✓ Exported ${studentsWithoutInternship.length} students without internship to:`);
  console.log(`  ${csv1Path}\n`);

  // ============================================================
  // 2. STUDENTS WITH INCOMPLETE/WRONG INTERNSHIP DETAILS
  // ============================================================
  console.log('Fetching internships with issues...');

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
          gender: true,
          parentName: true,
          parentContact: true,
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

    if (app.startDate && app.endDate && app.endDate < app.startDate) {
      problems.push('End date before start date');
    }

    if (app.startDate && app.endDate) {
      const durationDays = Math.floor((app.endDate.getTime() - app.startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (durationDays < 7) {
        problems.push(`Suspicious duration: ${durationDays} days`);
      }
    }

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (app.companyEmail && !emailRegex.test(app.companyEmail)) {
      problems.push('Invalid company email format');
    }
    if (app.hrEmail && !emailRegex.test(app.hrEmail)) {
      problems.push('Invalid HR email format');
    }

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

  // Create CSV for internships with issues
  const csv2Headers = [
    'S.No', 'Institute Code', 'Institute Name', 'Roll Number', 'Student Name',
    'Branch', 'Batch', 'Year', 'Semester', 'Gender', 'Student Email', 'Student Phone',
    'Parent Name', 'Parent Contact',
    'Company Name', 'Company Address', 'Company Contact', 'Company Email',
    'HR Name', 'HR Contact', 'HR Email',
    'Start Date', 'End Date', 'Duration', 'Job Profile',
    'Has Joining Letter', 'Status', 'Phase', 'Issues'
  ];

  const csv2Rows = issues.map((issue, index) => {
    const app = issue.internship;
    const s = app.student;
    const duration = app.startDate && app.endDate
      ? Math.floor((app.endDate.getTime() - app.startDate.getTime()) / (1000 * 60 * 60 * 24)) + ' days'
      : '';

    return [
      index + 1,
      escapeCSV(s.Institution?.code),
      escapeCSV(s.Institution?.name),
      escapeCSV(s.user?.rollNumber),
      escapeCSV(s.user?.name),
      escapeCSV(s.branch?.shortName || s.user?.branchName),
      escapeCSV(s.batch?.name),
      s.currentYear || '',
      s.currentSemester || '',
      escapeCSV(s.gender),
      escapeCSV(s.user?.email),
      escapeCSV(s.user?.phoneNo),
      escapeCSV(s.parentName),
      escapeCSV(s.parentContact),
      escapeCSV(app.companyName),
      escapeCSV(app.companyAddress),
      escapeCSV(app.companyContact),
      escapeCSV(app.companyEmail),
      escapeCSV(app.hrName),
      escapeCSV(app.hrContact),
      escapeCSV(app.hrEmail),
      app.startDate?.toISOString().split('T')[0] || '',
      app.endDate?.toISOString().split('T')[0] || '',
      duration,
      escapeCSV(app.jobProfile),
      app.joiningLetterUrl ? 'Yes' : 'No',
      app.status,
      app.internshipPhase,
      escapeCSV(issue.problems.join('; ')),
    ].join(',');
  });

  const csv2Content = [csv2Headers.join(','), ...csv2Rows].join('\n');
  const csv2Path = path.join(outputDir, `students-with-internship-issues-${timestamp}.csv`);
  fs.writeFileSync(csv2Path, csv2Content, 'utf8');
  console.log(`✓ Exported ${issues.length} students with internship issues to:`);
  console.log(`  ${csv2Path}\n`);

  // ============================================================
  // 3. SUMMARY BY INSTITUTION
  // ============================================================
  console.log('Generating summary...');

  const institutions = await prisma.institution.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  const csv3Headers = ['Institute Code', 'Institute Name', 'Total Students', 'Without Internship', 'With Issues', 'OK'];
  const csv3Rows: string[] = [];

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

    csv3Rows.push([
      escapeCSV(inst.code),
      escapeCSV(inst.name),
      totalStudents,
      withoutInternship,
      withIssues,
      ok,
    ].join(','));
  }

  const csv3Content = [csv3Headers.join(','), ...csv3Rows].join('\n');
  const csv3Path = path.join(outputDir, `internship-summary-by-institution-${timestamp}.csv`);
  fs.writeFileSync(csv3Path, csv3Content, 'utf8');
  console.log(`✓ Exported summary to:`);
  console.log(`  ${csv3Path}\n`);

  // Print summary
  console.log('='.repeat(60));
  console.log('EXPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`\nFiles created in: ${outputDir}`);
  console.log(`\n1. students-without-internship-${timestamp}.csv`);
  console.log(`   → ${studentsWithoutInternship.length} students without any internship`);
  console.log(`\n2. students-with-internship-issues-${timestamp}.csv`);
  console.log(`   → ${issues.length} students with incomplete/wrong details`);
  console.log(`\n3. internship-summary-by-institution-${timestamp}.csv`);
  console.log(`   → Summary statistics by institution`);
}

main()
  .catch(e => { console.error('Fatal error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
