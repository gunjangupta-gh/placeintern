/**
 * Bulk Faculty Upload Script
 *
 * This script reads faculty data from an Excel file and uploads them to the system.
 * It supports dry-run mode to preview changes before applying them.
 *
 * Usage:
 *   npx ts-node scripts/bulk-upload-faculty.ts <excel-file-path> [options]
 *
 * Options:
 *   --dry-run    Preview changes without creating users (default: true)
 *   --execute    Actually create users in the database
 *
 * Password Format: First 4 letters of name (lowercase) + @ + first 4 digits of phone
 * Example: Name "Nikhil Sharma", Phone "9779123456" -> Password: "nikh@9779"
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

const BCRYPT_SALT_ROUNDS = 10;

interface FacultyRow {
  name: string;
  email: string;
  phone: string;
  designation?: string;
  department?: string;
  institutionName?: string;
  institutionCode?: string;
  role?: string;
  district?: string;
}

/**
 * Generate email from name: firstname.lastname@institution-domain or firstname.lastname@placeintern.in
 */
function generateEmail(name: string, institutionName: string): string {
  // Clean the name and split into parts
  const cleanName = name
    .replace(/^(Sh\.|Smt\.|Smt|Sh|Dr\.|Dr|Mr\.|Mr|Mrs\.|Mrs|Ms\.|Ms)\s*/i, '') // Remove titles
    .trim();

  const nameParts = cleanName.split(/\s+/).filter(p => p.length > 0);

  if (nameParts.length === 0) {
    return '';
  }

  // Take first name and last name (or just first name if only one part)
  const firstName = nameParts[0].toLowerCase().replace(/[^a-z]/g, '');
  const lastName = nameParts.length > 1
    ? nameParts[nameParts.length - 1].toLowerCase().replace(/[^a-z]/g, '')
    : '';

  // Create email
  const emailName = lastName ? `${firstName}.${lastName}` : firstName;

  // Use a generic domain
  return `${emailName}@placeintern.in`;
}

interface ProcessedFaculty {
  row: number;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  role: Role;
  institutionId: string | null;
  institutionName: string;
  branchId: string | null;
  branchName: string;
  password: string;
  status: 'new' | 'existing' | 'error';
  errorMessage?: string;
  emailGenerated?: boolean;
}

interface Institution {
  id: string;
  name: string | null;
  code: string | null;
}

interface Branch {
  id: string;
  name: string;
  shortName: string;
  code: string;
  institutionId: string | null;
}

/**
 * Generate password: first 4 letters of name (lowercase) + @ + first 4 digits of phone
 */
function generatePassword(name: string, phone: string): string {
  // Get first 4 letters of name (remove spaces, take first 4 chars, lowercase)
  const nameClean = name.replace(/\s+/g, '').toLowerCase();
  const namePart = nameClean.substring(0, 4);

  // Get first 4 digits of phone
  const phoneDigits = phone.replace(/\D/g, '');
  const phonePart = phoneDigits.substring(0, 4);

  return `${namePart}@${phonePart}`;
}

/**
 * Clean and normalize string values
 */
function cleanString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/**
 * Parse Role from string
 */
function parseRole(roleStr: string): Role {
  const normalized = roleStr.toUpperCase().trim();
  switch (normalized) {
    case 'TEACHER':
    case 'FACULTY':
    case 'FACULTY_SUPERVISOR':
      return Role.TEACHER;
    case 'PRINCIPAL':
      return Role.PRINCIPAL;
    default:
      return Role.TEACHER;
  }
}

/**
 * Read and parse the Excel file
 */
