import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Button, Card, Col, List, Row, Typography, message } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  SolutionOutlined,
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
  markSelfAttendance,
  fetchPendingTests,
} from '../store/facultyTrainingSlice';

const { Title, Text } = Typography;

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [markingTrainingId, setMarkingTrainingId] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const { upcoming, myTrainings, feedback, attendance, applications, pendingTests } = useSelector(
    (state) => state.facultyTraining
  );

  useEffect(() => {
    dispatch(fetchUpcoming());
    dispatch(fetchMyTrainings());
    dispatch(fetchPendingFeedback());
    dispatch(fetchAttendanceSummary());
    dispatch(fetchMyApplications());
    dispatch(fetchPendingTests());
  }, [dispatch]);

  // Calculate stats with trends (mock trends for now - can be replaced with actual data)
  const pendingTestsList = useMemo(() => {
    return Array.isArray(pendingTests?.list) ? pendingTests.list : [];
  }, [pendingTests?.list]);

  const pendingTestCount = useMemo(() => {
    return pendingTestsList.length;
  }, [pendingTestsList]);

  const stats = useMemo(() => {
    const upcomingCount = upcoming.list?.length || 0;
    const enrollmentCount = myTrainings.list?.length || 0;
    const pendingFeedbackCount = feedback.pending?.length || 0;
    const totalPendingActions = pendingFeedbackCount + pendingTestCount;
    const certificatesCount = attendance.summary?.certificatesEarned || 0;

    return [
      {
        title: 'Upcoming Trainings',
        value: upcomingCount,
        icon: CalendarOutlined,
        variant: 'primary',
        // trend: upcomingCount > 0 ? 12 : 0,
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
        title: 'Pending Actions',
        value: totalPendingActions,
        icon: FileTextOutlined,
        variant: 'warning',
        trendInverse: true,
        subtitle: totalPendingActions > 0 ? 'action needed' : 'all done',
      },
    ];
  }, [upcoming.list, myTrainings.list, feedback.pending, attendance.summary, pendingTestCount, navigate]);

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

  const todaysAttendanceApplications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (applications.list || []).filter((app) => {
      if (app.status !== 'APPROVED') return false;
      const training = app.training;
      if (!training?.startDate || !training?.endDate) return false;

      const startDate = new Date(training.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(training.endDate);
      endDate.setHours(23, 59, 59, 999);

      return today >= startDate && today <= endDate;
    });
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

  const captureLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          resolve({ latitude, longitude });
        },
        (error) => {
          if (error.code === 1) {
            reject(new Error('Location access denied. Please enable location permissions.'));
          } else if (error.code === 2) {
            reject(new Error('Unable to determine your location. Please try again.'));
          } else if (error.code === 3) {
            reject(new Error('Location request timed out. Please try again.'));
          } else {
            reject(new Error('Failed to get your location.'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  };

  const handleQuickAttendance = async (application) => {
    const trainingId = application.trainingId || application.training?.id;
    if (!trainingId) return;

    try {
      setMarkingTrainingId(trainingId);
      const { latitude, longitude } = await captureLocation();

      await dispatch(
        markSelfAttendance({
          trainingId,
          latitude,
          longitude,
        })
      ).unwrap();

      message.success('Attendance marked successfully!');
      dispatch(fetchMyApplications({ forceRefresh: true }));
      dispatch(fetchAttendanceSummary());
    } catch (error) {
      message.error(error || 'Failed to mark attendance');
    } finally {
      setMarkingTrainingId(null);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-4 training-ui">

      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <TrainingGreeting
          userName={user?.name || user?.firstName}
          subtitle="Track your professional development, applications, and certifications."
        />
        <Button
          type="primary"
          icon={<CalendarOutlined />}
          size="middle"
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
          className="mb-4 rounded-xl"
          message={
            <span className="font-medium text-sm">
              {upcomingReminders.length === 1
                ? 'Training starting soon!'
                : `${upcomingReminders.length} trainings starting soon!`}
            </span>
          }
          description={
            <div className="mt-0.5">
              {upcomingReminders.slice(0, 2).map((training) => (
                <div key={training.id} className="text-xs">
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
              View
            </Button>
          }
        />
      )}

      {/* Stats Grid */}
      <Row gutter={[12, 12]} className="mb-4">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={8} key={stat.title}>
            <TrainingStatCard {...stat} loading={upcoming.loading} />
          </Col>
        ))}
      </Row>

      {/* Today's Attendance */}
      {todaysAttendanceApplications.length > 0 && (
        <Card
          className="rounded-xl border-border shadow-none mb-4!"
          styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '12px' } }}
          title={
            <div className="flex items-center gap-2 text-sm">
              <CheckCircleOutlined className="text-green-600" />
              <span>Today&apos;s Training Attendance</span>
            </div>
          }
        >
          <div className="custom-scrollbar overflow-y-auto max-h-[300px]">
            <List
              dataSource={todaysAttendanceApplications.slice(0, 4)}
              renderItem={(app) => {
                const trainingId = app.trainingId || app.training?.id;
                const alreadyMarked = app.hasMarkedAttendanceToday === true;
                return (
                  <List.Item
                    className="hover:bg-gray-50 rounded-lg px-2 -mx-2"
                    style={{ padding: '8px' }}
                    actions={[
                      alreadyMarked ? (
                        <Text key="done" className="text-green-600 font-medium text-[10px]">
                          Marked
                        </Text>
                      ) : (
                        <Button
                          key="mark"
                          type="primary"
                          size="small"
                          className="text-[10px]"
                          loading={markingTrainingId === trainingId}
                          onClick={() => handleQuickAttendance(app)}
                        >
                          Mark
                        </Button>
                      ),
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <span
                          className="font-medium text-xs cursor-pointer line-clamp-1"
                          onClick={() => trainingId && navigate(`/app/training/${trainingId}`)}
                        >
                          {app.training?.title || app.trainingTitle || 'Training'}
                        </span>
                      }
                      description={
                        app.training?.startDate ? (
                          <TrainingDateRange
                            startDate={app.training.startDate}
                            endDate={app.training.endDate}
                            compact
                          />
                        ) : null
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        </Card>
      )}

      <Row gutter={[12, 12]}>
        {/* Upcoming Trainings */}
        <Col xs={24} lg={14}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '12px' } }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <ClockCircleOutlined className="text-blue-600" />
                <span>Upcoming Trainings</span>
              </div>
            }
            extra={
              <Link to="/app/training/calendar" className="text-primary flex items-center gap-1 text-xs">
                View All <RightOutlined className="text-[10px]" />
              </Link>
            }
          >
            {upcoming.list?.length ? (
              <div className="custom-scrollbar overflow-y-auto max-h-[300px]">
                <List
                  dataSource={upcoming.list.slice(0, 4)}
                  renderItem={(training) => (
                    <List.Item
                      className="hover:bg-gray-50 rounded-lg px-2 -mx-2"
                      style={{ padding: '8px' }}
                      actions={[
                        <Button
                          key="view"
                          type="link"
                          size="small"
                          className="text-xs"
                          onClick={() => navigate(`/app/training/${training.id}`)}
                        >
                          View
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<span className="font-medium text-xs truncate block">{training.title}</span>}
                        description={
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
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
              </div>
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
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '12px' } }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <BellOutlined className="text-amber-600" />
                <span>Pending Actions</span>
                {(feedback.pending?.length > 0 || pendingApplications.length > 0 || pendingTestCount > 0) && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                    {(feedback.pending?.length || 0) + pendingApplications.length + pendingTestCount}
                  </span>
                )}
              </div>
            }
          >
            {feedback.pending?.length > 0 || pendingApplications.length > 0 || pendingTestCount > 0 ? (
              <div className="space-y-1.5 custom-scrollbar overflow-y-auto max-h-[300px] pr-1">
                {/* Pending Tests - Pre-tests and Post-tests */}
                {pendingTestsList.slice(0, 2).map((test) => {
                  const isPreTest = test.type === 'PRE_TEST';
                  const trainingId = test.trainingId || test.training?.id;
                  return (
                    <div
                      key={`${test.type}-${test.trainingId}`}
                      className={`flex items-center gap-2.5 p-2 rounded-lg ${
                        isPreTest ? 'bg-purple-50 hover:bg-purple-100' : 'bg-green-50 hover:bg-green-100'
                      } cursor-pointer`}
                      onClick={() => trainingId && navigate(`/app/training/${trainingId}`)}
                    >
                      <div className={`flex items-center justify-center w-7 h-7 rounded-full ${
                        isPreTest ? 'bg-purple-200' : 'bg-green-200'
                      }`}>
                        {isPreTest ? (
                          <FormOutlined className="text-purple-700 text-xs" />
                        ) : (
                          <SolutionOutlined className="text-green-700 text-xs" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text className="font-medium text-xs block truncate">
                          {test.trainingTitle || test.training?.title || 'Training'}
                        </Text>
                        <Text className={`text-[10px] ${isPreTest ? 'text-purple-700' : 'text-green-700'}`}>
                          {isPreTest ? 'Pre-test required' : 'Post-test required'}
                        </Text>
                      </div>
                      <Button type="link" size="small" className="text-[10px] p-0 h-auto">
                        Take Test
                      </Button>
                    </div>
                  );
                })}

                {/* Pending Feedback */}
                {feedback.pending?.slice(0, 2).map((item) => {
                  const trainingId = item.trainingId || item.training?.id || item.id;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 ${trainingId ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => trainingId && navigate(`/app/training/${trainingId}`)}
                    >
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-200">
                        <FileTextOutlined className="text-amber-700 text-xs" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Text className="font-medium text-xs block truncate">
                          {item.title || item.trainingTitle || item.training?.title || 'Training Feedback'}
                        </Text>
                        <Text className="text-[10px] text-amber-700">Feedback required</Text>
                      </div>
                      {trainingId && (
                        <Button type="link" size="small" className="text-[10px] p-0 h-auto">
                          Submit
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Pending Applications */}
                {pendingApplications.slice(0, 1).map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    onClick={() => navigate('/app/training/applications')}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-200">
                      <ClockCircleOutlined className="text-blue-700 text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text className="font-medium text-xs block truncate">
                        {app.training?.title || 'Training Application'}
                      </Text>
                      <Text className="text-[10px] text-blue-700">Awaiting approval</Text>
                    </div>
                    <ExclamationCircleOutlined className="text-blue-500 text-xs" />
                  </div>
                ))}
              </div>
            ) : (
              <TrainingEmptyState type="feedback" compact />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDashboardPage;
