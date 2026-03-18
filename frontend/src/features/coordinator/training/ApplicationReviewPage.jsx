import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Segmented,
  Typography,
  message,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SyncOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text } = Typography;
const { TextArea } = Input;

const normalizeStatus = (status) => String(status || '').trim().toUpperCase();
const isReviewableStatus = (status) => ['PENDING', 'SUBMITTED'].includes(normalizeStatus(status));

const ApplicationReviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchApplications = useCallback(async (isRefresh = false, page = 1, limit = 10) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = { page, limit };
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;

      const response = await trainingCoordinatorService.getApplications(params);
      const apps = response?.data || response?.applications || response;
      setApplications(Array.isArray(apps) ? apps : []);

      setPagination(prev => ({
        ...prev,
        page: response?.pagination?.page || page,
        limit: response?.pagination?.limit || limit,
        total: response?.pagination?.total || (Array.isArray(apps) ? apps.length : 0),
      }));
    } catch (err) {
      message.error('Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications(false, pagination.page, pagination.limit);
  }, [fetchApplications, pagination.page, pagination.limit]);

  const openReview = (record, defaultStatus = 'APPROVED') => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: defaultStatus, reviewComments: '' });
  };

  const openDetails = (record) => {
    setSelected(record);
    setDetailsOpen(true);
  };

  const handleReview = async () => {
    try {
      setReviewLoading(true);
      const values = await form.validateFields();
      await trainingCoordinatorService.reviewApplication(selected.id, values);
      message.success(`Application ${values.status.toLowerCase()}`);
      setReviewOpen(false);
      fetchApplications(true);
    } catch (error) {
      message.error(error?.message || 'Failed to review application');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleTableChange = (pag) => {
    setPagination(prev => ({ ...prev, page: pag.current, limit: pag.pageSize }));
  };

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [statusFilter]);

  const filteredApplications = applications.filter((app) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      app.user?.name?.toLowerCase().includes(searchLower) ||
      app.training?.title?.toLowerCase().includes(searchLower) ||
      app.user?.email?.toLowerCase().includes(searchLower)
    );
  });

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">
            {record.user?.name || 'Faculty'}
          </div>
          <Text type="secondary" className="text-xs">
            {record.user?.branchName || record.user?.designation || record.user?.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div>
          <Tooltip title={record.training?.title || 'Training'}>
            <div
              className="font-medium text-sm text-slate-800 truncate max-w-60"
              title={record.training?.title || 'Training'}
            >
              {record.training?.title || 'Training'}
            </div>
          </Tooltip>
          <Text type="secondary" className="text-xs">
            {record.training?.startDate &&
              new Date(record.training.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {record.training?.deliveryMode && ` • ${record.training.deliveryMode}`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <ApplicationStatusBadge status={status} />,
    },
    {
      title: 'Applied',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 100,
      render: (value, record) => (
        <Text className="text-xs">
          {(value || record.createdAt) && new Date(value || record.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetails(record)}
            />
          </Tooltip>
          {isReviewableStatus(record.status) && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="text"
                  size="small"
                  className="text-green-600 hover:text-green-700"
                  icon={<CheckOutlined />}
                  onClick={() => openReview(record, 'APPROVED')}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => openReview(record, 'REJECTED')}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold mb-0">Review Applications</h2>
          <Text type="secondary" className="text-xs">
            Review and approve faculty training applications
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={() => fetchApplications(true)}
          loading={refreshing}
          size="middle"
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Input
            placeholder="Search faculty or training..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:flex-1"
            size="middle"
            allowClear
          />
          <Segmented
            size="small"
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPagination(prev => ({ ...prev, page: 1 }));
            }}
            options={[
              { label: 'All', value: 'ALL' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Rejected', value: 'REJECTED' },
            ]}
          />
        </div>

        {filteredApplications.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredApplications.length}</Text> of{' '}
              <Text strong>{applications.length}</Text> applications
            </Text>
          </div>
        )}

        {filteredApplications.length === 0 && !loading ? (
          <div className="py-8">
            <TrainingEmptyState
              type="applications"
              message="No applications found"
              description={searchText || statusFilter !== 'ALL'
                ? "Try adjusting your search or filter criteria."
                : "No faculty applications to review yet."}
              actionText={searchText || statusFilter !== 'ALL' ? "Clear Filters" : null}
              onAction={searchText || statusFilter !== 'ALL' ? () => {
                setSearchText('');
                setStatusFilter('ALL');
              } : null}
            />
          </div>
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              dataSource={filteredApplications}
              columns={columns}
              rowKey="id"
              loading={loading}
              onChange={handleTableChange}
              size="small"
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: searchText ? filteredApplications.length : pagination.total,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-[10px] text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: 'small',
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        )}
      </Card>

      {/* Review Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <span>Review Application</span>
          </div>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        confirmLoading={reviewLoading}
        okText="Submit Review"
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="status"
            label="Decision"
            rules={[{ required: true, message: 'Please select a decision' }]}
          >
            <Segmented
              block
              options={[
                { label: <span className="text-green-600">Approve</span>, value: 'APPROVED' },
                { label: <span className="text-red-600">Reject</span>, value: 'REJECTED' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments (Optional)">
            <TextArea rows={3} placeholder="Add any comments for the faculty..." />
          </Form.Item>
        </Form>
        {selected && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
            <div className="mb-2">
              <Text className="text-xs text-slate-500">Faculty</Text>
              <div className="font-medium text-slate-800">{selected.user?.name}</div>
            </div>
            <div>
              <Text className="text-xs text-slate-500">Training</Text>
              <div className="font-medium text-slate-800">{selected.training?.title}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Details Modal */}
      <Modal
        title="Application Details"
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>,
          isReviewableStatus(selected?.status) && (
            <Button
              key="review"
              type="primary"
              onClick={() => {
                setDetailsOpen(false);
                openReview(selected, 'APPROVED');
              }}
            >
              Review
            </Button>
          ),
        ]}
        width={600}
      >
        {selected && (
          <Descriptions bordered column={1} size="small" className="mt-4">
            <Descriptions.Item label="Faculty">{selected.user?.name}</Descriptions.Item>
            <Descriptions.Item label="Email">{selected.user?.email}</Descriptions.Item>
            <Descriptions.Item label="Branch">{selected.user?.branchName || '-'}</Descriptions.Item>
            <Descriptions.Item label="Designation">{selected.user?.designation || '-'}</Descriptions.Item>
            <Descriptions.Item label="Status"><ApplicationStatusBadge status={selected.status} /></Descriptions.Item>
            <Descriptions.Item label="Training">{selected.training?.title}</Descriptions.Item>
            <Descriptions.Item label="Training Dates">
              {selected.training?.startDate && new Date(selected.training.startDate).toLocaleDateString('en-IN')}
              {' - '}
              {selected.training?.endDate && new Date(selected.training.endDate).toLocaleDateString('en-IN')}
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Mode">{selected.training?.deliveryMode}</Descriptions.Item>
            <Descriptions.Item label="Applied On">
              {(selected.appliedAt || selected.createdAt) &&
                new Date(selected.appliedAt || selected.createdAt).toLocaleDateString('en-IN')}
            </Descriptions.Item>
            <Descriptions.Item label="Relevance to Teaching">
              {selected.relevanceToTeaching || 'Not provided'}
            </Descriptions.Item>
            <Descriptions.Item label="Expected Application">
              {selected.expectedApplication || 'Not provided'}
            </Descriptions.Item>
            {selected.reviewComments && (
              <Descriptions.Item label="Review Comments">
                {selected.reviewComments}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ApplicationReviewPage;
