import { PrismaClient, TrainingDeliveryMode, TrainingDifficulty, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Path to the Excel file
const EXCEL_FILE_PATH = 'D:\\placeintern\\FDP 2026 Annual Training Plan (Final) .xlsx';

interface TrainingData {
  title: string;
  description?: string;
  trainingDomain?: string;
  providedBy?: string;
  startDate: Date;
  endDate: Date;
  duration?: number;
  applicationDeadline: Date;
  deliveryMode: TrainingDeliveryMode;
  venue?: string;
  city?: string;
  state: string;
  capacity: number;
  difficulty: TrainingDifficulty;
  cost?: number;
  learningOutcomes?: string[];
  designation?: string;
  targetBranchNames: string[]; // Branch names from Excel
  isActive: boolean;
  isPublished: boolean;
}

// Mapping of Excel participant descriptions to branch codes/names
const BRANCH_MAPPING: { [key: string]: string[] } = {
  'cse': ['CSE', 'Computer Science and Engineering', 'Computer Science', 'Computer Engineering'],
  'it': ['IT', 'Information Technology'],
  'ece': ['ECE', 'Electronics and Communication Engineering', 'Electronics'],
  'ee': ['EE', 'Electrical Engineering', 'Electrical'],
  'me': ['ME', 'Mechanical Engineering', 'Mechanical'],
  'ce': ['CE', 'Civil Engineering', 'Civil'],
  'applied science': ['Applied Science', 'Applied Sciences', 'Science'],
  'maths': ['Mathematics', 'Maths', 'Applied Science - Maths'],
  'pharmacy': ['Pharmacy', 'Pharmaceutical'],
  'textile': ['Textile', 'Textile Technology', 'Fashion & Garment Technology', 'Fashion'],
  'architecture': ['Architecture', 'Architectural Assistantship'],
  'mlt': ['MLT', 'Medical Laboratory Technology'],
  'chemical': ['Chemical', 'Chemical Engineering', 'Chem. Engg.'],
  'mop': ['MOP', 'Modern Office Practice'],
  'leather': ['Leather', 'Leather Technology'],
  'automobile': ['Automobile', 'Automobile Engineering'],
};

/**
 * Parse target branches from eligible participants text
 * Maps Excel branch names to database branch codes:
 * - AA: AA Department (Architecture)
 * - AS: Applied Science
 * - CE: Civil Engineering
 * - CSE: Computer Science & Engineering
 * - ECE: Electronics & Communication
 * - EE: Electrical Engineering
 * - FGT: Fashion & Garment Tech
 * - IT: Information Technology
 * - LT: Leather Technology
 * - ME: Mechanical Engineering
 * - MLT: Medical Laboratory Tech
 * - PH: Pharmacy
 * - TT: Textile Technology
 */
function parseTargetBranches(participantsText: string): string[] {
  if (!participantsText) return [];

  // Normalize text: lowercase, replace special chars with spaces
  const text = participantsText.toLowerCase().trim()
    .replace(/&/g, ' ')  // "CSE & IT" -> "CSE   IT"
    .replace(/,/g, ' ')  // "CSE, IT" -> "CSE  IT"
    .replace(/\+/g, ' ') // "CSE + IT" -> "CSE   IT"
    .replace(/\//g, ' ') // "CSE/IT" -> "CSE IT"
    .replace(/\s+/g, ' '); // normalize multiple spaces

  const branches: Set<string> = new Set();

  // Check for general terms first (ALL branches)
  if (
    text.includes('all faculty') ||
    text.includes('all branches') ||
    text.includes('participants from all') ||
    text.includes('faculty mentors') ||
    text.includes('all polytechnic') ||
    /\bprincipal\b/.test(text) ||
    /\bhods?\b/.test(text) ||
    /\btpo\b/.test(text)
  ) {
    return ['ALL'];
  }

  // CSE - Computer Science & Engineering
  if (/\bcse\b/.test(text) || /\bcomputer\s*(science|engg?|engineering)\b/.test(text)) {
    branches.add('CSE');
  }

  // IT - Information Technology
  if (/\bit\b/.test(text) || /\binformation\s*technology\b/.test(text)) {
    branches.add('IT');
  }

  // ECE - Electronics & Communication
  if (/\bece\b/.test(text) || /\belectronics\b/.test(text)) {
    branches.add('ECE');
  }

  // EE - Electrical Engineering
  if (/\bee\b/.test(text) || /\belectrical\b/.test(text)) {
    branches.add('EE');
  }

  // ME - Mechanical Engineering
  if (/\bme\b/.test(text) || /\bmechanical\b/.test(text)) {
    branches.add('ME');
  }

  // CE - Civil Engineering (strict matching to avoid matching "Science")
  if (/\bce\b/.test(text) || /\bcivil\b/.test(text)) {
    branches.add('CE');
  }

  // AS - Applied Science / Maths
  if (/\bapplied\s*science\b/.test(text) || /\bmaths?\b/.test(text) || /\bas\b/.test(text)) {
    branches.add('AS');
  }

  // PH - Pharmacy
  if (/\bpharmacy\b/.test(text) || /\bph\b/.test(text) || /\bpharmaceutical\b/.test(text)) {
    branches.add('PH');
  }

  // TT - Textile Technology
  if (/\btextile\b/.test(text) || /\btt\b/.test(text)) {
    branches.add('TT');
  }

  // FGT - Fashion & Garment Technology
  if (/\bfashion\b/.test(text) || /\bgarment\b/.test(text) || /\bfgt\b/.test(text) || /\bapparel\b/.test(text)) {
    branches.add('FGT');
  }

  // AA - Architectural Assistantship
  if (/\barchitecture\b/.test(text) || /\barchitectural\b/.test(text) || /\baa\b/.test(text)) {
    branches.add('AA');
  }

  // MLT - Medical Laboratory Technology
  if (/\bmlt\b/.test(text) || /\bmedical\s*laboratory\b/.test(text)) {
    branches.add('MLT');
  }

  // LT - Leather Technology
  if (/\bleather\b/.test(text) || /\blt\b/.test(text)) {
    branches.add('LT');
  }

  return Array.from(branches);
}

/**
 * Parse month and year from various formats
 */
function parseMonthYear(monthStr: string, year: number = 2026): { month: number; year: number } {
  const monthMap: { [key: string]: number } = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11,
  };

  const normalized = monthStr.toLowerCase().trim();

  // Check for month name
  for (const [key, value] of Object.entries(monthMap)) {
    if (normalized.includes(key)) {
      // All trainings are in 2026
      return { month: value, year: 2026 };
    }
  }

  return { month: 0, year: 2026 };
}

/**
 * Parse date range from various formats
 */
function parseDateRange(dateStr: string, currentMonth: number, currentYear: number): { startDate: Date; endDate: Date } {
  if (!dateStr || dateStr.toString().trim() === '') {
    // Default to first of the month
    return {
      startDate: new Date(currentYear, currentMonth, 1),
      endDate: new Date(currentYear, currentMonth, 1),
    };
  }

  const str = dateStr.toString().trim();

  // Pattern: "28th - 30th Jan" or "16th - 17th Feb" or "9th - 13th Feb"
  const rangeMatch = str.match(/(\d+)(?:st|nd|rd|th)?\s*[-–]\s*(\d+)(?:st|nd|rd|th)?/);
  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1]);
    const endDay = parseInt(rangeMatch[2]);
    return {
      startDate: new Date(currentYear, currentMonth, startDay),
      endDate: new Date(currentYear, currentMonth, endDay),
    };
  }

  // Pattern: "16th Feb" or "16th February"
  const singleMatch = str.match(/(\d+)(?:st|nd|rd|th)?/);
  if (singleMatch) {
    const day = parseInt(singleMatch[1]);
    return {
      startDate: new Date(currentYear, currentMonth, day),
      endDate: new Date(currentYear, currentMonth, day),
    };
  }

  // Default
  return {
    startDate: new Date(currentYear, currentMonth, 1),
    endDate: new Date(currentYear, currentMonth, 1),
  };
}

