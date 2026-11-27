import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { companyNameKey, cleanCompanyName } from '../src/common/utils/company-name.util';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

/**
 * Link Applications To Companies
 *
 * For every self-identified internship application that has a companyName but no companyId:
 *  - match it to a Company by normalized name (case, spacing, Pvt Ltd / Private Limited, & / and)
 *    against Company.name and Company.alias
 *  - if no Company matches, create one (active)
 *  - set companyId and rewrite companyName to the Company's canonical name
 *  - record the original spelling in Company.alias so it matches next time
 *
 * Recommended order:
 *   1. npm run seed:normalize-companies      (applies the abbreviation/spelling mappings)
 *   2. npm run seed:populate-companies       (creates Company rows for the normalized names)
 *   3. npm run link:applications-companies   (this script: sets companyId, merges the leftovers)
 *
 * Usage:
 *   npm run link:applications-companies:dry   # preview only
 *   npm run link:applications-companies       # apply
 */

const DRY_RUN = process.argv.slice(2).includes('--dry-run');

async function main() {
  console.log(`\nLink applications to companies${DRY_RUN ? ' (DRY RUN, no changes)' : ''}\n`);

  const companies = await prisma.company.findMany();
  const byKey = new Map<string, (typeof companies)[number]>();
  const register = (c: (typeof companies)[number]) => {
    for (const n of [c.name, ...c.alias]) {
      const k = companyNameKey(n);
      if (k && !byKey.has(k)) byKey.set(k, c);
    }
  };
  companies.forEach(register);

  // Distinct names still to link, with application counts
  const grouped = await prisma.internshipApplication.groupBy({
    by: ['companyName'],
    where: { isSelfIdentified: true, companyId: null, companyName: { not: null } },
    _count: { _all: true },
  });
  console.log(`Distinct company names to link: ${grouped.length}`);

  let linkedApps = 0;
  let created = 0;
  let aliasesAdded = 0;
  let skipped = 0;

  for (const g of grouped) {
    const original = g.companyName as string;
    const cleaned = cleanCompanyName(original);
    const key = companyNameKey(cleaned);
    if (!key) {
      skipped++;
      continue;
    }

    let company = byKey.get(key);

    if (!company) {
      console.log(`  + new company: "${cleaned}"`);
      if (!DRY_RUN) {
        const sample = await prisma.internshipApplication.findFirst({
          where: { isSelfIdentified: true, companyName: original },
          select: { companyAddress: true, companyContact: true, companyEmail: true },
        });
        company = await prisma.company.create({
          data: {
            name: cleaned,
            address: sample?.companyAddress ?? undefined,
            contact: sample?.companyContact ?? undefined,
            email: sample?.companyEmail ?? undefined,
            isActive: true,
          },
        });
        register(company);
      }
      created++;
    } else if (original !== company.name) {
      console.log(`  ~ "${original}" -> "${company.name}" (${g._count._all} applications)`);
      // Remember this spelling so future typing/search finds the company
      if (!company.alias.includes(original) && company.name !== original) {
        if (!DRY_RUN) {
          company = await prisma.company.update({
            where: { id: company.id },
            data: { alias: { push: original } },
          });
          register(company);
        }
        aliasesAdded++;
      }
    }

    if (!DRY_RUN && company) {
      const res = await prisma.internshipApplication.updateMany({
        where: { isSelfIdentified: true, companyId: null, companyName: original },
        data: { companyId: company.id, companyName: company.name },
      });
      linkedApps += res.count;
    } else {
      linkedApps += g._count._all;
    }
  }

  console.log('\nSummary');
  console.log(`  Applications ${DRY_RUN ? 'to link' : 'linked'}: ${linkedApps}`);
  console.log(`  Companies ${DRY_RUN ? 'to create' : 'created'}: ${created}`);
  console.log(`  Aliases ${DRY_RUN ? 'to add' : 'added'}: ${aliasesAdded}`);
  console.log(`  Skipped (empty name): ${skipped}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
