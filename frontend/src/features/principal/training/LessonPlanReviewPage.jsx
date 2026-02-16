import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Card, Collapse, Descriptions, Drawer, Form, Input, Radio, Space, Table, Tooltip, Typography, message } from 'antd';
import {
  FileDoneOutlined,
  BookOutlined,
  CheckOutlined,
  CloseOutlined,
  SyncOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import LessonPlanStatusBadge from '../../../components/training/LessonPlanStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchPrincipalLessonPlans,
  reviewPrincipalLessonPlan,
} from '../store/principalTrainingSlice';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

const LessonPlanReviewPage = () => {
  const dispatch = useDispatch();
  const { lessonPlans } = useSelector((state) => state.principalTraining);
  const { user } = useSelector((state) => state.auth);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('pending');
  const [submitting, setSubmitting] = useState(false);
  const [searchText, setSearchText] = useState('');

  const isLoading = lessonPlans.loading && !lessonPlans.list;

  useEffect(() => {
    dispatch(fetchPrincipalLessonPlans());
  }, [dispatch]);

  const openReview = (record) => {
    setSelected(record);
    setDrawerOpen(true);
    form.setFieldsValue({ status: 'APPROVED', reviewComments: '' });
  };

  const handleReview = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      await dispatch(reviewPrincipalLessonPlan({ id: selected.id, data: values })).unwrap();
      message.success(`Lesson plan ${values.status.toLowerCase().replace('_', ' ')}`);
      setDrawerOpen(false);
      dispatch(fetchPrincipalLessonPlans());
    } catch (error) {
      message.error(error || 'Failed to review lesson plan');
    } finally {
      setSubmitting(false);
    }
  };

  const allPlans = useMemo(() => {
    if (!searchText) return lessonPlans.list || [];
    const search = searchText.toLowerCase();
    return (lessonPlans.list || []).filter((item) =>
      (item.user?.name || '').toLowerCase().includes(search) ||
      (item.title || '').toLowerCase().includes(search) ||
      (item.training?.title || '').toLowerCase().includes(search)
    );
  }, [lessonPlans.list, searchText]);

  const pendingPlans = allPlans.filter(
    (lp) => ['SUBMITTED', 'UNDER_REVIEW'].includes(lp.status)
  );
  const reviewedPlans = allPlans.filter(
    (lp) => ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(lp.status)
  );
  const totalLessonPlans = lessonPlans.pagination?.total ?? lessonPlans.list?.length ?? 0;

  useEffect(() => {
    if (!lessonPlans.loading && pendingPlans.length === 0 && reviewedPlans.length > 0 && activeTab === 'pending') {
      setActiveTab('reviewed');
    }
  }, [lessonPlans.loading, pendingPlans.length, reviewedPlans.length, activeTab]);

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">{record.user?.name || 'Faculty'}</div>
          <Text className="text-xs text-slate-500">
            {record.user?.branchName || record.user?.email || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Lesson Plan',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">{title || 'Untitled'}</div>
          <Text className="text-xs text-slate-500 flex items-center gap-1">
            <BookOutlined /> {record.training?.title || 'Training'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => (
        <div className="flex justify-center">
          <LessonPlanStatusBadge status={status} />
        </div>
      ),
    },
    {
      title: 'Submitted On',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 120,
      sorter: (a, b) => new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt),
      render: (value, record) => (
        <Text className="text-xs">
          {(value || record.createdAt) ? new Date(value || record.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }) : '-'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Review">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openReview(record);
              }}
            >
              Review
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  const reviewedColumns = [
    ...columns.slice(0, 3),
    {
      title: 'Reviewed On',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      width: 120,
      render: (value) => (
        <Text className="text-xs">
          {value ? new Date(value).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }) : '-'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tooltip title="View">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              openReview(record);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} className="mb-0!">
            Lesson Plan Review
          </Title>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="rounded-xl border-border shadow-none">
        <div className="mb-4">
          <Input
            placeholder="Search by faculty, title, or training name..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full"
            allowClear
            aria-label="Search lesson plans"
          />
        </div>

        {/* Tab Buttons */}

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          <Button
            type={activeTab === 'pending' ? 'primary' : 'default'}
            onClick={() => setActiveTab('pending')}
            icon={<ClockCircleOutlined />}
            size="small"
          >
            Pending
            {pendingPlans.length > 0 && <Badge count={pendingPlans.length} size="small" className="ml-2" />}
          </Button>
          <Button
            type={activeTab === 'reviewed' ? 'primary' : 'default'}
            onClick={() => setActiveTab('reviewed')}
            icon={<CheckCircleOutlined />}
            size="small"
          >
            Reviewed
          </Button>
        </div>

        {/* Results info */}
        {(activeTab === 'pending' ? pendingPlans : reviewedPlans).length > 0 && (
          <div className="mb-3 pb-3 border-b border-slate-200">
            <Text className="text-xs text-slate-600">
              Showing <Text strong>{activeTab === 'pending' ? pendingPlans.length : reviewedPlans.length}</Text> of{" "}
              <Text strong>{totalLessonPlans}</Text> lesson plans
            </Text>
          </div>
        )}

        {/* Content */}

        {/* Content */}
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : activeTab === 'pending' ? (
          pendingPlans.length > 0 ? (
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={pendingPlans}
              loading={lessonPlans.loading}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-xs text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: 'small',
              }}
              onRow={(record) => ({
                className: 'cursor-pointer hover:bg-slate-50',
                onClick: () => openReview(record),
              })}
            />
          ) : (
            <TrainingEmptyState
              type={searchText ? 'search' : 'lessonPlans'}
              message={searchText ? 'No matching lesson plans' : 'No pending lesson plans'}
              description={searchText ? 'Try adjusting your search criteria.' : 'All lesson plans have been reviewed.'}
              actionText={searchText ? 'Clear Search' : undefined}
              onAction={searchText ? () => setSearchText('') : undefined}
            />
          )
        ) : (
          reviewedPlans.length > 0 ? (
            <Table
              className="custom-table"
              rowKey="id"
              columns={reviewedColumns}
              dataSource={reviewedPlans}
              loading={lessonPlans.loading}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-xs text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: 'small',
              }}
              onRow={(record) => ({
                className: 'cursor-pointer hover:bg-slate-50',
                onClick: () => openReview(record),
              })}
            />
          ) : (
            <TrainingEmptyState
              type={searchText ? 'search' : 'lessonPlans'}
              message={searchText ? 'No matching lesson plans' : 'No reviewed lesson plans'}
              description={searchText ? 'Try adjusting your search criteria.' : 'Reviewed lesson plans will appear here.'}
              actionText={searchText ? 'Clear Search' : undefined}
              onAction={searchText ? () => setSearchText('') : undefined}
            />
          )
        )}
      </Card>

      <Drawer
        title="Review Lesson Plan"
        placement="right"
        width={600}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          ['SUBMITTED', 'UNDER_REVIEW'].includes(selected?.status) && (
            <div className="flex justify-end gap-3">
              <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="primary" onClick={handleReview} loading={submitting}>
                Submit Review
              </Button>
            </div>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded">
              <div>
                <Title level={5} className="mb-0!">{selected.user?.name || 'Faculty'}</Title>
                <Text className="text-xs text-slate-600">{selected.user?.branchName || selected.user?.email}</Text>
              </div>
            </div>

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Lesson Plan Title">
                {selected.title || 'Untitled'}
              </Descriptions.Item>
              <Descriptions.Item label="Training">
                {selected.training?.title || 'Training'}
              </Descriptions.Item>
              <Descriptions.Item label="Course/Semester">
                {selected.courseOrSemester || 'Not specified'}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <LessonPlanStatusBadge status={selected.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Implementation Timeline">
                {selected.implementationTimeline || 'Not specified'}
              </Descriptions.Item>
            </Descriptions>

            <Collapse defaultActiveKey={['connection', 'objectives', 'skills']} size="small">
              <Panel header="Connection to Training" key="connection">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.connectionToTraining || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Learning Objectives" key="objectives">
                <ul className="list-disc pl-4 space-y-1 mb-0">
                  {(selected.learningObjectives || []).map((obj, i) => (
                    <li key={i} className="text-sm text-slate-600">{obj}</li>
                  ))}
                  {!selected.learningObjectives?.length && (
                    <Text className="text-sm text-slate-500">Not provided</Text>
                  )}
                </ul>
              </Panel>
              <Panel header="New Skills/Technologies" key="skills">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.newSkillsTechnologies || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Delivery Methods" key="delivery">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.deliveryMethods || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Hands-on Activities" key="activities">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.handsOnActivities || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Assessment Methods" key="assessment">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.assessmentMethods || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Expected Outcomes" key="outcomes">
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.expectedOutcomes || 'Not provided'}
                </Paragraph>
              </Panel>
            </Collapse>

            {['SUBMITTED', 'UNDER_REVIEW'].includes(selected.status) && (
              <Card className="border-blue-200 rounded bg-blue-50" styles={{ body: { padding: '12px' } }}>
                <Title level={5} className="flex items-center gap-2 mb-3!">
                  <CheckCircleOutlined className="text-primary" />
                  Your Review
                </Title>
                <Form layout="vertical" form={form}>
                  <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
                    <Radio.Group className="w-full" aria-label="Select review decision">
                      <Space direction="vertical" className="w-full">
                        <Radio.Button value="APPROVED" className="w-full text-center h-10 flex items-center justify-center">
                          <CheckOutlined className="text-green-500 mr-2" /> Approve
                        </Radio.Button>
                        <Radio.Button value="REVISION_REQUESTED" className="w-full text-center h-10 flex items-center justify-center">
                          <SyncOutlined className="text-orange-500 mr-2" /> Request Revision
                        </Radio.Button>
                        <Radio.Button value="REJECTED" className="w-full text-center h-10 flex items-center justify-center">
                          <CloseOutlined className="text-red-500 mr-2" /> Reject
                        </Radio.Button>
                      </Space>
                    </Radio.Group>
                  </Form.Item>
                  <Form.Item name="reviewComments" label="Comments">
                    <Input.TextArea
                      rows={3}
                      placeholder="Add feedback or suggestions..."
                    />
                  </Form.Item>
                </Form>
              </Card>
            )}

            {selected.reviewComments && (
              <Card className="rounded bg-gray-50" styles={{ body: { padding: '12px' } }}>
                <Title level={5} className="mb-2!">Review Comments</Title>
                <Paragraph className="text-sm text-slate-600 mb-0!">
                  {selected.reviewComments}
                </Paragraph>
                {selected.reviewedBy && (
                  <Text className="text-xs text-slate-500 mt-2 block">
                    Reviewed by: {selected.reviewedBy.name}
                  </Text>
                )}
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default LessonPlanReviewPage;
