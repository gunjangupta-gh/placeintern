import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface FacultyExcelRow {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  institutionName: string;
  institutionCode: string;
}

interface InstitutionLite {
  id: string;
  name: string | null;
  code: string | null;
}

interface BranchLite {
  id: string;
  name: string;
  shortName: string;
  code: string;
  institutionId: string | null;
}

type MatchStatus =
  | 'linked'
  | 'dry-linked'
  | 'already-linked'
  | 'user-not-found'
  | 'ambiguous-user'
  | 'missing-department'
  | 'branch-not-found'
  | 'missing-identifier'
  | 'institution-not-found'
  | 'failed';

interface MatchResult {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  userId?: string;
  userName?: string;
  branchId?: string;
  branchName?: string;
  status: MatchStatus;
  message: string;
}

interface ExportRow {
  row: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  userName: string;
  userId: string;
  branchName: string;
  branchId: string;
  status: string;
  message: string;
}

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
  me: 'ME',
  mech: 'ME',

  civil: 'CE',
  'civil engineering': 'CE',
  ce: 'CE',

  'architectural assistantship': 'AA',
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
  lt: 'LT',
};

function cleanString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeEmail(email: string): string {
  return cleanString(email).toLowerCase();
}

function normalizePhone(phone: string): string {
  const digits = cleanString(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeInstitutionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/govt\.?/g, 'government')
    .replace(/governement/g, 'government')
    .replace(/poly\.?/g, 'polytechnic')
    .replace(/coll\.?/g, 'college')
    .replace(/inst\.?/g, 'institute')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeyWords(name: string): string[] {
  const normalized = normalizeInstitutionName(name);
  const commonWords = ['the', 'and', 'for', 'college', 'polytechnic', 'government', 'institute', 'technology'];

  return normalized
    .split(' ')
    .filter((word) => word.length > 3 && !commonWords.includes(word));
}

function findInstitution(
  institutionName: string,
  institutionCode: string,
  institutions: InstitutionLite[],
): InstitutionLite | null {
  if (!institutionName && !institutionCode) {
    return null;
  }

  if (institutionCode) {
    const codeMatch = institutions.find((institution) =>
      institution.code?.toLowerCase() === institutionCode.toLowerCase(),
    );
    if (codeMatch) return codeMatch;
  }

  if (!institutionName) {
    return null;
  }

  const normalizedSearch = normalizeInstitutionName(institutionName);

  const exactNormalizedMatch = institutions.find(
    (institution) => normalizeInstitutionName(institution.name || '') === normalizedSearch,
  );
  if (exactNormalizedMatch) return exactNormalizedMatch;

  const partialNormalizedMatch = institutions.find((institution) => {
    const normalizedInstitution = normalizeInstitutionName(institution.name || '');
    return (
      normalizedInstitution.includes(normalizedSearch)
      || normalizedSearch.includes(normalizedInstitution)
    );
  });
  if (partialNormalizedMatch) return partialNormalizedMatch;

  const searchKeyWords = extractKeyWords(institutionName);
  if (searchKeyWords.length > 0) {
    const keywordMatch = institutions.find((institution) => {
      const institutionKeyWords = extractKeyWords(institution.name || '');
      return searchKeyWords.some((searchWord) =>
        institutionKeyWords.some(
          (instWord) =>
            instWord === searchWord
            || instWord.includes(searchWord)
            || searchWord.includes(instWord),
        ),
      );
    });

    if (keywordMatch) return keywordMatch;
  }

  return null;
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

function findBranch(
  branchName: string,
  institutionId: string | null,
  branches: BranchLite[],
): BranchLite | null {
  const searchUpper = branchName.toUpperCase().trim();
  const normalized = normalizeBranchName(branchName);

  const availableBranches = branches.filter(
    (branch) => branch.institutionId === institutionId || branch.institutionId === null,
  );

  let match = availableBranches.find(
    (branch) =>
      branch.shortName.toUpperCase() === searchUpper
      || branch.code.toUpperCase() === searchUpper,
  );
  if (match) return match;

  const branchCode = getBranchCode(branchName);
  if (branchCode) {
    match = availableBranches.find(
      (branch) =>
        branch.shortName.toUpperCase() === branchCode
        || branch.code.toUpperCase() === branchCode,
    );
    if (match) return match;
  }

  match = availableBranches.find(
    (branch) => normalizeBranchName(branch.name) === normalized,
  );
  if (match) return match;

  match = availableBranches.find((branch) => {
    const branchNormalized = normalizeBranchName(branch.name);
    return branchNormalized.includes(normalized) || normalized.includes(branchNormalized);
  });
  if (match) return match;

  match = availableBranches.find((branch) => searchUpper.includes(branch.shortName.toUpperCase()));
  if (match) return match;

  return null;
}

async function parseExcelFile(filePath: string): Promise<FacultyExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file.');
  }

  const headerRow = worksheet.getRow(1);
  const headers: Record<number, string> = {};

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cell.value ? String(cell.value).trim().toLowerCase() : '';
  });

  const rows: FacultyExcelRow[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rowData: Record<string, unknown> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;

      let value: unknown = cell.value;
      if (value !== null && value !== undefined) {
        hasData = true;

        if (typeof value === 'object') {
          if ('richText' in value) {
            value = (value as ExcelJS.CellRichTextValue).richText.map((item) => item.text).join('');
          } else if ('result' in value) {
            value = (value as ExcelJS.CellFormulaValue).result;
          } else if ('text' in value) {
            value = (value as ExcelJS.CellHyperlinkValue).text;
          } else if (value instanceof Date) {
            value = value.toISOString();
          } else {
            value = String(value);
          }
        }
      }

      rowData[header] = value;
    });

    if (!hasData) {
      continue;
    }

    const name = cleanString(
      rowData['name']
      || rowData['full name']
      || rowData['faculty name']
      || rowData['teacher name']
      || rowData['name of facuty']
      || rowData['name of faculty']
      || rowData['name of the faculty'],
    );

    if (!name) {
      continue;
    }

    const email = normalizeEmail(
      cleanString(rowData['email'] || rowData['email id'] || rowData['e-mail'] || rowData['mail']),
    );

    const phone = normalizePhone(
      cleanString(
        rowData['phone']
        || rowData['phone no']
        || rowData['phoneno']
        || rowData['mobile']
        || rowData['contact']
        || rowData['mobile no']
        || rowData['mobile number']
        || rowData['contact number'],
      ),
    );

    const department = cleanString(
      rowData['department'] || rowData['dept'] || rowData['branch'] || rowData['course'],
    );

    const institutionName = cleanString(
      rowData['institution']
      || rowData['institution name']
      || rowData['college']
      || rowData['college name']
      || rowData['institute']
      || rowData['name of the college'],
    );

    const institutionCode = cleanString(
      rowData['institution code'] || rowData['institute code'] || rowData['college code'],
    );

    rows.push({
      rowNumber,
      name,
      email,
      phone,
      department,
      institutionName,
      institutionCode,
    });
  }

  return rows;
}

