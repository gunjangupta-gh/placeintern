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
 * Populate Companies Script
 *
 * This script populates the Company table with unique normalized company names
 * and their address information extracted from InternshipApplications.
 *
 * Usage:
 *   npm run seed:populate-companies           # Normal mode (applies changes)
 *   npm run seed:populate-companies -- --dry-run         # Dry run mode (preview only)
 *   npm run seed:populate-companies -- --verbose         # Verbose output
 */

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

interface CompanyMapping {
  [key: string]: string;
}

// Company name mappings (same as normalize script)
const COMPANY_NORMALIZATIONS: CompanyMapping = {
  ...ALL_ACTUAL_COMPANY_MAPPINGS,
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
      if (index === 0 || index === str.split(' ').length - 1) {
        return capitalizeWord(word);
      }

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
  if (isAbbreviation(word)) {
    return word.toUpperCase();
  }

  if (word.includes('-')) {
    return word.split('-').map(part => capitalizeWord(part)).join('-');
  }

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
 * Main execution function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     Populate Companies Table Script                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be applied\n');
  }

  if (VERBOSE) {
    console.log('📢 VERBOSE MODE - Detailed output enabled\n');
  }

  // Step 1: Fetch all company data from internship applications
  console.log('📊 Fetching company data from internship applications...');

  const applications = await prisma.internshipApplication.findMany({
    where: {
      isSelfIdentified: true,
      companyName: {
        not: null,
      },
    },
    select: {
      companyName: true,
      companyAddress: true,
      companyContact: true,
      companyEmail: true,
    },
    orderBy: {
      createdAt: 'desc', // Get most recent first for better address data
    },
  });

  console.log(`✅ Found ${applications.length} internship applications with company data\n`);

  if (applications.length === 0) {
    console.log('ℹ️  No company data found. Exiting...');
    return;
  }

  // Step 2: Normalize and deduplicate company names with address info
  console.log('🔄 Normalizing company names and collecting address data...\n');

  interface CompanyData {
    alias: string[];
    address: string | null;
    contact: string | null;
    email: string | null;
  }

  const normalizedCompanies = new Map<string, CompanyData>();

  for (const app of applications) {
    if (app.companyName) {
      const normalized = normalizeCompanyName(app.companyName);
      if (normalized) {
        if (!normalizedCompanies.has(normalized)) {
          // First occurrence - store all data
          normalizedCompanies.set(normalized, {
            alias: [],
            address: app.companyAddress,
            contact: app.companyContact,
            email: app.companyEmail,
          });
        }

        const companyData = normalizedCompanies.get(normalized)!;

        // Add to alias if not already present
        if (!companyData.alias.includes(app.companyName)) {
          companyData.alias.push(app.companyName);
        }

        // Fill in missing address data from other applications
        if (!companyData.address && app.companyAddress) {
          companyData.address = app.companyAddress;
        }
        if (!companyData.contact && app.companyContact) {
          companyData.contact = app.companyContact;
        }
        if (!companyData.email && app.companyEmail) {
          companyData.email = app.companyEmail;
        }
      }
    }
  }

  // Count companies with address data
  let companiesWithAddress = 0;
  for (const [, data] of normalizedCompanies) {
    if (data.address || data.contact || data.email) {
      companiesWithAddress++;
    }
  }

  console.log(`📈 Statistics:`);
  console.log(`   - Total internship applications: ${applications.length}`);
  console.log(`   - Normalized unique companies: ${normalizedCompanies.size}`);
  console.log(`   - Companies with address/contact data: ${companiesWithAddress}\n`);

  // Step 3: Check existing companies in the database
  console.log('🔍 Checking existing companies in database...');

  const existingCompanies = await prisma.company.findMany({
    select: {
      name: true,
    },
  });

  const existingNames = new Set(existingCompanies.map(c => c.name));
  console.log(`   - Existing companies in database: ${existingCompanies.length}\n`);

  // Step 4: Prepare companies to add
  interface CompanyToAdd {
    name: string;
    alias: string[];
    address: string | null;
    contact: string | null;
    email: string | null;
  }

  const companiesToAdd: CompanyToAdd[] = [];

  for (const [normalized, data] of normalizedCompanies.entries()) {
    if (!existingNames.has(normalized)) {
      // Filter out the normalized name from variations
      const alias = data.alias.filter(v => v !== normalized);
      companiesToAdd.push({
        name: normalized,
        alias: alias,
        address: data.address,
        contact: data.contact,
        email: data.email,
      });
    }
  }

  console.log(`📝 Companies to add: ${companiesToAdd.length}\n`);

  if (companiesToAdd.length === 0) {
    console.log('✨ All companies already exist in the database! No new companies to add.\n');
    return;
  }

  // Show preview
  if (VERBOSE) {
    console.log('📋 Companies to be added:\n');
    companiesToAdd.slice(0, 20).forEach((company, index) => {
      console.log(`   ${(index + 1).toString().padStart(3)}. ${company.name}`);
      if (company.address) {
        console.log(`        Address: ${company.address.substring(0, 60)}${company.address.length > 60 ? '...' : ''}`);
      }
      if (company.contact || company.email) {
        console.log(`        Contact: ${company.contact || '-'} | Email: ${company.email || '-'}`);
      }
      if (company.alias.length > 0) {
        console.log(`        Aliases: ${company.alias.slice(0, 3).join(', ')}${company.alias.length > 3 ? ` (+${company.alias.length - 3} more)` : ''}`);
      }
    });

    if (companiesToAdd.length > 20) {
      console.log(`\n   ... and ${companiesToAdd.length - 20} more companies\n`);
    } else {
      console.log('');
    }
  }

  // Step 5: Add companies to database
  if (!DRY_RUN) {
    console.log('💾 Adding companies to database...\n');

    let addedCount = 0;
    let errorCount = 0;

    for (const company of companiesToAdd) {
      try {
        await prisma.company.create({
          data: {
            name: company.name,
            alias: company.alias,
            address: company.address,
            contact: company.contact,
            email: company.email,
            isActive: true,
          },
        });
        addedCount++;

        if (VERBOSE) {
          console.log(`   ✅ Added: ${company.name}${company.address ? ' (with address)' : ''}`);
        }
      } catch (error: any) {
        errorCount++;
        if (error.code === 'P2002') {
          // Unique constraint violation - company already exists
          if (VERBOSE) {
            console.log(`   ⚠️  Already exists: ${company.name}`);
          }
        } else {
          console.error(`   ❌ Error adding "${company.name}":`, error.message);
        }
      }
    }

    console.log(`\n✅ Successfully added ${addedCount} companies!`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} companies had errors (likely already existed)\n`);
    }
  } else {
    console.log('ℹ️  DRY RUN: No changes were applied. Run without --dry-run to add companies.\n');
  }

  // Step 6: Final statistics
  if (!DRY_RUN) {
    const finalCount = await prisma.company.count();
    const withAddress = await prisma.company.count({
      where: {
        address: { not: null },
      },
    });
    const withContact = await prisma.company.count({
      where: {
        OR: [
          { contact: { not: null } },
          { email: { not: null } },
        ],
      },
    });

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Final Statistics:`);
    console.log(`   - Total companies in database: ${finalCount}`);
    console.log(`   - Companies with address: ${withAddress}`);
    console.log(`   - Companies with contact info: ${withContact}\n`);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 Populate Companies Script Complete!\n');
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
