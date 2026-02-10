import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Row, Typography, message } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import LearningOutcomesList from '../../../components/training/LearningOutcomesList';
import {
  fetchStateTrainingDetails,
  fetchStateTrainingStats,
  publishStateTraining,
  unpublishStateTraining,
} from '../store/stateTrainingSlice';

const { Title, Paragraph, Text } = Typography;

const TrainingDetailsPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { currentTraining } = useSelector((state) => state.stateTraining);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchStateTrainingDetails(id));
    dispatch(fetchStateTrainingStats(id));
  }, [dispatch, id]);

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

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">{training?.title || 'Training Details'}</span>}
        description="Review training details and performance."
        actions={[
          training?.isPublished ? (
            <Button key="unpublish" onClick={handleUnpublish}>Unpublish</Button>
          ) : (
            <Button key="publish" type="primary" onClick={handlePublish}>Publish</Button>
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

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="rounded-2xl border-border shadow-none">
            <Title level={4}>Overview</Title>
            <Paragraph>{training?.description || 'No description provided.'}</Paragraph>

            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary">Dates</Text>
                <TrainingDateRange startDate={training?.startDate} endDate={training?.endDate} />
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary">Mode</Text>
                <div className="flex gap-2 flex-wrap">
                  <DeliveryModeBadge mode={training?.deliveryMode} />
                  <DifficultyBadge level={training?.difficulty} />
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary">Capacity</Text>
                <CapacityIndicator available={training?.availableSeats} total={training?.capacity} />
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary">Provider</Text>
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
            <Title level={4}>Stats</Title>
            <Paragraph><strong>Applications:</strong> {stats?.applications?.total ?? 0}</Paragraph>
            <Paragraph><strong>Approved:</strong> {stats?.applications?.approved ?? 0}</Paragraph>
            <Paragraph><strong>Attendance:</strong> {stats?.attendance?.uniqueAttendees ?? 0}</Paragraph>
            <Paragraph><strong>Certificates:</strong> {stats?.certificates?.issued ?? 0}</Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDetailsPage;
