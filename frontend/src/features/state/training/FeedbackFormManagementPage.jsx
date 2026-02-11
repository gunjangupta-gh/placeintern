import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Switch, Table, Tag, Typography, message } from 'antd';
import { FileTextOutlined, PlusOutlined, CheckCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchStateFeedbackForms,
  createStateFeedbackForm,
  updateStateFeedbackForm,
  deleteStateFeedbackForm,
  publishStateFeedbackForm,
} from '../store/stateTrainingSlice';

const { Text } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, subtitle, tone, trend, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  const hasTrend = trend !== undefined && trend !== null;
  const isPositiveTrend = hasTrend && trend >= 0;

  return (
    <Card
      className={`rounded-2xl border-border shadow-none ${onClick ? 'cursor-pointer hover:shadow-soft' : ''} transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '16px' } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}. ${subtitle || ''}${hasTrend ? ` Trend: ${isPositiveTrend ? 'up' : 'down'} ${Math.abs(trend)}%` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{value}</span>
            {hasTrend && (
              <span className={`flex items-center text-xs font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        {Icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
            <Icon className="text-lg" />
          </div>
        )}
      </div>
    </Card>
  );
};

const FeedbackFormManagementPage = () => {
  const dispatch = useDispatch();
  const { feedbackForms } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateFeedbackForms());
  }, [dispatch]);

  const isLoading = feedbackForms.loading && !feedbackForms.list;

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description,
      purpose: record.purpose,
      questionsJson: JSON.stringify(record.questions || [], null, 2),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        title: values.title,
        description: values.description,
        purpose: values.purpose,
        questions: JSON.parse(values.questionsJson || '[]'),
        publish: values.publish,
      };

      if (editing) {
        await dispatch(updateStateFeedbackForm({ id: editing.id, data: payload })).unwrap();
        message.success('Feedback form updated');
      } else {
        await dispatch(createStateFeedbackForm(payload)).unwrap();
        message.success('Feedback form created');
      }
      setModalOpen(false);
    } catch (error) {
      message.error(error || 'Failed to save feedback form');
    }
  };

  const handlePublish = async (id) => {
    try {
      await dispatch(publishStateFeedbackForm(id)).unwrap();
      message.success('Feedback form published');
    } catch (error) {
      message.error(error || 'Failed to publish feedback form');
    }
  };

  const handleDelete = async (id) => {
    try {
      await dispatch(deleteStateFeedbackForm(id)).unwrap();
      message.success('Feedback form deleted');
    } catch (error) {
      message.error(error || 'Failed to delete feedback form');
    }
  };

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    { title: 'Purpose', dataIndex: 'purpose', key: 'purpose', render: (value) => value || '-' },
    {
      title: 'Published',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (value) => value ? <Tag color="green" icon={<CheckCircleOutlined />}>Yes</Tag> : <Tag>No</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => openEdit(record)} aria-label={`Edit form: ${record.title}`}>
            Edit
          </Button>
          <Button size="small" onClick={() => handlePublish(record.id)} aria-label={`Publish form: ${record.title}`}>
            Publish
          </Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)} aria-label={`Delete form: ${record.title}`}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = feedbackForms.list || [];
    return {
      total: list.length,
      published: list.filter((item) => item.isPublished).length,
    };
  }, [feedbackForms.list]);

  const filteredForms = useMemo(() => {
    if (!searchText) return feedbackForms.list || [];
    const search = searchText.toLowerCase();
    return (feedbackForms.list || []).filter((item) =>
      (item.title || '').toLowerCase().includes(search) ||
      (item.purpose || '').toLowerCase().includes(search)
    );
  }, [feedbackForms.list, searchText]);

  const searchResultCount = searchText ? filteredForms.length : null;

  return (
    <div className="p-6 training-ui" role="main" aria-label="Feedback Form Management">
      <PageHeader
        icon={FileTextOutlined}
        title={<span className="training-heading">Feedback Forms</span>}
        description="Create and manage feedback forms."
        actions={[
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate} aria-label="Create new feedback form">
            New Form
          </Button>,
        ]}
      />

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Feedback form statistics">
        {isLoading ? (
          <>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
          </>
        ) : (
          <>
            <Col xs={12} lg={6}>
              <StatCard
                icon={FileTextOutlined}
                title="Total"
                value={stats.total}
                tone="primary"
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                icon={CheckCircleOutlined}
                title="Published"
                value={stats.published}
                tone="success"
              />
            </Col>
          </>
        )}
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search by title or purpose"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              allowClear
              aria-label="Search feedback forms"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-sm" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} found
              </Text>
            )}
          </div>
        </div>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredForms.length > 0 ? (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredForms}
            loading={feedbackForms.loading}
            pagination={{ pageSize: 10 }}
            aria-label="Feedback forms table"
          />
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'feedback'}
            message={searchText ? 'No feedback forms found' : 'No feedback forms yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Create your first feedback form to collect responses.'}
            actionText={searchText ? 'Clear Search' : 'Create Form'}
            onAction={searchText ? () => setSearchText('') : openCreate}
          />
        )}
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-700" />
            {editing ? 'Edit Feedback Form' : 'Create Feedback Form'}
          </div>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={editing ? 'Update' : 'Create'}
        aria-label={editing ? 'Edit feedback form modal' : 'Create feedback form modal'}
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Form title" aria-label="Form title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Form description" aria-label="Form description" />
          </Form.Item>
          <Form.Item name="purpose" label="Purpose">
            <Select
              allowClear
              options={[
                { value: 'TRAINING', label: 'Training' },
                { value: 'GENERAL', label: 'General' },
                { value: 'SURVEY', label: 'Survey' },
                { value: 'EVALUATION', label: 'Evaluation' },
              ]}
              aria-label="Select form purpose"
            />
          </Form.Item>
          <Form.Item
            name="questionsJson"
            label="Questions (JSON)"
            rules={[{ required: true, message: 'Provide questions JSON' }]}
          >
            <Input.TextArea rows={6} placeholder='[{"id":"q1","type":"rating","question":"...","required":true}]' aria-label="Questions JSON" />
          </Form.Item>
          <Form.Item name="publish" label="Publish Immediately" valuePropName="checked">
            <Switch aria-label="Publish immediately toggle" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FeedbackFormManagementPage;
