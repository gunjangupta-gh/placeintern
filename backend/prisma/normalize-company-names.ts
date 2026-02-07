import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { ALL_ACTUAL_COMPANY_MAPPINGS } from './company-mappings-actual';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create Prisma client with pg adapter
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

/**
 * Company Name Normalization Script
 *
 * This script normalizes company names in InternshipApplications by:
 * - Handling case variations (UPPERCASE, lowercase, MixedCase)
 * - Expanding common abbreviations and shortforms
 * - Standardizing company name formats
 * - Removing extra whitespace and special characters
 *
 * Usage:
 *   npm run seed:normalize-companies           # Normal mode (applies changes)
 *   npm run seed:normalize-companies -- --dry-run         # Dry run mode (preview only)
 *   npm run seed:normalize-companies -- --verbose         # Verbose output
 *   npm run seed:normalize-companies -- --dry-run --verbose  # Both flags
 */

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

interface CompanyMapping {
  [key: string]: string;
}

// Common company name variations to normalized names
// These mappings are based on analysis of 1,495 actual applications with 619 unique company names
// Includes 400+ company name variations mapped to their normalized forms
// Add more mappings as you discover new patterns in your data
const COMPANY_NORMALIZATIONS: CompanyMapping = {
  ...ALL_ACTUAL_COMPANY_MAPPINGS,

  // Add any additional custom mappings here
  // 'your company variation': 'Normalized Company Name',
};

/**
 * Normalizes a company name using predefined rules
 */
function normalizeCompanyName(companyName: string | null): string | null {
  if (!companyName) return null;

  // Step 1: Trim and remove extra whitespace
  let normalized = sanitizeCompanyName(companyName);

  // Step 2: Convert to lowercase for lookup
  const lowerName = normalized.toLowerCase();

  // Step 3: Check if there's a predefined normalization
  if (COMPANY_NORMALIZATIONS[lowerName]) {
    return COMPANY_NORMALIZATIONS[lowerName];
  }

  // Step 4: Apply general normalization rules

  // Remove common suffixes for comparison (but keep original if no match)
  const suffixesToRemove = [
    ' ltd.',
    ' ltd',
    ' limited',
    ' pvt ltd',
    ' pvt. ltd.',
    ' private limited',
    ' inc.',
    ' inc',
    ' corporation',
    ' corp.',
    ' corp',
    ' llc',
    ' llp',
  ];

  let baseName = lowerName;
  for (const suffix of suffixesToRemove) {
    if (baseName.endsWith(suffix)) {
      baseName = baseName.substring(0, baseName.length - suffix.length).trim();
      break;
    }
  }

  // Check again after removing suffix
  if (COMPANY_NORMALIZATIONS[baseName]) {
    return COMPANY_NORMALIZATIONS[baseName];
  }

  // Step 5: Apply title case if no specific mapping found
  normalized = toTitleCase(normalized);

  return normalized;
}

/**
 * Basic cleanup for HTML entities and invisible characters
 */
