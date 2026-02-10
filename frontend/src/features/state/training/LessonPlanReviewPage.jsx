import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Statistic, Table, Tag, message } from 'antd';
import { FileDoneOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { fetchStateLessonPlans, reviewStateLessonPlan } from '../store/stateTrainingSlice';

const StateLessonPlanReviewPage = () => {
  const dispatch = useDispatch();
  const { lessonPlans } = useSelector((state) => state.stateTraining);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateLessonPlans());
  }, [dispatch]);

  const openReview = (record) => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: 'APPROVED', reviewComments: '' });
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
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => record.training?.title || record.trainingTitle || 'Training',
    },
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => record.user?.name || record.user?.email || 'Faculty',
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => <Tag>{status}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => openReview(record)}>Review</Button>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = lessonPlans.list || [];
    return {
      total: list.length,
      pending: list.filter((item) => ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)).length,
      approved: list.filter((item) => item.status === 'APPROVED').length,
    };
  }, [lessonPlans.list]);

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={FileDoneOutlined}
        title={<span className="training-heading">Lesson Plan Review</span>}
        description="Review lesson plans across institutions."
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Pending" value={stats.pending} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Approved" value={stats.approved} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <Table
          className="custom-table"
          rowKey="id"
          columns={columns}
          dataSource={lessonPlans.list}
          loading={lessonPlans.loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

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
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}> 
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
                { value: 'REVISION_REQUIRED', label: 'Request Changes' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea rows={3} placeholder="Add notes" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StateLessonPlanReviewPage;
