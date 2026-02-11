import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Badge,
  Button,
  Calendar,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Table,
  Tooltip,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  SearchOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  RightOutlined,
  ClockCircleOutlined,
  ClearOutlined,
  EnvironmentOutlined,
  AimOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import ApplicationDeadline from "../../../components/training/ApplicationDeadline";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import TrainingBreadcrumb from "../../../components/training/TrainingBreadcrumb";
import CalendarLegend from "../../../components/training/CalendarLegend";
import {
  CalendarSkeleton,
  TrainingCardSkeleton,
  SelectedDaySkeleton,
} from "../../../components/training/skeletons/TrainingSkeletons";
import { fetchCalendar, fetchTrainings } from "../store/facultyTrainingSlice";
import { useBranches } from "../../../hooks";

const { Text, Title } = Typography;

const TrainingCalendarPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { activeBranches } = useBranches(true);
  const { trainings, calendar } = useSelector((state) => state.facultyTraining);

  const [viewMode, setViewMode] = useState("calendar");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [filters, setFilters] = useState({
    year: null,
    month: null,
    branchIds: [],
    deliveryMode: null,
    difficulty: null,
  });

  useEffect(() => {
    dispatch(fetchTrainings(filters));
    dispatch(fetchCalendar(filters));
  }, [dispatch, filters]);

  // Keyboard navigation for calendar
  const handleKeyDown = useCallback(
    (e) => {
      if (viewMode !== "calendar") return;

      switch (e.key) {
        case "ArrowLeft":
          setSelectedDate((prev) => prev.subtract(1, "day"));
          break;
        case "ArrowRight":
          setSelectedDate((prev) => prev.add(1, "day"));
          break;
        case "ArrowUp":
          setSelectedDate((prev) => prev.subtract(1, "week"));
          break;
        case "ArrowDown":
          setSelectedDate((prev) => prev.add(1, "week"));
          break;
        case "t":
        case "T":
          setSelectedDate(dayjs());
          break;
        default:
          break;
      }
    },
    [viewMode],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const branchOptions = useMemo(
    () => activeBranches.map((b) => ({ value: b.id, label: b.name })),
    [activeBranches],
  );

  const filteredTrainings = useMemo(() => {
    let result = trainings.list || [];
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search) ||
          t.providedBy?.toLowerCase().includes(search),
      );
    }
    return result;
  }, [trainings.list, searchText]);

  const calendarTrainings = useMemo(() => {
    if (Array.isArray(calendar.list)) return calendar.list;
    if (calendar.list?.trainings) return calendar.list.trainings;
    return [];
  }, [calendar.list]);

  const getTrainingsForDate = (dateValue) => {
    if (!calendarTrainings.length) return [];
    return calendarTrainings.filter((training) => {
      const start = dayjs(training.startDate);
      const end = dayjs(training.endDate);
      return (
        dateValue.isSame(start, "day") ||
        dateValue.isSame(end, "day") ||
        (dateValue.isAfter(start, "day") && dateValue.isBefore(end, "day"))
      );
    });
  };

  const selectedDayTrainings = useMemo(
    () => getTrainingsForDate(selectedDate),
    [selectedDate, calendarTrainings],
  );

  const hasActiveFilters =
    filters.year ||
    filters.month ||
    filters.branchIds.length ||
    filters.deliveryMode ||
    filters.difficulty;

  const clearFilters = () => {
    setFilters({
      year: null,
      month: null,
      branchIds: [],
      deliveryMode: null,
      difficulty: null,
    });
    setSearchText("");
  };

  const jumpToToday = () => {
    setSelectedDate(dayjs());
  };

  const columns = [
    {
      title: "Training",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div>
          <Text className="font-medium text-sm text-slate-800">{text}</Text>
          <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {record.description || "No description"}
          </div>
        </div>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      width: 160,
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate),
      render: (_, record) => (
        <div className="text-xs">
          <TrainingDateRange
            startDate={record.startDate}
            endDate={record.endDate}
            compact
          />
        </div>
      ),
    },
    {
      title: "Mode",
      dataIndex: "deliveryMode",
      key: "deliveryMode",
      width: 100,
      render: (mode) => <DeliveryModeBadge mode={mode} showIcon={false} />,
    },
    {
      title: "Deadline",
      key: "deadline",
      width: 100,
      render: (_, record) => (
        <div className="text-xs">
          <ApplicationDeadline deadline={record.applicationDeadline} compact />
        </div>
      ),
    },
  ];

  const isLoading = trainings.loading && calendar.loading && !trainings.list;

  return (
    <div className="p-6 training-ui">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Title level={4} className="!mb-0">
            Training Calendar
          </Title>
        </div>
        <Space>
          <Button size="medium" icon={<AimOutlined />} onClick={jumpToToday}>
            Today
          </Button>
          <Segmented
            size="medium"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: "calendar", icon: <CalendarOutlined /> },
              { value: "list", icon: <UnorderedListOutlined /> },
            ]}
          />
        </Space>
      </div>

      {/* Search and Filters Bar */}
      <Card className="rounded-xl border-border shadow-none !mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <Input
            placeholder="Search trainings..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:flex-1"
            allowClear
            aria-label="Search trainings"
          />
          <Button
            size="small"
            icon={<FilterOutlined />}
            onClick={() => setShowFilters(!showFilters)}
            type={showFilters ? "primary" : "default"}
          >
            Filters
            {hasActiveFilters && (
              <Badge
                count={
                  Object.values(filters).filter(
                    (v) => v && (Array.isArray(v) ? v.length : true),
                  ).length
                }
                size="small"
                className="ml-1"
              />
            )}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="pt-3 mt-3 border-border">
            <Row gutter={[8, 8]}>
              <Col xs={24} sm={12} md={4}>
                <DatePicker
                  picker="year"
                  className="w-full"
                  placeholder="Year"
                  value={filters.year ? dayjs().year(filters.year) : null}
                  onChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      year: value ? value.year() : null,
                    }))
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={4}>
                <DatePicker
                  picker="month"
                  className="w-full"
                  placeholder="Month"
                  value={
                    filters.month ? dayjs().month(filters.month - 1) : null
                  }
                  onChange={(value) =>
                    setFilters((prev) => ({
                      ...prev,
                      month: value ? value.month() + 1 : null,
                    }))
                  }
                />
              </Col>
              <Col xs={24} sm={12} md={5}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Branches"
                  className="w-full"
                  options={branchOptions}
                  value={filters.branchIds}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, branchIds: value }))
                  }
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} md={4}>
                <Select
                  allowClear
                  placeholder="Delivery Mode"
                  className="w-full"
                  value={filters.deliveryMode}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, deliveryMode: value }))
                  }
                  options={[
                    { value: "ONLINE", label: "Online" },
                    { value: "OFFLINE", label: "In-Person" },
                    { value: "HYBRID", label: "Hybrid" },
                  ]}
                />
              </Col>
              {/* <Col xs={24} sm={12} md={4}>
                <Select
                  allowClear
                  placeholder="Difficulty"
                  className="w-full"
                  value={filters.difficulty}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, difficulty: value }))
                  }
                  options={[
                    { value: "BEGINNER", label: "Beginner" },
                    { value: "INTERMEDIATE", label: "Intermediate" },
                    { value: "ADVANCED", label: "Advanced" },
                  ]}
                />
              </Col> */}
              {hasActiveFilters && (
                <Col xs={24} sm={12} md={3}>
                  <Button icon={<ClearOutlined />} onClick={clearFilters} block>
                    Clear
                  </Button>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <CalendarSkeleton />
          </Col>
          <Col xs={24} lg={8}>
            <SelectedDaySkeleton />
          </Col>
        </Row>
      ) : filteredTrainings.length > 0 ? (
        viewMode === "calendar" ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card className="rounded-xl border-border shadow-none">
                <style>{`
                  .training-calendar .ant-picker-calendar-date {
                    margin: 2px;
                  }
                  .training-calendar .ant-picker-cell {
                    padding: 2px;
                  }
                `}</style>
                <Calendar
                  className="training-calendar"
                  value={selectedDate}
                  onSelect={setSelectedDate}
                  fullCellRender={(dateValue, info) => {
                    // Handle month view
                    if (info.type === "month") {
                      const monthTrainings = calendarTrainings.filter(
                        (training) => {
                          const start = dayjs(training.startDate);
                          const end = dayjs(training.endDate);
                          return (
                            dateValue.isSame(start, "month") ||
                            dateValue.isSame(end, "month") ||
                            (dateValue.isAfter(start, "month") &&
                              dateValue.isBefore(end, "month"))
                          );
                        },
                      );
                      return (
                        <div className="h-full flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50">
                          <div className="text-sm font-medium text-slate-700">
                            {dateValue.format("MMM")}
                          </div>
                          {monthTrainings.length > 0 && (
                            <div className="text-[10px] text-blue-600 font-medium mt-1">
                              {monthTrainings.length} training
                              {monthTrainings.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Handle year view
                    if (info.type === "year") {
                      const yearTrainings = calendarTrainings.filter(
                        (training) => {
                          const start = dayjs(training.startDate);
                          const end = dayjs(training.endDate);
                          return (
                            dateValue.isSame(start, "year") ||
                            dateValue.isSame(end, "year") ||
                            (dateValue.isAfter(start, "year") &&
                              dateValue.isBefore(end, "year"))
                          );
                        },
                      );
                      return (
                        <div className="h-full flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50">
                          <div className="text-sm font-medium text-slate-700">
                            {dateValue.format("YYYY")}
                          </div>
                          {yearTrainings.length > 0 && (
                            <div className="text-[10px] text-blue-600 font-medium mt-1">
                              {yearTrainings.length} training
                              {yearTrainings.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Handle date (day) view
                    const dayTrainings = getTrainingsForDate(dateValue);
                    const isSelected = dateValue.isSame(selectedDate, "day");
                    const isToday = dateValue.isSame(dayjs(), "day");
                    const hasTrainings = dayTrainings.length > 0;

                    return (
                      <div
                        className={
                          `h-full rounded-lg p-1.5 border ` +
                          (isSelected
                            ? "bg-blue-50 border-blue-400"
                            : isToday
                              ? "border-blue-500 border-2"
                              : hasTrainings
                                ? "border-slate-200 hover:border-blue-300"
                                : "border-transparent hover:border-slate-200")
                        }
                        role="button"
                        tabIndex={0}
                      >
                        <div
                          className={`text-xs font-semibold mb-1 ${isSelected ? "text-blue-700" : isToday ? "text-blue-600" : "text-slate-700"}`}
                        >
                          {dateValue.date()}
                        </div>
                        <div className="space-y-0.5">
                          {dayTrainings.slice(0, 2).map((training) => (
                            <div
                              key={training.id}
                              className="text-[10px] text-slate-600 truncate"
                            >
                              • {training.title}
                            </div>
                          ))}
                          {dayTrainings.length > 2 && (
                            <div className="text-[9px] text-blue-600 font-medium">
                              +{dayTrainings.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Calendar Legend */}
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <CalendarLegend showDeliveryModes showStatus={false} />
                </div>
              </Card>
            </Col>

            {/* Selected Day Panel */}
            <Col xs={24} lg={8}>
              <Card className="rounded-xl border-border shadow-none sticky ">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
                  <div>
                    <Text className="text-xs text-slate-500 block mb-0.5">
                      {selectedDate.isSame(dayjs(), "day")
                        ? "Today"
                        : "Selected Day"}
                    </Text>
                    <Text className="font-semibold text-base text-slate-800">
                      {selectedDate.format("DD MMM, YYYY")}
                    </Text>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                    {selectedDate.format("DD")}
                  </div>
                </div>

                {selectedDayTrainings.length ? (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {selectedDayTrainings.map((training) => (
                      <Card
                        key={training.id}
                        className="rounded-lg border-slate-200 hover:border-blue-400 cursor-pointer"
                        styles={{ body: { padding: "12px" } }}
                        onClick={() => navigate(`/app/training/${training.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <Text className="font-medium text-sm text-slate-800 flex-1">
                            {training.title}
                          </Text>
                          <DeliveryModeBadge
                            mode={training.deliveryMode}
                            showIcon={false}
                          />
                        </div>
                        <Text type="secondary" className="text-xs block mb-2">
                          {training.venue || training.providedBy}
                        </Text>
                        <div className="pt-2 border-t border-slate-100">
                          <TrainingDateRange
                            startDate={training.startDate}
                            endDate={training.endDate}
                            compact
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <TrainingEmptyState
                    type="calendar"
                    message="No trainings"
                    description="Select another date."
                    compact
                  />
                )}
              </Card>
            </Col>
          </Row>
        ) : (
          <Card className="rounded-xl border-border shadow-none">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredTrainings}
              loading={trainings.loading}
              size="small"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-xs text-slate-600">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: "small",
              }}
              onRow={(record) => ({
                onClick: () => navigate(`/app/training/${record.id}`),
                className: "cursor-pointer hover:bg-slate-50",
              })}
            />
          </Card>
        )
      ) : (
        <Card className="rounded-xl border-border shadow-none">
          <TrainingEmptyState
            type={searchText || hasActiveFilters ? "search" : "calendar"}
            message={
              searchText || hasActiveFilters
                ? "No matching trainings"
                : "No trainings available"
            }
            description={
              searchText || hasActiveFilters
                ? "Try adjusting your search or filter criteria."
                : "Check back later for new training opportunities."
            }
            actionText={hasActiveFilters ? "Clear Filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        </Card>
      )}
    </div>
  );
};

export default TrainingCalendarPage;
