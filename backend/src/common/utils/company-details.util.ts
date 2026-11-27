import { COMPANY_PLACES } from './company-similarity.util';

/** Decode HTML entities that leaked into stored text ("K&amp;amp;B Tower" -> "K&B Tower"), repeatedly. */
export function decodeEntities(input: string): string {
  let out = input;
  for (let i = 0; i < 5; i += 1) {
    const next = out
      .replace(/&amp;?/gi, '&')
      .replace(/&#38;/g, '&')
      .replace(/&lt;?/gi, '<')
      .replace(/&gt;?/gi, '>')
      .replace(/&quot;?/gi, '"')
      .replace(/&#0?39;?/g, "'")
      .replace(/&#x2f;?/gi, '/')
      .replace(/&nbsp;?/gi, ' ');
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Single-line, entity-free, whitespace-collapsed text. */
export function cleanText(input: string | null | undefined): string {
  if (!input) return '';
  return decodeEntities(input)
    .replace(/[​-‍﻿⁠]/g, '')
    .replace(/[\r\n\t]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/(,\s*)+,/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}

/** An address is "good" when it looks like a real address, not "Company", "44" or "2nd floor". */
function addressQuality(a: string): number {
  let q = 0;
  if (a.length >= 15) q += 2;
  if (a.includes(',')) q += 1;
  if (/\b\d{6}\b/.test(a)) q += 1;
  if (COMPANY_PLACES.some((p) => a.toLowerCase().includes(p))) q += 2;
  return q;
}

/**
 * Pick one value from many typed by different students: most frequent first,
 * but only among the best-quality candidates (for addresses). Ties go to the longest.
 */
export function pickBest(values: (string | null | undefined)[], opts: { address?: boolean } = {}): string | null {
  const counts = new Map<string, number>();
  for (const v of values) {
    const c = cleanText(v);
    if (!c) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let entries = [...counts];
  if (entries.length === 0) return null;
  if (opts.address) {
    const bestQ = Math.max(...entries.map(([a]) => addressQuality(a)));
    entries = entries.filter(([a]) => addressQuality(a) === bestQ);
  }
  entries.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  return entries[0][0];
}

/** Known city / town mentioned in an address, e.g. "Plot 1, Phase 8B, Mohali, Punjab" -> "Mohali". */
export function extractCity(address: string | null | undefined): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();
  let best: { place: string; index: number } | null = null;
  for (const place of COMPANY_PLACES) {
    const m = new RegExp(`\\b${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).exec(lower);
    if (m && (!best || m.index < best.index || (m.index === best.index && place.length > best.place.length))) {
      best = { place, index: m.index };
    }
  }
  if (!best) return null;
  const display = CITY_DISPLAY[best.place] ?? best.place;
  return display.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Different spellings / official names of the same town, shown under one name. */
const CITY_DISPLAY: Record<string, string> = {
  'sahibzada ajit singh nagar': 'mohali',
  'sas nagar': 'mohali',
  ahemdabad: 'ahmedabad',
  gurgaon: 'gurugram',
  firozpur: 'ferozepur',
  bengaluru: 'bangalore',
  derabassi: 'dera bassi',
  muktsar: 'sri muktsar sahib',
};

export function extractPinCode(address: string | null | undefined): string | null {
  const m = address?.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}
