import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Col, Row, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import LearningOutcomesList from '../../../components/training/LearningOutcomesList';
import { fetchPrincipalTrainingDetails, fetchPrincipalTrainingStats } from '../store/principalTrainingSlice';

const { Title, Paragraph, Text } = Typography;

const PrincipalTrainingDetailsPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { currentTraining } = useSelector((state) => state.principalTraining);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchPrincipalTrainingDetails(id));
    dispatch(fetchPrincipalTrainingStats(id));
  }, [dispatch, id]);

  const training = currentTraining.data;
  const stats = currentTraining.stats;

  return (
    <div className="p-6 training-ui">
      <PageHeader
        title={<span className="training-heading">{training?.title || 'Training Details'}</span>}
        description="Review training details for your institution."
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
          <Card className="rounded-2xl border-border shadow-none" styles={{ body: { padding: '16px' } }}>
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
                <Text className="text-xs text-text-secondary">Provider</Text>
                <Text>{training?.providedBy || 'TBD'}</Text>
              </Col>
              <Col xs={24} sm={12}>
                <Text className="text-xs text-text-secondary">Trainer</Text>
                <Text>{training?.trainerName || 'TBD'}</Text>
              </Col>
            </Row>
          </Card>

          <Card className="rounded-2xl border-border shadow-none mt-4" styles={{ body: { padding: '16px' } }}>
            <Title level={4}>Learning Outcomes</Title>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card className="rounded-2xl border-border shadow-none" styles={{ body: { padding: '16px' } }}>
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

export default PrincipalTrainingDetailsPage;
