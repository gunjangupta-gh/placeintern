import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, List, Progress, Row, Space, Statistic, Typography } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  TeamOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FormOutlined,
  SolutionOutlined,
  BarChartOutlined,
  BookOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { fetchStateTrainingDashboard, fetchStateTrainingUpcoming } from '../store/stateTrainingSlice';

const { Title, Text } = Typography;

const QuickAccessCard = ({ icon: Icon, title, description, color, bgColor, onClick }) => (
  <div
    className={`flex items-center gap-3 p-4 rounded-xl ${bgColor} hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-slate-200`}
    onClick={onClick}
  >
    <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color}`}>
      <Icon className="text-lg text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <Text className="font-medium block text-sm">{title}</Text>
      <Text className="text-xs text-slate-500">{description}</Text>
    </div>
    <RightOutlined className="text-slate-400 text-xs" />
  </div>
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

  const dashboard = reports.dashboard || {};
  const upcomingTrainings = reports.upcoming || [];

  // Extract data from API response structure
  const trainings = dashboard.trainings || {};
  const applications = dashboard.applications || {};
  const attendance = dashboard.attendance || {};
  const feedback = dashboard.feedback || {};
  const lessonPlans = dashboard.lessonPlans || {};

  const stats = useMemo(() => [
    {
      title: 'Total Trainings',
      value: trainings.total || 0,
      icon: CalendarOutlined,
      color: '#2563eb',
      subtitle: `${trainings.published || 0} published`,
    },
    {
      title: 'Ongoing',
      value: trainings.ongoing || 0,
      icon: ClockCircleOutlined,
      color: '#059669',
      subtitle: `${trainings.upcoming || 0} upcoming`,
    },
    {
      title: 'Applications',
      value: applications.total || 0,
      icon: FileTextOutlined,
      color: '#d97706',
      subtitle: `${applications.approved || 0} approved`,
    },
    {
      title: 'Attendance',
      value: attendance.total || 0,
      icon: CheckCircleOutlined,
      color: '#7c3aed',
      subtitle: 'records',
    },
  ], [trainings, applications, attendance]);

  const quickAccessItems = [
    {
      icon: TeamOutlined,
      title: 'View Attendance',
      description: `${attendance.total || 0} total records`,
      color: 'bg-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/app/training/manage'),
    },
    {
      icon: FileTextOutlined,
      title: 'Feedback Forms',
      description: `${feedback.total || 0} responses collected`,
      color: 'bg-amber-600',
      bgColor: 'bg-amber-50',
      onClick: () => navigate('/app/training/feedback-forms'),
    },
    {
      icon: FormOutlined,
      title: 'Pre-Test Forms',
      description: 'Manage pre-assessments',
      color: 'bg-purple-600',
      bgColor: 'bg-purple-50',
      onClick: () => navigate('/app/training/test-forms'),
    },
    {
      icon: SolutionOutlined,
      title: 'Post-Test Forms',
      description: 'Manage post-assessments',
      color: 'bg-green-600',
      bgColor: 'bg-green-50',
      onClick: () => navigate('/app/training/test-forms'),
    },
    {
      icon: BookOutlined,
      title: 'Lesson Plans',
      description: `${lessonPlans.total || 0} submitted`,
      color: 'bg-indigo-600',
      bgColor: 'bg-indigo-50',
      onClick: () => navigate('/app/training/manage'),
    },
    {
      icon: BarChartOutlined,
      title: 'Applications',
      description: `${Math.round(applications.approvalRate || 0)}% approval rate`,
      color: 'bg-rose-600',
      bgColor: 'bg-rose-50',
      onClick: () => navigate('/app/training/manage'),
    },
  ];

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <Title level={2} className="!mb-1">
            Training Dashboard
          </Title>
          <Text type="secondary" className="text-sm">
            Welcome back, {user?.name}! Monitor trainings and participation at a glance.
          </Text>
        </div>
        <Space>
          <Button onClick={() => navigate('/app/training/manage')}>
            <SettingOutlined /> Manage
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/training/create')}>
            Create Training
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat) => (
          <Col xs={12} sm={12} lg={6} key={stat.title}>
            <Card className="rounded-xl border-border shadow-none hover:shadow-md transition-shadow">
              <Statistic
                title={<Text className="text-xs text-slate-600">{stat.title}</Text>}
                value={stat.value}
                prefix={<stat.icon style={{ color: stat.color }} />}
                valueStyle={{ fontSize: 24, fontWeight: 700, color: stat.color }}
                suffix={
                  stat.subtitle && (
                    <Text className="text-xs text-slate-400 ml-1">{stat.subtitle}</Text>
                  )
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Progress Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12}>
          <Card className="rounded-xl border-border shadow-none">
            <div className="flex items-center justify-between mb-2">
              <Text className="text-sm font-medium">Application Approval Rate</Text>
              <Text className="text-lg font-bold text-blue-600">
                {Math.round(applications.approvalRate || 0)}%
              </Text>
            </div>
            <Progress
              percent={Math.round(applications.approvalRate || 0)}
              showInfo={false}
              strokeColor="#2563eb"
              trailColor="#e2e8f0"
            />
            <Text className="text-xs text-slate-500 mt-2 block">
              {applications.approved || 0} of {applications.total || 0} applications approved
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card className="rounded-xl border-border shadow-none">
            <div className="flex items-center justify-between mb-2">
              <Text className="text-sm font-medium">Lesson Plan Approval Rate</Text>
              <Text className="text-lg font-bold text-green-600">
                {Math.round(lessonPlans.approvalRate || 0)}%
              </Text>
            </div>
            <Progress
              percent={Math.round(lessonPlans.approvalRate || 0)}
              showInfo={false}
              strokeColor="#059669"
              trailColor="#e2e8f0"
            />
            <Text className="text-xs text-slate-500 mt-2 block">
              {lessonPlans.approved || 0} of {lessonPlans.total || 0} lesson plans approved
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Quick Access */}
        <Col xs={24} lg={10}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            title={
              <div className="flex items-center gap-2">
                <EyeOutlined className="text-blue-600" />
                <span>Quick Access</span>
              </div>
            }
          >
            <div className="space-y-3">
              {quickAccessItems.map((item, index) => (
                <QuickAccessCard key={index} {...item} />
              ))}
            </div>
          </Card>
        </Col>

        {/* Upcoming Trainings */}
        <Col xs={24} lg={14}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            title={
              <div className="flex items-center gap-2">
                <CalendarOutlined className="text-blue-600" />
                <span>Upcoming Trainings</span>
                {upcomingTrainings.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
                    {upcomingTrainings.length}
                  </span>
                )}
              </div>
            }
            extra={
              <Button type="link" onClick={() => navigate('/app/training/manage')} className="flex items-center gap-1">
                View All <RightOutlined className="text-xs" />
              </Button>
            }
          >
            {upcomingTrainings.length > 0 ? (
              <List
                dataSource={upcomingTrainings.slice(0, 5)}
                renderItem={(training) => (
                  <List.Item
                    className="hover:bg-slate-50 rounded-lg px-3 transition-colors cursor-pointer"
                    onClick={() => navigate(`/app/training/${training.id}`)}
                  >
                    <List.Item.Meta
                      title={<span className="font-medium text-sm">{training.title}</span>}
                      description={
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <TrainingDateRange
                            startDate={training.startDate}
                            endDate={training.endDate}
                            compact
                          />
                          <DeliveryModeBadge mode={training.deliveryMode} />
                          {training.capacity && (
                            <Text type="secondary" className="text-xs">
                              <TeamOutlined /> {training._count?.applications || 0}/{training.capacity}
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
                compact
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDashboardPage;
