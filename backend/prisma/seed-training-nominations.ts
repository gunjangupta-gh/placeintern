import { PrismaClient, TrainingApplicationStatus, Role } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as XLSX from 'xlsx';
import 'dotenv/config';

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-d');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const FILE_PATH_ARG = args.find(arg => !arg.startsWith('-'));

if (DRY_RUN) {
  console.log('\n*** DRY RUN MODE - No changes will be made to the database ***\n');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Path to the Excel file
const EXCEL_FILE_PATH = FILE_PATH_ARG || process.env.EXCEL_FILE_PATH || 'D:\\placeintern\\FDP 2026 Annual Training Plan (Final) .xlsx';

interface NominationData {
  trainingTitle: string;
  trainingMonth: string;
  trainingDates: string;
  facultyName: string;
  designation: string;
  phone: string;
  email: string;
  college: string;
  course: string;
  needsAccommodation: boolean;
}

interface TrainingBlock {
  title: string;
  month: string;
  dates: string;
  nominations: NominationData[];
}

interface PendingApplication {
  nomination: NominationData;
  trainingId: string;
  trainingTitle: string;
  userId: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Check if a string looks like a training title
 */
function isTrainingTitle(text: string): boolean {
  if (!text || text.length < 5) return false;
  const lower = text.toLowerCase();

  const trainingKeywords = [
    'nielet', 'nielit', 'ropar', 'batch', 'big data', 'data science',
    'arduino', 'cyber', 'plc', 'scada', 'cad', 'cam', 'design thinking',
    'soft skill', 'leadership', 'rti', 'audit', 'budget', 'textile',
    'pharmacy', 'automation', 'innovation', 'wadhwani', 'mlt', 'architecture',
    'leather', 'quality control', 'ai tools', 'digital', 'mentoring',
    'fdp', 'workshop', 'training', 'professional', 'technical',
    'mgsipa', 'c-dac', 'cdac', 'iim', 'iit', 'niift', 'apprel', 'apparel',
    'workplace', 'professionalism', 'teamwork', 'time management',
    'ctr', 'mrs ptu', 'data handling', 'analytics'
  ];

  if (text.match(/^\d+(?:st|nd|rd|th)?\s*[-–]\s*\d+(?:st|nd|rd|th)?/)) return false;
  if (text.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s*\(/i)) return false;

  for (const keyword of trainingKeywords) {
    if (lower.includes(keyword)) return true;
  }

  if (lower.includes('govt') || lower.includes('college') || lower.includes('centre')) return true;

  return false;
}

/**
 * Parse the Nominations sheet
 */
function parseNominationsSheet(): TrainingBlock[] {
  console.log(`Reading Excel file from: ${EXCEL_FILE_PATH}`);

  const workbook = XLSX.readFile(EXCEL_FILE_PATH);
  const sheetName = 'Nominations';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Sheet "Nominations" not found in workbook`);
  }

  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`Found ${rawData.length} rows in Nominations sheet`);

  const trainingBlocks: TrainingBlock[] = [];
  let currentBlock: TrainingBlock | null = null;
  let inDataSection = false;

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];

    const col0 = row['__EMPTY']?.toString().trim() || '';
    const col1 = row['__EMPTY_1']?.toString().trim() || '';
    const col2 = row['__EMPTY_2']?.toString().trim() || '';
    const col3 = row['__EMPTY_3']?.toString().trim() || '';
    const col4 = row['__EMPTY_4']?.toString().trim() || '';
    const col5 = row['__EMPTY_5']?.toString().trim() || '';
    const col6 = row['__EMPTY_6']?.toString().trim() || '';
    const col7 = row['__EMPTY_7']?.toString().trim() || '';
    const col8 = row['__EMPTY_8']?.toString().trim() || '';

    const isMonthRow = col0 &&
      (col0.match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s*\(/i));

    const isDatesRow = col0 && col0.match(/\d+(?:st|nd|rd|th)?\s*[-–]\s*\d+(?:st|nd|rd|th)?.*\d{4}/i);

    const isHeaderRow = col0.toLowerCase() === 'sr. no.' || col1?.toLowerCase() === 'month';
    const isFacultySubHeader = col4?.toLowerCase() === 'name' || col5?.toLowerCase() === 'designation';
    const isDetailsHeader = col1?.toLowerCase().includes('details');

    const couldBeTitle = col0 && !col1 && !col2 && !col3 &&
      !isMonthRow && !isDatesRow && !isHeaderRow && !isFacultySubHeader && !isDetailsHeader &&
      col0.length > 5 &&
      !col0.match(/^\d+$/);

    if (couldBeTitle && isTrainingTitle(col0)) {
      if (currentBlock && currentBlock.nominations.length > 0) {
        trainingBlocks.push(currentBlock);
      }
      currentBlock = {
        title: col0,
        month: '',
        dates: '',
        nominations: [],
      };
      inDataSection = false;
      continue;
    }

    if (isMonthRow && currentBlock) {
      currentBlock.month = col0;
      continue;
    }

    if (isDatesRow && currentBlock) {
      currentBlock.dates = col0;
      continue;
    }

    if (isHeaderRow || isFacultySubHeader || isDetailsHeader) {
      inDataSection = true;
      continue;
    }

    if (currentBlock && inDataSection) {
      const month = col1;
      const college = col2;
      const course = col3;
      const facultyName = col4;
      const designation = col5;
      const phone = col6;
      const email = col7;
      const needsAccommodation = col8?.toLowerCase() === 'yes';

      if (facultyName && college && facultyName.length > 1 && !facultyName.toLowerCase().includes('name')) {
        const nomination: NominationData = {
          trainingTitle: currentBlock.title,
          trainingMonth: currentBlock.month || month,
          trainingDates: currentBlock.dates,
          facultyName,
          designation,
          phone: phone?.toString().replace(/[^0-9]/g, '') || '',
          email: email?.toLowerCase().trim() || '',
          college,
          course,
          needsAccommodation,
        };

        currentBlock.nominations.push(nomination);
      }
    }
  }

  if (currentBlock && currentBlock.nominations.length > 0) {
    trainingBlocks.push(currentBlock);
  }

  return trainingBlocks;
}

/**
 * Find matching training in database by title keywords
 */
async function findMatchingTraining(block: TrainingBlock): Promise<{ id: string; title: string } | null> {
  const blockTitle = block.title.toLowerCase();

  const trainings = await prisma.training.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      startDate: true,
      providedBy: true,
    },
  });

  const keywords: string[] = [];

  // Extract keywords from block title
  if (blockTitle.includes('nielet') || blockTitle.includes('nielit')) keywords.push('nielet', 'nielit');
  if (blockTitle.includes('big data')) keywords.push('big data');
  if (blockTitle.includes('data science')) keywords.push('data science');
  if (blockTitle.includes('cyber')) keywords.push('cyber');
  if (blockTitle.includes('arduino')) keywords.push('arduino');
  if (blockTitle.includes('plc') || blockTitle.includes('scada')) keywords.push('plc', 'scada', 'automation');
  if (blockTitle.includes('cad') || blockTitle.includes('cam')) keywords.push('cad', 'cam');
  if (blockTitle.includes('design thinking')) keywords.push('design thinking');
  if (blockTitle.includes('soft skill')) keywords.push('soft skill');
  if (blockTitle.includes('wadhwani')) keywords.push('wadhwani', 'professional readiness');
  if (blockTitle.includes('textile') || blockTitle.includes('apparel') || blockTitle.includes('apprel')) {
    keywords.push('textile', 'apparel', 'apprel');
  }
  if (blockTitle.includes('architecture')) keywords.push('architecture');
  if (blockTitle.includes('leather')) keywords.push('leather');
  if (blockTitle.includes('pharmacy') || blockTitle.includes('drug')) keywords.push('pharmacy', 'drug');
  if (blockTitle.includes('mlt') || blockTitle.includes('hematology')) keywords.push('mlt', 'hematology');
  if (blockTitle.includes('immunoassay')) keywords.push('immunoassay');
  if (blockTitle.includes('quality control')) keywords.push('quality control');
  if (blockTitle.includes('ai tool')) keywords.push('ai tool');
  if (blockTitle.includes('mentoring')) keywords.push('mentoring');
  if (blockTitle.includes('leadership')) keywords.push('leadership');
  if (blockTitle.includes('audit') || blockTitle.includes('budget')) keywords.push('audit', 'budget');
  if (blockTitle.includes('rti')) keywords.push('rti');
  if (blockTitle.includes('office management') || blockTitle.includes('office automation')) keywords.push('office');
  if (blockTitle.includes('innovation mission')) keywords.push('innovation', 'design thinking');

  // Fix: Add workplace professionalism keywords
  if (blockTitle.includes('workplace') || blockTitle.includes('professionalism') || blockTitle.includes('teamwork')) {
    keywords.push('workplace', 'professionalism', 'teamwork', 'time management');
  }

  // Fix: Add textile/apparel training keywords
  if (blockTitle.includes('spinning') || blockTitle.includes('weaving')) {
    keywords.push('spinning', 'weaving', 'textile');
  }
  if (blockTitle.includes('faculty pro') || blockTitle.includes('skilling')) {
    keywords.push('textile', 'apparel', 'developments', 'spinning');
  }

  // Data handling keywords
  if (blockTitle.includes('data handling') || blockTitle.includes('analytics') || blockTitle.includes('excel')) {
    keywords.push('data handling', 'analytics', 'excel');
  }

  // Building maintenance
  if (blockTitle.includes('building maintenance') || blockTitle.includes('maintenance strategies')) {
    keywords.push('building maintenance', 'maintenance');
  }

  // Building industry linkages
  if (blockTitle.includes('building industry') || blockTitle.includes('industry linkages') || blockTitle.includes('industry safety')) {
    keywords.push('building industry', 'linkages', 'safety');
  }

  // Analytical techniques
  if (blockTitle.includes('analytical') || blockTitle.includes('analytical techniques')) {
    keywords.push('analytical', 'analytical techniques');
  }

  // Intellectual property / patent
  if (blockTitle.includes('intellectual property') || blockTitle.includes('patent') || blockTitle.includes('ipr')) {
    keywords.push('intellectual property', 'patent');
  }

  // Fashion / forecasting
  if (blockTitle.includes('fashion') || blockTitle.includes('forecasting') || blockTitle.includes('trend analysis')) {
    keywords.push('fashion', 'forecasting', 'trend');
  }

  // Hematology / biochemistry / MLT
  if (blockTitle.includes('hematology') || blockTitle.includes('biochemistry') || blockTitle.includes('urinalysis')) {
    keywords.push('hematology', 'biochemistry', 'urinalysis');
  }

  // Immunoassay
  if (blockTitle.includes('immunoassay') || blockTitle.includes('rapid test') || blockTitle.includes('diagnostic')) {
    keywords.push('immunoassay', 'rapid test', 'diagnostic');
  }

  // Drug discovery / pharmaceutical
  if (blockTitle.includes('drug discovery') || blockTitle.includes('drug') || blockTitle.includes('pharmaceutical')) {
    keywords.push('drug discovery', 'drug', 'advances');
  }

  // Extract batch number - handle multiple formats:
  // "Batch 1", "Batch 2", "1st Batch", "2nd Batch", "3rd Batch", etc.
  let blockBatchNum: string | null = null;

  // Try "Batch X" format first
  const batchMatch1 = blockTitle.match(/batch\s*(\d+)/i);
  if (batchMatch1) {
    blockBatchNum = batchMatch1[1];
  }

  // Try "Xst/nd/rd/th Batch" format (1st Batch, 2nd Batch, etc.)
  if (!blockBatchNum) {
    const batchMatch2 = blockTitle.match(/(\d+)(?:st|nd|rd|th)\s*batch/i);
    if (batchMatch2) {
      blockBatchNum = batchMatch2[1];
    }
  }

  let blockMonth = -1;
  const monthStr = (block.month || block.dates || '').toLowerCase();
  const monthMap: { [key: string]: number } = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3,
    'may': 4, 'june': 5, 'july': 6, 'august': 7,
    'september': 8, 'october': 9, 'november': 10, 'december': 11,
  };
  for (const [name, num] of Object.entries(monthMap)) {
    if (monthStr.includes(name)) {
      blockMonth = num;
      break;
    }
  }

  let bestMatch: { id: string; title: string; score: number } | null = null;

  for (const training of trainings) {
    let score = 0;
    const trainingTitle = training.title.toLowerCase();
    const trainingProvider = (training.providedBy || '').toLowerCase();

    for (const keyword of keywords) {
      if (trainingTitle.includes(keyword)) score += 15;
      if (trainingProvider.includes(keyword)) score += 10;
    }

    // Extract training batch number
    const trainingBatchMatch = training.title.match(/batch\s*(\d+)/i);
    const trainingBatchNum = trainingBatchMatch ? trainingBatchMatch[1] : null;

    // Batch matching is critical - if both have batch numbers, they MUST match
    if (blockBatchNum && trainingBatchNum) {
      if (blockBatchNum === trainingBatchNum) {
        score += 50; // Strong bonus for matching batch
      } else {
        score = -100; // Strong penalty - wrong batch, skip this training
        continue;
      }
    } else if (blockBatchNum && !trainingBatchNum) {
      // Block has batch but training doesn't - likely wrong training
      score -= 20;
    }

    if (blockMonth >= 0 && training.startDate) {
      const trainingMonth = training.startDate.getMonth();
      if (trainingMonth === blockMonth) {
        score += 10;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { id: training.id, title: training.title, score };
    }
  }

  if (bestMatch && bestMatch.score >= 15) {
    return { id: bestMatch.id, title: bestMatch.title };
  }

  return null;
}

/**
 * Clean and normalize email address
 */
function cleanEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Remove all spaces (fixes "gmail. com" -> "gmail.com")
    .replace(/\.+/g, '.'); // Normalize multiple dots
}

/**
 * Extract clean name without prefixes
 */
function cleanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(sh\.|smt\.|mr\.|mrs\.|ms\.|dr\.|prof\.)\s*/i, '')
    .replace(/^(shri|shrimati|kumar|kumari)\s*/i, '')
    .trim();
}

/**
 * Find matching user in database by email or phone
 */
async function findMatchingUser(nomination: NominationData): Promise<{ id: string; name: string; email: string | null } | null> {
  const roleFilter = { in: [Role.TEACHER, Role.PRINCIPAL, Role.FACULTY_COORDINATOR] as Role[] };

  // 1. Try exact email match first
  if (nomination.email && nomination.email.includes('@')) {
    const cleanedEmail = cleanEmail(nomination.email);

    const userByEmail = await prisma.user.findFirst({
      where: {
        email: cleanedEmail,
        role: roleFilter,
        active: true,
      },
      select: { id: true, name: true, email: true },
    });

    if (userByEmail) {
      return userByEmail;
    }

    // 2. Try partial email match (email username part)
    const emailUsername = cleanedEmail.split('@')[0];
    if (emailUsername.length >= 5) {
      const userByPartialEmail = await prisma.user.findFirst({
        where: {
          email: { contains: emailUsername, mode: 'insensitive' },
          role: roleFilter,
          active: true,
        },
        select: { id: true, name: true, email: true },
      });

      if (userByPartialEmail) {
        return userByPartialEmail;
      }
    }
  }

  // 3. Try phone match
  if (nomination.phone && nomination.phone.length >= 10) {
    const normalizedPhone = nomination.phone.slice(-10);

    const userByPhone = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneNo: normalizedPhone },
          { phoneNo: { endsWith: normalizedPhone } },
          { phoneNo: { contains: normalizedPhone } },
        ],
        role: roleFilter,
        active: true,
      },
      select: { id: true, name: true, email: true },
    });

    if (userByPhone) {
      return userByPhone;
    }
  }

  // 4. Try name match with cleaned names
  if (nomination.facultyName && nomination.facultyName.length > 2) {
    const cleanedName = cleanName(nomination.facultyName);
    const nameParts = cleanedName.split(/\s+/).filter(p => p.length > 1);

    // Try matching with multiple name parts first (more accurate)
    if (nameParts.length >= 2) {
      const userByFullName = await prisma.user.findFirst({
        where: {
          AND: [
            { name: { contains: nameParts[0], mode: 'insensitive' } },
            { name: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } },
          ],
          role: roleFilter,
          active: true,
        },
        select: { id: true, name: true, email: true },
      });

      if (userByFullName) {
        return userByFullName;
      }
    }

    // Try matching with last name only (less strict but catches more)
    if (nameParts.length >= 1) {
      const lastName = nameParts[nameParts.length - 1];
      if (lastName.length >= 4) {
        const userByLastName = await prisma.user.findFirst({
          where: {
            name: { contains: lastName, mode: 'insensitive' },
            role: roleFilter,
            active: true,
          },
          select: { id: true, name: true, email: true },
        });

        if (userByLastName) {
          return userByLastName;
        }
      }
    }
  }

  return null;
}

/**
 * Get reviewer ID for applications
 */
async function getReviewerId(): Promise<string> {
  const reviewer = await prisma.user.findFirst({
    where: {
      active: true,
      role: { in: [Role.STATE_DIRECTORATE, Role.SYSTEM_ADMIN] },
    },
    select: { id: true },
  });

  if (!reviewer) {
    throw new Error('No reviewer (STATE_DIRECTORATE or SYSTEM_ADMIN) found');
  }

  return reviewer.id;
}

/**
 * Main function
 */
async function main() {
  console.log('=== Seeding Training Nominations ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | Verbose: ${VERBOSE ? 'ON' : 'OFF'}\n`);

  // Parse nominations from Excel
  let trainingBlocks: TrainingBlock[];
  try {
    trainingBlocks = parseNominationsSheet();
  } catch (error) {
    console.error('Failed to parse Nominations sheet:', error);
    throw error;
  }

  console.log(`\nFound ${trainingBlocks.length} training blocks with nominations\n`);

  // Display summary
  console.log('=== Training Blocks Summary ===');
  for (const block of trainingBlocks) {
    console.log(`  "${block.title.substring(0, 60)}..." - ${block.nominations.length} nominations`);
  }
  console.log();

  const reviewerId = await getReviewerId();
  console.log(`Using reviewer ID: ${reviewerId}\n`);

  // Collect all pending applications
  const pendingApplications: PendingApplication[] = [];
  const skippedExisting: PendingApplication[] = [];
  const unmatchedTrainings: { title: string; count: number }[] = [];
  const unmatchedFaculty: NominationData[] = [];

  let totalNominations = 0;
  let matchedTrainings = 0;
  let matchedUsers = 0;

  for (const block of trainingBlocks) {
    console.log(`\n--- Processing: ${block.title.substring(0, 60)}... ---`);
    totalNominations += block.nominations.length;

    const matchedTraining = await findMatchingTraining(block);

    if (!matchedTraining) {
      console.log(`  [!] No matching training found`);
      unmatchedTrainings.push({ title: block.title, count: block.nominations.length });
      continue;
    }

    matchedTrainings++;
    console.log(`  [OK] Matched to: "${matchedTraining.title.substring(0, 50)}..."`);

    let blockMatched = 0;
    let blockPending = 0;
    let blockSkipped = 0;

    for (const nomination of block.nominations) {
      const matchedUser = await findMatchingUser(nomination);

      if (!matchedUser) {
        unmatchedFaculty.push(nomination);
        continue;
      }

      matchedUsers++;
      blockMatched++;

      // Check if application already exists
      const existingApplication = await prisma.trainingApplication.findFirst({
        where: {
          userId: matchedUser.id,
          trainingId: matchedTraining.id,
        },
      });

      const pendingApp: PendingApplication = {
        nomination,
        trainingId: matchedTraining.id,
        trainingTitle: matchedTraining.title,
        userId: matchedUser.id,
        userName: matchedUser.name,
        userEmail: matchedUser.email || undefined,
      };

      if (existingApplication) {
        skippedExisting.push(pendingApp);
        blockSkipped++;
      } else {
        pendingApplications.push(pendingApp);
        blockPending++;
      }
    }

    console.log(`  -> Matched: ${blockMatched}/${block.nominations.length} | To Create: ${blockPending} | Already Exists: ${blockSkipped}`);
  }

  // Display verbose output
  if (VERBOSE) {
    console.log('\n' + '='.repeat(80));
    console.log('=== APPLICATIONS TO BE CREATED ===');
    console.log('='.repeat(80));

    if (pendingApplications.length === 0) {
      console.log('  (none)');
    } else {
      // Group by training
      const byTraining = new Map<string, PendingApplication[]>();
      for (const app of pendingApplications) {
        const key = app.trainingTitle;
        if (!byTraining.has(key)) byTraining.set(key, []);
        byTraining.get(key)!.push(app);
      }

      for (const [trainingTitle, apps] of byTraining) {
        console.log(`\n  Training: ${trainingTitle.substring(0, 70)}`);
        console.log(`  ${'─'.repeat(70)}`);
        for (const app of apps) {
          console.log(`    + ${app.userName} (${app.userEmail || app.nomination.phone || 'no contact'})`);
          console.log(`      College: ${app.nomination.college}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('=== APPLICATIONS ALREADY EXISTING (WILL BE SKIPPED) ===');
    console.log('='.repeat(80));

    if (skippedExisting.length === 0) {
      console.log('  (none)');
    } else {
      const byTraining = new Map<string, PendingApplication[]>();
      for (const app of skippedExisting) {
        const key = app.trainingTitle;
        if (!byTraining.has(key)) byTraining.set(key, []);
        byTraining.get(key)!.push(app);
      }

      for (const [trainingTitle, apps] of byTraining) {
        console.log(`\n  Training: ${trainingTitle.substring(0, 70)}`);
        console.log(`  ${'─'.repeat(70)}`);
        for (const app of apps) {
          console.log(`    ~ ${app.userName} (${app.userEmail || 'no email'})`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('=== UNMATCHED TRAININGS ===');
    console.log('='.repeat(80));

    if (unmatchedTrainings.length === 0) {
      console.log('  (none)');
    } else {
      for (const t of unmatchedTrainings) {
        console.log(`  ! ${t.title}`);
        console.log(`    (${t.count} nominations will not be processed)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('=== UNMATCHED FACULTY ===');
    console.log('='.repeat(80));

    if (unmatchedFaculty.length === 0) {
      console.log('  (none)');
    } else {
      for (const f of unmatchedFaculty) {
        console.log(`  ? ${f.facultyName}`);
        console.log(`    Email: ${f.email || '(none)'} | Phone: ${f.phone || '(none)'}`);
        console.log(`    College: ${f.college}`);
        console.log(`    Training: ${f.trainingTitle.substring(0, 50)}`);
      }
    }
  }

  // Summary before action
  console.log('\n' + '='.repeat(60));
  console.log('=== SUMMARY ===');
  console.log('='.repeat(60));
  console.log(`Total nominations in Excel: ${totalNominations}`);
  console.log(`Training blocks matched: ${matchedTrainings}/${trainingBlocks.length}`);
  console.log(`Faculty users matched: ${matchedUsers}`);
  console.log(`Applications to create: ${pendingApplications.length}`);
  console.log(`Applications to skip (already exist): ${skippedExisting.length}`);
  console.log(`Unmatched trainings: ${unmatchedTrainings.length}`);
  console.log(`Unmatched faculty: ${unmatchedFaculty.length}`);
  console.log('='.repeat(60));

  // If dry run, stop here
  if (DRY_RUN) {
    console.log('\n*** DRY RUN COMPLETE - No changes were made ***');
    console.log('Run without --dry-run to apply changes.\n');
    return;
  }

  // Apply changes
  console.log('\n=== APPLYING CHANGES ===\n');

  let applicationsCreated = 0;
  let errors = 0;

  for (const app of pendingApplications) {
    try {
      await prisma.trainingApplication.create({
        data: {
          userId: app.userId,
          trainingId: app.trainingId,
          status: TrainingApplicationStatus.APPROVED,
          relevanceToTeaching: `Nominated for training from ${app.nomination.college}`,
          expectedApplication: `Course: ${app.nomination.course}`,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewComments: 'Pre-approved via Excel nomination import',
          isActive: true,
        },
      });

      applicationsCreated++;

      if (VERBOSE) {
        console.log(`  [+] Created: ${app.userName} -> ${app.trainingTitle.substring(0, 40)}...`);
      }
    } catch (error) {
      console.error(`  [ERR] ${app.nomination.facultyName}:`, error instanceof Error ? error.message : error);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('=== SEEDING COMPLETE ===');
  console.log('='.repeat(60));
  console.log(`Applications created: ${applicationsCreated}`);
  console.log(`Errors: ${errors}`);
  console.log('='.repeat(60));
  console.log();
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
