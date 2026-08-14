import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Form,
  Modal,
  Space,
  Table,
  Typography,
  Tooltip,
  message,
} from "antd";
import {
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  fetchStateTrainingDashboard,
  fetchStateFeedbackForms,
  fetchStatePreTestForms,
  fetchStatePostTestForms,
  createStateTraining,
} from "../store/stateTrainingSlice";
import TrainingForm from "./components/training/TrainingForm";
import EngagementDetailsModal from "../../../components/training/EngagementDetailsModal";
import EngagementCard from "../../../components/training/EngagementCard";

const { Title, Text } = Typography;
const TRAINING_FORM_STEP_TITLES = ["Basic Info", "Schedule", "Capacity", "Settings"];

const asNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const STAT_VARIANTS = {
  primary: {
    iconWrap: "bg-blue-100",
    iconColor: "text-blue-700",
  },
  warning: {
    iconWrap: "bg-amber-100",
    iconColor: "text-amber-700",
  },
  purple: {
    iconWrap: "bg-purple-100",
    iconColor: "text-purple-700",
  },
  success: {
    iconWrap: "bg-emerald-100",
    iconColor: "text-emerald-700",
  },
};

const StatCard = ({ icon: Icon, title, lines = [], onClick, onView, infoTooltip, variant = "primary" }) => {
  const styles = STAT_VARIANTS[variant] || STAT_VARIANTS.primary;

  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 ${onClick ? "cursor-pointer hover:shadow-sm transition-all" : ""}`}
      onClick={onClick}
    >
      {/* Icon + Title */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${styles.iconWrap}`}>
            <Icon className={`text-xs ${styles.iconColor}`} />
          </span>
          <Text className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-1">
            {title}
          </Text>
          {infoTooltip ? (
            <Tooltip title={infoTooltip}>
              <InfoCircleOutlined className="text-[11px] text-slate-400" />
            </Tooltip>
          ) : null}
        </div>
        {onView ? (
          <button
            type="button"
            aria-label={`View ${title}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:bg-slate-200/70 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onView();
            }}
          >
            <EyeOutlined className="text-xs" />
          </button>
        ) : null}
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text key={String(line.label || '')} className="block text-[12px] leading-snug text-slate-600">
            {String(line.label || '')}:{" "}
            {line.tooltip ? (
              <Tooltip title={line.tooltip}>
                <span className="font-semibold text-slate-800 border-b border-dashed border-slate-400 cursor-help">
                  {String(line.value ?? '-')}
                </span>
              </Tooltip>
            ) : (
              <span className="font-semibold text-slate-800">{String(line.value ?? '-')}</span>
            )}
          </Text>
        ))}
      </div>
    </div>
  );
};

const TrainingDashboardPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { reports, feedbackForms, preTestForms, postTestForms } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [form] = Form.useForm();
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [formStep, setFormStep] = React.useState(0);
  const [formLoading, setFormLoading] = React.useState(false);
  const [detailModalType, setDetailModalType] = React.useState(null);

  useEffect(() => {
    dispatch(fetchStateTrainingDashboard());

    if (!feedbackForms.list?.length) {
      dispatch(fetchStateFeedbackForms());
    }
    if (!preTestForms.list?.length) {
      dispatch(fetchStatePreTestForms({ forceRefresh: true }));
    }
    if (!postTestForms.list?.length) {
      dispatch(fetchStatePostTestForms({ forceRefresh: true }));
    }
  }, [dispatch]);

  const handleOpenCreateModal = () => {
    form.resetFields();
    setFormStep(0);
    setCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    setFormStep(0);
    form.resetFields();
  };

  const handleCreateTraining = async (values) => {
    setFormLoading(true);
    try {
      await dispatch(createStateTraining(values)).unwrap();
      message.success("Training created successfully");
      handleCloseCreateModal();
      dispatch(fetchStateTrainingDashboard());
    } catch (error) {
      message.error(error || "Failed to create training");
    } finally {
      setFormLoading(false);
    }
  };

  const dashboard = reports.dashboard || {};

  const trainings = dashboard.trainings || {};
  const applications = dashboard.applications || {};
  const summary = dashboard.summary || {};
  const lessonPlans = dashboard.lessonPlans || {};
  const facultyTrainingDetails = dashboard.facultyTrainingDetails || {};
  const trainingWiseSummary = dashboard.trainingWiseSummary || [];
  const engagementDetails = dashboard.engagementDetails || {};
  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};
  const testPerformance = dashboard.testPerformance || {};
  const feedback = dashboard.feedback || {};
  const preTestResponses = dashboard.preTestResponses || {};
  const postTestResponses = dashboard.postTestResponses || {};
  const courseWiseFaculty = dashboard.courseWiseFaculty || [];
  const normalizedCourseWiseFaculty = useMemo(
    () =>
      (Array.isArray(courseWiseFaculty) ? courseWiseFaculty : []).map((item, index) => ({
        ...item,
        // Support current and legacy key names from different dashboard responses.
        course: item?.course || item?.courseName || `Course ${index + 1}`,
        facultyCount: asNumber(item?.facultyCount ?? item?.faculty_count),
        totalCourseTrainings: asNumber(
          item?.totalCourseTrainings ??
            item?.totalCourseTrainingCount ??
            item?.total_course_trainings ??
            item?.trainingCount ??
            item?.training_count,
        ),
        completedTrainingsCount: asNumber(
          item?.completedTrainingsCount ??
            item?.completedTrainingCount ??
            item?.completedTrainings ??
            item?.completed_count,
        ),
        feedbackSubmittedCount: asNumber(
          item?.feedbackSubmittedCount ??
            item?.feedbackSubmissionCount ??
            item?.feedbackSubmitted ??
            item?.feedback_count,
        ),
      })),
    [courseWiseFaculty],
  );

  const approvedApplicationsCountFallback = summary.nominations || applications.total || 0;

  const detailModalRows = useMemo(() => {
    if (detailModalType === "faculty") {
      if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
        return trainingWiseSummary.map((item, index) => ({
          trainingId: item?.trainingId || `training-${index + 1}`,
          trainingTitle: item?.trainingTitle || item?.title || `Training ${index + 1}`,
          startDate: item?.startDate,
          endDate: item?.endDate,
          totalTrainings: item?.totalTrainings ?? 1,
          totalNominations: item?.totalNominations ?? 0,
          facultyWithFullAttendanceMarked: item?.facultyWithFullAttendanceMarked ?? 0,
          facultyWithNotFullAttendance: item?.facultyWithNotFullAttendance ?? 0,
        }));
      }

      return [
        {
          metric: "Total Trainings",
          count: facultyTrainingDetails.totalTrainings ?? trainings.total ?? 0,
        },
        {
          metric: "Total Nominations",
          count: facultyTrainingDetails.totalNominations ?? summary.nominations ?? applications.total ?? 0,
        },
        {
          metric: "Faculty with Full Attendance Marked",
          count:
            facultyTrainingDetails.facultyWithFullAttendanceMarked ??
            facultyMetrics.facultyWithCompletedTrainings ??
            0,
        },
        {
          metric: "Faculty with Not Full Attendance",
          count: facultyTrainingDetails.facultyWithNotFullAttendance ?? 0,
        },
      ];
    }

    if (detailModalType === "engagement") {
      // Use training-wise data if available (each item has per-training engagement breakdown)
      if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
        return trainingWiseSummary.map((item, index) => ({
          trainingId: item?.trainingId || `training-${index + 1}`,
          trainingTitle: item?.trainingTitle || item?.title || `Training ${index + 1}`,
          startDate: item?.startDate,
          endDate: item?.endDate,
          lessonPlanRequired: item?.lessonPlanRequired ?? 0,
          lessonPlanDone: item?.lessonPlanDone ?? 0,
          preTestRequired: item?.preTestRequired ?? 0,
          preTestDone: item?.preTestDone ?? 0,
          postTestRequired: item?.postTestRequired ?? 0,
          postTestDone: item?.postTestDone ?? 0,
          feedbackRequired: item?.feedbackRequired ?? 0,
          feedbackDone: item?.feedbackDone ?? 0,
        }));
      }

      // Fallback: simple item-wise format
      return [
        {
          item: "Lesson Plan",
          required: engagementDetails.lessonPlan?.required ?? approvedApplicationsCountFallback,
          done: engagementDetails.lessonPlan?.done ?? lessonPlans.total ?? 0,
        },
        {
          item: "Pre-Test",
          required: engagementDetails.preTest?.required ?? preTestResponses.total ?? 0,
          done: engagementDetails.preTest?.done ?? preTestResponses.total ?? 0,
        },
        {
          item: "Post-Test",
          required: engagementDetails.postTest?.required ?? postTestResponses.total ?? 0,
          done: engagementDetails.postTest?.done ?? postTestResponses.total ?? 0,
        },
        {
          item: "Feedback",
          required: engagementDetails.feedback?.required ?? feedback.total ?? 0,
          done: engagementDetails.feedback?.done ?? feedback.total ?? 0,
        },
      ];
    }

    return [];
  }, [detailModalType, trainingWiseSummary, facultyTrainingDetails, engagementDetails, trainings.total, summary.nominations, applications.total, facultyMetrics.facultyWithCompletedTrainings, lessonPlans.total, preTestResponses.total, postTestResponses.total, feedback.total, approvedApplicationsCountFallback]);


  const closeDetailModal = () => setDetailModalType(null);

  const completionTooltip = "Completed ≥ 40 Hours counts faculty whose total attended hours across approved trainings are at least 40. Completed < 40 Hours is the remaining faculty total after subtracting the 40+ hour group.";

  const viewableCards = {
    faculty: () => setDetailModalType("faculty"),
    engagement: () => setDetailModalType("engagement"),
  };

  const approvedApplicationsCount = summary.nominations || applications.total || 0;

  const engagementOverall = useMemo(() => {
    const calculatePercentage = (done, required) => {
      if (!required) return "0%";
      return `${Math.round((done / required) * 100)}%`;
    };

    let preTestReq = 0, preTestDone = 0;
    let postTestReq = 0, postTestDone = 0;
    let feedbackReq = 0, feedbackDone = 0;
    let lessonPlanReq = 0, lessonPlanDone = 0;

    if (Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0) {
      trainingWiseSummary.forEach(item => {
        preTestReq += item.preTestRequired || 0;
        preTestDone += item.preTestDone || 0;
        postTestReq += item.postTestRequired || 0;
        postTestDone += item.postTestDone || 0;
        feedbackReq += item.feedbackRequired || 0;
        feedbackDone += item.feedbackDone || 0;
        lessonPlanReq += item.lessonPlanRequired || 0;
        lessonPlanDone += item.lessonPlanDone || 0;
      });
    } else {
      preTestReq = engagementDetails.preTest?.required ?? preTestResponses.total ?? 0;
      preTestDone = engagementDetails.preTest?.done ?? preTestResponses.total ?? 0;
      postTestReq = engagementDetails.postTest?.required ?? postTestResponses.total ?? 0;
      postTestDone = engagementDetails.postTest?.done ?? postTestResponses.total ?? 0;
      feedbackReq = engagementDetails.feedback?.required ?? feedback.total ?? 0;
      feedbackDone = engagementDetails.feedback?.done ?? feedback.total ?? 0;
      lessonPlanReq = engagementDetails.lessonPlan?.required ?? approvedApplicationsCount;
      lessonPlanDone = engagementDetails.lessonPlan?.done ?? lessonPlans.total ?? 0;
    }

    return {
      preTest: calculatePercentage(preTestDone, preTestReq),
      postTest: calculatePercentage(postTestDone, postTestReq),
      feedback: calculatePercentage(feedbackDone, feedbackReq),
      lessonPlan: calculatePercentage(lessonPlanDone, lessonPlanReq),
    };
  }, [trainingWiseSummary, engagementDetails, preTestResponses, postTestResponses, lessonPlans, feedback, approvedApplicationsCount]);

  const stats = useMemo(
    () => [
      {
        title: "Trainings",
        icon: CalendarOutlined,
        lines: [
          { label: "Published", value: summary.totalTrainingsPublished || trainings.published || 0 },
          { label: "Conducted", value: trainingMetrics.totalTrainingsConducted || 0 },
          { label: "Hours Delivered", value: trainingMetrics.totalTrainingHoursDelivered || 0 },
        ],
        variant: "primary",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Faculty Trainings",
        icon: PlusOutlined,
        lines: [
          {
            label: "Total Nominations",
            value: summary.nominations || applications.nominations || applications.total || 0,
          },
          {
            label: "No. of Attendees",
            value: facultyTrainingDetails.facultyAttendeesCount ?? 0,
            tooltip: "Unique faculty who attended at least one day of a completed training out of their approved nominations.",
          },
          { label: "Ongoing", value: trainings.ongoing || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
        onView: viewableCards.faculty,
        infoTooltip: "Unique faculty counts based on approved nominations. \"No. of Attendees\" counts faculty with at least one day of marked attendance in a completed training — full attendance is not required.",
      },
      {
        title: "Completion & Hours",
        icon: SettingOutlined,
        lines: [
          { label: "Completed ≥ 40 Hours", value: completionMetrics.facultyCompleted40Hours || 0 },
          { label: "Completed < 40 Hours", value: completionMetrics.facultyCompletedUnder40Hours || 0 },
          { label: "Avg. Hours per Faculty", value: hoursDistribution.averageHoursPerFaculty || 0 },
        ],
        variant: "primary",
        onClick: () => navigate("/app/training/manage"),
        infoTooltip: completionTooltip,
      },
      {
        title: "Engagement",
        icon: CheckCircleOutlined,
        lines: [
          { label: "Pre-Test Filled", value: engagementOverall.preTest },
          { label: "Post-Test Filled", value: engagementOverall.postTest },
          { label: "Feedback Submitted", value: engagementOverall.feedback },
          { label: "Lesson Plans", value: engagementOverall.lessonPlan },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
        onView: viewableCards.engagement,
      },
      {
        title: "Test Performance",
        icon: RiseOutlined,
        lines: [
          { label: "Avg Pre-Test Score", value: `${testPerformance.avgPreTestScore ?? 0}%` },
          { label: "Avg Post-Test Score", value: `${testPerformance.avgPostTestScore ?? 0}%` },
          {
            label: (testPerformance.avgImprovement ?? 0) >= 0 ? "Improvement" : "Decline",
            value: `${(testPerformance.avgImprovement ?? 0) >= 0 ? "+" : ""}${testPerformance.avgImprovement ?? 0}%`,
            tooltip: `Based on ${testPerformance.totalCompared ?? 0} faculty who submitted both pre-test and post-test. Improved: ${testPerformance.facultyImproved ?? 0}, Declined: ${testPerformance.facultyDeclined ?? 0}, No Change: ${testPerformance.facultyNoChange ?? 0}.`,
          },
        ],
        variant: "success",
        onClick: () => navigate("/app/training/manage"),
        infoTooltip: "Improvement = Avg Post-Test Score − Avg Pre-Test Score, across faculty who submitted both tests for a training.",
      },
    ],
    [
      summary,
      trainings,
      trainingMetrics,
      navigate,
      applications,
      facultyTrainingDetails,
      facultyMetrics,
      lessonPlans,
      completionMetrics,
      hoursDistribution,
      testPerformance,
      preTestResponses,
      postTestResponses,
      feedback,
    ],
  );

  const courseColumns = [
    {
      title: "Course",
      dataIndex: "course",
      key: "course",
      render: (value) => <Text className="text-xs">{String(value || '')}</Text>,
    },
    {
      title: "No. of Faculty",
      dataIndex: "facultyCount",
      key: "facultyCount",
      width: 140,
      render: (value) => <Text className="text-xs font-semibold">{Number(value || 0)}</Text>,
    },
    {
      title: "Total Course Trainings",
      dataIndex: "totalCourseTrainings",
      key: "totalCourseTrainings",
      width: 170,
      render: (value) => <Text className="text-xs font-semibold">{Number(value || 0)}</Text>,
    },
    {
      title: "Completed Trainings",
      dataIndex: "completedTrainingsCount",
      key: "completedTrainingsCount",
      width: 170,
      render: (value) => <Text className="text-xs font-semibold">{Number(value || 0)}</Text>,
    },
    {
      title: "Feedback Submitted",
      dataIndex: "feedbackSubmittedCount",
      key: "feedbackSubmittedCount",
      width: 160,
      render: (value) => <Text className="text-xs font-semibold">{Number(value || 0)}</Text>,
    },
  ];

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <Title level={4} className="mb-0.5!">
            State Training Dashboard
          </Title>
          <Text type="secondary" className="text-xs">
            Welcome, {user?.name}! Monitoring trainings, faculty participation, completion, and lesson plans.
          </Text>
        </div>
        <Space size="small">
          <Button
            size="middle"
            onClick={() => navigate("/app/training/manage")}
          >
            <SettingOutlined /> Manage
          </Button>
          <Button
            size="middle"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreateModal}
          >
            Create Training
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
        {stats.map((stat) => (
          <div key={stat.title}>
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      <Card
        className="rounded-xl border-border shadow-none"
        styles={{ body: { padding: "12px" } }}
        title={
          <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Course Wise No. of Faculty
          </Text>
        }
      >
        <Table
          rowKey="course"
          columns={courseColumns}
          dataSource={normalizedCourseWiseFaculty}
          size="small"
          pagination={false}
        />
      </Card>

      <EngagementDetailsModal
        open={detailModalType !== null}
        onCancel={closeDetailModal}
        engagementData={detailModalRows}
        type={detailModalType || 'engagement'}
      />

      <Modal
        title={`Create Training - Step ${formStep + 1} of ${TRAINING_FORM_STEP_TITLES.length}: ${TRAINING_FORM_STEP_TITLES[formStep]}`}
        open={createModalOpen}
        onCancel={handleCloseCreateModal}
        footer={null}
        width={920}
        destroyOnClose
      >
        <TrainingForm
          form={form}
          onSubmit={handleCreateTraining}
          loading={formLoading}
          submitText="Create Training"
          feedbackForms={feedbackForms.list || []}
          preTestForms={preTestForms.list || []}
          postTestForms={postTestForms.list || []}
          onCancel={handleCloseCreateModal}
          currentStep={formStep}
          onStepChange={setFormStep}
        />
      </Modal>
    </div>
  );
};

export default TrainingDashboardPage;