async function parseExcelFile(filePath: string): Promise<FacultyRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  const rows: FacultyRow[] = [];

  // Get headers from first row
  const headerRow = worksheet.getRow(1);
  const headers: Record<number, string> = {};

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = cell.value;
    headers[colNumber] = value ? String(value).trim().toLowerCase() : '';
  });

  // Process data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData: Record<string, any> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        let value = cell.value;

        // Handle different cell value types
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            if ('richText' in value) {
              value = (value as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('');
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
          hasData = true;
        }

        rowData[header] = value;
      }
    });

    if (hasData) {
      // Map various column name formats (including the specific format from Book1.xlsx)
      const name = cleanString(
        rowData['name'] ||
        rowData['full name'] ||
        rowData['faculty name'] ||
        rowData['teacher name'] ||
        rowData['name of facuty'] ||  // Typo variant
        rowData['name of faculty'] ||
        rowData['name of the faculty']  // Current format
      );

      const phone = cleanString(
        rowData['phone'] ||
        rowData['phone no'] ||
        rowData['phoneno'] ||
        rowData['mobile'] ||
        rowData['contact'] ||
        rowData['mobile no'] ||
        rowData['mobile number'] ||
        rowData['contact number']
      );

      const institutionName = cleanString(
        rowData['institution'] ||
        rowData['institution name'] ||
        rowData['college'] ||
        rowData['college name'] ||
        rowData['institute'] ||
        rowData['name of the college']
      );

      // Email from the file
      let email = cleanString(
        rowData['email'] ||
        rowData['email id'] ||
        rowData['e-mail'] ||
        rowData['mail']
      ).toLowerCase();

      // Generate email only if not provided
      const emailGenerated = !email;
      if (!email && name && institutionName) {
        email = generateEmail(name, institutionName);
      }

      const faculty: FacultyRow = {
        name,
        email,
        phone,
        designation: cleanString(rowData['designation'] || rowData['position'] || rowData['title']),
        department: cleanString(rowData['department'] || rowData['dept'] || rowData['branch'] || rowData['course']),
        institutionName,
        institutionCode: cleanString(rowData['institution code'] || rowData['institute code'] || rowData['college code']),
        role: cleanString(rowData['role'] || 'TEACHER'),
        district: cleanString(rowData['district']),
      };

      // Only add if we have at least name
      if (faculty.name) {
        rows.push(faculty);
      }
    }
  }

  return rows;
}

/**
 * Normalize institution name for comparison
 */
function normalizeInstitutionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/govt\.?/g, 'government')
    .replace(/governement/g, 'government') // Fix common typo
    .replace(/poly\.?/g, 'polytechnic')
    .replace(/coll\.?/g, 'college')
    .replace(/inst\.?/g, 'institute')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract key words from institution name for matching
 */
function extractKeyWords(name: string): string[] {
  const normalized = normalizeInstitutionName(name);
  // Extract significant words (longer than 3 chars, excluding common words)
  const commonWords = ['the', 'and', 'for', 'college', 'polytechnic', 'government', 'institute', 'technology'];
  return normalized
    .split(' ')
    .filter(w => w.length > 3 && !commonWords.includes(w));
}

/**
 * Find institution by name or code (fuzzy matching)
 */
function findInstitution(
  institutionName: string | undefined,
  institutionCode: string | undefined,
  institutions: Institution[]
): Institution | null {
  if (!institutionName && !institutionCode) {
    return null;
  }

  // Try exact code match first
  if (institutionCode) {
    const byCode = institutions.find(i =>
      i.code?.toLowerCase() === institutionCode.toLowerCase()
    );
    if (byCode) return byCode;
  }

  if (!institutionName) return null;

  const normalizedSearch = normalizeInstitutionName(institutionName);

  // Try exact normalized name match
  const byExactNormalized = institutions.find(i =>
    normalizeInstitutionName(i.name || '') === normalizedSearch
  );
  if (byExactNormalized) return byExactNormalized;

  // Try partial normalized match (one contains the other)
  const byPartialNormalized = institutions.find(i => {
    const normalizedInst = normalizeInstitutionName(i.name || '');
    return normalizedInst.includes(normalizedSearch) || normalizedSearch.includes(normalizedInst);
  });
  if (byPartialNormalized) return byPartialNormalized;

  // Try keyword matching (city/district name)
  const searchKeyWords = extractKeyWords(institutionName);
  if (searchKeyWords.length > 0) {
    const byKeywords = institutions.find(i => {
      const instKeyWords = extractKeyWords(i.name || '');
      // Match if they share at least one significant keyword (usually city name)
      return searchKeyWords.some(sw => instKeyWords.some(iw =>
        iw === sw || iw.includes(sw) || sw.includes(iw)
      ));
    });
    if (byKeywords) return byKeywords;
  }

  return null;
}

/**
 * Normalize branch/course name for comparison
 */
function normalizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps course/branch names from Excel to database shortName codes
 * Database branches: AA, AS, CE, CSE, ECE, EE, IT, LT, ME
 */
const COURSE_TO_BRANCH_CODE: Record<string, string> = {
  // CSE - Computer Science and Engineering
  'computer science': 'CSE',
  'computer science and engineering': 'CSE',
  'computer science engineering': 'CSE',
  'computer engineering': 'CSE',
  'cse': 'CSE',
  'cs': 'CSE',

  // IT - Information Technology
  'information technology': 'IT',
  'it': 'IT',
  'infotech': 'IT',

  // ECE - Electronics and Communication Engineering
  'electronics': 'ECE',
  'electronics and communication': 'ECE',
  'electronics and communication engineering': 'ECE',
  'electronics and communications': 'ECE',
  'electronics and communications engineering': 'ECE',
  'electronics & communication': 'ECE',
  'electronics & communications': 'ECE',
  'ece': 'ECE',
  'ec': 'ECE',

  // EE - Electrical Engineering
  'electrical': 'EE',
  'electrical engineering': 'EE',
  'ee': 'EE',
  'elect': 'EE',

  // ME - Mechanical Engineering
  'mechanical': 'ME',
  'mechanical engineering': 'ME',
  'me': 'ME',
  'mech': 'ME',

  // CE - Civil Engineering
  'civil': 'CE',
  'civil engineering': 'CE',
  'ce': 'CE',

  // AA - Architectural Assistantship
  'architectural assistantship': 'AA',
  'architecture': 'AA',
  'architectural': 'AA',
  'aa': 'AA',
  'arch': 'AA',

  // AS - Applied Science
  'applied science': 'AS',
  'applied sciences': 'AS',
  'as': 'AS',
  'science': 'AS',

  // LT - Leather Technology
  'leather': 'LT',
  'leather technology': 'LT',
  'lt': 'LT',
};

/**
 * Get the branch code from a course/branch name
 */
