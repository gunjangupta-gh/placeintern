import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Badge,
  Button,
  Calendar,
  Card,
  Col,
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
  EyeOutlined,
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

const { Text, Title } = Typography;

const getBranchLabel = (training) => {
  if (typeof training?.branchLabel === "string" && training.branchLabel.trim()) {
    return training.branchLabel;
  }

  if (Array.isArray(training?.branchNames) && training.branchNames.length > 0) {
    return training.branchNames.join(", ");
  }

  if (Array.isArray(training?.targetBranches) && training.targetBranches.length > 0) {
    return training.targetBranches
      .map((branch) => branch?.shortName || branch?.name)
      .filter(Boolean)
      .join(", ");
  }

  return "All Branches";
};

const TrainingCalendarPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings, calendar } = useSelector((state) => state.facultyTraining);

  const [viewMode, setViewMode] = useState("calendar");
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [trainingFilter, setTrainingFilter] = useState("all"); // "all" or "my"

  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [filters, setFilters] = useState({
    year: null,
    month: null,
    deliveryMode: null,
    difficulty: null,
  });

  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  useEffect(() => {
    const params = {
      ...filters,
      forceRefresh: true,
      myOnly: trainingFilter === "my",
    };

    // Add pagination only for list view
    if (viewMode === "list") {
      params.page = pagination.current;
      params.limit = pagination.pageSize;
    }

    // Add search if present
    if (searchText) {
      params.search = searchText;
    }

    dispatch(fetchTrainings(params)).then((result) => {
      if (result.payload && !result.payload.cached && viewMode === "list") {
        const responseData = result.payload;
        // Update pagination total from API response
        setPagination(prev => ({
          ...prev,
          total: responseData.total || responseData.pagination?.total || (responseData.data?.length || 0),
        }));
      }
    });

    dispatch(fetchCalendar({ ...filters, myOnly: trainingFilter === "my", forceRefresh: true }));
  }, [dispatch, filters, viewMode, pagination.current, pagination.pageSize, searchText, trainingFilter]);

  // Keyboard navigation for calendar
  const handleKeyDown = useCallback(
    (e) => {
      if (viewMode !== "calendar") return;

      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (
          ["input", "textarea", "select"].includes(target.tagName.toLowerCase()) ||
          target.closest(".ant-select") ||
          target.closest(".ant-picker") ||
          target.closest(".ant-input") ||
          target.closest(".ant-input-affix-wrapper")
        )
      ) {
        return;
      }

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

  const handleTableChange = (newPagination) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      total: pagination.total,
    });
  };

  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    // Reset to page 1 when search changes
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const filteredTrainings = useMemo(() => {
    // For list view with server-side pagination, return list as-is
    // Server handles search/filter
    if (viewMode === "list") {
      return trainings.list || [];
    }

    // For calendar view, do client-side search filtering
    let result = trainings.list || [];
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search) ||
          t.providedBy?.toLowerCase().includes(search) ||
          getBranchLabel(t).toLowerCase().includes(search),
      );
    }
    return result;
  }, [trainings.list, searchText, viewMode]);

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

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 11 }, (_, index) => {
      const year = currentYear - 5 + index;
      return { value: year, label: String(year) };
    });
  }, []);

  const monthOptions = useMemo(
    () => [
      { value: 1, label: "January" },
      { value: 2, label: "February" },
      { value: 3, label: "March" },
      { value: 4, label: "April" },
      { value: 5, label: "May" },
      { value: 6, label: "June" },
      { value: 7, label: "July" },
      { value: 8, label: "August" },
      { value: 9, label: "September" },
      { value: 10, label: "October" },
      { value: 11, label: "November" },
      { value: 12, label: "December" },
    ],
    [],
  );

  const hasActiveFilters =
    filters.year ||
    filters.month ||
    filters.deliveryMode ||
    filters.difficulty;

  const clearFilters = () => {
    setFilters({
      year: null,
      month: null,
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
      title: "Branch",
      key: "branch",
      width: 200,
      render: (_, record) => (
        <Text className="text-xs text-slate-700">{getBranchLabel(record)}</Text>
      ),
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
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Title level={4} className="mb-0! text-lg">
            Training Calendar
          </Title>
        </div>
        <Space size="small" wrap className="w-full lg:w-auto">
          <Segmented
            className="w-full sm:w-auto"
            size="middle"
            value={trainingFilter}
            onChange={setTrainingFilter}
            options={[
              { value: "all", label: "All Branches Trainings" },
              { value: "my", label: "My Branch Trainings" },
            ]}
          />
          <Button className="w-full sm:w-auto" size="middle" icon={<AimOutlined />} onClick={jumpToToday}>
            Today
          </Button>
          <Segmented
            className="w-full sm:w-auto"
            size="middle"
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
      <Card className="rounded-xl border-border shadow-none mb-3!" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
          <Input
            placeholder="Search trainings..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchText}
            onChange={handleSearchChange}
            className="lg:flex-1"
            size="middle"
            allowClear
            aria-label="Search trainings"
          />
          <Button
            size="middle"
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
          <div className="pt-2.5 mt-2.5 border-t border-slate-100">
            <Row gutter={[8, 8]}>
              <Col xs={24} sm={12} md={4}>
                <Select
                  size="small"
                  allowClear
                  className="w-full"
                  placeholder="Year"
                  value={filters.year}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, year: value || null }))
                  }
                  options={yearOptions}
                  getPopupContainer={() => document.body}
                  dropdownStyle={{ zIndex: 2000 }}
                />
              </Col>
              <Col xs={24} sm={12} md={4}>
                <Select
                  size="small"
                  allowClear
                  className="w-full"
                  placeholder="Month"
                  value={filters.month}
                  onChange={(value) =>
                    setFilters((prev) => ({ ...prev, month: value || null }))
                  }
                  options={monthOptions}
                  getPopupContainer={() => document.body}
                  dropdownStyle={{ zIndex: 2000 }}
                />
              </Col>
              <Col xs={24} sm={12} md={4}>
                <Select
                  size="small"
                  allowClear
                  placeholder="Mode"
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
                  getPopupContainer={() => document.body}
                  dropdownStyle={{ zIndex: 2000 }}
                />
              </Col>
              {hasActiveFilters && (
                <Col xs={24} sm={12} md={3}>
                  <Button size="small" icon={<ClearOutlined />} onClick={clearFilters} block>
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
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={18}>
            <CalendarSkeleton />
          </Col>
          <Col xs={24} lg={6}>
            <SelectedDaySkeleton />
          </Col>
        </Row>
      ) : filteredTrainings.length > 0 ? (
        viewMode === "calendar" ? (
          <Row gutter={[12, 12]}>
            <Col xs={24} lg={18}>
              <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
                <style>{`
                  .training-calendar .ant-picker-calendar-date {
                    margin: 2px;
                  }
                  .training-calendar .ant-picker-cell {
                    padding: 2px;
                  }
                  .training-calendar .ant-picker-calendar-header {
                    padding: 0 0 12px 0;
                  }
                  .training-calendar .ant-picker-content {
                    min-height: 400px;
                  }
                  .training-calendar .ant-picker-cell-in-view {
                    min-height: 60px;
                  }
                `}</style>
                <Calendar
                  className="training-calendar"
                  value={selectedDate}
                  onSelect={setSelectedDate}
                  headerRender={({ value }) => {
                    const calendarYearOptions = useMemo(() => {
                      const currentYear = value.year();
                      return Array.from({ length: 11 }, (_, index) => {
                        const year = currentYear - 5 + index;
                        return { value: year, label: String(year) };
                      });
                    }, [value]);

                    const calendarMonthOptions = useMemo(
                      () => [
                        { value: 0, label: "January" },
                        { value: 1, label: "February" },
                        { value: 2, label: "March" },
                        { value: 3, label: "April" },
                        { value: 4, label: "May" },
                        { value: 5, label: "June" },
                        { value: 6, label: "July" },
                        { value: 7, label: "August" },
                        { value: 8, label: "September" },
                        { value: 9, label: "October" },
                        { value: 10, label: "November" },
                        { value: 11, label: "December" },
                      ],
                      [],
                    );

                    return (
                      <div className="flex items-center justify-end gap-2 px-2 pb-2">
                        <Select
                          size="small"
                          className="w-28"
                          value={value.year()}
                          options={calendarYearOptions}
                          onChange={(year) => setSelectedDate(value.clone().year(year))}
                          getPopupContainer={() => document.body}
                          dropdownStyle={{ zIndex: 2000 }}
                        />
                        <Select
                          size="small"
                          className="w-32"
                          value={value.month()}
                          options={calendarMonthOptions}
                          onChange={(month) => setSelectedDate(value.clone().month(month))}
                          getPopupContainer={() => document.body}
                          dropdownStyle={{ zIndex: 2000 }}
                        />
                      </div>
                    );
                  }}
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
                        <div className="h-full min-h-20 flex flex-col items-center justify-center p-2 rounded-lg hover:bg-slate-50">
                          <div className="text-sm font-medium text-slate-700">
                            {dateValue.format("MMM")}
                          </div>
                          {monthTrainings.length > 0 && (
                            <div className="text-[10px] text-blue-600 font-medium mt-1">
                              {monthTrainings.length}
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
                          `h-full min-h-20 rounded-lg p-2 border ` +
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
                        <div className="space-y-1">
                          {dayTrainings.slice(0, 2).map((training) => (
                            <div
                              key={training.id}
                              className="text-[10px] text-slate-600 truncate leading-tight"
                            >
                              • {training.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* Calendar Legend */}
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <CalendarLegend showDeliveryModes showStatus={false} compact />
                </div>
              </Card>
            </Col>

            {/* Selected Day Panel */}
            <Col xs={24} lg={6}>
              <Card className="rounded-xl border-border shadow-none sticky" styles={{ body: { padding: '12px' } }}>
                <div className="mb-2! pb-2 border-b border-slate-200">
                  <div>
                    <Text className="text-[10px] text-slate-500 block mb-0">
                      {selectedDate.isSame(dayjs(), "day")
                        ? "Today"
                        : "Selected Day"}
                    </Text>
                    <Text className="font-semibold text-sm text-slate-800">
                      {selectedDate.format("DD MMM, YYYY")}
                    </Text>
                  </div>
                </div>

                {selectedDayTrainings.length ? (
                  <div className="space-y-2! max-h-112.5 overflow-y-auto pr-1">
                    {selectedDayTrainings.map((training) => (
                      <Card
                        key={training.id}
                        className="rounded-lg border-slate-200 hover:border-blue-400"
                        styles={{ body: { padding: "10px" } }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Text className="font-medium text-xs text-slate-800 flex-1 line-clamp-1">
                            {training.title}
                          </Text>
                          <DeliveryModeBadge
                            mode={training.deliveryMode}
                            showIcon={false}
                          />
                        </div>
                        <Text type="secondary" className="text-[10px] block mb-1">
                          {training.venue || training.providedBy}
                        </Text>
                        <Text type="secondary" className="text-[10px] block mb-1">
                          <EnvironmentOutlined className="mr-1" />
                          {getBranchLabel(training)}
                        </Text>
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                          <TrainingDateRange
                            startDate={training.startDate}
                            endDate={training.endDate}
                            compact
                          />
                          <Tooltip title="View training">
                            <Button
                              size="small"
                              type="text"
                              icon={<EyeOutlined />}
                              onClick={() => navigate(`/app/training/${training.id}`)}
                              aria-label={`View training: ${training.title}`}
                            />
                          </Tooltip>
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
          <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
            <div className="custom-scrollbar overflow-x-auto">
              <Table
                className="custom-table"
                rowKey="id"
                columns={columns}
                dataSource={filteredTrainings}
                loading={trainings.loading}
                size="small"
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showTotal: (total, range) => (
                    <Text className="text-[10px] text-slate-600">
                      {range[0]}-{range[1]} of {total}
                    </Text>
                  ),
                  size: "small",
                }}
                onChange={handleTableChange}
                scroll={{ x: 'max-content' }}
                onRow={(record) => ({
                  onClick: () => navigate(`/app/training/${record.id}`),
                  className: "cursor-pointer hover:bg-slate-50",
                })}
              />
            </div>
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
