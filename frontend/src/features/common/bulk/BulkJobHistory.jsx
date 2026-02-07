import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  DatePicker,
  Progress,
  Modal,
  Descriptions,
  Tooltip,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  ReloadOutlined,
  EyeOutlined,
  StopOutlined,
  RedoOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { bulkService } from '../../../services/bulk.service';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

const JOB_TYPE_LABELS = {
  STUDENTS: 'Students',
  USERS: 'Staff/Users',
  INSTITUTIONS: 'Institutions',
  SELF_INTERNSHIPS: 'Self-Identified Internships',
};

const JOB_TYPE_COLORS = {
  STUDENTS: 'blue',
  USERS: 'purple',
  INSTITUTIONS: 'cyan',
  SELF_INTERNSHIPS: 'orange',
};

const STATUS_CONFIG = {
  QUEUED: { color: 'default', icon: <ClockCircleOutlined />, label: 'Queued' },
  PROCESSING: { color: 'processing', icon: <SyncOutlined spin />, label: 'Processing' },
  COMPLETED: { color: 'success', icon: <CheckCircleOutlined />, label: 'Completed' },
  FAILED: { color: 'error', icon: <CloseCircleOutlined />, label: 'Failed' },
  CANCELLED: { color: 'warning', icon: <ExclamationCircleOutlined />, label: 'Cancelled' },
};

