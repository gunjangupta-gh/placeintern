import { similarityKey } from './company-similarity.util';

/**
 * Key used to detect the same company typed in different ways. Ignores case, spacing, punctuation,
 * company suffixes (Pvt / Ltd ...), bracketed text and the address part (city, sector, unit, plant),
 * so "Cheema Boilers Limited, Mohali" and "cheema boilers ltd" are the same company.
 * See company-similarity.util.ts.
 */
export function companyNameKey(name: string): string {
  return similarityKey(name);
}

/** Collapse whitespace so stored names stay tidy. */
export function cleanCompanyName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}
