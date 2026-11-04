import React, { useMemo, useState } from 'react';
import { Table } from 'antd';
import RowActions from './RowActions';
import EmptyState from './EmptyState';
import { pagerLook, defaultRowKey } from './utils';

/**
 * The one table for every page. It IS the antd Table: every antd prop (columns, sorter, filters,
 * rowSelection, expandable, summary, server-side paging, onChange ...) passes straight through, so
 * swapping `Table` for `AppTable` changes nothing functionally. On top it adds:
 *
 *  - serial   : prepend an "S.No" column (off by default). Numbers continue across pages.
 *  - actions  : PIMS-style icon-only row actions with tooltips (see RowActions). Appended as one
 *               "Actions" column, pinned to the right. Pages that build their own Actions column keep working.
 *  - defaults : horizontal scroll (`max-content`), row key (`id`, else `key`), pagination preset, empty state.
 */
const AppTable = React.forwardRef(
  (
    {
      columns = [],
      actions,
      actionsTitle = 'Actions',
      actionsWidth,
      serial = false,
      pagination,
      scroll,
      rowKey,
      locale,
      onChange,
      emptyText,
      className,
      ...rest
    },
    ref,
  ) => {
    // When the page does not control pagination itself, follow antd's own page so S.No keeps counting.
    const [innerPage, setInnerPage] = useState({ current: 1, pageSize: 10 });
    const controlled = pagination && typeof pagination === 'object' && pagination.current !== undefined;
    const current = controlled ? pagination.current : innerPage.current;
    const pageSize = controlled ? pagination.pageSize ?? 10 : pagination?.pageSize ?? innerPage.pageSize;
    const paged = pagination !== false;

    const finalColumns = useMemo(() => {
      const list = [...columns];
      if (serial) {
        list.unshift({
          title: 'S.No',
          key: '__sno',
          width: 64,
          render: (_v, _r, index) => (paged ? (current - 1) * pageSize + index + 1 : index + 1),
        });
      }
      if (actions?.length) {
        list.push({
          title: actionsTitle,
          key: '__actions',
          fixed: 'right',
          align: 'right',
          width: actionsWidth ?? actions.length * 34 + 16,
          render: (_v, record) => <RowActions actions={actions} record={record} />,
        });
      }
      return list;
    }, [columns, serial, actions, actionsTitle, actionsWidth, current, pageSize, paged]);

    const finalPagination =
      pagination === false
        ? false
        : { ...(pagination && typeof pagination === 'object' ? pagination : {}), ...pagerLook };

    const handleChange = (p, filters, sorter, extra) => {
      if (!controlled && p) setInnerPage({ current: p.current ?? 1, pageSize: p.pageSize ?? 10 });
      onChange?.(p, filters, sorter, extra);
    };

    return (
      <Table
        ref={ref}
        rowKey={rowKey ?? defaultRowKey}
        columns={finalColumns}
        pagination={finalPagination}
        scroll={{ x: 'max-content', ...(scroll || {}) }}
        className={['app-table', className].filter(Boolean).join(' ')}
        locale={{ emptyText: emptyText ?? <EmptyState title="No data" compact />, ...(locale || {}) }}
        onChange={handleChange}
        {...rest}
      />
    );
  },
);

AppTable.displayName = 'AppTable';
// antd statics stay available: <AppTable.Summary>, AppTable.SELECTION_COLUMN, ...
AppTable.Summary = Table.Summary;
AppTable.Column = Table.Column;
AppTable.ColumnGroup = Table.ColumnGroup;
AppTable.EXPAND_COLUMN = Table.EXPAND_COLUMN;
AppTable.SELECTION_COLUMN = Table.SELECTION_COLUMN;
AppTable.SELECTION_ALL = Table.SELECTION_ALL;
AppTable.SELECTION_INVERT = Table.SELECTION_INVERT;
AppTable.SELECTION_NONE = Table.SELECTION_NONE;

export default AppTable;
