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
  Progress,
  Steps,
  Tag,
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
import trainingService from "../../../services/training.service";
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
  fetchTrainingAttendance,
  fetchPreTestForm,
  fetchPostTestForm,
  fetchTestStatuses,
  submitPreTest,
  submitPostTest,
} from "../store/facultyTrainingSlice";

const { Title, Text, Paragraph } = Typography;

const InfoItem = ({ icon: Icon, label, children, tooltip }) => (
  <div className="flex items-start gap-2.5 py-1.5">
    <Tooltip title={tooltip}>
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 shrink-0">
        <Icon className="text-blue-700 text-xs" />
      </div>
    </Tooltip>
    <div className="flex-1 min-w-0">
      <Text
        type="secondary"
        className="text-[10px] uppercase tracking-wider font-semibold block leading-tight"
      >
        {label}
      </Text>
      <div className="mt-0">{children}</div>
    </div>
  </div>
);

const formatCountdown = (seconds) => {
  if (seconds === null || seconds === undefined) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const TrainingDetailsPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    currentTraining,
    applicationStatus,
    upcoming,
    feedback,
    applications,
    preTest,
    postTest,
    attendance,
  } = useSelector((state) => state.facultyTraining);
  const [applyOpen, setApplyOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [preTestOpen, setPreTestOpen] = useState(false);
  const [postTestOpen, setPostTestOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [preTestSuccess, setPreTestSuccess] = useState(false);
  const [postTestSuccess, setPostTestSuccess] = useState(false);
  const [feedbackFormInstance] = Form.useForm();
  const [preTestFormInstance] = Form.useForm();
  const [postTestFormInstance] = Form.useForm();
  const [preTestRemainingSeconds, setPreTestRemainingSeconds] = useState(null);
  const [postTestRemainingSeconds, setPostTestRemainingSeconds] = useState(null);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchTrainingDetails(id));
    dispatch(checkEligibility(id));
    dispatch(fetchApplicationStatus(id));
    dispatch(fetchMyApplications({ trainingId: id }));
    dispatch(fetchFeedbackStatus(id));
    dispatch(fetchFeedbackForm(id));
    dispatch(fetchTestStatuses(id));
    dispatch(fetchTrainingAttendance(id));
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
    if (currentTraining?.eligibility?.eligible === false) {
      message.warning(
        currentTraining.eligibility.reason ||
          "You are not eligible to apply for this training.",
      );
      setApplyOpen(false);
      return;
    }

    try {
      setSubmitting(true);
      await dispatch(applyForTraining({ trainingId: id })).unwrap();
      setApplicationSuccess(true);
      setApplyOpen(false);
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

      await dispatch(
        submitFeedback({ trainingId: id, data: payload }),
      ).unwrap();
      setFeedbackSuccess(true);
      setFeedbackOpen(false);
      feedbackFormInstance.resetFields();
      message.success("Feedback submitted successfully!");

      // Refresh feedback status after a short delay to ensure backend has processed
      setTimeout(() => {
        dispatch(fetchFeedbackStatus(id));
      }, 500);
    } catch (error) {
      message.error(error || "Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreTestSubmit = async () => {
    if (
      preTestStatus?.timerEnabled &&
      preTestRemainingSeconds !== null &&
      preTestRemainingSeconds <= 0
    ) {
      message.error("Pre-test time is over. Submission is not allowed.");
      dispatch(fetchTestStatuses(id));
      return;
    }

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
        testFormId: preTestFormData.id,
        trainingId: id,
        responses,
      };

      await dispatch(submitPreTest({ trainingId: id, data: payload })).unwrap();
      setPreTestSuccess(true);
      setPreTestOpen(false);
      preTestFormInstance.resetFields();
      message.success("Pre-test submitted successfully!");

      setTimeout(() => {
        dispatch(fetchTestStatuses(id));
      }, 500);
    } catch (error) {
      message.error(error || "Failed to submit pre-test");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostTestSubmit = async () => {
    if (
      postTestStatus?.timerEnabled &&
      postTestRemainingSeconds !== null &&
      postTestRemainingSeconds <= 0
    ) {
      message.error("Post-test time is over. Submission is not allowed.");
      dispatch(fetchTestStatuses(id));
      return;
    }

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
        testFormId: postTestFormData.id,
        trainingId: id,
        responses,
      };

      await dispatch(
        submitPostTest({ trainingId: id, data: payload }),
      ).unwrap();
      setPostTestSuccess(true);
      setPostTestOpen(false);
      postTestFormInstance.resetFields();
      message.success("Post-test submitted successfully!");

      setTimeout(() => {
        dispatch(fetchTestStatuses(id));
      }, 500);
    } catch (error) {
      message.error(error || "Failed to submit post-test");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPreTest = () => {
    const openPreTestAsync = async () => {
      if (status?.status !== "APPROVED") {
        message.warning("Pre-test is only available for approved participants.");
        return;
      }

      try {
        const latestStatus = await trainingService.getPreTestStatus(id);
        if (latestStatus?.canStart === false) {
          message.warning(latestStatus?.lockReason || "Pre-test is not live right now.");
          return;
        }

        const startData = await trainingService.startPreTest(id);
        setPreTestRemainingSeconds(startData?.remainingSeconds ?? null);
        dispatch(fetchPreTestForm(id));
        dispatch(fetchTestStatuses(id));
        setPreTestOpen(true);
      } catch (error) {
        message.error(error?.response?.data?.message || "Unable to start pre-test");
      }
    };

    openPreTestAsync();
  };

  const handleOpenPostTest = () => {
    const openPostTestAsync = async () => {
      if (status?.status !== "APPROVED") {
        message.warning("Post-test is only available for approved participants.");
        return;
      }

      try {
        const latestStatus = await trainingService.getPostTestStatus(id);
        if (latestStatus?.canStart === false) {
          message.warning(latestStatus?.lockReason || "Post-test is not live right now.");
          return;
        }

        const startData = await trainingService.startPostTest(id);
        setPostTestRemainingSeconds(startData?.remainingSeconds ?? null);
        dispatch(fetchPostTestForm(id));
        dispatch(fetchTestStatuses(id));
        setPostTestOpen(true);
      } catch (error) {
        message.error(error?.response?.data?.message || "Unable to start post-test");
      }
    };

    openPostTestAsync();
  };

  useEffect(() => {
    if (!preTestOpen || preTestRemainingSeconds === null) return;
    if (preTestRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setPreTestRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [preTestOpen, preTestRemainingSeconds]);

  useEffect(() => {
    if (!postTestOpen || postTestRemainingSeconds === null) return;
    if (postTestRemainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setPostTestRemainingSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [postTestOpen, postTestRemainingSeconds]);

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
    if (status?.status !== "APPROVED") {
      message.warning("Attendance can only be marked after approval.");
      return;
    }

    try {
      setSubmitting(true);
      const { latitude, longitude } = await captureLocation();

      await dispatch(
        markSelfAttendance({
          trainingId: id,
          latitude,
          longitude,
        }),
      ).unwrap();

      message.success("Attendance marked successfully!");
      dispatch(fetchMyApplications({ trainingId: id, forceRefresh: true }));
      dispatch(fetchApplicationStatus(id));
      dispatch(fetchTrainingAttendance(id));
    } catch (error) {
      message.error(error || "Failed to mark attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const getApplicationStepStatus = () => {
    if (!status?.status) return -1;
    const isCompleted =
      training?.endDate && new Date(training.endDate) < new Date();

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

  const trainingEnded =
    training?.endDate && new Date(training.endDate) < new Date();
  const isEligibleToApply =
    currentTraining?.eligibility?.eligible !== false;
  const canApply =
    !status?.status &&
    capacityInfo.available > 0 &&
    !trainingEnded &&
    isEligibleToApply;
  const canWithdraw = ["PENDING", "SUBMITTED"].includes(status?.status);
  const isApproved = status?.status === "APPROVED";

  const currentApplication = useMemo(() => {
    return (applications.list || []).find(
      (app) => app.trainingId === id || app.training?.id === id,
    );
  }, [applications.list, id]);

  const hasMarkedAttendanceToday =
    currentApplication?.hasMarkedAttendanceToday === true;
  const trainingAttendance = attendance?.byTraining?.[id];
  const attendedDays = trainingAttendance?.attendedDays || 0;
  const totalDays = trainingAttendance?.totalDays || 0;
  const attendancePercent = totalDays > 0 ? Math.round((attendedDays / totalDays) * 100) : 0;

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

  const hasPendingFeedback =
    isApproved &&
    trainingEnded &&
    feedbackFormData &&
    !feedbackStatus?.submitted &&
    !feedbackStatus?.hasSubmitted;

  // Training has pre-test and post-test forms assigned
  const hasPreTest = training?.preTestForm || training?.preTestFormId;
  const hasPostTest = training?.postTestForm || training?.postTestFormId;

  // Check if pre-test/post-test are completed
  const preTestCompleted =
    preTestStatus?.submitted || preTestStatus?.hasSubmitted;
  const postTestCompleted =
    postTestStatus?.submitted || postTestStatus?.hasSubmitted;

  // Pre-test is pending if: approved, training has pre-test, hasn't started yet, and not submitted
  const trainingNotStarted =
    training?.startDate && new Date(training.startDate) > new Date();
  const hasPendingPreTest = isApproved && hasPreTest && !preTestCompleted;

  const isApplicationDeadlinePassed = training?.applicationDeadline
    ? new Date(training.applicationDeadline) < new Date()
    : false;

  // Post-test is pending if: approved, training has post-test, training ended, and not submitted
  const hasPendingPostTest =
    isApproved && hasPostTest && trainingEnded && !postTestCompleted;

  const pendingActions = [
    hasPendingPreTest
      ? {
          key: "preTest",
          title: "Pre-Test Required",
          description: "Complete your pre-test assessment.",
          type: "warning",
          icon: <FormOutlined />,
          buttonText: "Take Pre-Test",
          onClick: handleOpenPreTest,
        }
      : null,
    hasPendingPostTest
      ? {
          key: "postTest",
          title: "Post-Test Pending",
          description: "Submit your post-test assessment.",
          type: "info",
          icon: <SolutionOutlined />,
          buttonText: "Take Post-Test",
          onClick: handleOpenPostTest,
        }
      : null,
    hasPendingFeedback
      ? {
          key: "feedback",
          title: "Feedback Pending",
          description: "Share your feedback for this training.",
          type: "info",
          icon: <FileTextOutlined />,
          buttonText: "Submit Feedback",
          onClick: () => setFeedbackOpen(true),
        }
      : null,
  ].filter(Boolean);

  // Helper function to render different field types
  const renderFormField = (question) => {
    switch (question.type) {
      case "rating":
        return <Rate count={question.options?.max || 5} />;

      case "text":
        return (
          <Input.TextArea
            rows={question.options?.rows || 4}
            placeholder={
              question.options?.placeholder || "Enter your response..."
            }
            maxLength={question.options?.maxLength || 500}
            showCount
          />
        );

      case "multiChoice":
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

      case "checkbox":
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

      case "yesNo":
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
    <div className="p-4 training-ui">
      <div className="mb-3">
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          className="text-text-secondary hover:text-primary text-xs"
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
          className="mb-3! rounded-xl"
          message={
            <span className="text-sm font-semibold">
              Application Submitted Successfully!
            </span>
          }
          description={
            <span className="text-xs">
              Your application has been submitted and is awaiting review.
            </span>
          }
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
          className="mb-4 rounded-xl"
          message={
            <span className="text-sm font-semibold">
              Feedback Submitted Successfully!
            </span>
          }
          description={
            <span className="text-xs">Thank you for your feedback.</span>
          }
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
          className="mb-3! rounded-xl"
          message={
            <span className="text-sm font-semibold">
              Pre-Test Submitted Successfully!
            </span>
          }
          description={
            <span className="text-xs">
              You are now ready to attend the training.
            </span>
          }
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
          className="mb-3! rounded-xl"
          message={
            <span className="text-sm font-semibold">
              Post-Test Submitted Successfully!
            </span>
          }
          description={
            <span className="text-xs">
              Thank you for completing this training!
            </span>
          }
          closable
          onClose={() => setPostTestSuccess(false)}
        />
      )}

      {pendingActions.length > 0 && (
        <Row gutter={[8, 8]} className="mb-3">
          {pendingActions.map((action) => (
            <Col xs={24} sm={12} lg={8} key={action.key}>
              <Alert
                type={action.type}
                showIcon
                icon={action.icon}
                className="rounded-lg h-full"
                message={
                  <span className="text-xs font-semibold">{action.title}</span>
                }
                description={
                  <span className="text-[10px]">{action.description}</span>
                }
                action={
                  <Button size="small" type="primary" onClick={action.onClick}>
                    {action.buttonText}
                  </Button>
                }
              />
            </Col>
          ))}
        </Row>
      )}

      {/* Hero Card */}
      <Card
        className="rounded-xl border-border shadow-none mb-3!"
        styles={{ body: { padding: "14px" } }}
      >
        <Row gutter={[12, 12]} align="top">
          <Col xs={24} lg={15}>
            <Space className="mb-1.5" wrap>
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
              {trainingEnded && <Tag color="default">Completed</Tag>}
            </Space>
            <Title level={4} className="mb-1! mt-0 leading-tight">
              {training?.title || "Training"}
            </Title>
            <Text type="secondary" className="text-xs sm:text-sm">
              {training?.providedBy || "Training Provider"}
            </Text>
          </Col>
          <Col xs={24} lg={9}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {canApply && (
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={() => setApplyOpen(true)}
                  block
                  aria-label="Apply for this training"
                >
                  Apply Now
                </Button>
              )}
              {!status?.status && !isEligibleToApply && (
                <Alert
                  className="p-1.5 text-left"
                  type="warning"
                  showIcon
                  message={
                    <span className="text-xs font-semibold">
                      Not eligible to apply
                    </span>
                  }
                  description={
                    <span className="text-[10px]">
                      {currentTraining?.eligibility?.reason ||
                        "This training is not available for your branch."}
                    </span>
                  }
                />
              )}
              {canWithdraw && (
                <Popconfirm
                  title="Withdraw application?"
                  description="Are you sure?"
                  onConfirm={handleWithdraw}
                  okText="Yes"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger size="small" block>
                    Withdraw Application
                  </Button>
                </Popconfirm>
              )}
              {status?.status === "APPROVED" && (
                <div className="space-y-1.5">
                  <Alert
                    className="p-1.5 text-left"
                    message={
                      <span className="text-xs font-semibold">
                        You're enrolled!
                      </span>
                    }
                    description={
                      <span className="text-[10px]">
                        {trainingEnded
                          ? "Training completed"
                          : trainingOngoing
                            ? "Training in progress. Mark attendance."
                            : "Your application has been approved."}
                      </span>
                    }
                    type="success"
                    showIcon
                  />
                  {hasPreTest && preTestCompleted && (
                    <div className="text-center text-xs text-green-600">
                      ✓ Pre-test completed
                    </div>
                  )}
                  {totalDays > 0 && (
                    <div className="bg-slate-50 rounded-md px-2 py-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-600">Attendance</span>
                        <span className="text-[10px] font-semibold text-slate-700">
                          {attendedDays}/{totalDays} days
                        </span>
                      </div>
                      <Progress percent={attendancePercent} size="small" showInfo={false} />
                    </div>
                  )}
                  {trainingOngoing && !hasMarkedAttendanceToday && (totalDays === 0 || attendedDays < totalDays) && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={handleMarkAttendance}
                      loading={submitting}
                      block
                    >
                      Mark Attendance
                    </Button>
                  )}
                  {trainingOngoing && hasMarkedAttendanceToday && (
                    <div className="text-center text-xs text-green-600">
                      ✓ Attendance marked
                    </div>
                  )}
                  {hasPostTest && postTestCompleted && trainingEnded && (
                    <div className="text-center text-xs text-green-600">
                      ✓ Post-test completed
                    </div>
                  )}
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          {/* About Section */}
          <Card
            className="rounded-xl border-border shadow-none mb-3!"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <InfoCircleOutlined className="text-blue-700" />
                <span>About This Training</span>
              </div>
            }
          >
            <Paragraph className="text-sm text-text-secondary mb-3">
              {training?.description || "No description provided."}
            </Paragraph>

            <Divider className="my-3" />

            <Row gutter={[20, 12]}>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={CalendarOutlined}
                  label="Training Dates"
                  tooltip="When the training takes place"
                >
                  <TrainingDateRange
                    startDate={training?.startDate}
                    endDate={training?.endDate}
                    compact
                  />
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={ClockCircleOutlined}
                  label="Duration"
                  tooltip="Total training hours"
                >
                  <Text className="text-sm">
                    {training?.duration ? `${training.duration} hours` : "TBD"}
                  </Text>
                </InfoItem>
              </Col>
            </Row>
          </Card>

          {/* Learning Outcomes */}
          <Card
            className="rounded-xl border-border shadow-none mb-3!"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <CheckCircleOutlined className="text-emerald-600" />
                <span>Learning Outcomes</span>
              </div>
            }
          >
            <Paragraph type="secondary" className="mb-2 text-xs">
              By the end of this training, participants will be able to:
            </Paragraph>
            <LearningOutcomesList
              outcomes={training?.learningOutcomes || []}
              compact
            />
          </Card>

          {/* Prerequisites */}
          {training?.prerequisites && (
            <Card
              className="rounded-xl border-border shadow-none mb-3!"
              styles={{
                header: { padding: "8px 16px", minHeight: "auto" },
                body: { padding: "16px" },
              }}
              title={<span className="text-sm">Prerequisites</span>}
            >
              <Paragraph className="text-sm text-text-secondary mb-0!">
                {training.prerequisites}
              </Paragraph>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          {/* Deadline Countdown */}
          {!isApplicationDeadlinePassed && (
            <div className="mb-3">
              <DeadlineCountdown
                deadline={training?.applicationDeadline}
                label="Application closes in"
                expiredLabel="Deadline passed"
                compact
              />
            </div>
          )}

          {/* Application Status Card */}
          <Card
            className="rounded-xl border-border shadow-none mb-3!"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <SendOutlined className="text-blue-700" />
                <span>Application Status</span>
              </div>
            }
          >
            {status?.status ? (
              <div className="mt-2">
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
                      title: <span className="text-xs">Applied</span>,
                      description: (
                        <span className="text-[10px]">
                          {status.createdAt
                            ? `${new Date(status.createdAt).toLocaleDateString()}`
                            : "Submitted"}
                        </span>
                      ),
                    },
                    {
                      title: <span className="text-xs">Review</span>,
                      description: (
                        <span className="text-[10px]">
                          {status.status === "APPROVED"
                            ? "Approved"
                            : status.status === "REJECTED"
                              ? "Rejected"
                              : "Pending"}
                        </span>
                      ),
                    },
                    {
                      title: <span className="text-xs">Enrolled</span>,
                      description: (
                        <span className="text-[10px]">
                          {status.status === "APPROVED"
                            ? trainingEnded
                              ? "Completed"
                              : "Ready"
                            : "Awaiting"}
                        </span>
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-2">
                  <SendOutlined className="text-xl text-blue-700" />
                </div>
                <Text type="secondary" className="block text-xs">
                  Not applied yet.
                </Text>
              </div>
            )}
          </Card>

          {/* Trainer & Venue Card */}
          <Card
            className="rounded-xl border-border shadow-none"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={
              <div className="flex items-center gap-2 text-sm">
                <span>Trainer & Venue</span>
              </div>
            }
          >
            <div className="space-y-3">
              {training?.trainerName && (
                <div className="flex items-center gap-2.5">
                  <div>
                    <Text strong className="text-sm block leading-tight">
                      {training.trainerName}
                    </Text>
                    <Text type="secondary" className="text-[10px] block">
                      Trainer
                    </Text>
                  </div>
                </div>
              )}

              <Descriptions
                column={1}
                size="small"
                className="compact-descriptions"
              >
                <Descriptions.Item
                  label={
                    <span className="flex items-center gap-1 text-xs">
                      <EnvironmentOutlined /> Venue
                    </span>
                  }
                >
                  <span className="text-xs">{training?.venue || "TBD"}</span>
                </Descriptions.Item>
                {training?.meetingLink && (
                  <Descriptions.Item
                    label={
                      <span className="flex items-center gap-1 text-xs">
                        <LinkOutlined /> Link
                      </span>
                    }
                  >
                    <a
                      href={training.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs"
                    >
                      Join
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
        onCancel={() => {
          setPreTestOpen(false);
          dispatch(fetchTestStatuses(id));
        }}
        onOk={handlePreTestSubmit}
        okText="Submit Pre-Test"
        confirmLoading={submitting}
        width={600}
        okButtonProps={{
          disabled:
            preTestStatus?.timerEnabled &&
            preTestRemainingSeconds !== null &&
            preTestRemainingSeconds <= 0,
        }}
      >
        <div className="py-2">
          {preTestFormData?.description && (
            <Alert
              message={preTestFormData.description}
              type="info"
              className="mb-4"
            />
          )}

          {preTestStatus?.timerEnabled && preTestRemainingSeconds !== null && (
            <Alert
              type={preTestRemainingSeconds > 0 ? "warning" : "error"}
              className="mb-4"
              message={`Time Remaining: ${formatCountdown(preTestRemainingSeconds)}`}
              description={
                preTestRemainingSeconds > 0
                  ? "Submit before timer ends."
                  : "Time is over. You cannot submit this attempt."
              }
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
            <Form
              layout="vertical"
              form={preTestFormInstance}
              disabled={
                preTestStatus?.timerEnabled &&
                preTestRemainingSeconds !== null &&
                preTestRemainingSeconds <= 0
              }
            >
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
              <strong>Note:</strong> Please complete this pre-test assessment
              before attending the training. Your responses help us understand
              your current knowledge level.
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
        onCancel={() => {
          setPostTestOpen(false);
          dispatch(fetchTestStatuses(id));
        }}
        onOk={handlePostTestSubmit}
        okText="Submit Post-Test"
        confirmLoading={submitting}
        width={600}
        okButtonProps={{
          disabled:
            postTestStatus?.timerEnabled &&
            postTestRemainingSeconds !== null &&
            postTestRemainingSeconds <= 0,
        }}
      >
        <div className="py-2">
          {postTestFormData?.description && (
            <Alert
              message={postTestFormData.description}
              type="info"
              className="mb-4"
            />
          )}

          {postTestStatus?.timerEnabled && postTestRemainingSeconds !== null && (
            <Alert
              type={postTestRemainingSeconds > 0 ? "warning" : "error"}
              className="mb-4"
              message={`Time Remaining: ${formatCountdown(postTestRemainingSeconds)}`}
              description={
                postTestRemainingSeconds > 0
                  ? "Submit before timer ends."
                  : "Time is over. You cannot submit this attempt."
              }
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
            <Form
              layout="vertical"
              form={postTestFormInstance}
              disabled={
                postTestStatus?.timerEnabled &&
                postTestRemainingSeconds !== null &&
                postTestRemainingSeconds <= 0
              }
            >
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
              <strong>Note:</strong> Please complete this post-test assessment
              to measure your learning outcomes from the training.
            </Text>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TrainingDetailsPage;
