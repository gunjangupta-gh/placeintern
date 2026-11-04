/**
 * One pagination setup for every internship-opportunity list (State, Principal, Faculty, Student),
 * so they all behave the same: page size selector, "x-y of N" total, quick jump on long lists.
 * onChange(page, pageSize) - the page resets to 1 when the page size changes.
 */
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
export const DEFAULT_PAGE_SIZE = 20;

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
