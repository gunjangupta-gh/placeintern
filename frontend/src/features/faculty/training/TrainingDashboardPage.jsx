import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Button, Card, Col, List, Row, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  BellOutlined,
  BookOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingStatCard from '../../../components/training/TrainingStatCard';
import TrainingBreadcrumb from '../../../components/training/TrainingBreadcrumb';
import { DashboardSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchUpcoming,
  fetchMyTrainings,
  fetchPendingFeedback,
  fetchAttendanceSummary,
  fetchMyApplications,
} from '../store/facultyTrainingSlice';

const { Title, Text } = Typography;

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { upcoming, myTrainings, feedback, attendance, applications } = useSelector(
    (state) => state.facultyTraining
  );

  useEffect(() => {
    dispatch(fetchUpcoming());
    dispatch(fetchMyTrainings());
    dispatch(fetchPendingFeedback());
    dispatch(fetchAttendanceSummary());
    dispatch(fetchMyApplications());
  }, [dispatch]);

  // Calculate stats with trends (mock trends for now - can be replaced with actual data)
  const stats = useMemo(() => {
    const upcomingCount = upcoming.list?.length || 0;
    const enrollmentCount = myTrainings.list?.length || 0;
    const pendingFeedbackCount = feedback.pending?.length || 0;
    const certificatesCount = attendance.summary?.certificatesEarned || 0;

    return [
      {
        title: 'Upcoming Trainings',
        value: upcomingCount,
        icon: CalendarOutlined,
        variant: 'primary',
        trend: upcomingCount > 0 ? 12 : 0,
        trendLabel: 'vs last month',
        onClick: () => navigate('/app/training/calendar'),
      },
      {
        title: 'My Enrollments',
        value: enrollmentCount,
        icon: CheckCircleOutlined,
        variant: 'success',
        subtitle: 'active',
        onClick: () => navigate('/app/training/applications'),
      },
      {
        title: 'Pending Feedback',
        value: pendingFeedbackCount,
        icon: FileTextOutlined,
        variant: 'warning',
        trendInverse: true,
        subtitle: pendingFeedbackCount > 0 ? 'action needed' : 'all done',
      },
      {
        title: 'Certificates Earned',
        value: certificatesCount,
        icon: SafetyCertificateOutlined,
        variant: 'purple',
        onClick: () => navigate('/app/training/certificates'),
      },
    ];
  }, [upcoming.list, myTrainings.list, feedback.pending, attendance.summary, navigate]);

  // Calculate progress toward training goal
  const trainingProgress = useMemo(() => {
    const goal = 5; // Training goal per year
    const completed = attendance.summary?.trainingsCompleted || 0;
    return Math.min(100, Math.round((completed / goal) * 100));
  }, [attendance.summary]);

  // Get pending applications
  const pendingApplications = useMemo(() => {
    return (applications.list || []).filter(
      (app) => ['PENDING', 'SUBMITTED'].includes(app.status)
    );
  }, [applications.list]);

  // Check for deadline reminders (trainings starting in next 48 hours)
  const upcomingReminders = useMemo(() => {
    const now = new Date();
    const twoDays = 48 * 60 * 60 * 1000;
    return (myTrainings.list || []).filter((training) => {
      const startDate = new Date(training.startDate);
      const diff = startDate - now;
      return diff > 0 && diff < twoDays;
    });
  }, [myTrainings.list]);

  const isLoading = upcoming.loading && myTrainings.loading && !upcoming.list;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-6 training-ui">

      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <TrainingGreeting
          userName={user?.name || user?.firstName}
          subtitle="Track your professional development, applications, and certifications."
        />
        <Button
          type="primary"
          icon={<CalendarOutlined />}
          size="large"
          onClick={() => navigate('/app/training/calendar')}
        >
          Browse Trainings
        </Button>
      </div>

      {/* Reminder Banner */}
      {upcomingReminders.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<BellOutlined />}
          className="mb-6 rounded-xl"
          message={
            <span className="font-medium">
              {upcomingReminders.length === 1
                ? 'Training starting soon!'
                : `${upcomingReminders.length} trainings starting soon!`}
            </span>
          }
          description={
            <div className="mt-1">
              {upcomingReminders.slice(0, 2).map((training) => (
                <div key={training.id} className="text-sm">
                  <strong>{training.title}</strong> starts{' '}
                  {new Date(training.startDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              ))}
            </div>
          }
          action={
            <Button size="small" onClick={() => navigate('/app/training/applications')}>
              View Details
            </Button>
          }
        />
      )}

      {/* Stats Grid */}
      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <TrainingStatCard {...stat} loading={upcoming.loading} />
          </Col>
        ))}
      </Row>

      {/* Progress Card */}
      {/* <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-indigo-50 via-white to-purple-50 mb-6">
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} lg={16}>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100">
                <BookOutlined className="text-2xl text-indigo-600" />
              </div>
              <div>
                <Title level={4} className="!mb-1">
                  Your Training Journey
                </Title>
                <Text className="text-text-secondary">
                  You've completed {attendance.summary?.trainingsCompleted || 0} of 5 trainings this year.
                  {trainingProgress >= 100
                    ? ' Amazing work!'
                    : ` ${5 - (attendance.summary?.trainingsCompleted || 0)} more to reach your goal.`}
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={8}>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <Text className="text-text-secondary">Progress</Text>
                  <Text className="font-semibold">{trainingProgress}%</Text>
                </div>
                <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                    style={{ width: `${trainingProgress}%` }}
                  />
                </div>
              </div>
              <Tooltip title="View certificates">
                <Button
                  type="text"
                  icon={<SafetyCertificateOutlined />}
                  onClick={() => navigate('/app/training/certificates')}
                />
              </Tooltip>
            </div>
          </Col>
        </Row>
      </Card> */}

      <Row gutter={[16, 16]}>
        {/* Upcoming Trainings */}
        <Col xs={24} lg={14}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            title={
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-blue-600" />
                <span>Upcoming Trainings</span>
              </div>
            }
            extra={
              <Link to="/app/training/calendar" className="text-primary flex items-center gap-1">
                View All <RightOutlined className="text-xs" />
              </Link>
            }
          >
            {upcoming.list?.length ? (
              <List
                dataSource={upcoming.list.slice(0, 5)}
                renderItem={(training) => (
                  <List.Item
                    className="hover:bg-gray-50 rounded-lg px-3 -mx-3"
                    style={{ padding: '12px' }}
                    actions={[
                      <Button
                        key="view"
                        type="link"
                        size="small"
                        onClick={() => navigate(`/app/training/${training.id}`)}
                      >
                        View
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<span className="font-medium">{training.title}</span>}
                      description={
                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          <TrainingDateRange
                            startDate={training.startDate}
                            endDate={training.endDate}
                            compact
                          />
                          <DeliveryModeBadge mode={training.deliveryMode} showIcon={false} />
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <TrainingEmptyState
                type="calendar"
                compact
                onAction={() => navigate('/app/training/calendar')}
              />
            )}
          </Card>
        </Col>

        {/* Pending Actions */}
        <Col xs={24} lg={10}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            title={
              <div className="flex items-center gap-2">
                <BellOutlined className="text-amber-600" />
                <span>Pending Actions</span>
                {(feedback.pending?.length > 0 || pendingApplications.length > 0) && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                    {(feedback.pending?.length || 0) + pendingApplications.length}
                  </span>
                )}
              </div>
            }
          >
            {feedback.pending?.length > 0 || pendingApplications.length > 0 ? (
              <div className="space-y-2">
                {/* Pending Feedback */}
                {feedback.pending?.slice(0, 3).map((item) => {
                  const trainingId = item.trainingId || item.training?.id || item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-lg bg-amber-50 hover:bg-amber-100 ${trainingId ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => trainingId && navigate(`/app/training/${trainingId}`)}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-200">
                        <FileTextOutlined className="text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text className="font-medium block truncate">
                          {item.title || item.trainingTitle || item.training?.title || 'Training Feedback'}
                        </Text>
                        <Text className="text-xs text-amber-700">Feedback required</Text>
                      </div>
                      {trainingId && (
                        <Button type="link" size="small">
                          Submit
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Pending Applications */}
                {pendingApplications.slice(0, 2).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    onClick={() => navigate('/app/training/applications')}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-200">
                      <ClockCircleOutlined className="text-blue-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text className="font-medium block truncate">
                        {app.training?.title || 'Training Application'}
                      </Text>
                      <Text className="text-xs text-blue-700">Awaiting approval</Text>
                    </div>
                    <ExclamationCircleOutlined className="text-blue-500" />
                  </div>
                ))}
              </div>
            ) : (
              <TrainingEmptyState type="feedback" compact />
            )}
          </Card>
        </Col>
      </Row>

      {/* Quick Links */}
      {/* <Card className="rounded-xl border-border shadow-none mt-6">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/app/training/calendar')}>
            <CalendarOutlined /> Training Calendar
          </Button>
          <Button onClick={() => navigate('/app/training/applications')}>
            <FileTextOutlined /> My Applications
          </Button>
          <Button onClick={() => navigate('/app/training/lesson-plans')}>
            <BookOutlined /> Lesson Plans
          </Button>
          <Button onClick={() => navigate('/app/training/certificates')}>
            <SafetyCertificateOutlined /> Certificates
          </Button>
        </div>
      </Card> */}
    </div>
  );
};

export default TrainingDashboardPage;
