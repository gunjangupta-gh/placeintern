import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

// Course to Branch mapping (same as link script)
const COURSE_TO_BRANCH_CODE: Record<string, string> = {
  // Computer Science
  'computer science': 'CSE',
  'computer science and engineering': 'CSE',
  'computer science engineering': 'CSE',
  'computer engineering': 'CSE',
  cse: 'CSE',
  cs: 'CSE',

  // Information Technology
  'information technology': 'IT',
  it: 'IT',
  infotech: 'IT',

  // Electronics & Communication
  electronics: 'ECE',
  'electronics and communication': 'ECE',
  'electronics and communication engineering': 'ECE',
  'electronics and communications': 'ECE',
  'electronics and communications engineering': 'ECE',
  'electronics & communication': 'ECE',
  'electronics & communications': 'ECE',
  ece: 'ECE',
  ec: 'ECE',

  // Electrical Engineering
  electrical: 'EE',
  'electrical engineering': 'EE',
  ee: 'EE',
  elect: 'EE',

  // Mechanical Engineering
  mechanical: 'ME',
  'mechanical engineering': 'ME',
  'mechanical engineering production': 'ME',
  'mechanical engineering rac': 'ME',
  me: 'ME',
  mech: 'ME',

  // Civil Engineering
  civil: 'CE',
  'civil engineering': 'CE',
  ce: 'CE',

  // Architectural Assistantship
  'architectural assistantship': 'AA',
  'architecture assistanceship': 'AA',
  architecture: 'AA',
  architectural: 'AA',
  aa: 'AA',
  arch: 'AA',

  // Applied Science
  'applied science': 'AS',
  'applied sciences': 'AS',
  as: 'AS',
  science: 'AS',

  // Leather Technology
  leather: 'LT',
  'leather technology': 'LT',
  'leather technology footwear': 'LT',
  lt: 'LT',

  // Chemical Engineering
  'chemical engineering': 'CHEM',
  'chem engg': 'CHEM',
  chemical: 'CHEM',
  chem: 'CHEM',
  'plastic technology': 'CHEM',
  'plastic and polymer': 'CHEM',

  // Fashion & Garment Technology
  'fashion design': 'FGT',
  'fashion design and garment technology': 'FGT',
  'fashion design & garment technology': 'FGT',
  'garment technology': 'FGT',
  fashion: 'FGT',
  fgt: 'FGT',
  fd: 'FGT',

  // Textile Technology
  'textile technology': 'TT',
  'textile processing': 'TT',
  'textile technology knitting': 'TT',
  textile: 'TT',
  tt: 'TT',

  // Textile Design
  'textile design': 'TD',
  td: 'TD',

  // Medical Lab Technology
  'medical lab technology': 'MLT',
  'medical laboratory technology': 'MLT',
  mlt: 'MLT',

  // Modern Office Practice
  'modern office practice': 'MOP',
  mop: 'MOP',

  // Pharmacy
  pharmacy: 'PH',
  ph: 'PH',
  pharma: 'PH',

  // Library & Information Science
  'library and information science': 'LIS',
  'library & information science': 'LIS',
  library: 'LIS',
  lis: 'LIS',
};

function normalizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,\-_()\[\]\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBranchCode(courseName: string): string | null {
  const normalized = normalizeBranchName(courseName);
  if (COURSE_TO_BRANCH_CODE[normalized]) {
    return COURSE_TO_BRANCH_CODE[normalized];
  }

  for (const [key, code] of Object.entries(COURSE_TO_BRANCH_CODE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  return null;
}

function cleanString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizePhone(phone: string): string {
  const digits = cleanString(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeEmail(email: string): string {
  return cleanString(email).toLowerCase();
}

async function main() {
  const filePath = process.argv[2] || 'D:/placeintern/Book1.xlsx';

  console.log('='.repeat(90));
  console.log('VERIFY FACULTY BRANCH ASSIGNMENTS');
  console.log('='.repeat(90));
  console.log(`Excel file: ${filePath}`);
  console.log('');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // Read Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

    // Get headers
    const headerRow = worksheet.getRow(1);
    const headers: Record<number, string> = {};
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber] = cell.value ? String(cell.value).trim().toLowerCase() : '';
    });

    // Parse Excel rows
    const excelRows: Array<{
      rowNumber: number;
      name: string;
      phone: string;
      department: string;
      expectedBranchCode: string | null;
    }> = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      const rowData: Record<string, unknown> = {};
      let hasData = false;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber];
        if (!header) return;
        let value: unknown = cell.value;
        if (value !== null && value !== undefined) {
          hasData = true;
          if (typeof value === 'object' && 'richText' in value) {
            value = (value as any).richText.map((item: any) => item.text).join('');
          }
        }
        rowData[header] = value;
      });

      if (!hasData) continue;

      const name = cleanString(rowData['name of facuty'] || rowData['name of faculty'] || rowData['name']);
      const phone = normalizePhone(cleanString(rowData['contact number'] || rowData['phone']));
      const department = cleanString(rowData['course'] || rowData['department']);

      if (!name || !phone) continue;

      excelRows.push({
        rowNumber,
        name,
        phone,
        department,
        expectedBranchCode: getBranchCode(department),
      });
    }

    console.log(`Parsed ${excelRows.length} rows from Excel\n`);

    // Get all branches
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true },
    });

    const branchByCode = new Map(branches.map(b => [b.shortName?.toUpperCase(), b]));
    const branchById = new Map(branches.map(b => [b.id, b]));

    // Get all faculty users
    const phones = excelRows.map(r => r.phone).filter(p => p.length > 0);
    const users = await prisma.user.findMany({
      where: {
        role: { in: [Role.TEACHER, Role.PRINCIPAL, Role.FACULTY_COORDINATOR] },
        phoneNo: { in: phones },
      },
      select: {
        id: true,
        name: true,
        phoneNo: true,
        branchId: true,
        branchName: true,
      },
    });

    const usersByPhone = new Map<string, typeof users[0][]>();
    for (const user of users) {
      const phone = normalizePhone(user.phoneNo || '');
      if (phone) {
        const existing = usersByPhone.get(phone) || [];
        usersByPhone.set(phone, [...existing, user]);
      }
    }

    // Verify each row
    let correctCount = 0;
    let mismatchCount = 0;
    let notFoundCount = 0;
    let noExpectedBranch = 0;
    let notLinked = 0;

    const mismatches: Array<{
      rowNumber: number;
      name: string;
      excelDepartment: string;
      expectedBranchCode: string;
      currentBranchName: string | null;
      currentBranchCode: string | null;
    }> = [];

    for (const excelRow of excelRows) {
      const matchedUsers = usersByPhone.get(excelRow.phone) || [];

      if (matchedUsers.length === 0) {
        notFoundCount++;
        continue;
      }

      // Take first matched user
      const user = matchedUsers[0];

      if (!excelRow.expectedBranchCode) {
        noExpectedBranch++;
        continue;
      }

      if (!user.branchId) {
        notLinked++;
        continue;
      }

      const userBranch = branchById.get(user.branchId);
      const userBranchCode = userBranch?.shortName?.toUpperCase() || userBranch?.code?.toUpperCase();

      if (userBranchCode === excelRow.expectedBranchCode) {
        correctCount++;
      } else {
        mismatchCount++;
        mismatches.push({
          rowNumber: excelRow.rowNumber,
          name: excelRow.name,
          excelDepartment: excelRow.department,
          expectedBranchCode: excelRow.expectedBranchCode,
          currentBranchName: user.branchName || userBranch?.name || null,
          currentBranchCode: userBranchCode || null,
        });
      }
    }

    console.log('='.repeat(90));
    console.log('VERIFICATION SUMMARY');
    console.log('='.repeat(90));
    console.log(`Total Excel rows with phone: ${excelRows.length}`);
    console.log(`Correctly linked: ${correctCount}`);
    console.log(`MISMATCHED: ${mismatchCount}`);
    console.log(`User not found: ${notFoundCount}`);
    console.log(`No expected branch (Workshop/Principal): ${noExpectedBranch}`);
    console.log(`User not linked to any branch: ${notLinked}`);

    if (mismatches.length > 0) {
      console.log('\n' + '='.repeat(90));
      console.log('MISMATCHED RECORDS (Current branch does NOT match Excel department)');
      console.log('='.repeat(90));

      for (const m of mismatches) {
        console.log(`\nRow ${m.rowNumber}: ${m.name}`);
        console.log(`  Excel Department: ${m.excelDepartment}`);
        console.log(`  Expected Branch Code: ${m.expectedBranchCode}`);
        console.log(`  Current Branch: ${m.currentBranchName} (${m.currentBranchCode})`);
      }

      // Export mismatches to Excel
      const outputWorkbook = new ExcelJS.Workbook();
      const sheet = outputWorkbook.addWorksheet('Mismatches');
      sheet.columns = [
        { header: 'Row', key: 'rowNumber', width: 8 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Excel Department', key: 'excelDepartment', width: 35 },
        { header: 'Expected Branch', key: 'expectedBranchCode', width: 18 },
        { header: 'Current Branch Name', key: 'currentBranchName', width: 30 },
        { header: 'Current Branch Code', key: 'currentBranchCode', width: 18 },
      ];

      for (const m of mismatches) {
        sheet.addRow(m);
      }

      const outputPath = path.join(path.dirname(filePath), 'branch_mismatches.xlsx');
      await outputWorkbook.xlsx.writeFile(outputPath);
      console.log(`\nMismatches exported to: ${outputPath}`);
    } else {
      console.log('\nAll linked users have correct branch assignments!');
    }

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
