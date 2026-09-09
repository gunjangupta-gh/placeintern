/**
 * Shared fuzzy matching helpers for resolving Institution/Branch names typed into
 * bulk-upload spreadsheets (staff and student uploads) to actual database records.
 */

export interface MatchableInstitution {
  id: string;
  name: string | null;
  code: string | null;
  shortName: string | null;
}

export interface MatchableBranch {
  id: string;
  name: string;
  shortName: string;
  code: string;
  institutionId: string | null;
}

export function normalizeInstitutionName(name: string): string {
  return name
    .toLowerCase()
    .replace(/govt\.?/g, 'government')
    .replace(/governement/g, 'government')
    .replace(/poly\.?/g, 'polytechnic')
    .replace(/coll\.?/g, 'college')
    .replace(/inst\.?/g, 'institute')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeInstitutionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function institutionInitials(value: string): string {
  const stopWords = new Set(['of', 'the', 'and', 'for', 'at', 'to', 'in']);
  return value
    .toLowerCase()
    .replace(/[.,\-_/()]/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token))
    .map((token) => token[0])
    .join('')
    .toUpperCase();
}

/**
 * Find institution by name (fuzzy matching): exact code/shortName, exact normalized name,
 * initials (e.g. "GPC Batala"), then partial containment.
 */
export function findInstitutionByName(
  institutionName: string,
  allInstitutions: MatchableInstitution[],
): MatchableInstitution | null {
  if (!institutionName) return null;

  const normalizedSearch = normalizeInstitutionName(institutionName);
  const normalizedKey = normalizeInstitutionKey(institutionName);
  const searchInitials = institutionInitials(institutionName);

  let match = allInstitutions.find((i) => {
    const codeKey = normalizeInstitutionKey(i.code || '');
    const shortKey = normalizeInstitutionKey(i.shortName || '');
    return normalizedKey !== '' && (normalizedKey === codeKey || normalizedKey === shortKey);
  });
  if (match) return match;

  match = allInstitutions.find((i) => normalizeInstitutionName(i.name || '') === normalizedSearch);
  if (match) return match;

  match = allInstitutions.find((i) => {
    const candidateInitials = institutionInitials(i.name || '');
    return searchInitials !== '' && candidateInitials !== '' && searchInitials === candidateInitials;
  });
  if (match) return match;

  match = allInstitutions.find((i) => {
    const normalizedInst = normalizeInstitutionName(i.name || '');
    return normalizedInst.includes(normalizedSearch) || normalizedSearch.includes(normalizedInst);
  });
  if (match) return match;

  return null;
}

/**
 * Accept a default institution id only when it exists in the given institution list.
 */
export function resolveValidDefaultInstitutionId(
  defaultInstitutionId: string | null,
  allInstitutions: MatchableInstitution[],
): string | null {
  if (!defaultInstitutionId) {
    return null;
  }
  return allInstitutions.some((institution) => institution.id === defaultInstitutionId)
    ? defaultInstitutionId
    : null;
}

export function normalizeBranchName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[.,\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps course/branch names from Excel to database shortName codes.
 * Database branches: AA, AS, CE, CSE, ECE, EE, IT, LT, ME
 */
export const COURSE_TO_BRANCH_CODE: Record<string, string> = {
  'computer science': 'CSE',
  'computer science and engineering': 'CSE',
  'computer science engineering': 'CSE',
  'computer engineering': 'CSE',
  'cse': 'CSE',
  'cs': 'CSE',

  'information technology': 'IT',
  'it': 'IT',
  'infotech': 'IT',

  'electronics': 'ECE',
  'electronics and communication': 'ECE',
  'electronics and communication engineering': 'ECE',
  'electronics and communications': 'ECE',
  'electronics and communications engineering': 'ECE',
  'electronics & communication': 'ECE',
  'electronics & communications': 'ECE',
  'ece': 'ECE',
  'ec': 'ECE',

  'electrical': 'EE',
  'electrical engineering': 'EE',
  'ee': 'EE',
  'elect': 'EE',

  'mechanical': 'ME',
  'mechanical engineering': 'ME',
  'me': 'ME',
  'mech': 'ME',

  'civil': 'CE',
  'civil engineering': 'CE',
  'ce': 'CE',

  'architectural assistantship': 'AA',
  'architecture': 'AA',
  'architectural': 'AA',
  'aa': 'AA',
  'arch': 'AA',

  'applied science': 'AS',
  'applied sciences': 'AS',
  'as': 'AS',
  'science': 'AS',

  'leather': 'LT',
  'leather technology': 'LT',
  'lt': 'LT',
};

export function getBranchCode(courseName: string): string | null {
  const normalized = normalizeBranchName(courseName);

  if (COURSE_TO_BRANCH_CODE[normalized]) {
    return COURSE_TO_BRANCH_CODE[normalized];
  }

  const upper = courseName.toUpperCase().trim();
  if (COURSE_TO_BRANCH_CODE[upper.toLowerCase()]) {
    return COURSE_TO_BRANCH_CODE[upper.toLowerCase()];
  }

  for (const [key, code] of Object.entries(COURSE_TO_BRANCH_CODE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return code;
    }
  }

  return null;
}

/**
 * Find branch by name within an institution (fuzzy matching with abbreviation support).
 * Falls back to global (institution-less) branches.
 */
export function findBranchByName(
  branchName: string,
  institutionId: string,
  allBranches: MatchableBranch[],
): MatchableBranch | null {
  if (!branchName) return null;

  const availableBranches = allBranches.filter(
    (b) => b.institutionId === institutionId || b.institutionId === null,
  );

  const searchUpper = branchName.toUpperCase().trim();
  const normalized = normalizeBranchName(branchName);

  let match = availableBranches.find(
    (b) => b.shortName.toUpperCase() === searchUpper || b.code.toUpperCase() === searchUpper,
  );
  if (match) return match;

  const branchCode = getBranchCode(branchName);
  if (branchCode) {
    match = availableBranches.find(
      (b) => b.shortName.toUpperCase() === branchCode || b.code.toUpperCase() === branchCode,
    );
    if (match) return match;
  }

  match = availableBranches.find((b) => normalizeBranchName(b.name) === normalized);
  if (match) return match;

  match = availableBranches.find((b) => {
    const branchNormalized = normalizeBranchName(b.name);
    return branchNormalized.includes(normalized) || normalized.includes(branchNormalized);
  });
  if (match) return match;

  match = availableBranches.find((b) => searchUpper.includes(b.shortName.toUpperCase()));
  if (match) return match;

  return null;
}
