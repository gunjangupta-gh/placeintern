import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  Spin,
  Empty,
  Tooltip,
  Badge,
  Timeline,
  Typography,
  Statistic,
  Space,
} from 'antd';
import { toast } from 'react-hot-toast';
import { useDebouncedCallback } from '../../../../hooks/useDebounce';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  EyeOutlined,
  HistoryOutlined,
  UserOutlined,
  BankOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  fetchJoiningLetterStats,
  fetchJoiningLetters,
  fetchJoiningLetterActivity,
  verifyJoiningLetter,
  rejectJoiningLetter,
  selectJoiningLetterStats,
  selectJoiningLetterStatsLoading,
  selectJoiningLetters,
  selectJoiningLettersLoading,
  selectJoiningLettersPagination,
  selectJoiningLetterActivity,
  selectJoiningLetterActivityLoading,
} from '../../store/principalSlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';

const { Text, Title } = Typography;
const { TextArea } = Input;

const JoiningLetterPanel = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();

  const stats = useSelector(selectJoiningLetterStats);
  const statsLoading = useSelector(selectJoiningLetterStatsLoading);
  const letters = useSelector(selectJoiningLetters);
  const lettersLoading = useSelector(selectJoiningLettersLoading);
  const pagination = useSelector(selectJoiningLettersPagination);
  const activity = useSelector(selectJoiningLetterActivity);
  const activityLoading = useSelector(selectJoiningLetterActivityLoading);

  const [filters, setFilters] = useState({
    status: 'pending',
    search: '',
    page: 1,
    limit: 10,
  });
  const [searchInput, setSearchInput] = useState('');
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Consolidated refresh function - single function to refresh all data
  const refreshAllData = useCallback(() => {
    dispatch(fetchJoiningLetterStats());
    dispatch(fetchJoiningLetterActivity(10));
    dispatch(fetchJoiningLetters(filters));
  }, [dispatch, filters]);

  useEffect(() => {
    dispatch(fetchJoiningLetterStats());
    dispatch(fetchJoiningLetterActivity(10));
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchJoiningLetters(filters));
  }, [dispatch, filters]);

  // Debounced search handler - prevents API calls on every keystroke
  const debouncedSearch = useDebouncedCallback((value) => {
    setFilters((prev) => ({
      ...prev,
      search: value,
      page: 1,
    }));
  }, 300);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchInput(value);
    debouncedSearch(value);
  };

  const handleFilterChange = (key, value) => {
    if (key === 'search') {
      // Search is handled separately with debounce
      return;
    }
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  };

  // Open file using presigned URL for MinIO access
  const openLetterUrl = useCallback(async (url) => {
    if (!url) return;
    try {
      await openFileWithPresignedUrl(url);
    } catch {
      toast.error('Failed to open file');
    }
  }, []);

  const handleVerify = (record) => {
    setSelectedLetter(record);
    setVerifyModalVisible(true);
  };

  const handleReject = (record) => {
    setSelectedLetter(record);
    setRejectModalVisible(true);
  };

  const submitVerify = async (values) => {
    if (!selectedLetter) return;
    setActionLoading(true);
    try {
      await dispatch(
        verifyJoiningLetter({
          applicationId: selectedLetter.applicationId,
          data: {
            joiningDate: values.joiningDate?.toISOString(),
            remarks: values.remarks,
          },
        })
      ).unwrap();
      toast.success('Joining report verified successfully');
      setVerifyModalVisible(false);
      form.resetFields();
      // Refresh all data with consolidated function
      refreshAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to verify joining report');
    } finally {
      setActionLoading(false);
    }
  };

  const submitReject = async (values) => {
    if (!selectedLetter) return;
    if (!values.remarks?.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await dispatch(
        rejectJoiningLetter({
          applicationId: selectedLetter.applicationId,
          remarks: values.remarks,
        })
      ).unwrap();
      toast.success('Joining report rejected');
      setRejectModalVisible(false);
      form.resetFields();
      // Refresh all data with consolidated function
      refreshAllData();
    } catch (error) {
      toast.error(error.message || 'Failed to reject joining report');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const config = {
      VERIFIED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Verified' },
      PENDING: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending Review' },
      REJECTED: { color: 'error', icon: <CloseCircleOutlined />, text: 'Rejected' },
      NO_LETTER: { color: 'default', icon: <FileTextOutlined />, text: 'No Letter' },
    };
    const statusConfig = config[status] || config.NO_LETTER;
    return (
      <Tag color={statusConfig.color} icon={statusConfig.icon}>
        {statusConfig.text}
      </Tag>
    );
  };

  const columns = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <UserOutlined className="text-blue-500" />
          <div>
            <div className="font-medium">{text}</div>
            <div className="text-xs text-gray-500">{record.studentEmail}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
      render: (text) => (
        <Tooltip title={text}>
          <span className="truncate max-w-[150px] block">{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 120,
      render: (date) =>
        date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => {
        if (record.status !== 'PENDING') {
          return (
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openLetterUrl(record.letterUrl)}
              disabled={!record.letterUrl}
            >
              View
            </Button>
          );
        }
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openLetterUrl(record.letterUrl)}
              disabled={!record.letterUrl}
            >
              View
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleVerify(record)}
            >
              Verify
            </Button>
            <Button
              danger
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => handleReject(record)}
            >
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  if (statsLoading && !stats) {
    return (
      <Card className="h-full">
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card styles={{ body: { padding: '16px' } }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-xl text-blue-500" />
            <Title level={4} className="!mb-0">
              Joining Report Management
            </Title>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshAllData}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Summary Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
            <Statistic
              title={<span className="text-xs">Total Uploaded</span>}
              value={stats?.summary?.uploaded || 0}
              suffix={<span className="text-sm text-gray-500">/ {stats?.summary?.total || 0}</span>}
              styles={{ content: { fontSize: '24px', color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20">
            <Statistic
              title={<span className="text-xs">Pending Review</span>}
              value={stats?.summary?.pendingReview || 0}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { fontSize: '24px', color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
            <Statistic
              title={<span className="text-xs">Verified</span>}
              value={stats?.summary?.verified || 0}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { fontSize: '24px', color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="text-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
            <Statistic
              title={<span className="text-xs">Rejected</span>}
              value={stats?.summary?.rejected || 0}
              prefix={<CloseCircleOutlined />}
              styles={{ content: { fontSize: '24px', color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Row gutter={[16, 16]}>
        {/* Letters Table */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <FileTextOutlined className="text-blue-500" />
                <span>Joining Reports</span>
              </div>
            }
            extra={
              <Space>
                <Input
                  placeholder="Search student..."
                  prefix={<SearchOutlined />}
                  value={searchInput}
                  onChange={handleSearchChange}
                  style={{ width: 180 }}
                  allowClear
                  onClear={() => {
                    setSearchInput('');
                    debouncedSearch('');
                  }}
                />
                <Select
                  value={filters.status}
                  onChange={(val) => handleFilterChange('status', val)}
                  style={{ width: 140 }}
                  options={[
                    { label: 'All', value: 'all' },
                    { label: 'Pending', value: 'pending' },
                    { label: 'Verified', value: 'verified' },
                    { label: 'Rejected', value: 'rejected' },
                    { label: 'No Letter', value: 'noLetter' },
                  ]}
                />
              </Space>
            }
            styles={{ body: { padding: '0' } }}
          >
            <Table
              dataSource={letters}
              columns={columns}
              rowKey="applicationId"
              loading={lettersLoading}
              size="small"
              pagination={{
                current: pagination?.page || 1,
                pageSize: pagination?.limit || 10,
                total: pagination?.total || 0,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} records`,
                onChange: (page, pageSize) => {
                  handleFilterChange('page', page);
                  if (pageSize !== filters.limit) {
                    handleFilterChange('limit', pageSize);
                  }
                },
              }}
              locale={{ emptyText: <Empty description="No joining reports found" /> }}
            />
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <HistoryOutlined className="text-blue-500" />
                <span>Recent Activity</span>
              </div>
            }
            loading={activityLoading}
            styles={{ body: { maxHeight: '450px', overflowY: 'auto' } }}
          >
            {activity && activity.length > 0 ? (
              <Timeline
                items={activity.map((item) => ({
                  color: item.action === 'VERIFIED' ? 'green' : 'red',
                  children: (
                    <div className="text-sm">
                      <div className="font-medium">
                        {item.studentName}
                        <Tag
                          size="small"
                          color={item.action === 'VERIFIED' ? 'success' : 'error'}
                          className="ml-2"
                        >
                          {item.action}
                        </Tag>
                      </div>
                      <div className="text-gray-500 text-xs">{item.companyName}</div>
                      <div className="text-gray-400 text-xs">
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : '-'}
                      </div>
                      {item.remarks && (
                        <div className="text-gray-400 text-xs italic mt-1">
                          "{item.remarks}"
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="No recent activity" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>

      {/* Verify Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CheckCircleOutlined className="text-green-500" />
            <span>Verify Joining Report</span>
          </div>
        }
        open={verifyModalVisible}
        onCancel={() => {
          setVerifyModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={submitVerify}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <Text strong>Student: </Text>
            <Text>{selectedLetter?.studentName}</Text>
            <br />
            <Text strong>Company: </Text>
            <Text>{selectedLetter?.companyName}</Text>
          </div>
          <Form.Item name="joiningDate" label="Joining Date (Optional)">
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks (Optional)">
            <TextArea rows={3} placeholder="Add any remarks..." />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setVerifyModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={actionLoading}>
                Verify Letter
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CloseCircleOutlined className="text-red-500" />
            <span>Reject Joining Report</span>
          </div>
        }
        open={rejectModalVisible}
        onCancel={() => {
          setRejectModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={submitReject}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <Text strong>Student: </Text>
            <Text>{selectedLetter?.studentName}</Text>
            <br />
            <Text strong>Company: </Text>
            <Text>{selectedLetter?.companyName}</Text>
          </div>
          <Form.Item
            name="remarks"
            label="Reason for Rejection"
            rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
          >
            <TextArea rows={3} placeholder="Please explain why this letter is being rejected..." />
          </Form.Item>
          <Form.Item className="mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setRejectModalVisible(false)}>Cancel</Button>
              <Button danger type="primary" htmlType="submit" loading={actionLoading}>
                Reject Letter
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JoiningLetterPanel;
