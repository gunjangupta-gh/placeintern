import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { ALL_ACTUAL_COMPANY_MAPPINGS } from './company-mappings-actual';
import { buildSimilarityCanonicals, similarityKey } from '../src/common/utils/company-similarity.util';
import { cleanText, pickBest, extractCity, extractPinCode } from '../src/common/utils/company-details.util';

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
 * Creates AND updates the Company table from InternshipApplications so students can pick pre-added companies:
 *  - one canonical name per company (mapping table + merge of names that differ only by address/suffix)
 *  - one canonical, cleaned address / contact / email / city / pin code per company
 *  - new spellings are added as aliases; existing companies are updated, not skipped
 *  - every application is linked (companyId) and renamed to the canonical company name
 *
 * Usage:
 *   npm run seed:populate-companies           # Normal mode (applies changes)
 *   npm run seed:populate-companies -- --dry-run         # Dry run mode (preview only)
 *   npm run seed:populate-companies -- --verbose         # Verbose output
 *   npm run seed:populate-companies -- --no-link         # Only create/update companies, do not touch applications
 */

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const NO_LINK = args.includes('--no-link');

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
  console.log('║     Populate / Update Companies Script                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  if (DRY_RUN) console.log('🔍 DRY RUN MODE - No changes will be applied\n');

  // 1. All applications that carry a company name (as typed by the student)
  const applications = await prisma.internshipApplication.findMany({
    where: { isSelfIdentified: true, companyName: { not: null } },
    select: {
      id: true,
      companyId: true,
      companyName: true,
      companyAddress: true,
      companyContact: true,
      companyEmail: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`📊 Applications with a company name: ${applications.length}`);
  if (applications.length === 0) return;

  // 2. Existing master companies
  const existing = await prisma.company.findMany();
  console.log(`📚 Companies already in the table:   ${existing.length}`);
  const existingNames = new Set(existing.map((c) => c.name));

  // 3. Canonical name for every application: mapping table, then merge names that differ only by
  //    address / suffix / brackets (names already in the Company table win)
  const normalizedOf = (raw: string) => normalizeCompanyName(raw) ?? sanitizeCompanyName(raw);
  const counts = new Map<string, number>();
  for (const a of applications) {
    const n = normalizedOf(a.companyName!);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  const similarity = buildSimilarityCanonicals(
    [...counts].map(([name, count]) => ({ name, count })),
    existingNames,
  );
  const canonicalOf = (raw: string) => {
    const n = normalizedOf(raw);
    return similarity.get(n) ?? n;
  };

  // 4. Group applications per canonical company and pick ONE address / contact / email
  interface Group {
    name: string;
    apps: typeof applications;
  }
  const groups = new Map<string, Group>();
  for (const a of applications) {
    const name = canonicalOf(a.companyName!);
    (groups.get(name) ?? groups.set(name, { name, apps: [] }).get(name)!).apps.push(a);
  }
  console.log(`🔄 Distinct companies after normalization: ${groups.size}\n`);

  // 5. Match each group to an existing company (exact name, then similar name), else create
  const existingByName = new Map(existing.map((c) => [c.name, c]));
  const existingByKey = new Map<string, (typeof existing)[number]>();
  for (const c of existing) {
    for (const n of [c.name, ...c.alias]) {
      const k = similarityKey(n);
      if (k && !existingByKey.has(k)) existingByKey.set(k, c);
    }
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let linkedApps = 0;
  let renamedApps = 0;
  let errors = 0;

  for (const g of groups.values()) {
    const address = pickBest(g.apps.map((a) => a.companyAddress), { address: true });
    const contact = pickBest(g.apps.map((a) => a.companyContact));
    const email = pickBest(g.apps.map((a) => a.companyEmail));
    const city = extractCity(address);
    const pinCode = extractPinCode(address);
    const variants = new Set<string>();
    for (const a of g.apps) {
      const raw = cleanText(a.companyName);
      if (raw) variants.add(raw);
    }

    const match = existingByName.get(g.name) ?? existingByKey.get(similarityKey(g.name));

    try {
      let company = match;

      if (!company) {
        created++;
        if (VERBOSE) console.log(`   + new:     ${g.name}${address ? '  (' + address.slice(0, 50) + ')' : ''}`);
        if (!DRY_RUN) {
          company = await prisma.company.create({
            data: {
              name: g.name,
              alias: [...variants].filter((v) => v !== g.name),
              address,
              contact,
              email,
              city,
              pinCode,
              isActive: true,
            },
          });
          existingByName.set(company.name, company);
          existingByKey.set(similarityKey(company.name), company);
        }
      } else {
        // Update: keep the name, add new spellings as aliases, fill / clean details, make sure it is active
        const alias = new Set(company.alias);
        for (const v of variants) if (v !== company.name) alias.add(v);
        const data: Record<string, unknown> = {};
        if (alias.size !== company.alias.length) data.alias = [...alias];
        const dirtyAddress = !!company.address && cleanText(company.address) !== company.address;
        if (address && (!company.address || dirtyAddress)) data.address = address;
        if (dirtyAddress && !address) data.address = cleanText(company.address);
        if (contact && !company.contact) data.contact = contact;
        if (email && !company.email) data.email = email;
        if (!company.city && city) data.city = city;
        if (!company.pinCode && pinCode) data.pinCode = pinCode;
        if (!company.isActive) data.isActive = true;

        if (Object.keys(data).length > 0) {
          updated++;
          if (VERBOSE) console.log(`   ~ updated: ${company.name}  [${Object.keys(data).join(', ')}]`);
          if (!DRY_RUN) company = await prisma.company.update({ where: { id: company.id }, data });
        } else {
          unchanged++;
        }
      }

      // 6. Point every application at the company so reports and the student form use ONE record
      if (!NO_LINK) {
        for (const a of g.apps) {
          const targetName = company?.name ?? g.name;
          const needsId = company && a.companyId !== company.id;
          const needsName = a.companyName !== targetName;
          if (!needsId && !needsName) continue;
          if (needsId) linkedApps++;
          if (needsName) renamedApps++;
          if (!DRY_RUN && company) {
            await prisma.internshipApplication.update({
              where: { id: a.id },
              data: { companyId: company.id, companyName: company.name },
            });
          }
        }
      }
    } catch (error: any) {
      errors++;
      console.error(`   ❌ "${g.name}": ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Summary ${DRY_RUN ? '(dry run, nothing written)' : ''}`);
  console.log(`   - Companies ${DRY_RUN ? 'to create' : 'created'}:  ${created}`);
  console.log(`   - Companies ${DRY_RUN ? 'to update' : 'updated'}:  ${updated}`);
  console.log(`   - Companies already complete: ${unchanged}`);
  if (NO_LINK) {
    console.log('   - Applications: not touched (--no-link)');
  } else {
    console.log(`   - Applications ${DRY_RUN ? 'to link' : 'linked'} to a company: ${linkedApps}`);
    console.log(`   - Application names ${DRY_RUN ? 'to rewrite' : 'rewritten'} to the company name: ${renamedApps}`);
  }
  if (errors) console.log(`   - Errors: ${errors}`);

  // Duplicate rows already in the Company table (same company, different spelling) - reported, not merged
  const dupGroups = new Map<string, string[]>();
  for (const c of existing) {
    const k = similarityKey(c.name);
    if (k.length >= 4) (dupGroups.get(k) ?? dupGroups.set(k, []).get(k)!).push(c.name);
  }
  const dups = [...dupGroups.values()].filter((v) => v.length > 1);
  if (dups.length) {
    console.log(`\n⚠️  Duplicate rows already in the Company table (merge manually, opportunities may point to them):`);
    dups.forEach((v) => console.log('   - ' + v.join('  |  ')));
  }
  console.log('\n🎉 Populate Companies Script Complete!\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
