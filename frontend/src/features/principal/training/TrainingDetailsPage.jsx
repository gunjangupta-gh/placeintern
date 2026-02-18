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
  <div className="flex items-start gap-2.5 py-1.5">
    <Tooltip title={tooltip}>
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 shrink-0">
        <Icon className="text-blue-700 text-xs" />
      </div>
    </Tooltip>
    <div className="flex-1 min-w-0">
      <Text type="secondary" className="text-[10px] uppercase tracking-wider font-semibold block leading-tight">
        {label}
      </Text>
      <div className="mt-0">{children}</div>
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
      className={`rounded-xl border-border shadow-none h-full hover:shadow-soft transition-shadow ${styles.card} ${onClick ? "cursor-pointer" : ""}`}
      styles={{ body: { padding: "12px" } }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}${trend ? `, trend ${trend > 0 ? "up" : "down"} ${Math.abs(trend)}%` : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-[10px] uppercase tracking-wider font-semibold opacity-80 block mb-0.5">
            {title}
          </Text>
          <div className="text-xl font-bold text-text-primary leading-tight">{value}</div>
          {trend !== undefined && trend !== null && (
            <div
              className={`flex items-center gap-1 mt-0.5 text-[10px] ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-600" : "text-text-secondary"}`}
            >
              {trend > 0 ? (
                <RiseOutlined className="text-[9px]" />
              ) : trend < 0 ? (
                <FallOutlined className="text-[9px]" />
              ) : null}
              <span>
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
            </div>
          )}
        </div>
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-lg ${styles.icon}`}
        >
          <Icon className="text-sm" />
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
    <div className="p-4 training-ui">
      {/* Back Button */}
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

      {/* Hero Card */}
      <Card 
        className="rounded-2xl border-border shadow-none !mb-3 bg-gradient-to-br from-slate-50 via-white to-blue-50"
        styles={{ body: { padding: '20px' } }}
      >
        <Row gutter={[20, 16]} align="middle">
          <Col xs={24}>
            <Space className="mb-2" wrap>
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
            </Space>
            <Title level={3} className="mb-1 mt-0">
              {training?.title || "Training"}
            </Title>
            <Text type="secondary" className="text-sm">
              {training?.providedBy || "Training Provider"}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[12, 12]} className="!mb-3">
        {statCards.map((stat) => (
          <Col xs={12} lg={8} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={16}>
          {/* About Section */}
          <Card 
            className="rounded-xl border-border shadow-none !mb-3"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
            title={
              <div className="flex items-center gap-2 text-sm font-semibold">
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
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={TeamOutlined}
                  label="Capacity"
                  tooltip="Maximum participants"
                >
                  <Text strong className="text-sm">{capacityInfo.total} participants</Text>
                  <div className="text-[10px] text-text-secondary mt-0">
                    {capacityInfo.approved} approved, {capacityInfo.available}{" "}
                    available
                  </div>
                </InfoItem>
              </Col>
              <Col xs={24} sm={12}>
                <InfoItem
                  icon={CheckCircleOutlined}
                  label="Deadline"
                  tooltip="Last date to apply"
                >
                  <Text className="text-sm">
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
            <Card 
              className="rounded-xl border-border shadow-none !mb-3"
              styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
              title={
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ApartmentOutlined className="text-blue-700" />
                  <span>Target Departments</span>
                </div>
              }
            >
              <Paragraph type="secondary" className="mb-2 text-xs">
                Designed for faculty from:
              </Paragraph>
              <BranchTags branches={training.targetBranches} compact />
            </Card>
          )}

          {/* Learning Outcomes */}
          <Card 
            className="rounded-xl border-border shadow-none !mb-3"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
            title={
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircleOutlined className="text-emerald-600" />
                <span>Learning Outcomes</span>
              </div>
            }
          >
            <Paragraph type="secondary" className="!mb-2 text-xs">
              By the end of this training, participants will be able to:
            </Paragraph>
            <LearningOutcomesList outcomes={training?.learningOutcomes || []} compact />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Deadline Countdown */}
          {training?.applicationDeadline && (
            <div className="!mb-3">
              <DeadlineCountdown
                deadline={training.applicationDeadline}
                label="Application closes in"
                expiredLabel="Deadline passed"
                compact
              />
            </div>
          )}

          {/* Trainer & Venue Card */}
          <Card 
            className="rounded-xl border-border shadow-none mb-3"
            styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '16px' } }}
            title={
              <div className="flex items-center gap-2 text-sm font-semibold">
                <UserOutlined className="text-blue-700" />
                <span>Trainer & Venue</span>
              </div>
            }
          >

            <div className="space-y-3">
              {training?.trainerName && (
                <div className="flex items-center gap-2.5">
                  <Avatar
                    size={40}
                    icon={<UserOutlined />}
                    className="bg-blue-100 text-blue-700"
                  />
                  <div>
                    <Text strong className="block text-sm leading-tight">
                      {training.trainerName}
                    </Text>
                    {training?.trainerContact && (
                      <Text type="secondary" className="text-[10px] block mt-0.5">
                        {training.trainerContact}
                      </Text>
                    )}
                  </div>
                </div>
              )}

              <Descriptions column={1} size="small" className="compact-descriptions">
                <Descriptions.Item
                  label={
                    <span className="flex items-center gap-1 text-xs">
                      <EnvironmentOutlined /> Venue
                    </span>
                  }
                >
                  <div>
                    <Text className="text-xs">{training?.venue || "TBD"}</Text>
                    {training?.city && training?.state && (
                      <div className="text-[10px] text-text-secondary mt-0">
                        {training.city}, {training.state}
                      </div>
                    )}
                  </div>
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
    </div>
  );
};


export default PrincipalTrainingDetailsPage;
