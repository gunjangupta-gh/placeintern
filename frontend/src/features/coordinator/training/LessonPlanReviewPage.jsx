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
  Tag,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  SyncOutlined,
  SearchOutlined,
  EditOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import LessonPlanStatusBadge from '../../../components/training/LessonPlanStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const LessonPlanReviewPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchLessonPlans = useCallback(async (isRefresh = false, page = 1, limit = pagination.limit) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = { page, limit };
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;

      const response = await trainingCoordinatorService.getLessonPlans(params);
      const plans = response?.data || response?.lessonPlans || response;
      setLessonPlans(Array.isArray(plans) ? plans : []);

      if (response?.pagination) {
        setPagination(prev => ({
          ...prev,
          page: response.pagination.page,
          limit: response.pagination.limit || limit,
          total: response.pagination.total,
        }));
      }
    } catch (err) {
      message.error('Failed to load lesson plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, pagination.limit]);

  useEffect(() => {
    fetchLessonPlans();
  }, [fetchLessonPlans]);

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
      await trainingCoordinatorService.reviewLessonPlan(selected.id, values);
      message.success(`Lesson plan ${values.status.toLowerCase().replace('_', ' ')}`);
      setReviewOpen(false);
      fetchLessonPlans(true);
    } catch (error) {
      message.error(error?.message || 'Failed to review lesson plan');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleTableChange = (pag) => {
    setPagination(prev => ({ ...prev, page: pag.current, limit: pag.pageSize }));
    fetchLessonPlans(false, pag.current, pag.pageSize);
  };

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [statusFilter]);

  const filteredLessonPlans = lessonPlans.filter((lp) => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      lp.user?.name?.toLowerCase().includes(searchLower) ||
      lp.training?.title?.toLowerCase().includes(searchLower) ||
      lp.title?.toLowerCase().includes(searchLower)
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
      title: 'Lesson Plan',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800 truncate" style={{ maxWidth: 200 }}>
            {title || 'Untitled'}
          </div>
          <Text type="secondary" className="text-xs truncate" style={{ maxWidth: 200, display: 'block' }}>
            {record.training?.title || 'Training'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Course/Sem',
      dataIndex: 'courseOrSemester',
      key: 'courseOrSemester',
      width: 100,
      render: (value) => (
        <Tag className="text-xs">{value || '-'}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => <LessonPlanStatusBadge status={status} />,
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
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
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 100,
      render: (value, record) => {
        if (!value) return <Text className="text-xs">-</Text>;
        const dueDate = new Date(value);
        const isOverdue = dueDate < new Date() && record.status !== 'APPROVED';
        return (
          <Text className={`text-xs ${isOverdue ? 'text-red-500' : ''}`}>
            {dueDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
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
          {record.status === 'SUBMITTED' && (
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
              <Tooltip title="Request Changes">
                <Button
                  type="text"
                  size="small"
                  className="text-purple-600 hover:text-purple-700"
                  icon={<EditOutlined />}
                  onClick={() => openReview(record, 'CHANGES_REQUESTED')}
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
          <h2 className="text-lg font-semibold mb-0">Review Lesson Plans</h2>
          <Text type="secondary" className="text-xs">
            Review faculty lesson plans and provide feedback
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={() => fetchLessonPlans(true)}
          loading={refreshing}
          size="middle"
        >
          Refresh
        </Button>
      </div>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3">
          <Input
            placeholder="Search faculty, training, or title..."
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
              { label: 'Submitted', value: 'SUBMITTED' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Changes', value: 'CHANGES_REQUESTED' },
            ]}
          />
        </div>

        {filteredLessonPlans.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-200">
            <Text className="text-[10px] text-slate-600">
              Showing <Text strong>{filteredLessonPlans.length}</Text> of{' '}
              <Text strong>{lessonPlans.length}</Text> lesson plans
            </Text>
          </div>
        )}

        {filteredLessonPlans.length === 0 && !loading ? (
          <div className="py-8">
            <TrainingEmptyState
              type="lesson-plans"
              message="No lesson plans found"
              description={searchText || statusFilter !== 'ALL'
                ? "Try adjusting your search or filter criteria."
                : "No faculty lesson plans to review yet."}
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
              dataSource={filteredLessonPlans}
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
        title="Review Lesson Plan"
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
                { label: <span className="text-purple-600">Request Changes</span>, value: 'CHANGES_REQUESTED' },
                { label: <span className="text-red-600">Reject</span>, value: 'REJECTED' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="reviewComments"
            label="Feedback/Comments"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('status') === 'CHANGES_REQUESTED' && !value) {
                    return Promise.reject('Please provide feedback when requesting changes');
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <TextArea rows={4} placeholder="Provide feedback for the faculty..." />
          </Form.Item>
        </Form>
        {selected && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Text className="text-xs text-slate-500">Faculty</Text>
                <div className="font-medium text-slate-800">{selected.user?.name}</div>
                <Text type="secondary" className="text-xs">{selected.user?.branchName}</Text>
              </div>
              <div>
                <Text className="text-xs text-slate-500">Training</Text>
                <div className="font-medium text-slate-800 text-xs">{selected.training?.title}</div>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-200">
              <Text className="text-xs text-slate-500">Lesson Plan</Text>
              <div className="font-medium text-slate-800">{selected.title}</div>
              <Tag className="mt-1">{selected.courseOrSemester}</Tag>
            </div>
          </div>
        )}
      </Modal>

      {/* Details Modal */}
      <Modal
        title="Lesson Plan Details"
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>,
          selected?.status === 'SUBMITTED' && (
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
        width={720}
      >
        {selected && (
          <div className="mt-4">
            {/* Basic Info Section */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-50 rounded-lg p-3">
                <Text className="text-xs text-slate-500">Faculty</Text>
                <div className="font-medium text-slate-800">{selected.user?.name}</div>
                <Text type="secondary" className="text-xs">{selected.user?.branchName}</Text>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <Text className="text-xs text-slate-500">Training</Text>
                <div className="font-medium text-slate-800">{selected.training?.title}</div>
              </div>
            </div>

            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Title" span={2}>
                <Text strong>{selected.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Course/Semester">
                <Tag>{selected.courseOrSemester || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <LessonPlanStatusBadge status={selected.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {selected.submittedAt && new Date(selected.submittedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Descriptions.Item>
              <Descriptions.Item label="Due Date">
                {selected.dueDate ? (
                  <Text className={new Date(selected.dueDate) < new Date() && selected.status !== 'APPROVED' ? 'text-red-500' : ''}>
                    {new Date(selected.dueDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Connection to Training" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.connectionToTraining || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Learning Objectives" span={2}>
                {Array.isArray(selected.learningObjectives) && selected.learningObjectives.length > 0 ? (
                  <ul className="list-disc pl-4 mb-0 text-sm">
                    {selected.learningObjectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                ) : (
                  <Text type="secondary">Not provided</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="New Skills/Technologies" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.newSkillsTechnologies || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Delivery Methods" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.deliveryMethods || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Hands-on Activities" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.handsOnActivities || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Assessment Methods" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.assessmentMethods || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Industry Connections" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.industryConnections || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Resource Requirements" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.resourceRequirements || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Implementation Timeline" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.implementationTimeline || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              <Descriptions.Item label="Expected Outcomes" span={2}>
                <Paragraph className="!mb-0 text-sm">{selected.expectedOutcomes || 'Not provided'}</Paragraph>
              </Descriptions.Item>
              {selected.reviewedBy && (
                <>
                  <Descriptions.Item label="Reviewed By">
                    {selected.reviewedBy?.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Reviewed At">
                    {selected.reviewedAt && new Date(selected.reviewedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Descriptions.Item>
                </>
              )}
              {selected.reviewComments && (
                <Descriptions.Item label="Review Comments" span={2}>
                  <div className="bg-blue-50 rounded p-2">
                    <Paragraph className="!mb-0 text-sm">{selected.reviewComments}</Paragraph>
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default LessonPlanReviewPage;
