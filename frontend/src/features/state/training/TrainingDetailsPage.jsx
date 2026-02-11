import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Row, Typography, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CalendarOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import LearningOutcomesList from '../../../components/training/LearningOutcomesList';
import { TrainingDetailsSkeleton, TrainingStatSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchStateTrainingDetails,
  fetchStateTrainingStats,
  publishStateTraining,
  unpublishStateTraining,
} from '../store/stateTrainingSlice';

const { Title, Paragraph, Text } = Typography;

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

const TrainingDetailsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentTraining } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchStateTrainingDetails(id));
    dispatch(fetchStateTrainingStats(id));
  }, [dispatch, id]);

  const isLoading = currentTraining.loading && !currentTraining.data;
  const training = currentTraining.data;
  const stats = currentTraining.stats;

  const handlePublish = async () => {
    try {
      await dispatch(publishStateTraining(id)).unwrap();
      message.success('Training published');
    } catch (error) {
      message.error(error || 'Failed to publish training');
    }
  };

  const handleUnpublish = async () => {
    try {
      await dispatch(unpublishStateTraining(id)).unwrap();
      message.success('Training unpublished');
    } catch (error) {
      message.error(error || 'Failed to unpublish training');
    }
  };

  const statsCards = [
    {
      title: 'Applications',
      value: stats?.applications?.total ?? 0,
      subtitle: `${stats?.applications?.approved ?? 0} approved`,
      icon: FileTextOutlined,
      tone: 'primary',
      onClick: () => navigate(`/app/training/${id}/applications`),
    },
    {
      title: 'Attendance',
      value: stats?.attendance?.uniqueAttendees ?? 0,
      subtitle: 'unique attendees',
      icon: TeamOutlined,
      tone: 'success',
      onClick: () => navigate(`/app/training/${id}/attendance`),
    },
    {
      title: 'Certificates',
      value: stats?.certificates?.issued ?? 0,
      subtitle: 'issued to date',
      icon: SafetyCertificateOutlined,
      tone: 'warning',
      onClick: () => navigate(`/app/training/${id}/certificates`),
    },
  ];

  if (isLoading) {
    return <TrainingDetailsSkeleton />;
  }

  return (
    <div className="p-6 training-ui" role="main" aria-label="Training Details">
      <PageHeader
        icon={CalendarOutlined}
        title={<span className="training-heading">{training?.title || 'Training Details'}</span>}
        description="Review training details and performance."
        actions={[
          training?.isPublished ? (
            <Button key="unpublish" onClick={handleUnpublish} aria-label="Unpublish training">
              Unpublish
            </Button>
          ) : (
            <Button key="publish" type="primary" onClick={handlePublish} aria-label="Publish training">
              Publish
            </Button>
          ),
        ]}
      />

      <Card className="rounded-2xl border-border shadow-none mb-6 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} lg={16}>
            <Title level={3} className="!mb-2 training-heading">
              {training?.title || 'Training'}
            </Title>
            <Text type="secondary" className="text-base">
              {training?.providedBy || 'Training Provider'}
            </Text>
          </Col>
          <Col xs={24} lg={8} className="lg:text-right">
            <div className="flex flex-wrap lg:justify-end gap-2">
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Training statistics">
        {statsCards.map((stat) => (
          <Col xs={24} md={8} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="rounded-2xl border-border shadow-none">
            <Title level={4}>Overview</Title>
            <Paragraph>{training?.description || 'No description provided.'}</Paragraph>

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary block mb-1">Dates</Text>
                <TrainingDateRange startDate={training?.startDate} endDate={training?.endDate} />
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary block mb-1">Mode</Text>
                <div className="flex gap-2 flex-wrap">
                  <DeliveryModeBadge mode={training?.deliveryMode} />
                  <DifficultyBadge level={training?.difficulty} />
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary block mb-1">Capacity</Text>
                <CapacityIndicator available={training?.availableSeats} total={training?.capacity} />
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary block mb-1">Provider</Text>
                <Text>{training?.providedBy || 'TBD'}</Text>
              </Col>
            </Row>
          </Card>

          <Card className="rounded-2xl border-border shadow-none mt-4">
            <Title level={4}>Learning Outcomes</Title>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="rounded-2xl border-border shadow-none">
            <Title level={4}>Quick Actions</Title>
            <div className="space-y-3">
              <Button
                block
                onClick={() => navigate(`/app/training/${id}/applications`)}
                aria-label="View applications"
              >
                View Applications
              </Button>
              <Button
                block
                onClick={() => navigate(`/app/training/${id}/attendance`)}
                aria-label="Manage attendance"
              >
                Manage Attendance
              </Button>
              <Button
                block
                onClick={() => navigate(`/app/training/${id}/certificates`)}
                aria-label="Manage certificates"
              >
                Manage Certificates
              </Button>
              <Button
                block
                onClick={() => navigate(`/app/training/${id}/edit`)}
                aria-label="Edit training"
              >
                Edit Training
              </Button>
            </div>
          </Card>

          <Card className="rounded-2xl border-border shadow-none mt-4">
            <Title level={4}>Detailed Stats</Title>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <Text type="secondary">Total Applications</Text>
                <Text strong>{stats?.applications?.total ?? 0}</Text>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <Text type="secondary">Approved</Text>
                <Text strong className="text-emerald-600">{stats?.applications?.approved ?? 0}</Text>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <Text type="secondary">Pending</Text>
                <Text strong className="text-amber-600">{stats?.applications?.pending ?? 0}</Text>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <Text type="secondary">Unique Attendees</Text>
                <Text strong>{stats?.attendance?.uniqueAttendees ?? 0}</Text>
              </div>
              <div className="flex justify-between items-center py-2">
                <Text type="secondary">Certificates Issued</Text>
                <Text strong>{stats?.certificates?.issued ?? 0}</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDetailsPage;
