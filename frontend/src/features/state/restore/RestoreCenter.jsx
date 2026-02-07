import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Row,
  Col,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Modal,
  Spin,
  Empty,
  Alert,
  Tooltip,
  Tabs,
  DatePicker,
  Popconfirm,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  UndoOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  EyeOutlined,
  CalendarOutlined,
  UserOutlined,
  BankOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  HistoryOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  fetchDeletedItemsSummary,
  fetchDeletedItems,
  restoreDeletedItem,
  bulkRestoreDeletedItems,
  selectRestoreCenterSummary,
  selectRestoreCenterItems,
  selectRestoreCenterPagination,
  selectRestoreCenterSelectedType,
  selectRestoreCenterLoading,
  selectRestoreCenterSummaryLoading,
  selectRestoreCenterRestoring,
  selectRestoreCenterError,
  setRestoreCenterType,
  clearRestoreCenterError,
  selectInstitutions,
  selectInstitutionsLoading,
  fetchInstitutions,
} from '../store/stateSlice';
import { useDebounce } from '../../../hooks/useDebounce';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const RestoreCenter = () => {
  const dispatch = useDispatch();

  // Redux state
  const summary = useSelector(selectRestoreCenterSummary);
  const items = useSelector(selectRestoreCenterItems);
  const pagination = useSelector(selectRestoreCenterPagination);
  const selectedType = useSelector(selectRestoreCenterSelectedType);
  const loading = useSelector(selectRestoreCenterLoading);
  const summaryLoading = useSelector(selectRestoreCenterSummaryLoading);
  const restoring = useSelector(selectRestoreCenterRestoring);
  const error = useSelector(selectRestoreCenterError);
  const institutions = useSelector(selectInstitutions);
  const institutionsLoading = useSelector(selectInstitutionsLoading);

  // Local state
  const [searchInput, setSearchInput] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const debouncedSearch = useDebounce(searchInput);

  // Fetch summary and institutions on mount
  useEffect(() => {
    dispatch(fetchDeletedItemsSummary());
    // Fetch institutions for the filter dropdown if not already loaded
    if (!institutions || institutions.length === 0) {
      dispatch(fetchInstitutions({ limit: 1000 })); // Get all institutions for dropdown
    }
  }, [dispatch, institutions?.length]);

  // Fetch items when type, filters, or pagination changes
  useEffect(() => {
    const params = {
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
      institutionId: institutionId || undefined,
      fromDate: dateRange?.[0]?.toISOString(),
      toDate: dateRange?.[1]?.toISOString(),
    };
    dispatch(fetchDeletedItems({ type: selectedType, params }));
  }, [dispatch, selectedType, currentPage, pageSize, debouncedSearch, institutionId, dateRange]);

  // Reset selection and pagination when type changes
  useEffect(() => {
    setSelectedRowKeys([]);
    setCurrentPage(1);
  }, [selectedType]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [institutionId, dateRange, debouncedSearch]);

  // Handle type change
  const handleTypeChange = (type) => {
    dispatch(setRestoreCenterType(type));
  };

  // Handle single restore
  const handleRestore = async (id) => {
    if (!id) {
      toast.error('Invalid item ID');
      return;
    }
    try {
      const result = await dispatch(restoreDeletedItem({ type: selectedType, id })).unwrap();
      toast.success(result?.message || 'Item restored successfully');
      // Refresh summary
      dispatch(fetchDeletedItemsSummary(institutionId || undefined));
    } catch (err) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Failed to restore item';
      toast.error(errorMessage);
    }
  };

  // Handle bulk restore
  const handleBulkRestore = async () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) {
      toast('No items selected for restore', { icon: '⚠️' });
      return;
    }

    // Filter out any invalid IDs
    const validIds = selectedRowKeys.filter(id => id && typeof id === 'string');
    if (validIds.length === 0) {
      toast.error('No valid items selected');
      return;
    }

    try {
      const result = await dispatch(bulkRestoreDeletedItems({ type: selectedType, ids: validIds })).unwrap();
      const restoredCount = result?.restored || validIds.length;
      const failedCount = result?.failed || 0;

      if (failedCount > 0) {
        toast(`Restored ${restoredCount} items. ${failedCount} items failed.`, { icon: '⚠️' });
      } else {
        toast.success(`${restoredCount} items restored successfully`);
      }
      setSelectedRowKeys([]);
      // Refresh summary
      dispatch(fetchDeletedItemsSummary(institutionId || undefined));
    } catch (err) {
      const errorMessage = typeof err === 'string' ? err : err?.message || 'Failed to restore items';
      toast.error(errorMessage);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    dispatch(fetchDeletedItemsSummary(institutionId || undefined));
    dispatch(fetchDeletedItems({
      type: selectedType,
      params: {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        institutionId: institutionId || undefined,
        fromDate: dateRange?.[0]?.toISOString(),
        toDate: dateRange?.[1]?.toISOString(),
      },
    }));
  };

  // Handle table pagination change
  const handleTableChange = (paginationConfig) => {
    setCurrentPage(paginationConfig.current);
    setPageSize(paginationConfig.pageSize);
  };

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
    getCheckboxProps: (record) => ({
      disabled: restoring[record.id],
    }),
  };

  // Get type-specific label
  const getTypeLabel = (type) => {
    switch (type) {
      case 'monthly-reports':
        return 'Monthly Reports';
      case 'faculty-visits':
        return 'Faculty Visits';
      case 'documents':
        return 'Documents';
      default:
        return type;
    }
  };

  // Get columns based on selected type
  const columns = useMemo(() => {
    const baseColumns = [
      {
        title: 'Deleted At',
        key: 'deletedAt',
        width: 160,
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-text-tertiary" />
            <Text className="text-sm">
              {record.deletedAt ? dayjs(record.deletedAt).format('MMM DD, YYYY HH:mm') : 'N/A'}
            </Text>
          </div>
        ),
      },
      {
        title: 'Institution',
        key: 'institution',
        width: 200,
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <BankOutlined className="text-text-tertiary" />
            <Text className="text-sm truncate max-w-[150px]" title={record.institution?.name || record.institutionName}>
              {record.institution?.name || record.institutionName || 'N/A'}
            </Text>
          </div>
        ),
      },
      {
        title: 'Action',
        key: 'action',
        width: 120,
        fixed: 'right',
        align: 'center',
        render: (_, record) => (
          <Popconfirm
            title="Restore this item?"
            description="This will restore the item and its associated data."
            onConfirm={() => handleRestore(record.id)}
            okText="Restore"
            cancelText="Cancel"
          >
            <Button
              type="primary"
              size="small"
              icon={<UndoOutlined />}
              loading={restoring[record.id]}
              className="rounded-lg"
            >
              Restore
            </Button>
          </Popconfirm>
        ),
      },
    ];

    // Type-specific columns
    if (selectedType === 'monthly-reports') {
      return [
        {
          title: 'Report',
          key: 'report',
          width: 280,
          render: (_, record) => (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <Text strong className="text-sm text-text-primary block">
                  {record.month && record.year ? `${dayjs().month(record.month - 1).format('MMMM')} ${record.year}` : 'Monthly Report'}
                </Text>
                <Text className="text-xs text-text-tertiary">
                  Status: <Tag color={record.status === 'APPROVED' ? 'success' : record.status === 'SUBMITTED' ? 'processing' : 'warning'} className="m-0 text-[10px] rounded border-0">
                    {record.status || 'N/A'}
                  </Tag>
                </Text>
              </div>
            </div>
          ),
        },
        {
          title: 'Student',
          key: 'student',
          width: 180,
          render: (_, record) => (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-text-tertiary" />
              <Text className="text-sm truncate max-w-[140px]" title={record.student?.user?.name || record.studentName}>
                {record.student?.user?.name || record.studentName || 'N/A'}
              </Text>
            </div>
          ),
        },
        ...baseColumns,
      ];
    }

    if (selectedType === 'faculty-visits') {
      return [
        {
          title: 'Visit',
          key: 'visit',
          width: 280,
          render: (_, record) => (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center text-success">
                <EyeOutlined className="text-lg" />
              </div>
              <div>
                <Text strong className="text-sm text-text-primary block">
                  {record.visitDate ? dayjs(record.visitDate).format('MMM DD, YYYY') : 'Faculty Visit'}
                </Text>
                <Text className="text-xs text-text-tertiary">
                  Status: <Tag color={record.status === 'COMPLETED' ? 'success' : record.status === 'SCHEDULED' ? 'processing' : 'warning'} className="m-0 text-[10px] rounded border-0">
                    {record.status || 'N/A'}
                  </Tag>
                </Text>
              </div>
            </div>
          ),
        },
        {
          title: 'Faculty',
          key: 'faculty',
          width: 180,
          render: (_, record) => (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-text-tertiary" />
              <Text className="text-sm truncate max-w-[140px]" title={record.faculty?.user?.name || record.facultyName}>
                {record.faculty?.user?.name || record.facultyName || 'N/A'}
              </Text>
            </div>
          ),
        },
        {
          title: 'Student',
          key: 'student',
          width: 180,
          render: (_, record) => (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-text-tertiary" />
              <Text className="text-sm truncate max-w-[140px]" title={record.student?.user?.name || record.studentName}>
                {record.student?.user?.name || record.studentName || 'N/A'}
              </Text>
            </div>
          ),
        },
        ...baseColumns,
      ];
    }

    if (selectedType === 'documents') {
      return [
        {
          title: 'Document',
          key: 'document',
          width: 280,
          render: (_, record) => (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
                <FileTextOutlined className="text-lg" />
              </div>
              <div>
                <Text strong className="text-sm text-text-primary block truncate max-w-[200px]" title={record.title || record.fileName}>
                  {record.title || record.fileName || 'Document'}
                </Text>
                <Text className="text-xs text-text-tertiary">
                  Type: <Tag className="m-0 text-[10px] rounded border-0 bg-background-tertiary">
                    {record.documentType || record.type || 'N/A'}
                  </Tag>
                </Text>
              </div>
            </div>
          ),
        },
        {
          title: 'Student',
          key: 'student',
          width: 180,
          render: (_, record) => (
            <div className="flex items-center gap-2">
              <UserOutlined className="text-text-tertiary" />
              <Text className="text-sm truncate max-w-[140px]" title={record.student?.user?.name || record.studentName}>
                {record.student?.user?.name || record.studentName || 'N/A'}
              </Text>
            </div>
          ),
        },
        ...baseColumns,
      ];
    }

    return baseColumns;
  }, [selectedType, restoring]);

  // Tab items
  const tabItems = [
    {
      key: 'monthly-reports',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          Monthly Reports
          <Tag className="ml-1 rounded-full px-2 text-[10px] m-0 border-0 bg-primary/10 text-primary">
            {summary.monthlyReports}
          </Tag>
        </span>
      ),
    },
    {
      key: 'faculty-visits',
      label: (
        <span className="flex items-center gap-2">
          <EyeOutlined />
          Faculty Visits
          <Tag className="ml-1 rounded-full px-2 text-[10px] m-0 border-0 bg-success/10 text-success">
            {summary.facultyVisits}
          </Tag>
        </span>
      ),
    },
    {
      key: 'documents',
      label: (
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          Documents
          <Tag className="ml-1 rounded-full px-2 text-[10px] m-0 border-0 bg-warning/10 text-warning">
            {summary.documents}
          </Tag>
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-surface border border-border shadow-soft flex items-center justify-center text-primary">
            <HistoryOutlined className="text-2xl" />
          </div>
          <div>
            <Title level={2} className="!mb-0 !text-2xl font-bold text-text-primary">
              Restore Center
            </Title>
            <Text className="text-text-secondary text-sm">
              Restore soft-deleted items across all institutions
            </Text>
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading || summaryLoading}
          className="rounded-xl h-10 border-border hover:border-primary hover:text-primary shadow-sm bg-surface font-medium"
        >
          Refresh Data
        </Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-soft bg-surface h-full hover:translate-y-[-2px] transition-transform duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-error/10 flex items-center justify-center text-error shadow-sm border border-error/20">
                <DeleteOutlined className="text-xl" />
              </div>
              <div>
                <Spin spinning={summaryLoading} size="small">
                  <div className="text-3xl font-black text-text-primary leading-tight">{summary.total}</div>
                </Spin>
                <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Total Deleted</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={`rounded-2xl border-border shadow-soft bg-surface h-full hover:translate-y-[-2px] transition-transform duration-300 cursor-pointer ${selectedType === 'monthly-reports' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => handleTypeChange('monthly-reports')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
                <FileTextOutlined className="text-xl" />
              </div>
              <div>
                <Spin spinning={summaryLoading} size="small">
                  <div className="text-3xl font-black text-text-primary leading-tight">{summary.monthlyReports}</div>
                </Spin>
                <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Monthly Reports</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={`rounded-2xl border-border shadow-soft bg-surface h-full hover:translate-y-[-2px] transition-transform duration-300 cursor-pointer ${selectedType === 'faculty-visits' ? 'ring-2 ring-success' : ''}`}
            onClick={() => handleTypeChange('faculty-visits')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success shadow-sm border border-success/20">
                <EyeOutlined className="text-xl" />
              </div>
              <div>
                <Spin spinning={summaryLoading} size="small">
                  <div className="text-3xl font-black text-text-primary leading-tight">{summary.facultyVisits}</div>
                </Spin>
                <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Faculty Visits</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            className={`rounded-2xl border-border shadow-soft bg-surface h-full hover:translate-y-[-2px] transition-transform duration-300 cursor-pointer ${selectedType === 'documents' ? 'ring-2 ring-warning' : ''}`}
            onClick={() => handleTypeChange('documents')}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning shadow-sm border border-warning/20">
                <FileTextOutlined className="text-xl" />
              </div>
              <div>
                <Spin spinning={summaryLoading} size="small">
                  <div className="text-3xl font-black text-text-primary leading-tight">{summary.documents}</div>
                </Spin>
                <div className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest">Documents</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card className="rounded-2xl border-border shadow-soft bg-surface" styles={{ body: { padding: '0' } }}>
        <Tabs
          activeKey={selectedType}
          onChange={handleTypeChange}
          items={tabItems}
          className="px-4 pt-2"
        />

        {/* Filters */}
        <div className="p-4 border-b border-border bg-background-tertiary/30">
          <div className="flex flex-wrap items-center gap-4">
            <Input.Search
              placeholder={`Search ${getTypeLabel(selectedType).toLowerCase()}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full md:w-64 rounded-xl h-10 bg-background border-border"
              allowClear
              prefix={<SearchOutlined className="text-text-tertiary" />}
            />
            <Select
              placeholder="All Institutions"
              value={institutionId || undefined}
              onChange={setInstitutionId}
              allowClear
              className="w-full md:w-56 h-10 rounded-lg"
              showSearch
              optionFilterProp="children"
              loading={institutionsLoading}
              notFoundContent={institutionsLoading ? <Spin size="small" /> : 'No institutions found'}
            >
              {Array.isArray(institutions) && institutions.map((inst) => (
                <Select.Option key={inst.id} value={inst.id}>{inst.name}</Select.Option>
              ))}
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              className="w-full md:w-auto h-10 rounded-xl"
              placeholder={['From Date', 'To Date']}
            />
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Restore ${selectedRowKeys.length} items?`}
                description="This will restore all selected items and their associated data."
                onConfirm={handleBulkRestore}
                okText="Restore All"
                cancelText="Cancel"
              >
                <Button
                  type="primary"
                  icon={<UndoOutlined />}
                  className="h-10 rounded-xl font-medium"
                >
                  Restore Selected ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4">
            <Alert
              type="error"
              message="Error"
              description={error}
              showIcon
              closable
              onClose={() => dispatch(clearRestoreCenterError())}
              className="rounded-xl border-error/20 bg-error/5"
            />
          </div>
        )}

        {/* Info Alert */}
        <div className="p-4 pt-0">
          <Alert
            type="info"
            message="Restore Information"
            description="Restoring items will also restore associated counters (e.g., visit counts, report counts) and create an audit log entry."
            showIcon
            className="rounded-xl border-blue-200/50 bg-blue-50/50 mt-4"
            closable
          />
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: pagination?.total || 0,
            showSizeChanger: true,
            showTotal: (total, range) => (
              <span className="text-text-tertiary">
                Showing {range[0]}-{range[1]} of {total} deleted items
              </span>
            ),
            pageSizeOptions: ['10', '20', '50', '100'],
            className: 'px-6 py-4',
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          size="middle"
          className="custom-table"
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span className="text-text-tertiary">
                    No deleted {getTypeLabel(selectedType).toLowerCase()} found
                  </span>
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default RestoreCenter;
