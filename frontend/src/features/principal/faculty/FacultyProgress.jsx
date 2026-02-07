import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Empty,
  Row,
  Col,
  Tabs,
  Badge,
  Descriptions,
  Rate,
  Modal,
  Select,
  DatePicker,
  Tooltip,
  Calendar,
  Spin,
  List,
  theme,
  Grid,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  CarOutlined,
  VideoCameraOutlined,
  ScheduleOutlined,
  EyeOutlined,
  TableOutlined,
  IdcardOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import { debounce } from "lodash";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import principalService from "../../../services/principal.service";
import ProfileAvatar from "../../../components/common/ProfileAvatar";
import { calculateExpectedMonths, getMonthName } from "../../../utils/monthlyCycle";

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

// Memoized faculty list item to prevent re-renders during search
const FacultyListItem = memo(({ faculty, isSelected, onSelect, token }) => (
  <List.Item
    onClick={() => onSelect(faculty)}
    style={{
      cursor: "pointer",
      margin: "4px 0",
      padding: "8px 12px",
      borderRadius: token.borderRadiusLG,
      backgroundColor: isSelected ? token.colorPrimaryBg : "transparent",
      borderLeft: `4px solid ${isSelected ? token.colorPrimary : "transparent"}`,
      transition: "none",
    }}
  >
    <List.Item.Meta
      avatar={
        <ProfileAvatar
          profileImage={faculty.profileImage}
          size={44}
          style={{
            border: `1px solid ${isSelected ? token.colorPrimary : token.colorBorderSecondary}`,
          }}
        />
      }
      title={
        <Text style={{ fontWeight: 600, fontSize: 14 }}>{faculty.name}</Text>
      }
      description={
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Tag color="blue" bordered={false} style={{ width: "fit-content" }}>
            {faculty.assignedCount || 0} Students
          </Tag>
          <div style={{ fontSize: 12, color: token.colorTextDescription }}>
            <IdcardOutlined style={{ marginRight: 4 }} />
            {faculty.designation || "Faculty"}
          </div>
        </div>
      }
    />
  </List.Item>
));

FacultyListItem.displayName = "FacultyListItem";

