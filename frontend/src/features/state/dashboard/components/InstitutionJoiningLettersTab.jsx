import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Input,
  Select,
  Tag,
  Typography,
  Spin,
  Empty,
  Button,
  Space,
  Tooltip,
  Card,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import API from '../../../../services/api';

const { Text } = Typography;

const STATUS_CONFIG = {
  APPROVED: { color: 'success', icon: <CheckCircleOutlined />, label: 'Approved' },
  PENDING: { color: 'warning', icon: <ClockCircleOutlined />, label: 'Pending Review' },
  REJECTED: { color: 'error', icon: <CloseCircleOutlined />, label: 'Rejected' },
};

const InstitutionJoiningLettersTab = ({ institutionId, institutionName }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ joiningLetters: [], summary: null });
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch joining Reports
  const fetchJoiningLetters = useCallback(async () => {
    if (!institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await API.get(`/state/institutions/${institutionId}/joining-letters`);
      setData({
        joiningLetters: response.data?.joiningLetters || [],
        summary: response.data?.summary || null,
      });
    } catch (err) {
      console.error('Failed to fetch joining Reports:', err);
      setError(err.response?.data?.message || 'Failed to load joining reports');
      setData({ joiningLetters: [], summary: null });
    } finally {
      setLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchJoiningLetters();
  }, [fetchJoiningLetters]);

  // Filter joining Reports based on search and status
  const filteredLetters = useMemo(() => {
    let result = data.joiningLetters;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(
        (j) =>
          j.studentName?.toLowerCase().includes(search) ||
          j.rollNumber?.toLowerCase().includes(search) ||
          j.companyName?.toLowerCase().includes(search) ||
          j.branch?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((j) => j.status === statusFilter);
    }

    return result;
  }, [data.joiningLetters, searchTerm, statusFilter]);

  // Table columns
  const columns = [
    {
      title: 'Student',
      key: 'student',
      width: 200,
      render: (_, record) => (
        <div>
          <Text className="font-medium text-text-primary block">{record.studentName}</Text>
          <Text className="text-xs text-text-tertiary">
            {record.rollNumber} | {record.branch}
          </Text>
        </div>
      ),
    },
    {
      title: 'Company',
      key: 'company',
      width: 180,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <ShopOutlined className="text-text-tertiary" />
          <Text className="text-text-secondary truncate max-w-[150px]">
            {record.companyName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Internship Period',
      key: 'period',
      width: 160,
      render: (_, record) => (
        <Text className="text-text-secondary text-sm">
          {record.internshipPeriod?.startDate
            ? dayjs(record.internshipPeriod.startDate).format('DD MMM YYYY')
            : 'N/A'}
          {' - '}
          {record.internshipPeriod?.endDate
            ? dayjs(record.internshipPeriod.endDate).format('DD MMM YYYY')
            : 'Ongoing'}
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const config = STATUS_CONFIG[record.status] || STATUS_CONFIG.PENDING;
        return (
          <Tag icon={config.icon} color={config.color} className="m-0">
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 110,
      render: (date) => (
        <Text className="text-text-secondary text-sm">
          {date ? dayjs(date).format('DD MMM YYYY') : '-'}
        </Text>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 80,
      align: 'center',
      render: (_, record) =>
        record.downloadUrl ? (
          <Tooltip title="View / Download">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => window.open(record.downloadUrl, '_blank')}
            />
          </Tooltip>
        ) : (
          <Tooltip title="File not available">
            <Button type="text" size="small" disabled icon={<DownloadOutlined />} />
          </Tooltip>
        ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full gap-4">
        <SafetyCertificateOutlined className="text-4xl text-text-tertiary" />
        <Text className="text-error">{error}</Text>
        <Button type="primary" onClick={fetchJoiningLetters}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Summary Cards */}
      {data.summary && (
        <Row gutter={[12, 12]} className="mb-4">
          <Col span={6}>
            <Card size="small" className="shadow-sm">
              <Statistic
                title={<span className="text-xs">Total</span>}
                value={data.summary.total}
                prefix={<SafetyCertificateOutlined className="text-primary" />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" className="shadow-sm">
              <Statistic
                title={<span className="text-xs">Approved</span>}
                value={data.summary.approved}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" className="shadow-sm">
              <Statistic
                title={<span className="text-xs">Pending</span>}
                value={data.summary.pending}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" className="shadow-sm">
              <Statistic
                title={<span className="text-xs">Rejected</span>}
                value={data.summary.rejected}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, roll no, company..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
            allowClear
            size="small"
          />
          <Select value={statusFilter} onChange={setStatusFilter} className="w-36" size="small">
            <Select.Option value="all">All Status</Select.Option>
            <Select.Option value="APPROVED">
              <span className="flex items-center gap-1">
                <CheckCircleOutlined className="text-success" /> Approved
              </span>
            </Select.Option>
            <Select.Option value="PENDING">
              <span className="flex items-center gap-1">
                <ClockCircleOutlined className="text-warning" /> Pending
              </span>
            </Select.Option>
            <Select.Option value="REJECTED">
              <span className="flex items-center gap-1">
                <CloseCircleOutlined className="text-error" /> Rejected
              </span>
            </Select.Option>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Text className="text-text-tertiary text-sm">
            Showing {filteredLetters.length} of {data.joiningLetters.length}
          </Text>
          <Tooltip title="Refresh">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={fetchJoiningLetters}
              disabled={loading}
            />
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <Table
          columns={columns}
          dataSource={filteredLetters}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ y: 400 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  searchTerm || statusFilter !== 'all'
                    ? 'No joining reports match the filters'
                    : 'No joining reports uploaded yet'
                }
              />
            ),
          }}
        />
      </div>
    </div>
  );
};

export default InstitutionJoiningLettersTab;
