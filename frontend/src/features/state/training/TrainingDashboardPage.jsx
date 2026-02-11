import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, List, Progress, Row, Space, Typography } from 'antd';
import {
  DashboardOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  PlusOutlined,
  RightOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  BarChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingStatusBadge from '../../../components/training/TrainingStatusBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, DashboardSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchStateTrainingDashboard, fetchStateTrainingUpcoming } from '../store/stateTrainingSlice';

const { Title, Text } = Typography;

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
      className={`rounded-2xl border-border shadow-none cursor-pointer hover:shadow-soft transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '16px' } }}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value}. ${subtitle || ''}${hasTrend ? ` Trend: ${isPositiveTrend ? 'up' : 'down'} ${Math.abs(trend)}%` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <Title level={4} className="!mb-0 !mt-0" style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</Title>
            {hasTrend && (
              <span className={`flex items-center text-xs font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
          <Icon className="text-lg" />
        </div>
      </div>
    </Card>
  );
};

const QuickAction = ({ icon: Icon, title, onClick }) => (
  <Button
    type="default"
    icon={<Icon />}
    onClick={onClick}
    className="flex items-center gap-2 h-auto py-3 px-4"
    block
    aria-label={title}
  >
    <span className="flex-1 text-left">{title}</span>
    <RightOutlined className="text-xs text-text-secondary" />
  </Button>
);

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reports } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchStateTrainingDashboard());
    dispatch(fetchStateTrainingUpcoming());
  }, [dispatch]);

  const isLoading = reports.loading && !reports.dashboard;
  const dashboard = reports.dashboard || {};

  const stats = [
    {
      title: 'Total Trainings',
      value: dashboard.totalTrainings || 0,
      subtitle: `${dashboard.publishedTrainings || 0} published`,
      icon: CalendarOutlined,
      tone: 'primary',
      trend: dashboard.trainingsTrend,
      onClick: () => navigate('/app/training/manage'),
    },
    {
      title: 'Applications',
      value: dashboard.totalApplications || 0,
      subtitle: `${dashboard.pendingApplications || 0} pending`,
      icon: FileTextOutlined,
      tone: 'warning',
      trend: dashboard.applicationsTrend,
      onClick: () => navigate('/app/training/manage'),
    },
    {
      title: 'Participants',
      value: dashboard.totalParticipants || 0,
      subtitle: 'Enrolled faculty',
      icon: TeamOutlined,
      tone: 'success',
      trend: dashboard.participantsTrend,
      onClick: () => navigate('/app/training/reports'),
    },
    {
      title: 'Certificates',
      value: dashboard.totalCertificates || 0,
      subtitle: 'Issued to date',
      icon: SafetyCertificateOutlined,
      tone: 'secondary',
      trend: dashboard.certificatesTrend,
      onClick: () => navigate('/app/training/reports'),
    },
  ];

  const quickActions = [
    { icon: PlusOutlined, title: 'Create New Training', onClick: () => navigate('/app/training/create') },
    { icon: SettingOutlined, title: 'Manage Trainings', onClick: () => navigate('/app/training/manage') },
    { icon: FileTextOutlined, title: 'Feedback Forms', onClick: () => navigate('/app/training/feedback-forms') },
    { icon: BarChartOutlined, title: 'View Reports', onClick: () => navigate('/app/training/reports') },
  ];

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-6 training-ui" role="main" aria-label="Training Dashboard">
      {/* <PageHeader
        icon={DashboardOutlined}
        title={<span className="training-heading">Training Dashboard</span>}
        description="Statewide overview of faculty training programs and participation."
        actions={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/app/training/create')}
            aria-label="Create new training"
          >
            Create Training
          </Button>,
        ]}
      /> */}

      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-blue-50 via-white to-amber-50 mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <TrainingGreeting
              userName={user?.name}
              subtitle="Monitor participation, applications, and certifications at a glance."
            />
          </Col>
          <Col xs={24} lg={8} className="lg:text-right">
            <Button type="default" onClick={() => navigate('/app/training/manage')} aria-label="Go to manage trainings">
              Manage Trainings
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Training statistics">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            className="rounded-xl border-border shadow-none"
            title={
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-blue-700" />
                Upcoming Trainings
              </div>
            }
            extra={
              <Link to="/app/training/manage" className="text-primary flex items-center gap-1" aria-label="View all trainings">
                View All <RightOutlined className="text-xs" />
              </Link>
            }
          >
            {reports.upcoming?.length ? (
              <List
                dataSource={reports.upcoming.slice(0, 5)}
                renderItem={(training) => (
                  <List.Item
                    className="hover:bg-gray-50 rounded-lg px-3 py-2! -mx-3 transition-colors"
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        onClick={() => navigate(`/app/training/${training.id}`)}
                        aria-label={`View ${training.title}`}
                      >
                        View
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{training.title}</span>
                          <TrainingStatusBadge status={training.isPublished ? 'PUBLISHED' : 'DRAFT'} showIcon={false} />
                        </div>
                      }
                      description={
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <TrainingDateRange
                            startDate={training.startDate}
                            endDate={training.endDate}
                            compact
                          />
                          <DeliveryModeBadge mode={training.deliveryMode} showIcon={false} />
                          {training.capacity && (
                            <Text type="secondary" className="text-xs">
                              <TeamOutlined /> {training.availableSeats || training.capacity}/{training.capacity}
                            </Text>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <TrainingEmptyState
                type="calendar"
                message="No upcoming trainings"
                description="Create your first training to get started."
                actionText="Create Training"
                onAction={() => navigate('/app/training/create')}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            title={
              <div className="flex items-center gap-2">
                <CheckCircleOutlined className="text-success-700" />
                Quick Actions
              </div>
            }
          >
            <Space direction="vertical" className="w-full" size="middle" role="navigation" aria-label="Quick actions">
              {quickActions.map((action) => (
                <QuickAction key={action.title} {...action} />
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {dashboard.recentActivity?.length > 0 && (
        <Card
          className="rounded-xl border-border shadow-none mt-6"
          title="Recent Activity"
          role="region"
          aria-label="Recent activity"
        >
          <List
            dataSource={dashboard.recentActivity.slice(0, 5)}
            renderItem={(activity) => (
              <List.Item className="px-3! py-2!">
                <List.Item.Meta
                  title={activity.description}
                  description={new Date(activity.createdAt).toLocaleString()}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* Quick Links */}
      {/* <Card className="rounded-xl border-border shadow-none mt-6" role="navigation" aria-label="Quick links">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/app/training/create')} aria-label="Create new training">
            <PlusOutlined /> Create Training
          </Button>
          <Button onClick={() => navigate('/app/training/manage')} aria-label="Manage trainings">
            <SettingOutlined /> Manage Trainings
          </Button>
          <Button onClick={() => navigate('/app/training/feedback-forms')} aria-label="Manage feedback forms">
            <FileTextOutlined /> Feedback Forms
          </Button>
          <Button onClick={() => navigate('/app/training/lesson-plans')} aria-label="Review lesson plans">
            <BookOutlined /> Lesson Plans
          </Button>
          <Button onClick={() => navigate('/app/training/reports')} aria-label="View reports">
            <BarChartOutlined /> Reports
          </Button>
        </div>
      </Card> */}
    </div>
  );
};

export default TrainingDashboardPage;
