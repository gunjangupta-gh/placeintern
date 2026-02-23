import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Card, Input, Table, Tag, Tooltip, Typography } from "antd";
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import TrainingGreeting from "../../../components/training/TrainingGreeting";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import { TableRowSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import {
  fetchPrincipalTrainings,
  fetchPrincipalTrainingDashboard,
} from "../store/principalTrainingSlice";

const { Text } = Typography;

const STAT_VARIANTS = {
  blue: { iconWrap: "bg-blue-100", iconColor: "text-blue-700" },
  amber: { iconWrap: "bg-amber-100", iconColor: "text-amber-700" },
  purple: { iconWrap: "bg-purple-100", iconColor: "text-purple-700" },
  emerald: { iconWrap: "bg-emerald-100", iconColor: "text-emerald-700" },
};

const StatCard = ({
  icon: Icon,
  title,
  lines = [],
  variant = "blue",
  onClick,
}) => {
  const s = STAT_VARIANTS[variant] || STAT_VARIANTS.blue;
  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 ${onClick ? "cursor-pointer hover:shadow-sm transition-all" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${s.iconWrap}`}
        >
          <Icon className={`text-xs ${s.iconColor}`} />
        </span>
        <Text className="text-[11px] text-slate-600 font-medium leading-tight">
          {title}
        </Text>
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text
            key={line.label}
            className="block text-[12px] leading-snug text-slate-600"
          >
            {line.label}:{" "}
            <span className="font-semibold text-slate-800">{line.value}</span>
          </Text>
        ))}
      </div>
    </div>
  );
};

const TrainingOverviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings, reports } = useSelector(
    (state) => state.principalTraining,
  );
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState("");

  const isLoading = trainings.loading && !trainings.list;

  useEffect(() => {
    dispatch(fetchPrincipalTrainings());
    dispatch(fetchPrincipalTrainingDashboard());
  }, [dispatch]);

  const dashboard = reports?.dashboard || {};

  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};

  const statCards = [
    {
      title: "Trainings",
      icon: CalendarOutlined,
      variant: "blue",
      lines: [
        {
          label: "Trainings Conducted",
          value: trainingMetrics.totalTrainingsConducted ?? 0,
        },
        {
          label: "Total Faculty Registered",
          value: trainingMetrics.totalFacultyRegistered ?? 0,
        },
        {
          label: "Hours Delivered",
          value: trainingMetrics.totalTrainingHoursDelivered ?? 0,
        },
      ],
    },
    {
      title: "Faculty",
      icon: TeamOutlined,
      variant: "amber",
      lines: [
        {
          label: "Completed",
          value: facultyMetrics.facultyWithCompletedTrainings ?? 0,
        },
        {
          label: "Ongoing",
          value: facultyMetrics.facultyWithOngoingTrainings ?? 0,
        },
        { label: "Yet to Start", value: facultyMetrics.facultyYetToStart ?? 0 },
      ],
    },
    {
      title: "Completion Metrics",
      icon: CheckCircleOutlined,
      variant: "purple",
      lines: [
        {
          label: "Completed ≥ 40 Hours",
          value: completionMetrics.facultyCompleted40Hours ?? 0,
        },
        {
          label: "Completed < 40 Hours",
          value: completionMetrics.facultyCompletedUnder40Hours ?? 0,
        },
      ],
    },
    {
      title: "Hours Distribution",
      icon: BarChartOutlined,
      variant: "emerald",
      lines: [
        {
          label: "Avg. Hours per Faculty",
          value: hoursDistribution.averageHoursPerFaculty ?? 0,
        },
        {
          label: "Highest Hours (Single Faculty)",
          value: hoursDistribution.highestHoursSingleFaculty ?? 0,
        },
        {
          label: "Lowest Hours",
          value: hoursDistribution.lowestHoursSingleFaculty ?? 0,
        },
      ],
    },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredTrainings = (trainings.list || [])
    .filter((t) => {
      const enrolledFaculty = Array.isArray(t.enrolledFaculty)
        ? t.enrolledFaculty
        : [];
      const isEnrolledTraining = enrolledFaculty.length > 0;
      const isNotPastTraining = !t.endDate || new Date(t.endDate) >= today;
      return isEnrolledTraining && isNotPastTraining;
    })
    .filter(
      (t) =>
        !searchText ||
        t.title?.toLowerCase().includes(searchText.toLowerCase()),
    );

  const trainingColumns = [
    {
      title: "Training",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div>
          <Text
            className="font-medium cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/app/training/${record.id}`)}
          >
            {text}
          </Text>
          <div className="text-xs text-text-secondary mt-0.5">
            {record.providedBy || "Training Provider"}
          </div>
        </div>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      width: 180,
      render: (_, record) => (
        <TrainingDateRange
          startDate={record.startDate}
          endDate={record.endDate}
          compact
        />
      ),
    },
    {
      title: "Mode",
      dataIndex: "deliveryMode",
      key: "deliveryMode",
      width: 120,
      filters: [
        { text: "Online", value: "ONLINE" },
        { text: "In-Person", value: "OFFLINE" },
        { text: "Hybrid", value: "HYBRID" },
      ],
      onFilter: (value, record) => record.deliveryMode === value,
      render: (mode) => <DeliveryModeBadge mode={mode} showIcon={false} />,
    },
    {
      title: "Enrolled Faculty",
      key: "enrolledFaculty",
      render: (_, record) => {
        const names = record.enrolledFaculty || [];
        if (!names.length)
          return <Text className="text-xs text-slate-400">—</Text>;
        const visible = names.slice(0, 3);
        const rest = names.slice(3);
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {visible.map((name) => (
              <Tag key={name} className="text-[11px] m-0">
                {name}
              </Tag>
            ))}
            {rest.length > 0 && (
              <Tooltip title={rest.join(", ")}>
                <Tag className="text-[11px] m-0 cursor-pointer">
                  +{rest.length} more
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 training-ui">
      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <TrainingGreeting
          userName={user?.name}
          subtitle="Monitor faculty training opportunities and participation across your institution."
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <Card
        className="rounded-xl border-border shadow-none"
        styles={{ body: { padding: 0 } }}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Input
              placeholder="Search trainings..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full max-w-md"
              size="middle"
              allowClear
            />
          </div>
          {isLoading ? (
            <TableRowSkeleton rows={5} columns={4} />
          ) : filteredTrainings.length > 0 ? (
            <div className="custom-scrollbar overflow-x-auto">
              <Table
                className="custom-table"
                rowKey="id"
                columns={trainingColumns}
                dataSource={filteredTrainings}
                loading={trainings.loading}
                size="small"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total, range) => (
                    <Text className="text-xs">
                      {range[0]}-{range[1]} of {total}
                    </Text>
                  ),
                  size: "small",
                }}
                scroll={{ x: "max-content" }}
              />
            </div>
          ) : (
            <TrainingEmptyState
              type={searchText ? "search" : "calendar"}
              message={searchText ? "No matching trainings" : "No trainings"}
              description={
                searchText
                  ? "Try adjusting your search."
                  : "No training opportunities available."
              }
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default TrainingOverviewPage;
