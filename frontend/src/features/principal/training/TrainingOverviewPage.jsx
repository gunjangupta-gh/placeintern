import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Card, Col, Descriptions, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchPrincipalTrainings, fetchPrincipalTrainingDashboard, fetchPrincipalParticipationReport, reviewPrincipalApplication, fetchPrincipalApplications } from '../store/principalTrainingSlice';

const { Text, Title } = Typography;

const STATUS_CONFIG = {
  APPROVED: { color: 'success', icon: <CheckOutlined />, label: 'Approved' },
  PENDING: { color: 'warning', icon: <ClockCircleOutlined />, label: 'Pending' },
  SUBMITTED: { color: 'processing', icon: <ClockCircleOutlined />, label: 'Submitted' },
  REJECTED: { color: 'error', icon: <CloseOutlined />, label: 'Rejected' },
};

const StatCard = ({ icon: Icon, title, value, color, onClick }) => {
  const colorClasses = {
    blue: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50', icon: 'text-blue-600 bg-blue-100', border: 'border-blue-100', text: 'text-blue-700' },
    emerald: { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', icon: 'text-emerald-600 bg-emerald-100', border: 'border-emerald-100', text: 'text-emerald-700' },
    amber: { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50', icon: 'text-amber-600 bg-amber-100', border: 'border-amber-100', text: 'text-amber-700' },
    slate: { bg: 'bg-gradient-to-br from-slate-50 to-slate-100/50', icon: 'text-slate-600 bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' },
    violet: { bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50', icon: 'text-violet-600 bg-violet-100', border: 'border-violet-100', text: 'text-violet-700' },
  };
  const styles = colorClasses[color] || colorClasses.blue;
  
  return (
    <div
      className={`${styles.bg} rounded-xl p-2.5 h-full border ${styles.border} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`${styles.icon} p-1.5 rounded-lg`}>
          <Icon className="text-sm" />
        </span>
      </div>
      <Statistic
        title={<span className={`${styles.text} text-[10px] uppercase tracking-wider font-semibold opacity-80`}>{title}</span>}
        value={value}
        valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
      />
    </div>
  );
};

const TrainingOverviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings, reports } = useSelector((state) => state.principalTraining);
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('trainings');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form] = Form.useForm();

  const isLoading = trainings.loading && !trainings.list;
  const isReportsLoading = reports.loading;

  useEffect(() => {
    dispatch(fetchPrincipalTrainings());
    dispatch(fetchPrincipalTrainingDashboard());
    dispatch(fetchPrincipalParticipationReport());
  }, [dispatch]);

  const dashboard = reports?.dashboard || {};
  const participation = reports?.participation || {};

  // Process participation data
  const reportData = useMemo(() => {
    const applications = participation.applications || [];
    
    return {
      applications,
    };
  }, [participation]);

  const stats = [
    { title: 'Available Trainings', value: trainings.list?.length || 0, icon: CalendarOutlined, color: 'blue' },
    { title: 'Total Applications', value: participation.totalApplications || 0, icon: FileTextOutlined, color: 'violet' },
    { title: 'Approved', value: participation.byStatus?.APPROVED || 0, icon: CheckCircleOutlined, color: 'emerald' },
    { title: 'Pending Review', value: (participation.byStatus?.PENDING || 0) + (participation.byStatus?.SUBMITTED || 0), icon: ClockCircleOutlined, color: 'amber', onClick: () => navigate('/app/principal/training/applications') },
    { title: 'Faculty Enrolled', value: dashboard.totalParticipants || 0, icon: TeamOutlined, color: 'slate' },
  ];

  const filteredTrainings = (trainings.list || []).filter(
    (t) => !searchText || t.title?.toLowerCase().includes(searchText.toLowerCase())
  );

  const openReview = (record, defaultStatus = 'APPROVED') => {
    setSelected(record);
    setReviewOpen(true);
    form.setFieldsValue({ status: defaultStatus, reviewComments: '' });
  };

  const openDetails = (record) => {
    setSelected(record);
    setDetailsOpen(true);
  };

  const handleReview = async () => {
    try {
      const values = await form.validateFields();
      await dispatch(reviewPrincipalApplication({ id: selected.id, data: values })).unwrap();
      message.success(`Application ${values.status.toLowerCase()}`);
      setReviewOpen(false);
      dispatch(fetchPrincipalParticipationReport());
    } catch (error) {
      message.error(error || 'Failed to review application');
    }
  };

  const applicationColumns = [
    {
      title: 'Faculty',
      key: 'faculty',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.user?.name || 'N/A'}</div>
          <Text className="text-xs text-slate-500">{record.user?.branchName || record.user?.email}</Text>
        </div>
      ),
    },
    {
      title: 'Training',
      key: 'training',
      render: (_, record) => (
        <div>
          <div className="font-medium text-sm text-slate-800">{record.training?.title || 'N/A'}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <DeliveryModeBadge mode={record.training?.deliveryMode} showIcon={false} />
          </div>
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
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 120,
      render: (date, record) => (
        <Text className="text-xs">
          {(date || record.createdAt) ? new Date(date || record.createdAt).toLocaleDateString('en-US', {
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
          <Tooltip title="View Application">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                openDetails(record);
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

  const trainingColumns = [
    {
      title: 'Training',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text
            className="font-medium cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/app/training/${record.id}`)}
          >
            {text}
          </Text>
          <div className="text-xs text-text-secondary mt-0.5">
            {record.providedBy || 'Training Provider'}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      width: 180,
      render: (_, record) => (
        <TrainingDateRange startDate={record.startDate} endDate={record.endDate} compact />
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'deliveryMode',
      key: 'deliveryMode',
      width: 120,
      filters: [
        { text: 'Online', value: 'ONLINE' },
        { text: 'In-Person', value: 'OFFLINE' },
        { text: 'Hybrid', value: 'HYBRID' },
      ],
      onFilter: (value, record) => record.deliveryMode === value,
      render: (mode) => <DeliveryModeBadge mode={mode} showIcon={false} />,
    },
    {
      title: 'Capacity',
      key: 'capacity',
      width: 120,
      render: (_, record) => (
        record.capacity ? (
          <CapacityIndicator available={record.availableSeats} total={record.capacity} compact />
        ) : '-'
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tooltip title="View">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/app/training/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  const renderStatSkeletons = () => (
    <Row gutter={[12, 12]} className="mb-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Col xs={24} sm={12} lg={6} key={idx}>
          <TrainingStatSkeleton />
        </Col>
      ))}
    </Row>
  );



  return (
    <div className="p-4 training-ui">
      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <TrainingGreeting
          userName={user?.name}
          subtitle="Monitor faculty training opportunities and participation across your institution."
        />
      </div>

      {/* Stats Grid */}
      {isLoading ? renderStatSkeletons() : (
        <Row gutter={[12, 12]} className="mb-4">
          {stats.slice(0, 4).map((stat) => (
            <Col xs={24} sm={12} lg={6} key={stat.title}>
              <StatCard {...stat} />
            </Col>
          ))}
        </Row>
      )}

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
        <Tabs
          className="custom-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'trainings',
              label: (
                <span className="flex items-center gap-2 px-4">
                  <CalendarOutlined />
                  Trainings
                  {filteredTrainings.length > 0 && <Badge count={filteredTrainings.length} size="small" />}
                </span>
              ),
              children: (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Input
                      placeholder="Search trainings..."
                      prefix={<SearchOutlined className="text-slate-400" />}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full max-w-md"
                      size="middle"
                      allowClear
                    />
                  </div>
                  {isLoading ? (
                    <TableRowSkeleton rows={5} columns={4} />
                  ) : filteredTrainings.length > 0 ? (
                    <div className="custom-scrollbar overflow-x-auto">
                      <Table
                        className="custom-table"
                        rowKey="id"
                        columns={trainingColumns}
                        dataSource={filteredTrainings}
                        loading={trainings.loading}
                        size="small"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) => <Text className="text-xs">{range[0]}-{range[1]} of {total}</Text>,
                          size: 'small',
                        }}
                        scroll={{ x: 'max-content' }}
                      />
                    </div>
                  ) : (
                    <TrainingEmptyState
                      type={searchText ? 'search' : 'calendar'}
                      message={searchText ? 'No matching trainings' : 'No trainings'}
                      description={searchText ? 'Try adjusting your search.' : 'No training opportunities available.'}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'applications',
              label: (
                <span className="flex items-center gap-2 px-4">
                  <FileTextOutlined />
                  Applications
                  {reportData.applications.length > 0 && <Badge count={reportData.applications.length} size="small" />}
                </span>
              ),
              children: (
                <div className="p-4">
                  {isReportsLoading ? (
                    <TableRowSkeleton rows={5} columns={4} />
                  ) : reportData.applications.length > 0 ? (
                    <div className="custom-scrollbar overflow-x-auto">
                      <Table
                        className="custom-table"
                        rowKey="id"
                        columns={applicationColumns}
                        dataSource={reportData.applications}
                        size="small"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total, range) => <Text className="text-xs">{range[0]}-{range[1]} of {total}</Text>,
                          size: 'small',
                        }}
                        scroll={{ x: 'max-content' }}
                        onRow={(record) => ({
                          className: 'cursor-pointer hover:bg-slate-50',
                          onClick: () => openDetails(record),
                        })}
                      />
                    </div>
                  ) : (
                    <TrainingEmptyState
                      type="default"
                      message="No applications"
                      description="No faculty applications found."
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
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
          <div className="mb-2 p-2 bg-blue-50 rounded">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="Faculty">{selected.user?.name}</Descriptions.Item>
              <Descriptions.Item label="Training">{selected.training?.title}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
        <Form layout="vertical" form={form} size="small">
          <Form.Item name="status" label="Decision" rules={[{ required: true }]} className="mb-2">
            <Select
              options={[
                { value: 'APPROVED', label: 'Approve' },
                { value: 'REJECTED', label: 'Reject' },
              ]}
            />
          </Form.Item>
          <Form.Item name="reviewComments" label="Comments" className="mb-0">
            <Input.TextArea
              rows={2}
              placeholder="Optional feedback..."
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Application Details"
        open={detailsOpen}
        onCancel={() => setDetailsOpen(false)}
        footer={[
          <Button key="close" size="small" onClick={() => setDetailsOpen(false)}>
            Close
          </Button>,
          selected && selected.training && (
            <Button
              key="training"
              size="small"
              onClick={() => {
                setDetailsOpen(false);
                navigate(`/app/training/${selected.trainingId || selected.training?.id}`);
              }}
            >
              View Training Details
            </Button>
          ),
          selected && ['PENDING', 'SUBMITTED'].includes(selected.status) && (
            <>
              <Button
                key="reject"
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => {
                  setDetailsOpen(false);
                  openReview(selected, 'REJECTED');
                }}
              >
                Reject
              </Button>
              <Button
                key="approve"
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => {
                  setDetailsOpen(false);
                  openReview(selected, 'APPROVED');
                }}
              >
                Approve
              </Button>
            </>
          ),
        ]}
        width={600}
      >
        {selected && (
          <div className="space-y-3">
            <Card className="bg-blue-50 border-blue-100" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Faculty">
                  <Text strong>{selected.user?.name}</Text>
                  <br />
                  <Text type="secondary" className="text-xs">{selected.user?.email}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Training">
                  <Text strong>{selected.training?.title}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <ApplicationStatusBadge status={selected.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Applied On">
                  {selected.appliedAt ? new Date(selected.appliedAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <div>
              <Title level={5} className="mb-1! text-sm">Relevance to Teaching</Title>
              <Card size="small" className="bg-gray-50">
                <Text className="text-xs">{selected.relevanceToTeaching || 'Not provided'}</Text>
              </Card>
            </div>

            <div>
              <Title level={5} className="mb-1! text-sm">Expected Application</Title>
              <Card size="small" className="bg-gray-50">
                <Text className="text-xs">{selected.expectedApplication || 'Not provided'}</Text>
              </Card>
            </div>

            {selected.reviewComments && (
              <div>
                <Title level={5} className="mb-1! text-sm">Review Comments</Title>
                <Card size="small" className="bg-amber-50 border-amber-100">
                  <Text className="text-xs">{selected.reviewComments}</Text>
                </Card>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TrainingOverviewPage;
