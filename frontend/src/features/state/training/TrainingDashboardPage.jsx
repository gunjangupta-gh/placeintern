import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Col,
  Row,
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

const StatCard = ({ icon: Icon, title, value, valueLabel, onClick, subtitle, variant = "primary" }) => {
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
      {/* Value + unit label inline */}
      <div className="flex items-baseline gap-1.5 mb-0.5">
        <Text className="text-[30px] leading-none font-bold text-slate-800">{value}</Text>
        {valueLabel && (
          <Text className="text-[11px] text-slate-500 font-medium">{valueLabel}</Text>
        )}
      </div>
      {/* Subtitle on its own line */}
      {subtitle && (
        <Text className="block text-[11px] text-slate-500 leading-snug mt-1">
          {subtitle}
        </Text>
      )}
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
        title: "Total Trainings",
        value: summary.totalTrainingsPublished || trainings.published || 0,
        valueLabel: "published",
        icon: CalendarOutlined,
        subtitle: `Completed Trainings: ${summary.completedTrainings || trainings.completed || 0}`,
        variant: "primary",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Faculty ",
        value: summary.nominations || applications.nominations || applications.total || 0,
        valueLabel: "nominations",
        icon: PlusOutlined,
        subtitle: `Completed 40 hrs: ${summary.facultyCompleted40Hours || completionMetrics.facultyCompleted40Hours || 0} faculty`,
        variant: "warning",
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Lesson Plan",
        value: summary.peopleCompletedTraining || 0,
        valueLabel: "people completed training",
        icon: BookOutlined,
        subtitle: `Lesson Plans Created: ${summary.lessonPlanCreated || lessonPlans.created || lessonPlans.total || 0}`,
        variant: "purple",
        onClick: () => navigate("/app/training/lesson-plans"),
      },
    ],
    [trainings, applications, summary, completionMetrics, lessonPlans, navigate],
  );

  const metricCards = [
    {
      section: "Trainings",
      items: [
        { label: "Total Trainings Conducted", value: trainingMetrics.totalTrainingsConducted || 0 },
        { label: "Total Faculty Registered", value: trainingMetrics.totalFacultyRegistered || 0 },
        { label: "Total Training Hours Delivered", value: trainingMetrics.totalTrainingHoursDelivered || 0 },
      ],
    },
    {
      section: "Faculty",
      items: [
        { label: "Faculty with Completed Trainings", value: facultyMetrics.facultyWithCompletedTrainings || 0 },
        { label: "Faculty with Ongoing Trainings", value: facultyMetrics.facultyWithOngoingTrainings || 0 },
        { label: "Faculty Yet to Start", value: facultyMetrics.facultyYetToStart || 0 },
      ],
    },
    {
      section: "Training Completion Metrics",
      items: [
        { label: "Faculty Completed ≥ 40 Hours", value: completionMetrics.facultyCompleted40Hours || 0 },
        { label: "Faculty Completed < 40 Hours", value: completionMetrics.facultyCompletedUnder40Hours || 0 },
      ],
    },
    {
      section: "Hours Distribution",
      items: [
        { label: "Average Hours per Faculty", value: hoursDistribution.averageHoursPerFaculty || 0 },
        { label: "Highest Hours (Single Faculty)", value: hoursDistribution.highestHoursSingleFaculty || 0 },
        { label: "Lowest Hours", value: hoursDistribution.lowestHoursSingleFaculty || 0 },
      ],
    },
  ];

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
      <Row gutter={[10, 10]} className="mb-3">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={8} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} className="mb-4">
        {metricCards.map((section) => (
          <Col xs={24} lg={12} key={section.section}>
            <Card
              className="rounded-xl border-border shadow-none h-full"
              styles={{ body: { padding: "16px" } }}
              title={
                <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {section.section}
                </Text>
              }
            >
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <Text className="text-xs text-slate-500">{item.label}</Text>
                    <Text className="text-sm font-semibold text-slate-800">{item.value}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

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
