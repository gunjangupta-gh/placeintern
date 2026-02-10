import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tooltip, Typography, message } from 'antd';
import { FileTextOutlined, CheckOutlined, CloseOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import {
  fetchPrincipalApplications,
  reviewPrincipalApplication,
} from '../store/principalTrainingSlice';

const { Text } = Typography;

const ApplicationReviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { applications } = useSelector((state) => state.principalTraining);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchPrincipalApplications());
  }, [dispatch]);

  const openReview = (record, defaultStatus = 'APPROVED') => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: defaultStatus, reviewComments: '' });
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      await dispatch(reviewPrincipalApplication({ id: selected.id, data: values })).unwrap();
      message.success(`Application ${values.status.toLowerCase()}`);
      setReviewOpen(false);
      dispatch(fetchPrincipalApplications({ forceRefresh: true }));
    } catch (error) {
      message.error(error || 'Failed to review application');
    }
  };

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
              {record.user?.email || record.user?.branchName || ''}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.training?.title || 'Training'}</div>
          {record.training?.startDate && (
            <TrainingDateRange
              startDate={record.training.startDate}
              endDate={record.training.endDate}
              compact
              showIcon={false}
            />
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Submitted', value: 'SUBMITTED' },
        { text: 'Approved', value: 'APPROVED' },
        { text: 'Rejected', value: 'REJECTED' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status) => <ApplicationStatusBadge status={status} />,
    },
    {
      title: 'Applied',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
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
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Training">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/app/training/${record.trainingId || record.training?.id}`)}
            />
          </Tooltip>
          {['PENDING', 'SUBMITTED'].includes(record.status) && (
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
      (item.user?.name || item.user?.email || '').toLowerCase().includes(search) ||
      (item.training?.title || '').toLowerCase().includes(search)
    );
  }, [applications.list, searchText]);

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={FileTextOutlined}
        title={<span className="training-heading">Application Review</span>}
        description="Review and approve faculty training applications from your institution."
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
            placeholder="Search by faculty or training"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            className="lg:w-80"
            allowClear
          />
        </div>

        {filteredApplications.length === 0 && !applications.loading ? (
          <TrainingEmptyState
            type="applications"
            message="No pending applications"
            description="There are no applications waiting for your review."
          />
        ) : (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredApplications}
            loading={applications.loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} applications`,
            }}
          />
        )}
      </Card>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-primary" />
            Review Application
          </div>
        }
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        okText="Submit Review"
        width={500}
      >
        {selected && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Faculty">{selected.user?.name}</Descriptions.Item>
              <Descriptions.Item label="Training">{selected.training?.title}</Descriptions.Item>
              {selected.relevanceToTeaching && (
                <Descriptions.Item label="Relevance">{selected.relevanceToTeaching}</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
            <Select
              size="large"
              options={[
                { value: 'APPROVED', label: 'Approve Application' },
                { value: 'REJECTED', label: 'Reject Application' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments (Optional)">
            <Input.TextArea
              rows={3}
              placeholder="Add any notes or feedback for the applicant..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationReviewPage;