function sanitizeCompanyName(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Decodes common HTML entities in company names
 */
function decodeHtmlEntities(input: string): string {
  let output = input;
  for (let i = 0; i < 3; i += 1) {
    const decoded = output
      .replace(/&amp;?/gi, '&')
      .replace(/&#38;/gi, '&')
      .replace(/&lt;?/gi, '<')
      .replace(/&gt;?/gi, '>')
      .replace(/&quot;?/gi, '"')
      .replace(/&#39;?/gi, "'")
      .replace(/&nbsp;?/gi, ' ')
      .replace(/&#x2f;?/gi, '/');

    if (decoded === output) break;
    output = decoded;
  }

  return output;
}

/**
 * Converts string to Title Case
 */
function toTitleCase(str: string): string {
  const smallWords = ['and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'ltd', 'pvt'];

  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Always capitalize first and last word
      if (index === 0 || index === str.split(' ').length - 1) {
        return capitalizeWord(word);
      }

      // Don't capitalize small words unless they're abbreviations
      if (smallWords.includes(word) && !isAbbreviation(word)) {
        return word;
      }

      return capitalizeWord(word);
    })
    .join(' ');
}

/**
 * Capitalizes a word, handling special cases
 */
function capitalizeWord(word: string): string {
  // Handle abbreviations (all caps)
  if (isAbbreviation(word)) {
    return word.toUpperCase();
  }

  // Handle hyphenated words
  if (word.includes('-')) {
    return word.split('-').map(part => capitalizeWord(part)).join('-');
  }

  // Standard capitalization
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Checks if a word is an abbreviation
 */
function isAbbreviation(word: string): boolean {
  const abbreviations = ['tcs', 'ibm', 'hcl', 'it', 'ai', 'ml', 'iot', 'hr', 'r&d', 'llc', 'llp', 'pvt', 'ltd'];
  return abbreviations.includes(word.toLowerCase()) || (word.length <= 3 && word === word.toUpperCase());
}

/**
 * Groups similar company names together
 */
function groupSimilarCompanies(companies: Array<{ name: string; count: number }>): Map<string, Array<{ original: string; count: number }>> {
  const groups = new Map<string, Array<{ original: string; count: number }>>();

  for (const company of companies) {
    const normalized = normalizeCompanyName(company.name);
    if (!normalized) continue;

    if (!groups.has(normalized)) {
      groups.set(normalized, []);
    }
    groups.get(normalized)!.push({ original: company.name, count: company.count });
  }

  return groups;
}

/**
 * Main execution function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Company Name Normalization Script                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  if (VERBOSE) {
    console.log('📢 VERBOSE MODE - Detailed output enabled\n');
  }

  // Step 1: Fetch all internship applications with company names
  console.log('📊 Fetching internship applications...');

  const applications = await prisma.internshipApplication.findMany({
    where: {
      isSelfIdentified: true,
      companyName: {
        not: null,
      },
    },
    select: {
      id: true,
      companyName: true,
      student: {
        select: {
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  console.log(`✅ Found ${applications.length} self-identified internship applications\n`);

  if (applications.length === 0) {
    console.log('ℹ️  No applications found. Exiting...');
    return;
  }

  // Step 2: Analyze company name variations
  console.log('🔍 Analyzing company name variations...\n');

  const companyNameCounts = new Map<string, number>();

  for (const app of applications) {
    if (app.companyName) {
      const count = companyNameCounts.get(app.companyName) || 0;
      companyNameCounts.set(app.companyName, count + 1);
    }
  }

  const uniqueCompanies = Array.from(companyNameCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  console.log(`📈 Statistics:`);
  console.log(`   - Total Applications: ${applications.length}`);
  console.log(`   - Unique Company Names: ${uniqueCompanies.length}\n`);

  if (VERBOSE) {
    console.log('📋 Top 20 Company Names (by frequency):\n');
    uniqueCompanies.slice(0, 20).forEach((company, index) => {
      console.log(`   ${(index + 1).toString().padStart(2)}. ${company.name.padEnd(50)} (${company.count} applications)`);
    });
    console.log('');
  }

  // Step 3: Group similar companies
  const groups = groupSimilarCompanies(uniqueCompanies);

  console.log(`🔄 Normalization Analysis:`);
  console.log(`   - Normalized Company Groups: ${groups.size}\n`);

  // Step 4: Show normalization plan
  const changesNeeded: Array<{
    applicationIds: string[];
    from: string;
    to: string;
    count: number;
  }> = [];

  if (VERBOSE) {
    console.log('📝 Normalization Plan:\n');
  }

  let groupIndex = 1;
  for (const [normalized, variations] of groups.entries()) {
    if (variations.length > 1 || variations[0].original !== normalized) {
      // There are variations or the original needs normalization

      if (VERBOSE) {
        console.log(`   ${groupIndex}. Normalizing to: "${normalized}"`);
        variations.forEach(variation => {
          if (variation.original !== normalized) {
            console.log(`      ← "${variation.original}" (${variation.count} applications)`);
          }
        });
        console.log('');
      }

      // Track changes for each variation
      for (const variation of variations) {
        if (variation.original !== normalized) {
          const affectedApps = applications
            .filter(app => app.companyName === variation.original)
            .map(app => app.id);

          changesNeeded.push({
            applicationIds: affectedApps,
            from: variation.original,
            to: normalized,
            count: affectedApps.length,
          });
        }
      }

      groupIndex++;
    }
  }

  // Step 5: Summary of changes
  const totalChanges = changesNeeded.reduce((sum, change) => sum + change.count, 0);

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`📊 Summary:`);
  console.log(`   - Total applications needing updates: ${totalChanges}`);
  console.log(`   - Number of different normalizations: ${changesNeeded.length}\n`);

  if (changesNeeded.length === 0) {
    console.log('✨ All company names are already normalized! No changes needed.\n');
    return;
  }

  // Show detailed change breakdown
  if (!VERBOSE && changesNeeded.length > 0) {
    console.log('📝 Changes to be applied:\n');
    changesNeeded.slice(0, 10).forEach((change, index) => {
      console.log(`   ${index + 1}. "${change.from}" → "${change.to}" (${change.count} applications)`);
    });

    if (changesNeeded.length > 10) {
      console.log(`   ... and ${changesNeeded.length - 10} more normalizations\n`);
    } else {
      console.log('');
    }
  }

  // Step 6: Apply changes (if not dry run)
  if (!DRY_RUN) {
    console.log('💾 Applying normalizations...\n');

    let updatedCount = 0;
    for (const change of changesNeeded) {
      try {
        const result = await prisma.internshipApplication.updateMany({
          where: {
            id: { in: change.applicationIds },
          },
          data: {
            companyName: change.to,
          },
        });

        updatedCount += result.count;

        if (VERBOSE) {
          console.log(`   ✅ Updated ${result.count} applications: "${change.from}" → "${change.to}"`);
        }
      } catch (error) {
        console.error(`   ❌ Error updating "${change.from}":`, error);
      }
    }

    console.log(`\n✅ Successfully normalized ${updatedCount} company names!\n`);
  } else {
    console.log('ℹ️  DRY RUN: No changes were applied. Run without --dry-run to apply changes.\n');
  }

  // Step 7: Final statistics
  if (!DRY_RUN && VERBOSE) {
    const finalCompanyCount = await prisma.internshipApplication.groupBy({
      by: ['companyName'],
      where: {
        isSelfIdentified: true,
        companyName: { not: null },
      },
      _count: true,
    });

    console.log('📈 Final Statistics:');
    console.log(`   - Unique company names after normalization: ${finalCompanyCount.length}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 Company Name Normalization Complete!\n');

  // Recommendations
  if (!DRY_RUN) {
    console.log('💡 Recommendations:');
    console.log('   1. Review the normalized names to ensure accuracy');
    console.log('   2. Add more mappings to COMPANY_NORMALIZATIONS for better coverage');
    console.log('   3. Run this script periodically to maintain data quality\n');
  }
}

// Execute the script
main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
