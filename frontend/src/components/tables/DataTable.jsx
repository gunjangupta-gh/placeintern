import React from 'react';
import { Table, Empty, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../utils/constants';

const { Text } = Typography;

const DataTable = ({
  columns,
  dataSource,
  loading = false,
  pagination = true,
  rowKey = 'id',
  onChange,
  emptyText = 'No data available',
  emptyDescription = 'There are no records to display at the moment.',
  className = '',
  size = 'middle',
  bordered = false,
  showHeader = true,
  sticky = false,
  ...props
}) => {
  const defaultPagination = {
    // Use uncontrolled defaults so AntD can manage page changes internally
    defaultCurrent: 1,
    defaultPageSize: DEFAULT_PAGE_SIZE,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total, range) => (
      <Text className="text-text-secondary text-sm">
        Showing <Text strong className="text-text-primary">{range[0]}-{range[1]}</Text> of{' '}
        <Text strong className="text-text-primary">{total}</Text> items
      </Text>
    ),
    pageSizeOptions: PAGE_SIZE_OPTIONS,
  };

  // Enhanced empty state
  const customEmpty = (
    <Empty
      image={<InboxOutlined className="text-5xl text-text-tertiary" />}
      styles={{ image: { height: 60, marginBottom: 12 } }}
      description={
        <div className="text-center">
          <Text className="text-text-secondary text-base block mb-1">
            {emptyText}
          </Text>
          <Text className="text-text-tertiary text-sm">
            {emptyDescription}
          </Text>
        </div>
      }
    />
  );

  // Enhance columns with consistent styling
  const enhancedColumns = columns?.map((col) => ({
    ...col,
    // Add ellipsis for long text by default
    ellipsis: col.ellipsis !== false ? { showTitle: true } : false,
    // Style the header
    title: typeof col.title === 'string' ? (
      <span className="font-semibold text-xs uppercase tracking-wider text-text-secondary">
        {col.title}
      </span>
    ) : col.title,
  }));

  return (
    <div className={`data-table-wrapper ${className}`}>
      <Table
        columns={enhancedColumns}
        dataSource={dataSource}
        loading={{
          spinning: loading,
          tip: 'Loading data...',
        }}
        rowKey={rowKey}
        pagination={pagination ? { ...defaultPagination, ...pagination } : false}
        onChange={onChange}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: customEmpty }}
        size={size}
        bordered={bordered}
        showHeader={showHeader}
        sticky={sticky}
        className="
          rounded-xl overflow-hidden
          [&_.ant-table]:rounded-xl
          [&_.ant-table-container]:rounded-xl
          [&_.ant-table-content]:rounded-xl
          [&_.ant-table-thead>tr>th]:bg-background-tertiary
          [&_.ant-table-thead>tr>th]:border-b
          [&_.ant-table-thead>tr>th]:border-border
          [&_.ant-table-tbody>tr>td]:border-b
          [&_.ant-table-tbody>tr>td]:border-border/50
          [&_.ant-table-tbody>tr:last-child>td]:border-b-0
          [&_.ant-table-tbody>tr:hover>td]:bg-primary-50/50
          [&_.ant-table-row-selected>td]:bg-primary-50
          [&_.ant-pagination]:mt-4
          [&_.ant-pagination]:px-4
          [&_.ant-pagination]:py-3
          [&_.ant-pagination]:bg-background-secondary
          [&_.ant-pagination]:rounded-b-xl
        "
        rowClassName={(record, index) =>
          `transition-colors duration-150 ${
            index % 2 === 0 ? 'bg-background' : 'bg-background-secondary/50'
          }`
        }
        {...props}
      />
    </div>
  );
};

export default DataTable;