const BulkJobHistory = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ type: null, status: null, dateRange: null });
  const [stats, setStats] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.dateRange && {
          fromDate: filters.dateRange[0].toISOString(),
          toDate: filters.dateRange[1].toISOString(),
        }),
      };

      const response = await bulkService.getJobs(params);
      setJobs(response.jobs || []);
      setPagination((prev) => ({ ...prev, total: response.total }));
    } catch (error) {
      toast.error('Failed to fetch job history');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await bulkService.getJobStats();
      setStats(response);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStats();
  }, [fetchJobs, fetchStats]);

  // Auto-refresh for active jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some(
      (job) => job.status === 'QUEUED' || job.status === 'PROCESSING'
    );

    if (hasActiveJobs && !refreshInterval) {
      const interval = setInterval(() => {
        fetchJobs();
      }, 5000);
      setRefreshInterval(interval);
    } else if (!hasActiveJobs && refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [jobs, refreshInterval, fetchJobs]);

  const handleTableChange = (newPagination) => {
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  const handleViewDetails = async (job) => {
    try {
      const fullJob = await bulkService.getJobById(job.id);
      setSelectedJob(fullJob);
      setDetailModalVisible(true);
    } catch (error) {
      toast.error('Failed to fetch job details');
    }
  };

  const handleCancelJob = async (jobId) => {
    if (!jobId || jobId.startsWith('pending-')) {
      toast.error('Cannot cancel this job - job ID not available');
      return;
    }
    try {
      await bulkService.cancelJob(jobId);
      toast.success('Job cancelled successfully');
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel job');
    }
  };

  const handleRetryJob = async (jobId) => {
    if (!jobId || jobId.startsWith('pending-')) {
      toast.error('Cannot retry this job - job ID not available');
      return;
    }
    try {
      await bulkService.retryJob(jobId);
      toast.success('Job queued for retry');
      fetchJobs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to retry job');
    }
  };

  const downloadReport = (job, type) => {
    const data = type === 'success' ? job.successReport : job.errorReport;
    if (!data || data.length === 0) {
      toast(`ℹ️ No ${type} records to download`, { icon: 'ℹ️' });
      return;
    }

    const csvContent = [
      Object.keys(data[0]).join(','),
      ...data.map((row) =>
        Object.values(row)
          .map((val) => `"${String(val || '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.type.toLowerCase()}-${type}-report-${job.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={JOB_TYPE_COLORS[type]}>{JOB_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: 'File',
      dataIndex: 'fileName',
      key: 'fileName',
      ellipsis: true,
      render: (fileName) => (
        <Tooltip title={fileName}>
          <span>{fileName}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = STATUS_CONFIG[status] || { color: 'default', label: status };
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_, record) => (
        <div style={{ width: 120 }}>
          <Progress
            percent={record.progress}
            size="small"
            status={
              record.status === 'FAILED'
                ? 'exception'
                : record.status === 'COMPLETED'
                  ? 'success'
                  : 'active'
            }
          />
          <div className="text-xs text-gray-500">
            {record.successCount}/{record.totalRows} records
          </div>
        </div>
      ),
    },
    {
      title: 'Results',
      key: 'results',
      render: (_, record) => (
        <Space size="small">
          <Badge
            count={record.successCount}
            showZero
            style={{ backgroundColor: '#52c41a' }}
            overflowCount={9999}
          />
          <Badge
            count={record.failedCount}
            showZero
            style={{ backgroundColor: '#ff4d4f' }}
            overflowCount={9999}
          />
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          {dayjs(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'processingTime',
      key: 'processingTime',
      render: (time) => (time ? `${(time / 1000).toFixed(1)}s` : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const hasValidJobId = record.jobId && !record.jobId.startsWith('pending-');
        return (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                type="text"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record)}
              />
            </Tooltip>
            {record.status === 'QUEUED' && (
              <Tooltip title={hasValidJobId ? 'Cancel' : 'Cannot cancel - job not queued yet'}>
                <Button
                  type="text"
                  danger
                  icon={<StopOutlined />}
                  onClick={() => handleCancelJob(record.jobId)}
                  disabled={!hasValidJobId}
                />
              </Tooltip>
            )}
            {record.status === 'FAILED' && (
              <Tooltip title={hasValidJobId ? 'Retry' : 'Cannot retry - no job ID'}>
                <Button
                  type="text"
                  icon={<RedoOutlined />}
                  onClick={() => handleRetryJob(record.jobId)}
                  disabled={!hasValidJobId}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-6">
      {/* Stats Cards */}
      {stats && (
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card size="small">
              <Statistic title="Total Jobs" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Completed"
                value={stats.byStatus?.COMPLETED || 0}
                styles={{ content: { color: '#3f8600' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Processing"
                value={(stats.byStatus?.QUEUED || 0) + (stats.byStatus?.PROCESSING || 0)}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic
                title="Failed"
                value={stats.byStatus?.FAILED || 0}
                styles={{ content: { color: '#cf1322' } }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card
        title="Bulk Operation History"
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchJobs} loading={loading}>
            Refresh
          </Button>
        }
      >
        {/* Filters */}
        <Space className="mb-4" wrap>
          <Select
            placeholder="Filter by Type"
            allowClear
            style={{ width: 200 }}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={Object.entries(JOB_TYPE_LABELS).map(([key, label]) => ({
              value: key,
              label,
            }))}
          />
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={Object.entries(STATUS_CONFIG).map(([key, config]) => ({
              value: key,
              label: config.label,
            }))}
          />
          <RangePicker
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
            placeholder={['From Date', 'To Date']}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={jobs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} jobs`,
          }}
          onChange={handleTableChange}
        />
      </Card>

      {/* Job Detail Modal */}
      <Modal
        title="Job Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>,
          selectedJob?.successReport?.length > 0 && (
            <Button
              key="success"
              icon={<DownloadOutlined />}
              onClick={() => downloadReport(selectedJob, 'success')}
            >
              Download Success Report
            </Button>
          ),
          selectedJob?.errorReport?.length > 0 && (
            <Button
              key="error"
              danger
              icon={<DownloadOutlined />}
              onClick={() => downloadReport(selectedJob, 'error')}
            >
              Download Error Report
            </Button>
          ),
        ]}
      >
        {selectedJob && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Type">
                <Tag color={JOB_TYPE_COLORS[selectedJob.type]}>
                  {JOB_TYPE_LABELS[selectedJob.type]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_CONFIG[selectedJob.status]?.color}>
                  {STATUS_CONFIG[selectedJob.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="File Name">{selectedJob.fileName}</Descriptions.Item>
              <Descriptions.Item label="File Size">
                {(selectedJob.fileSize / 1024).toFixed(1)} KB
              </Descriptions.Item>
              <Descriptions.Item label="Total Rows">{selectedJob.totalRows}</Descriptions.Item>
              <Descriptions.Item label="Processed">
                {selectedJob.processedRows}
              </Descriptions.Item>
              <Descriptions.Item label="Success Count">
                <span className="text-green-600 font-semibold">
                  {selectedJob.successCount}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Failed Count">
                <span className="text-red-600 font-semibold">{selectedJob.failedCount}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Queued At">
                {dayjs(selectedJob.queuedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Started At">
                {selectedJob.startedAt
                  ? dayjs(selectedJob.startedAt).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Completed At">
                {selectedJob.completedAt
                  ? dayjs(selectedJob.completedAt).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Processing Time">
                {selectedJob.processingTime
                  ? `${(selectedJob.processingTime / 1000).toFixed(2)} seconds`
                  : '-'}
              </Descriptions.Item>
              {selectedJob.errorMessage && (
                <Descriptions.Item label="Error Message" span={2}>
                  <span className="text-red-600">{selectedJob.errorMessage}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            <div className="mt-4">
              <Progress
                percent={selectedJob.progress}
                status={
                  selectedJob.status === 'FAILED'
                    ? 'exception'
                    : selectedJob.status === 'COMPLETED'
                      ? 'success'
                      : 'active'
                }
              />
            </div>

            {/* Show sample of errors if available */}
            {selectedJob.errorReport && selectedJob.errorReport.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold text-red-600 mb-2">
                  Sample Errors (first 5):
                </h4>
                <Table
                  dataSource={selectedJob.errorReport.slice(0, 5)}
                  columns={[
                    { title: 'Row', dataIndex: 'row', key: 'row', width: 60 },
                    { title: 'Error', dataIndex: 'error', key: 'error' },
                    { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true },
                  ]}
                  rowKey="row"
                  pagination={false}
                  size="small"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BulkJobHistory;
