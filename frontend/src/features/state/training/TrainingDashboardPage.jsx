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
  message,
} from "antd";
import {
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
  BookOutlined,
  CheckCircleOutlined,
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

const StatCard = ({ icon: Icon, title, lines = [], onClick, variant = "primary" }) => {
  const styles = STAT_VARIANTS[variant] || STAT_VARIANTS.primary;

  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 ${onClick ? "cursor-pointer hover:shadow-sm transition-all" : ""}`}
      onClick={onClick}
    >
      {/* Icon + Title */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${styles.iconWrap}`}>
          <Icon className={`text-xs ${styles.iconColor}`} />
        </span>
        <Text className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-1">
          {title}
        </Text>
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text key={line.label} className="block text-[12px] leading-snug text-slate-600">
            {line.label}: <span className="font-semibold text-slate-800">{line.value}</span>
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
  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};
  const feedback = dashboard.feedback || {};
  const preTestResponses = dashboard.preTestResponses || {};
  const postTestResponses = dashboard.postTestResponses || {};
  const attendance = dashboard.attendance || {};
  const courseWiseFaculty = dashboard.courseWiseFaculty || [];
  const normalizedCourseWiseFaculty = useMemo(
    () =>
      (Array.isArray(courseWiseFaculty) ? courseWiseFaculty : []).map((item, index) => ({
        ...item,
        // Support current and legacy key names from different dashboard responses.
        course: item?.course || item?.courseName || `Course ${index + 1}`,
        facultyCount: asNumber(item?.facultyCount ?? item?.faculty_count),
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
            label: "Applications",
            value: summary.nominations || applications.nominations || applications.total || 0,
          },
          { label: "Completed", value: facultyMetrics.facultyWithCompletedTrainings || 0 },
          { label: "Ongoing", value: facultyMetrics.facultyWithOngoingTrainings || 0 },
          // { label: "Yet to Start", value: facultyMetrics.facultyYetToStart || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Lesson Plan",
        icon: BookOutlined,
        lines: [
          // { label: "Faculty Completed Training", value: summary.peopleCompletedTraining || 0 },
          { label: "Lesson Plans Created", value: summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0 },
        ],
        variant: "purple",
        onClick: () => navigate("/app/training/lesson-plans"),
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
      },
      {
        title: "Engagement",
        icon: CheckCircleOutlined,
        lines: [
          { label: "Pre-Test Filled", value: preTestResponses.total || 0 },
          { label: "Post-Test Filled", value: postTestResponses.total || 0 },
          { label: "Feedback Submitted", value: feedback.total || 0 },
          { label: "Attendance Records", value: attendance.total || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
      },
    ],
    [
      trainings,
      applications,
      summary,
      completionMetrics,
      lessonPlans,
      trainingMetrics,
      facultyMetrics,
      hoursDistribution,
      feedback,
      preTestResponses,
      postTestResponses,
      attendance,
      navigate,
    ],
  );

  const courseColumns = [
    {
      title: "Course",
      dataIndex: "course",
      key: "course",
      render: (value) => <Text className="text-xs">{value}</Text>,
    },
    {
      title: "No. of Faculty",
      dataIndex: "facultyCount",
      key: "facultyCount",
      width: 140,
      render: (value) => <Text className="text-xs font-semibold">{value}</Text>,
    },
    {
      title: "Completed Trainings",
      dataIndex: "completedTrainingsCount",
      key: "completedTrainingsCount",
      width: 170,
      render: (value) => <Text className="text-xs font-semibold">{value ?? 0}</Text>,
    },
    {
      title: "Feedback Submitted",
      dataIndex: "feedbackSubmittedCount",
      key: "feedbackSubmittedCount",
      width: 160,
      render: (value) => <Text className="text-xs font-semibold">{value ?? 0}</Text>,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
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
