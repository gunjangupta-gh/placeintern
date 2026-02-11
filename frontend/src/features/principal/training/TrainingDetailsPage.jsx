import React, { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  RiseOutlined,
  FallOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  ApartmentOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import DifficultyBadge from "../../../components/training/DifficultyBadge";
import LearningOutcomesList from "../../../components/training/LearningOutcomesList";
import BranchTags from "../../../components/training/BranchTags";
import DeadlineCountdown from "../../../components/training/DeadlineCountdown";
import { TrainingDetailsSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchPrincipalTrainingDetails,
  fetchPrincipalTrainingStats,
} from "../store/principalTrainingSlice";

const { Title, Paragraph, Text } = Typography;

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

const STAT_TONES = {
  primary: {
    icon: "bg-blue-100 text-blue-700",
    card: "bg-gradient-to-br from-blue-50 via-white to-slate-50",
  },
  success: {
    icon: "bg-emerald-100 text-emerald-700",
    card: "bg-gradient-to-br from-emerald-50 via-white to-slate-50",
  },
  warning: {
    icon: "bg-amber-100 text-amber-700",
    card: "bg-gradient-to-br from-amber-50 via-white to-slate-50",
  },
  info: {
    icon: "bg-slate-100 text-slate-700",
    card: "bg-gradient-to-br from-slate-50 via-white to-blue-50",
  },
};

const StatCard = ({ icon: Icon, title, value, tone, trend, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <Card
      className={`rounded-2xl border-border shadow-none h-full hover:shadow-soft transition-shadow ${styles.card} ${onClick ? "cursor-pointer" : ""}`}
      styles={{ body: { padding: "16px" } }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}${trend ? `, trend ${trend > 0 ? "up" : "down"} ${Math.abs(trend)}%` : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">
            {title}
          </Text>
          <div className="text-2xl font-bold text-text-primary">{value}</div>
          {trend !== undefined && trend !== null && (
            <div
              className={`flex items-center gap-1 mt-1 text-xs ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-600" : "text-text-secondary"}`}
            >
              {trend > 0 ? (
                <RiseOutlined />
              ) : trend < 0 ? (
                <FallOutlined />
              ) : null}
              <span>
                {trend > 0 ? "+" : ""}
                {trend}% from last period
              </span>
            </div>
          )}
        </div>
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}
        >
          <Icon className="text-lg" />
        </div>
      </div>
    </Card>
  );
};

const PrincipalTrainingDetailsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentTraining } = useSelector((state) => state.principalTraining);

  const isLoading = currentTraining.loading && !currentTraining.data;

  useEffect(() => {
    if (!id) return;
    dispatch(fetchPrincipalTrainingDetails(id));
    dispatch(fetchPrincipalTrainingStats(id));
  }, [dispatch, id]);

  const training = currentTraining.data;
  const stats = currentTraining.stats;

  const capacityInfo = useMemo(() => {
    if (training?.capacity && typeof training.capacity === "object") {
      return {
        available: training.capacity.available ?? 0,
        total: training.capacity.total ?? 0,
        approved: training.capacity.approved ?? 0,
        isFull: training.capacity.isFull ?? false,
      };
    }
    return {
      available: training?.availableSeats ?? 0,
      total: training?.capacity ?? 0,
      approved: stats?.applications?.approved ?? 0,
      isFull: false,
    };
  }, [training, stats]);

  if (isLoading) {
    return <TrainingDetailsSkeleton />;
  }

  const statCards = [
    {
      title: "Total Applications",
      value: stats?.applications?.total ?? 0,
      icon: FileTextOutlined,
      tone: "primary",
    },
    {
      title: "Approved",
      value: stats?.applications?.approved ?? 0,
      icon: CheckCircleOutlined,
      tone: "success",
    },
    {
      title: "Attendance",
      value: stats?.attendance?.uniqueAttendees ?? 0,
      icon: TeamOutlined,
      tone: "warning",
    },
  ];

  return (
    <div className="p-6 training-ui">
      {/* Back Button */}
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

      {/* Hero Card */}
      <Card className="rounded-2xl border-border shadow-none !mb-4 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <Row gutter={[24, 16]} align="middle">
          <Col xs={24}>
            <Space className="mb-3" wrap>
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
            </Space>
            <Title level={2} className="mb-2 training-heading">
              {training?.title || "Training"}
            </Title>
            <Text type="secondary" className="text-base">
              {training?.providedBy || "Training Provider"}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} className="!mb-4">
        {statCards.map((stat) => (
          <Col xs={12} lg={8} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* About Section */}
          <Card className="rounded-xl border-border shadow-none !mb-4">
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
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={TeamOutlined}
                  label="Capacity"
                  tooltip="Maximum participants"
                >
                  <Text strong>{capacityInfo.total} participants</Text>
                  <div className="text-xs text-text-secondary mt-1">
                    {capacityInfo.approved} approved, {capacityInfo.available}{" "}
                    available
                  </div>
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={CheckCircleOutlined}
                  label="Application Deadline"
                  tooltip="Last date to apply"
                >
                  <Text>
                    {training?.applicationDeadline
                      ? new Date(
                          training.applicationDeadline,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "TBD"}
                  </Text>
                </InfoItem>
              </Col>
            </Row>
          </Card>

          {/* Target Branches */}
          {training?.targetBranches && training.targetBranches.length > 0 && (
            <Card className="rounded-xl border-border shadow-none !mb-4">
              <Title level={4} className="flex items-center gap-2">
                <ApartmentOutlined className="text-blue-700" />
                Target Departments
              </Title>
              <Paragraph type="secondary" className="mb-3">
                This training is designed for faculty members from the following
                departments:
              </Paragraph>
              <BranchTags branches={training.targetBranches} />
            </Card>
          )}

          {/* Learning Outcomes */}
          <Card className="rounded-xl border-border shadow-none !mb-4">
            <Title level={4} className="flex items-center gap-2">
              <CheckCircleOutlined className="text-emerald-600" />
              Learning Outcomes
            </Title>
            <Paragraph type="secondary" className="!mb-4">
              By the end of this training, participants will be able to:
            </Paragraph>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} />
          </Card>

          {/* Prerequisites */}
          {training?.prerequisites && (
            <Card className="rounded-xl border-border shadow-none !mb-4">
              <Title level={4}>Prerequisites</Title>
              <Paragraph className="text-text-secondary mb-0">
                {training.prerequisites}
              </Paragraph>
            </Card>
          )}
        </Col>

        <Col xs={24} lg={8}>
          {/* Deadline Countdown */}
          {training?.applicationDeadline && (
            <div className="!mb-4">
              <DeadlineCountdown
                deadline={training.applicationDeadline}
                label="Application closes in"
                expiredLabel="Application deadline has passed"
              />
            </div>
          )}

          {/* Trainer & Venue Card */}
          <Card className="rounded-xl border-border shadow-none mb-4">
            <Title level={4} className="flex items-center gap-2">
              <UserOutlined className="text-blue-700" />
              Trainer & Venue
            </Title>

            <div className="space-y-4">
              {training?.trainerName && (
                <div className="flex items-center gap-3">
                  <Avatar
                    size={48}
                    icon={<UserOutlined />}
                    className="bg-blue-100 text-blue-700"
                  />
                  <div>
                    <Text strong className="block">
                      {training.trainerName}
                    </Text>
                    {training?.trainerContact && (
                      <Text type="secondary" className="text-xs block">
                        {training.trainerContact}
                      </Text>
                    )}
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
                  <div>
                    <Text>{training?.venue || "TBD"}</Text>
                    {training?.city && training?.state && (
                      <div className="text-xs text-text-secondary mt-1">
                        {training.city}, {training.state}
                      </div>
                    )}
                  </div>
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
    </div>
  );
};

export default PrincipalTrainingDetailsPage;
