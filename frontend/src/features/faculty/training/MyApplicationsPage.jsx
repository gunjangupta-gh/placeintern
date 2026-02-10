import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Input, Popconfirm, Row, Segmented, Space, Statistic, Table, Tooltip, message } from 'antd';
import { FileTextOutlined, EyeOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { fetchMyApplications, withdrawApplication } from '../store/facultyTrainingSlice';

const MyApplicationsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { applications } = useSelector((state) => state.facultyTraining);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    dispatch(fetchMyApplications());
  }, [dispatch]);

  const handleWithdraw = async (id) => {
    try {
      await dispatch(withdrawApplication(id)).unwrap();
      message.success('Application withdrawn successfully');
    } catch (error) {
      message.error(error || 'Failed to withdraw application');
    }
  };

  const applicationStats = useMemo(() => {
    const list = applications.list || [];
    return {
      total: list.length,
      approved: list.filter((item) => item.status === 'APPROVED').length,
      pending: list.filter((item) => ['PENDING', 'SUBMITTED'].includes(item.status)).length,
      rejected: list.filter((item) => item.status === 'REJECTED').length,
    };
  }, [applications.list]);

  const filteredApplications = useMemo(() => {
    let result = applications.list || [];
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING') {
        result = result.filter((item) => ['PENDING', 'SUBMITTED'].includes(item.status));
      } else {
        result = result.filter((item) => item.status === statusFilter);
      }
    }
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter((item) =>
        (item.training?.title || item.trainingTitle || '').toLowerCase().includes(search)
      );
    }
    return result;
  }, [applications.list, searchText, statusFilter]);

  const columns = [
    {
      title: 'Training',
      dataIndex: ['training', 'title'],
      key: 'training',
      render: (_, record) => (
        <div>
          <div className="font-medium text-text-primary">
            {record.training?.title || record.trainingTitle || 'Training'}
          </div>
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
      render: (status) => <ApplicationStatusBadge status={status} />,
    },
    {
      title: 'Applied On',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (value) => (
        value ? new Date(value).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }) : '-'
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
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
            <Popconfirm
              title="Withdraw application?"
              description="Are you sure you want to withdraw this application?"
              onConfirm={() => handleWithdraw(record.id)}
              okText="Yes, Withdraw"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Withdraw">
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
        icon={FileTextOutlined}
        title={<span className="training-heading">My Applications</span>}
        description="Track your training applications and their approval status."
      />

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Total" value={applicationStats.total} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Approved" value={applicationStats.approved} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Pending" value={applicationStats.pending} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card className="rounded-2xl border-border shadow-none">
            <Statistic title="Rejected" value={applicationStats.rejected} />
          </Card>
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <Input
            placeholder="Search by training name"
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
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Rejected', value: 'REJECTED' },
            ]}
          />
        </div>

        {filteredApplications.length === 0 && !applications.loading ? (
          <TrainingEmptyState
            type="applications"
            message="No applications yet"
            actionText="Browse Trainings"
            onAction={() => navigate('/app/training/calendar')}
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
    </div>
  );
};

export default MyApplicationsPage;
