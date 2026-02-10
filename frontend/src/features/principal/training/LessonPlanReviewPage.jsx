import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Badge, Button, Card, Col, Collapse, Descriptions, Drawer, Form, Input, Radio, Row, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import {
  FileDoneOutlined,
  UserOutlined,
  BookOutlined,
  CheckOutlined,
  CloseOutlined,
  SyncOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import LessonPlanStatusBadge from '../../../components/training/LessonPlanStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import {
  fetchPrincipalLessonPlans,
  reviewPrincipalLessonPlan,
} from '../store/principalTrainingSlice';

const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

const LessonPlanReviewPage = () => {
  const dispatch = useDispatch();
  const { lessonPlans } = useSelector((state) => state.principalTraining);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('pending');
  const [submitting, setSubmitting] = useState(false);

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

  const pendingPlans = (lessonPlans.list || []).filter(
    (lp) => ['SUBMITTED', 'UNDER_REVIEW'].includes(lp.status)
  );
  const reviewedPlans = (lessonPlans.list || []).filter(
    (lp) => ['APPROVED', 'REJECTED', 'REVISION_REQUESTED'].includes(lp.status)
  );

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-700" />
          <div>
            <div className="font-medium">{record.user?.name || 'Faculty'}</div>
            <Text type="secondary" className="text-xs">
              {record.user?.branchName || record.user?.email || ''}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Lesson Plan',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <div className="font-medium">{title || 'Untitled'}</div>
          <Text type="secondary" className="text-xs flex items-center gap-1">
            <BookOutlined /> {record.training?.title || 'Training'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => <LessonPlanStatusBadge status={status} />,
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 120,
      sorter: (a, b) => new Date(a.submittedAt || a.createdAt) - new Date(b.submittedAt || b.createdAt),
      render: (value, record) => {
        const date = value || record.createdAt;
        return date ? new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }) : '-';
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="View & Review">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openReview(record)}
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
      title: 'Reviewed',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      width: 120,
      render: (value) => (
        value ? new Date(value).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }) : '-'
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openReview(record)}
          />
        </Tooltip>
      ),
    },
  ];

  const stats = useMemo(() => ({
    total: (lessonPlans.list || []).length,
    pending: pendingPlans.length,
    reviewed: reviewedPlans.length,
  }), [lessonPlans.list, pendingPlans.length, reviewedPlans.length]);

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={FileDoneOutlined}
        title={<span className="training-heading">Lesson Plan Review</span>}
        description="Review and approve lesson plans submitted by faculty members."
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} lg={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Pending" value={stats.pending} />
          </Card>
        </Col>
        <Col xs={12} lg={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Reviewed" value={stats.reviewed} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <Tabs
          className="custom-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'pending',
              label: (
                <span className="flex items-center gap-2">
                  <ClockCircleOutlined />
                  Pending Review
                  {pendingPlans.length > 0 && (
                    <Badge count={pendingPlans.length} size="small" />
                  )}
                </span>
              ),
              children: pendingPlans.length > 0 ? (
                <Table
                  className="custom-table"
                  rowKey="id"
                  columns={columns}
                  dataSource={pendingPlans}
                  loading={lessonPlans.loading}
                  pagination={{
                    pageSize: 10,
                    showTotal: (total) => `${total} pending`,
                  }}
                />
              ) : (
                <TrainingEmptyState
                  type="lesson-plans"
                  message="No pending lesson plans"
                  description="All lesson plans have been reviewed."
                />
              ),
            },
            {
              key: 'reviewed',
              label: (
                <span className="flex items-center gap-2">
                  <CheckCircleOutlined />
                  Reviewed
                </span>
              ),
              children: reviewedPlans.length > 0 ? (
                <Table
                  className="custom-table"
                  rowKey="id"
                  columns={reviewedColumns}
                  dataSource={reviewedPlans}
                  loading={lessonPlans.loading}
                  pagination={{
                    pageSize: 10,
                    showTotal: (total) => `${total} reviewed`,
                  }}
                />
              ) : (
                <TrainingEmptyState
                  type="lesson-plans"
                  message="No reviewed lesson plans"
                  description="Reviewed lesson plans will appear here."
                />
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title={
          <div className="flex items-center gap-2">
            <FileDoneOutlined className="text-primary" />
            Review Lesson Plan
          </div>
        }
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
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
              <Avatar size={48} icon={<UserOutlined />} className="bg-blue-100 text-blue-700" />
              <div>
                <Title level={5} className="!mb-0">{selected.user?.name || 'Faculty'}</Title>
                <Text type="secondary">{selected.user?.email}</Text>
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
              <Descriptions.Item label="Current Status">
                <LessonPlanStatusBadge status={selected.status} />
              </Descriptions.Item>
            </Descriptions>

            <Collapse defaultActiveKey={['connection', 'objectives']}>
              <Panel header="Connection to Training" key="connection">
                <Paragraph className="text-text-secondary">
                  {selected.connectionToTraining || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Learning Objectives" key="objectives">
                <ul className="list-disc pl-4 space-y-1">
                  {(selected.learningObjectives || []).map((obj, i) => (
                    <li key={i} className="text-text-secondary">{obj}</li>
                  ))}
                  {!selected.learningObjectives?.length && (
                    <Text type="secondary">Not provided</Text>
                  )}
                </ul>
              </Panel>
              <Panel header="New Skills/Technologies" key="skills">
                <Paragraph className="text-text-secondary">
                  {selected.newSkillsTechnologies || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Delivery Methods" key="delivery">
                <Paragraph className="text-text-secondary">
                  {selected.deliveryMethods || 'Not provided'}
                </Paragraph>
              </Panel>
              <Panel header="Hands-on Activities" key="activities">
                <Paragraph className="text-text-secondary">
                  {selected.handsOnActivities || 'Not provided'}
                </Paragraph>
              </Panel>
            </Collapse>

            {['SUBMITTED', 'UNDER_REVIEW'].includes(selected.status) && (
              <Card className="border-blue-200 border-1 rounded-xl bg-blue-50" styles={{ body: { padding: '16px' } }}>
                <Title level={5} className="flex items-center gap-2 !mb-4">
                  <CheckCircleOutlined className="text-primary" />
                  Your Review
                </Title>
                <Form layout="vertical" form={form}>
                  <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
                    <Radio.Group className="w-full">
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
                      rows={4}
                      placeholder="Add feedback or suggestions for the faculty member..."
                    />
                  </Form.Item>
                </Form>
              </Card>
            )}

            {selected.reviewComments && (
              <Card className="rounded-xl bg-gray-50" styles={{ body: { padding: '16px' } }}>
                <Title level={5} className="!mb-2">Previous Review Comments</Title>
                <Paragraph className="text-text-secondary !mb-0">
                  {selected.reviewComments}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default LessonPlanReviewPage;
