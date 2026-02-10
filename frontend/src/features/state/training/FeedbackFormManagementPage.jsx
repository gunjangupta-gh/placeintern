import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Statistic, Switch, Table, Tag, message } from 'antd';
import { FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import {
  fetchStateFeedbackForms,
  createStateFeedbackForm,
  updateStateFeedbackForm,
  deleteStateFeedbackForm,
  publishStateFeedbackForm,
} from '../store/stateTrainingSlice';

const FeedbackFormManagementPage = () => {
  const dispatch = useDispatch();
  const { feedbackForms } = useSelector((state) => state.stateTraining);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateFeedbackForms());
  }, [dispatch]);

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
    { title: 'Published', dataIndex: 'isPublished', key: 'isPublished', render: (value) => value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => openEdit(record)}>Edit</Button>
          <Button size="small" onClick={() => handlePublish(record.id)}>Publish</Button>
          <Button size="small" danger onClick={() => handleDelete(record.id)}>Delete</Button>
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

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Feedback Forms</span>}
        description="Create and manage feedback forms."
        actions={[
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            New Form
          </Button>,
        ]}
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Published" value={stats.published} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <Table
          className="custom-table"
          rowKey="id"
          columns={columns}
          dataSource={feedbackForms.list}
          loading={feedbackForms.loading}
          pagination={{ pageSize: 10 }}
        />
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
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input placeholder="Form title" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Form description" />
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
            />
          </Form.Item>
          <Form.Item
            name="questionsJson"
            label="Questions (JSON)"
            rules={[{ required: true, message: 'Provide questions JSON' }]}
          >
            <Input.TextArea rows={6} placeholder='[{"id":"q1","type":"rating","question":"...","required":true}]' />
          </Form.Item>
          <Form.Item name="publish" label="Publish Immediately" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FeedbackFormManagementPage;