/**
 * Parse duration in hours from various formats
 */
function parseDuration(durationStr: string): number | undefined {
  if (!durationStr) return undefined;

  const str = durationStr.toString().toLowerCase().trim();

  // "3 days" -> 24 hours
  const daysMatch = str.match(/(\d+)\s*days?/);
  if (daysMatch) {
    return parseInt(daysMatch[1]) * 8; // 8 hours per day
  }

  // "2 weeks" -> 80 hours (2 weeks * 5 days * 8 hours)
  const weeksMatch = str.match(/(\d+)\s*weeks?/);
  if (weeksMatch) {
    return parseInt(weeksMatch[1]) * 5 * 8;
  }

  // "24 hours"
  const hoursMatch = str.match(/(\d+)\s*hours?/);
  if (hoursMatch) {
    return parseInt(hoursMatch[1]);
  }

  // Just a number
  const numberMatch = str.match(/(\d+)/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1]);
    // If less than 20, assume days, otherwise hours
    return num < 20 ? num * 8 : num;
  }

  return undefined;
}

/**
 * Parse cost from various formats
 */
function parseCost(costStr: string): number | undefined {
  if (!costStr) return undefined;

  const str = costStr.toString().toLowerCase().trim();

  if (str.includes('free') || str.includes('no cost')) {
    return 0;
  }

  // Extract numbers
  const match = str.match(/(\d+[\d,]*)/);
  if (match) {
    return parseFloat(match[1].replace(/,/g, ''));
  }

  return undefined;
}

