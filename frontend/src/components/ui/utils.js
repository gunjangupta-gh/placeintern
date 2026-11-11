/** Small helpers shared by the common UI components. */

export const PAGE_SIZE_OPTIONS = ['10', '15', '20', '50', '100'];

/** UNDER_REVIEW -> "Under review" */
export const statusLabel = (s) => {
  const text = String(s ?? '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Pagination look shared by every table: "1–10 of 50" on the left, page numbers and a page-size selector
 * (10 / 15 / 20 / 50 / 100) on the right. It is forced on top of whatever a page passes, but the page keeps
 * control of current, pageSize, total and onChange.
 */
export const pagerLook = {
  showSizeChanger: true,
  pageSizeOptions: PAGE_SIZE_OPTIONS,
  showQuickJumper: false,
  hideOnSinglePage: false,
  showTotal: (total, range) => (total ? `${range[0]}–${range[1]} of ${total}` : '0 records'),
};

/** Row key that works for data with `id` (most tables) or antd's own `key`. */
export const defaultRowKey = (record) => record?.id ?? record?.key;
