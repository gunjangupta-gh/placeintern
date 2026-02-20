import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, List, Row, Typography, message } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BellOutlined,
  ExclamationCircleOutlined,
  FormOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingStatCard from '../../../components/training/TrainingStatCard';
import { DashboardSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchPendingFeedback,
  fetchAttendanceSummary,
  fetchMyApplications,
  markSelfAttendance,
  fetchPendingTests,
  fetchPendingLessonPlans,
  fetchTrainingAttendance,
} from '../store/facultyTrainingSlice';

const { Title, Text } = Typography;

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [markingTrainingId, setMarkingTrainingId] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const { feedback, attendance, applications, pendingTests, pendingLessonPlans } = useSelector(
    (state) => state.facultyTraining
  );

  useEffect(() => {
    dispatch(fetchPendingFeedback());
    dispatch(fetchAttendanceSummary());
    dispatch(fetchMyApplications({ status: 'APPROVED' }));
    dispatch(fetchPendingTests());
    dispatch(fetchPendingLessonPlans());
  }, [dispatch]);

  // Calculate stats with trends (mock trends for now - can be replaced with actual data)
  const pendingTestsList = useMemo(() => {
    return Array.isArray(pendingTests?.list) ? pendingTests.list : [];
  }, [pendingTests?.list]);

  const pendingTestCount = useMemo(() => {
    return pendingTestsList.length;
  }, [pendingTestsList]);

  const pendingLessonPlansList = useMemo(() => {
    return Array.isArray(pendingLessonPlans?.list) ? pendingLessonPlans.list : [];
  }, [pendingLessonPlans?.list]);

  const pendingActionsCount =
    (feedback.pending?.length || 0) + pendingTestCount + pendingLessonPlansList.length;

  const mandatoryTraining = attendance.summary?.dashboard?.mandatoryTraining;
  const attendedTrainings = attendance.summary?.dashboard?.trainingsAttended || [];

  const stats = useMemo(() => {
    const requiredHours = mandatoryTraining?.requiredHours || 40;
    const requiredDays = mandatoryTraining?.requiredDays || 5;
    const hoursCompleted = mandatoryTraining?.hoursCompleted || 0;
    const daysCompleted = mandatoryTraining?.daysCompleted || 0;
    const trainingsAttendedCount = attendance.summary?.dashboard?.trainingsAttendedCount || 0;
    const isCompleted = mandatoryTraining?.isCompleted === true;
    const totalPendingActions = pendingActionsCount;

    return [
      {
        title: 'Mandatory Training (40h / 5d)',
        value: `${hoursCompleted}h`,
        icon: CalendarOutlined,
        variant: isCompleted ? 'success' : 'primary',
        subtitle: `/ ${requiredHours}h`,
      },
      {
        title: 'Mandatory Days Completed',
        value: daysCompleted,
        icon: CheckCircleOutlined,
        variant: daysCompleted >= requiredDays ? 'success' : 'warning',
        subtitle: `/ ${requiredDays} days`,
      },
      {
        title: 'Trainings Attended',
        value: trainingsAttendedCount,
        icon: FileTextOutlined,
        variant: 'purple',
        subtitle: 'with attendance',
      },
      {
        title: 'Pending Actions',
        value: totalPendingActions,
        icon: BellOutlined,
        variant: 'warning',
        subtitle: totalPendingActions > 0 ? 'action needed' : 'all done',
      },
    ];
  }, [attendance.summary?.dashboard, mandatoryTraining, pendingActionsCount]);

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

  useEffect(() => {
    const trainingIds = todaysAttendanceApplications
      .map((app) => app.trainingId || app.training?.id)
      .filter(Boolean);

    trainingIds.forEach((trainingId) => {
      const hasData = Boolean(attendance?.byTraining?.[trainingId]);
      const isLoadingProgress = Boolean(attendance?.loadingByTraining?.[trainingId]);
      if (!hasData && !isLoadingProgress) {
        dispatch(fetchTrainingAttendance(trainingId));
      }
    });
  }, [attendance?.byTraining, attendance?.loadingByTraining, dispatch, todaysAttendanceApplications]);

  const isLoading = applications.loading && !(applications.list?.length > 0);

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

    const now = new Date();
    const attendanceDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    try {
      setMarkingTrainingId(trainingId);
      const { latitude, longitude } = await captureLocation();

      await dispatch(
        markSelfAttendance({
          trainingId,
          attendanceDate,
          latitude,
          longitude,
        })
      ).unwrap();

      message.success('Attendance marked successfully!');
      dispatch(fetchMyApplications({ status: 'APPROVED', forceRefresh: true }));
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

      {/* Stats Grid */}
      <Row gutter={[12, 12]} className="mb-4">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <TrainingStatCard {...stat} loading={applications.loading && !attendance.summary} />
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
          <div className="custom-scrollbar overflow-y-auto max-h-75">
            <List
              dataSource={todaysAttendanceApplications.slice(0, 4)}
              renderItem={(app) => {
                const trainingId = app.trainingId || app.training?.id;
                const alreadyMarked = app.hasMarkedAttendanceToday === true;
                const progress = trainingId ? attendance?.byTraining?.[trainingId] : null;
                const missingDays = progress?.totalDays
                  ? Math.max(0, progress.totalDays - (progress.attendedDays || 0))
                  : 0;
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
                        <div className="space-y-1">
                          {app.training?.startDate ? (
                            <TrainingDateRange
                              startDate={app.training.startDate}
                              endDate={app.training.endDate}
                              compact
                            />
                          ) : null}
                          {progress?.totalDays > 0 && (
                            missingDays > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-medium">
                                {missingDays} day{missingDays > 1 ? 's' : ''} pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-medium">
                                Full attendance
                              </span>
                            )
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </div>
        </Card>
      )}

      <Row gutter={[12, 12]} className="mb-4">
        {/* Trainings Attended */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '12px' } }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleOutlined className="text-green-600" />
                <span>Trainings Attended</span>
              </div>
            }
          >
            {attendedTrainings.length > 0 ? (
              <div className="space-y-1.5 custom-scrollbar overflow-y-auto max-h-75 pr-1">
                {attendedTrainings.map((training) => (
                  <div
                    key={training.id}
                    className="p-2.5 rounded-lg bg-green-50 hover:bg-green-100 cursor-pointer border border-green-100"
                    onClick={() => navigate(`/app/training/${training.id}`)}
                  >
                    <Text className="font-medium text-xs block truncate">{training.title}</Text>
                    <Text className="text-[10px] text-green-700 block mt-0.5">
                      {training.attendedDays}/{training.totalDays} days • {training.completedHours}h
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <TrainingEmptyState
                type="calendar"
                compact
                message="No attended trainings yet"
                description="Mark attendance in your approved trainings to populate this list."
              />
            )}
          </Card>
        </Col>

        {/* Pending Actions */}
        <Col xs={24} lg={12}>
          <Card
            className="rounded-xl border-border shadow-none h-full"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '12px' } }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <BellOutlined className="text-amber-600" />
                <span>Pending Actions</span>
                {pendingActionsCount > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded-full">
                    {pendingActionsCount}
                  </span>
                )}
              </div>
            }
          >
            {pendingActionsCount > 0 ? (
              <div className="space-y-1.5 custom-scrollbar overflow-y-auto max-h-75 pr-1">
                {pendingTestsList.map((test) => {
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

                {feedback.pending?.map((item) => {
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

                {pendingLessonPlansList.map((plan) => (
                  <div
                    key={`${plan.type}-${plan.trainingId}`}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 cursor-pointer"
                    onClick={() => navigate(`/app/training/${plan.trainingId}`)}
                  >
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-200">
                      <ClockCircleOutlined className="text-blue-700 text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Text className="font-medium text-xs block truncate">
                        {plan.trainingTitle || 'Training'}
                      </Text>
                      <Text className="text-[10px] text-blue-700">
                        {plan.type === 'CREATE_LESSON_PLAN' ? 'Create lesson plan' : 'Submit lesson plan'}
                      </Text>
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
