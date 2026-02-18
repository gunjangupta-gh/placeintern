import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Col,
  Progress,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  FileTextOutlined,
  PlusOutlined,
  SettingOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  fetchStateTrainingDashboard,
  fetchStateTrainingUpcoming,
} from "../store/stateTrainingSlice";

const { Title, Text } = Typography;

const StatCard = ({ icon: Icon, title, value, onClick, subtitle }) => {
  return (
    <div
      className={`rounded-xl p-2.5 h-full border border-slate-200 bg-white ${onClick ? "cursor-pointer hover:shadow-sm transition-all" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500 bg-slate-100 p-1 rounded">
          <Icon className="text-xs" />
        </span>
        {subtitle && (
          <Text className="text-slate-500 text-[10px] font-medium">
            {subtitle}
          </Text>
        )}
      </div>
      <Statistic
        title={
          <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
            {title}
          </span>
        }
        value={value}
        valueStyle={{ fontSize: 18, fontWeight: 700, lineHeight: 1.15, color: "#0f172a" }}
      />
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
    dispatch(fetchStateTrainingUpcoming());
  }, [dispatch]);

  const dashboard = reports.dashboard || {};

  // Extract data from API response structure
  const trainings = dashboard.trainings || {};
  const applications = dashboard.applications || {};
  const feedback = dashboard.feedback || {};
  const lessonPlans = dashboard.lessonPlans || {};

  const stats = useMemo(
    () => [
      {
        title: "Total Trainings",
        value: trainings.total || 0,
        icon: CalendarOutlined,
        subtitle: `${trainings.published || 0} published`,
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Feedback Forms",
        value: feedback.total || 0,
        icon: FileTextOutlined,
        subtitle: "Responses",
        onClick: () => navigate("/app/training/feedback-forms"),
      },
      {
        title: "Applications",
        value: applications.total || 0,
        icon: PlusOutlined,
        subtitle: `${applications.approved || 0} approved`,
        onClick: () => navigate("/app/training/manage"),
      },
      {
        title: "Lesson Plans",
        value: lessonPlans.total || 0,
        icon: BookOutlined,
        subtitle: `${lessonPlans.approved || 0} approved`,
        onClick: () => navigate("/app/training/lesson-plans"),
      },
    ],
    [trainings, applications, feedback, lessonPlans, navigate],
  );

  return (
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <Title level={4} className="!mb-0.5">
            Training Dashboard
          </Title>
          <Text type="secondary" className="text-xs">
            Welcome, {user?.name}! Monitoring trainings and participation.
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
          <Col xs={12} sm={12} lg={6} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      {/* Progress Cards */}
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={24} sm={12}>
          <Card
            className="rounded-xl border-border shadow-none"
            styles={{ body: { padding: "16px" } }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Application Approval Rate
              </Text>
              <Text className="text-base font-bold text-blue-600">
                {Math.round(applications.approvalRate || 0)}%
              </Text>
            </div>
            <Progress
              percent={Math.round(applications.approvalRate || 0)}
              showInfo={false}
              strokeColor="#2563eb"
              trailColor="#f1f5f9"
              size="small"
            />
            <Text className="text-[10px] text-slate-500 mt-1.5 block">
              {applications.approved || 0} of {applications.total || 0} approved
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card
            className="rounded-xl border-border shadow-none"
            styles={{ body: { padding: "16px" } }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Text className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lesson Plan Approval Rate
              </Text>
              <Text className="text-base font-bold text-emerald-600">
                {Math.round(lessonPlans.approvalRate || 0)}%
              </Text>
            </div>
            <Progress
              percent={Math.round(lessonPlans.approvalRate || 0)}
              showInfo={false}
              strokeColor="#059669"
              trailColor="#f1f5f9"
              size="small"
            />
            <Text className="text-[10px] text-slate-500 mt-1.5 block">
              {lessonPlans.approved || 0} of {lessonPlans.total || 0} approved
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TrainingDashboardPage;
