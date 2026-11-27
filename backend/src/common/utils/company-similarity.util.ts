/**
 * Similarity merging for company names.
 *
 * The mapping table only handles spellings we have seen. This merges names that differ only by
 * things that do NOT identify a different company:
 *   - case, spacing, punctuation, "&" vs "and"
 *   - company suffixes (Pvt / Private / Ltd / Limited / LLP / Inc / Corp ...)
 *   - text in brackets, e.g. "(cdil)", "(rai Honda)"
 *   - the address part: city / town names, "Sector 82", "Phase 4", "Unit 2", "Plant-2", "Location- X"
 *
 * So "Continental Device India PVT LTD (cdil) Mohali" and "Continental Device India Ltd" become one
 * company, and "Cheema Boilers Limited, Mohali" and "Cheema Boilers" become one company.
 */

export const COMPANY_PLACES = [
  'greater noida', 'new delhi', 'dera bassi', 'derabassi', 'tarn taran', 'fatehgarh sahib', 'mandi gobindgarh',
  'sas nagar', 'sahibzada ajit singh nagar', 'sri muktsar sahib', 'muktsar',
  'mohali', 'chandigarh', 'ludhiana', 'jalandhar', 'amritsar', 'patiala', 'bathinda', 'barnala', 'hoshiarpur',
  'faridkot', 'ferozepur', 'firozpur', 'noida', 'gurgaon', 'gurugram', 'manesar', 'bangalore', 'bengaluru', 'delhi',
  'kurali', 'kharar', 'zirakpur', 'phagwara', 'mehtiana', 'kotkapura', 'mansa', 'sangrur', 'moga', 'rupnagar',
  'ropar', 'nangal', 'gurdaspur', 'pathankot', 'kapurthala', 'panchkula', 'ahmedabad', 'ahemdabad', 'gujarat',
  'gujrat', 'haryana', 'chennai', 'pune', 'mumbai', 'hyderabad', 'bhiwadi', 'baddi', 'rajpura', 'khanna',
  'dasuya', 'abohar', 'fazilka', 'malerkotla', 'sirhind', 'banur', 'lalru', 'nawanshahr', 'jagraon', 'batala',
];

const CORPORATE_WORDS = [
  'private', 'pvt', 'limited', 'ltd', 'lmt', 'llp', 'inc', 'corp', 'corporation', 'co', 'company',
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PLACES_RE = new RegExp(`\\b(${[...COMPANY_PLACES].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})\\b`, 'g');
const CORPORATE_RE = new RegExp(`\\b(${CORPORATE_WORDS.join('|')})\\b\\.?`, 'g');

/** Lowercased name with brackets, address-like parts and company suffixes removed (spaces kept). */
function stripped(name: string, removePlaces: boolean): string {
  let s = name.toLowerCase();
  s = s.replace(/\(.*?\)/g, ' '); // bracketed text
  s = s.replace(/\([^)]*$/g, ' '); // unclosed bracket
  s = s.replace(/&/g, ' and ');
  s = s.replace(/\b(location|loc|address)\s*[-:]\s*[^,]*/g, ' ');
  s = s.replace(/\bsector\s*-?\s*\d+[a-z]?\b/g, ' ');
  s = s.replace(/\b(phase|unit|plant)\s*-?\s*(\d+|[ivx]+)\b/g, ' ');
  if (removePlaces) s = s.replace(PLACES_RE, ' ');
  s = s.replace(/[^a-z0-9]+/g, ' ');
  s = s.replace(CORPORATE_RE, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Key shared by names that are "the same company" ignoring address and suffix differences. */
export function similarityKey(name: string): string {
  return stripped(name, true).replace(/\s+/g, '');
}

/** Same as similarityKey but keeps place names; used to tell whether a name carries an address part. */
function plainKey(name: string): string {
  return stripped(name, false).replace(/\s+/g, '');
}

export interface NameCount {
  name: string;
  count: number;
}

/**
 * Returns a map of name -> canonical name for every name that has at least one similar name.
 * Canonical choice (best first):
 *   1. a name that already exists in the Company table (`preferred`)
 *   2. a name with no address part (no place / unit / sector stripped from it)
 *   3. the most used name, then the shortest
 */
export function buildSimilarityCanonicals(entries: NameCount[], preferred: Set<string> = new Set()): Map<string, string> {
  const groups = new Map<string, NameCount[]>();
  for (const e of entries) {
    const key = similarityKey(e.name);
    if (key.length < 4) continue; // too short to judge safely
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }

  const result = new Map<string, string>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const score = (m: NameCount) =>
      (preferred.has(m.name) ? 4 : 0) + (similarityKey(m.name) === plainKey(m.name) ? 2 : 0);
    const best = [...members].sort(
      (a, b) => score(b) - score(a) || b.count - a.count || a.name.length - b.name.length,
    )[0];
    for (const m of members) if (m.name !== best.name) result.set(m.name, best.name);
  }
  return result;
}

/**
 * For manual review: names that share the same first meaningful word but were NOT merged
 * (e.g. "Jagatjit Agri India" / "Jagatjit Industries"). Never merged automatically.
 */
export function findReviewCandidates(names: string[]): string[][] {
  const byFirst = new Map<string, Set<string>>();
  for (const n of names) {
    const first = stripped(n, true).split(' ')[0];
    if (!first || first.length < 4) continue;
    (byFirst.get(first) ?? byFirst.set(first, new Set()).get(first)!).add(n);
  }
  return [...byFirst.values()]
    .filter((s) => new Set([...s].map(similarityKey)).size > 1)
    .map((s) => [...s].sort());
}
