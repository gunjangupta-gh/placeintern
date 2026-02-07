import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Modal,
  Row,
  Col,
  Avatar,
  Empty,
  Spin,
  Tooltip,
  Descriptions,
  Select,
  DatePicker,
  Progress,
  Timeline,
  Tabs,
  Badge,
  Dropdown,
  Popconfirm,
} from "antd";
import {
  ShopOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ReloadOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  FileTextOutlined,
  BankOutlined,
  RiseOutlined,
  FilePdfOutlined,
  MoreOutlined,
  UserAddOutlined,
  UserDeleteOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import * as XLSX from "xlsx";
import { openFileWithPresignedUrl } from "../../../utils/imageUtils";
import principalService from "../../../services/principal.service";
import analyticsService from "../../../services/analytics.service";
import {
  fetchInternshipStats,
  fetchPrincipalDashboard,
  selectInternshipStats,
} from "../store/principalSlice";
import { getTotalExpectedCount } from "../../../utils/monthlyCycle";
import ProfileAvatar from "../../../components/common/ProfileAvatar";

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const SelfIdentifiedInternships = () => {
  const dispatch = useDispatch();
  const internshipStats = useSelector(selectInternshipStats);
  const hasFetched = useRef(false);

  const [loading, setLoading] = useState(true);
  const [internships, setInternships] = useState([]);
  const [selectedInternship, setSelectedInternship] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [filters, setFilters] = useState({
    status: "all",
    dateRange: null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  // Mentor assignment state
  const [mentors, setMentors] = useState([]);
  const [assignMentorVisible, setAssignMentorVisible] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState(null);
  const [mentorAssignLoading, setMentorAssignLoading] = useState(false);
  const [singleAssignRecord, setSingleAssignRecord] = useState(null); // For single row mentor assignment

  // Fetch internships using student progress API (includes reports, visits, completion data)
  const fetchInternships = useCallback(async () => {
    try {
      setLoading(true);

      // Use getStudentProgress which returns comprehensive data including reports, visits, etc.
      const response = await analyticsService.getStudentProgress({
        page: 1,
        limit: 500, // Fetch all for client-side filtering and pagination
      });

      // Response structure: { students: [...], pagination, mentors, statusCounts }
      const students = response?.students || [];

      // Transform student progress data to internship format
      // Filter for students who have internship applications
      const internshipData = students
        .filter((s) => s.application !== null && s.application !== undefined)
        .map((student) => {
          const application = student.application;
          const company = application?.company;
          const facultyMentor = application?.facultyMentor;

          return {
            id: application?.id || student.id,
            studentId: student.id,
            studentName: student.user?.name || student.name,
            studentRollNumber: student.user?.rollNumber || student.rollNumber,
            studentEmail: student.user?.email || student.email,
            studentPhone: student.user?.phoneNo || student.phone,
            studentBatch: student.batch,
            studentDepartment: student.department,
            companyName: company?.name || "N/A",
            companyAddress: company?.address,
            companyContact: company?.contact || company?.phone,
            companyEmail: company?.email,
            jobProfile: application?.jobProfile || application?.internshipTitle,
            stipend: application?.stipendAmount,
            startDate: application?.startDate,
            endDate: application?.endDate,
            duration: application?.duration,
            status: application?.status || "APPROVED",
            internshipPhase: application?.internshipPhase || "NOT_STARTED",
            mentorName: facultyMentor?.name || student.mentor,
            mentorEmail: facultyMentor?.email,
            mentorContact: facultyMentor?.contact,
            mentorDesignation: facultyMentor?.designation,
            mentorId: student.mentorId,
            joiningLetterUrl: application?.joiningLetterUrl,
            joiningLetterUploadedAt: application?.joiningLetterUploadedAt,
            hasJoiningLetter: application?.hasJoiningLetter,
            submittedAt: application?.joiningDate || student.createdAt,
            updatedAt: application?.updatedAt,
            isSelfIdentified: application?.isSelfIdentified ?? true,
            // Calculate expected values dynamically from dates
            reportsSubmitted: student.reportsSubmitted || 0,
            totalReports:
              application?.startDate && application?.endDate
                ? getTotalExpectedCount(
                    new Date(application.startDate),
                    new Date(application.endDate),
                  )
                : 0,
            expectedReportsAsOfNow: student.expectedReportsAsOfNow || 0,
            completionPercentage: student.completionPercentage || 0,
            facultyVisitsCount: student.facultyVisitsCount || 0,
            totalExpectedVisits:
              application?.startDate && application?.endDate
                ? getTotalExpectedCount(
                    new Date(application.startDate),
                    new Date(application.endDate),
                  )
                : 0,
            expectedVisitsAsOfNow: student.expectedVisitsAsOfNow || 0,
            lastFacultyVisit: student.lastFacultyVisit,
            timeline: student.timeline || [],
            monthlyReports: student.monthlyReports || [],
          };
        });

      setInternships(internshipData);
      setPagination((prev) => ({
        ...prev,
        total: response?.pagination?.total || internshipData.length,
      }));
    } catch (error) {
      console.error("Failed to fetch internships:", error);
      toast.error("Failed to load internships");
      // Set mock data for demo
      setInternships(generateMockData());
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies - fetch all data once

  // Fetch mentors
  const fetchMentors = useCallback(async () => {
    try {
      const response = await principalService.getMentors({ limit: 100 });
      // getMentors returns array directly, not { data: [...] }
      setMentors(Array.isArray(response) ? response : response?.data || []);
    } catch (error) {
      console.error("Failed to fetch mentors:", error);
      setMentors([]);
    }
  }, []);

  // Optimistic update helper: Update mentor info for specific students
  const updateInternshipsMentor = useCallback((studentIds, mentorData) => {
    setInternships((prev) =>
      prev.map((internship) => {
        if (studentIds.includes(internship.studentId)) {
          return {
            ...internship,
            mentorId: mentorData?.id || null,
            mentorName: mentorData?.name || null,
            mentorEmail: mentorData?.email || null,
            mentorContact: mentorData?.phoneNo || null,
            mentorDesignation: mentorData?.designation || null,
          };
        }
        return internship;
      }),
    );
  }, []);

  // Initial fetch - only runs once
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchInternships();
    fetchMentors();
    dispatch(fetchInternshipStats());
  }, [fetchInternships, fetchMentors, dispatch]);

  // Filter internships
  const filteredInternships = useMemo(() => {
    let filtered = [...internships];

    // Tab filter
    if (activeTab === "approved") {
      // "Active" tab shows approved, joined, and selected internships
      filtered = filtered.filter((i) =>
        ["APPROVED", "JOINED", "SELECTED"].includes(i.status),
      );
    } else if (activeTab === "completed") {
      filtered = filtered.filter((i) => i.status === "COMPLETED");
    }

    // Status filter
    if (filters.status !== "all") {
      filtered = filtered.filter((i) => i.status === filters.status);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange.length === 2) {
      filtered = filtered.filter((i) => {
        const date = dayjs(i.submittedAt);
        return (
          date.isAfter(filters.dateRange[0]) &&
          date.isBefore(filters.dateRange[1])
        );
      });
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.studentName?.toLowerCase().includes(search) ||
          i.companyName?.toLowerCase().includes(search) ||
          i.studentRollNumber?.toLowerCase().includes(search) ||
          i.jobProfile?.toLowerCase().includes(search),
      );
    }

    return filtered;
  }, [internships, activeTab, filters, searchText]);

  // Status helpers - Self-identified internships are auto-approved
  const getStatusConfig = (status) => {
    const configs = {
      APPROVED: {
        color: "success",
        icon: <CheckCircleOutlined />,
        text: "Active",
      },
      JOINED: { color: "processing", icon: <RiseOutlined />, text: "Ongoing" },
      COMPLETED: {
        color: "default",
        icon: <CheckCircleOutlined />,
        text: "Completed",
      },
      APPLIED: {
        color: "warning",
        icon: <ClockCircleOutlined />,
        text: "Processing",
      }, // Legacy - auto-approved now
    };
    return (
      configs[status] || {
        color: "default",
        icon: <ClockCircleOutlined />,
        text: status,
      }
    );
  };

  // Calculate stats - use API stats for totals, fallback to local calculation
  const stats = useMemo(() => {
    // Use API stats if available (more accurate for totals across all pages)
    if (internshipStats?.total) {
      return {
        total: internshipStats.total || 0,
        ongoing:
          (internshipStats.approved || 0) +
          (internshipStats.joined || 0) +
          (internshipStats.selected || 0),
        completed: internshipStats.completed || 0,
        // Use totalUniqueCompanies (actual count) instead of byCompany.length (top 10 only)
        uniqueCompanies:
          internshipStats.totalUniqueCompanies ||
          internshipStats.byCompany?.length ||
          0,
      };
    }

    // Fallback to local calculation from current page data
    const total = pagination.total || internships.length;
    const ongoing = internships.filter((i) =>
      ["APPROVED", "JOINED", "SELECTED"].includes(i.status),
    ).length;
    const completed = internships.filter(
      (i) => i.status === "COMPLETED",
    ).length;
    const uniqueCompanies = new Set(internships.map((i) => i.companyName)).size;

    return { total, ongoing, completed, uniqueCompanies };
  }, [internships, internshipStats, pagination.total]);

  const handleViewDetails = (internship) => {
    setSelectedInternship(internship);
    setDetailsVisible(true);
  };

  const handleRefresh = () => {
    fetchInternships();
    fetchMentors();
    dispatch(fetchInternshipStats());
    toast.success("Data refreshed");
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredInternships.length === 0) {
      toast.error("No data to export");
      return;
    }

    // Prepare data for Excel
    const excelData = filteredInternships.map((item) => ({
      "Student Name": item.studentName || "",
      "Roll Number": item.studentRollNumber || "",
      "Email": item.studentEmail || "",
      "Phone": item.studentPhone || "",
      "Batch": item.studentBatch || "",
      "Department": item.studentDepartment || "",
      "Company Name": item.companyName || "",
      "Company Address": item.companyAddress || "",
      "Job Profile": item.jobProfile || "",
      "Stipend": item.stipend ? `₹${item.stipend}/month` : "Unpaid",
      "Start Date": item.startDate ? dayjs(item.startDate).format("DD-MM-YYYY") : "",
      "End Date": item.endDate ? dayjs(item.endDate).format("DD-MM-YYYY") : "",
      "Duration": item.duration || "",
      "Status": getStatusConfig(item.status).text || "",
      "Mentor Name": item.mentorName || "",
      "Mentor Email": item.mentorEmail || "",
      "Mentor Contact": item.mentorContact || "",
      "Mentor Designation": item.mentorDesignation || "",
      "Reports Submitted": item.reportsSubmitted || 0,
      "Total Reports": item.totalReports || 0,
      "Expected Reports Now": item.expectedReportsAsOfNow || 0,
      "Faculty Visits": item.facultyVisitsCount || 0,
      "Total Expected Visits": item.totalExpectedVisits || 0,
      "Expected Visits Now": item.expectedVisitsAsOfNow || 0,
      "Last Faculty Visit": item.lastFacultyVisit ? dayjs(item.lastFacultyVisit).format("DD-MM-YYYY") : "",
      "Completion %": item.completionPercentage || 0,
      "Joining Letter": item.hasJoiningLetter ? "Yes" : "No",
      "Submitted At": item.submittedAt ? dayjs(item.submittedAt).format("DD-MM-YYYY HH:mm") : "",
      "Updated At": item.updatedAt ? dayjs(item.updatedAt).format("DD-MM-YYYY HH:mm") : "",
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Self-Identified Internships");

    // Generate filename with timestamp
    const fileName = `self_identified_internships_${dayjs().format("YYYY-MM-DD_HH-mm")}.xlsx`;

    // Write file
    XLSX.writeFile(wb, fileName);
    toast.success(`Exported ${filteredInternships.length} internships to Excel`);
  };

  // Assign mentor (handles both bulk and single)
  const handleAssignMentor = async () => {
    if (!selectedMentorId) {
      toast.error("Please select a mentor");
      return;
    }

    // Get mentor data for optimistic update
    const selectedMentor = mentors.find((m) => m.id === selectedMentorId);

    // For single record assignment
    if (singleAssignRecord) {
      if (!singleAssignRecord.studentId) {
        toast.error("Student ID not found");
        return;
      }

      try {
        setMentorAssignLoading(true);
        const currentYear = new Date().getFullYear();
        await principalService.assignMentor({
          mentorId: selectedMentorId,
          studentIds: [singleAssignRecord.studentId],
          academicYear: `${currentYear}-${currentYear + 1}`,
        });

        // Optimistic update: Update local state instead of refetching
        updateInternshipsMentor([singleAssignRecord.studentId], selectedMentor);

        toast.success(
          `Mentor ${
            singleAssignRecord.mentorName ? "changed" : "assigned"
          } successfully`,
        );
        setAssignMentorVisible(false);
        setSelectedMentorId(null);
        setSingleAssignRecord(null);
        // Refresh dashboard stats to update Un-assigned Students count
        dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
      } catch (error) {
        console.error("Failed to assign mentor:", error);
        toast.error(error.message || "Failed to assign mentor");
      } finally {
        setMentorAssignLoading(false);
      }
      return;
    }

    // For bulk assignment
    const selectedStudentIds = selectedRowKeys
      .map((key) => {
        const internship = internships.find((i) => i.id === key);
        return internship?.studentId;
      })
      .filter(Boolean);

    if (selectedStudentIds.length === 0) {
      toast.error("No valid students selected");
      return;
    }

    try {
      setMentorAssignLoading(true);
      const currentYear = new Date().getFullYear();
      await principalService.assignMentor({
        mentorId: selectedMentorId,
        studentIds: selectedStudentIds,
        academicYear: `${currentYear}-${currentYear + 1}`,
      });

      // Optimistic update: Update local state instead of refetching
      updateInternshipsMentor(selectedStudentIds, selectedMentor);

      toast.success(
        `Mentor assigned to ${selectedStudentIds.length} student(s)`,
      );
      setAssignMentorVisible(false);
      setSelectedMentorId(null);
      setSelectedRowKeys([]);
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      console.error("Failed to assign mentor:", error);
      toast.error(error.message || "Failed to assign mentor");
    } finally {
      setMentorAssignLoading(false);
    }
  };

  // Bulk unassign mentor
  const handleBulkUnassignMentor = async () => {
    const selectedStudentIds = selectedRowKeys
      .map((key) => {
        const internship = internships.find((i) => i.id === key);
        return internship?.studentId;
      })
      .filter(Boolean);

    if (selectedStudentIds.length === 0) {
      toast.error("No valid students selected");
      return;
    }

    try {
      setBulkActionLoading(true);
      await principalService.bulkUnassignMentors(selectedStudentIds);

      // Optimistic update: Clear mentor info instead of refetching
      updateInternshipsMentor(selectedStudentIds, null);

      toast.success(
        `Mentor unassigned from ${selectedStudentIds.length} student(s)`,
      );
      setSelectedRowKeys([]);
      // Refresh dashboard stats to update Un-assigned Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      console.error("Failed to unassign mentors:", error);
      toast.error(error.message || "Failed to unassign mentors");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Single row mentor assignment
  const handleSingleMentorAssign = (record) => {
    setSingleAssignRecord(record);
    setSelectedMentorId(record.mentorId || null);
    setAssignMentorVisible(true);
  };

  // Remove mentor from single student
  const handleRemoveMentor = async (record) => {
    if (!record.studentId) {
      toast.error("Student ID not found");
      return;
    }

    Modal.confirm({
      title: "Remove Mentor",
      content: `Are you sure you want to remove the mentor from ${record.studentName}?`,
      okText: "Remove",
      okType: "danger",
      onOk: async () => {
        try {
          await principalService.bulkUnassignMentors([record.studentId]);

          // Optimistic update: Clear mentor info instead of refetching
          updateInternshipsMentor([record.studentId], null);

          toast.success("Mentor removed successfully");
          // Refresh dashboard stats to update Un-assigned Students count
          dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
        } catch (error) {
          console.error("Failed to remove mentor:", error);
          toast.error(error.message || "Failed to remove mentor");
        }
      },
    });
  };

  // Row selection for bulk actions
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys),
    getCheckboxProps: (record) => ({
      disabled: false,
    }),
  };

  // Bulk action menu items
  const bulkActionItems = [
    { type: "group", label: "Mentor Actions" },
    {
      key: "ASSIGN_MENTOR",
      label: "Assign Mentor",
      icon: <UserAddOutlined className="text-green-500" />,
      action: "mentor",
    },
    {
      key: "UNASSIGN_MENTOR",
      label: "Unassign Mentor",
      icon: <UserDeleteOutlined className="text-orange-500" />,
      action: "mentor",
    },
  ];

  // Table columns
  const columns = [
    {
      title: "Student",
      key: "student",
      fixed: "left",
      render: (_, record) => {
        const statusConfig = getStatusConfig(record.status);
        return (
          <div className="flex items-center gap-3">
            <Badge
              dot
              color={
                record.status === "COMPLETED"
                  ? "default"
                  : record.status === "JOINED"
                  ? "processing"
                  : record.status === "APPROVED" || record.status === "SELECTED"
                  ? "success"
                  : "warning"
              }
              offset={[-2, 28]}
            >
              <ProfileAvatar
                profileImage={record.studentProfileImage}
                className="bg-primary/10 text-primary"
              />
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Text className="font-medium text-text-primary truncate">
                  {record.studentName}
                </Text>
                <Tooltip title={statusConfig.text}>
                  <Tag
                    color={statusConfig.color}
                    className="rounded-full text-xs px-1.5 py-0 leading-tight hidden sm:inline-flex"
                  >
                    {statusConfig.text}
                  </Tag>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                <span>{record.studentRollNumber}</span>
                {record.studentDepartment && (
                  <>
                    <span>•</span>
                    <span>{record.studentDepartment}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Company",
      key: "company",
      responsive: ["sm"],
      render: (_, record) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
            <BankOutlined className="text-secondary" />
          </div>
          <div className="min-w-0 max-w-[200px]">
            <Tooltip title={record.companyName}>
              <Text className="block font-medium text-text-primary truncate">
                {record.companyName.length > 25 
                  ? `${record.companyName.substring(0, 25)}...` 
                  : record.companyName}
              </Text>
            </Tooltip>
            {record.companyAddress && (
              <Tooltip title={record.companyAddress}>
                <Text className="text-xs text-text-tertiary truncate block">
                  <EnvironmentOutlined className="mr-1" />
                  {record.companyAddress}
                </Text>
              </Tooltip>
            )}
            {!record.companyAddress && record.jobProfile && (
              <Text className="text-xs text-text-tertiary truncate block">
                {record.jobProfile}
              </Text>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Duration",
      key: "duration",
      responsive: ["md"],
      render: (_, record) => {
        // Calculate duration from dates if not provided
        const getDuration = () => {
          if (record.duration) return record.duration;
          if (!record.startDate || !record.endDate) return "N/A";
          const start = dayjs(record.startDate);
          const end = dayjs(record.endDate);
          const months = end.diff(start, "month");
          const days = end.diff(start.add(months, "month"), "day");
          if (months > 0 && days > 0) return `${months}m ${days}d`;
          if (months > 0) return `${months} month${months > 1 ? "s" : ""}`;
          return `${end.diff(start, "day")} days`;
        };

        return (
          <div>
            <Text className="text-sm text-text-primary block">
              {getDuration()}
            </Text>
            {record.startDate && (
              <Text className="text-xs text-text-tertiary">
                {dayjs(record.startDate).format("DD MMM")} -{" "}
                {record.endDate
                  ? dayjs(record.endDate).format("DD MMM YY")
                  : "Ongoing"}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "Stipend",
      key: "stipend",
      responsive: ["lg"],
      render: (_, record) =>
        record.stipend ? (
          <Tag color="green" className="rounded-full">
            ₹{record.stipend}/mo
          </Tag>
        ) : (
          <Tag color="default" className="rounded-full">
            Unpaid
          </Tag>
        ),
    },
    {
      title: "Joining Reports",
      key: "joiningLetter",
      align: "center",
      responsive: ["lg"],
      render: (_, record) =>
        record.joiningLetterUrl ? (
          <Tooltip title="View Joining Report">
            <Button
              type="text"
              size="small"
              icon={<FilePdfOutlined style={{ color: "#52c41a" }} />}
              onClick={(e) => {
                e.stopPropagation();
                openFileWithPresignedUrl(record.joiningLetterUrl);
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title="No joining report uploaded">
            <FilePdfOutlined style={{ color: "#d9d9d9" }} />
          </Tooltip>
        ),
    },
    {
      title: "Reports",
      key: "reports",
      responsive: ["md"],
      render: (_, record) => {
        const submitted = record.reportsSubmitted || 0;
        const expectedNow = record.expectedReportsAsOfNow || 0;
        const total = record.totalReports || 0;
        const isOnTrack = submitted >= expectedNow;

        return (
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-text-tertiary" />
            <div className="flex items-center gap-1">
              <Text
                className="text-sm font-medium"
                style={{ color: isOnTrack ? "#52c41a" : "#ff4d4f" }}
              >
                {submitted}
              </Text>
              <Text className="text-text-tertiary text-sm">/</Text>
              <Tooltip title={`${expectedNow} due by now`}>
                <Text className="text-sm text-text-secondary">{total}</Text>
              </Tooltip>
            </div>
          </div>
        );
      },
    },

    {
      title: "Mentor",
      key: "mentor",
      responsive: ["lg"],
      render: (_, record) =>
        record.mentorName ? (
          <div className="flex items-center gap-2">
            <Avatar
              size="small"
              icon={<TeamOutlined />}
              className="bg-success/10 text-success"
            />
            <Text className="text-sm text-text-primary truncate">
              {record.mentorName}
            </Text>
          </div>
        ) : (
          <Tag color="warning" className="rounded-full">
            Unassigned
          </Tag>
        ),
    },
    {
      title: "Visits",
      key: "facultyVisits",
      responsive: ["xl"],
      render: (_, record) => {
        const completed = record.facultyVisitsCount || 0;
        const expectedNow = record.expectedVisitsAsOfNow || 0;
        const total = record.totalExpectedVisits || 0;
        const isOnTrack = completed >= expectedNow;

        return (
          <div>
            <div className="flex items-center gap-1">
              <Text
                className="text-sm font-medium"
                style={{ color: isOnTrack ? "#52c41a" : "#ff4d4f" }}
              >
                {completed}
              </Text>
              <Text className="text-text-tertiary text-sm">/</Text>
              <Tooltip title={`${expectedNow} due by now`}>
                <Text className="text-sm text-text-secondary">{total}</Text>
              </Tooltip>
            </div>
            {record.lastFacultyVisit && (
              <Text className="text-xs text-text-tertiary">
                Last: {dayjs(record.lastFacultyVisit).format("DD MMM")}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: "",
      key: "actions",

      fixed: "right",
      render: (_, record) => {
        const menuItems = [
          {
            key: "view",
            label: "View Details",
            icon: <EyeOutlined />,
            onClick: () => handleViewDetails(record),
          },
          ...(record.joiningLetterUrl
            ? [
                {
                  key: "joiningLetter",
                  label: "View Joining Report",
                  icon: <FilePdfOutlined />,
                  onClick: () =>
                    openFileWithPresignedUrl(record.joiningLetterUrl),
                },
              ]
            : []),
          { type: "divider" },
          ...(record.mentorName
            ? [
                {
                  key: "changeMentor",
                  label: "Change Mentor",
                  icon: <TeamOutlined />,
                  onClick: () => handleSingleMentorAssign(record),
                },
                {
                  key: "removeMentor",
                  label: "Remove Mentor",
                  icon: <UserDeleteOutlined />,
                  danger: true,
                  onClick: () => handleRemoveMentor(record),
                },
              ]
            : [
                {
                  key: "assignMentor",
                  label: "Assign Mentor",
                  icon: <UserAddOutlined />,
                  onClick: () => handleSingleMentorAssign(record),
                },
              ]),
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined style={{ fontSize: "18px" }} />}
              className="flex items-center justify-center"
            />
          </Dropdown>
        );
      },
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: "all",
      label: (
        <span className="flex items-center gap-2">
          <ShopOutlined />
          All ({stats.total})
        </span>
      ),
    },
    {
      key: "approved",
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Active ({stats.ongoing})
        </span>
      ),
    },
    {
      key: "completed",
      label: (
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Completed ({stats.completed})
        </span>
      ),
    },
  ];

  if (loading && internships.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">
          Loading internships...
        </Text>
      </div>
    );
  }

  // Small Stat Card Component
  const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    iconBgColor,
    iconColor,
    valueColor,
  }) => (
    <Card
      className="h-full border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: "16px 12px" } }}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center mb-2"
          style={{ backgroundColor: iconBgColor }}
        >
          {React.cloneElement(icon, {
            style: { fontSize: "20px", color: iconColor },
          })}
        </div>
        <Text className="text-xs font-medium text-gray-600 mb-1">{title}</Text>
        <span
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {subtitle && (
          <Text className="text-[10px] text-gray-400 mt-1">{subtitle}</Text>
        )}
      </div>
    </Card>
  );

  const statCards = [
    {
      title: "Total Internships",
      value: stats.total,
      subtitle: "All placements",
      icon: <ShopOutlined />,
      iconBgColor: "#dbeafe",
      iconColor: "#3b82f6",
      valueColor: "#3b82f6",
    },
    {
      title: "Ongoing",
      value: stats.ongoing,
      subtitle: "Currently active",
      icon: <RiseOutlined />,
      iconBgColor: "#dcfce7",
      iconColor: "#22c55e",
      valueColor: "#22c55e",
    },
    {
      title: "Completed",
      value: stats.completed,
      subtitle: "Successfully finished",
      icon: <CheckCircleOutlined />,
      iconBgColor: "#f3e8ff",
      iconColor: "#9333ea",
      valueColor: "#9333ea",
    },
    {
      title: "Companies",
      value: stats.uniqueCompanies,
      subtitle: "Partner organizations",
      icon: <BankOutlined />,
      iconBgColor: "#fef9c3",
      iconColor: "#eab308",
      valueColor: "#eab308",
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Self-Identified Internships
          </h1>
          <Text className="text-text-tertiary text-sm">
            Track student-sourced placements
          </Text>
        </div>
        <Space wrap size="small">
          {selectedRowKeys.length > 0 && (
            <Dropdown
              menu={{
                items: bulkActionItems.map((item) => {
                  if (item.type === "group") {
                    return {
                      type: "group",
                      label: item.label,
                      key: item.label,
                    };
                  }
                  if (item.type === "divider") {
                    return { type: "divider", key: "divider" };
                  }
                  if (item.key === "ASSIGN_MENTOR") {
                    return {
                      key: item.key,
                      label: (
                        <div
                          className="flex items-center gap-2 py-1"
                          onClick={() => setAssignMentorVisible(true)}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                      ),
                    };
                  }
                  if (item.key === "UNASSIGN_MENTOR") {
                    return {
                      key: item.key,
                      label: (
                        <Popconfirm
                          title={`Unassign mentor from ${selectedRowKeys.length} student(s)?`}
                          description="This will remove the assigned mentor from selected students"
                          onConfirm={handleBulkUnassignMentor}
                          okText="Yes"
                          cancelText="No"
                        >
                          <div className="flex items-center gap-2 py-1">
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                        </Popconfirm>
                      ),
                    };
                  }
                  return {
                    key: item.key,
                    label: (
                      <Popconfirm
                        title={`Update ${selectedRowKeys.length} internship(s)?`}
                        description={`This will change their status to "${item.label.replace(
                          "Mark as ",
                          "",
                        )}"`}
                        onConfirm={() => handleBulkStatusUpdate(item.key)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <div className="flex items-center gap-2 py-1">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                      </Popconfirm>
                    ),
                  };
                }),
              }}
              trigger={["click"]}
            >
              <Button
                loading={bulkActionLoading}
                className="rounded-lg"
                size="middle"
              >
                <Space>
                  Bulk Actions ({selectedRowKeys.length})
                  <MoreOutlined />
                </Space>
              </Button>
            </Dropdown>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
            className="rounded-lg"
            size="middle"
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportExcel}
            className="rounded-lg shadow-md shadow-primary/20"
            size="middle"
          >
            Export
          </Button>
        </Space>
      </div>

      {/* Stats */}
      {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div> */}

      {/* Filters */}
      <Card className="rounded-2xl border-border shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <Input
            placeholder="Search by student, company, or role..."
            prefix={<SearchOutlined className="text-text-tertiary" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full md:w-72 rounded-lg"
            allowClear
          />
          <Select
            value={filters.status}
            onChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
            className="w-full md:w-40"
            placeholder="Status"
          >
            <Select.Option value="all">All Status</Select.Option>
            <Select.Option value="APPROVED">Active</Select.Option>
            <Select.Option value="JOINED">Ongoing</Select.Option>
            <Select.Option value="COMPLETED">Completed</Select.Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) =>
              setFilters((prev) => ({ ...prev, dateRange: dates }))
            }
            format="DD/MM/YYYY"
            className="w-full md:w-64"
            placeholder={["Start Date", "End Date"]}
          />
        </div>
      </Card>

      {/* Table */}
      <Card
        className="rounded-2xl border-border shadow-sm !mt-4"
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="!px-4 pt-4"
        />
        <Table
          columns={columns}
          dataSource={filteredInternships}
          rowKey="id"
          loading={loading}
          rowSelection={rowSelection}
          scroll={{ x: 'max-content' }}
          expandable={{
            expandedRowRender: (record) => (
              <div className="p-4 bg-background-secondary/30 rounded-lg space-y-4">
                <Row gutter={[24, 16]}>
                  {/* Monthly Reports Section */}
                  <Col xs={24} lg={14}>
                    <div>
                      <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                        <FileTextOutlined className="mr-1" />
                        Monthly Reports ({record.reportsSubmitted}/
                        {record.totalReports})
                      </Text>
                      {record.monthlyReports &&
                      record.monthlyReports.length > 0 ? (
                        <Table
                          dataSource={record.monthlyReports}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          columns={[
                            {
                              title: "Month",
                              dataIndex: "monthName",
                              key: "monthName",
                              render: (text, r) => `${text} ${r.year}`,
                            },
                            {
                              title: "Status",
                              dataIndex: "status",
                              key: "status",
                              render: (status) => (
                                <Tag
                                  color={
                                    status === "APPROVED"
                                      ? "success"
                                      : status === "SUBMITTED"
                                        ? "processing"
                                        : status === "REJECTED"
                                          ? "error"
                                          : "default"
                                  }
                                >
                                  {status}
                                </Tag>
                              ),
                            },
                            {
                              title: "Submitted",
                              dataIndex: "submittedAt",
                              key: "submittedAt",
                              render: (date) =>
                                date ? dayjs(date).format("DD MMM YYYY") : "-",
                            },
                            {
                              title: "Report",
                              key: "report",
                              render: (_, r) =>
                                r.reportFileUrl ? (
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<FilePdfOutlined />}
                                    onClick={() =>
                                      openFileWithPresignedUrl(r.reportFileUrl)
                                    }
                                  >
                                    View
                                  </Button>
                                ) : (
                                  "-"
                                ),
                            },
                          ]}
                        />
                      ) : (
                        <Empty
                          description="No reports submitted yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          className="py-4"
                        />
                      )}
                    </div>
                  </Col>

                  {/* Timeline Section */}
                  <Col xs={24} lg={10}>
                    <div>
                      <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                        <ClockCircleOutlined className="mr-1" />
                        Progress Timeline
                      </Text>
                      {record.timeline && record.timeline.length > 0 ? (
                        <Timeline
                          items={record.timeline.map((item, index) => ({
                            key: index,
                            color: item.color,
                            children: item.children,
                          }))}
                        />
                      ) : (
                        <Empty
                          description="No timeline events yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          className="py-4"
                        />
                      )}
                    </div>
                  </Col>
                </Row>
              </div>
            ),
            rowExpandable: (record) =>
              record.monthlyReports?.length > 0 || record.timeline?.length > 0,
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: filteredInternships.length,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} internships`,
            onChange: (page, pageSize) =>
              setPagination({ ...pagination, current: page, pageSize }),
          }}
          locale={{
            emptyText: (
              <Empty
                description={
                  <div className="text-center py-4">
                    <Text className="text-text-tertiary block mb-2">
                      No internships found
                    </Text>
                    <Text className="text-text-tertiary text-xs">
                      Students will appear here once they submit self-identified
                      internships
                    </Text>
                  </div>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ),
          }}
        />
      </Card>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <ShopOutlined className="text-purple-500" />
            <span>Internship Details</span>
            {selectedInternship && (
              <Tag color="purple" className="ml-2 rounded-full">
                Self-Identified
              </Tag>
            )}
          </div>
        }
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        width={800}
        footer={
          <Space>
            <Button onClick={() => setDetailsVisible(false)}>Close</Button>
            {selectedInternship?.joiningLetterUrl && (
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                onClick={() =>
                  openFileWithPresignedUrl(selectedInternship.joiningLetterUrl)
                }
              >
                View Joining Report
              </Button>
            )}
          </Space>
        }
      >
        {selectedInternship && (
          <div className="space-y-6">
            {/* Status Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ProfileAvatar
                    size={48}
                    profileImage={selectedInternship.studentProfileImage}
                    className="bg-primary/10 text-primary"
                  />
                  <div>
                    <Text className="font-bold text-lg text-text-primary block">
                      {selectedInternship.studentName}
                    </Text>
                    <Text className="text-text-secondary text-sm">
                      {selectedInternship.studentRollNumber}
                    </Text>
                  </div>
                </div>
                <Tag
                  icon={getStatusConfig(selectedInternship.status).icon}
                  color={getStatusConfig(selectedInternship.status).color}
                  className="rounded-full px-4 py-1 text-sm"
                >
                  {getStatusConfig(selectedInternship.status).text}
                </Tag>
              </div>
            </div>

            {/* Company Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <BankOutlined className="mr-1" />
                Company Information
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Company Name" span={2}>
                  <Text strong>{selectedInternship.companyName}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Job Profile">
                  {selectedInternship.jobProfile || "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="Stipend">
                  {selectedInternship.stipend ? (
                    <Tag color="green">{selectedInternship.stipend}/month</Tag>
                  ) : (
                    <Tag color="default">Unpaid</Tag>
                  )}
                </Descriptions.Item>
                {selectedInternship.companyAddress && (
                  <Descriptions.Item label="Address" span={2}>
                    <div className="flex items-start gap-1">
                      <EnvironmentOutlined className="text-text-tertiary mt-1" />
                      <span>{selectedInternship.companyAddress}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyContact && (
                  <Descriptions.Item label="Contact">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyContact}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.companyEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.companyEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {/* Duration Details */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <CalendarOutlined className="mr-1" />
                Internship Duration
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Start Date">
                  {selectedInternship.startDate
                    ? dayjs(selectedInternship.startDate).format("DD MMM YYYY")
                    : "N/A"}
                </Descriptions.Item>
                <Descriptions.Item label="End Date">
                  {selectedInternship.endDate
                    ? dayjs(selectedInternship.endDate).format("DD MMM YYYY")
                    : "Ongoing"}
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  <Tag color="blue">{selectedInternship.duration || "N/A"}</Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Mentor Details */}
            {selectedInternship.mentorName && (
              <div>
                <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                  <TeamOutlined className="mr-1" />
                  Faculty Mentor
                </Text>
                <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                  <Descriptions.Item label="Name">
                    <Text strong>{selectedInternship.mentorName}</Text>
                  </Descriptions.Item>
                  {selectedInternship.mentorDesignation && (
                    <Descriptions.Item label="Designation">
                      {selectedInternship.mentorDesignation}
                    </Descriptions.Item>
                  )}
                  {selectedInternship.mentorEmail && (
                    <Descriptions.Item label="Email" span={2}>
                      <div className="flex items-center gap-1">
                        <MailOutlined className="text-text-tertiary" />
                        <span>{selectedInternship.mentorEmail}</span>
                      </div>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            )}

            {/* Student Contact */}
            <div>
              <Text className="text-xs uppercase font-bold text-text-tertiary block mb-3">
                <UserOutlined className="mr-1" />
                Student Contact
              </Text>
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                {selectedInternship.studentEmail && (
                  <Descriptions.Item label="Email">
                    <div className="flex items-center gap-1">
                      <MailOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentEmail}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentPhone && (
                  <Descriptions.Item label="Phone">
                    <div className="flex items-center gap-1">
                      <PhoneOutlined className="text-text-tertiary" />
                      <span>{selectedInternship.studentPhone}</span>
                    </div>
                  </Descriptions.Item>
                )}
                {selectedInternship.studentBatch && (
                  <Descriptions.Item label="Batch">
                    {selectedInternship.studentBatch}
                  </Descriptions.Item>
                )}
                {selectedInternship.studentDepartment && (
                  <Descriptions.Item label="Department">
                    {selectedInternship.studentDepartment}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Mentor Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-text-primary">
            <UserAddOutlined className="text-green-500" />
            <span>
              {singleAssignRecord
                ? singleAssignRecord.mentorName
                  ? "Change Mentor"
                  : "Assign Mentor"
                : "Assign Mentor to Selected Students"}
            </span>
          </div>
        }
        open={assignMentorVisible}
        onCancel={() => {
          setAssignMentorVisible(false);
          setSelectedMentorId(null);
          setSingleAssignRecord(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setAssignMentorVisible(false);
              setSelectedMentorId(null);
              setSingleAssignRecord(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="assign"
            type="primary"
            loading={mentorAssignLoading}
            onClick={handleAssignMentor}
            disabled={!selectedMentorId}
            icon={<UserAddOutlined />}
          >
            {singleAssignRecord?.mentorName ? "Change Mentor" : "Assign Mentor"}
          </Button>,
        ]}
        width={500}
      >
        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <Text className="text-sm text-blue-700">
              {singleAssignRecord ? (
                <>
                  Assigning mentor to{" "}
                  <strong>{singleAssignRecord.studentName}</strong>
                </>
              ) : (
                <>
                  <strong>{selectedRowKeys.length}</strong> student(s) selected
                  for mentor assignment
                </>
              )}
            </Text>
          </div>

          <div>
            <Text className="block text-sm font-medium text-text-primary mb-2">
              Select Faculty Mentor
            </Text>
            <Select
              placeholder="Search and select a mentor..."
              value={selectedMentorId}
              onChange={setSelectedMentorId}
              className="w-full"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                option?.children?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {mentors.map((mentor) => (
                <Select.Option key={mentor.id} value={mentor.id}>
                  {mentor.name} - {mentor.designation || mentor.role}
                </Select.Option>
              ))}
            </Select>
          </div>

          {selectedMentorId && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <Text className="text-sm text-green-700">
                Selected mentor will be assigned to all {selectedRowKeys.length}{" "}
                student(s)
              </Text>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

// Mock data generator for demo
const generateMockData = () => {
  const companies = [
    { name: "TCS", location: "Mumbai", industry: "IT Services" },
    { name: "Infosys", location: "Bangalore", industry: "IT Services" },
    { name: "Wipro", location: "Pune", industry: "IT Services" },
    { name: "HCL Technologies", location: "Noida", industry: "IT Services" },
    { name: "Tech Mahindra", location: "Hyderabad", industry: "IT Services" },
    { name: "Cognizant", location: "Chennai", industry: "IT Services" },
    { name: "Accenture", location: "Gurgaon", industry: "Consulting" },
    { name: "Capgemini", location: "Mumbai", industry: "Consulting" },
  ];

  const roles = [
    "Software Developer Intern",
    "Data Analyst Intern",
    "Web Developer Intern",
    "ML Engineer Intern",
    "QA Intern",
  ];
  const statuses = ["APPROVED", "JOINED", "COMPLETED"];
  const names = [
    "Rahul Kumar",
    "Priya Sharma",
    "Amit Singh",
    "Neha Gupta",
    "Vikram Patel",
    "Ananya Roy",
  ];

  return Array.from({ length: 12 }, (_, i) => {
    const company = companies[i % companies.length];
    const reportsSubmitted = Math.floor(Math.random() * 4);
    const totalReports = Math.max(
      reportsSubmitted,
      3 + Math.floor(Math.random() * 3),
    );
    const completionPercentage =
      totalReports > 0
        ? Math.round((reportsSubmitted / totalReports) * 100)
        : 0;
    const facultyVisitsCount = Math.floor(Math.random() * 5);

    return {
      id: `INT-${1000 + i}`,
      studentId: `STU-${100 + i}`,
      studentName: names[i % names.length],
      studentRollNumber: `2021CS${String(i + 1).padStart(3, "0")}`,
      studentEmail: `student${i + 1}@college.edu`,
      studentBatch: "2021-2025",
      studentDepartment: "Computer Science",
      companyName: company.name,
      companyAddress: `${company.location}, India`,
      jobProfile: roles[i % roles.length],
      stipend: i % 3 === 0 ? null : `${10000 + i * 2500}`,
      startDate: dayjs()
        .subtract(i * 15, "day")
        .toISOString(),
      endDate: dayjs()
        .add((6 - (i % 4)) * 30, "day")
        .toISOString(),
      duration: `${3 + (i % 4)} months`,
      status: statuses[i % statuses.length],
      mentorName: i % 2 === 0 ? `Dr. Faculty ${i + 1}` : null,
      mentorEmail: i % 2 === 0 ? `faculty${i + 1}@college.edu` : null,
      submittedAt: dayjs()
        .subtract(i * 7, "day")
        .toISOString(),
      isSelfIdentified: true,
      // New fields
      reportsSubmitted,
      totalReports,
      completionPercentage,
      facultyVisitsCount,
      lastFacultyVisit:
        facultyVisitsCount > 0
          ? dayjs()
              .subtract(i * 3, "day")
              .toISOString()
          : null,
      timeline: [
        {
          children: `Internship started - ${dayjs()
            .subtract(i * 15, "day")
            .format("DD/MM/YYYY")}`,
          color: "green",
        },
        ...(reportsSubmitted > 0
          ? [{ children: "Report 1 submitted", color: "blue" }]
          : []),
      ],
      monthlyReports: Array.from({ length: reportsSubmitted }, (_, j) => ({
        id: `RPT-${i}-${j}`,
        month: j + 1,
        year: 2024,
        monthName: dayjs().subtract(j, "month").format("MMMM"),
        status: j === 0 ? "APPROVED" : "SUBMITTED",
        submittedAt: dayjs()
          .subtract(j * 30, "day")
          .toISOString(),
        reportFileUrl: null,
      })),
    };
  });
};

export default SelfIdentifiedInternships;