/**
 * Determine delivery mode based on venue/location
 */
function determineDeliveryMode(venue?: string): TrainingDeliveryMode {
  if (!venue) return TrainingDeliveryMode.OFFLINE;

  const lowerVenue = venue.toLowerCase();
  if (lowerVenue.includes('online') || lowerVenue.includes('virtual')) {
    return TrainingDeliveryMode.ONLINE;
  }
  if (lowerVenue.includes('hybrid')) {
    return TrainingDeliveryMode.HYBRID;
  }
  return TrainingDeliveryMode.OFFLINE;
}

/**
 * Determine difficulty based on training title and domain
 */
function determineDifficulty(title: string, domain: string): TrainingDifficulty {
  const text = (title + ' ' + domain).toLowerCase();

  if (text.includes('basic') || text.includes('introduction') || text.includes('fundamentals')) {
    return TrainingDifficulty.BEGINNER;
  }
  if (text.includes('advanced') || text.includes('advance')) {
    return TrainingDifficulty.ADVANCED;
  }
  return TrainingDifficulty.INTERMEDIATE;
}

/**
 * Parse Excel file and extract training data - ONLY POLYTECHNIC WING
 */
function parseExcelFile(): TrainingData[] {
  console.log(`Reading Excel file from: ${EXCEL_FILE_PATH}`);

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetName = 'Training Plan';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "Training Plan" not found in workbook`);
  }

  // Convert to JSON
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${rawData.length} rows in Training Plan sheet`);

  const trainings: TrainingData[] = [];
  let currentMonth = 'January';
  let currentYear = 2026;
  let currentWing = '';
  let currentDomain = '';
  let skipRows = true; // Skip header rows

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    // Column mapping based on actual structure
    const monthCol = row['FDP Training Calendar 2026-2027'];
    const wingCol = row['__EMPTY'];
    const domainCol = row['__EMPTY_1'];
    const titleCol = row['__EMPTY_2'];
    const participantsCol = row['__EMPTY_3'];
    const capacityCol = row['__EMPTY_4'];
    const durationCol = row['__EMPTY_5'];
    const datesCol = row['__EMPTY_6'];
    const providerCol = row['__EMPTY_7'];
    const budgetCol = row['__EMPTY_8'];
    const locationCol = row['__EMPTY_9'];
    const outcomesCol = row['__EMPTY_10'];

    // Skip header row
    if (monthCol === 'Tentative Month') {
      skipRows = false;
      continue;
    }

    if (skipRows) continue;

    // Update current month if provided
    if (monthCol && monthCol.toString().trim().length > 0) {
      const monthValue = monthCol.toString().trim();
      const monthLower = monthValue.toLowerCase();
      const isMonth = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december']
                      .some(m => monthLower.includes(m));

      if (isMonth) {
        const parsed = parseMonthYear(monthValue);
        currentMonth = monthValue;
        currentYear = parsed.year;
      }
    }

    // Update current wing if provided
    if (wingCol && wingCol.toString().trim().length > 0) {
      currentWing = wingCol.toString().trim();
    }

    // Update current domain if provided
    if (domainCol && domainCol.toString().trim().length > 0) {
      currentDomain = domainCol.toString().trim();
    }

    // FILTER: Only process Polytechnic Wing trainings
    if (!currentWing.toLowerCase().includes('polytechnic')) {
      continue;
    }

    // Check if this row has a title (actual training data)
    if (!titleCol || titleCol.toString().trim() === '') {
      continue;
    }

    try {
      const title = titleCol.toString().trim()
        .replace(/\r\n/g, ' ')
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ');

      const capacity = capacityCol ? parseInt(capacityCol.toString()) : 50;
      const duration = parseDuration(durationCol?.toString() || '');
      const cost = parseCost(budgetCol?.toString() || '');

      // Parse dates
      const { month, year } = parseMonthYear(currentMonth, currentYear);
      const { startDate, endDate } = parseDateRange(datesCol?.toString() || '', month, year);

      // Application deadline is 7 days before start date
      const applicationDeadline = new Date(startDate);
      applicationDeadline.setDate(applicationDeadline.getDate() - 7);

      // Parse location
      const venue = locationCol?.toString().trim();
      const deliveryMode = determineDeliveryMode(venue);

      // Parse learning outcomes
      let learningOutcomes: string[] | undefined;
      if (outcomesCol) {
        const outcomesStr = outcomesCol.toString().trim();
        if (outcomesStr) {
          learningOutcomes = [outcomesStr];
        }
      }

      // Parse target branches from participants column
      const participantsText = participantsCol?.toString() || '';
      const targetBranchNames = parseTargetBranches(participantsText);

      // Determine difficulty
      const difficulty = determineDifficulty(title, currentDomain);

      // Clean up participants text for designation field
      const designation = participantsText
        .replace(/\r\n/g, ', ')
        .replace(/\n/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();

      const training: TrainingData = {
        title,
        description: currentDomain || undefined,
        trainingDomain: currentDomain || undefined,
        providedBy: providerCol?.toString().trim(),
        startDate,
        endDate,
        duration,
        applicationDeadline,
        deliveryMode,
        venue,
        city: venue,
        state: 'Punjab',
        capacity: isNaN(capacity) ? 50 : capacity,
        difficulty,
        cost,
        learningOutcomes,
        designation,
        targetBranchNames,
        isActive: true,
        isPublished: true,
      };

      trainings.push(training);

      console.log(`Parsed: ${title.substring(0, 50)}... | Branches: ${targetBranchNames.join(', ') || 'None'}`);

    } catch (error) {
      console.error(`Error parsing row ${i + 1}:`, error);
      console.error('Row data:', row);
    }
  }

  return trainings;
}

