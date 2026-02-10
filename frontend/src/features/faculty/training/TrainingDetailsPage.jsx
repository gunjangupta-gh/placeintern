import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, Avatar, Button, Card, Col, Descriptions, Divider, Form, Input, Modal, Popconfirm, Row, Skeleton, Space, Steps, Timeline, Typography, message } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  InfoCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import BranchTags from '../../../components/training/BranchTags';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import ApplicationDeadline from '../../../components/training/ApplicationDeadline';
import LearningOutcomesList from '../../../components/training/LearningOutcomesList';
import ApplicationStatusBadge from '../../../components/training/ApplicationStatusBadge';
import {
  fetchTrainingDetails,
  checkEligibility,
  fetchApplicationStatus,
  applyForTraining,
  withdrawApplication,
} from '../store/facultyTrainingSlice';

const { Title, Text, Paragraph } = Typography;

const InfoItem = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-2">
    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 shrink-0">
      <Icon className="text-blue-700" />
    </div>
    <div className="flex-1 min-w-0">
      <Text type="secondary" className="text-xs block">{label}</Text>
      <div className="mt-0.5">{children}</div>
    </div>
  </div>
);

const TrainingDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentTraining, applicationStatus } = useSelector((state) => state.facultyTraining);
  const [applyOpen, setApplyOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!id) return;
    dispatch(fetchTrainingDetails(id));
    dispatch(checkEligibility(id));
    dispatch(fetchApplicationStatus(id));
  }, [dispatch, id]);

  const training = currentTraining.data;
  const status = applicationStatus?.[id];
  const isLoading = currentTraining.loading;

  const capacityInfo = React.useMemo(() => {
    if (training?.capacity && typeof training.capacity === 'object') {
      return {
        available: training.capacity.available ?? 0,
        total: training.capacity.total ?? 0,
      };
    }
    const availableRaw = training?.availableSeats;
    if (availableRaw && typeof availableRaw === 'object') {
      return {
        available: availableRaw.available ?? 0,
        total: availableRaw.total ?? 0,
      };
    }
    return {
      available: training?.availableSeats ?? 0,
      total: training?.capacity ?? 0,
    };
  }, [training]);

  const handleApply = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      await dispatch(applyForTraining({ trainingId: id, ...values })).unwrap();
      message.success('Application submitted successfully!');
      setApplyOpen(false);
      form.resetFields();
      // Refresh both application status and training details to update capacity
      dispatch(fetchApplicationStatus(id));
      dispatch(fetchTrainingDetails(id));
    } catch (error) {
      message.error(error || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const applicationId = status?.applicationId || status?.id;
    if (!applicationId) {
      message.warning('Application ID not found');
      return;
    }

    try {
      await dispatch(withdrawApplication(applicationId)).unwrap();
      message.success('Application withdrawn');
      // Refresh both application status and training details to update capacity
      dispatch(fetchApplicationStatus(id));
      dispatch(fetchTrainingDetails(id));
    } catch (error) {
      message.error(error || 'Failed to withdraw application');
    }
  };

  const getApplicationStepStatus = () => {
    if (!status?.status) return -1;
    switch (status.status) {
      case 'PENDING':
      case 'SUBMITTED':
        return 0;
      case 'APPROVED':
        return 1;
      case 'REJECTED':
        return 'error';
      default:
        return 0;
    }
  };

  const canApply = !status?.status && capacityInfo.available > 0;
  const canWithdraw = ['PENDING', 'SUBMITTED'].includes(status?.status);

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  return (
    <div className="p-6 training-ui">
      <div className="mb-4">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="text-text-secondary hover:text-primary"
        >
          Back
        </Button>
      </div>

      <Card className="rounded-2xl border-border shadow-none mb-6 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} lg={16}>
            <Space className="mb-3">
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
            </Space>
            <Title level={2} className="!mb-2 training-heading">{training?.title || 'Training'}</Title>
            <Text type="secondary" className="text-base">{training?.providedBy || 'Training Provider'}</Text>
          </Col>
          <Col xs={24} lg={8} className="lg:text-right">
            <Space direction="vertical" className="w-full lg:w-auto">
              {canApply && (
                <Button
                  type="primary"
                  size="large"
                  icon={<SendOutlined />}
                  onClick={() => setApplyOpen(true)}
                  block
                >
                  Apply Now
                </Button>
              )}
              {canWithdraw && (
                <Popconfirm
                  title="Withdraw application?"
                  description="Are you sure you want to withdraw your application?"
                  onConfirm={handleWithdraw}
                  okText="Yes, Withdraw"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger size="large" block>
                    Withdraw Application
                  </Button>
                </Popconfirm>
              )}
              {status?.status === 'APPROVED' && (
                <Alert
                  message="You're enrolled!"
                  description="Your application has been approved."
                  type="success"
                  showIcon
                />
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card className="rounded-xl border-border shadow-none mb-4">
            <Title level={4} className="flex items-center gap-2">
              <InfoCircleOutlined className="text-blue-700" />
              About This Training
            </Title>
            <Paragraph className="text-base text-text-secondary">
              {training?.description || 'No description provided.'}
            </Paragraph>

            <Divider />

            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <InfoItem icon={CalendarOutlined} label="Training Dates">
                  <TrainingDateRange startDate={training?.startDate} endDate={training?.endDate} />
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem icon={ClockCircleOutlined} label="Duration">
                  <Text>{training?.duration ? `${training.duration} hours` : 'TBD'}</Text>
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem icon={TeamOutlined} label="Capacity">
                  <CapacityIndicator available={capacityInfo.available} total={capacityInfo.total} compact />
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem icon={BookOutlined} label="Target Branches">
                  <BranchTags branches={training?.targetBranches || training?.branches || []} />
                </InfoItem>
              </Col>
            </Row>
          </Card>

          <Card className="rounded-xl border-border shadow-none mb-4">
            <Title level={4} className="flex items-center gap-2">
              <CheckCircleOutlined className="text-success-700" />
              Learning Outcomes
            </Title>
            <Paragraph type="secondary" className="mb-4">
              By the end of this training, participants will be able to:
            </Paragraph>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} />
          </Card>

          <Card className="rounded-xl border-border shadow-none mb-4">
            <Title level={4} className="flex items-center gap-2">
              <CalendarOutlined className="text-blue-700" />
              Schedule Snapshot
            </Title>
            <Timeline
              items={[
                {
                  color: 'blue',
                  children: `Application deadline: ${training?.applicationDeadline ? new Date(training.applicationDeadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'TBD'}`,
                },
                {
                  color: 'green',
                  children: `Training starts: ${training?.startDate ? new Date(training.startDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'TBD'}`,
                },
                {
                  color: 'gray',
                  children: `Training ends: ${training?.endDate ? new Date(training.endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }) : 'TBD'}`,
                },
              ]}
            />
          </Card>

          {training?.prerequisites && (
            <Card className="rounded-xl border-border shadow-none">
              <Title level={4}>Prerequisites</Title>
              <Paragraph className="text-text-secondary !mb-0">
                {training.prerequisites}
              </Paragraph>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          <Card className="rounded-xl border-border shadow-none mb-4">
            <Title level={4} className="flex items-center gap-2">
              <SendOutlined className="text-blue-700" />
              Application Status
            </Title>

            <ApplicationDeadline deadline={training?.applicationDeadline} className="mb-4" />

            {status?.status ? (
              <div className="mt-6">
                <Steps
                  direction="vertical"
                  size="small"
                  current={getApplicationStepStatus()}
                  status={status.status === 'REJECTED' ? 'error' : 'process'}
                  items={[
                    {
                      title: 'Applied',
                      description: status.createdAt
                        ? `Submitted on ${new Date(status.createdAt).toLocaleDateString()}`
                        : 'Application submitted',
                    },
                    {
                      title: 'Review',
                      description: status.status === 'APPROVED'
                        ? 'Application approved'
                        : status.status === 'REJECTED'
                        ? 'Application rejected'
                        : 'Pending review',
                    },
                    {
                      title: 'Enrolled',
                      description: status.status === 'APPROVED' ? 'Ready to attend' : 'Awaiting approval',
                    },
                  ]}
                />
                {status.reviewComments && (
                  <Alert
                    className="mt-4"
                    message="Review Comments"
                    description={status.reviewComments}
                    type={status.status === 'REJECTED' ? 'error' : 'info'}
                  />
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
                  <SendOutlined className="text-2xl text-blue-700" />
                </div>
                <Text type="secondary" className="block">
                  You haven't applied for this training yet.
                </Text>
                {canApply && (
                  <Button
                    type="primary"
                    className="mt-4"
                    onClick={() => setApplyOpen(true)}
                  >
                    Apply Now
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="rounded-xl border-border shadow-none">
            <Title level={4} className="flex items-center gap-2">
              <UserOutlined className="text-blue-700" />
              Trainer & Venue
            </Title>

            <div className="space-y-4">
              {training?.trainerName && (
                <div className="flex items-center gap-3">
                  <Avatar size={40} icon={<UserOutlined />} className="bg-blue-100 text-blue-700" />
                  <div>
                    <Text strong>{training.trainerName}</Text>
                    <Text type="secondary" className="text-xs block">Trainer</Text>
                  </div>
                </div>
              )}

              <Descriptions column={1} size="small">
                <Descriptions.Item label={<span className="flex items-center gap-1"><EnvironmentOutlined /> Venue</span>}>
                  {training?.venue || 'TBD'}
                </Descriptions.Item>
                {training?.meetingLink && (
                  <Descriptions.Item label={<span className="flex items-center gap-1"><LinkOutlined /> Meeting Link</span>}>
                    <a href={training.meetingLink} target="_blank" rel="noopener noreferrer" className="text-primary">
                      Join Online
                    </a>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <div className="flex items-center gap-2">
            <SendOutlined className="text-blue-700" />
            Apply for Training
          </div>
        }
        open={applyOpen}
        onCancel={() => setApplyOpen(false)}
        onOk={handleApply}
        okText="Submit Application"
        confirmLoading={submitting}
        width={560}
      >
        <div className="py-2">
          <Alert
            message={training?.title}
            description={
              <TrainingDateRange startDate={training?.startDate} endDate={training?.endDate} />
            }
            type="info"
            className="mb-4"
          />

          <Form layout="vertical" form={form}>
            <Form.Item
              name="relevanceToTeaching"
              label="How is this training relevant to your teaching?"
              rules={[{ required: true, message: 'Please explain the relevance' }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Describe how this training aligns with your teaching discipline and current curriculum..."
                showCount
                maxLength={500}
              />
            </Form.Item>
            <Form.Item
              name="expectedApplication"
              label="How do you plan to apply this learning?"
              rules={[{ required: true, message: 'Please describe your application plan' }]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Explain how you will integrate the knowledge gained into your classroom practice..."
                showCount
                maxLength={500}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

export default TrainingDetailsPage;
