/**
 * Shared helpers for the internship-opportunity tables: stipend display / input format and column sorters.
 * A stipend is saved as a plain rupee amount in Indian digit grouping ("10,000") and shown as "₹10,000".
 */

const SIMPLE_AMOUNT_RE = /^\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)\s*(?:\/-)?\s*$/i;
const LEGACY_MONTHLY_RE = /^\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)\s*(?:\/-|per\s*month|\/\s*month|pm|p\.m\.)?\s*$/i;
export const STIPEND_FORMAT_RE = /^$|^(?:\d{1,3}|\d{1,2}(?:,\d{2})*,\d{3})$/;
export const STIPEND_FORMAT_MESSAGE = 'Enter an amount in rupees, e.g. 10,000';

const group = (n) => Number(n).toLocaleString('en-IN');

/** "10,000" / "10000" -> "₹10,000". Older free-text values are shown as they were saved. Empty -> "-". */
export const formatStipend = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  const m = SIMPLE_AMOUNT_RE.exec(String(value));
  if (m) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return `₹${group(n)}`;
  }
  return String(value);
};

/** Number used for sorting a stipend (first amount in the text); null when there is none. */
export const stipendAmount = (value) => {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(String(value ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Live input formatting: keeps digits only and groups them, so 10000 becomes 10,000 as it is typed. */
export const formatStipendInput = (raw) => {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 7);
  return digits ? group(Number(digits)) : '';
};

/** Value for the form field when editing: a plain saved amount stays, "8000 per month" becomes "8,000". */
export const stipendToInput = (value) => {
  const m = LEGACY_MONTHLY_RE.exec(String(value ?? ''));
  return m ? formatStipendInput(m[1]) : String(value ?? '');
};

// ---- column sorters (the tables page on the server, so these order the rows of the current page) ----
// antd negates the result when sorting descending, so blanks are compensated to stay last in both directions
const blankLast = (a, b, cmp, order) => {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an && bn) return 0;
  const flip = order === 'descend' ? -1 : 1;
  if (an) return 1 * flip;
  if (bn) return -1 * flip;
  return cmp(a, b);
};

export const textSorter = (get) => (x, y, order) =>
  blankLast(get(x), get(y), (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true }), order);
export const numberSorter = (get) => (x, y, order) => blankLast(get(x), get(y), (a, b) => Number(a) - Number(b), order);
export const dateSorter = (get) => (x, y, order) => blankLast(get(x), get(y), (a, b) => new Date(a).getTime() - new Date(b).getTime(), order);
export const stipendSorter = (get) => (x, y, order) => blankLast(stipendAmount(get(x)), stipendAmount(get(y)), (a, b) => a - b, order);
/** Stipend columns sort the highest amount first on the first click. */
export const STIPEND_SORT_ORDER = ['descend', 'ascend'];