/**
 * Get a seed owner ID (system admin or state directorate)
 */
async function getSeedOwnerId(): Promise<string> {
  const preferred = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: [Role.SYSTEM_ADMIN, Role.STATE_DIRECTORATE] },
    },
    select: { id: true },
  });

  if (preferred) {
    return preferred.id;
  }

  const anyActive = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true },
  });

  if (!anyActive) {
    throw new Error('No active user found to assign as createdById.');
  }

  return anyActive.id;
}

/**
 * Get the Faculty Training Feedback Form ID
 */
async function getFeedbackFormId(): Promise<string | null> {
  const feedbackForm = await prisma.feedbackForm.findFirst({
    where: {
      title: 'Faculty Training Feedback',
      purpose: 'TRAINING',
    },
    select: { id: true },
  });

  return feedbackForm?.id || null;
}

/**
 * Get all branches for matching
 */
async function getAllBranches(): Promise<Map<string, string>> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, shortName: true, code: true },
  });

  const branchMap = new Map<string, string>();

  for (const branch of branches) {
    // Map by various names
    branchMap.set(branch.name.toLowerCase(), branch.id);
    branchMap.set(branch.shortName.toLowerCase(), branch.id);
    branchMap.set(branch.code.toLowerCase(), branch.id);
  }

  return branchMap;
}

/**
 * Match branch names to branch IDs
 */
function matchBranches(targetBranchNames: string[], branchMap: Map<string, string>, allBranchIds: string[]): string[] {
  if (targetBranchNames.includes('ALL')) {
    return allBranchIds;
  }

  const matchedIds: Set<string> = new Set();

  for (const branchName of targetBranchNames) {
    const lowerName = branchName.toLowerCase();

    // Try exact match
    if (branchMap.has(lowerName)) {
      matchedIds.add(branchMap.get(lowerName)!);
      continue;
    }

    // Try partial match
    for (const [key, id] of branchMap.entries()) {
      if (key.includes(lowerName) || lowerName.includes(key)) {
        matchedIds.add(id);
      }
    }
  }

  return Array.from(matchedIds);
}

/**
 * Main seeding function
 */
