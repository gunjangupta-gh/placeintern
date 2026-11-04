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
