import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

// Course to Branch mapping
const COURSE_TO_BRANCH_CODE: Record<string, string> = {
  'computer science': 'CSE',
  'computer science and engineering': 'CSE',
  'computer science engineering': 'CSE',
  'computer engineering': 'CSE',
  cse: 'CSE',
  cs: 'CSE',
  'information technology': 'IT',
  it: 'IT',
  infotech: 'IT',
  electronics: 'ECE',
  'electronics and communication': 'ECE',
  'electronics and communication engineering': 'ECE',
  'electronics and communications': 'ECE',
  'electronics and communications engineering': 'ECE',
  'electronics & communication': 'ECE',
  'electronics & communications': 'ECE',
  ece: 'ECE',
  ec: 'ECE',
  electrical: 'EE',
  'electrical engineering': 'EE',
  ee: 'EE',
  elect: 'EE',
  mechanical: 'ME',
  'mechanical engineering': 'ME',
  'mechanical engineering production': 'ME',
  'mechanical engineering rac': 'ME',
  me: 'ME',
  mech: 'ME',
  civil: 'CE',
  'civil engineering': 'CE',
  ce: 'CE',
  'architectural assistantship': 'AA',
  'architecture assistanceship': 'AA',
  architecture: 'AA',
  architectural: 'AA',
  aa: 'AA',
  arch: 'AA',
  'applied science': 'AS',
  'applied sciences': 'AS',
  as: 'AS',
  science: 'AS',
  leather: 'LT',
  'leather technology': 'LT',
  'leather technology footwear': 'LT',
  lt: 'LT',
  'chemical engineering': 'CHEM',
  'chem engg': 'CHEM',
  chemical: 'CHEM',
  chem: 'CHEM',
  'plastic technology': 'CHEM',
  'plastic and polymer': 'CHEM',
  'fashion design': 'FGT',
  'fashion design and garment technology': 'FGT',
  'fashion design & garment technology': 'FGT',
  'garment technology': 'FGT',
  fashion: 'FGT',
  fgt: 'FGT',
  fd: 'FGT',
  'textile technology': 'TT',
  'textile processing': 'TT',
  'textile technology knitting': 'TT',
  textile: 'TT',
  tt: 'TT',
  'textile design': 'TD',
  td: 'TD',
  'medical lab technology': 'MLT',
  'medical laboratory technology': 'MLT',
  mlt: 'MLT',
  'modern office practice': 'MOP',
  mop: 'MOP',
  pharmacy: 'PH',
  ph: 'PH',
  pharma: 'PH',
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

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--')) || 'D:/placeintern/Book1.xlsx';
  const dryRun = !args.includes('--execute');

  console.log('='.repeat(90));
  console.log('FIX FACULTY BRANCH ASSIGNMENTS');
  console.log('='.repeat(90));
  console.log(`Excel file: ${filePath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // Read Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.worksheets[0];

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

    // Get all branches
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true },
    });

    const branchByCode = new Map<string, typeof branches[0]>();
    for (const b of branches) {
      if (b.shortName) branchByCode.set(b.shortName.toUpperCase(), b);
      if (b.code) branchByCode.set(b.code.toUpperCase(), b);
    }
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

    // Find and fix mismatches
    const fixes: Array<{
      rowNumber: number;
      userName: string;
      userId: string;
      excelDepartment: string;
      oldBranchName: string | null;
      oldBranchCode: string | null;
      newBranchName: string;
      newBranchCode: string;
      newBranchId: string;
    }> = [];

    for (const excelRow of excelRows) {
      const matchedUsers = usersByPhone.get(excelRow.phone) || [];
      if (matchedUsers.length === 0) continue;
      if (!excelRow.expectedBranchCode) continue;

      const user = matchedUsers[0];
      if (!user.branchId) continue;

      const userBranch = branchById.get(user.branchId);
      const userBranchCode = userBranch?.shortName?.toUpperCase() || userBranch?.code?.toUpperCase();

      if (userBranchCode !== excelRow.expectedBranchCode) {
        const correctBranch = branchByCode.get(excelRow.expectedBranchCode);
        if (correctBranch) {
          fixes.push({
            rowNumber: excelRow.rowNumber,
            userName: user.name || excelRow.name,
            userId: user.id,
            excelDepartment: excelRow.department,
            oldBranchName: user.branchName || userBranch?.name || null,
            oldBranchCode: userBranchCode || null,
            newBranchName: correctBranch.name,
            newBranchCode: correctBranch.shortName || correctBranch.code || '',
            newBranchId: correctBranch.id,
          });
        }
      }
    }

    console.log(`Found ${fixes.length} records to fix\n`);

    if (fixes.length === 0) {
      console.log('No mismatches found. All records are correct!');
      return;
    }

    // Apply fixes
    let successCount = 0;
    let failCount = 0;

    for (const fix of fixes) {
      console.log(`Row ${fix.rowNumber}: ${fix.userName}`);
      console.log(`  ${fix.oldBranchName} (${fix.oldBranchCode}) → ${fix.newBranchName} (${fix.newBranchCode})`);

      if (!dryRun) {
        try {
          await prisma.user.update({
            where: { id: fix.userId },
            data: {
              branchId: fix.newBranchId,
              branchName: fix.newBranchName,
            },
          });
          console.log('  ✓ Updated');
          successCount++;
        } catch (err: any) {
          console.log(`  ✗ Failed: ${err.message}`);
          failCount++;
        }
      } else {
        console.log('  (dry-run - would update)');
        successCount++;
      }
    }

    console.log('\n' + '='.repeat(90));
    console.log('SUMMARY');
    console.log('='.repeat(90));
    console.log(`Total fixes: ${fixes.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failCount}`);

    if (dryRun) {
      console.log('\nDry run mode - no changes made.');
      console.log('Run with --execute to apply fixes.');
    }

    // Export results
    const outputWorkbook = new ExcelJS.Workbook();
    const sheet = outputWorkbook.addWorksheet('Fixed Records');
    sheet.columns = [
      { header: 'Row', key: 'rowNumber', width: 8 },
      { header: 'Name', key: 'userName', width: 30 },
      { header: 'Excel Department', key: 'excelDepartment', width: 35 },
      { header: 'Old Branch', key: 'oldBranchName', width: 25 },
      { header: 'Old Code', key: 'oldBranchCode', width: 12 },
      { header: 'New Branch', key: 'newBranchName', width: 25 },
      { header: 'New Code', key: 'newBranchCode', width: 12 },
    ];

    for (const fix of fixes) {
      sheet.addRow(fix);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = path.join(path.dirname(filePath), `branch_fixes_${timestamp}.xlsx`);
    await outputWorkbook.xlsx.writeFile(outputPath);
    console.log(`\nResults exported to: ${outputPath}`);

  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch(console.error);
