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
  Tag,
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
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const RecommendationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchRecommendations = useCallback(async (isRefresh = false, page = 1) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = { page, limit: pagination.limit };
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;

      const response = await trainingCoordinatorService.getRecommendations(params);
      const recs = response?.data || response?.recommendations || response;
      setRecommendations(Array.isArray(recs) ? recs : []);

      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          page: response.pagination.page,
          total: response.pagination.total,
        }));
      }
    } catch (err) {
      message.error('Failed to load recommendations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, pagination.limit]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

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
      await trainingCoordinatorService.reviewRecommendation(selected.id, values);
      message.success(`Recommendation ${values.status.toLowerCase()}`);
      setReviewOpen(false);
      fetchRecommendations(true);
    } catch (error) {
      message.error(error?.message || 'Failed to review recommendation');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleTableChange = (pag) => {
    setPagination(prev => ({ ...prev, page: pag.current, limit: pag.pageSize }));
    fetchRecommendations(false, pag.current);
  };

  const getStatusTag = (status) => {
    const statusMap = {
      PENDING: { color: 'orange', text: 'Pending' },
      APPROVED: { color: 'green', text: 'Approved' },
      REJECTED: { color: 'red', text: 'Rejected' },
      FORWARDED: { color: 'blue', text: 'Forwarded' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const filteredRecommendations = recommendations.filter((rec) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      rec.user?.name?.toLowerCase().includes(searchLower) ||
      rec.trainingTitle?.toLowerCase().includes(searchLower) ||
      rec.trainingProvider?.toLowerCase().includes(searchLower)
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
            {record.user?.branchName || record.user?.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Recommended Training',
      dataIndex: 'trainingTitle',
      key: 'trainingTitle',
      render: (title, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800 truncate" style={{ maxWidth: 180 }}>
            {title}
          </div>
          <Text type="secondary" className="text-xs">
            {record.trainingProvider}
          </Text>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      render: (category) => category && <Tag>{category}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (value) => (
        <Text className="text-xs">
          {value && new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
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
          {record.status === 'PENDING' && (
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
          <h2 className="text-lg font-semibold mb-0">Training Recommendations</h2>
          <Text type="secondary" className="text-xs">
            Review training recommendations submitted by faculty
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={() => fetchRecommendations(true)}
          loading={refreshing}
          size="middle"
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Input
            placeholder="Search faculty, training, or provider..."
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

        {filteredRecommendations.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredRecommendations.length}</Text> of{' '}
              <Text strong>{recommendations.length}</Text> recommendations
            </Text>
          </div>
        )}

        {filteredRecommendations.length === 0 && !loading ? (
          <div className="py-8">
            <TrainingEmptyState
              type="search"
              message="No recommendations found"
              description={searchText || statusFilter !== 'ALL'
                ? "Try adjusting your search or filter criteria."
                : "No faculty recommendations to review yet."}
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
              dataSource={filteredRecommendations}
              columns={columns}
              rowKey="id"
              loading={loading}
              onChange={handleTableChange}
              size="small"
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: pagination.total,
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
        title="Review Recommendation"
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
                { label: <span className="text-blue-600">Forward</span>, value: 'FORWARDED' },
                { label: <span className="text-red-600">Reject</span>, value: 'REJECTED' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments (Optional)">
            <TextArea rows={3} placeholder="Add any comments..." />
          </Form.Item>
        </Form>
        {selected && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
            <div className="mb-2">
              <Text className="text-xs text-slate-500">Training</Text>
              <div className="font-medium text-slate-800">{selected.trainingTitle}</div>
            </div>
            <div>
              <Text className="text-xs text-slate-500">Provider</Text>
              <div className="font-medium text-slate-800">{selected.trainingProvider || 'Not specified'}</div>
            </div>
          </div>
        )}
      </Modal>

      {/* Details Modal */}
      <Modal
        title="Recommendation Details"
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>,
          selected?.status === 'PENDING' && (
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
            <Descriptions.Item label="Department">
              {selected.user?.branchName || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Status">{getStatusTag(selected.status)}</Descriptions.Item>
            <Descriptions.Item label="Training Title">{selected.trainingTitle}</Descriptions.Item>
            <Descriptions.Item label="Provider">
              {selected.trainingProvider || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              {selected.category || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Estimated Duration">
              {selected.estimatedDuration || 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Estimated Cost">
              {selected.estimatedCost ? `₹${selected.estimatedCost}` : 'Not specified'}
            </Descriptions.Item>
            <Descriptions.Item label="Justification">
              <Paragraph className="!mb-0 text-sm whitespace-pre-wrap">{selected.justification || 'Not provided'}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="Expected Outcomes">
              <Paragraph className="!mb-0 text-sm whitespace-pre-wrap">{selected.expectedOutcomes || 'Not provided'}</Paragraph>
            </Descriptions.Item>
            {selected.reviewComments && (
              <Descriptions.Item label="Review Comments">
                <Paragraph className="!mb-0 text-sm">{selected.reviewComments}</Paragraph>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default RecommendationsPage;
