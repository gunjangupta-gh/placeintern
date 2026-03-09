import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Card, Input, Modal, Space, Table, Tag, Tooltip, Typography } from "antd";
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  BarChartOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import TrainingGreeting from "../../../components/training/TrainingGreeting";
import TrainingDateRange from "../../../components/training/TrainingDateRange";
import DeliveryModeBadge from "../../../components/training/DeliveryModeBadge";
import TrainingEmptyState from "../../../components/training/TrainingEmptyState";
import { TableRowSkeleton } from "../../../components/training/skeletons/TrainingSkeletons";
import trainingPrincipalService from "../../../services/training-principal.service";
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
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testTab, setTestTab] = useState("preTest");
  const [preTestData, setPreTestData] = useState(null);
  const [postTestData, setPostTestData] = useState(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackData, setFeedbackData] = useState(null);
  const [lessonPlanModalOpen, setLessonPlanModalOpen] = useState(false);
  const [lessonPlanLoading, setLessonPlanLoading] = useState(false);
  const [lessonPlanData, setLessonPlanData] = useState([]);

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

  const normalizeResponse = (response) => {
    if (response && typeof response === "object" && "data" in response) {
      return response.data;
    }
    return response;
  };

  const handleViewTestResponses = async (training) => {
    try {
      setSelectedTraining(training);
      setTestModalOpen(true);
      setTestLoading(true);

      const [preRes, postRes] = await Promise.all([
        trainingPrincipalService.getPreTestResponses(training.id),
        trainingPrincipalService.getPostTestResponses(training.id),
      ]);

      setPreTestData(normalizeResponse(preRes) || { responses: [], stats: null });
      setPostTestData(normalizeResponse(postRes) || { responses: [], stats: null });
    } catch (error) {
      setPreTestData({ responses: [], stats: null });
      setPostTestData({ responses: [], stats: null });
    } finally {
      setTestLoading(false);
    }
  };

  const handleViewFeedbackResponses = async (training) => {
    try {
      setSelectedTraining(training);
      setFeedbackModalOpen(true);
      setFeedbackLoading(true);

      const response = await trainingPrincipalService.getTrainingFeedbackResponses(
        training.id,
      );
      setFeedbackData(normalizeResponse(response) || { responses: [], stats: null });
    } catch (error) {
      setFeedbackData({ responses: [], stats: null });
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleViewLessonPlans = async (training) => {
    try {
      setSelectedTraining(training);
      setLessonPlanModalOpen(true);
      setLessonPlanLoading(true);

      const response = await trainingPrincipalService.getTrainingLessonPlans(training.id);
      const normalized = normalizeResponse(response);
      setLessonPlanData(Array.isArray(normalized) ? normalized : []);
    } catch (error) {
      setLessonPlanData([]);
    } finally {
      setLessonPlanLoading(false);
    }
  };

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
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Attendance">
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={async () => {
                try {
                  setSelectedTraining(record);
                  setAttendanceModalOpen(true);
                  setAttendanceLoading(true);
                  const response = await trainingPrincipalService.getTrainingAttendance(record.id);
                  setAttendanceData(response?.data || response || null);
                } catch (error) {
                  setAttendanceData(null);
                } finally {
                  setAttendanceLoading(false);
                }
              }}
            />
          </Tooltip>
          <Tooltip title="View Test Responses">
            <Button
              type="text"
              size="small"
              icon={<SafetyCertificateOutlined />}
              onClick={() => navigate(`/app/principal/test-responses?trainingId=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="View Feedback Responses">
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/app/principal/feedback-responses?trainingId=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="View Lesson Plans">
            <Button
              type="text"
              size="small"
              icon={<BookOutlined />}
              onClick={() => navigate('/app/training/lesson-plans')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

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
        institution:
          userData.user?.Institution || userAttendanceRecords[0]?.user?.Institution || null,
      };
    });
  }, [attendanceData]);

  const currentTestData = testTab === "preTest" ? preTestData : postTestData;
  const currentTestResponses = Array.isArray(currentTestData?.responses)
    ? currentTestData.responses
    : [];
  const feedbackResponses = Array.isArray(feedbackData?.responses)
    ? feedbackData.responses
    : [];

  const testResponseColumns = [
    {
      title: "Faculty",
      dataIndex: ["user", "name"],
      key: "faculty",
      render: (_, record) => (
        <div>
          <div className="font-medium text-xs text-slate-800">{record.user?.name || "Faculty"}</div>
          <Text className="text-[10px] text-slate-500">{record.user?.email || ""}</Text>
        </div>
      ),
    },
    {
      title: "Institution",
      key: "institution",
      render: (_, record) => (
        <Text className="text-xs text-slate-700">
          {record.user?.Institution?.shortName || record.user?.Institution?.name || "N/A"}
        </Text>
      ),
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      width: 110,
      render: (score) => (
        <Text className="text-xs font-medium">
          {score !== null && score !== undefined ? `${Number(score).toFixed(1)}%` : "N/A"}
        </Text>
      ),
    },
    {
      title: "Result",
      dataIndex: "passed",
      key: "passed",
      width: 100,
      render: (passed) => (
        passed === null ? <Tag>Not graded</Tag> : passed ? <Tag color="green">Passed</Tag> : <Tag color="red">Failed</Tag>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 120,
      render: (value) => (
        <Text className="text-xs">
          {value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
        </Text>
      ),
    },
  ];

  const feedbackColumns = [
    {
      title: "Faculty",
      dataIndex: ["user", "name"],
      key: "faculty",
      render: (_, record) => (
        <div>
          <div className="font-medium text-xs text-slate-800">{record.user?.name || "Faculty"}</div>
          <Text className="text-[10px] text-slate-500">{record.user?.email || ""}</Text>
        </div>
      ),
    },
    {
      title: "Institution",
      key: "institution",
      render: (_, record) => (
        <Text className="text-xs text-slate-700">
          {record.user?.Institution?.shortName || record.user?.Institution?.name || "N/A"}
        </Text>
      ),
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 120,
      render: (value) => (
        <Text className="text-xs">
          {value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"}
        </Text>
      ),
    },
  ];

  const lessonPlanColumns = [
    {
      title: "Faculty",
      dataIndex: ["user", "name"],
      key: "faculty",
      render: (_, record) => (
        <div>
          <div className="font-medium text-xs text-slate-800">{record.user?.name || "Faculty"}</div>
          <Text className="text-[10px] text-slate-500">{record.user?.email || ""}</Text>
        </div>
      ),
    },
    {
      title: "Lesson Plan",
      dataIndex: "title",
      key: "title",
      render: (value) => <Text className="text-xs">{value || "Untitled"}</Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status) => <Tag>{status || "-"}</Tag>,
    },
    {
      title: "Submitted",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 120,
      render: (value, record) => (
        <Text className="text-xs">
          {(value || record.createdAt)
            ? new Date(value || record.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "-"}
        </Text>
      ),
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

      <Modal
        open={attendanceModalOpen}
        onCancel={() => {
          setAttendanceModalOpen(false);
          setSelectedTraining(null);
          setAttendanceData(null);
        }}
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
                {selectedTraining?.title || "Training"}
              </h3>
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                {selectedTraining && (
                  <TrainingDateRange
                    startDate={selectedTraining.startDate}
                    endDate={selectedTraining.endDate}
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
              onClick={() => {
                setAttendanceModalOpen(false);
                setSelectedTraining(null);
                setAttendanceData(null);
              }}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>

        <div className="p-3">
          {attendanceLoading ? (
            <div className="p-12 text-center">
              <Text type="secondary">Loading attendance data...</Text>
            </div>
          ) : attendanceTableData.length > 0 ? (
            <div className="overflow-auto border border-slate-200 rounded-md max-h-[65vh]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-2 py-2 border-b border-slate-200 text-left text-xs font-semibold text-slate-700 min-w-45">
                      Faculty
                    </th>
                    <th className="sticky left-45 z-10 bg-white px-2 py-2 border-b border-slate-200 text-left text-xs font-semibold text-slate-700 min-w-37.5">
                      Institution
                    </th>
                    {trainingDates.map((date) => (
                      <th
                        key={dayjs(date).format("YYYY-MM-DD")}
                        className="px-2 py-2 border-b border-slate-200 text-center text-[11px] font-semibold text-slate-700 min-w-15"
                      >
                        <div className="leading-tight">
                          <div>{dayjs(date).format("DD")}</div>
                          <div className="text-[9px] text-slate-500">{dayjs(date).format("MMM")}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceTableData.map((record) => (
                    <tr key={record.user.id}>
                      <td className="sticky left-0 z-5 bg-white px-2 py-2 border-b border-slate-100">
                        <div className="font-medium text-slate-800 text-xs">{record.user.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{record.user.email}</div>
                      </td>
                      <td className="sticky left-45 z-5 bg-white px-2 py-2 border-b border-slate-100">
                        <div className="font-medium text-slate-700 text-xs truncate" title={record.institution?.name}>
                          {record.institution?.shortName || record.institution?.name || "N/A"}
                        </div>
                      </td>
                      {trainingDates.map((date) => {
                        const dateStr = dayjs(date).format("YYYY-MM-DD");
                        const isPresent = record.attendedDates.has(dateStr);
                        return (
                          <td
                            key={`${record.user.id}-${dateStr}`}
                            className="px-2 py-2 border-b border-slate-100 text-center"
                          >
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
            <TrainingEmptyState
              type="search"
              message="No attendance records found"
              description="No attendance data available for this training."
            />
          )}
        </div>
      </Modal>

      <Modal
        open={testModalOpen}
        onCancel={() => {
          setTestModalOpen(false);
          setSelectedTraining(null);
          setPreTestData(null);
          setPostTestData(null);
          setTestTab("preTest");
        }}
        footer={null}
        width={900}
        title={selectedTraining ? `Test Responses - ${selectedTraining.title}` : "Test Responses"}
      >
        <div className="mb-3">
          <Space>
            <Button
              type={testTab === "preTest" ? "primary" : "default"}
              size="small"
              onClick={() => setTestTab("preTest")}
            >
              Pre-Test ({preTestData?.stats?.total || 0})
            </Button>
            <Button
              type={testTab === "postTest" ? "primary" : "default"}
              size="small"
              onClick={() => setTestTab("postTest")}
            >
              Post-Test ({postTestData?.stats?.total || 0})
            </Button>
          </Space>
        </div>
        {testLoading ? (
          <div className="p-8 text-center">
            <Text type="secondary">Loading test responses...</Text>
          </div>
        ) : currentTestResponses.length > 0 ? (
          <Table
            rowKey="id"
            columns={testResponseColumns}
            dataSource={currentTestResponses}
            size="small"
            pagination={{ pageSize: 8, size: "small" }}
            scroll={{ x: "max-content" }}
          />
        ) : (
          <TrainingEmptyState
            type="search"
            message="No test responses found"
            description="No test submissions available for this training."
          />
        )}
      </Modal>

      <Modal
        open={feedbackModalOpen}
        onCancel={() => {
          setFeedbackModalOpen(false);
          setSelectedTraining(null);
          setFeedbackData(null);
        }}
        footer={null}
        width={900}
        title={selectedTraining ? `Feedback Responses - ${selectedTraining.title}` : "Feedback Responses"}
      >
        {feedbackLoading ? (
          <div className="p-8 text-center">
            <Text type="secondary">Loading feedback responses...</Text>
          </div>
        ) : feedbackResponses.length > 0 ? (
          <Table
            rowKey="id"
            columns={feedbackColumns}
            dataSource={feedbackResponses}
            size="small"
            pagination={{ pageSize: 8, size: "small" }}
            scroll={{ x: "max-content" }}
          />
        ) : (
          <TrainingEmptyState
            type="search"
            message="No feedback responses found"
            description="No feedback submissions available for this training."
          />
        )}
      </Modal>

      <Modal
        open={lessonPlanModalOpen}
        onCancel={() => {
          setLessonPlanModalOpen(false);
          setSelectedTraining(null);
          setLessonPlanData([]);
        }}
        footer={null}
        width={900}
        title={selectedTraining ? `Lesson Plans - ${selectedTraining.title}` : "Lesson Plans"}
      >
        {lessonPlanLoading ? (
          <div className="p-8 text-center">
            <Text type="secondary">Loading lesson plans...</Text>
          </div>
        ) : lessonPlanData.length > 0 ? (
          <Table
            rowKey="id"
            columns={lessonPlanColumns}
            dataSource={lessonPlanData}
            size="small"
            pagination={{ pageSize: 8, size: "small" }}
            scroll={{ x: "max-content" }}
          />
        ) : (
          <TrainingEmptyState
            type="search"
            message="No lesson plans found"
            description="No lesson plans available for this training."
          />
        )}
      </Modal>
    </div>
  );
};

export default TrainingOverviewPage;
