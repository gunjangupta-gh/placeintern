import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Table,
  Row,
  Col,
  Statistic,
  Tag,
  Button,
  Input,
  Select,
  Space,
  Avatar,
  Typography,
  Modal,
  Spin,
  Empty,
  Alert,
  Tooltip,
  Badge,
  Collapse,
  List,
  Progress,
} from 'antd';
import {
  BankOutlined,
  TeamOutlined,
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  UserOutlined,
  BuildOutlined,
  RiseOutlined,
  GlobalOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import {
  fetchAllCompanies,
  fetchCompanyDetails,
  selectAllCompanies,
  selectCompaniesPagination,
  selectCompaniesSummary,
  selectCompaniesLoading,
  selectSelectedCompany,
  selectSelectedCompanyDetails,
  selectCompanyDetailsLoading,
  selectCompaniesError,
  selectCompanyDetailsError,
  setSelectedCompany,
  clearSelectedCompany,
} from '../store/stateSlice';
import { useDebounce } from '../../../hooks/useDebounce';

const { Title, Text } = Typography;
const { Option } = Select;

const CompaniesOverview = () => {
  const dispatch = useDispatch();

  // Redux state
  const companies = useSelector(selectAllCompanies);
  const pagination = useSelector(selectCompaniesPagination);
  const summary = useSelector(selectCompaniesSummary);
  const loading = useSelector(selectCompaniesLoading);
  const selectedCompany = useSelector(selectSelectedCompany);
  const selectedCompanyDetails = useSelector(selectSelectedCompanyDetails);
  const detailsLoading = useSelector(selectCompanyDetailsLoading);
  const error = useSelector(selectCompaniesError);
  const detailsError = useSelector(selectCompanyDetailsError);

  // Local state
  const [searchInput, setSearchInput] = useState('');
  const [industryType, setIndustryType] = useState('');
  const [sortBy, setSortBy] = useState('studentCount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  const debouncedSearch = useDebounce(searchInput);

  // Fetch companies - only fetch when necessary
  const fetchCompanies = useCallback((params = {}) => {
    dispatch(fetchAllCompanies({
      page: params.page || currentPage,
      limit: params.limit || pageSize,
      search: params.search !== undefined ? params.search : debouncedSearch,
      // Don't send industryType/sortBy/sortOrder to server - we'll filter client-side
      forceRefresh: params.forceRefresh,
    }));
  }, [dispatch, currentPage, pageSize, debouncedSearch]);

  // Initial fetch without force refresh to use cache if available
  useEffect(() => {
    fetchCompanies();
    setIsInitialMount(false);
  }, []);

  // Only refetch when debounced search changes (requires server-side filtering)
  // Don't refetch for sort/industryType changes - we'll handle those client-side
  useEffect(() => {
    // Skip the initial mount to avoid double fetch
    if (!isInitialMount) {
      fetchCompanies({ page: 1 });
      setCurrentPage(1);
    }
  }, [debouncedSearch]);

  // Handle view company details
  const handleViewDetails = (company) => {
    dispatch(setSelectedCompany(company));
    dispatch(fetchCompanyDetails(company.id));
    setDetailModalVisible(true);
  };

  // Handle modal close - delay clear to prevent flash during animation
  const handleCloseModal = () => {
    setDetailModalVisible(false);
    // Clear data after modal animation completes
    setTimeout(() => {
      dispatch(clearSelectedCompany());
    }, 300);
  };

  // Handle pagination change - use cache when possible
  const handleTableChange = (paginationConfig) => {
    const pageChanged = paginationConfig.current !== currentPage;
    const pageSizeChanged = paginationConfig.pageSize !== pageSize;

    setCurrentPage(paginationConfig.current);
    setPageSize(paginationConfig.pageSize);

    // Only fetch if page or pageSize actually changed
    if (pageChanged || pageSizeChanged) {
      fetchCompanies({
        page: paginationConfig.current,
        limit: paginationConfig.pageSize,
        // Don't force refresh - let cache logic handle it
      });
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
  };

  // Client-side filtering and sorting of companies
  const filteredAndSortedCompanies = useMemo(() => {
    let result = [...companies];

    // Client-side industry type filtering
    if (industryType) {
      result = result.filter(company => company.industryType === industryType);
    }

    // Client-side sorting
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'studentCount':
          aVal = a.totalStudents || 0;
          bVal = b.totalStudents || 0;
          break;
        case 'institutionCount':
          aVal = a.institutionCount || 0;
          bVal = b.institutionCount || 0;
          break;
        case 'companyName':
          aVal = (a.companyName || '').toLowerCase();
          bVal = (b.companyName || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    return result;
  }, [companies, industryType, sortBy, sortOrder]);

  // Table columns
  const columns = useMemo(() => [
    {
      title: 'Company',
      key: 'company',
      width: 280,
      fixed: 'left',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
            record.isSelfIdentifiedCompany 
              ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' 
              : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <BankOutlined className="text-base" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <Text strong className="text-xs text-text-primary truncate max-w-[180px]" title={record.companyName}>
                {record.companyName || 'Unknown Company'}
              </Text>
              {record.isSelfIdentifiedCompany && (
                <Tag color="purple" className="text-[10px] px-2 py-0.5 m-0 rounded-full border-0 font-medium">
                  Self-ID
                </Tag>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-text-tertiary">
              <EnvironmentOutlined className="text-xs" />
              <span className="truncate max-w-[200px]">
                {record.city && record.state
                  ? `${record.city}, ${record.state}`
                  : record.address || 'Location not specified'}
              </span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Industry',
      dataIndex: 'industryType',
      key: 'industryType',
      width: 150,
      render: (type, record) => (
        <Tag 
          color={record.isSelfIdentifiedCompany ? 'purple' : 'cyan'} 
          className="font-medium text-[10px] uppercase tracking-wide rounded-full border-0 m-0 px-2 py-0.5"
        >
          {type || 'General'}
        </Tag>
      ),
    },
    {
      title: 'Active Students',
      key: 'stats',
      width: 140,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="Count includes only currently active students">
          <div className="flex flex-col items-center p-2 rounded-xl bg-background-tertiary/50 border border-border/50 cursor-help">
            <div className="flex items-baseline gap-1">
              <Text className="text-lg font-bold text-primary leading-none">{record.totalStudents || 0}</Text>
              <Text className="text-[10px] text-text-tertiary font-bold uppercase">Active</Text>
            </div>
            <Text className="text-[10px] text-text-secondary mt-1">
              across <strong className="text-text-primary">{record.institutionCount || 0}</strong> institutes
            </Text>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Top Institutions',
      key: 'institutions',
      width: 240,
      render: (_, record) => (
        <div className="flex flex-wrap gap-2">
          {record.institutions?.slice(0, 2).map((inst, i) => (
            <Tooltip key={i} title={`${inst.name}: ${inst.studentCount} students`}>
              <Tag className="text-[10px] m-0 rounded-full border border-border bg-surface text-text-secondary px-2 py-0.5 font-medium">
                {inst.code || inst.name?.substring(0, 10)}: <strong className="text-primary">{inst.studentCount}</strong>
              </Tag>
            </Tooltip>
          ))}
          {record.institutions?.length > 2 && (
            <Tooltip title={record.institutions.slice(2).map(i => `${i.name}: ${i.studentCount}`).join(', ')}>
              <Tag className="text-[10px] m-0 cursor-pointer rounded-full border border-border bg-background-tertiary text-text-tertiary px-2 py-0.5 hover:bg-background-tertiary/80 transition-colors">
                +{record.institutions.length - 2} more
              </Tag>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (_, record) => {
        if (record.isSelfIdentifiedCompany) {
          return <Tag icon={<CheckCircleOutlined />} color="purple" className="m-0 rounded-full border-0 font-medium text-[10px] uppercase tracking-wide px-2 py-0.5">Auto-Approved</Tag>;
        }
        if (record.isApproved) return <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-full border-0 font-medium text-[10px] uppercase tracking-wide px-2 py-0.5">Approved</Tag>;
        if (record.isVerified) return <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0 rounded-full border-0 font-medium text-[10px] uppercase tracking-wide px-2 py-0.5">Verified</Tag>;
        return <Tag icon={<ClockCircleOutlined />} color="warning" className="m-0 rounded-full border-0 font-medium text-[10px] uppercase tracking-wide px-2 py-0.5">Pending</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined style={{ fontSize: 14 }} />}
          onClick={() => handleViewDetails(record)}
          className="text-text-secondary hover:text-primary hover:bg-primary/10 rounded-full h-8 w-8 flex items-center justify-center p-0"
        />
      ),
    },
  ], []);

  return (
    <div className="">
      <Card
        title="Companies Overview"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchCompanies({ forceRefresh: true })}
            loading={loading}
          >
            Refresh
          </Button>
        }
        variant="borderless"
      >
        {/* Summary Cards */}
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={12} sm={6}>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-600">{summary?.totalCompanies || 0}</div>
              <div className="text-xs text-gray-500">Total Companies</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-green-600">{summary?.totalStudentsPlaced || 0}</div>
              <div className="text-xs text-gray-500">Students Placed</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-amber-600">{summary?.totalSelfIdentified || 0}</div>
              <div className="text-xs text-gray-500">Self-Identified</div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-teal-600">{summary?.selfIdentifiedRate || 0}%</div>
              <div className="text-xs text-gray-500">Self-ID Rate</div>
            </div>
          </Col>
        </Row>

        {/* Search and Filters */}
        <div className="mb-4">
          <Input.Search
            placeholder="Search companies..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ width: 350 }}
            allowClear
            enterButton
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            placeholder="Industry Type"
            value={industryType || undefined}
            onChange={setIndustryType}
            allowClear
            style={{ width: 160 }}
          >
            {summary?.industryTypes?.map((type) => (
              <Select.Option key={type} value={type}>{type}</Select.Option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 180 }}
          >
            <Select.Option value="studentCount">Sort by Students</Select.Option>
            <Select.Option value="institutionCount">Sort by Institutions</Select.Option>
            <Select.Option value="companyName">Sort by Name</Select.Option>
          </Select>
          <Button
            icon={sortOrder === 'desc' ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
            onClick={toggleSortOrder}
          >
            {sortOrder === 'desc' ? 'Desc' : 'Asc'}
          </Button>
        </div>

        {/* Error Alert */}
        {error && <Alert type="error" message="Error" description={error} showIcon closable className="mb-4" />}

        {/* Companies Table */}
        <div className="custom-table">
          <Table
            columns={columns}
            dataSource={filteredAndSortedCompanies}
            rowKey="id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: pagination?.total || 0,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} companies`,
              pageSizeOptions: ['10', '20', '50', '100'],
            }}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
            size="small"
            rowClassName={(record) => record.isSelfIdentifiedCompany ? 'bg-purple-50/10 hover:bg-purple-50/20' : ''}
          />
        </div>
      </Card>

      {/* Company Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              selectedCompanyDetails?.isSelfIdentifiedCompany 
                ? 'bg-purple-500/10 border-purple-500/20 text-purple-600' 
                : 'bg-primary/10 border-primary/20 text-primary'
            }`}>
              <BankOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base text-text-primary">{selectedCompanyDetails?.companyName || 'Company Details'}</span>
                {selectedCompanyDetails?.isSelfIdentifiedCompany && (
                  <Tag color="purple" className="text-[10px] font-medium uppercase tracking-wide rounded-full border-0 m-0 px-2 py-0.5">Self-ID</Tag>
                )}
              </div>
              <Text className="text-text-tertiary text-[10px] font-medium uppercase tracking-wide mt-0.5">
                {selectedCompanyDetails?.totalStudents || 0} active students across {selectedCompanyDetails?.institutionCount || 0} institutions
              </Text>
            </div>
          </div>
        }
        open={detailModalVisible}
        onCancel={handleCloseModal}
        footer={null}
        width={980}
        destroyOnClose 
        className="rounded-2xl overflow-hidden"
        styles={{ content: { borderRadius: '20px' }, body: { padding: '16px 20px' } }}
      >
        {detailsLoading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" tip="Loading details..." />
          </div>
        ) : detailsError ? (
          <div className="py-12 px-6">
            <Alert
              type="error"
              title="Failed to load details"
              description={detailsError}
              action={
                <Button size="small" type="primary" onClick={() => { if (selectedCompany?.id) dispatch(fetchCompanyDetails(selectedCompany.id)); }} className="rounded-lg">Retry</Button>
              }
              showIcon
              className="rounded-xl border-error/20 bg-error/5"
            />
          </div>
        ) : selectedCompanyDetails ? (
          <div className="space-y-5 pt-2">
            {/* Company Info */}
            <Card
              size="small"
              className={`rounded-2xl border ${selectedCompanyDetails.isSelfIdentifiedCompany
                ? 'border-purple-200 bg-purple-50/30'
                : 'border-border bg-surface'}`}
              bodyStyle={{ padding: '12px' }}
            >
              <Row gutter={[24, 16]}>
                <Col xs={24} sm={8}>
                  <div className="flex items-center gap-2 mb-1">
                    <BuildOutlined className="text-text-tertiary text-xs" />
                    <Text className="text-[10px] uppercase font-semibold text-text-tertiary tracking-widest">Industry Type</Text>
                  </div>
                  <Tag className="m-0 rounded-full font-medium bg-background border-border text-text-primary px-2 py-0.5 text-[10px]">
                    {selectedCompanyDetails.industryType || 'General'}
                  </Tag>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="flex items-center gap-2 mb-1">
                    <EnvironmentOutlined className="text-text-tertiary text-xs" />
                    <Text className="text-[10px] uppercase font-semibold text-text-tertiary tracking-widest">Location</Text>
                  </div>
                  <Text className="text-text-primary font-medium text-xs">
                    {selectedCompanyDetails.city && selectedCompanyDetails.state
                      ? `${selectedCompanyDetails.city}, ${selectedCompanyDetails.state}`
                      : selectedCompanyDetails.address || 'Not specified'}
                  </Text>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="flex items-center gap-2 mb-1">
                    <SafetyCertificateOutlined className="text-text-tertiary text-xs" />
                    <Text className="text-[10px] uppercase font-semibold text-text-tertiary tracking-widest">Status</Text>
                  </div>
                  {selectedCompanyDetails.isSelfIdentifiedCompany ? (
                    <Tag icon={<CheckCircleOutlined />} color="purple" className="m-0 rounded-full border-0 font-medium text-[10px] px-2 py-0.5">Auto-Approved</Tag>
                  ) : (
                    <Space size={[0, 8]} wrap>
                      {selectedCompanyDetails.isApproved && <Tag icon={<CheckCircleOutlined />} color="success" className="m-0 rounded-full border-0 font-medium text-[10px] px-2 py-0.5">Approved</Tag>}
                      {selectedCompanyDetails.isVerified && <Tag icon={<SafetyCertificateOutlined />} color="processing" className="m-0 rounded-full border-0 font-medium text-[10px] px-2 py-0.5">Verified</Tag>}
                    </Space>
                  )}
                </Col>
                {(selectedCompanyDetails.email || selectedCompanyDetails.phone) && (
                  <>
                    <Col xs={24} sm={12}>
                      <div className="flex items-center gap-2 mb-1">
                        <MailOutlined className="text-text-tertiary text-xs" />
                        <Text className="text-[10px] uppercase font-semibold text-text-tertiary tracking-widest">Email</Text>
                      </div>
                      <Text className="text-text-primary font-medium text-xs">{selectedCompanyDetails.email || 'N/A'}</Text>
                    </Col>
                    <Col xs={24} sm={12}>
                      <div className="flex items-center gap-2 mb-1">
                        <PhoneOutlined className="text-text-tertiary text-xs" />
                        <Text className="text-[10px] uppercase font-semibold text-text-tertiary tracking-widest">Phone</Text>
                      </div>
                      <Text className="text-text-primary font-medium text-xs">{selectedCompanyDetails.phone || 'N/A'}</Text>
                    </Col>
                  </>
                )}
              </Row>
            </Card>

            {/* Institutions Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <TeamOutlined className="text-primary text-base" />
                <Title level={5} className="!mb-0 !text-xs uppercase tracking-widest text-text-tertiary font-semibold">Participating Institutions ({selectedCompanyDetails.institutions?.length || 0})</Title>
              </div>
              
              <Collapse
                accordion
                ghost
                className="bg-transparent ant-collapse-custom-style"
                expandIconPosition="end"
                items={selectedCompanyDetails.institutions?.map((institution, idx) => ({
                  key: idx,
                  label: (
                    <div className="flex items-center justify-between w-full py-2 border-b border-border/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-semibold">
                          {(institution.code?.[0] || institution.shortName?.[0] || institution.name?.[0] || 'I').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Text strong className="text-text-primary block text-xs truncate">
                            {institution.shortName || institution.name}
                          </Text>
                          <Text type="secondary" className="text-[10px] font-mono">
                            {institution.code || '—'}
                          </Text>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Text className="text-[10px] text-text-tertiary">Students</Text>
                        <Badge count={institution.studentCount} className="[&_.ant-badge-count]:!bg-primary [&_.ant-badge-count]:shadow-none" />
                      </div>
                    </div>
                  ),
                  className: "mb-2 bg-transparent overflow-hidden",
                  children: (
                    <div className="space-y-3 pb-3">
                      {/* Branch Distribution */}
                      {institution.branchWiseData?.length > 0 && (
                        <div className="px-3 pt-2">
                          <Text className="text-[10px] uppercase font-semibold text-text-tertiary mb-2 block tracking-widest">Branch Distribution</Text>
                          <div className="flex flex-wrap gap-2">
                            {institution.branchWiseData.map((b, i) => (
                              <Tag key={i} className="m-0 rounded-full border border-border bg-background text-text-secondary px-2 py-0.5 text-[10px]">
                                {b.branch}: <strong className="text-primary">{b.count}</strong>
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Students Table */}
                      <div className="border-t border-border/60 overflow-hidden mx-0">
                        <Table
                          dataSource={institution.students || []}
                          pagination={{ pageSize: 5, showSizeChanger: false }}
                          size="small"
                          columns={[
                            {
                              title: 'Student',
                              key: 'student',
                              render: (_, record) => (
                                <div className="flex items-center gap-3">
                                  <Avatar size="small" icon={<UserOutlined />} className="bg-background-tertiary text-text-secondary" />
                                  <div>
                                    <div className="font-medium text-xs text-text-primary">{record.user?.name || record.name}</div>
                                    <div className="text-[10px] text-text-tertiary">{record.user?.email || record.email}</div>
                                  </div>
                                </div>
                              ),
                            },
                            {
                              title: 'Roll No.',
                              key: 'rollNumber',
                              width: 120,
                              render: (_, record) => <span className="font-mono text-[10px] bg-background border border-border px-2 py-1 rounded-full text-text-secondary">{record.user?.rollNumber || record.rollNumber}</span>
                            },
                            {
                              title: 'Branch',
                              key: 'branch',
                              width: 140,
                              render: (_, record) => <Tag className="rounded-full border-0 bg-background-tertiary text-text-secondary m-0 text-[10px] font-medium uppercase px-2 py-0.5">{record.user?.branchName || record.branch || 'N/A'}</Tag>,
                            },
                            {
                              title: 'Job Profile',
                              dataIndex: 'jobProfile',
                              key: 'jobProfile',
                              width: 160,
                              render: (text) => <Text className="text-xs text-text-secondary">{text || '-'}</Text>,
                            },
                            {
                              title: 'Status',
                              dataIndex: 'status',
                              key: 'status',
                              width: 120,
                              align: 'center',
                              render: (status) => (
                                <Tag
                                  color={status === 'JOINED' || status === 'COMPLETED' ? 'green' : 'blue'}
                                  className="m-0 rounded-full border-0 font-medium text-[10px] px-2 py-0.5"
                                >
                                  {status}
                                </Tag>
                              ),
                            },
                            {
                              title: 'Report',
                              dataIndex: 'hasJoiningLetter',
                              key: 'hasJoiningLetter',
                              width: 100,
                              align: 'center',
                              render: (val) => val ? (
                                <Tooltip title="Joining Report Uploaded">
                                  <CheckCircleOutlined className="text-success text-base" />
                                </Tooltip>
                              ) : (
                                <Tooltip title="Not Uploaded">
                                  <ClockCircleOutlined className="text-text-tertiary text-base" />
                                </Tooltip>
                              ),
                            }
                          ]}
                        />
                      </div>
                    </div>
                  )
                }))}
              />
              {(!selectedCompanyDetails.institutions || selectedCompanyDetails.institutions.length === 0) && (
                <Empty description="No institutions found" className="py-8 bg-surface rounded-xl border border-border" />
              )}
            </div>
          </div>
        ) : (
          <Empty description="No data available" />
        )}
      </Modal>
    </div>
  );
};

export default CompaniesOverview;