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
        <div className="flex items-center gap-2">
          <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-700" size="small" />
          <div>
            <Text strong className="block text-xs">{record.user?.name || 'N/A'}</Text>
            <Text type="secondary" className="text-[10px]">{record.user?.email}</Text>
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
          <Text strong className="block text-xs line-clamp-1">{record.training?.title || 'N/A'}</Text>
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
      width: 100,
      render: (status) => {
        const config = STATUS_CONFIG[status] || { color: 'default', label: status };
        return <Tag color={config.color} className="text-[10px] px-1.5 leading-normal" icon={config.icon}>{config.label}</Tag>;
      },
    },
    {
      title: 'Applied',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      width: 80,
      render: (date) => <Text className="text-[10px]">{date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</Text>,
    },
  ];

  const trainingColumns = [
    {
      title: 'Training',
      key: 'training',
      ellipsis: true,
      render: (_, record) => (
        <div>
          <Text strong className="block text-xs">{record.training?.title || 'N/A'}</Text>
          <Text type="secondary" className="text-[10px]">{record.training?.providedBy}</Text>
        </div>
      ),
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      align: 'center',
      render: (count) => (
        <span className="text-sm font-semibold text-primary">{count}</span>
      ),
    },
    {
      title: 'Share',
      key: 'share',
      width: 100,
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
    <div className="space-y-4">
      {/* Stats Row */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3 h-full border border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-blue-600 bg-blue-100 p-1.5 rounded-lg">
                <TeamOutlined className="text-base" />
              </span>
            </div>
            <Statistic
              title={<span className="text-blue-700 text-[10px] uppercase font-semibold">Total Apps</span>}
              value={reportData.totalApplications}
              valueStyle={{ color: '#1d4ed8', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3 h-full border border-emerald-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-600 bg-emerald-100 p-1.5 rounded-lg">
                <CheckCircleOutlined className="text-base" />
              </span>
            </div>
            <Statistic
              title={<span className="text-emerald-700 text-[10px] uppercase font-semibold">Approved</span>}
              value={reportData.byStatus.APPROVED || 0}
              valueStyle={{ color: '#059669', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3 h-full border border-amber-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-amber-600 bg-amber-100 p-1.5 rounded-lg">
                <ClockCircleOutlined className="text-base" />
              </span>
            </div>
            <Statistic
              title={<span className="text-amber-700 text-[10px] uppercase font-semibold">Pending</span>}
              value={reportData.byStatus.PENDING || 0}
              valueStyle={{ color: '#d97706', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
            />
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-3 h-full border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-600 bg-slate-100 p-1.5 rounded-lg">
                <UserOutlined className="text-base" />
              </span>
            </div>
            <Statistic
              title={<span className="text-slate-700 text-[10px] uppercase font-semibold">Faculty</span>}
              value={reportData.uniqueUsers}
              valueStyle={{ color: '#475569', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}
            />
          </div>
        </Col>
      </Row>

      {/* Charts and Details Row */}
      <Row gutter={[12, 12]}>
        {/* Pie Chart */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            styles={{ body: { padding: '16px' } }}
          >
            <div className="flex items-center gap-2 mb-3">
              <PieChartOutlined className="text-primary text-base" />
              <Title level={5} className="!mb-0 text-sm">Status Distribution</Title>
            </div>
            {reportData.statusDistribution.length > 0 ? (
              <DistributionPieChart
                data={reportData.statusDistribution}
                height={200}
              />
            ) : (
              <div className="flex items-center justify-center h-40">
                <Text type="secondary" className="text-xs">No data available</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Top Trainings */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            styles={{ body: { padding: '16px' } }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrophyOutlined className="text-amber-500 text-base" />
                <Title level={5} className="!mb-0 text-sm">Popular Trainings</Title>
              </div>
            </div>
            {reportData.topTrainings.length > 0 ? (
              <List
                dataSource={reportData.topTrainings}
                renderItem={(item, index) => (
                  <List.Item className="!px-0 !py-2 border-b border-slate-100 last:border-0">
                    <div className="flex items-center gap-2.5 w-full">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text strong className="block text-xs truncate">{item.training?.title}</Text>
                        <Text type="secondary" className="text-[10px]">{item.training?.providedBy}</Text>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">{item.count}</div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <div className="flex items-center justify-center h-40">
                <Text type="secondary" className="text-xs">No data</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Applications */}
      <Card
        className="rounded-xl border-border shadow-none"
        styles={{ body: { padding: '16px' } }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarOutlined className="text-primary text-base" />
            <Title level={5} className="!mb-0 text-sm">Recent Applications</Title>
          </div>
        </div>
        {reportData.recentApplications.length > 0 ? (
          <div className="space-y-2">
            {reportData.recentApplications.map((app) => (
              <div
                key={app.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors border border-transparent hover:border-slate-100"
              >
                <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-600" size="small" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Text strong className="text-xs">{app.user?.name}</Text>
                    <Tag
                      color={STATUS_CONFIG[app.status]?.color}
                      className="!text-[9px] !px-1.5 !py-0 leading-normal"
                    >
                      {STATUS_CONFIG[app.status]?.label}
                    </Tag>
                  </div>
                  <Text type="secondary" className="text-[10px] truncate block">{app.training?.title}</Text>
                </div>
                <div className="text-right shrink-0">
                  <Text className="text-[10px] text-text-secondary">
                    {new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <Text type="secondary" className="text-xs">No recent applications</Text>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <Card 
        className="rounded-xl border-border shadow-none bg-gradient-to-br from-violet-50 via-white to-blue-50 mb-4"
        styles={{ body: { padding: '16px' } }}
      >
        <TrainingGreeting
          userName={user?.name}
          subtitle="Track faculty training applications and participation across your institution."
        />
      </Card>

      {/* Main Content */}
      <Card
        className="rounded-xl border-border shadow-none"
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          defaultActiveKey="overview"
          className="training-tabs"
          tabBarStyle={{
            padding: '8px 16px 0',
            marginBottom: 0,
            borderBottom: '1px solid var(--color-border)',
          }}
          items={[
            {
              key: 'overview',
              label: (
                <span className="flex items-center gap-2 py-1 text-xs font-medium">
                  <PieChartOutlined />
                  <span>Overview</span>
                </span>
              ),
              children: (
                <div className="p-4">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Row gutter={[12, 12]}>
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <Col xs={12} sm={6} key={idx}>
                            <TrainingStatSkeleton />
                          </Col>
                        ))}
                      </Row>
                    </div>
                  ) : reportData.totalApplications > 0 ? (
                    <OverviewContent />
                  ) : (
                    <TrainingEmptyState
                      type="default"
                      message="No applications yet"
                      description="Data will appear here once submitted."
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'applications',
              label: (
                <span className="flex items-center gap-2 py-1 text-xs font-medium">
                  <UnorderedListOutlined />
                  <span>Applications</span>
                  {reportData.totalApplications > 0 && (
                    <Badge count={reportData.totalApplications} size="small" className="ml-1" />
                  )}
                </span>
              ),
              children: (
                <div className="p-4">
                  {isLoading ? (
                    <Skeleton active paragraph={{ rows: 10 }} />
                  ) : reportData.applications.length > 0 ? (
                    <div className="custom-scrollbar overflow-x-auto">
                      <Table
                        dataSource={reportData.applications}
                        rowKey="id"
                        columns={applicationColumns}
                        pagination={reportData.applications.length > 10 ? {
                          pageSize: 10,
                          size: 'small',
                          showSizeChanger: false,
                        } : false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                        className="custom-table"
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
            {
              key: 'trainings',
              label: (
                <span className="flex items-center gap-2 py-1 text-xs font-medium">
                  <BookOutlined />
                  <span>By Training</span>
                </span>
              ),
              children: (
                <div className="p-4">
                  {isLoading ? (
                    <Skeleton active paragraph={{ rows: 8 }} />
                  ) : reportData.byTraining.length > 0 ? (
                    <div className="custom-scrollbar overflow-x-auto">
                      <Table
                        dataSource={reportData.byTraining}
                        rowKey={(record) => record.training?.id}
                        columns={trainingColumns}
                        pagination={reportData.byTraining.length > 10 ? {
                          pageSize: 10,
                          size: 'small',
                        } : false}
                        size="small"
                        scroll={{ x: 'max-content' }}
                        className="custom-table"
                      />
                    </div>
                  ) : (
                    <TrainingEmptyState
                      type="default"
                      message="No trainings"
                      description="No participation data available."
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
