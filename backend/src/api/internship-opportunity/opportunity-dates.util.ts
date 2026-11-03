/**
 * Date helpers for opportunities. The organisation operates in India, so calendar dates are
 * interpreted in IST (+05:30): a start date is 00:00 IST and an application deadline is
 * 23:59:59.999 IST on that day, so "deadline 15 Dec" stays open for the whole of 15 Dec.
 */
const IST = '+05:30';

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 2000 || y > 2100) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Reads a calendar date from an Excel cell value or a string. Accepts a JS Date (Excel date
 * cell, read as UTC components), yyyy-mm-dd, dd/mm/yyyy, or dd-mm-yyyy. Returns null if invalid.
 */
export function parseCalendarDate(value: unknown): { y: number; m: number; d: number } | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth() + 1;
    const d = value.getUTCDate();
    return isRealDate(y, m, d) ? { y, m, d } : null;
  }

  const s = String(value).trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) {
    const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isRealDate(y, m, d) ? { y, m, d } : null;
  }
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (match) {
    const [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    return isRealDate(y, m, d) ? { y, m, d } : null;
  }
  return null;
}

export function startOfDayIST(c: { y: number; m: number; d: number }): Date {
  return new Date(`${c.y}-${pad(c.m)}-${pad(c.d)}T00:00:00.000${IST}`);
}

export function endOfDayIST(c: { y: number; m: number; d: number }): Date {
  return new Date(`${c.y}-${pad(c.m)}-${pad(c.d)}T23:59:59.999${IST}`);
}

/** Start of today in IST, as an instant. */
export function todayStartIST(now: Date = new Date()): Date {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return startOfDayIST({ y: ist.getUTCFullYear(), m: ist.getUTCMonth() + 1, d: ist.getUTCDate() });
}

/** start + N calendar months (day clamped to month end), as an IST-midnight instant. */
export function addMonthsIST(start: Date, months: number): Date {
  const ist = new Date(start.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m0 = ist.getUTCMonth() + months;
  const d = ist.getUTCDate();
  const target = new Date(Date.UTC(y, m0, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return startOfDayIST({
    y: target.getUTCFullYear(),
    m: target.getUTCMonth() + 1,
    d: Math.min(d, lastDay),
  });
}

/** Parse an API date input (yyyy-mm-dd or full ISO) into a calendar date. */
export function parseApiDate(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const head = String(value).slice(0, 10);
  return parseCalendarDate(head);
}
