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
            {String(line.label || '')}: <span className="font-semibold text-slate-800">{String(line.value ?? '-')}</span>
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
      return [
        {
          item: "Lesson Plan",
          required: engagementDetails.lessonPlan?.required ?? approvedApplicationsCountFallback,
          done: engagementDetails.lessonPlan?.done ?? lessonPlans.approved ?? 0,
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
  }, [detailModalType, trainingWiseSummary, facultyTrainingDetails, engagementDetails, trainings.total, summary.nominations, applications.total, facultyMetrics.facultyWithCompletedTrainings, lessonPlans.approved, preTestResponses.total, postTestResponses.total, feedback.total]);

  const detailModalConfig = useMemo(() => {
    if (detailModalType === "faculty") {
      const hasTrainingRows = Array.isArray(trainingWiseSummary) && trainingWiseSummary.length > 0;
      return {
        title: "Training Wise Summary",
        width: 800,
        columns: hasTrainingRows
          ? [
              {
                title: "Training",
                dataIndex: "trainingTitle",
                key: "trainingTitle",
                render: (value) => <Text className="text-sm">{String(value || '')}</Text>,
              },
              {
                title: "Total Trainings",
                dataIndex: "totalTrainings",
                key: "totalTrainings",
                align: "right",
                width: 120,
                render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
              },
              {
                title: "Total Nominations",
                dataIndex: "totalNominations",
                key: "totalNominations",
                align: "right",
                width: 140,
                render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
              },
              {
                title: "Faculty with Full Attendance Marked",
                dataIndex: "facultyWithFullAttendanceMarked",
                key: "facultyWithFullAttendanceMarked",
                align: "right",
                width: 180,
                render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
              },
              {
                title: "Faculty with Not Full Attendance",
                dataIndex: "facultyWithNotFullAttendance",
                key: "facultyWithNotFullAttendance",
                align: "right",
                width: 180,
                render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
              },
            ]
          : [
              {
                title: "Metric",
                dataIndex: "metric",
                key: "metric",
                render: (value) => <Text className="text-sm">{String(value || '')}</Text>,
              },
              {
                title: "Count",
                dataIndex: "count",
                key: "count",
                align: "right",
                width: 120,
                render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
              },
            ],
        dataSource: detailModalRows,
      };
    }

    if (detailModalType === "engagement") {
      return {
        title: "Engagement Details",
        width: 720,
        columns: [
          {
            title: "Item",
            dataIndex: "item",
            key: "item",
            render: (value) => <Text className="text-sm">{String(value || '')}</Text>,
          },
          {
            title: "Required",
            dataIndex: "required",
            key: "required",
            align: "right",
            width: 120,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
          {
            title: "Done",
            dataIndex: "done",
            key: "done",
            align: "right",
            width: 120,
            render: (value) => <Text className="text-sm font-semibold text-emerald-600">{Number(value || 0)}</Text>,
          },
        ],
        dataSource: detailModalRows,
      };
    }

    return null;
  }, [detailModalRows, detailModalType]);

  const closeDetailModal = () => setDetailModalType(null);

  const completionTooltip = "Completed ≥ 40 Hours counts faculty whose total attended hours across approved trainings are at least 40. Completed < 40 Hours is the remaining faculty total after subtracting the 40+ hour group.";

  const viewableCards = {
    faculty: () => setDetailModalType("faculty"),
    engagement: () => setDetailModalType("engagement"),
  };

  const approvedApplicationsCount = summary.nominations || applications.total || 0;

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
            label: "Completed",
            value:
              facultyTrainingDetails.facultyWithFullAttendanceMarked ??
              facultyMetrics.facultyWithCompletedTrainings ??
              0,
          },
          { label: "Ongoing", value: trainings.ongoing || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
        onView: viewableCards.faculty,
        infoTooltip: "Unique faculty counts based on approved nominations. Full attendance means all scheduled training days were marked.",
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
          { label: "Pre-Test Filled", value: preTestResponses.total || 0 },
          { label: "Post-Test Filled", value: postTestResponses.total || 0 },
          { label: "Feedback Submitted", value: feedback.total || 0 },
          { label: "Lesson Plans", value: summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
        onView: viewableCards.engagement,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {stats.map((stat) => {
          if (stat.title === "Engagement") {
            return (
              <EngagementCard
                key={stat.title}
                title={stat.title}
                engagementItems={stat.lines}
                onView={stat.onView}
              />
            );
          }
          return (
            <div key={stat.title}>
              <StatCard {...stat} />
            </div>
          );
        })}
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

      {detailModalType === "engagement" ? (
        <EngagementDetailsModal
          open={detailModalType === "engagement"}
          onCancel={closeDetailModal}
          engagementData={detailModalRows}
        />
      ) : (
        <Modal
          title={detailModalConfig?.title || "Training Details"}
          open={detailModalType !== null}
          onCancel={closeDetailModal}
          footer={null}
          width={detailModalConfig?.width || 720}
          destroyOnClose
        >
          <Table
            rowKey={(record) => record.trainingId || record.metric || record.item}
            columns={detailModalConfig?.columns || []}
            dataSource={detailModalConfig?.dataSource || []}
            size="small"
            pagination={false}
          />
        </Modal>
      )}

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
