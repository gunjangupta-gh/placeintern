import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  DatePicker,
  Select,
  Space,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Spin,
  Empty,
  Divider,
  Alert,
  Badge,
  Descriptions,
  Tooltip,
  theme,
} from 'antd';
import {
  AuditOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';
import { auditService } from '../../../services/audit.service';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const AuditLogs = () => {
  const { token } = theme.useToken();
  
  const [logs, setLogs] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    dateRange: null,
    action: undefined,
    entityType: undefined,
    category: undefined,
    page: 1,
    limit: 50,
  });

  // Pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 50,
    total: 0,
  });

  // Severity colors
  const severityColors = {
    LOW: 'success',
    MEDIUM: 'warning',
    HIGH: 'orange',
    CRITICAL: 'error',
  };

  // Severity icons
  const severityIcons = {
    LOW: <CheckCircleOutlined />,
    MEDIUM: <InfoCircleOutlined />,
    HIGH: <WarningOutlined />,
    CRITICAL: <ExclamationCircleOutlined />,
  };

  // Category colors
  const categoryColors = {
    AUTHENTICATION: 'blue',
    PROFILE_MANAGEMENT: 'cyan',
    TRAINING: 'geekblue',
    INTERNSHIP_WORKFLOW: 'purple',
    APPLICATION_PROCESS: 'geekblue',
    FEEDBACK_SYSTEM: 'magenta',
    ADMINISTRATIVE: 'orange',
    SECURITY: 'red',
    COMPLIANCE: 'gold',
    SYSTEM: 'volcano',
    DATA_MANAGEMENT: 'lime',
    SUPPORT: 'green',
    USER_MANAGEMENT: 'blue',
    SYSTEM_ADMIN: 'red',
  };

  // Action types for dropdown (from backend AuditAction enum)
  const actionTypes = [
    // User Management
    'USER_LOGIN',
    'USER_LOGOUT',
    'USER_REGISTRATION',
    'USER_PROFILE_UPDATE',
    'PASSWORD_CHANGE',
    'PASSWORD_RESET',
    'USER_ACTIVATION',
    'USER_DEACTIVATION',
    'USER_DELETION',
    
    // Student Operations
    'STUDENT_PROFILE_VIEW',
    'STUDENT_PROFILE_UPDATE',
    'STUDENT_DOCUMENT_UPLOAD',
    'STUDENT_DOCUMENT_DELETE',
    'STUDENT_DOCUMENT_RESTORE',
    
    // Internship Operations
    'INTERNSHIP_CREATE',
    'INTERNSHIP_UPDATE',
    'INTERNSHIP_DELETE',
    'INTERNSHIP_ACTIVATE',
    'INTERNSHIP_DEACTIVATE',
    'INTERNSHIP_VIEW',
    'INTERNSHIP_SEARCH',
    
    // Application Operations
    'APPLICATION_SUBMIT',
    'APPLICATION_UPDATE',
    'APPLICATION_WITHDRAW',
    'APPLICATION_VIEW',
    'APPLICATION_APPROVE',
    'APPLICATION_REJECT',
    'APPLICATION_BULK_ACTION',
    
    // Industry Operations
    'INDUSTRY_REGISTER',
    'INDUSTRY_PROFILE_UPDATE',
    'INDUSTRY_APPROVAL',
    'INDUSTRY_REJECTION',
    'INDUSTRY_VIEW_APPLICANTS',
    
    // Mentor Assignment
    'MENTOR_ASSIGN',
    'MENTOR_UNASSIGN',
    'MENTOR_UPDATE',
    
    // Feedback Operations
    'MONTHLY_FEEDBACK_SUBMIT',
    'MONTHLY_FEEDBACK_UPDATE',
    'COMPLETION_FEEDBACK_SUBMIT',
    'FEEDBACK_VIEW',
    
    // Faculty Operations
    'VISIT_LOG_CREATE',
    'VISIT_LOG_UPDATE',
    'VISIT_LOG_DELETE',
    'VISIT_LOG_RESTORE',
    'VISIT_LOG_VIEW',
    'FACULTY_ASSIGNMENT',
    
    // Monthly Report Operations
    'MONTHLY_REPORT_SUBMIT',
    'MONTHLY_REPORT_UPDATE',
    'MONTHLY_REPORT_APPROVE',
    'MONTHLY_REPORT_REJECT',
    'MONTHLY_REPORT_DELETE',
    'MONTHLY_REPORT_RESTORE',
    
    // Joining Report Operations
    'JOINING_LETTER_UPLOAD',
    'JOINING_LETTER_VERIFY',
    'JOINING_LETTER_REJECT',
    'JOINING_LETTER_DELETE',
    
    // Administrative Operations
    'REPORT_GENERATE',
    'REPORT_DOWNLOAD',
    'REPORT_VIEW',
    'BULK_OPERATION',
    'DATA_EXPORT',
    'DATA_IMPORT',
    
    // Institution Operations
    'INSTITUTION_CREATE',
    'INSTITUTION_UPDATE',
    'INSTITUTION_DELETE',
    
    // System Operations
    'SYSTEM_BACKUP',
    'SYSTEM_RESTORE',
    'CONFIGURATION_CHANGE',
    'PERMISSION_CHANGE',
    
    // Security Events
    'UNAUTHORIZED_ACCESS',
    'FAILED_LOGIN',
    'SUSPICIOUS_ACTIVITY',
    'DATA_BREACH_ATTEMPT',
    
    // Support Operations
    'GRIEVANCE_SUBMIT',
    'GRIEVANCE_UPDATE',
    'GRIEVANCE_RESOLVE',
    'TECHNICAL_QUERY_SUBMIT',
    'TECHNICAL_QUERY_RESOLVE',
    
    // Compliance Operations
    'COMPLIANCE_CHECK',
    'AUDIT_TRAIL_ACCESS',
    'PRIVACY_POLICY_UPDATE',
    'CONSENT_GIVEN',
    'CONSENT_WITHDRAWN',
  ];

  // Entity types for dropdown (common entity types in system)
  const entityTypes = [
    'User',
    'Student',
    'Staff',
    'Faculty',
    'Principal',
    'Institution',
    'Internship',
    'Application',
    'SelfIdentifiedInternship',
    'Feedback',
    'MonthlyFeedback',
    'CompletionFeedback',
    'VisitLog',
    'MonthlyReport',
    'JoiningLetter',
    'Document',
    'Report',
    'Batch',
    'Department',
    'Branch',
    'MentorAssignment',
    'Grievance',
    'TechnicalQuery',
    'PreTestForm',
    'PostTestForm',
    'PreTestResponse',
    'PostTestResponse',
    'System',
  ];

  // Categories for dropdown (from backend AuditCategory enum)
  const categories = [
    'AUTHENTICATION',
    'PROFILE_MANAGEMENT',
    'TRAINING',
    'INTERNSHIP_WORKFLOW',
    'APPLICATION_PROCESS',
    'FEEDBACK_SYSTEM',
    'ADMINISTRATIVE',
    'SECURITY',
    'COMPLIANCE',
    'SYSTEM',
    'DATA_MANAGEMENT',
    'SUPPORT',
    'USER_MANAGEMENT',
    'SYSTEM_ADMIN',
  ];

  // Fetch audit logs
  const fetchLogs = async (newFilters = filters) => {
    setLoading(true);
    try {
      const params = {
        page: newFilters.page,
        limit: newFilters.limit,
      };

      // Add date range if selected
      if (newFilters.dateRange && newFilters.dateRange.length === 2) {
        params.startDate = newFilters.dateRange[0].startOf('day').toISOString();
        params.endDate = newFilters.dateRange[1].endOf('day').toISOString();
      }

      // Add other filters
      if (newFilters.action) params.action = newFilters.action;
      if (newFilters.entityType) params.entityType = newFilters.entityType;
      if (newFilters.category) params.category = newFilters.category;

      const response = await auditService.getLogs(params);
      setLogs(response.logs || []);
      setPagination({
        current: response.page,
        pageSize: newFilters.limit,
        total: response.total,
      });
      toast.success('Audit logs loaded successfully');
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    setStatsLoading(true);
    try {
      const params = {};

      // Add date range if selected
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.startDate = filters.dateRange[0].startOf('day').toISOString();
        params.endDate = filters.dateRange[1].endOf('day').toISOString();
      }

      const response = await auditService.getStatistics(params);
      setStatistics(response);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, []);

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value, page: 1 };
    setFilters(newFilters);
  };

  // Handle apply filters
  const handleApplyFilters = () => {
    fetchLogs(filters);
    fetchStatistics();
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchLogs();
    fetchStatistics();
  };

  // Handle table change (pagination)
  const handleTableChange = (newPagination) => {
    const newFilters = {
      ...filters,
      page: newPagination.current,
      limit: newPagination.pageSize,
    };
    setFilters(newFilters);
    fetchLogs(newFilters);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      // Prepare CSV headers
      const headers = [
        'Timestamp',
        'User',
        'Action',
        'Entity Type',
        'Entity ID',
        'Category',
        'Severity',
        'Description',
      ];

      // Prepare CSV rows
      const rows = logs.map((log) => [
        dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        log.userName || log.user?.name || 'System',
        log.action,
        log.entityType,
        log.entityId || 'N/A',
        log.category,
        log.severity,
        log.description || 'N/A',
      ]);

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        ),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `audit_logs_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Audit logs exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export audit logs');
    }
  };

  // Prepare pie chart data for actions
  const actionChartData = useMemo(() => {
    if (!statistics?.actionBreakdown) return [];
    return statistics.actionBreakdown.slice(0, 8).map((item) => ({
      name: item.action.replace(/_/g, ' '),
      value: item.count,
    }));
  }, [statistics]);

  // Prepare pie chart data for categories
  const categoryChartData = useMemo(() => {
    if (!statistics?.categoryBreakdown) return [];
    return statistics.categoryBreakdown.map((item) => ({
      name: item.category.replace(/_/g, ' '),
      value: item.count,
    }));
  }, [statistics]);

  // Chart colors
  const COLORS = [
    token.colorPrimary,
    token.colorSuccess,
    token.colorWarning,
    token.colorError,
    token.colorInfo,
    token.colorLink,
    token.colorPrimaryActive,
    token.colorErrorBg
  ];

  // Table columns
  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => (
        <div>
          <div>{dayjs(timestamp).format('MMM DD, YYYY')}</div>
          <Text type="secondary" className="text-xs">
            <ClockCircleOutlined /> {dayjs(timestamp).format('HH:mm:ss')}
          </Text>
          <div>
            <Text type="secondary" className="text-2xs">
              ({dayjs(timestamp).fromNow()})
            </Text>
          </div>
        </div>
      ),
      sorter: (a, b) => dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <div>
          <div>
            <UserOutlined /> {record.userName || record.user?.name || 'System'}
          </div>
          {record.user?.email && (
            <Text type="secondary" className="text-xs">
              {record.user.email}
            </Text>
          )}
          {record.userRole && (
            <div>
              <Tag color="blue" className="text-xs mt-1 px-2 py-0.5 rounded-full font-medium">
                {record.userRole.replace(/_/g, ' ')}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 200,
      render: (action) => (
        <Tag color="processing" className="text-xs px-2 py-0.5 rounded-full font-medium">
          {action.replace(/_/g, ' ')}
        </Tag>
      ),
      filters: actionTypes.map((action) => ({ text: action.replace(/_/g, ' '), value: action })),
      onFilter: (value, record) => record.action === value,
    },
    {
      title: 'Entity Type',
      dataIndex: 'entityType',
      key: 'entityType',
      width: 150,
      render: (entityType) => (
        <Text className="text-sm text-text-secondary">
          <FileTextOutlined /> {entityType}
        </Text>
      ),
      filters: entityTypes.map((type) => ({ text: type, value: type })),
      onFilter: (value, record) => record.entityType === value,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      render: (category) => (
        <Tag color={categoryColors[category]} className="text-xs px-2 py-0.5 rounded-full font-medium">
          {category.replace(/_/g, ' ')}
        </Tag>
      ),
      filters: categories.map((cat) => ({ text: cat.replace(/_/g, ' '), value: cat })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      align: 'center',
      render: (severity) => (
        <Badge
          status={severityColors[severity] === 'success' ? 'success' : severityColors[severity] === 'error' ? 'error' : 'warning'}
          text={
            <Tag color={severityColors[severity]} icon={React.cloneElement(severityIcons[severity], { className: "text-lg" })} className="text-xs px-2 py-0.5 rounded-full font-medium">
              {severity}
            </Tag>
          }
        />
      ),
      sorter: (a, b) => {
        const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      },
    },
  ];

  // Expanded row render
  const expandedRowRender = (record) => {
    return (
      <div className="p-4">
        <Descriptions
          bordered
          size="small"
          column={{ xs: 1, sm: 2, md: 3 }}
          className="rounded-xl border-border bg-surface shadow-sm"
        >
          <Descriptions.Item label="Entity ID" span={1}>
            <Text copyable className="font-mono text-sm">{record.entityId || 'N/A'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="IP Address" span={1}>
            <Text copyable className="font-mono text-sm">{record.ipAddress || 'N/A'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Description" span={
            record.changedFields && record.changedFields.length > 0 ? 3 : 1
          }>
            <Text className="text-sm">{record.description || 'No description available'}</Text>
          </Descriptions.Item>

          {record.changedFields && record.changedFields.length > 0 && (
            <Descriptions.Item label="Changed Fields" span={3}>
              <div className="flex flex-wrap gap-2">
                {record.changedFields.map((field, idx) => (
                  <Tag key={idx} color="blue" className="rounded-full px-2 py-0.5 font-medium text-xs">
                    {field}
                  </Tag>
                ))}
              </div>
            </Descriptions.Item>
          )}

          {record.oldValues && (
            <Descriptions.Item label="Old Values" span={3}>
              <pre className="rounded-lg bg-background-tertiary/50 border border-border/50 p-3 text-sm overflow-auto max-h-40">
                {JSON.stringify(record.oldValues, null, 2)}
              </pre>
            </Descriptions.Item>
          )}

          {record.newValues && (
            <Descriptions.Item label="New Values" span={3}>
              <pre className="rounded-lg bg-background-tertiary/50 border border-border/50 p-3 text-sm overflow-auto max-h-40">
                {JSON.stringify(record.newValues, null, 2)}
              </pre>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    );
  };

  return (
    <div className="">
      <Card
        title="Audit Logs"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              disabled={logs.length === 0}
            >
              Export CSV
            </Button>
          </Space>
        }
        variant="borderless"
      >
        {/* Statistics Cards */}
        <Spin spinning={statsLoading}>
          <Row gutter={[16, 16]} className="mb-4">
            <Col xs={12} sm={6}>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{statistics?.totalLogs || 0}</div>
                <div className="text-xs text-gray-500">Total Logs</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-green-600">{statistics?.actionBreakdown?.length || 0}</div>
                <div className="text-xs text-gray-500">Unique Actions</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-purple-600">{statistics?.entityTypeBreakdown?.length || 0}</div>
                <div className="text-xs text-gray-500">Entity Types</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-amber-600">{statistics?.userActivityBreakdown?.length || 0}</div>
                <div className="text-xs text-gray-500">Active Users</div>
              </div>
            </Col>
          </Row>
        </Spin>

        {/* Filters */}
        <div className="mb-4 p-4 bg-gray-50 rounded">
          <Row gutter={[16, 16]} align="bottom">
            <Col xs={24} sm={12} md={6}>
              <RangePicker
                style={{ width: '100%' }}
                value={filters.dateRange}
                onChange={(dates) => handleFilterChange('dateRange', dates)}
                format="YYYY-MM-DD"
                placeholder={['Start Date', 'End Date']}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Action"
                allowClear
                showSearch
                optionFilterProp="label"
                value={filters.action}
                onChange={(value) => handleFilterChange('action', value)}
                options={actionTypes.map(action => ({
                  label: action.replace(/_/g, ' '),
                  value: action
                }))}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Entity Type"
                allowClear
                showSearch
                optionFilterProp="children"
                value={filters.entityType}
                onChange={(value) => handleFilterChange('entityType', value)}
              >
                {[...entityTypes].sort().map((type) => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                style={{ width: '100%' }}
                placeholder="Category"
                allowClear
                showSearch
                optionFilterProp="children"
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
              >
                {[...categories].sort().map((cat) => (
                  <Option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Button
                type="primary"
                icon={<FilterOutlined />}
                onClick={handleApplyFilters}
                block
              >
                Apply Filters
              </Button>
            </Col>
          </Row>
        </div>

        {/* Alert for active filters */}
        {(filters.dateRange || filters.action || filters.entityType || filters.category) && (
          <Alert
            message="Active Filters"
            description={
              <Space wrap>
                {filters.dateRange && (
                  <Tag closable onClose={() => handleFilterChange('dateRange', null)}>
                    Date: {filters.dateRange[0].format('YYYY-MM-DD')} to {filters.dateRange[1].format('YYYY-MM-DD')}
                  </Tag>
                )}
                {filters.action && (
                  <Tag closable onClose={() => handleFilterChange('action', undefined)}>
                    Action: {filters.action.replace(/_/g, ' ')}
                  </Tag>
                )}
                {filters.entityType && (
                  <Tag closable onClose={() => handleFilterChange('entityType', undefined)}>
                    Entity: {filters.entityType}
                  </Tag>
                )}
                {filters.category && (
                  <Tag closable onClose={() => handleFilterChange('category', undefined)}>
                    Category: {filters.category.replace(/_/g, ' ')}
                  </Tag>
                )}
              </Space>
            }
            type="info"
            showIcon
            className="mb-4"
          />
        )}

        {/* Table */}
        <div className="custom-table">
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            scroll={{ x: 'max-content' }}
            size="small"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '25', '50', '100'],
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} logs`,
            }}
            onChange={handleTableChange}
            expandable={{
              expandedRowRender: (record) => {
                return (
                  <div className="p-4">
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, sm: 2, md: 3 }}
                    >
                      <Descriptions.Item label="Entity ID" span={1}>
                        <Text copyable className="font-mono text-sm">{record.entityId || 'N/A'}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="IP Address" span={1}>
                        <Text copyable className="font-mono text-sm">{record.ipAddress || 'N/A'}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="Description" span={
                        record.changedFields && record.changedFields.length > 0 ? 3 : 1
                      }>
                        <Text className="text-sm">{record.description || 'No description available'}</Text>
                      </Descriptions.Item>

                      {record.changedFields && record.changedFields.length > 0 && (
                        <Descriptions.Item label="Changed Fields" span={3}>
                          <div className="flex flex-wrap gap-2">
                            {record.changedFields.map((field, idx) => (
                              <Tag key={idx} color="blue">
                                {field}
                              </Tag>
                            ))}
                          </div>
                        </Descriptions.Item>
                      )}

                      {record.oldValues && (
                        <Descriptions.Item label="Old Values" span={3}>
                          <pre className="bg-gray-50 p-3 text-sm overflow-auto max-h-40 rounded">
                            {JSON.stringify(record.oldValues, null, 2)}
                          </pre>
                        </Descriptions.Item>
                      )}

                      {record.newValues && (
                        <Descriptions.Item label="New Values" span={3}>
                          <pre className="bg-gray-50 p-3 text-sm overflow-auto max-h-40 rounded">
                            {JSON.stringify(record.newValues, null, 2)}
                          </pre>
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </div>
                );
              },
              expandedRowKeys,
              onExpandedRowsChange: setExpandedRowKeys,
              expandIcon: ({ expanded, onExpand, record }) => (
                <Tooltip title={expanded ? 'Collapse' : 'Expand details'}>
                  <Button
                    type="text"
                    size="small"
                    icon={<InfoCircleOutlined />}
                    onClick={(e) => onExpand(record, e)}
                  />
                </Tooltip>
              ),
            }}
          />
        </div>
      </Card>
    </div>
  );
};

export default AuditLogs;