import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Form, Input, Modal, Row, Select, Table, Tag, Typography, message } from 'antd';
import { useParams } from 'react-router-dom';
import { FileTextOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchStateApplications, reviewStateApplication } from '../store/stateTrainingSlice';

const { Text } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  error: { icon: 'bg-red-100 text-red-700', card: 'bg-gradient-to-br from-red-50 via-white to-slate-50' },
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

const ApplicationManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { applications } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateApplications({ trainingId: id }));
  }, [dispatch, id]);

  const isLoading = applications.loading && !applications.list;

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
      render: (status) => {
        const statusConfig = {
          APPROVED: { color: 'green', icon: <CheckCircleOutlined /> },
          REJECTED: { color: 'red', icon: <CloseCircleOutlined /> },
          PENDING: { color: 'orange', icon: <ClockCircleOutlined /> },
          SUBMITTED: { color: 'blue', icon: <ClockCircleOutlined /> },
        };
        const config = statusConfig[status] || { color: 'default' };
        return <Tag color={config.color} icon={config.icon}>{status}</Tag>;
      },
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
        <Button size="small" onClick={() => openReview(record)} aria-label={`Review application from ${record.user?.name || 'faculty'}`}>
          Review
        </Button>
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

  const searchResultCount = searchText ? filteredApplications.length : null;

  return (
    <div className="p-6 training-ui" role="main" aria-label="Application Management">
      <PageHeader
        icon={FileTextOutlined}
        title={<span className="training-heading">Applications</span>}
        description="Review training applications for this session."
      />

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Application statistics">
        {isLoading ? (
          <>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
          </>
        ) : (
          <>
            <Col xs={12} lg={6}>
              <StatCard
                icon={TeamOutlined}
                title="Total"
                value={stats.total}
                tone="primary"
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                icon={ClockCircleOutlined}
                title="Pending"
                value={stats.pending}
                tone="warning"
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                icon={CheckCircleOutlined}
                title="Approved"
                value={stats.approved}
                tone="success"
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                icon={CloseCircleOutlined}
                title="Rejected"
                value={stats.rejected}
                tone="error"
              />
            </Col>
          </>
        )}
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search faculty"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              allowClear
              aria-label="Search faculty by name"
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
        ) : filteredApplications.length > 0 ? (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredApplications}
            loading={applications.loading}
            pagination={{ pageSize: 10 }}
            aria-label="Applications table"
          />
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'applications'}
            message={searchText ? 'No applications found' : 'No applications yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Applications will appear here once faculty members apply.'}
            actionText={searchText ? 'Clear Search' : null}
            onAction={searchText ? () => setSearchText('') : null}
          />
        )}
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
        aria-label="Review application modal"
      >
        <Form layout="vertical" form={form}>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
              ]}
              aria-label="Select application status"
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments">
            <Input.TextArea rows={3} placeholder="Add notes" aria-label="Review comments" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ApplicationManagementPage;