function getBranchCode(courseName: string): string | null {
  const normalized = normalizeBranchName(courseName);

  // Direct lookup
  if (COURSE_TO_BRANCH_CODE[normalized]) {
    return COURSE_TO_BRANCH_CODE[normalized];
  }

  // Try partial matching
  for (const [key, code] of Object.entries(COURSE_TO_BRANCH_CODE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  return null;
}

/**
 * Find branch by name using shortName matching
 * Database branches: AA, AS, CE, CSE, ECE, EE, IT, LT, ME
 * Branches can be global (institutionId is null) or institution-specific
 */
function findBranch(
  branchName: string | undefined,
  institutionId: string | null,
  branches: Branch[]
): Branch | null {
  if (!branchName) {
    return null;
  }

  // Get branches for this institution OR global branches (institutionId is null)
  const availableBranches = branches.filter(b =>
    b.institutionId === institutionId || b.institutionId === null
  );

  const searchUpper = branchName.toUpperCase().trim();
  const normalized = normalizeBranchName(branchName);

  // 1. Try exact shortName/code match (e.g., "CSE" -> "CSE")
  let match = availableBranches.find(b =>
    b.shortName.toUpperCase() === searchUpper ||
    b.code.toUpperCase() === searchUpper
  );
  if (match) return match;

  // 2. Try mapping course name to branch code
  const branchCode = getBranchCode(branchName);
  if (branchCode) {
    match = availableBranches.find(b =>
      b.shortName.toUpperCase() === branchCode ||
      b.code.toUpperCase() === branchCode
    );
    if (match) return match;
  }

  // 3. Try exact name match
  match = availableBranches.find(b =>
    normalizeBranchName(b.name) === normalized
  );
  if (match) return match;

  // 4. Try partial name match
  match = availableBranches.find(b => {
    const branchNormalized = normalizeBranchName(b.name);
    return branchNormalized.includes(normalized) || normalized.includes(branchNormalized);
  });
  if (match) return match;

  // 5. Try matching shortName in search term (e.g., "CSE Department" -> "CSE")
  match = availableBranches.find(b =>
    searchUpper.includes(b.shortName.toUpperCase())
  );
  if (match) return match;

  return null;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let filePath = '';
  let dryRun = true;

  for (const arg of args) {
    if (arg === '--execute') {
      dryRun = false;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('--')) {
      filePath = arg;
    }
  }

  if (!filePath) {
    console.error('Usage: npx ts-node scripts/bulk-upload-faculty.ts <excel-file-path> [--dry-run | --execute]');
    console.error('');
    console.error('Options:');
    console.error('  --dry-run   Preview changes without creating users (default)');
    console.error('  --execute   Actually create users in the database');
    process.exit(1);
  }

  // Resolve file path
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('BULK FACULTY UPLOAD SCRIPT');
  console.log('='.repeat(80));
  console.log(`File: ${resolvedPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'EXECUTE (will create users)'}`);
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL is not set in environment.');
    console.error('Make sure you have a .env file with DATABASE_URL configured.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  try {
    // Parse Excel file
    console.log('Reading Excel file...');
    const facultyRows = await parseExcelFile(resolvedPath);
    console.log(`Found ${facultyRows.length} faculty records in Excel\n`);

    if (facultyRows.length === 0) {
      console.log('No faculty data found in the Excel file.');
      return;
    }

    // Display column mapping preview
    console.log('Sample data from first row:');
    const sample = facultyRows[0];
    console.log(`  Name: ${sample.name}`);
    console.log(`  Email: ${sample.email}${sample.email.endsWith('@placeintern.in') ? ' (auto-generated)' : ''}`);
    console.log(`  Phone: ${sample.phone}`);
    console.log(`  Designation: ${sample.designation || '(not specified)'}`);
    console.log(`  Department/Course: ${sample.department || '(not specified)'}`);
    console.log(`  Institution: ${sample.institutionName || sample.institutionCode || '(not specified)'}`);
    console.log(`  Role: ${sample.role || 'TEACHER'}`);
    console.log(`  Generated Password: ${generatePassword(sample.name, sample.phone)}`);
    console.log('');

    // Fetch all institutions
    console.log('Fetching institutions from database...');
    const institutions = await prisma.institution.findMany({
      select: { id: true, name: true, code: true }
    });
    console.log(`Found ${institutions.length} institutions`);

    // Fetch all branches
    console.log('Fetching branches from database...');
    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, shortName: true, code: true, institutionId: true }
    });
    console.log(`Found ${branches.length} branches\n`);

    // Fetch existing users by email
    const allEmails = facultyRows
      .map(f => f.email)
      .filter(e => e && e.length > 0);

    console.log('Checking for existing users...');
    const existingUsers = await prisma.user.findMany({
      where: {
        email: { in: allEmails }
      },
      select: {
        email: true,
        name: true,
        institutionId: true,
        Institution: { select: { name: true } }
      }
    });

    const existingEmailSet = new Set(existingUsers.map(u => u.email?.toLowerCase()));
    console.log(`Found ${existingUsers.length} existing users\n`);

    // Process each faculty row
    const processed: ProcessedFaculty[] = [];

    for (let i = 0; i < facultyRows.length; i++) {
      const faculty = facultyRows[i];
      const rowNumber = i + 2; // +2 for header row and 0-index

      const result: ProcessedFaculty = {
        row: rowNumber,
        name: faculty.name,
        email: faculty.email,
        phone: faculty.phone,
        designation: faculty.designation || '',
        department: faculty.department || '',
        role: parseRole(faculty.role || 'TEACHER'),
        institutionId: null,
        institutionName: faculty.institutionName || '',
        branchId: null,
        branchName: faculty.department || '',
        password: '',
        status: 'new',
        emailGenerated: !faculty.email.includes('@') ? false : faculty.email.endsWith('@placeintern.in')
      };

      // Validate required fields
      if (!faculty.name) {
        result.status = 'error';
        result.errorMessage = 'Name is required';
        processed.push(result);
        continue;
      }

      if (!faculty.email) {
        result.status = 'error';
        result.errorMessage = 'Email is required';
        processed.push(result);
        continue;
      }

      if (!faculty.phone) {
        result.status = 'error';
        result.errorMessage = 'Phone is required for password generation';
        processed.push(result);
        continue;
      }

      // Check if user already exists
      if (existingEmailSet.has(faculty.email.toLowerCase())) {
        result.status = 'existing';
        const existingUser = existingUsers.find(u => u.email?.toLowerCase() === faculty.email.toLowerCase());
        result.institutionName = existingUser?.Institution?.name || 'Unknown';
        processed.push(result);
        continue;
      }

      // Find institution
      const institution = findInstitution(faculty.institutionName, faculty.institutionCode, institutions);
      if (institution) {
        result.institutionId = institution.id;
        result.institutionName = institution.name || institution.code || '';

        // Find branch within the institution
        if (faculty.department) {
          const branch = findBranch(faculty.department, institution.id, branches);
          if (branch) {
            result.branchId = branch.id;
            result.branchName = branch.name;
          } else {
            // Branch not found - store the name but don't link
            result.branchName = faculty.department;
          }
        }
      } else if (faculty.institutionName || faculty.institutionCode) {
        result.status = 'error';
        result.errorMessage = `Institution not found: ${faculty.institutionName || faculty.institutionCode}`;
        processed.push(result);
        continue;
      }

      // Generate password
      result.password = generatePassword(faculty.name, faculty.phone);

      processed.push(result);
    }

    // Separate results
    const existingStaff = processed.filter(p => p.status === 'existing');
    const newStaff = processed.filter(p => p.status === 'new');
    const errors = processed.filter(p => p.status === 'error');

    // Display results
    console.log('='.repeat(80));
    console.log('RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total records: ${processed.length}`);
    console.log(`  - Already existing: ${existingStaff.length}`);
    console.log(`  - New to add: ${newStaff.length}`);
    console.log(`  - Errors: ${errors.length}`);
    console.log('');

    // Show existing staff
    if (existingStaff.length > 0) {
      console.log('-'.repeat(80));
      console.log('EXISTING STAFF (will be skipped):');
      console.log('-'.repeat(80));
      console.log('Row | Name                           | Email                          | Institution');
      console.log('-'.repeat(80));
      for (const staff of existingStaff) {
        console.log(
          `${String(staff.row).padStart(3)} | ` +
          `${staff.name.substring(0, 30).padEnd(30)} | ` +
          `${staff.email.substring(0, 30).padEnd(30)} | ` +
          `${staff.institutionName.substring(0, 20)}`
        );
      }
      console.log('');
    }

    // Show new staff to be added
    if (newStaff.length > 0) {
      console.log('-'.repeat(100));
      console.log('NEW STAFF TO ADD:');
      console.log('-'.repeat(100));
      console.log('Row | Name                           | Email                          | Institution              | Branch               | Password');
      console.log('-'.repeat(100));
      for (const staff of newStaff) {
        const branchDisplay = staff.branchId ? staff.branchName : (staff.branchName ? `${staff.branchName} (not linked)` : 'N/A');
        console.log(
          `${String(staff.row).padStart(3)} | ` +
          `${staff.name.substring(0, 30).padEnd(30)} | ` +
          `${staff.email.substring(0, 30).padEnd(30)} | ` +
          `${(staff.institutionName || 'N/A').substring(0, 24).padEnd(24)} | ` +
          `${branchDisplay.substring(0, 20).padEnd(20)} | ` +
          `${staff.password}`
        );
      }
      console.log('');
    }

    // Show errors
    if (errors.length > 0) {
      console.log('-'.repeat(80));
      console.log('ERRORS (cannot be processed):');
      console.log('-'.repeat(80));
      for (const err of errors) {
        console.log(`Row ${err.row}: ${err.name || '(no name)'} - ${err.errorMessage}`);
      }
      console.log('');
    }

    // Execute if not dry run
    if (!dryRun && newStaff.length > 0) {
      console.log('='.repeat(80));
      console.log('CREATING USERS...');
      console.log('='.repeat(80));

      const createdUsers: Array<{
        row: number;
        name: string;
        email: string;
        phone: string;
        password: string;
        designation: string;
        department: string;
        institution: string;
        branch: string;
        branchLinked: boolean;
        role: string;
        createdAt: string;
      }> = [];

      const failedUsers: Array<{
        row: number;
        name: string;
        email: string;
        phone: string;
        designation: string;
        department: string;
        institution: string;
        errorMessage: string;
      }> = [];

      for (const staff of newStaff) {
        try {
          const hashedPassword = await bcrypt.hash(staff.password, BCRYPT_SALT_ROUNDS);

          await prisma.user.create({
            data: {
              name: staff.name,
              email: staff.email,
              password: hashedPassword,
              phoneNo: staff.phone,
              role: staff.role,
              designation: staff.designation || null,
              active: true,
              institutionId: staff.institutionId,
              branchId: staff.branchId,
              branchName: staff.branchName || null,
              hasChangedDefaultPassword: false,
            }
          });

          createdUsers.push({
            row: staff.row,
            name: staff.name,
            email: staff.email,
            phone: staff.phone,
            password: staff.password, // Plain text password for reference
            designation: staff.designation,
            department: staff.department,
            institution: staff.institutionName,
            branch: staff.branchName,
            branchLinked: !!staff.branchId,
            role: staff.role,
            createdAt: new Date().toISOString(),
          });

          console.log(`✓ Created: ${staff.email}${staff.branchId ? ` (Branch: ${staff.branchName})` : ''}`);
        } catch (error: any) {
          failedUsers.push({
            row: staff.row,
            name: staff.name,
            email: staff.email,
            phone: staff.phone,
            designation: staff.designation,
            department: staff.department,
            institution: staff.institutionName,
            errorMessage: error.message,
          });

          console.error(`✗ Failed: ${staff.email} - ${error.message}`);
        }
      }

      // Add validation errors to failed users
      for (const err of errors) {
        failedUsers.push({
          row: err.row,
          name: err.name,
          email: err.email,
          phone: err.phone,
          designation: err.designation,
          department: err.department,
          institution: err.institutionName,
          errorMessage: err.errorMessage || 'Unknown error',
        });
      }

      console.log('');
      console.log('='.repeat(80));
      console.log('EXECUTION COMPLETE');
      console.log('='.repeat(80));
      console.log(`Successfully created: ${createdUsers.length}`);
      console.log(`Failed: ${failedUsers.length}`);

      // Generate Excel files
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputDir = path.dirname(resolvedPath);

      // Create Excel file for successfully created users
      if (createdUsers.length > 0) {
        const successWorkbook = new ExcelJS.Workbook();
        const successSheet = successWorkbook.addWorksheet('Created Users');

        // Add headers
        successSheet.columns = [
          { header: 'Row', key: 'row', width: 8 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 35 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Password', key: 'password', width: 15 },
          { header: 'Designation', key: 'designation', width: 25 },
          { header: 'Department', key: 'department', width: 30 },
          { header: 'Institution', key: 'institution', width: 35 },
          { header: 'Branch', key: 'branch', width: 25 },
          { header: 'Branch Linked', key: 'branchLinked', width: 12 },
          { header: 'Role', key: 'role', width: 12 },
          { header: 'Created At', key: 'createdAt', width: 22 },
        ];

        // Style header row
        const headerRow = successSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF90EE90' }, // Light green
        };

        // Add data
        createdUsers.forEach(user => successSheet.addRow(user));

        const successFilePath = path.join(outputDir, `created_users_${timestamp}.xlsx`);
        await successWorkbook.xlsx.writeFile(successFilePath);
        console.log(`\n✓ Created users Excel saved: ${successFilePath}`);
      }

      // Create Excel file for failed/error users
      if (failedUsers.length > 0) {
        const errorWorkbook = new ExcelJS.Workbook();
        const errorSheet = errorWorkbook.addWorksheet('Failed Users');

        // Add headers
        errorSheet.columns = [
          { header: 'Row', key: 'row', width: 8 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 35 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Designation', key: 'designation', width: 25 },
          { header: 'Department', key: 'department', width: 30 },
          { header: 'Institution', key: 'institution', width: 35 },
          { header: 'Error', key: 'errorMessage', width: 50 },
        ];

        // Style header row
        const headerRow = errorSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCB' }, // Light red
        };

        // Add data
        failedUsers.forEach(user => errorSheet.addRow(user));

        const errorFilePath = path.join(outputDir, `error_users_${timestamp}.xlsx`);
        await errorWorkbook.xlsx.writeFile(errorFilePath);
        console.log(`✓ Error users Excel saved: ${errorFilePath}`);
      }

    } else if (!dryRun && newStaff.length === 0) {
      console.log('No new staff to add.');
    } else {
      // DRY RUN MODE - Generate preview Excel files
      console.log('='.repeat(80));
      console.log('DRY RUN COMPLETE - No changes made');
      console.log('='.repeat(80));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const outputDir = path.dirname(resolvedPath);

      // Create preview Excel file for users to be created
      if (newStaff.length > 0) {
        const previewWorkbook = new ExcelJS.Workbook();
        const previewSheet = previewWorkbook.addWorksheet('Users To Create');

        previewSheet.columns = [
          { header: 'Row', key: 'row', width: 8 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 35 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Password', key: 'password', width: 15 },
          { header: 'Designation', key: 'designation', width: 25 },
          { header: 'Department', key: 'department', width: 30 },
          { header: 'Institution', key: 'institution', width: 35 },
          { header: 'Branch', key: 'branch', width: 25 },
          { header: 'Branch Linked', key: 'branchLinked', width: 12 },
          { header: 'Role', key: 'role', width: 12 },
        ];

        const headerRow = previewSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF87CEEB' }, // Light blue for preview
        };

        newStaff.forEach(staff => previewSheet.addRow({
          row: staff.row,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          password: staff.password,
          designation: staff.designation,
          department: staff.department,
          institution: staff.institutionName,
          branch: staff.branchName,
          branchLinked: staff.branchId ? 'Yes' : 'No',
          role: staff.role,
        }));

        const previewFilePath = path.join(outputDir, `preview_users_to_create_${timestamp}.xlsx`);
        await previewWorkbook.xlsx.writeFile(previewFilePath);
        console.log(`\n✓ Preview Excel (users to create): ${previewFilePath}`);
      }

      // Create Excel file for existing users (skipped)
      if (existingStaff.length > 0) {
        const existingWorkbook = new ExcelJS.Workbook();
        const existingSheet = existingWorkbook.addWorksheet('Existing Users');

        existingSheet.columns = [
          { header: 'Row', key: 'row', width: 8 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 35 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Designation', key: 'designation', width: 25 },
          { header: 'Department', key: 'department', width: 30 },
          { header: 'Institution', key: 'institution', width: 35 },
          { header: 'Status', key: 'status', width: 15 },
        ];

        const headerRow = existingSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFA500' }, // Orange for existing
        };

        existingStaff.forEach(staff => existingSheet.addRow({
          row: staff.row,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          designation: staff.designation,
          department: staff.department,
          institution: staff.institutionName,
          status: 'Already Exists',
        }));

        const existingFilePath = path.join(outputDir, `existing_users_${timestamp}.xlsx`);
        await existingWorkbook.xlsx.writeFile(existingFilePath);
        console.log(`✓ Existing users Excel: ${existingFilePath}`);
      }

      // Create Excel file for error users
      if (errors.length > 0) {
        const errorWorkbook = new ExcelJS.Workbook();
        const errorSheet = errorWorkbook.addWorksheet('Error Users');

        errorSheet.columns = [
          { header: 'Row', key: 'row', width: 8 },
          { header: 'Name', key: 'name', width: 30 },
          { header: 'Email', key: 'email', width: 35 },
          { header: 'Phone', key: 'phone', width: 15 },
          { header: 'Designation', key: 'designation', width: 25 },
          { header: 'Department', key: 'department', width: 30 },
          { header: 'Institution', key: 'institution', width: 35 },
          { header: 'Error', key: 'errorMessage', width: 50 },
        ];

        const headerRow = errorSheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCB' }, // Light red
        };

        errors.forEach(err => errorSheet.addRow({
          row: err.row,
          name: err.name,
          email: err.email,
          phone: err.phone,
          designation: err.designation,
          department: err.department,
          institution: err.institutionName,
          errorMessage: err.errorMessage,
        }));

        const errorFilePath = path.join(outputDir, `error_users_${timestamp}.xlsx`);
        await errorWorkbook.xlsx.writeFile(errorFilePath);
        console.log(`✓ Error users Excel: ${errorFilePath}`);
      }

      console.log('\nTo actually create the users, run with --execute flag:');
      console.log(`  npx ts-node scripts/bulk-upload-faculty.ts "${resolvedPath}" --execute`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
