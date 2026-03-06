import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Modal,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import dayjs from "dayjs";
import {
  TeamOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
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
  CloseCircleOutlined,
} from "@ant-design/icons";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import DifficultyBadge from "../../../components/training/DifficultyBadge";
import LearningOutcomesList from "../../../components/training/LearningOutcomesList";
import BranchTags from "../../../components/training/BranchTags";
import DeadlineCountdown from "../../../components/training/DeadlineCountdown";
import { TrainingDetailsSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchStateTrainingDetails,
  fetchStateTrainingStats,
  fetchStateTrainingAttendance,
  publishStateTraining,
  unpublishStateTraining,
} from "../store/stateTrainingSlice";

const { Title, Paragraph, Text } = Typography;

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
          <div className="text-xl font-bold text-text-primary leading-tight">
            {value}
          </div>
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

const StateTrainingDetailsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { currentTraining, attendance } = useSelector((state) => state.stateTraining);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const isLoading = currentTraining.loading && !currentTraining.data;

  useEffect(() => {
    if (!id) return;
    dispatch(fetchStateTrainingDetails(id));
    dispatch(fetchStateTrainingStats(id));
  }, [dispatch, id]);

  const training = currentTraining.data;
  const stats = currentTraining.stats;
  const isCoordinatorRoute = location.pathname.startsWith("/app/coordinator/training/");
  const detailBasePath = isCoordinatorRoute ? "/app/coordinator/training" : "/app/training";

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

  const handlePublish = async () => {
    try {
      await dispatch(publishStateTraining(id)).unwrap();
      message.success("Training published");
    } catch (error) {
      message.error(error || "Failed to publish training");
    }
  };

  const handleUnpublish = async () => {
    try {
      await dispatch(unpublishStateTraining(id)).unwrap();
      message.success("Training unpublished");
    } catch (error) {
      message.error(error || "Failed to unpublish training");
    }
  };

  const handleOpenAttendanceModal = async () => {
    if (!id) return;
    setAttendanceModalOpen(true);
    setAttendanceLoading(true);
    try {
      await dispatch(fetchStateTrainingAttendance({ trainingId: id })).unwrap();
    } finally {
      setAttendanceLoading(false);
    }
  };

  if (isLoading) {
    return <TrainingDetailsSkeleton />;
  }

  const statCards = [
    {
      title: "Total Applications",
      value: stats?.applications?.total ?? 0,
      icon: FileTextOutlined,
      tone: "primary",
      onClick: () => navigate(`${detailBasePath}/${id}/applications`),
    },
    {
      title: "Approved",
      value: stats?.applications?.approved ?? 0,
      icon: CheckCircleOutlined,
      tone: "success",
      onClick: () => navigate(`${detailBasePath}/${id}/applications`),
    },
    {
      title: "Attendance",
      value: stats?.attendance?.uniqueAttendees ?? 0,
      icon: TeamOutlined,
      tone: "warning",
      onClick: handleOpenAttendanceModal,
    },
  ];

  const attendanceData = useMemo(() => {
    if (!training || !attendance.list) return null;
    return attendance.list;
  }, [training, attendance.list]);

  const trainingDates = useMemo(() => {
    if (!training?.startDate || !training?.endDate) return [];
    const dates = [];
    const start = dayjs(training.startDate);
    const end = dayjs(training.endDate);
    let current = start;

    while (current.isSameOrBefore(end, "day")) {
      dates.push(current.toDate());
      current = current.add(1, "day");
    }

    return dates;
  }, [training]);

  const attendanceTableData = useMemo(() => {
    if (!attendanceData?.attendanceByUser || !attendanceData?.records) return [];

    return attendanceData.attendanceByUser.map((userData) => {
      const userAttendanceRecords = attendanceData.records.filter(
        (record) => record.userId === userData.user.id,
      );

      const attendedDates = new Set(
        userAttendanceRecords.map((record) => dayjs(record.attendanceDate).format("YYYY-MM-DD")),
      );

      return {
        ...userData,
        attendedDates,
        institution: userData.user?.Institution || userAttendanceRecords[0]?.user?.Institution || null,
      };
    });
  }, [attendanceData]);

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
        className="rounded-xl border-border shadow-none mb-3! bg-linear-to-br from-slate-50 via-white to-blue-50"
        styles={{ body: { padding: "14px" } }}
      >
        <Row gutter={[12, 12]} align="top">
          <Col xs={24}>
            <Space className="mb-2" wrap>
              <DeliveryModeBadge mode={training?.deliveryMode} />
              <DifficultyBadge level={training?.difficulty} />
              <Tag
                size="small"
                color={training?.isPublished ? "green" : "orange"}
                className="text-[10px] leading-tight px-1.5"
              >
                {training?.isPublished ? "Published" : "Draft"}
              </Tag>
            </Space>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Title level={4} className="mb-0! mt-0 leading-tight">
                {training?.title || "Training"}
              </Title>
              {training?.targetBranches && training.targetBranches.length > 0 && (
                <BranchTags branches={training.targetBranches} compact />
              )}
            </div>
            <Text type="secondary" className="text-xs sm:text-sm">
              {training?.providedBy || "Training Provider"}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[12, 12]} className="mb-3">
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
            className="rounded-xl border-border shadow-none mb-3!"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
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
                  <Text strong className="text-sm">
                    {capacityInfo.total} participants
                  </Text>
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
                  <span className="text-sm">
                    {training?.applicationDeadline
                      ? new Date(
                          training.applicationDeadline,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "TBD"}
                  </span>
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
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircleOutlined className="text-emerald-600" />
                <span>Learning Outcomes</span>
              </div>
            }
          >
            <Paragraph type="secondary" className="mb-2 text-xs">
              By the end of this training, participants will be able to:
            </Paragraph>
            <div className="max-h-50 overflow-y-auto custom-scrollbar pr-1">
              <LearningOutcomesList
                outcomes={training?.learningOutcomes || []}
                compact
              />
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Deadline Countdown */}
          {training?.applicationDeadline && (
            <div className="mb-3">
              <DeadlineCountdown
                deadline={training.applicationDeadline}
                label="Application closes in"
                expiredLabel="Deadline passed"
                compact
              />
            </div>
          )}

          {/* Quick Actions */}
          <Card
            className="rounded-xl border-border shadow-none mb-3!"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={<span className="text-sm font-semibold">Quick Actions</span>}
          >
            <div className="space-y-2">
              {training?.isPublished ? (
                <Button
                  block
                  size="middle"
                  onClick={handleUnpublish}
                  aria-label="Unpublish training"
                >
                  Unpublish Training
                </Button>
              ) : (
                <Button
                  block
                  size="middle"
                  type="primary"
                  onClick={handlePublish}
                  aria-label="Publish training"
                >
                  Publish Training
                </Button>
              )}
              <Button
                block
                size="middle"
                onClick={handleOpenAttendanceModal}
              >
                View Attendance
              </Button>
            </div>
          </Card>

          {/* Trainer & Venue Card */}
          <Card
            className="rounded-xl border-border shadow-none mb-3"
            styles={{
              header: { padding: "8px 16px", minHeight: "auto" },
              body: { padding: "16px" },
            }}
            title={
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span>Trainer & Venue</span>
              </div>
            }
          >
            <div className="space-y-3">
              {training?.trainerName && (
                <div className="flex items-center gap-2.5">
                  <div>
                    <Text strong className="block text-sm leading-tight">
                      {training.trainerName}
                    </Text>
                    {training?.trainerContact && (
                      <Text
                        type="secondary"
                        className="text-[10px] block mt-0.5"
                      >
                        {training.trainerContact}
                      </Text>
                    )}
                  </div>
                </div>
              )}

              <Descriptions
                column={1}
                size="small"
                className="compact-descriptions"
              >
                <Descriptions.Item
                  label={<span className="text-xs">Venue</span>}
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
                    label={<span className="text-xs">Link</span>}
                  >
                    <a
                      href={training.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs"
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

      <Modal
        open={attendanceModalOpen}
        onCancel={() => setAttendanceModalOpen(false)}
        footer={null}
        width={900}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        <div className="bg-white px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-800 mb-1 truncate">
                {training?.title || "Training"}
              </h3>
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                {training && (
                  <TrainingDateRange
                    startDate={training.startDate}
                    endDate={training.endDate}
                    compact
                  />
                )}
                {attendanceData?.summary && (
                  <>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-800">{attendanceData.summary.totalApproved}</strong> enrolled
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-800">{attendanceData.summary.uniqueAttendees}</strong> attended
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
              onClick={() => setAttendanceModalOpen(false)}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>

        <div className="p-3">
          <style>{`
            .attendance-table-wrapper {
              max-height: 65vh;
              overflow: auto;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
            }
            .attendance-table-wrapper::-webkit-scrollbar {
              width: 6px;
              height: 6px;
            }
            .attendance-table-wrapper::-webkit-scrollbar-track {
              background: rgba(241, 245, 249, 0.3);
              border-radius: 10px;
            }
            .attendance-table-wrapper::-webkit-scrollbar-thumb {
              background: rgba(226, 232, 240, 0.8);
              border-radius: 10px;
            }
            .attendance-table-wrapper::-webkit-scrollbar-thumb:hover {
              background: rgba(71, 85, 105, 0.5);
            }
            .attendance-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
            }
            .attendance-table thead th {
              position: sticky;
              top: 0;
              background: white;
              z-index: 10;
              padding: 8px 6px;
              border-bottom: 2px solid #e2e8f0;
              font-weight: 600;
              font-size: 11px;
              color: #334155;
              text-align: left;
              white-space: nowrap;
            }
            .attendance-table thead th.faculty-col {
              position: sticky;
              left: 0;
              z-index: 20;
              min-width: 150px;
              background: white;
              border-right: 2px solid #e2e8f0;
            }
            .attendance-table thead th.institution-col {
              position: sticky;
              left: 150px;
              z-index: 20;
              min-width: 140px;
              background: white;
              border-right: 2px solid #e2e8f0;
            }
            .attendance-table thead th.date-col {
              text-align: center;
              min-width: 60px;
              padding: 5px;
            }
            .attendance-table tbody td {
              padding: 8px 6px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 12px;
              color: #475569;
            }
            .attendance-table tbody td.faculty-col {
              position: sticky;
              left: 0;
              background: white;
              z-index: 5;
              border-right: 2px solid #e2e8f0;
            }
            .attendance-table tbody td.institution-col {
              position: sticky;
              left: 150px;
              background: white;
              z-index: 5;
              border-right: 2px solid #e2e8f0;
            }
            .attendance-table tbody td.date-col {
              text-align: center;
              padding: 5px;
            }
            .attendance-table tbody tr:hover td {
              background-color: #f8fafc;
            }
            .attendance-table tbody tr:hover td.faculty-col,
            .attendance-table tbody tr:hover td.institution-col {
              background-color: #f8fafc;
            }
            .date-header {
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.5px;
            }
            .date-day {
              font-size: 14px;
              font-weight: 700;
              color: #1e293b;
              line-height: 1;
            }
            .date-month {
              font-size: 9px;
              font-weight: 500;
              color: #64748b;
              text-transform: uppercase;
              line-height: 1;
            }
          `}</style>
          {attendanceLoading ? (
            <div className="p-12 text-center">
              <Text type="secondary">Loading attendance data...</Text>
            </div>
          ) : attendanceTableData.length > 0 ? (
            <div className="attendance-table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th className="faculty-col">Faculty</th>
                    <th className="institution-col">Institution</th>
                    {trainingDates.map((date, idx) => (
                      <th key={idx} className="date-col">
                        <div className="date-header">
                          <span className="date-day">{dayjs(date).format("DD")}</span>
                          <span className="date-month">{dayjs(date).format("MMM")}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceTableData.map((record, idx) => (
                    <tr key={idx}>
                      <td className="faculty-col">
                        <div>
                          <div className="font-medium text-slate-800 text-xs">{record.user.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{record.user.email}</div>
                        </div>
                      </td>
                      <td className="institution-col">
                        <div className="font-medium text-slate-700 text-xs truncate" title={record.institution?.name}>
                          {record.institution?.shortName || record.institution?.name || "N/A"}
                        </div>
                      </td>
                      {trainingDates.map((date, dateIdx) => {
                        const dateStr = dayjs(date).format("YYYY-MM-DD");
                        const isPresent = record.attendedDates.has(dateStr);
                        return (
                          <td key={dateIdx} className="date-col">
                            {isPresent ? (
                              <CheckCircleFilled className="text-base text-green-500" />
                            ) : (
                              <CloseCircleOutlined className="text-base text-slate-300" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-slate-300 mb-2">
                <TeamOutlined style={{ fontSize: 48 }} />
              </div>
              <Text className="text-slate-500">No attendance records found</Text>
            </div>
          )}

          {attendanceTableData.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <CheckCircleFilled className="text-sm text-green-500" />
                  <span className="text-slate-600">Present</span>
                </div>
                <div className="flex items-center gap-1">
                  <CloseCircleOutlined className="text-sm text-slate-300" />
                  <span className="text-slate-600">Absent</span>
                </div>
              </div>
              <span className="text-slate-500">Scroll to view all dates</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StateTrainingDetailsPage;
