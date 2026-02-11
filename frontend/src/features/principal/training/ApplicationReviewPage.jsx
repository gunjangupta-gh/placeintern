import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Tooltip, Typography, message } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  UserOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchPrincipalApplications,
  reviewPrincipalApplication,
} from '../store/principalTrainingSlice';
import { Table } from 'antd';

const { Text, Title } = Typography;

const ApplicationReviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { applications } = useSelector((state) => state.principalTraining);
  const { user } = useSelector((state) => state.auth);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const isLoading = applications.loading && !applications.list;

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
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">{record.user?.name || 'Faculty'}</div>
          <Text className="text-xs text-slate-500">
            {record.user?.email || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">{record.training?.title || 'Training'}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <div className="flex justify-center">
          <ApplicationStatusBadge status={status} />
        </div>
      ),
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
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
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Training">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/app/training/${record.trainingId || record.training?.id}`);
              }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    openReview(record, 'APPROVED');
                  }}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openReview(record, 'REJECTED');
                  }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

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
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} className="!mb-0">
            Application Review
          </Title>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="rounded-xl border-border shadow-none">
        <div className="mb-4">
          <Input
            placeholder="Search by faculty or training name..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full"
            allowClear
            aria-label="Search applications"
          />
        </div>

        {/* Results info */}
        {filteredApplications.length > 0 && (
          <div className="mb-3 pb-3 border-b border-slate-200">
            <Text className="text-xs text-slate-600">
              Showing <Text strong>{filteredApplications.length}</Text> of{" "}
              <Text strong>{applications.list?.length || 0}</Text> applications
            </Text>
          </div>
        )}

        {/* Content */}

        {isLoading ? (
          <TableRowSkeleton rows={5} columns={4} />
        ) : filteredApplications.length === 0 ? (
          <TrainingEmptyState
            type={searchText ? 'search' : 'applications'}
            message={searchText ? 'No matching applications' : 'No applications yet'}
            description={searchText ? 'Try adjusting your search criteria.' : 'There are no applications waiting for your review.'}
            actionText={searchText ? 'Clear Search' : undefined}
            onAction={searchText ? () => setSearchText('') : undefined}
          />
        ) : (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredApplications}
            loading={applications.loading}
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
              onClick: () => navigate(`/app/training/${record.trainingId || record.training?.id}`),
            })}
          />
        )}
      </Card>

      <Modal
        title="Review Application"
        open={reviewOpen}
        onCancel={() => setReviewOpen(false)}
        onOk={handleReview}
        okText="Submit"
        width={450}
      >
        {selected && (
          <div className="mb-3 p-3 bg-blue-50 rounded">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Faculty">{selected.user?.name}</Descriptions.Item>
              <Descriptions.Item label="Training">{selected.training?.title}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Decision" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea
              rows={2}
              placeholder="Optional feedback..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationReviewPage;