const FacultyProgress = () => {
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const [searchParams] = useSearchParams();

  // State
  const [loading, setLoading] = useState(true);
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [facultyDetails, setFacultyDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(""); // Immediate input value
  const [searchText, setSearchText] = useState(""); // Debounced search value
  const [activeTab, setActiveTab] = useState("students");

  // Visit view state (table vs calendar)
  const [visitViewMode, setVisitViewMode] = useState("table");
  const [visitDateRange, setVisitDateRange] = useState(null);
  const [visitStatusFilter, setVisitStatusFilter] = useState("all");

  // Report details modal
  const [reportDetailsVisible, setReportDetailsVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Debounced search - must be defined before effects that use it
  const debouncedSearch = useMemo(
    () =>
      debounce((value) => {
        setSearchText(value);
      }, 300),
    [],
  );

  // Handle input change - update display immediately, debounce filter
  const handleSearchChange = useCallback(
    (e) => {
      const value = e.target.value;
      setInputValue(value); // Update input immediately for responsive UI
      debouncedSearch(value); // Debounce the actual filter
    },
    [debouncedSearch],
  );

  // Handle clear
  const handleSearchClear = useCallback(() => {
    setInputValue("");
    setSearchText("");
    debouncedSearch.cancel();
  }, [debouncedSearch]);

  // Fetch faculty list on mount
  useEffect(() => {
    fetchFacultyList();
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Fetch faculty list
  const fetchFacultyList = async () => {
    try {
      setLoading(true);
      const response = await principalService.getFacultyProgress();
      setFacultyList(response?.faculty || []);

      // Check for facultyId URL parameter
      const facultyIdParam = searchParams.get('facultyId');
      
      if (facultyIdParam) {
        // Find the faculty with the matching ID
        const facultyToSelect = response?.faculty?.find(f => f.id === facultyIdParam);
        if (facultyToSelect) {
          setSelectedFaculty(facultyToSelect);
          fetchFacultyDetails(facultyToSelect.id);
          return; // Skip auto-selection logic
        }
      }

      // Auto-select first faculty if available and on desktop (only if no URL param)
      if (response?.faculty?.length > 0 && !selectedFaculty && screens.md) {
        setSelectedFaculty(response.faculty[0]);
        fetchFacultyDetails(response.faculty[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch faculty list:", error);
      toast.error("Failed to load faculty list");
    } finally {
      setLoading(false);
    }
  };

  // Fetch faculty details
  const fetchFacultyDetails = async (facultyId) => {
    try {
      setDetailsLoading(true);
      const response =
        await principalService.getFacultyProgressDetails(facultyId);
      setFacultyDetails(response);
    } catch (error) {
      console.error("Failed to fetch faculty details:", error);
      toast.error("Failed to load faculty details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Handle faculty selection
  const handleFacultySelect = (faculty) => {
    setSelectedFaculty(faculty);
    setFacultyDetails(null);
    fetchFacultyDetails(faculty.id);

    // On mobile, scroll to details
    if (!screens.md) {
      setTimeout(() => {
        const element = document.getElementById("faculty-details-section");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  // Filtered faculty list
  const filteredFaculty = useMemo(() => {
    if (!searchText) return facultyList;
    const lower = searchText.toLowerCase();
    return facultyList.filter(
      (f) =>
        f.name?.toLowerCase().includes(lower) ||
        f.email?.toLowerCase().includes(lower) ||
        f.employeeId?.toLowerCase().includes(lower),
    );
  }, [facultyList, searchText]);

  // Filtered visits based on date range and status
  const filteredVisits = useMemo(() => {
    let visits = facultyDetails?.visits || [];

    if (visitStatusFilter !== "all") {
      visits = visits.filter((v) => v.status === visitStatusFilter);
    }

    if (
      visitDateRange &&
      visitDateRange.length === 2 &&
      visitDateRange[0] &&
      visitDateRange[1]
    ) {
      visits = visits.filter((v) => {
        const visitDate = dayjs(v.visitDate);
        return (
          visitDate.isAfter(visitDateRange[0]) &&
          visitDate.isBefore(visitDateRange[1].add(1, "day"))
        );
      });
    }

    return visits;
  }, [facultyDetails?.visits, visitStatusFilter, visitDateRange]);

  // Calculate monthly summary based on students' internship cycles
  const calculatedVisitSummary = useMemo(() => {
    const students = facultyDetails?.students || [];
    const visits = facultyDetails?.visits || [];

    if (students.length === 0) return [];

    // Collect all expected months from all students' internship periods
    const allMonthsMap = new Map(); // key: "YYYY-MM", value: { monthName, year, month, visits: 0, isPast }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    students.forEach((student) => {
      // Get internship dates from student data
      const startDate = student.internshipStartDate || student.startDate;
      const endDate = student.internshipEndDate || student.endDate;

      if (startDate && endDate) {
        const expectedMonths = calculateExpectedMonths(startDate, endDate);
        expectedMonths.forEach((month) => {
          const key = `${month.year}-${String(month.monthNumber).padStart(2, '0')}`;
          if (!allMonthsMap.has(key)) {
            const isPast = month.year < currentYear ||
              (month.year === currentYear && month.monthNumber < currentMonth);
            allMonthsMap.set(key, {
              monthName: month.monthName,
              year: month.year,
              month: month.monthNumber,
              visits: 0,
              isPast,
            });
          }
        });
      }
    });

    // If no months were calculated from student internships, return API data or empty
    if (allMonthsMap.size === 0) {
      return facultyDetails?.visitSummary || [];
    }

    // Count visits per month
    visits.forEach((visit) => {
      if (visit.visitDate) {
        const visitDate = dayjs(visit.visitDate);
        const key = `${visitDate.year()}-${String(visitDate.month() + 1).padStart(2, '0')}`;
        if (allMonthsMap.has(key)) {
          const monthData = allMonthsMap.get(key);
          monthData.visits += 1;
        }
      }
    });

    // Convert to array and sort by date
    return Array.from(allMonthsMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }, [facultyDetails?.students, facultyDetails?.visits, facultyDetails?.visitSummary]);

  // Handle view report details
  const handleViewReportDetails = (visit) => {
    setSelectedReport(visit);
    setReportDetailsVisible(true);
  };

  // Get visit type icon
  const getVisitTypeIcon = (type) => {
    switch (type) {
      case "PHYSICAL":
        return <CarOutlined style={{ color: token.colorPrimary }} />;
      case "VIRTUAL":
        return <VideoCameraOutlined style={{ color: token.colorPurple }} />;
      case "SCHEDULED":
        return <ScheduleOutlined style={{ color: token.colorWarning }} />;
      default:
        return (
          <EnvironmentOutlined style={{ color: token.colorTextDisabled }} />
        );
    }
  };

  // Get visit status color
  const getVisitStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "SCHEDULED":
        return "processing";
      case "CANCELLED":
        return "error";
      case "MISSED":
        return "error";
      default:
        return "default";
    }
  };

  const handleRefresh = () => {
    fetchFacultyList();
    if (selectedFaculty) {
      fetchFacultyDetails(selectedFaculty.id);
    }
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return dayjs(dateString).format("DD MMM YYYY");
  };

  // Get display faculty - use nested faculty object from details, or fallback to list item
  const displayFaculty = facultyDetails?.faculty || selectedFaculty;
  const stats = facultyDetails?.stats || {};

  // Student columns for the table
  const studentColumns = [
    {
      title: "Student",
      key: "student",
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProfileAvatar size={32} profileImage={record.profileImage} />
          <div>
            <Text style={{ display: "block", fontWeight: 500 }}>
              {record.name}
            </Text>
            <Text style={{ fontSize: 12, color: token.colorTextDescription }}>
              {record.rollNumber}
            </Text>
            <div>
              <Tag color="blue" bordered={false} style={{ margin: 0 }}>
                {record.batch}
              </Tag>
              <Text
                style={{
                  display: "block",
                  fontSize: 12,
                  color: token.colorTextDescription,
                  marginTop: 4,
                }}
              >
                {record.department}
              </Text>
            </div>
          </div>
        </div>
      ),
    },
    // {
    //   title: "Batch / Dept",
    //   key: "batchDept",
    //   render: (_, record) => (
    //     <div>
    //       <Tag color="blue" bordered={false} style={{ margin: 0 }}>
    //         {record.batch}
    //       </Tag>
    //       <Text
    //         style={{
    //           display: "block",
    //           fontSize: 12,
    //           color: token.colorTextDescription,
    //           marginTop: 4,
    //         }}
    //       >
    //         {record.department}
    //       </Text>
    //     </div>
    //   ),
    // },
    {
      title: "Internship",
      key: "internship",
      render: (_, record) => (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <Text style={{ display: "block", fontSize: 14, fontWeight: 500 }}>
              {record.companyName || record.internshipTitle || "N/A"}
            </Text>
            <Tag
              color="purple"
              bordered={false}
              style={{ fontSize: 10, fontWeight: "bold", margin: 0 }}
            >
              Self-ID
            </Tag>
          </div>
          {record.jobProfile && (
            <Text
              style={{
                fontSize: 12,
                color: token.colorTextDescription,
                display: "block",
              }}
            >
              {record.jobProfile}
            </Text>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
              fontSize: 10,
              color: token.colorTextDisabled,
            }}
          >
            {record.internshipDuration && (
              <span>{record.internshipDuration}</span>
            )}
            {record.stipend && (
              <Tag
                color="green"
                bordered={false}
                style={{ fontSize: 10, margin: 0 }}
              >
                ₹{record.stipend}/mo
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    // {
    //   title: "Status",
    //   dataIndex: "internshipStatus",
    //   key: "status",
    //   render: (status) => {
    //     const colors = {
    //       ONGOING: "processing",
    //       IN_PROGRESS: "processing",
    //       COMPLETED: "success",
    //       PENDING: "warning",
    //       APPROVED: "success",
    //       NOT_STARTED: "default",
    //     };
    //     const labels = {
    //       ONGOING: "Ongoing",
    //       IN_PROGRESS: "In Progress",
    //       COMPLETED: "Completed",
    //       PENDING: "Pending",
    //       APPROVED: "Approved",
    //       NOT_STARTED: "Not Started",
    //     };
    //     const statusKey = status?.toUpperCase?.() || status;
    //     return (
    //       <Tag color={colors[statusKey] || "default"} bordered={false}>
    //         {labels[statusKey] || status || "N/A"}
    //       </Tag>
    //     );
    //   },
    // },
    {
      title: "Visits",
      key: "visits",
      align: "center",
      render: (_, record) => {
        const submitted = record.totalVisits || 0;
        const expected = record.expectedVisits || 0;
        const isComplete = expected > 0 && submitted >= expected;
        const hasVisits = submitted > 0;
        return (
          <Tag
            color={isComplete ? "success" : hasVisits ? "processing" : "error"}
            bordered={false}
            style={{ fontWeight: 600, fontSize: 13 }}
          >
            {submitted}/{expected}
          </Tag>
        );
      },
    },
    {
      title: "Last Visit",
      dataIndex: "lastVisitDate",
      key: "lastVisit",
      render: (date) =>
        date ? (
          <Text style={{ fontSize: 14, color: token.colorTextSecondary }}>
            {formatDate(date)}
          </Text>
        ) : (
          <Text
            style={{
              fontSize: 12,
              color: token.colorTextDisabled,
              fontStyle: "italic",
            }}
          >
            No visits
          </Text>
        ),
    },
  ];

  // Visit columns for the table
  const visitColumns = [
    {
      title: "Visit Date",
      dataIndex: "visitDate",
      key: "visitDate",
      width: 140,
      render: (date) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarOutlined style={{ color: token.colorTextDisabled }} />
          <Text style={{ fontWeight: 500 }}>{formatDate(date)}</Text>
        </div>
      ),
    },
    {
      title: "Type",
      dataIndex: "visitType",
      key: "visitType",
      width: 120,
      render: (type) => (
        <Space>
          {getVisitTypeIcon(type)}
          <Text style={{ fontSize: 14 }}>{type}</Text>
        </Space>
      ),
    },
    {
      title: "Student",
      key: "student",
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ProfileAvatar size={28} profileImage={record.studentProfileImage} />
          <div>
            <Text style={{ display: "block", fontSize: 14 }}>
              {record.studentName}
            </Text>
            <Text style={{ fontSize: 12, color: token.colorTextDescription }}>
              {record.studentRollNumber}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Company",
      dataIndex: "companyName",
      key: "company",
      render: (name, record) => (
        <div>
          <Text style={{ display: "block", fontSize: 14 }}>
            {name || "N/A"}
          </Text>
          {record.visitLocation && (
            <Text
              style={{
                fontSize: 12,
                color: token.colorTextDescription,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <EnvironmentOutlined /> {record.visitLocation}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Rating",
      dataIndex: "overallRating",
      key: "rating",
      width: 100,
      render: (rating) =>
        rating ? (
          <Rate disabled value={rating} count={5} style={{ fontSize: 12 }} />
        ) : (
          <Text style={{ fontSize: 12, color: token.colorTextDisabled }}>
            Not rated
          </Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status) => (
        <Tag
          color={getVisitStatusColor(status)}
          bordered={false}
          style={{ margin: 0 }}
        >
          {status || "Completed"}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewReportDetails(record)}
            style={{ color: token.colorPrimary }}
          />
        </Tooltip>
      ),
    },
  ];

  // Calendar cell renderer for visits
  const dateCellRender = (value) => {
    const dateStr = value.format("YYYY-MM-DD");
    const dayVisits = filteredVisits.filter(
      (v) => dayjs(v.visitDate).format("YYYY-MM-DD") === dateStr,
    );

    return (
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {dayVisits.map((visit, index) => (
          <li key={index} style={{ marginBottom: 4 }}>
            <Badge
              status={
                visit.status === "COMPLETED"
                  ? "success"
                  : visit.status === "SCHEDULED"
                    ? "processing"
                    : "warning"
              }
              text={
                <span
                  style={{ fontSize: 10, cursor: "pointer" }}
                  onClick={() => handleViewReportDetails(visit)}
                >
                  {visit.studentName?.split(" ")[0]}
                </span>
              }
            />
          </li>
        ))}
      </ul>
    );
  };

  // Tab items
  const tabItems = [
    {
      key: "students",
      label: (
        <span>
          <TeamOutlined /> Assigned Students
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          <Table
            columns={studentColumns}
            dataSource={facultyDetails?.students || []}
            rowKey="id"
            loading={detailsLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} students`,
            }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: (
                <Empty
                  description="No students assigned to this faculty"
                  style={{ padding: 32 }}
                />
              ),
            }}
          />
        </div>
      ),
    },
    {
      key: "visits",
      label: (
        <span>
          <CarOutlined /> Faculty Visits
          {facultyDetails?.visits?.length > 0 && (
            <Tag color="green" bordered={false} style={{ marginLeft: 8 }}>
              {facultyDetails.visits.length}
            </Tag>
          )}
        </span>
      ),
      children: (
        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Filters */}
          <Card
            size="small"
            bordered={false}
            style={{ backgroundColor: token.colorFillAlter }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <Select
                  value={visitStatusFilter}
                  onChange={setVisitStatusFilter}
                  style={{ width: 130 }}
                  size="small"
                  placeholder="Status"
                >
                  <Select.Option value="all">All Status</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="SCHEDULED">Scheduled</Select.Option>
                  <Select.Option value="CANCELLED">Cancelled</Select.Option>
                  <Select.Option value="MISSED">Missed</Select.Option>
                </Select>
                <RangePicker
                  value={visitDateRange}
                  onChange={setVisitDateRange}
                  format="DD/MM/YYYY"
                  style={{ width: 220 }}
                  size="small"
                  placeholder={["Start", "End"]}
                />
                {(visitStatusFilter !== "all" || visitDateRange) && (
                  <Button
                    type="text"
                    size="small"
                    onClick={() => {
                      setVisitStatusFilter("all");
                      setVisitDateRange(null);
                    }}
                    style={{ color: token.colorTextDescription }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <Button
                icon={
                  visitViewMode === "table" ? (
                    <CalendarOutlined />
                  ) : (
                    <TableOutlined />
                  )
                }
                onClick={() =>
                  setVisitViewMode(
                    visitViewMode === "table" ? "calendar" : "table",
                  )
                }
                size="small"
              >
                {visitViewMode === "table" ? "Calendar" : "Table"}
              </Button>
            </div>
          </Card>

          {/* Monthly Summary */}
          {calculatedVisitSummary &&
            calculatedVisitSummary.length > 0 && (
              <Card
                size="small"
                bordered={false}
                style={{ backgroundColor: token.colorBgContainer }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: token.colorTextDescription,
                    textTransform: "uppercase",
                    marginBottom: 12,
                    display: "block",
                  }}
                >
                  <CalendarOutlined style={{ marginRight: 6 }} />
                  Monthly Summary ({calculatedVisitSummary.length} months)
                </Text>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
                    gap: 8,
                  }}
                >
                  {calculatedVisitSummary.map((month, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 8,
                        borderRadius: token.borderRadius,
                        border: `1px solid ${
                          month.isPast && month.visits === 0
                            ? token.colorErrorBorder
                            : month.visits > 0
                              ? token.colorSuccessBorder
                              : token.colorBorderSecondary
                        }`,
                        textAlign: "center",
                        backgroundColor:
                          month.isPast && month.visits === 0
                            ? token.colorErrorBg
                            : month.visits > 0
                              ? token.colorSuccessBg
                              : token.colorFillAlter,
                      }}
                    >
                      <Text
                        style={{
                          display: "block",
                          fontSize: 10,
                          fontWeight: 500,
                        }}
                      >
                        {month.monthName?.substring(0, 3)}
                      </Text>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: "bold",
                          color:
                            month.isPast && month.visits === 0
                              ? token.colorError
                              : month.visits > 0
                                ? token.colorSuccess
                                : token.colorTextDisabled,
                        }}
                      >
                        {month.visits}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

          {/* Visits Table or Calendar */}
          {visitViewMode === "table" ? (
            <Table
              columns={visitColumns}
              dataSource={filteredVisits}
              rowKey="id"
              loading={detailsLoading}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} visits`,
              }}
              scroll={{ x: 1000 }}
              expandable={{
                expandedRowRender: (record) => (
                  <div
                    style={{
                      padding: 16,
                      backgroundColor: token.colorBgLayout,
                      borderRadius: token.borderRadiusLG,
                      margin: 8,
                    }}
                  >
                    <Row gutter={[20, 16]}>
                      <Col xs={24} md={12}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Title of Project/Work">
                            {record.titleOfProjectWork || "N/A"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Assistance Required">
                            {record.assistanceRequiredFromInstitute || "N/A"}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                      <Col xs={24} md={12}>
                        <Descriptions column={1} size="small">
                          <Descriptions.Item label="Observations">
                            {record.observationsAboutStudent || "N/A"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Feedback">
                            {record.feedbackSharedWithStudent || "N/A"}
                          </Descriptions.Item>
                        </Descriptions>
                      </Col>
                    </Row>
                  </div>
                ),
                rowExpandable: () => true,
              }}
              locale={{
                emptyText: (
                  <Empty
                    description="No visits recorded"
                    style={{ padding: 32 }}
                  />
                ),
              }}
            />
          ) : (
            <Card bordered={false}>
              <Calendar
                cellRender={(current, info) => {
                  if (info.type === "date") {
                    return dateCellRender(current);
                  }
                  return info.originNode;
                }}
              />
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: screens.md ? 24 : 12,
        backgroundColor: token.colorBgLayout,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Title level={3} style={{ color: token.colorTextHeading, margin: 0 }}>
            Faculty Progress Tracking
          </Title>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading || detailsLoading}
        >
          Refresh
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {/* Faculty List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={7} xl={6}>
          <Card
            title={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: token.colorPrimary,
                }}
              >
                <TeamOutlined style={{ marginRight: 8 }} /> Faculty Directory
                <Text
                  type="secondary"
                  style={{ marginLeft: "auto", fontSize: 12 }}
                >
                  {filteredFaculty.length} faculty
                </Text>
              </div>
            }
            bordered={false}
            style={{
              borderRadius: token.borderRadiusLG,
              boxShadow: token.boxShadowTertiary,
              height: screens.md ? "calc(100vh - 120px)" : "50vh",
              minHeight: 400,
              display: "flex",
              flexDirection: "column",
            }}
            styles={{
              body: {
                padding: 0,
                overflowY: "hidden",
                flex: 1,
                display: "flex",
                flexDirection: "column",
              },
              header: {
                backgroundColor: token.colorFillAlter,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Input
                placeholder="Search Faculty..."
                value={inputValue}
                onChange={handleSearchChange}
                onClear={handleSearchClear}
                prefix={
                  <UserOutlined style={{ color: token.colorTextDisabled }} />
                }
                allowClear
              />
            </div>

            <div style={{ overflowY: "auto", padding: 8, flex: 1 }}>
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 160,
                  }}
                >
                  <Spin size="small" tip="Loading faculty..." />
                </div>
              ) : filteredFaculty.length === 0 ? (
                <Empty
                  description="No faculty found"
                  style={{ padding: 32 }}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={filteredFaculty}
                  renderItem={(faculty) => (
                    <FacultyListItem
                      key={faculty.id}
                      faculty={faculty}
                      isSelected={selectedFaculty?.id === faculty.id}
                      onSelect={handleFacultySelect}
                      token={token}
                    />
                  )}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Faculty Details - Right Column */}
        <Col
          xs={24}
          sm={24}
          md={16}
          lg={17}
          xl={18}
          id="faculty-details-section"
        >
          {displayFaculty ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                height: screens.md ? "calc(100vh - 120px)" : "auto",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {/* Profile Header */}
              <Card
                bordered={false}
                style={{
                  borderRadius: token.borderRadiusLG,
                  boxShadow: token.boxShadowTertiary,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 24,
                  }}
                >
                  <ProfileAvatar
                    profileImage={displayFaculty.profileImage}
                    size={90}
                    style={{
                      border: `4px solid ${token.colorBgContainer}`,
                      boxShadow: token.boxShadow,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Title
                      level={3}
                      style={{ margin: 0, color: token.colorTextHeading }}
                    >
                      {displayFaculty.name}
                    </Title>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: token.colorTextSecondary,
                        marginBottom: 8,
                      }}
                    >
                      <IdcardOutlined style={{ marginRight: 8 }} />
                      {displayFaculty.designation || "Faculty"} •{" "}
                      {displayFaculty.employeeId || displayFaculty.email}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <Tag
                        color="blue"
                        bordered={false}
                        className="rounded-full"
                      >
                        <TeamOutlined style={{ marginRight: 4 }} />
                        {stats.totalStudents ||
                          displayFaculty.assignedCount ||
                          0}{" "}
                        Students
                      </Tag>
                      <Tag
                        color="green"
                        bordered={false}
                        className="rounded-full"
                      >
                        <CheckCircleOutlined style={{ marginRight: 4 }} />
                        {stats.totalVisits || 0} Total Visits
                      </Tag>
                    </div>
                  </div>
                </div>

                {/* Contact Quick Info */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 16,
                    marginTop: 24,
                    padding: 12,
                    borderRadius: token.borderRadius,
                    backgroundColor: token.colorFillAlter,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <MailOutlined
                      style={{
                        color: token.colorPrimary,
                        fontSize: 18,
                        marginRight: 12,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: token.colorTextDescription,
                        }}
                      >
                        Email
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          wordBreak: "break-all",
                        }}
                      >
                        {displayFaculty.email || "N/A"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <PhoneOutlined
                      style={{
                        color: token.colorSuccess,
                        fontSize: 18,
                        marginRight: 12,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: token.colorTextDescription,
                        }}
                      >
                        Contact
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {displayFaculty.phoneNo ||
                          displayFaculty.contact ||
                          "N/A"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <BankOutlined
                      style={{
                        color: token.colorWarning,
                        fontSize: 18,
                        marginRight: 12,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: token.colorTextDescription,
                        }}
                      >
                        Department
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {displayFaculty.branch?.name ||
                          displayFaculty.branchName ||
                          "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Detailed Information in Tabs */}
              <Card
                bordered={false}
                style={{
                  borderRadius: token.borderRadiusLG,
                  boxShadow: token.boxShadowTertiary,
                }}
                styles={{ body: { padding: 0 } }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  style={{ padding: "0 16px" }}
                />
              </Card>
            </div>
          ) : (
            <Card
              style={{
                height: "calc(100vh - 120px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: token.borderRadiusLG,
                border: `1px dashed ${token.colorBorder}`,
              }}
            >
              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <UserOutlined
                  style={{
                    fontSize: 48,
                    color: token.colorTextDisabled,
                    marginBottom: 16,
                  }}
                />
                <Title level={4} style={{ color: token.colorTextSecondary }}>
                  Select a Faculty Member
                </Title>
                <Text type="secondary">
                  Choose a faculty from the directory on the left to view
                  detailed progress and student assignments.
                </Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Visit Report Details Modal */}
      <Modal
        title="Visit Report Details"
        open={reportDetailsVisible}
        onCancel={() => {
          setReportDetailsVisible(false);
          setSelectedReport(null);
        }}
        footer={
          <Button onClick={() => setReportDetailsVisible(false)}>Close</Button>
        }
        width={720}
        centered
        destroyOnClose
        transitionName=""
        maskTransitionName=""
      >
        {selectedReport && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 20,
              marginTop: 16,
            }}
          >
            {/* Visit Header Card */}
            <div
              style={{
                padding: 16,
                borderRadius: token.borderRadiusLG,
                backgroundColor: token.colorInfoBg,
                border: `1px solid ${token.colorInfoBorder}`,
              }}
            >
              <Row gutter={[20, 16]}>
                <Col xs={12} sm={6}>
                  <Text
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      fontWeight: "bold",
                      color: token.colorTextDescription,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Faculty
                  </Text>
                  <Text style={{ fontWeight: 600 }}>
                    {selectedFaculty?.name}
                  </Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      fontWeight: "bold",
                      color: token.colorTextDescription,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Visit Date
                  </Text>
                  <Text style={{ fontWeight: 600 }}>
                    {formatDate(selectedReport.visitDate)}
                  </Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      fontWeight: "bold",
                      color: token.colorTextDescription,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Student
                  </Text>
                  <Text style={{ fontWeight: 600, display: "block" }}>
                    {selectedReport.studentName}
                  </Text>
                  <Text
                    style={{ fontSize: 12, color: token.colorTextDescription }}
                  >
                    {selectedReport.studentRollNumber}
                  </Text>
                </Col>
                <Col xs={12} sm={6}>
                  <Text
                    style={{
                      fontSize: 10,
                      textTransform: "uppercase",
                      fontWeight: "bold",
                      color: token.colorTextDescription,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Visit Type
                  </Text>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {getVisitTypeIcon(selectedReport.visitType)}
                    <Text style={{ fontWeight: 600 }}>
                      {selectedReport.visitType}
                    </Text>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Visit Details */}
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Company">
                {selectedReport.companyName || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Location">
                {selectedReport.visitLocation || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedReport.visitDuration || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag
                  color={getVisitStatusColor(selectedReport.status)}
                  bordered={false}
                  style={{ margin: 0 }}
                >
                  {selectedReport.status || "Completed"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Overall Rating" span={2}>
                {selectedReport.overallRating ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <Rate disabled value={selectedReport.overallRating} />
                    <span
                      style={{
                        fontSize: 14,
                        color: token.colorTextDescription,
                      }}
                    >
                      ({selectedReport.overallRating}/5)
                    </span>
                  </div>
                ) : (
                  <Text
                    style={{
                      color: token.colorTextDisabled,
                      fontStyle: "italic",
                    }}
                  >
                    Not rated
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Title of Project/Work" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.titleOfProjectWork || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Assistance Required" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.assistanceRequiredFromInstitute || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Response from Organisation" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.responseFromOrganisation || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Supervisor Remarks" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.remarksOfOrganisationSupervisor || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Observations" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.observationsAboutStudent || "N/A"}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Feedback Shared" span={2}>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {selectedReport.feedbackSharedWithStudent || "N/A"}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FacultyProgress;
