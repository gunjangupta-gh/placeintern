import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Col, Input, Row, Typography, Skeleton, List, Empty, Grid, Table, Progress, Tabs } from 'antd';
import {
  BarChartOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  BankOutlined,
  SearchOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { DistributionPieChart, ParticipationBarChart } from '../../../components/training/TrainingCharts';
import { fetchStateTrainings, fetchStateAttendanceReport } from '../store/stateTrainingSlice';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingStatusBadge from '../../../components/training/TrainingStatusBadge';

const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
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

const TrainingReportsPage = () => {
  const dispatch = useDispatch();
  const screens = useBreakpoint();
  const { trainings, reports } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);

  const [search, setSearch] = useState('');
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Fetch trainings on mount
  useEffect(() => {
    dispatch(fetchStateTrainings());
  }, [dispatch]);

  // Filter trainings based on search
  const filteredTrainings = useMemo(() => {
    if (!trainings.list) return [];
    if (!search.trim()) return trainings.list;
    const searchLower = search.toLowerCase();
    return trainings.list.filter(
      (training) =>
        training.title?.toLowerCase().includes(searchLower) ||
        training.deliveryMode?.toLowerCase().includes(searchLower) ||
        training.status?.toLowerCase().includes(searchLower)
    );
  }, [trainings.list, search]);

  // Auto-select first training on desktop when list loads
  useEffect(() => {
    if (filteredTrainings.length > 0 && !selectedTraining && screens.md) {
      handleTrainingSelect(filteredTrainings[0]);
    }
  }, [filteredTrainings, screens.md]);

  const handleTrainingSelect = (training) => {
    setSelectedTraining(training);
    // Fetch attendance report for selected training
    dispatch(fetchStateAttendanceReport({ trainingId: training.id }));
    // On mobile, scroll to details
    if (!screens.md) {
      setTimeout(() => {
        const element = document.getElementById('reports-details-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const isLoading = reports.loading && !reports.attendance;
  const isTrainingsLoading = trainings.loading && trainings.list.length === 0;

  // Process data for display - API returns { total, uniqueUsers, byInstitution }
  const chartData = useMemo(() => {
    const data = reports.attendance || {};

    // Institution-wise distribution for pie chart
    const institutionDistribution = (data.byInstitution || []).map((item) => ({
      name: item.institution?.shortName || item.institution?.name || 'Unknown',
      value: item.totalRecords || 0,
      fullName: item.institution?.name,
      uniqueUsers: item.uniqueUsers || 0,
    }));

    // Total attendance records
    const totalRecords = data.total || 0;
    const uniqueUsers = data.uniqueUsers || 0;
    const totalInstitutions = (data.byInstitution || []).length;

    return {
      institutionDistribution,
      byInstitution: data.byInstitution || [],
      summary: {
        totalRecords,
        uniqueUsers,
        totalInstitutions,
      },
    };
  }, [reports.attendance]);

  const stats = [
    {
      title: 'Total Records',
      value: chartData.summary.totalRecords,
      subtitle: 'attendance marked',
      icon: CheckCircleOutlined,
      tone: 'primary',
    },
    {
      title: 'Unique Participants',
      value: chartData.summary.uniqueUsers,
      icon: TeamOutlined,
      tone: 'success',
    },
    {
      title: 'Institutions',
      value: chartData.summary.totalInstitutions,
      subtitle: 'participated',
      icon: BankOutlined,
      tone: 'warning',
    },
  ];

  return (
    <div className="p-6 training-ui" role="main" aria-label="Training Reports">
      {/* <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-blue-50 via-white to-purple-50 mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <TrainingGreeting
              userName={user?.name}
              subtitle="View comprehensive training metrics and generate detailed reports."
            />
          </Col>
        </Row>
      </Card> */}

      <Row gutter={[16, 16]}>
        {/* Training List - Left Panel */}
        <Col xs={24} sm={24} md={8}>
          <Card
            title={
              <div className="flex items-center text-primary">
                <BarChartOutlined className="mr-2" />
                <span>Trainings</span>
                <Text type="secondary" className="ml-auto text-xs">
                  {filteredTrainings.length} trainings
                </Text>
              </div>
            }
            bordered={false}
            style={{
              borderRadius: 16,
              height: screens.md ? 'calc(100vh - 120px)' : '50vh',
              minHeight: 400,
              display: 'flex',
              flexDirection: 'column',
            }}
            styles={{
              body: { padding: 0, overflowY: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' },
              header: { borderBottom: '1px solid var(--color-border)' },
            }}
            aria-label="Training list panel"
          >
            <div className="p-3 border-b border-border">
              <Input
                placeholder="Search trainings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined className="text-text-disabled" />}
                allowClear
                aria-label="Search trainings"
              />
            </div>

            <div className="overflow-y-auto p-2 flex-1">
              {isTrainingsLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ) : filteredTrainings.length === 0 ? (
                <Empty description="No trainings found" className="py-8" />
              ) : (
                <List
                  itemLayout="vertical"
                  dataSource={filteredTrainings}
                  locale={{ emptyText: 'No trainings found' }}
                  renderItem={(training) => (
                    <List.Item
                      onClick={() => handleTrainingSelect(training)}
                      className="cursor-pointer my-1 px-3 py-2 rounded-lg transition-none"
                      style={{
                        backgroundColor: selectedTraining?.id === training.id ? 'var(--ant-color-primary-bg)' : 'transparent',
                        borderLeft: `4px solid ${selectedTraining?.id === training.id ? 'var(--ant-color-primary)' : 'transparent'}`,
                      }}
                      aria-selected={selectedTraining?.id === training.id}
                      aria-label={`Training: ${training.title}`}
                      role="option"
                    >
                      <div className="flex flex-col gap-1">
                        <Text strong className="text-sm line-clamp-1">
                          {training.title}
                        </Text>
                        <TrainingDateRange
                          startDate={training.startDate}
                          endDate={training.endDate}
                          compact
                          showIcon
                        />
                        <div className="flex gap-1 flex-wrap mt-1">
                          <DeliveryModeBadge mode={training.deliveryMode} showIcon={false} />
                          <TrainingStatusBadge status={training.status} showIcon={false} />
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Training Reports Details - Right Panel */}
        <Col xs={24} sm={24} md={16} id="reports-details-section">
          {selectedTraining ? (
            <div className="flex flex-col gap-4">
              <Card className="rounded-2xl border-border shadow-none">
                <Title level={4} className="mb-0">{selectedTraining.title}</Title>
                <div className="flex gap-2 mt-2">
                  <DeliveryModeBadge mode={selectedTraining.deliveryMode} />
                  <TrainingStatusBadge status={selectedTraining.status} />
                </div>
                <TrainingDateRange
                  startDate={selectedTraining.startDate}
                  endDate={selectedTraining.endDate}
                  showIcon
                />
              </Card>

              <Card className="rounded-2xl border-border shadow-none">
                <Tabs
                  defaultActiveKey="overview"
                  items={[
                    {
                      key: 'overview',
                      label: (
                        <span className="flex items-center gap-2">
                          <PieChartOutlined />
                          Overview
                        </span>
                      ),
                      children: isLoading ? (
                        <div className="space-y-4">
                          <Row gutter={[16, 16]}>
                            <Col xs={8}><TrainingStatSkeleton /></Col>
                            <Col xs={8}><TrainingStatSkeleton /></Col>
                            <Col xs={8}><TrainingStatSkeleton /></Col>
                          </Row>
                          <Skeleton active paragraph={{ rows: 8 }} />
                        </div>
                      ) : reports.attendance && chartData.summary.totalRecords > 0 ? (
                        <div className="space-y-4">
                          <Row gutter={[16, 16]} role="region" aria-label="Report statistics">
                            {stats.map((stat) => (
                              <Col xs={8} key={stat.title}>
                                <StatCard {...stat} />
                              </Col>
                            ))}
                          </Row>
                          {chartData.institutionDistribution.length > 0 && (
                            <DistributionPieChart
                              data={chartData.institutionDistribution.slice(0, 8)}
                              title="Top Institutions by Attendance"
                              height={280}
                            />
                          )}
                        </div>
                      ) : (
                        <TrainingEmptyState
                          type="default"
                          message="No attendance data yet"
                          description="Attendance records will appear here once attendance is marked for this training."
                        />
                      ),
                    },
                    {
                      key: 'institutions',
                      label: (
                        <span className="flex items-center gap-2">
                          <UnorderedListOutlined />
                          Institutions
                          {chartData.byInstitution.length > 0 && (
                            <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                              {chartData.byInstitution.length}
                            </span>
                          )}
                        </span>
                      ),
                      children: isLoading ? (
                        <Skeleton active paragraph={{ rows: 8 }} />
                      ) : chartData.byInstitution.length > 0 ? (
                        <Table
                          dataSource={chartData.byInstitution}
                          rowKey={(record) => record.institution?.id || Math.random()}
                          pagination={chartData.byInstitution.length > 8 ? {
                            pageSize: 8,
                            size: 'small',
                            showSizeChanger: false,
                            showTotal: (total) => `${total} institutions`,
                          } : false}
                          size="small"
                          scroll={{ x: 450 }}
                          columns={[
                            {
                              title: 'Institution',
                              key: 'institution',
                              ellipsis: true,
                              render: (_, record) => (
                                <div className="py-1">
                                  <Text strong className="block text-sm">{record.institution?.shortName || 'N/A'}</Text>
                                  <Text type="secondary" className="text-xs line-clamp-1">{record.institution?.name}</Text>
                                </div>
                              ),
                            },
                            {
                              title: 'Records',
                              dataIndex: 'totalRecords',
                              key: 'totalRecords',
                              width: 80,
                              align: 'center',
                              sorter: (a, b) => a.totalRecords - b.totalRecords,
                              defaultSortOrder: 'descend',
                              render: (count) => (
                                <span className="text-base font-semibold text-primary">{count}</span>
                              ),
                            },
                            {
                              title: 'Users',
                              dataIndex: 'uniqueUsers',
                              key: 'uniqueUsers',
                              width: 70,
                              align: 'center',
                              sorter: (a, b) => a.uniqueUsers - b.uniqueUsers,
                              render: (count) => (
                                <span className="text-sm">{count}</span>
                              ),
                            },
                            {
                              title: 'Share',
                              key: 'share',
                              width: 110,
                              render: (_, record) => {
                                const percentage = chartData.summary.totalRecords > 0
                                  ? Math.round((record.totalRecords / chartData.summary.totalRecords) * 100)
                                  : 0;
                                return (
                                  <Progress
                                    percent={percentage}
                                    size="small"
                                    strokeColor="#10B981"
                                    format={(p) => `${p}%`}
                                  />
                                );
                              },
                            },
                          ]}
                        />
                      ) : (
                        <TrainingEmptyState
                          type="default"
                          message="No institution data"
                          description="No institutions have attendance records yet."
                        />
                      ),
                    },
                    {
                      key: 'chart',
                      label: (
                        <span className="flex items-center gap-2">
                          <BarChartOutlined />
                          Chart
                        </span>
                      ),
                      children: isLoading ? (
                        <Skeleton active paragraph={{ rows: 8 }} />
                      ) : chartData.institutionDistribution.length > 1 ? (
                        <ParticipationBarChart
                          data={chartData.institutionDistribution.slice(0, 10).map((item) => ({
                            name: item.name,
                            value: item.value,
                          }))}
                          title={`Attendance by Institution ${chartData.institutionDistribution.length > 10 ? '(Top 10)' : ''}`}
                          height={Math.min(350, 80 + chartData.institutionDistribution.slice(0, 10).length * 35)}
                        />
                      ) : (
                        <TrainingEmptyState
                          type="default"
                          message="Not enough data"
                          description="Chart requires attendance from multiple institutions."
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </div>
          ) : (
            <Card
              style={{
                height: screens.md ? 'calc(100vh - 120px)' : '50vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                border: '1px dashed var(--color-border)',
              }}
              aria-label="No training selected"
            >
              <div className="text-center max-w-md">
                <BarChartOutlined className="text-5xl text-text-disabled mb-4" />
                <Title level={4} className="text-text-secondary">Select a Training</Title>
                <Text type="secondary">
                  Choose a training from the list to view detailed attendance reports and metrics.
                </Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default TrainingReportsPage;
