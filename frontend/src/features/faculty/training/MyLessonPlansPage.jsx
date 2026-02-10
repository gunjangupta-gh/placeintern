import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Input, Popconfirm, Row, Segmented, Space, Statistic, Table, Tooltip, Typography, message } from 'antd';
import {
  EditOutlined,
  PlusOutlined,
  SendOutlined,
  DeleteOutlined,
  BookOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import LessonPlanStatusBadge from '../../../components/training/LessonPlanStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import {
  fetchLessonPlans,
  deleteLessonPlan,
  submitLessonPlan,
} from '../store/facultyTrainingSlice';

const { Text } = Typography;

const MyLessonPlansPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { lessonPlans } = useSelector((state) => state.facultyTraining);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    dispatch(fetchLessonPlans());
  }, [dispatch]);

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteLessonPlan(id)).unwrap();
      message.success('Lesson plan deleted');
    } catch (error) {
      message.error(error || 'Failed to delete lesson plan');
    }
  };

  const handleSubmit = async (id) => {
    try {
      await dispatch(submitLessonPlan(id)).unwrap();
      message.success('Lesson plan submitted for review');
    } catch (error) {
      message.error(error || 'Failed to submit lesson plan');
    }
  };

  const planStats = useMemo(() => {
    const list = lessonPlans.list || [];
    return {
      total: list.length,
      draft: list.filter((item) => item.status === 'DRAFT').length,
      submitted: list.filter((item) => ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)).length,
      approved: list.filter((item) => item.status === 'APPROVED').length,
    };
  }, [lessonPlans.list]);

  const filteredPlans = useMemo(() => {
    let result = lessonPlans.list || [];
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUBMITTED') {
        result = result.filter((item) => ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status));
      } else {
        result = result.filter((item) => item.status === statusFilter);
      }
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter((item) =>
        (item.title || '').toLowerCase().includes(search) ||
        (item.training?.title || item.trainingTitle || '').toLowerCase().includes(search)
      );
    }
    return result;
  }, [lessonPlans.list, searchText, statusFilter]);

  const columns = [
    {
      title: 'Lesson Plan',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div>
          <div className="font-medium">{title || 'Untitled'}</div>
          <Text type="secondary" className="text-xs">
            {record.courseOrSemester || 'No course specified'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <BookOutlined className="text-blue-700" />
          <span>{record.training?.title || record.trainingTitle || 'Training'}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      filters: [
        { text: 'Draft', value: 'DRAFT' },
        { text: 'Submitted', value: 'SUBMITTED' },
        { text: 'Under Review', value: 'UNDER_REVIEW' },
        { text: 'Approved', value: 'APPROVED' },
        { text: 'Rejected', value: 'REJECTED' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => <LessonPlanStatusBadge status={status} />,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      sorter: (a, b) => new Date(a.updatedAt) - new Date(b.updatedAt),
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
      width: 150,
      render: (_, record) => (
        <Space>
          <Tooltip title="View/Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/app/training/lesson-plans/${record.id}/edit`)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <Tooltip title="Submit for Review">
              <Button
                type="text"
                size="small"
                className="text-green-600 hover:text-green-700"
                icon={<SendOutlined />}
                onClick={() => handleSubmit(record.id)}
              />
            </Tooltip>
          )}
          {['DRAFT', 'REJECTED'].includes(record.status) && (
            <Popconfirm
              title="Delete lesson plan?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(record.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={BookOutlined}
        title={<span className="training-heading">My Lesson Plans</span>}
        description="Create and manage lesson plans that integrate your training learnings into classroom practice."
        actions={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/app/training/lesson-plans/new')}
          >
            New Lesson Plan
          </Button>,
        ]}
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={planStats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Drafts" value={planStats.draft} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="In Review" value={planStats.submitted} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Approved" value={planStats.approved} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <Input
            placeholder="Search lesson plans"
            prefix={<SearchOutlined className="text-text-secondary" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:w-80"
            allowClear
          />
          <Segmented
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { label: 'All', value: 'ALL' },
              { label: 'Draft', value: 'DRAFT' },
              { label: 'In Review', value: 'SUBMITTED' },
              { label: 'Approved', value: 'APPROVED' },
            ]}
          />
        </div>

        {filteredPlans.length === 0 && !lessonPlans.loading ? (
          <TrainingEmptyState
            type="lesson-plans"
            message="No lesson plans yet"
            description="Create a lesson plan to document how you'll apply training insights in your classroom."
            actionText="Create Lesson Plan"
            onAction={() => navigate('/app/training/lesson-plans/new')}
          />
        ) : (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredPlans}
            loading={lessonPlans.loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} lesson plans`,
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default MyLessonPlansPage;
