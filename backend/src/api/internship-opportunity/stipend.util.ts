/**
 * Stipend is free text ("8000 per month", "INR 9,500", "10K", "1.2 lakh per annum", "No").
 * Returns the amount per MONTH in rupees, or null when the text has no usable amount
 * (blank, "No", "unpaid", "as per norms", per-day rates...), so it is left out of averages
 * instead of being guessed.
 */
export function parseMonthlyStipend(text?: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b(per|a|\/)\s*(day|week|hour|hr)\b|\bdaily\b|\bhourly\b/.test(t)) return null;

  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k\b|thousand|lakh|lac|lpa)?/.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;

  const unit = m[2];
  if (unit === 'k' || unit === 'thousand') n *= 1000;
  else if (unit === 'lakh' || unit === 'lac' || unit === 'lpa') n *= 100000;

  // yearly figures -> monthly
  if (unit === 'lpa' || /\b(per\s*(annum|year|yr)|yearly|annual|p\.?a\.?)\b/.test(t)) n /= 12;
  return Math.round(n);
}

/** Highest stipend accepted (rupees per month). */
export const MAX_STIPEND = 9_999_999;
/** Shape of a saved stipend: grouped Indian style digits, e.g. 800, 8,000, 10,000, 1,00,000. */
export const STIPEND_FORMAT_RE = /^(?:\d{1,3}|\d{1,2}(?:,\d{2})*,\d{3})$/;
export const STIPEND_FORMAT_MESSAGE = 'Stipend must be an amount in rupees such as 10000 or 10,000';

/**
 * The amount typed by a user, as a number: digits with optional commas and an optional leading
 * rupee marker (₹ / Rs. / INR). No decimals, no words ("per month", "k"). Null when it is not that.
 */
export function parseStipendAmount(input: unknown): number | null {
  if (typeof input === 'number') return Number.isInteger(input) && input > 0 && input <= MAX_STIPEND ? input : null;
  if (typeof input !== 'string') return null;
  const m = /^\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)\s*(?:\/-)?\s*$/i.exec(input);
  if (!m) return null;
  // commas must group digits properly: 10,000 / 1,00,000 / 100,000
  if (m[1].includes(',') && !STIPEND_FORMAT_RE.test(m[1]) && !/^d{1,3}(,d{3})+$/.test(m[1])) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isSafeInteger(n) && n > 0 && n <= MAX_STIPEND ? n : null;
}

/** 10000 -> "10,000" (Indian digit grouping). */
export function formatStipendAmount(n: number): string {
  return n.toLocaleString('en-IN');
}

/**
 * Canonical saved form of a stipend: "10,000". Blank -> null. Anything that is not a plain
 * rupee amount -> undefined (invalid), so callers can report an error.
 */
export function normalizeStipend(input: unknown): string | null | undefined {
  if (input === null || input === undefined || (typeof input === 'string' && input.trim() === '')) return null;
  const n = parseStipendAmount(input);
  return n === null ? undefined : formatStipendAmount(n);
}