function resolvePathFromArg(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  return path.resolve(process.cwd(), inputPath);
}

function getTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function toExportRow(result: MatchResult): ExportRow {
  return {
    row: result.rowNumber,
    name: result.name,
    email: result.email,
    phone: result.phone,
    department: result.department,
    userName: result.userName || '',
    userId: result.userId || '',
    branchName: result.branchName || '',
    branchId: result.branchId || '',
    status: result.status,
    message: result.message,
  };
}

async function writeResultWorkbook(
  filePath: string,
  sheetName: string,
  rows: ExportRow[],
  headerColorArgb: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Row', key: 'row', width: 8 },
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Email', key: 'email', width: 35 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Department', key: 'department', width: 30 },
    { header: 'User Name', key: 'userName', width: 30 },
    { header: 'User ID', key: 'userId', width: 40 },
    { header: 'Branch Name', key: 'branchName', width: 28 },
    { header: 'Branch ID', key: 'branchId', width: 40 },
    { header: 'Status', key: 'status', width: 20 },
    { header: 'Message', key: 'message', width: 60 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: headerColorArgb },
  };

  for (const row of rows) {
    sheet.addRow(row);
  }

  await workbook.xlsx.writeFile(filePath);
}

async function main() {
  const args = process.argv.slice(2);

  let filePath = '';
  let dryRun = true;
  let verbose = false;

  for (const arg of args) {
    if (arg === '--execute') {
      dryRun = false;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else if (!arg.startsWith('--')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('Usage: npx ts-node scripts/link-faculty-branches-from-excel.ts <excel-file-path> [--dry-run | --execute] [--verbose]');
    process.exit(1);
  }

  const resolvedPath = resolvePathFromArg(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Excel file not found: ${resolvedPath}`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not configured.');
    process.exit(1);
  }

  console.log('='.repeat(90));
  console.log('FACULTY BRANCH LINKING FROM EXCEL');
  console.log('='.repeat(90));
  console.log(`Excel file: ${resolvedPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('Only faculty users with missing branchId will be updated.');
  console.log('');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    const excelRows = await parseExcelFile(resolvedPath);
    if (excelRows.length === 0) {
      console.log('No valid faculty rows found in the Excel sheet.');
      return;
    }

    const institutions = await prisma.institution.findMany({
      select: { id: true, name: true, code: true },
    });

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true },
    });

    const emails = excelRows.map((row) => row.email).filter((email) => email.length > 0);
    const phones = excelRows.map((row) => row.phone).filter((phone) => phone.length > 0);

    const candidateUsers = await prisma.user.findMany({
      where: {
        role: { in: [Role.TEACHER, Role.PRINCIPAL, Role.FACULTY_COORDINATOR] },
        OR: [
          ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
          ...(phones.length > 0 ? [{ phoneNo: { in: phones } }] : []),
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNo: true,
        role: true,
        institutionId: true,
        branchId: true,
        branchName: true,
      },
    });

    const usersByEmail = new Map<string, typeof candidateUsers>();
    const usersByPhone = new Map<string, typeof candidateUsers>();

    for (const user of candidateUsers) {
      const email = normalizeEmail(user.email || '');
      const phone = normalizePhone(user.phoneNo || '');

      if (email) {
        const existing = usersByEmail.get(email) || [];
        usersByEmail.set(email, [...existing, user]);
      }

      if (phone) {
        const existing = usersByPhone.get(phone) || [];
        usersByPhone.set(phone, [...existing, user]);
      }
    }

    const results: MatchResult[] = [];

    for (const row of excelRows) {
      if (!row.department) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          status: 'missing-department',
          message: 'Department/Course is missing in Excel row.',
        });
        continue;
      }

      if (!row.email && !row.phone) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          status: 'missing-identifier',
          message: 'Neither email nor phone is available for matching user.',
        });
        continue;
      }

      const byEmail = row.email ? usersByEmail.get(row.email) || [] : [];
      const byPhone = row.phone ? usersByPhone.get(row.phone) || [] : [];
      const uniqueCandidates = new Map<string, (typeof candidateUsers)[number]>();

      for (const user of [...byEmail, ...byPhone]) {
        uniqueCandidates.set(user.id, user);
      }

      if (uniqueCandidates.size === 0) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          status: 'user-not-found',
          message: 'No matching faculty found by email/phone.',
        });
        continue;
      }

      const unlinkedUsers = Array.from(uniqueCandidates.values()).filter((user) => !user.branchId);

      if (unlinkedUsers.length === 0) {
        const linkedUsers = Array.from(uniqueCandidates.values());
        const linkedUser = linkedUsers[0];
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          userId: linkedUser.id,
          userName: linkedUser.name,
          status: 'already-linked',
          message: 'Matched faculty already has branchId linked.',
        });
        continue;
      }

      if (unlinkedUsers.length > 1) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          status: 'ambiguous-user',
          message: `Multiple unlinked faculty users matched (${unlinkedUsers.length}).`,
        });
        continue;
      }

      const user = unlinkedUsers[0];
      let institutionId = user.institutionId;

      if (!institutionId && (row.institutionName || row.institutionCode)) {
        const matchedInstitution = findInstitution(
          row.institutionName,
          row.institutionCode,
          institutions as InstitutionLite[],
        );

        if (!matchedInstitution) {
          results.push({
            rowNumber: row.rowNumber,
            name: row.name,
            email: row.email,
            phone: row.phone,
            department: row.department,
            userId: user.id,
            userName: user.name,
            status: 'institution-not-found',
            message: `Institution could not be resolved from row: ${row.institutionName || row.institutionCode}`,
          });
          continue;
        }

        institutionId = matchedInstitution.id;
      }

      const branch = findBranch(row.department, institutionId ?? null, branches as BranchLite[]);
      if (!branch) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          userId: user.id,
          userName: user.name,
          status: 'branch-not-found',
          message: `Branch not found for department: ${row.department}`,
        });
        continue;
      }

      try {
        if (!dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              branchId: branch.id,
              branchName: branch.name,
            },
          });
        }

        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          userId: user.id,
          userName: user.name,
          branchId: branch.id,
          branchName: branch.name,
          status: dryRun ? 'dry-linked' : 'linked',
          message: `${dryRun ? 'Would link' : 'Linked'} to branch ${branch.name} (${branch.shortName}).`,
        });
      } catch (error: any) {
        results.push({
          rowNumber: row.rowNumber,
          name: row.name,
          email: row.email,
          phone: row.phone,
          department: row.department,
          userId: user.id,
          userName: user.name,
          status: 'failed',
          message: error?.message || 'Unknown update error.',
        });
      }
    }

    const byStatus = (status: MatchStatus) => results.filter((result) => result.status === status);

    console.log('='.repeat(90));
    console.log('SUMMARY');
    console.log('='.repeat(90));
    console.log(`Total Excel rows processed: ${results.length}`);
    console.log(`Linked: ${byStatus('linked').length}`);
    console.log(`Would link (dry-run): ${byStatus('dry-linked').length}`);
    console.log(`Already linked: ${byStatus('already-linked').length}`);
    console.log(`User not found: ${byStatus('user-not-found').length}`);
    console.log(`Ambiguous user: ${byStatus('ambiguous-user').length}`);
    console.log(`Missing department: ${byStatus('missing-department').length}`);
    console.log(`Missing identifier: ${byStatus('missing-identifier').length}`);
    console.log(`Institution not found: ${byStatus('institution-not-found').length}`);
    console.log(`Branch not found: ${byStatus('branch-not-found').length}`);
    console.log(`Failed updates: ${byStatus('failed').length}`);

    if (verbose) {
      console.log('\nDetailed results:');
      for (const result of results) {
        console.log(
          `Row ${result.rowNumber} | ${result.status.padEnd(18)} | ${result.name} | ${result.message}`,
        );
      }
    } else {
      const issues = results.filter((result) =>
        [
          'user-not-found',
          'ambiguous-user',
          'missing-department',
          'missing-identifier',
          'institution-not-found',
          'branch-not-found',
          'failed',
        ].includes(result.status),
      );

      if (issues.length > 0) {
        console.log('\nRows with issues:');
        for (const issue of issues) {
          console.log(`Row ${issue.rowNumber}: ${issue.name} -> ${issue.message}`);
        }
      }
    }

    const outputDir = path.dirname(resolvedPath);
    const timestamp = getTimestamp();

    const linkedRows = results
      .filter((result) => result.status === 'linked' || result.status === 'dry-linked')
      .map(toExportRow);
    const existingRows = results
      .filter((result) => result.status === 'already-linked')
      .map(toExportRow);
    const issueRows = results
      .filter((result) =>
        [
          'user-not-found',
          'ambiguous-user',
          'missing-department',
          'missing-identifier',
          'institution-not-found',
          'branch-not-found',
          'failed',
        ].includes(result.status),
      )
      .map(toExportRow);

    if (linkedRows.length > 0) {
      const linkedFile = path.join(
        outputDir,
        `${dryRun ? 'preview_linked_faculty_branches' : 'linked_faculty_branches'}_${timestamp}.xlsx`,
      );
      await writeResultWorkbook(
        linkedFile,
        dryRun ? 'Would Link' : 'Linked',
        linkedRows,
        dryRun ? 'FF87CEEB' : 'FF90EE90',
      );
      console.log(`\nSaved linked rows: ${linkedFile}`);
    }

    if (existingRows.length > 0) {
      const existingFile = path.join(outputDir, `already_linked_faculty_branches_${timestamp}.xlsx`);
      await writeResultWorkbook(
        existingFile,
        'Already Linked',
        existingRows,
        'FFFFA500',
      );
      console.log(`Saved already linked rows: ${existingFile}`);
    }

    if (issueRows.length > 0) {
      const issuesFile = path.join(outputDir, `faculty_branch_linking_issues_${timestamp}.xlsx`);
      await writeResultWorkbook(
        issuesFile,
        'Issues',
        issueRows,
        'FFFFCCCB',
      );
      console.log(`Saved issue rows: ${issuesFile}`);
    }

    if (dryRun) {
      console.log('\nDry run mode was active. No database updates were made.');
      console.log('Run with --execute to apply branch links.');
    }
  } catch (error: any) {
    console.error('Script failed:', error?.message || error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
