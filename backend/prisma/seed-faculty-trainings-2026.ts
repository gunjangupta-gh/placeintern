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
const EXCEL_FILE_PATH = 'D:\\chrome download\\FDP 2026 Annual Training Plan (Final) .xlsx';

interface TrainingData {
  title: string;
  description?: string;
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
  isActive: boolean;
  isPublished: boolean;
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
      // If month is Oct-Dec, it's probably 2026, otherwise 2027
      const actualYear = value >= 9 ? 2026 : 2027;
      return { month: value, year: actualYear };
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

  // Pattern: "28th - 30th Jan" or "16th - 17th Feb"
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
 * Parse Excel file and extract training data
 */
function parseExcelFile(): TrainingData[] {
  console.log(`Reading Excel file from: ${EXCEL_FILE_PATH}`);

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetName = workbook.SheetNames[0]; // "Training Plan"
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${rawData.length} rows in Excel file`);

  const trainings: TrainingData[] = [];
  let currentMonth = 'January';
  let currentYear = 2026;
  let currentCategory = '';
  let skipRows = true; // Skip header rows

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    // Column mapping based on actual structure
    const monthCol = row['FDP Training Calendar 2026-2027'];
    const titleCol = row['__EMPTY'];
    const participantsCol = row['__EMPTY_1'];
    const capacityCol = row['__EMPTY_2'];
    const durationCol = row['__EMPTY_3'];
    const datesCol = row['__EMPTY_4'];
    const providerCol = row['__EMPTY_5'];
    const budgetCol = row['__EMPTY_6'];
    const locationCol = row['__EMPTY_7'];
    const outcomesCol = row['__EMPTY_8'];

    // Skip header row
    if (monthCol === 'Tentative Month') {
      skipRows = false;
      continue;
    }

    if (skipRows) continue;

    // Check if this is a category header row
    if (monthCol && !titleCol && monthCol.toString().trim().length > 0) {
      const monthValue = monthCol.toString().trim();

      // Check if it's actually a month
      const monthLower = monthValue.toLowerCase();
      const isMonth = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december']
                      .some(m => monthLower.includes(m));

      if (isMonth) {
        const parsed = parseMonthYear(monthValue);
        currentMonth = monthValue;
        currentYear = parsed.year;
      } else {
        currentCategory = monthValue;
      }
      continue;
    }

    // Check if this row has a title (actual training data)
    if (!titleCol || titleCol.toString().trim() === '') {
      continue;
    }

    // If row has a month, update current month
    if (monthCol && monthCol.toString().trim().length > 0) {
      const monthLower = monthCol.toString().toLowerCase();
      const isMonth = ['january', 'february', 'march', 'april', 'may', 'june',
                       'july', 'august', 'september', 'october', 'november', 'december']
                      .some(m => monthLower.includes(m));

      if (isMonth) {
        const parsed = parseMonthYear(monthCol.toString());
        currentMonth = monthCol.toString();
        currentYear = parsed.year;
      }
    }

    try {
      const title = titleCol.toString().trim();
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

      // Determine difficulty based on participants
      let difficulty: TrainingDifficulty = TrainingDifficulty.INTERMEDIATE;
      if (participantsCol) {
        const participantsStr = participantsCol.toString().toLowerCase();
        if (participantsStr.includes('beginner') || participantsStr.includes('basic')) {
          difficulty = TrainingDifficulty.BEGINNER;
        } else if (participantsStr.includes('advanced') || participantsStr.includes('senior')) {
          difficulty = TrainingDifficulty.ADVANCED;
        }
      }

      const training: TrainingData = {
        title,
        description: currentCategory || undefined,
        providedBy: providerCol?.toString().trim(),
        startDate,
        endDate,
        duration,
        applicationDeadline,
        deliveryMode,
        venue,
        city: venue,
        state: 'Punjab', // All trainings are in Punjab based on the data
        capacity,
        difficulty,
        cost,
        learningOutcomes,
        designation: participantsCol?.toString().trim(),
        isActive: true,
        isPublished: true,
      };

      trainings.push(training);

      console.log(`Parsed: ${title} (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`);

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
 * Main seeding function
 */
async function main() {
  console.log('=== Seeding Faculty Trainings 2026-2027 ===\n');

  const createdById = await getSeedOwnerId();
  console.log(`Using creator ID: ${createdById}\n`);

  // Get feedback form ID
  const feedbackFormId = await getFeedbackFormId();
  if (feedbackFormId) {
    console.log(`✓ Found Faculty Training Feedback Form: ${feedbackFormId}\n`);
  } else {
    console.log('⚠ Warning: Faculty Training Feedback Form not found. Run seed:faculty-training-feedback first.\n');
  }

  // Parse Excel file
  let trainingsData: TrainingData[];
  try {
    trainingsData = parseExcelFile();
  } catch (error) {
    console.error('\n❌ Failed to parse Excel file:', error);
    console.error('\nPlease ensure:');
    console.error('1. The Excel file exists at:', EXCEL_FILE_PATH);
    console.error('2. npm install xlsx is installed (run: npm install xlsx)');
    console.error('3. The file is not corrupted or password-protected');
    throw error;
  }

  console.log(`\n✓ Parsed ${trainingsData.length} trainings from Excel\n`);

  // Display summary of parsed data
  console.log('=== Training Summary ===');
  const byMonth: { [key: string]: number } = {};
  trainingsData.forEach(t => {
    const monthKey = `${t.startDate.getFullYear()}-${String(t.startDate.getMonth() + 1).padStart(2, '0')}`;
    byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
  });
  Object.entries(byMonth).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} trainings`);
  });
  console.log();

  // Seed trainings
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const [index, trainingData] of trainingsData.entries()) {
    const progress = `[${index + 1}/${trainingsData.length}]`;

    try {
      // Check if training already exists (by title and start date)
      const existing = await prisma.training.findFirst({
        where: {
          title: trainingData.title,
          startDate: trainingData.startDate,
        },
        select: { id: true },
      });

      if (existing) {
        await prisma.training.update({
          where: { id: existing.id },
          data: {
            ...trainingData,
            learningOutcomes: trainingData.learningOutcomes as any,
            feedbackFormId: feedbackFormId || undefined,
            createdById,
          },
        });
        console.log(`${progress} ↻ Updated: ${trainingData.title}`);
        updated++;
      } else {
        await prisma.training.create({
          data: {
            ...trainingData,
            learningOutcomes: trainingData.learningOutcomes as any,
            feedbackFormId: feedbackFormId || undefined,
            createdById,
          },
        });
        console.log(`${progress} ✓ Created: ${trainingData.title}`);
        created++;
      }
    } catch (error) {
      console.error(`${progress} ✗ Failed: ${trainingData.title}`);
      console.error('  Error:', error instanceof Error ? error.message : error);
      skipped++;
    }
  }

  console.log('\n=== Seeding Complete ===');
  console.log(`Total trainings: ${trainingsData.length}`);
  console.log(`✓ Created: ${created}`);
  console.log(`↻ Updated: ${updated}`);
  console.log(`✗ Skipped: ${skipped}`);
  console.log('========================\n');
}

main()
  .catch((error) => {
    console.error('\n❌ Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
