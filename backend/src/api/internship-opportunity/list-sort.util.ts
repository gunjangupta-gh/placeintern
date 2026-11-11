/**
 * Server-side sorting helpers for the opportunity tables, so a column sort orders the whole
 * result set (every page), not just the rows of the page on screen.
 */

export type SortOrder = 'asc' | 'desc';

export const toOrder = (o?: string): SortOrder => (o === 'desc' ? 'desc' : 'asc');

/** First amount in a stipend text ("10,000", "Rs 8000 per month"); null when there is none. */
export function stipendNumber(value?: string | null): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(String(value ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Sort rows by a computed key; rows without a value always go last. Stable on ties (keeps input order). */
export function sortByComputed<T>(rows: T[], key: (r: T) => number | string | null | undefined, order: SortOrder): T[] {
  const dir = order === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i, k: key(r) }))
    .sort((a, b) => {
      const an = a.k === null || a.k === undefined || a.k === '';
      const bn = b.k === null || b.k === undefined || b.k === '';
      if (an && bn) return a.i - b.i;
      if (an) return 1;
      if (bn) return -1;
      const c =
        typeof a.k === 'number' && typeof b.k === 'number'
          ? a.k - b.k
          : String(a.k).localeCompare(String(b.k), undefined, { sensitivity: 'base', numeric: true });
      return c !== 0 ? c * dir : a.i - b.i;
    })
    .map((x) => x.r);
}
