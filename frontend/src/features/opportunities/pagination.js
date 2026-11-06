/**
 * One pagination setup for every internship-opportunity list (State, Principal, Faculty, Student),
 * so they all behave the same: page size selector, "x-y of N" total, quick jump on long lists.
 * onChange(page, pageSize) - the page resets to 1 when the page size changes.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
export const DEFAULT_PAGE_SIZE = 10;

export const tablePagination = ({ page, pageSize, total, onChange, label = 'item(s)' }) => ({
  current: page,
  pageSize,
  total,
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showQuickJumper: total > pageSize * 5,
  showTotal: (t, range) => (t ? `${range[0]}-${range[1]} of ${t} ${label}` : ''),
  onChange: (p, ps) => onChange(ps !== pageSize ? 1 : p, ps),
});

/** "S.No" column that keeps counting across pages. */
export const serialColumn = (page, pageSize) => ({
  title: 'S.No',
  key: 'sno',
  width: 64,
  render: (_v, _r, index) => (page - 1) * pageSize + index + 1,
});

/** UNDER_REVIEW -> "Under review" */
export const statusLabel = (s) => {
  const text = String(s || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const read = (key) => {
  try {
    const v = JSON.parse(sessionStorage.getItem(`opp-page:${key}`) || 'null');
    if (v && v.page >= 1 && PAGE_SIZE_OPTIONS.includes(String(v.pageSize))) return v;
  } catch { /* storage unavailable */ }
  return null;
};

/**
 * Page + page size that survive a browser refresh and remounts (per table `key`),
 * so editing/deleting a row or reloading keeps the user on the same page.
 */
export const usePersistedPagination = (key) => {
  const [state, setState] = useState(() => read(key) || { page: 1, pageSize: DEFAULT_PAGE_SIZE });
  useEffect(() => {
    try { sessionStorage.setItem(`opp-page:${key}`, JSON.stringify(state)); } catch { /* ignore */ }
  }, [key, state]);
  const setPage = useCallback((page) => setState((s) => (s.page === page ? s : { ...s, page })), []);
  const setPageSize = useCallback((pageSize) => setState((s) => (s.pageSize === pageSize ? s : { ...s, pageSize })), []);
  return { page: state.page, pageSize: state.pageSize, setPage, setPageSize };
};

/** Jump back to page 1 when filters/search change - but not on first mount (that would undo the restored page). */
export const useResetPageOnChange = (setPage, deps) => {
  const prev = useRef(JSON.stringify(deps));
  useEffect(() => {
    const now = JSON.stringify(deps);
    if (now !== prev.current) { prev.current = now; setPage(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
