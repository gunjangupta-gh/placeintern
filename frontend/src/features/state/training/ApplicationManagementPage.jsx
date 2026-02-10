import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Statistic, Table, Tag, message } from 'antd';
import { useParams } from 'react-router-dom';
import { FileTextOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { fetchStateApplications, reviewStateApplication } from '../store/stateTrainingSlice';

const ApplicationManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { applications } = useSelector((state) => state.stateTraining);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateApplications({ trainingId: id }));
  }, [dispatch, id]);

  const openReview = (record) => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: 'APPROVED', reviewComments: '' });
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      await dispatch(reviewStateApplication({ id: selected.id, data: values })).unwrap();
      message.success('Application reviewed');
      setReviewOpen(false);
      // Refresh applications to show updated status and capacity
      dispatch(fetchStateApplications({ forceRefresh: true }));
    } catch (error) {
      message.error(error || 'Failed to review application');
    }
  };

  const columns = [
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
      render: (status) => <Tag>{status}</Tag>,
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => openReview(record)}>Review</Button>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = applications.list || [];
    return {
      total: list.length,
      pending: list.filter((item) => ['PENDING', 'SUBMITTED'].includes(item.status)).length,
      approved: list.filter((item) => item.status === 'APPROVED').length,
      rejected: list.filter((item) => item.status === 'REJECTED').length,
    };
  }, [applications.list]);

  const filteredApplications = useMemo(() => {
    if (!searchText) return applications.list || [];
    const search = searchText.toLowerCase();
    return (applications.list || []).filter((item) =>
      (item.user?.name || item.user?.email || '').toLowerCase().includes(search)
    );
  }, [applications.list, searchText]);

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">Applications</span>}
        description="Review training applications for this session."
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
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Rejected" value={stats.rejected} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <Input
            placeholder="Search faculty"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="lg:w-80"
            allowClear
          />
        </div>
        <Table
          className="custom-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredApplications}
          loading={applications.loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-700" />
            Review Application
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

export default ApplicationManagementPage;
