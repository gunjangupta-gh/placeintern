import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Col, Input, Row, Typography, Skeleton, List, Empty, Grid, Table, Progress, Tabs } from 'antd';
import {
  BarChartOutlined,
  FormOutlined,
  MessageOutlined,
  FileTextOutlined,
  SearchOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { DistributionPieChart } from '../../../components/training/TrainingCharts';
import { fetchStateTrainings, fetchStateFeedbackStats } from '../store/stateTrainingSlice';
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

const FeedbackAnalyticsPage = () => {
  const dispatch = useDispatch();
  const screens = useBreakpoint();
  const { trainings, feedbackStats } = useSelector((state) => state.stateTraining);
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
    // Fetch feedback stats for selected training
    dispatch(fetchStateFeedbackStats({ trainingId: training.id }));
    // On mobile, scroll to details
    if (!screens.md) {
      setTimeout(() => {
        const element = document.getElementById('feedback-details-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const isLoading = feedbackStats.loading && !feedbackStats.data;
  const isTrainingsLoading = trainings.loading && trainings.list.length === 0;

  // Process data for display - API returns { totalResponses, byForm }
  const chartData = useMemo(() => {
    const data = feedbackStats.data || {};

    // Forms distribution for pie chart
    const formsDistribution = (data.byForm || []).map((form) => ({
      name: form.formTitle || 'Unknown Form',
      value: form.count || 0,
    }));

    // Total responses across all forms
    const totalResponses = data.totalResponses || 0;
    const totalForms = (data.byForm || []).length;

    return {
      formsDistribution,
      byForm: data.byForm || [],
      summary: {
        totalResponses,
        totalForms,
      },
    };
  }, [feedbackStats.data]);

  const stats = [
    {
      title: 'Total Responses',
      value: chartData.summary.totalResponses,
      icon: MessageOutlined,
      tone: 'primary',
    },
    {
      title: 'Feedback Forms',
      value: chartData.summary.totalForms,
      subtitle: 'with responses',
      icon: FormOutlined,
      tone: 'success',
    },
  ];

  return (
    <div className="p-6 training-ui" role="main" aria-label="Feedback Analytics">
      {/* <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-green-50 via-white to-blue-50 mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <TrainingGreeting
              userName={user?.name}
              subtitle="Review feedback patterns and insights to improve training quality."
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

        {/* Feedback Analytics Details - Right Panel */}
        <Col xs={24} sm={24} md={16} id="feedback-details-section">
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
                            <Col xs={12}><TrainingStatSkeleton /></Col>
                            <Col xs={12}><TrainingStatSkeleton /></Col>
                          </Row>
                          <Skeleton active paragraph={{ rows: 8 }} />
                        </div>
                      ) : feedbackStats.data && chartData.summary.totalResponses > 0 ? (
                        <div className="space-y-4">
                          <Row gutter={[16, 16]} role="region" aria-label="Feedback statistics">
                            {stats.map((stat) => (
                              <Col xs={12} key={stat.title}>
                                <StatCard {...stat} />
                              </Col>
                            ))}
                          </Row>
                          {chartData.formsDistribution.length > 0 && (
                            <DistributionPieChart
                              data={chartData.formsDistribution}
                              title="Responses by Form"
                              height={280}
                            />
                          )}
                        </div>
                      ) : (
                        <TrainingEmptyState
                          type="feedback"
                          message="No feedback data yet"
                          description="Feedback analytics will appear here once responses are collected."
                        />
                      ),
                    },
                    {
                      key: 'details',
                      label: (
                        <span className="flex items-center gap-2">
                          <UnorderedListOutlined />
                          Form Details
                          {chartData.byForm.length > 0 && (
                            <span className="bg-primary/10 text-primary text-xs px-1.5 py-0.5 rounded-full">
                              {chartData.byForm.length}
                            </span>
                          )}
                        </span>
                      ),
                      children: isLoading ? (
                        <Skeleton active paragraph={{ rows: 8 }} />
                      ) : chartData.byForm.length > 0 ? (
                        <Table
                          dataSource={chartData.byForm}
                          rowKey="formId"
                          pagination={chartData.byForm.length > 8 ? {
                            pageSize: 8,
                            size: 'small',
                            showSizeChanger: false,
                            showTotal: (total) => `${total} forms`,
                          } : false}
                          size="small"
                          scroll={{ x: 400 }}
                          columns={[
                            {
                              title: 'Form Name',
                              dataIndex: 'formTitle',
                              key: 'formTitle',
                              ellipsis: true,
                              render: (text) => <Text strong className="text-sm">{text}</Text>,
                            },
                            {
                              title: 'Responses',
                              dataIndex: 'count',
                              key: 'count',
                              width: 100,
                              align: 'center',
                              sorter: (a, b) => a.count - b.count,
                              defaultSortOrder: 'descend',
                              render: (count) => (
                                <span className="text-base font-semibold text-primary">{count}</span>
                              ),
                            },
                            {
                              title: 'Share',
                              key: 'share',
                              width: 120,
                              render: (_, record) => {
                                const percentage = chartData.summary.totalResponses > 0
                                  ? Math.round((record.count / chartData.summary.totalResponses) * 100)
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
                          ]}
                        />
                      ) : (
                        <TrainingEmptyState
                          type="feedback"
                          message="No form data"
                          description="No feedback forms have responses yet."
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
                  Choose a training from the list to view detailed feedback analytics and insights.
                </Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default FeedbackAnalyticsPage;
