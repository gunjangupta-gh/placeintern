import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, List, Row, Statistic, Typography } from 'antd';
import {
  CalendarOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import {
  fetchUpcoming,
  fetchMyTrainings,
  fetchPendingFeedback,
  fetchAttendanceSummary,
} from '../store/facultyTrainingSlice';

const { Title, Text } = Typography;

const STAT_TONES = {
  primary: {
    icon: 'bg-blue-100 text-blue-700',
    card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50',
  },
  success: {
    icon: 'bg-emerald-100 text-emerald-700',
    card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50',
  },
  warning: {
    icon: 'bg-amber-100 text-amber-700',
    card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50',
  },
  secondary: {
    icon: 'bg-slate-100 text-slate-700',
    card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50',
  },
};

const StatCard = ({ icon: Icon, title, value, tone, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <Card
      className={`rounded-2xl border-border shadow-none cursor-pointer hover:shadow-soft transition-shadow ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '18px' } }}
    >
      <div className="flex items-center gap-4">
        <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${styles.icon}`}>
          <Icon className="text-lg" />
        </div>
        <div className="flex-1">
          <Text className="text-text-secondary text-xs block">{title}</Text>
          <Statistic value={value} valueStyle={{ fontSize: 26, fontWeight: 700 }} />
        </div>
      </div>
    </Card>
  );
};

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { upcoming, myTrainings, feedback, attendance } = useSelector(
    (state) => state.facultyTraining
  );

  useEffect(() => {
    dispatch(fetchUpcoming());
    dispatch(fetchMyTrainings());
    dispatch(fetchPendingFeedback());
    dispatch(fetchAttendanceSummary());
  }, [dispatch]);

  const stats = [
    {
      title: 'Upcoming Trainings',
      value: upcoming.list?.length || 0,
      icon: CalendarOutlined,
      tone: 'primary',
      onClick: () => navigate('/app/training/calendar'),
    },
    {
      title: 'My Enrollments',
      value: myTrainings.list?.length || 0,
      icon: CheckCircleOutlined,
      tone: 'success',
      onClick: () => navigate('/app/training/applications'),
    },
    {
      title: 'Pending Feedback',
      value: feedback.pending?.length || 0,
      icon: FileTextOutlined,
      tone: 'warning',
      onClick: () => {},
    },
    {
      title: 'Certificates Earned',
      value: attendance.summary?.certificatesEarned || 0,
      icon: SafetyCertificateOutlined,
      tone: 'secondary',
      onClick: () => navigate('/app/training/certificates'),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={CalendarOutlined}
        title={<span className="training-heading">Training Dashboard</span>}
        description="Track your professional development, applications, and certifications."
        actions={[
          <Button
            key="calendar"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={() => navigate('/app/training/calendar')}
          >
            Browse Trainings
          </Button>,
        ]}
      />

      <Card className="rounded-2xl border-border shadow-none bg-gradient-to-br from-blue-50 via-white to-amber-50 mb-6">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <Title level={3} className="!mb-2 training-heading">
              Keep your teaching toolkit evolving.
            </Title>
            <Text type="secondary" className="text-base">
              Upcoming sessions, your enrollments, and pending feedback in one place.
            </Text>
          </Col>
          <Col xs={24} lg={8} className="lg:text-right">
            <Button type="default" onClick={() => navigate('/app/training/applications')}>
              Review My Applications
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            className="rounded-xl border-border shadow-none"
            title={
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-blue-700" />
                Upcoming Trainings
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
                    className="hover:bg-gray-50 rounded-lg px-2 py-2! -mx-2 transition-colors"
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
                      title={
                        <span className="font-medium">{training.title}</span>
                      }
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
                message="No upcoming trainings"
                description="Check back later for new training opportunities."
                actionText="Browse Calendar"
                onAction={() => navigate('/app/training/calendar')}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            className="rounded-xl border-border shadow-none"
            title={
              <div className="flex items-center gap-2">
                <BellOutlined className="text-warning-700" />
                Pending Actions
              </div>
            }
          >
            {feedback.pending?.length ? (
              <List
                dataSource={feedback.pending}
                renderItem={(item) => (
                  <List.Item
                    className="hover:bg-gray-50 rounded-lg px-2 py-2! -mx-2 transition-colors"
                    actions={[
                      <Button key="submit" type="link" size="small">
                        Submit
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
                          <FileTextOutlined className="text-warning-700" />
                        </div>
                      }
                      title={
                        <span className="font-medium">
                          {item.title || item.trainingTitle || 'Training'}
                        </span>
                      }
                      description={
                        <Text type="secondary" className="text-xs">
                          Feedback required
                        </Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <TrainingEmptyState
                type="feedback"
                message="All caught up!"
                description="You have no pending actions at this time."
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDashboardPage;
