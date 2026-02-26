import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Card,
  Input,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  Descriptions,
  Statistic,
  Row,
  Col,
  Segmented,
  Calendar,
  Select,
  Form,
  message,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  TeamOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import TrainingForm from "./components/training/TrainingForm";
import {
  fetchStateTrainings,
  fetchStateTrainingAttendance,
  fetchStateFeedbackForms,
  fetchStatePreTestForms,
  fetchStatePostTestForms,
  createStateTraining,
  updateStateTraining,
  publishStateTraining,
  unpublishStateTraining,
} from "../store/stateTrainingSlice";

const { Text } = Typography;

const TrainingManagementPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { trainings, feedbackForms, preTestForms, postTestForms, attendance } = useSelector(
    (state) => state.stateTraining,
  );
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("LIST"); // LIST or CALENDAR
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);

  // Form modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState("create"); // 'create' or 'edit'
  const [editingTraining, setEditingTraining] = useState(null);
  const [form] = Form.useForm();
  const [formLoading, setFormLoading] = useState(false);
  const [formStep, setFormStep] = useState(0);

  useEffect(() => {
    dispatch(fetchStateTrainings());
    dispatch(fetchStateFeedbackForms());
    dispatch(fetchStatePreTestForms({ forceRefresh: true }));
    dispatch(fetchStatePostTestForms({ forceRefresh: true }));
  }, [dispatch]);

  const handleOpenCreateModal = () => {
    setFormMode("create");
    setEditingTraining(null);
    form.resetFields();
    setFormStep(0);
    setFormModalOpen(true);
  };

  const handleOpenEditModal = (training) => {
    setFormMode("edit");
    setEditingTraining(training);
    setFormStep(0);

    // Populate form with training data
    form.setFieldsValue({
      title: training.title,
      description: training.description,
      providedBy: training.providedBy,
      trainerName: training.trainerName,
      trainerContact: training.trainerContact,
      startDate: training.startDate ? dayjs(training.startDate) : null,
      endDate: training.endDate ? dayjs(training.endDate) : null,
      startTime: training.startTime ? dayjs(training.startTime) : null,
      endTime: training.endTime ? dayjs(training.endTime) : null,
      applicationDeadline: training.applicationDeadline
        ? dayjs(training.applicationDeadline)
        : null,
      duration: training.duration,
      cost: training.cost,
      deliveryMode: training.deliveryMode,
      difficulty: training.difficulty,
      designation: training.designation,
      venue: training.venue,
      meetingLink: training.meetingLink,
      capacity: training.capacity,
      targetBranchIds: training.targetBranches?.map((b) => b.id) || [],
      prerequisites: training.prerequisites,
      learningOutcomes: Array.isArray(training.learningOutcomes)
        ? training.learningOutcomes.join("\n")
        : training.learningOutcomes,
      feedbackFormId: training.feedbackFormId,
      preTestFormId: training.preTestFormId || training.preTestForm?.id || null,
      postTestFormId: training.postTestFormId || training.postTestForm?.id || null,
      publish: training.isPublished,
    });

    setFormModalOpen(true);
  };

  const handleCloseFormModal = () => {
    setFormModalOpen(false);
    setEditingTraining(null);
    form.resetFields();
    setFormStep(0);
  };

  const handleFormSubmit = async (values) => {
    setFormLoading(true);
    try {
      if (formMode === "create") {
        await dispatch(createStateTraining(values)).unwrap();
        message.success("Training created successfully!");
      } else {
        await dispatch(
          updateStateTraining({ id: editingTraining.id, data: values }),
        ).unwrap();
        message.success("Training updated successfully!");
      }
      handleCloseFormModal();
      dispatch(fetchStateTrainings());
    } catch (error) {
      message.error(error || `Failed to ${formMode} training`);
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewAttendance = async (training) => {
    setSelectedTraining(training);
    await dispatch(fetchStateTrainingAttendance({ trainingId: training.id }));
    setStatsModalOpen(true);
  };

  useEffect(() => {
    const trainingIdToOpen = location.state?.openAttendanceTrainingId;
    if (!trainingIdToOpen || !trainings.list?.length) return;

    const trainingToOpen = (trainings.list || []).find(
      (item) => String(item.id) === String(trainingIdToOpen),
    );

    if (!trainingToOpen) return;

    setSelectedTraining(trainingToOpen);
    dispatch(fetchStateTrainingAttendance({ trainingId: trainingToOpen.id }));
    setStatsModalOpen(true);

    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, trainings.list, dispatch, navigate]);

  const handleTogglePublish = async (training) => {
    try {
      if (training.isPublished) {
        await dispatch(unpublishStateTraining(training.id)).unwrap();
        message.success("Training moved to draft and marked inactive");
      } else {
        await dispatch(publishStateTraining(training.id)).unwrap();
        message.success("Training published and marked active");
      }
    } catch (error) {
      message.error(
        error ||
          `Failed to ${training.isPublished ? "unpublish" : "publish"} training`,
      );
    }
  };

  const filteredTrainings = useMemo(() => {
    let result = trainings.list || [];

    // Filter by status
    if (statusFilter === "PUBLISHED") {
      result = result.filter((t) => t.isPublished);
    } else if (statusFilter === "DRAFT") {
      result = result.filter((t) => !t.isPublished);
    }

    // Filter by search
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          (item.title || "").toLowerCase().includes(search) ||
          (item.providedBy || "").toLowerCase().includes(search),
      );
    }
    return result;
  }, [trainings.list, searchText, statusFilter]);

  const stats = useMemo(() => {
    const list = trainings.list || [];
    return {
      total: list.length,
      published: list.filter((item) => item.isPublished).length,
      draft: list.filter((item) => !item.isPublished).length,
    };
  }, [trainings.list]);

  const columns = [
    {
      title: "Training",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div className="py-1">
          <div className="font-medium text-sm text-slate-800">{text}</div>
          <Text type="secondary" className="text-xs">
            {record.providedBy || "Training Provider"}
          </Text>
        </div>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      width: 200,
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
      width: 100,
      render: (mode) => <DeliveryModeBadge mode={mode} />,
    },
    {
      title: "Status",
      dataIndex: "isPublished",
      key: "isPublished",
      width: 100,
      render: (value) => (
        <Tag color={value ? "green" : "orange"} className="text-xs">
          {value ? "Published" : "Draft"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/app/training/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="View Attendance">
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleViewAttendance(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(record)}
            />
          </Tooltip>
          <Tooltip title={record.isPublished ? "Unpublish (Draft)" : "Publish (Active)"}>
            <Button
              type="text"
              size="small"
              icon={record.isPublished ? <CloseCircleOutlined /> : <CheckCircleFilled />}
              onClick={() => handleTogglePublish(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const attendanceData = useMemo(() => {
    if (!selectedTraining || !attendance.list) {
      return null;
    }
    return attendance.list;
  }, [selectedTraining, attendance.list]);

  // Generate date columns for attendance table
  const trainingDates = useMemo(() => {
    if (!selectedTraining) return [];
    const dates = [];
    const start = dayjs(selectedTraining.startDate);
    const end = dayjs(selectedTraining.endDate);
    let current = start;

    while (current.isSameOrBefore(end, "day")) {
      dates.push(current.toDate());
      current = current.add(1, "day");
    }
    return dates;
  }, [selectedTraining]);

  // Transform attendance data for table with date checkmarks
  const attendanceTableData = useMemo(() => {
    if (!attendanceData?.attendanceByUser || !attendanceData?.records)
      return [];

    return attendanceData.attendanceByUser.map((userData) => {
      const userAttendanceRecords = attendanceData.records.filter(
        (record) => record.userId === userData.user.id,
      );

      // Create a map of attended dates
      const attendedDates = new Set(
        userAttendanceRecords.map((record) =>
          dayjs(record.attendanceDate).format("YYYY-MM-DD"),
        ),
      );

      return {
        ...userData,
        attendedDates,
        institution: userAttendanceRecords[0]?.user?.Institution,
      };
    });
  }, [attendanceData]);

  const getTrainingsForDate = (dateValue) => {
    if (!filteredTrainings.length) return [];
    return filteredTrainings.filter((training) => {
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
    [selectedDate, filteredTrainings],
  );

  const calendarYearOptions = useMemo(() => {
    const currentYear = selectedDate.year();
    return Array.from({ length: 11 }, (_, index) => {
      const year = currentYear - 5 + index;
      return { value: year, label: String(year) };
    });
  }, [selectedDate]);

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
    <div className="p-4 training-ui">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 mb-0.5">
            Training Management
          </h1>
          <Text type="secondary" className="text-xs">
            Manage and monitor all training programs
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="middle"
          onClick={handleOpenCreateModal}
        >
          Create Training
        </Button>
      </div>


      {/* Filters */}
      <Card className="rounded-xl border-border shadow-none !mb-3" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <Input
            placeholder="Search trainings..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:w-80"
            size="middle"
            allowClear
          />
          <Space size="small">
            <Segmented
              size="small"
              options={[
                { label: "All", value: "ALL" },
                { label: "Published", value: "PUBLISHED" },
                { label: "Drafts", value: "DRAFT" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <Segmented
              size="small"
              options={[
                {
                  label: "List",
                  value: "LIST",
                  icon: <UnorderedListOutlined />,
                },
                {
                  label: "Calendar",
                  value: "CALENDAR",
                  icon: <CalendarOutlined />,
                },
              ]}
              value={viewMode}
              onChange={setViewMode}
            />
          </Space>
        </div>
      </Card>

      {/* Table/Calendar View */}
      {viewMode === "LIST" ? (
        <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
          <div className="p-0 custom-scrollbar overflow-x-auto">
            {filteredTrainings.length > 0 ? (
              <Table
                rowKey="id"
                columns={columns}
                dataSource={filteredTrainings}
                loading={trainings.loading}
                pagination={{ pageSize: 10, showSizeChanger: true, size: 'small' }}
                size="small"
                className="custom-table"
                scroll={{ x: 'max-content' }}
              />
            ) : (
              <div className="p-6">
                <TrainingEmptyState
                  type={searchText ? "search" : "calendar"}
                  message={searchText ? "No trainings found" : "No trainings yet"}
                  description={
                    searchText
                      ? "Try adjusting your search terms."
                      : "Create your first training to get started."
                  }
                  actionText={searchText ? "Clear Search" : "Create Training"}
                  onAction={() =>
                    searchText ? setSearchText("") : handleOpenCreateModal()
                  }
                />
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Row gutter={[12, 12]}>
          <Col xs={24} lg={16}>
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
                headerRender={({ value }) => (
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
                )}
                fullCellRender={(dateValue, info) => {
                  // Handle month view
                  if (info.type === "month") {
                    const monthTrainings = filteredTrainings.filter(
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
                    const yearTrainings = filteredTrainings.filter(
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
                        `h-full rounded-lg p-1.5 border transition-all ` +
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
                        className={`text-xs font-semibold mb-1 ${
                          isSelected
                            ? "text-blue-700"
                            : isToday
                              ? "text-blue-600"
                              : "text-slate-700"
                        }`}
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
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card className="rounded-xl border-border shadow-none sticky" styles={{ body: { padding: '12px' } }}>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200">
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
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
                  {selectedDate.format("DD")}
                </div>
              </div>
              {selectedDayTrainings.length > 0 ? (
                <div className="!space-y-2 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
                  {selectedDayTrainings.map((training) => (
                    <Card
                      key={training.id}
                      className="rounded-lg border-slate-200 hover:border-blue-400 cursor-pointer transition-all"
                      styles={{ body: { padding: "10px" } }}
                      onClick={() => navigate(`/app/training/${training.id}`)}
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
                        {training.providedBy || "Training Provider"}
                      </Text>
                      <div className="pt-1.5 border-t border-slate-100">
                        <TrainingDateRange
                          startDate={training.startDate}
                          endDate={training.endDate}
                          compact
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <Tag
                          color={training.isPublished ? "green" : "orange"}
                          className="text-[9px] m-0 px-1 py-0 leading-normal"
                        >
                          {training.isPublished ? "Published" : "Draft"}
                        </Tag>
                        {training.capacity && (
                          <Text type="secondary" className="text-[10px]">
                            {training.capacity} seats
                          </Text>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <TrainingEmptyState
                  type="calendar"
                  message="No trainings on this date"
                  description="Select another date or create a new training."
                  compact
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Create/Edit Training Modal */}
      <Modal
        open={formModalOpen}
        onCancel={handleCloseFormModal}
        footer={null}
        width={800}
        centered
        destroyOnClose
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        <div className="bg-white px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                  {formMode === "create"
                    ? "Create New Training"
                    : "Edit Training"}
                </h3>
                <Text className="text-xs text-slate-600 block truncate">
                  {formMode === "create"
                    ? "Configure training details"
                    : "Update training configuration"}
                </Text>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={
                <span className="text-xl text-slate-400 hover:text-slate-600">
                  ×
                </span>
              }
              onClick={handleCloseFormModal}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>
        <div className="p-4">
          <TrainingForm
            form={form}
            onSubmit={handleFormSubmit}
            loading={formLoading}
            submitText={
              formMode === "create" ? "Create Training" : "Update Training"
            }
            feedbackForms={feedbackForms?.list || []}
            preTestForms={preTestForms?.list || []}
            postTestForms={postTestForms?.list || []}
            onCancel={handleCloseFormModal}
            currentStep={formStep}
            onStepChange={setFormStep}
          />
        </div>
      </Modal>

      {/* Attendance Modal */}
      <Modal
        open={statsModalOpen}
        onCancel={() => setStatsModalOpen(false)}
        footer={null}
        width={900}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        {selectedTraining && attendanceData && (
          <>
            {/* Header */}
            <div className="bg-white px-5 py-3 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-800 mb-1 truncate">
                      {selectedTraining.title}
                    </h3>
                    <div className="flex items-center gap-2.5 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <TrainingDateRange
                          startDate={selectedTraining.startDate}
                          endDate={selectedTraining.endDate}
                          compact
                        />
                      </span>
                      {attendanceData.training && (
                        <>
                          <span>•</span>
                          <span>
                            <strong className="text-slate-800">
                              {attendanceData.training.trainingDays}
                            </strong>{" "}
                            days
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-slate-800">
                              {attendanceData.summary.totalApproved}
                            </strong>{" "}
                            enrolled
                          </span>
                          <span>•</span>
                          <span>
                            <strong className="text-slate-800">
                              {attendanceData.summary.uniqueAttendees}
                            </strong>{" "}
                            attended
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={
                    <span className="text-xl text-slate-400 hover:text-slate-600">
                      &times;
                    </span>
                  }
                  onClick={() => setStatsModalOpen(false)}
                  className="hover:bg-slate-100 flex-shrink-0"
                />
              </div>
            </div>

            {/* Attendance Table */}
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

              {attendanceTableData && attendanceTableData.length > 0 ? (
                <div className="attendance-table-wrapper">
                  <table className="attendance-table">
                    <thead>
                      <tr>
                        <th className="faculty-col">Faculty</th>
                        <th className="institution-col">Institution</th>
                        {trainingDates.map((date, idx) => (
                          <th key={idx} className="date-col">
                            <div className="date-header">
                              <span className="date-day">
                                {dayjs(date).format("DD")}
                              </span>
                              <span className="date-month">
                                {dayjs(date).format("MMM")}
                              </span>
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
                              <div className="font-medium text-slate-800 text-xs">
                                {record.user.name}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {record.user.email}
                              </div>
                            </div>
                          </td>
                          <td className="institution-col">
                            <div
                              className="font-medium text-slate-700 text-xs truncate"
                              title={record.institution?.name}
                            >
                              {record.institution?.shortName ||
                                record.institution?.name ||
                                "N/A"}
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
                  <Text className="text-slate-500">
                    No attendance records found
                  </Text>
                </div>
              )}

              {/* Legend */}
              {attendanceTableData && attendanceTableData.length > 0 && (
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
                  <span className="text-slate-500">
                    Scroll to view all dates
                  </span>
                </div>
              )}
            </div>
          </>
        )}
        {!attendanceData && selectedTraining && (
          <div className="p-12 text-center">
            <Text type="secondary">Loading attendance data...</Text>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TrainingManagementPage;
