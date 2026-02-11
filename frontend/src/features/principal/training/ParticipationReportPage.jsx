import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Card, Col, Progress, Row, Table, Tag, Typography, Tabs, Skeleton, Statistic, List } from 'antd';
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
  BookOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  RightOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { DistributionPieChart } from '../../../components/training/TrainingCharts';
import { fetchPrincipalParticipationReport } from '../store/principalTrainingSlice';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingDateRange from '../../../components/training/TrainingDateRange';

const { Title, Text } = Typography;

const STATUS_CONFIG = {
  APPROVED: { color: 'success', icon: <CheckCircleOutlined />, label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-600' },
  PENDING: { color: 'warning', icon: <ClockCircleOutlined />, label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-600' },
  REJECTED: { color: 'error', icon: <CloseCircleOutlined />, label: 'Rejected', bg: 'bg-red-50', text: 'text-red-600' },
  WAITLISTED: { color: 'default', icon: <ClockCircleOutlined />, label: 'Waitlisted', bg: 'bg-slate-50', text: 'text-slate-600' },
};

const ParticipationReportPage = () => {
  const dispatch = useDispatch();
  const { reports } = useSelector((state) => state.principalTraining);
  const { user } = useSelector((state) => state.auth);

  const isLoading = reports.loading;

  useEffect(() => {
    dispatch(fetchPrincipalParticipationReport());
  }, [dispatch]);

  // Process API response: { totalApplications, byStatus, applications }
  const reportData = useMemo(() => {
    const data = reports.participation || {};
    const applications = data.applications || [];
    const byStatus = data.byStatus || {};
    const totalApplications = data.totalApplications || 0;

    // Status distribution for pie chart
    const statusDistribution = Object.entries(byStatus).map(([status, count]) => ({
      name: STATUS_CONFIG[status]?.label || status,
      value: count,
    }));

    // Group by training
    const byTraining = applications.reduce((acc, app) => {
      const trainingId = app.training?.id;
      if (!acc[trainingId]) {
        acc[trainingId] = {
          training: app.training,
          count: 0,
          applications: [],
        };
      }
      acc[trainingId].count++;
      acc[trainingId].applications.push(app);
      return acc;
    }, {});

    // Unique users
    const uniqueUsers = [...new Set(applications.map((app) => app.userId))].length;

    // Top trainings (sorted by count)
    const topTrainings = Object.values(byTraining)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent applications
    const recentApplications = [...applications]
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      .slice(0, 5);

    return {
      totalApplications,
      byStatus,
      statusDistribution,
      applications,
      byTraining: Object.values(byTraining),
      uniqueUsers,
      topTrainings,
      recentApplications,
    };
  }, [reports.participation]);

  const applicationColumns = [
    {
      title: 'Faculty',
      key: 'faculty',
      ellipsis: true,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-700" size="small" />
          <div>
            <Text strong className="block text-sm">{record.user?.name || 'N/A'}</Text>
            <Text type="secondary" className="text-xs">{record.user?.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Training',
      key: 'training',
      ellipsis: true,
      render: (_, record) => (
        <div>
          <Text strong className="block text-sm line-clamp-1">{record.training?.title || 'N/A'}</Text>
          <div className="flex items-center gap-2 mt-1">
            <DeliveryModeBadge mode={record.training?.deliveryMode} showIcon={false} />
            {record.training?.city && (
              <Text type="secondary" className="text-xs flex items-center gap-1">
                <EnvironmentOutlined /> {record.training.city}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: Object.keys(STATUS_CONFIG).map((key) => ({ text: STATUS_CONFIG[key].label, value: key })),
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const config = STATUS_CONFIG[status] || { color: 'default', label: status };
        return <Tag color={config.color} icon={config.icon}>{config.label}</Tag>;
      },
    },
    {
      title: 'Applied',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 100,
      sorter: (a, b) => new Date(a.appliedAt) - new Date(b.appliedAt),
      render: (date) => date ? new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }) : '-',
    },
    {
      title: 'Training Date',
      key: 'trainingDate',
      width: 140,
      render: (_, record) => (
        <TrainingDateRange
          startDate={record.training?.startDate}
          endDate={record.training?.endDate}
          compact
        />
      ),
    },
  ];

  const trainingColumns = [
    {
      title: 'Training',
      key: 'training',
      ellipsis: true,
      render: (_, record) => (
        <div>
          <Text strong className="block text-sm">{record.training?.title || 'N/A'}</Text>
          <div className="flex items-center gap-2 mt-1">
            <DeliveryModeBadge mode={record.training?.deliveryMode} showIcon={false} />
            <Text type="secondary" className="text-xs">{record.training?.providedBy}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Date',
      key: 'date',
      width: 150,
      render: (_, record) => (
        <TrainingDateRange
          startDate={record.training?.startDate}
          endDate={record.training?.endDate}
          compact
        />
      ),
    },
    {
      title: 'Applications',
      dataIndex: 'count',
      key: 'count',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: 'descend',
      render: (count) => (
        <span className="text-lg font-semibold text-primary">{count}</span>
      ),
    },
    {
      title: 'Share',
      key: 'share',
      width: 120,
      render: (_, record) => {
        const percentage = reportData.totalApplications > 0
          ? Math.round((record.count / reportData.totalApplications) * 100)
          : 0;
        return (
          <Progress
            percent={percentage}
            size="small"
            strokeColor="#3B82F6"
            format={(p) => `${p}%`}
          />
        );
      },
    },
  ];

  // Overview Tab Content
  const OverviewContent = () => (
    <div className="space-y-6">
      {/* Stats Row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-4 h-full border border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-600 bg-blue-100 p-2 rounded-lg">
                <TeamOutlined className="text-lg" />
              </span>
            </div>
            <Statistic
              title={<span className="text-blue-700 text-xs">Total Applications</span>}
              value={reportData.totalApplications}
              valueStyle={{ color: '#1d4ed8', fontSize: 28, fontWeight: 700 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 h-full border border-emerald-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-600 bg-emerald-100 p-2 rounded-lg">
                <CheckCircleOutlined className="text-lg" />
              </span>
            </div>
            <Statistic
              title={<span className="text-emerald-700 text-xs">Approved</span>}
              value={reportData.byStatus.APPROVED || 0}
              valueStyle={{ color: '#059669', fontSize: 28, fontWeight: 700 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-4 h-full border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-600 bg-amber-100 p-2 rounded-lg">
                <ClockCircleOutlined className="text-lg" />
              </span>
            </div>
            <Statistic
              title={<span className="text-amber-700 text-xs">Pending</span>}
              value={reportData.byStatus.PENDING || 0}
              valueStyle={{ color: '#d97706', fontSize: 28, fontWeight: 700 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 h-full border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-600 bg-slate-100 p-2 rounded-lg">
                <UserOutlined className="text-lg" />
              </span>
            </div>
            <Statistic
              title={<span className="text-slate-700 text-xs">Unique Faculty</span>}
              value={reportData.uniqueUsers}
              valueStyle={{ color: '#475569', fontSize: 28, fontWeight: 700 }}
            />
          </div>
        </Col>
      </Row>

      {/* Charts and Details Row */}
      <Row gutter={[16, 16]}>
        {/* Pie Chart */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-2xl border-border shadow-none h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center gap-2 mb-4">
              <PieChartOutlined className="text-primary text-lg" />
              <Title level={5} className="!mb-0">Status Distribution</Title>
            </div>
            {reportData.statusDistribution.length > 0 ? (
              <DistributionPieChart
                data={reportData.statusDistribution}
                height={240}
              />
            ) : (
              <div className="flex items-center justify-center h-60">
                <Text type="secondary">No data available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Top Trainings */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-2xl border-border shadow-none h-full"
            styles={{ body: { padding: '20px' } }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrophyOutlined className="text-amber-500 text-lg" />
                <Title level={5} className="!mb-0">Popular Trainings</Title>
              </div>
              <Text type="secondary" className="text-xs">{reportData.topTrainings.length} trainings</Text>
            </div>
            {reportData.topTrainings.length > 0 ? (
              <List
                dataSource={reportData.topTrainings}
                renderItem={(item, index) => (
                  <List.Item className="!px-0 !py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 w-full">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-slate-100 text-slate-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text strong className="block text-sm truncate">{item.training?.title}</Text>
                        <Text type="secondary" className="text-xs">{item.training?.providedBy}</Text>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{item.count}</div>
                        <Text type="secondary" className="text-xs">applications</Text>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-60">
                <Text type="secondary">No training data</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Applications */}
      <Card
        className="rounded-2xl border-border shadow-none"
        styles={{ body: { padding: '20px' } }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-primary text-lg" />
            <Title level={5} className="!mb-0">Recent Applications</Title>
          </div>
          <Text type="secondary" className="text-xs">Last 5 applications</Text>
        </div>
        {reportData.recentApplications.length > 0 ? (
          <div className="space-y-3">
            {reportData.recentApplications.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors"
              >
                <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-600" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Text strong className="text-sm">{app.user?.name}</Text>
                    <Tag
                      color={STATUS_CONFIG[app.status]?.color}
                      className="!text-xs !px-1.5 !py-0"
                    >
                      {STATUS_CONFIG[app.status]?.label}
                    </Tag>
                  </div>
                  <Text type="secondary" className="text-xs truncate block">{app.training?.title}</Text>
                </div>
                <div className="text-right shrink-0">
                  <Text className="text-xs text-text-secondary">
                    {new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </div>
                <RightOutlined className="text-text-disabled text-xs" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <Text type="secondary">No recent applications</Text>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-violet-50 via-white to-blue-50 mb-6">
        <TrainingGreeting
          userName={user?.name}
          subtitle="Track faculty training applications and participation across your institution."
        />
      </Card>

      {/* Main Content */}
      <Card
        className="rounded-2xl border-border shadow-none"
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          defaultActiveKey="overview"
          className="training-tabs"
          tabBarStyle={{
            padding: '12px 20px 0',
            marginBottom: 0,
            borderBottom: '1px solid var(--color-border)',
          }}
          items={[
            {
              key: 'overview',
              label: (
                <span className="flex items-center gap-2 py-1">
                  <PieChartOutlined />
                  <span>Overview</span>
                </span>
              ),
              children: (
                <div className="p-5">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Row gutter={[16, 16]}>
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <Col xs={12} sm={6} key={idx}>
                            <TrainingStatSkeleton />
                          </Col>
                        ))}
                      </Row>
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={12}>
                          <Card className="rounded-2xl">
                            <Skeleton active paragraph={{ rows: 6 }} />
                          </Card>
                        </Col>
                        <Col xs={24} lg={12}>
                          <Card className="rounded-2xl">
                            <Skeleton active paragraph={{ rows: 6 }} />
                          </Card>
                        </Col>
                      </Row>
                    </div>
                  ) : reportData.totalApplications > 0 ? (
                    <OverviewContent />
                  ) : (
                    <TrainingEmptyState
                      type="default"
                      message="No applications yet"
                      description="Faculty training applications will appear here once submitted."
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'applications',
              label: (
                <span className="flex items-center gap-2 py-1">
                  <UnorderedListOutlined />
                  <span>All Applications</span>
                  {reportData.totalApplications > 0 && (
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {reportData.totalApplications}
                    </span>
                  )}
                </span>
              ),
              children: (
                <div className="p-5">
                  {isLoading ? (
                    <Skeleton active paragraph={{ rows: 10 }} />
                  ) : reportData.applications.length > 0 ? (
                    <Table
                      dataSource={reportData.applications}
                      rowKey="id"
                      columns={applicationColumns}
                      pagination={reportData.applications.length > 10 ? {
                        pageSize: 10,
                        size: 'small',
                        showSizeChanger: false,
                        showTotal: (total) => `${total} applications`,
                      } : false}
                      size="middle"
                      scroll={{ x: 700 }}
                      className="custom-table"
                    />
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
            {
              key: 'trainings',
              label: (
                <span className="flex items-center gap-2 py-1">
                  <BookOutlined />
                  <span>By Training</span>
                  {reportData.byTraining.length > 0 && (
                    <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full font-medium">
                      {reportData.byTraining.length}
                    </span>
                  )}
                </span>
              ),
              children: (
                <div className="p-5">
                  {isLoading ? (
                    <Skeleton active paragraph={{ rows: 8 }} />
                  ) : reportData.byTraining.length > 0 ? (
                    <Table
                      dataSource={reportData.byTraining}
                      rowKey={(record) => record.training?.id}
                      columns={trainingColumns}
                      pagination={reportData.byTraining.length > 8 ? {
                        pageSize: 8,
                        size: 'small',
                        showSizeChanger: false,
                        showTotal: (total) => `${total} trainings`,
                      } : false}
                      size="middle"
                      scroll={{ x: 600 }}
                      className="custom-table"
                    />
                  ) : (
                    <TrainingEmptyState
                      type="default"
                      message="No trainings"
                      description="No training participation data available."
                    />
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ParticipationReportPage;