async function main() {
  console.log('=== Seeding Faculty Trainings 2026-2027 (Polytechnic Wing Only) ===\n');

  const createdById = await getSeedOwnerId();
  console.log(`Using creator ID: ${createdById}\n`);

  // Get feedback form ID
  const feedbackFormId = await getFeedbackFormId();
  if (feedbackFormId) {
    console.log(`Found Faculty Training Feedback Form: ${feedbackFormId}\n`);
  } else {
    console.log('Warning: Faculty Training Feedback Form not found. Run seed:faculty-training-feedback first.\n');
  }

  // Get all branches
  const branchMap = await getAllBranches();
  const allBranches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const allBranchIds = allBranches.map(b => b.id);
  console.log(`Found ${allBranchIds.length} active branches\n`);

  // Parse Excel file
  let trainingsData: TrainingData[];
  try {
    trainingsData = parseExcelFile();
  } catch (error) {
    console.error('\nFailed to parse Excel file:', error);
    console.error('\nPlease ensure:');
    console.error('1. The Excel file exists at:', EXCEL_FILE_PATH);
    console.error('2. npm install xlsx is installed (run: npm install xlsx)');
    console.error('3. The file is not corrupted or password-protected');
    throw error;
  }

  console.log(`\nParsed ${trainingsData.length} Polytechnic Wing trainings from Excel\n`);

  // Display summary of parsed data
  console.log('=== Training Summary by Month ===');
  const byMonth: { [key: string]: number } = {};
  trainingsData.forEach(t => {
    const monthKey = `${t.startDate.getFullYear()}-${String(t.startDate.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
  });
  Object.entries(byMonth).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} trainings`);
  });
  console.log();

  // Display summary by domain
  console.log('=== Training Summary by Domain ===');
  const byDomain: { [key: string]: number } = {};
  trainingsData.forEach(t => {
    const domain = t.trainingDomain || 'Unknown';
    byDomain[domain] = (byDomain[domain] || 0) + 1;
  });
  Object.entries(byDomain).sort((a, b) => b[1] - a[1]).forEach(([domain, count]) => {
    console.log(`  ${domain}: ${count} trainings`);
  });
  console.log();

  // Seed trainings
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [index, trainingData] of trainingsData.entries()) {
    const progress = `[${index + 1}/${trainingsData.length}]`;

    try {
      // Match branch names to IDs
      const branchIds = matchBranches(trainingData.targetBranchNames, branchMap, allBranchIds);

      // Check if training already exists (by title and start date)
      const existing = await prisma.training.findFirst({
        where: {
          title: trainingData.title,
          startDate: trainingData.startDate,
        },
        select: { id: true },
      });

      const trainingPayload = {
        title: trainingData.title,
        description: trainingData.description,
        providedBy: trainingData.providedBy,
        startDate: trainingData.startDate,
        endDate: trainingData.endDate,
        duration: trainingData.duration,
        applicationDeadline: trainingData.applicationDeadline,
        deliveryMode: trainingData.deliveryMode,
        venue: trainingData.venue,
        city: trainingData.city,
        state: trainingData.state,
        capacity: trainingData.capacity,
        difficulty: trainingData.difficulty,
        cost: trainingData.cost,
        learningOutcomes: trainingData.learningOutcomes as any,
        designation: trainingData.designation,
        isActive: trainingData.isActive,
        isPublished: trainingData.isPublished,
        feedbackFormId: feedbackFormId || undefined,
        createdById,
      };

      if (existing) {
        await prisma.training.update({
          where: { id: existing.id },
          data: {
            ...trainingPayload,
            targetBranches: {
              set: branchIds.map(id => ({ id })),
            },
          },
        });
        console.log(`${progress} Updated: ${trainingData.title.substring(0, 50)}...`);
        updated++;
      } else {
        await prisma.training.create({
          data: {
            ...trainingPayload,
            targetBranches: {
              connect: branchIds.map(id => ({ id })),
            },
          },
        });
        console.log(`${progress} Created: ${trainingData.title.substring(0, 50)}...`);
        created++;
      }
    } catch (error) {
      console.error(`${progress} Failed: ${trainingData.title.substring(0, 50)}...`);
      console.error('  Error:', error instanceof Error ? error.message : error);
      skipped++;
    }
  }

  console.log('\n=== Seeding Complete ===');
  console.log(`Total Polytechnic Wing trainings: ${trainingsData.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log('========================\n');
}

main()
  .catch((error) => {
    console.error('\nSeed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
