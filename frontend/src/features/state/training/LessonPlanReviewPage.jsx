import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Descriptions, Form, Input, Modal, Space, Table, Tag, Tooltip, Typography, message, Select } from 'antd';
import { EyeOutlined, FileDoneOutlined, CheckCircleOutlined, ClockCircleOutlined, SearchOutlined } from '@ant-design/icons';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchStateLessonPlans, reviewStateLessonPlan } from '../store/stateTrainingSlice';

const { Text } = Typography;

const StateLessonPlanReviewPage = () => {
  const dispatch = useDispatch();
  const { lessonPlans } = useSelector((state) => state.stateTraining);
  const [viewOpen, setViewOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateLessonPlans());
  }, [dispatch]);

  const isLoading = lessonPlans.loading && !lessonPlans.list;

  const openReview = (record) => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: 'APPROVED', reviewComments: '' });
  };

  const openView = (record) => {
    setSelected(record);
    setViewOpen(true);
  };

  const renderTextValue = (value, fallback = 'Not provided') => {
    if (Array.isArray(value)) {
      const cleaned = value.filter(Boolean);
      return cleaned.length ? cleaned.join(', ') : fallback;
    }
    return value ? String(value) : fallback;
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      await dispatch(reviewStateLessonPlan({ id: selected.id, data: values })).unwrap();
      message.success('Lesson plan reviewed');
      setReviewOpen(false);
    } catch (error) {
      message.error(error || 'Failed to review lesson plan');
    }
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    // {
    //   title: 'Training',
    //   dataIndex: ['training', 'title'],
    //   key: 'training',
    //   render: (_, record) => record.training?.title || record.trainingTitle || 'Training',
    // },
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => record.user?.name || record.user?.email || 'Faculty',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          APPROVED: { color: 'green', icon: <CheckCircleOutlined /> },
          REJECTED: { color: 'red' },
          SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined /> },
          UNDER_REVIEW: { color: 'orange', icon: <ClockCircleOutlined /> },
          REVISION_REQUIRED: { color: 'purple' },
          DRAFT: { color: 'default' },
        };
        const config = statusConfig[status] || { color: 'default' };
        return <Tag color={config.color} icon={config.icon}>{status}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View full lesson plan">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openView(record)}
              aria-label={`View lesson plan: ${record.title}`}
            />
          </Tooltip>
          <Button size="small" onClick={() => openReview(record)} aria-label={`Review lesson plan: ${record.title}`}>
            Review
          </Button>
        </Space>
      ),
    },
  ];

  const filteredLessonPlans = useMemo(() => {
    if (!searchText) return lessonPlans.list || [];
    const search = searchText.toLowerCase();
    return (lessonPlans.list || []).filter((item) =>
      (item.title || '').toLowerCase().includes(search) ||
      (item.user?.name || item.user?.email || '').toLowerCase().includes(search) ||
      (item.training?.title || item.trainingTitle || '').toLowerCase().includes(search)
    );
  }, [lessonPlans.list, searchText]);

  const searchResultCount = searchText ? filteredLessonPlans.length : null;

  return (
    <div className="p-4 training-ui" role="main" aria-label="Lesson Plan Review">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-0.5">Lesson Plan Management</h1>
          <Text type="secondary" className="text-xs">
            Review lesson plans across institutions.
          </Text>
        </div>
      </div>

      <Card className="rounded-xl border-border shadow-none !mb-3" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by title, faculty, or training"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              size="middle"
              allowClear
              aria-label="Search lesson plans"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-xs" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} found
              </Text>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
        <div className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableRowSkeleton rows={5} columns={5} />
            </div>
          ) : filteredLessonPlans.length > 0 ? (
            <div className="custom-scrollbar overflow-x-auto">
              <Table
                className="custom-table"
                rowKey="id"
                columns={columns}
                dataSource={filteredLessonPlans}
                loading={lessonPlans.loading}
                size="small"
                pagination={{ pageSize: 10, showSizeChanger: true, size: 'small' }}
                aria-label="Lesson plans table"
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : (
            <div className="p-6">
              <TrainingEmptyState
                type={searchText ? 'search' : 'lessonPlans'}
                message={searchText ? 'No plans found' : 'No plans yet'}
                description={searchText ? 'Try adjusting your search.' : 'Lesson plans will appear here.'}
                actionText={searchText ? 'Clear Search' : null}
                onAction={searchText ? () => setSearchText('') : null}
              />
            </div>
          )}
        </div>
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <EyeOutlined className="text-blue-700" />
            Full Lesson Plan
          </div>
        }
        open={viewOpen}
        onCancel={() => setViewOpen(false)}
        footer={null}
        width={820}
        aria-label="View full lesson plan modal"
      >
        {selected && (
          <div className="space-y-3">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Lesson Plan Title">
                {selected.title || 'Untitled'}
              </Descriptions.Item>
              <Descriptions.Item label="Training">
                {selected.training?.title || selected.trainingTitle || 'Training'}
              </Descriptions.Item>
              <Descriptions.Item label="Faculty">
                {selected.user?.name || selected.user?.email || 'Faculty'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag>{selected.status || 'N/A'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Course/Semester">
                {renderTextValue(selected.courseOrSemester)}
              </Descriptions.Item>
              <Descriptions.Item label="Implementation Timeline">
                {renderTextValue(selected.implementationTimeline)}
              </Descriptions.Item>
              <Descriptions.Item label="Connection to Training">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.connectionToTraining)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Learning Objectives">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.learningObjectives)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="New Skills/Technologies">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.newSkillsTechnologies)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Delivery Methods">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.deliveryMethods)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Hands-on Activities">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.handsOnActivities)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Assessment Methods">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.assessmentMethods)}</div>
              </Descriptions.Item>
              <Descriptions.Item label="Expected Outcomes">
                <div className="whitespace-pre-wrap">{renderTextValue(selected.expectedOutcomes)}</div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileDoneOutlined className="text-blue-700" />
            Review Lesson Plan
          </div>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        okText="Submit"
        aria-label="Review lesson plan modal"
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
                { value: 'REVISION_REQUIRED', label: 'Request Changes' },
              ]}
              aria-label="Select review status"
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea rows={3} placeholder="Add notes" aria-label="Review comments" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StateLessonPlanReviewPage;
