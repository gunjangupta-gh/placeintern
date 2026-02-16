import React, { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Rate,
  Result,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Timeline,
  Tooltip,
  Typography,
  message,
} from "antd";
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
  FileTextOutlined,
  FormOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import DifficultyBadge from "../../../components/training/DifficultyBadge";
import BranchTags from "../../../components/training/BranchTags";
import LearningOutcomesList from "../../../components/training/LearningOutcomesList";
import ApplicationStatusBadge from "../../../components/training/ApplicationStatusBadge";
import TrainingBreadcrumb from "../../../components/training/TrainingBreadcrumb";
import DeadlineCountdown from "../../../components/training/DeadlineCountdown";
import { TrainingDetailsSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchTrainingDetails,
  checkEligibility,
  fetchApplicationStatus,
  fetchMyApplications,
  applyForTraining,
  withdrawApplication,
  fetchUpcoming,
  submitFeedback,
  fetchFeedbackStatus,
  fetchFeedbackForm,
  markSelfAttendance,
  fetchPreTestForm,
  fetchPostTestForm,
  fetchTestStatuses,
  submitPreTest,
  submitPostTest,
} from "../store/facultyTrainingSlice";

const { Title, Text, Paragraph } = Typography;

const InfoItem = ({ icon: Icon, label, children, tooltip }) => (
  <div className="flex items-start gap-3 py-2">
    <Tooltip title={tooltip}>
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 shrink-0">
        <Icon className="text-blue-700" />
      </div>
    </Tooltip>
    <div className="flex-1 min-w-0">
      <Text type="secondary" className="text-xs block">
        {label}
      </Text>
      <div className="mt-0.5">{children}</div>
    </div>
  </div>
);

const TrainingDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { currentTraining, applicationStatus, upcoming, feedback, applications, preTest, postTest } = useSelector(
    (state) => state.facultyTraining,
  );
  const [applyOpen, setApplyOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [preTestOpen, setPreTestOpen] = useState(false);
  const [postTestOpen, setPostTestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [preTestSuccess, setPreTestSuccess] = useState(false);
  const [postTestSuccess, setPostTestSuccess] = useState(false);
  const [form] = Form.useForm();
  const [feedbackFormInstance] = Form.useForm();
  const [preTestFormInstance] = Form.useForm();
  const [postTestFormInstance] = Form.useForm();

  useEffect(() => {
    if (!id) return;
    dispatch(fetchTrainingDetails(id));
    dispatch(checkEligibility(id));
    dispatch(fetchApplicationStatus(id));
    dispatch(fetchMyApplications({ trainingId: id }));
    dispatch(fetchFeedbackStatus(id));
    dispatch(fetchFeedbackForm(id));
    dispatch(fetchTestStatuses(id));
    dispatch(fetchUpcoming()); // For similar trainings
  }, [dispatch, id]);

  const training = currentTraining.data;
  const status = applicationStatus?.[id];
  const feedbackStatus = feedback?.statusByTraining?.[id];
  const feedbackFormData = feedback?.form;
  const preTestStatus = preTest?.statusByTraining?.[id];
  const postTestStatus = postTest?.statusByTraining?.[id];
  const preTestFormData = preTest?.form;
  const postTestFormData = postTest?.form;
  const isLoading = currentTraining.loading;

  const capacityInfo = useMemo(() => {
    if (training?.capacity && typeof training.capacity === "object") {
      return {
        available: training.capacity.available ?? 0,
        total: training.capacity.total ?? 0,
      };
    }
    const availableRaw = training?.availableSeats;
    if (availableRaw && typeof availableRaw === "object") {
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
      setApplicationSuccess(true);
      setApplyOpen(false);
      form.resetFields();
      // Refresh both application status and training details to update capacity
      dispatch(fetchApplicationStatus(id));
      dispatch(fetchTrainingDetails(id));
    } catch (error) {
      message.error(error || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const applicationId = status?.applicationId || status?.id;
    if (!applicationId) {
      message.warning("Application ID not found");
      return;
    }

    try {
      await dispatch(withdrawApplication(applicationId)).unwrap();
      message.success("Application withdrawn");
      // Refresh both application status and training details to update capacity
      dispatch(fetchApplicationStatus(id));
      dispatch(fetchTrainingDetails(id));
    } catch (error) {
      message.error(error || "Failed to withdraw application");
    }
  };
  const handleFeedbackSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await feedbackFormInstance.validateFields();
      
      // Format responses for backend
      const responses = {};
      feedbackFormData?.questions?.forEach((question) => {
        if (values[question.id] !== undefined) {
          responses[question.id] = values[question.id];
        }
      });

      const payload = {
        feedbackFormId: feedbackFormData.id,
        trainingId: id,
        responses,
      };

      await dispatch(submitFeedback({ trainingId: id, data: payload })).unwrap();
      setFeedbackSuccess(true);
      setFeedbackOpen(false);
      feedbackFormInstance.resetFields();
      message.success('Feedback submitted successfully!');
      
      // Refresh feedback status after a short delay to ensure backend has processed
      setTimeout(() => {
        dispatch(fetchFeedbackStatus(id));
      }, 500);
    } catch (error) {
      message.error(error || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreTestSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await preTestFormInstance.validateFields();

      // Format responses for backend
      const responses = {};
      preTestFormData?.questions?.forEach((question) => {
        if (values[question.id] !== undefined) {
          responses[question.id] = values[question.id];
        }
      });

      const payload = {
        preTestFormId: preTestFormData.id,
        trainingId: id,
        responses,
      };

      await dispatch(submitPreTest({ trainingId: id, data: payload })).unwrap();
      setPreTestSuccess(true);
      setPreTestOpen(false);
      preTestFormInstance.resetFields();
      message.success('Pre-test submitted successfully!');

      setTimeout(() => {
        dispatch(fetchTestStatuses(id));
      }, 500);
    } catch (error) {
      message.error(error || 'Failed to submit pre-test');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostTestSubmit = async () => {
    try {
      setSubmitting(true);
      const values = await postTestFormInstance.validateFields();

      // Format responses for backend
      const responses = {};
      postTestFormData?.questions?.forEach((question) => {
        if (values[question.id] !== undefined) {
          responses[question.id] = values[question.id];
        }
      });

      const payload = {
        postTestFormId: postTestFormData.id,
        trainingId: id,
        responses,
      };

      await dispatch(submitPostTest({ trainingId: id, data: payload })).unwrap();
      setPostTestSuccess(true);
      setPostTestOpen(false);
      postTestFormInstance.resetFields();
      message.success('Post-test submitted successfully!');

      setTimeout(() => {
        dispatch(fetchTestStatuses(id));
      }, 500);
    } catch (error) {
      message.error(error || 'Failed to submit post-test');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPreTest = () => {
    dispatch(fetchPreTestForm(id));
    setPreTestOpen(true);
  };

  const handleOpenPostTest = () => {
    dispatch(fetchPostTestForm(id));
    setPostTestOpen(true);
  };

  const captureLocation = async () => {
    if (!navigator.geolocation) {
      throw new Error("Geolocation is not supported by your browser");
    }

    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });

    const { latitude, longitude } = position.coords;
    return { latitude, longitude };
  };

  const handleMarkAttendance = async () => {
    try {
      setSubmitting(true);
      const { latitude, longitude } = await captureLocation();

      await dispatch(
        markSelfAttendance({
          trainingId: id,
          latitude,
          longitude,
        })
      ).unwrap();

      message.success("Attendance marked successfully!");
      dispatch(fetchMyApplications({ trainingId: id, forceRefresh: true }));
      dispatch(fetchApplicationStatus(id));
    } catch (error) {
      message.error(error || "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const getApplicationStepStatus = () => {
    if (!status?.status) return -1;
    const isCompleted = training?.endDate && new Date(training.endDate) < new Date();

    switch (status.status) {
      case "PENDING":
      case "SUBMITTED":
        return 0;
      case "APPROVED":
        return isCompleted ? 2 : 1;
      case "REJECTED":
        return "error";
      default:
        return 0;
    }
  };

  const canApply = !status?.status && capacityInfo.available > 0;
  const canWithdraw = ["PENDING", "SUBMITTED"].includes(status?.status);  
  const isApproved = status?.status === 'APPROVED';

  const currentApplication = useMemo(() => {
    return (applications.list || []).find(
      (app) => app.trainingId === id || app.training?.id === id
    );
  }, [applications.list, id]);

  const hasMarkedAttendanceToday = currentApplication?.hasMarkedAttendanceToday === true;
  
  // Check if training has ended
  const trainingEnded = training?.endDate && new Date(training.endDate) < new Date();
  const trainingOngoing = useMemo(() => {
    if (!training?.startDate || !training?.endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(training.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(training.endDate);
    endDate.setHours(23, 59, 59, 999);
    return today >= startDate && today <= endDate;
  }, [training?.startDate, training?.endDate]);
  
  const hasPendingFeedback = isApproved && trainingEnded && feedbackFormData && (!feedbackStatus?.submitted && !feedbackStatus?.hasSubmitted);

  // Training has pre-test and post-test forms assigned
  const hasPreTest = training?.preTestForm || training?.preTestFormId;
  const hasPostTest = training?.postTestForm || training?.postTestFormId;

  // Check if pre-test/post-test are completed
  const preTestCompleted = preTestStatus?.submitted || preTestStatus?.hasSubmitted;
  const postTestCompleted = postTestStatus?.submitted || postTestStatus?.hasSubmitted;

  // Pre-test is pending if: approved, training has pre-test, hasn't started yet, and not submitted
  const trainingNotStarted = training?.startDate && new Date(training.startDate) > new Date();
  const hasPendingPreTest = isApproved && hasPreTest && !preTestCompleted;

  // Post-test is pending if: approved, training has post-test, training ended, and not submitted
  const hasPendingPostTest = isApproved && hasPostTest && trainingEnded && !postTestCompleted;

  // Helper function to render different field types
  const renderFormField = (question) => {
    switch (question.type) {
      case 'rating':
        return <Rate count={question.options?.max || 5} />;
      
      case 'text':
        return (
          <Input.TextArea
            rows={question.options?.rows || 4}
            placeholder={question.options?.placeholder || 'Enter your response...'}
            maxLength={question.options?.maxLength || 500}
            showCount
          />
        );
      
      case 'multiChoice':
        return (
          <Radio.Group>
            <Space direction="vertical">
              {question.options?.choices?.map((choice, idx) => (
                <Radio key={idx} value={choice}>
                  {choice}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );
      
      case 'checkbox':
        return (
          <Checkbox.Group>
            <Space direction="vertical">
              {question.options?.choices?.map((choice, idx) => (
                <Checkbox key={idx} value={choice}>
                  {choice}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        );
      
      case 'yesNo':
        return (
          <Radio.Group>
            <Radio value={true}>Yes</Radio>
            <Radio value={false}>No</Radio>
          </Radio.Group>
        );
      
      default:
        return <Input placeholder="Enter your response..." />;
    }
  };
  
  // Auto-open feedback modal if there's pending feedback
  useEffect(() => {
    if (hasPendingFeedback && !feedbackSuccess) {
      // Optional: Auto-open after a delay
      // const timer = setTimeout(() => setFeedbackOpen(true), 1000);
      // return () => clearTimeout(timer);
    }
  }, [hasPendingFeedback, feedbackSuccess]);
  if (isLoading) {
    return <TrainingDetailsSkeleton />;
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

      {/* Success State */}
      {applicationSuccess && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          className="mb-4! rounded-xl"
          message="Application Submitted Successfully!"
          description="Your application has been submitted and is awaiting review. You'll receive a notification once it's processed."
          closable
          onClose={() => setApplicationSuccess(false)}
        />
      )}

      {/* Feedback Success */}
      {feedbackSuccess && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          className="mb-6 rounded-xl"
          message="Feedback Submitted Successfully!"
          description="Thank you for your feedback. It helps us improve future training programs."
          closable
          onClose={() => setFeedbackSuccess(false)}
        />
      )}

      {/* Pre-Test Success */}
      {preTestSuccess && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          className="mb-4! rounded-xl"
          message="Pre-Test Submitted Successfully!"
          description="You have completed the pre-test assessment. You are now ready to attend the training."
          closable
          onClose={() => setPreTestSuccess(false)}
        />
      )}

      {/* Post-Test Success */}
      {postTestSuccess && (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          className="mb-4! rounded-xl"
          message="Post-Test Submitted Successfully!"
          description="You have completed the post-test assessment. Thank you for completing this training!"
          closable
          onClose={() => setPostTestSuccess(false)}
        />
      )}

      {/* Pending Pre-Test Alert */}
      {hasPendingPreTest && !preTestSuccess && (
        <Alert
          type="warning"
          showIcon
          icon={<FormOutlined />}
          className="mb-4! rounded-xl"
          message="Pre-Test Required"
          description="Please complete the pre-test assessment before attending this training."
          action={
            <Button size="small" type="primary" onClick={handleOpenPreTest}>
              Take Pre-Test
            </Button>
          }
          closable
        />
      )}

      {/* Pending Post-Test Alert */}
      {hasPendingPostTest && !postTestSuccess && (
        <Alert
          type="info"
          showIcon
          icon={<SolutionOutlined />}
          className="mb-4! rounded-xl"
          message="Post-Test Pending"
          description="You have completed this training. Please complete the post-test assessment."
          action={
            <Button size="small" type="primary" onClick={handleOpenPostTest}>
              Take Post-Test
            </Button>
          }
          closable
        />
      )}

      {/* Pending Feedback Alert */}
      {hasPendingFeedback && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          className="mb-4! rounded-xl"
          message="Feedback Pending"
          description="You have completed this training. Please share your feedback to help us improve."
          action={
            <Button size="small" type="primary" onClick={() => setFeedbackOpen(true)}>
              Submit Feedback
            </Button>
          }
          closable
        />
      )}

      {/* Hero Card */}
      <Card className="rounded-2xl border-border shadow-none mb-6! bg-linear-to-br from-slate-50 via-white to-blue-50">
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24} lg={16}>
            <Space className="mb-3" wrap>
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
            </Space>
            <Title level={2} className="mb-2! training-heading">
              {training?.title || "Training"}
            </Title>
            <Text type="secondary" className="text-base">
              {training?.providedBy || "Training Provider"}
            </Text>
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
                  aria-label="Apply for this training"
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
                  <Button
                    danger
                    size="large"
                    block
                    aria-label="Withdraw your application"
                  >
                    Withdraw Application
                  </Button>
                </Popconfirm>
              )}
              {status?.status === "APPROVED" && (
                <div className="space-y-2!">
                  <Alert
                    message="You're enrolled!"
                    description={
                      trainingEnded
                        ? "Training completed"
                        : trainingOngoing
                          ? "Training is in progress. Mark your attendance for today."
                          : "Your application has been approved."
                    }
                    type="success"
                    showIcon
                  />
                  {/* Pre-Test Button */}
                  {hasPendingPreTest && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<FormOutlined />}
                      onClick={handleOpenPreTest}
                      block
                    >
                      Take Pre-Test
                    </Button>
                  )}
                  {hasPreTest && preTestCompleted && (
                    <div className="text-center text-sm text-green-600">
                      ✓ Pre-test completed
                      {preTestStatus?.score !== undefined && (
                        <span className="ml-2 text-gray-500">
                          (Score: {preTestStatus.score}%)
                        </span>
                      )}
                    </div>
                  )}
                  {trainingOngoing && !hasMarkedAttendanceToday && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<CheckCircleOutlined />}
                      onClick={handleMarkAttendance}
                      loading={submitting}
                      block
                    >
                      Mark Attendance
                    </Button>
                  )}
                  {trainingOngoing && hasMarkedAttendanceToday && (
                    <div className="text-center text-sm text-green-600">
                      ✓ Attendance marked for today
                    </div>
                  )}
                  {/* Post-Test Button */}
                  {hasPendingPostTest && (
                    <Button
                      type="primary"
                      size="large"
                      icon={<SolutionOutlined />}
                      onClick={handleOpenPostTest}
                      block
                    >
                      Take Post-Test
                    </Button>
                  )}
                  {hasPostTest && postTestCompleted && trainingEnded && (
                    <div className="text-center text-sm text-green-600">
                      ✓ Post-test completed
                      {postTestStatus?.score !== undefined && (
                        <span className="ml-2 text-gray-500">
                          (Score: {postTestStatus.score}%)
                        </span>
                      )}
                    </div>
                  )}
                  {hasPendingFeedback && (
                    <Button
                      type="default"
                      size="large"
                      icon={<FileTextOutlined />}
                      onClick={() => setFeedbackOpen(true)}
                      block
                    >
                      Submit Feedback
                    </Button>
                  )}
                  {feedbackStatus?.submitted && trainingEnded && (
                    <div className="text-center text-sm text-green-600">
                      ✓ Feedback submitted
                    </div>
                  )}
                </div>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* About Section */}
          <Card className="rounded-xl border-border shadow-none mb-4!">
            <Title level={4} className="flex items-center gap-2">
              <InfoCircleOutlined className="text-blue-700" />
              About This Training
            </Title>
            <Paragraph className="text-base text-text-secondary">
              {training?.description || "No description provided."}
            </Paragraph>

            <Divider />

            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={CalendarOutlined}
                  label="Training Dates"
                  tooltip="When the training takes place"
                >
                  <TrainingDateRange
                    startDate={training?.startDate}
                    endDate={training?.endDate}
                  />
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={ClockCircleOutlined}
                  label="Duration"
                  tooltip="Total training hours"
                >
                  <Text>
                    {training?.duration ? `${training.duration} hours` : "TBD"}
                  </Text>
                </InfoItem>
              </Col>
            </Row>
          </Card>

          {/* Learning Outcomes */}
          <Card className="rounded-xl border-border shadow-none mb-4!">
            <Title level={4} className="flex items-center gap-2">
              <CheckCircleOutlined className="text-emerald-600" />
              Learning Outcomes
            </Title>
            <Paragraph type="secondary" className="mb-4">
              By the end of this training, participants will be able to:
            </Paragraph>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} />
          </Card>

          {/* Prerequisites */}
          {training?.prerequisites && (
            <Card className="rounded-xl border-border shadow-none mb-4!">
              <Title level={4}>Prerequisites</Title>
              <Paragraph className="text-text-secondary mb-0!">
                {training.prerequisites}
              </Paragraph>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          {/* Deadline Countdown */}
          <div className="mb-4">
            <DeadlineCountdown
              deadline={training?.applicationDeadline}
              label="Application closes in"
              expiredLabel="Application deadline has passed"
            />
          </div>

          {/* Application Status Card */}
          <Card className="rounded-xl border-border shadow-none mb-4!">
            <Title level={4} className="flex items-center gap-2">
              <SendOutlined className="text-blue-700" />
              Application Status
            </Title>

            {status?.status ? (
              <div className="mt-4">
                <Steps
                  direction="vertical"
                  size="small"
                  current={getApplicationStepStatus()}
                  status={
                    status.status === "REJECTED"
                      ? "error"
                      : status.status === "APPROVED" && trainingEnded
                        ? "finish"
                        : "process"
                  }
                  items={[
                    {
                      title: "Applied",
                      description: status.createdAt
                        ? `Submitted on ${new Date(status.createdAt).toLocaleDateString()}`
                        : "Application submitted",
                    },
                    {
                      title: "Review",
                      description:
                        status.status === "APPROVED"
                          ? "Application approved"
                          : status.status === "REJECTED"
                            ? "Application rejected"
                            : "Pending review",
                    },
                    {
                      title: "Enrolled",
                      description:
                        status.status === "APPROVED"
                          ? trainingEnded
                            ? "Training completed"
                            : trainingOngoing
                              ? hasMarkedAttendanceToday
                                ? "Attendance marked for today"
                                : "Training in progress"
                              : "Ready to attend"
                          : "Awaiting approval",
                    },
                  ]}
                />
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
                {capacityInfo.available === 0 && !status?.status && (
                  <Alert
                    className="mt-4"
                    message="Training Full"
                    description="This training has reached its capacity."
                    type="warning"
                  />
                )}
              </div>
            )}
          </Card>

          {/* Trainer & Venue Card */}
          <Card className="rounded-xl border-border shadow-none">
            <Title level={4} className="flex items-center gap-2">
              <UserOutlined className="text-blue-700" />
              Trainer & Venue
            </Title>

            <div className="space-y-4">
              {training?.trainerName && (
                <div className="flex items-center gap-3">
                  <Avatar
                    size={40}
                    icon={<UserOutlined />}
                    className="bg-blue-100 text-blue-700"
                  />
                  <div>
                    <Text strong>{training.trainerName}</Text>
                    <Text type="secondary" className="text-xs block">
                      Trainer
                    </Text>
                  </div>
                </div>
              )}

              <Descriptions column={1} size="small">
                <Descriptions.Item
                  label={
                    <span className="flex items-center gap-1">
                      <EnvironmentOutlined /> Venue
                    </span>
                  }
                >
                  {training?.venue || "TBD"}
                </Descriptions.Item>
                {training?.meetingLink && (
                  <Descriptions.Item
                    label={
                      <span className="flex items-center gap-1">
                        <LinkOutlined /> Meeting Link
                      </span>
                    }
                  >
                    <a
                      href={training.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary"
                    >
                      Join Online
                    </a>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Application Modal */}
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
              <TrainingDateRange
                startDate={training?.startDate}
                endDate={training?.endDate}
              />
            }
            type="info"
            className="mb-4"
          />

          <Form layout="vertical" form={form}>
            <Form.Item
              name="relevanceToTeaching"
              label="How is this training relevant to your teaching?"
              rules={[
                { required: true, message: "Please explain the relevance" },
              ]}
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
              rules={[
                {
                  required: true,
                  message: "Please describe your application plan",
                },
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Explain how you will integrate the knowledge gained into your classroom practice..."
                showCount
                maxLength={500}
              />
            </Form.Item>
          </Form>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <Text className="text-xs text-blue-700">
              <strong>Note:</strong> Your application will be reviewed by the
              training administrator. You'll receive a notification once it's
              processed.
            </Text>
          </div>
        </div>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-700" />
            {feedbackFormData?.title || "Submit Training Feedback"}
          </div>
        }
        open={feedbackOpen}
        onCancel={() => setFeedbackOpen(false)}
        onOk={handleFeedbackSubmit}
        okText="Submit Feedback"
        confirmLoading={submitting}
        width={600}
      >
        <div className="py-2">
          {feedbackFormData?.description && (
            <Alert
              message={feedbackFormData.description}
              type="info"
              className="mb-4"
            />
          )}

          {!feedbackFormData ? (
            <Alert
              message="No feedback form available"
              description="This training does not have a feedback form configured."
              type="warning"
            />
          ) : (
            <Form layout="vertical" form={feedbackFormInstance}>
              {feedbackFormData.questions?.map((question) => (
                <Form.Item
                  key={question.id}
                  name={question.id}
                  label={question.question}
                  rules={[
                    {
                      required: question.required,
                      message: `Please provide an answer for: ${question.question}`,
                    },
                  ]}
                >
                  {renderFormField(question)}
                </Form.Item>
              ))}
            </Form>
          )}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <Text className="text-xs text-blue-700">
              <strong>Note:</strong> Your honest feedback helps us improve the
              quality of our training programs.
            </Text>
          </div>
        </div>
      </Modal>

      {/* Pre-Test Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FormOutlined className="text-blue-700" />
            {preTestFormData?.title || "Pre-Test Assessment"}
          </div>
        }
        open={preTestOpen}
        onCancel={() => setPreTestOpen(false)}
        onOk={handlePreTestSubmit}
        okText="Submit Pre-Test"
        confirmLoading={submitting}
        width={600}
      >
        <div className="py-2">
          {preTestFormData?.description && (
            <Alert
              message={preTestFormData.description}
              type="info"
              className="mb-4"
            />
          )}

          {preTest?.loading ? (
            <div className="text-center py-8">
              <Text type="secondary">Loading pre-test form...</Text>
            </div>
          ) : !preTestFormData ? (
            <Alert
              message="No pre-test form available"
              description="This training does not have a pre-test form configured."
              type="warning"
            />
          ) : (
            <Form layout="vertical" form={preTestFormInstance}>
              {preTestFormData.questions?.map((question, index) => (
                <Form.Item
                  key={question.id || index}
                  name={question.id || `question_${index}`}
                  label={`${index + 1}. ${question.question}`}
                  rules={[
                    {
                      required: question.required !== false,
                      message: `Please provide an answer for this question`,
                    },
                  ]}
                >
                  {renderFormField(question)}
                </Form.Item>
              ))}
            </Form>
          )}

          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <Text className="text-xs text-amber-700">
              <strong>Note:</strong> Please complete this pre-test assessment before
              attending the training. Your responses help us understand your
              current knowledge level.
            </Text>
          </div>
        </div>
      </Modal>

      {/* Post-Test Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <SolutionOutlined className="text-blue-700" />
            {postTestFormData?.title || "Post-Test Assessment"}
          </div>
        }
        open={postTestOpen}
        onCancel={() => setPostTestOpen(false)}
        onOk={handlePostTestSubmit}
        okText="Submit Post-Test"
        confirmLoading={submitting}
        width={600}
      >
        <div className="py-2">
          {postTestFormData?.description && (
            <Alert
              message={postTestFormData.description}
              type="info"
              className="mb-4"
            />
          )}

          {postTest?.loading ? (
            <div className="text-center py-8">
              <Text type="secondary">Loading post-test form...</Text>
            </div>
          ) : !postTestFormData ? (
            <Alert
              message="No post-test form available"
              description="This training does not have a post-test form configured."
              type="warning"
            />
          ) : (
            <Form layout="vertical" form={postTestFormInstance}>
              {postTestFormData.questions?.map((question, index) => (
                <Form.Item
                  key={question.id || index}
                  name={question.id || `question_${index}`}
                  label={`${index + 1}. ${question.question}`}
                  rules={[
                    {
                      required: question.required !== false,
                      message: `Please provide an answer for this question`,
                    },
                  ]}
                >
                  {renderFormField(question)}
                </Form.Item>
              ))}
            </Form>
          )}

          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <Text className="text-xs text-green-700">
              <strong>Note:</strong> Please complete this post-test assessment to
              measure your learning outcomes from the training.
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TrainingDetailsPage;
