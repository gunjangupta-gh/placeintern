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

const args = process.argv.slice(2);
const USE_MAPPINGS = !args.includes('--no-mappings');

interface CompanyMapping {
  [key: string]: string;
}

const COMPANY_NORMALIZATIONS: CompanyMapping = {
  ...(USE_MAPPINGS ? ALL_ACTUAL_COMPANY_MAPPINGS : {}),
};

function normalizeCompanyName(companyName: string | null): string | null {
  if (!companyName) return null;

  let normalized = sanitizeCompanyName(companyName);
  const lowerName = normalized.toLowerCase();

  if (COMPANY_NORMALIZATIONS[lowerName]) {
    return COMPANY_NORMALIZATIONS[lowerName];
  }

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

  if (COMPANY_NORMALIZATIONS[baseName]) {
    return COMPANY_NORMALIZATIONS[baseName];
  }

  return toTitleCase(normalized);
}

function sanitizeCompanyName(input: string): string {
  return decodeHtmlEntities(input)
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;?/gi, '&')
    .replace(/&#38;/gi, '&')
    .replace(/&lt;?/gi, '<')
    .replace(/&gt;?/gi, '>')
    .replace(/&quot;?/gi, '"')
    .replace(/&#39;?/gi, "'")
    .replace(/&nbsp;?/gi, ' ');
}

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

function capitalizeWord(word: string): string {
  if (isAbbreviation(word)) {
    return word.toUpperCase();
  }

  if (word.includes('-')) {
    return word.split('-').map(part => capitalizeWord(part)).join('-');
  }

  return word.charAt(0).toUpperCase() + word.slice(1);
}

function isAbbreviation(word: string): boolean {
  const abbreviations = ['tcs', 'ibm', 'hcl', 'it', 'ai', 'ml', 'iot', 'hr', 'r&d', 'llc', 'llp', 'pvt', 'ltd'];
  return abbreviations.includes(word.toLowerCase()) || (word.length <= 3 && word === word.toUpperCase());
}

function canonicalKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      Company Duplicate Analysis Script                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const companyCounts = await prisma.internshipApplication.groupBy({
    by: ['companyName'],
    where: {
      isSelfIdentified: true,
      companyName: { not: null },
    },
    _count: true,
  });

  const companies = companyCounts.map(entry => ({
    name: entry.companyName as string,
    count: entry._count,
  }));

  const normalizedGroups = new Map<string, Array<{ original: string; count: number }>>();
  const canonicalGroups = new Map<string, Array<{ original: string; count: number }>>();

  for (const company of companies) {
    const normalized = normalizeCompanyName(company.name) || company.name;
    if (!normalizedGroups.has(normalized)) {
      normalizedGroups.set(normalized, []);
    }
    normalizedGroups.get(normalized)!.push({ original: company.name, count: company.count });

    const key = canonicalKey(normalized);
    if (!canonicalGroups.has(key)) {
      canonicalGroups.set(key, []);
    }
    canonicalGroups.get(key)!.push({ original: normalized, count: company.count });
  }

  const potentialDuplicates = Array.from(canonicalGroups.entries())
    .map(([key, values]) => ({
      key,
      values: values.sort((a, b) => b.count - a.count),
    }))
    .filter(group => {
      const uniqueNames = new Set(group.values.map(v => v.original));
      return uniqueNames.size > 1;
    })
    .sort((a, b) => b.values.length - a.values.length);

  console.log(`📊 Unique company names: ${companies.length}`);
  console.log(`🔎 Potential duplicate groups (after normalization + canonical key): ${potentialDuplicates.length}\n`);
  console.log(`🧭 Mappings enabled: ${USE_MAPPINGS ? 'yes' : 'no'}\n`);

  potentialDuplicates.forEach((group, index) => {
    console.log(`${(index + 1).toString().padStart(3)}. Key: ${group.key}`);
    group.values.forEach(value => {
      console.log(`     - ${value.original} (${value.count})`);
    });
    console.log('');
  });

  console.log('✅ Done.');
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
