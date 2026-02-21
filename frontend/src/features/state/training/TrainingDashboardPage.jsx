import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Space,
  Table,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  PlusOutlined,
  SettingOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  fetchStateTrainingDashboard,
} from "../store/stateTrainingSlice";

const { Title, Text } = Typography;

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
  const { reports } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchStateTrainingDashboard());
  }, [dispatch]);

  const dashboard = reports.dashboard || {};

  const trainings = dashboard.trainings || {};
  const applications = dashboard.applications || {};
  const summary = dashboard.summary || {};
  const lessonPlans = dashboard.lessonPlans || {};
  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};
  const courseWiseFaculty = dashboard.courseWiseFaculty || [];

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
        title: "Faculty",
        icon: PlusOutlined,
        lines: [
          { label: "Nominations", value: summary.nominations || applications.nominations || applications.total || 0 },
          { label: "Completed", value: facultyMetrics.facultyWithCompletedTrainings || 0 },
          { label: "Ongoing", value: facultyMetrics.facultyWithOngoingTrainings || 0 },
          { label: "Yet to Start", value: facultyMetrics.facultyYetToStart || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Lesson Plan",
        icon: BookOutlined,
        lines: [
          { label: "People Completed Training", value: summary.peopleCompletedTraining || 0 },
          { label: "Lesson Plans Created", value: summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0 },
        ],
        variant: "purple",
        onClick: () => navigate("/app/training/lesson-plans"),
      },
      {
        title: "Completion Metrics",
        icon: SettingOutlined,
        lines: [
          { label: "Faculty Completed ≥ 40 Hours", value: completionMetrics.facultyCompleted40Hours || 0 },
          { label: "Faculty Completed < 40 Hours", value: completionMetrics.facultyCompletedUnder40Hours || 0 },
        ],
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Hours Distribution",
        icon: CalendarOutlined,
        lines: [
          { label: "Average Hours per Faculty", value: hoursDistribution.averageHoursPerFaculty || 0 },
          { label: "Highest Hours (Single Faculty)", value: hoursDistribution.highestHoursSingleFaculty || 0 },
          { label: "Lowest Hours", value: hoursDistribution.lowestHoursSingleFaculty || 0 },
        ],
        variant: "primary",
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
            onClick={() => navigate("/app/training/create")}
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
          dataSource={courseWiseFaculty}
          size="small"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default TrainingDashboardPage;
