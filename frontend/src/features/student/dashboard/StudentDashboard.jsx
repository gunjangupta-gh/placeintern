import React, { useState, useCallback, useMemo, memo, useEffect } from "react";
import {
  Row,
  Col,
  Spin,
  Alert,
  Card,
  Typography,
  Button,
  Tag,
  Empty,
  Upload,
  Modal,
  message,
  Tooltip,
  Select,
  Form,
  Input,
  Avatar,
  Space,
  List,
  Descriptions,
  theme,
} from "antd";
import {
  SyncOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  BankOutlined,
  PlusOutlined,
  UploadOutlined,
  CalendarOutlined,
  EyeOutlined,
  LaptopOutlined,
  BookOutlined,
  FireOutlined,
  ClockCircleOutlined,
  SendOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import toast from "react-hot-toast";

import { useStudentDashboard } from "../hooks/useStudentDashboard";
import { useNotifications } from "../../common/notifications";
import { selectInstitute } from "../../../store/slices/instituteSlice";
import studentService from "../../../services/student.service";
import {
  getImageUrl,
  openFileWithPresignedUrl,
} from "../../../utils/imageUtils";
import {
  calculateExpectedReportMonths,
  getReportDueDate,
} from "../../../utils/monthlyCycle";
import { PlacementInterestModal } from "./components";

dayjs.extend(isSameOrBefore);

const { Title, Text, Paragraph } = Typography;

// Status Card Component
const StatusCard = memo(
  ({
    icon,
    iconBgColor,
    iconColor,
    title,
    value,
    secondaryValue,
    statusTag,
    statusColor,
    subtitle,
    onViewAction,
    onAddAction,
    onDownloadAction,
    showViewAction,
    showAddAction,
    showDownloadAction,
    onClick,
    pendingItems = [],
  }) => {
    const { token } = theme.useToken();
    
    return (
      <Card
        className={`h-full border transition-all duration-300 hover:shadow-md ${
          onClick ? "cursor-pointer" : ""
        }`}
        style={{ 
          borderColor: token.colorBorderSecondary,
          backgroundColor: token.colorBgContainer,
        }}
        styles={{ body: { padding: "16px" } }}
        onClick={onClick}
      >
        {/* Action buttons row - fixed at top */}
        <div className="flex justify-between items-center mb-2 h-6">
          <div className="flex gap-1">
            {showViewAction && (
              <Tooltip title="View">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined style={{ fontSize: '12px' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewAction?.();
                  }}
                  className="w-6 h-6 min-w-0 p-0 flex items-center justify-center"
                  style={{ color: token.colorTextTertiary }}
                />
              </Tooltip>
            )}
            {showDownloadAction && (
              <Tooltip title="Download Format">
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined style={{ fontSize: '12px' }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadAction?.();
                  }}
                  className="w-6 h-6 min-w-0 p-0 flex items-center justify-center"
                  style={{ color: token.colorTextTertiary }}
                />
              </Tooltip>
            )}
          </div>

          {showAddAction ? (
            <Tooltip title="Upload">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined style={{ fontSize: '12px' }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAction?.();
                }}
                className="w-6 h-6 min-w-0 p-0 flex items-center justify-center"
                style={{ color: token.colorTextTertiary }}
              />
            </Tooltip>
          ) : (
            <div className="w-6" />
          )}
        </div>

        <div className="text-center">
          <div
            className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-3"
            style={{ backgroundColor: iconBgColor }}
          >
            {React.cloneElement(icon, {
              style: { fontSize: "20px", color: iconColor },
            })}
          </div>

          <Text strong className="block text-sm mb-2" style={{ color: token.colorTextSecondary }}>
            {title}
          </Text>

          {value !== undefined && (
            <div className="text-2xl font-bold mb-1" style={{ color: token.colorText }}>
              {value}
              {secondaryValue !== undefined && (
                <>
                  <span style={{ color: token.colorTextQuaternary }}>/</span>
                  <span style={{ color: token.colorTextTertiary }}>{secondaryValue}</span>
                </>
              )}
            </div>
          )}

          {statusTag && (
            <Tag color={statusColor} className="!px-3 !py-0.5 text-xs border-0">
              {statusTag}
            </Tag>
          )}

          {pendingItems.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex flex-wrap gap-1 justify-center">
                {pendingItems.slice(0, 3).map((item, index) => (
                  <Tag
                    key={index}
                    color={item.includes('overdue') ? 'error' : 'warning'}
                    className="!px-2 !py-0.5 !m-0 text-[10px] border-0"
                  >
                    {item}
                  </Tag>
                ))}
              </div>
              {pendingItems.length > 3 && (
                <Text type="secondary" className="text-[10px]">
                  +{pendingItems.length - 3} more
                </Text>
              )}
            </div>
          )}

          {subtitle && (
            <Text className="text-[10px] mt-1 block" style={{ color: token.colorTextTertiary }}>
              {subtitle}
            </Text>
          )}
        </div>
      </Card>
    );
  }
);

StatusCard.displayName = "StatusCard";

// Faculty Mentor Card Component
const FacultyMentorCard = memo(({ mentor, visitCount = 0, onAddMentor }) => {
  const { token } = theme.useToken();
  
  return (
    <Card
      className="border h-full transition-all hover:shadow-sm"
      style={{ 
        borderColor: token.colorBorderSecondary,
        backgroundColor: token.colorBgContainer 
      }}
      styles={{ body: { padding: 0, position: "relative" } }}
    >
      <div 
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: token.colorBorderSecondary }}
      >
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#a855f7' }} />
        <Text className="text-sm font-semibold" style={{ color: token.colorText }}>
          Faculty Mentor
        </Text>
      </div>

      <div className="p-4">
        <Space orientation="vertical" className="w-full" size="middle">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Text type="secondary" className="text-xs block mb-1">
                Mentor Name
              </Text>
              <Text strong className="text-sm block" style={{ color: token.colorText }}>
                {mentor?.name || "Not Assigned"}
              </Text>
              {mentor?.designation && mentor.designation !== "N/A" && (
                <Text type="secondary" className="text-xs block mt-0.5">
                  {mentor.designation}
                </Text>
              )}
            </div>
            <Avatar
              size={44}
              icon={<UserOutlined />}
              className="shrink-0"
              style={{ 
                backgroundColor: '#f3e8ff', 
                color: '#9333ea' 
              }}
            />
          </div>

          {mentor?.email && (
            <div>
              <Text type="secondary" className="text-xs block mb-1">
                Email
              </Text>
              <Text className="text-xs break-all" style={{ color: token.colorText }}>{mentor.email}</Text>
            </div>
          )}

          {mentor?.contact && (
            <div>
              <Text type="secondary" className="text-xs block mb-1">
                Contact
              </Text>
              <Text className="text-xs" style={{ color: token.colorText }}>{mentor.contact}</Text>
            </div>
          )}

          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Faculty Visits
            </Text>
            <Text strong className="text-base" style={{ color: token.colorText }}>
              {visitCount}
            </Text>
          </div>
        </Space>
      </div>
    </Card>
  );
});

FacultyMentorCard.displayName = "FacultyMentorCard";

// Industry Supervisor Card Component
const IndustrySupervisorCard = memo(({ supervisor, onAddSupervisor }) => {
  const { token } = theme.useToken();
  
  return (
    <Card
      className="border h-full transition-all hover:shadow-sm"
      style={{ 
        borderColor: token.colorBorderSecondary,
        backgroundColor: token.colorBgContainer 
      }}
      styles={{ body: { padding: 0, position: "relative" } }}
    >
      <div 
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: token.colorBorderSecondary }}
      >
        <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#f97316' }} />
        <Text className="text-sm font-semibold" style={{ color: token.colorText }}>
          Industry Supervisor
        </Text>
      </div>

      <div className="p-4">
        <Space orientation="vertical" className="w-full" size="middle">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Text type="secondary" className="text-xs block mb-1">
                Supervisor Name
              </Text>
              <Text strong className="text-sm block" style={{ color: token.colorText }}>
                {supervisor?.name || "Not Provided"}
              </Text>
              {supervisor?.designation && supervisor.designation !== "N/A" && (
                <Text type="secondary" className="text-xs block mt-0.5">
                  {supervisor.designation}
                </Text>
              )}
            </div>
            <Avatar
              size={44}
              icon={<BankOutlined />}
              className="shrink-0"
              style={{ 
                backgroundColor: '#ffedd5', 
                color: '#ea580c' 
              }}
            />
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary" className="text-xs block mb-1">
                Contact
              </Text>
              <Text className="text-xs" style={{ color: token.colorText }}>{supervisor?.contact || "N/A"}</Text>
            </Col>
            <Col span={12}>
              <Text type="secondary" className="text-xs block mb-1">
                Email
              </Text>
              <Text
                className="text-xs truncate block"
                title={supervisor?.email || "N/A"}
                style={{ color: token.colorText }}
              >
                {supervisor?.email || "N/A"}
              </Text>
            </Col>
          </Row>

          {supervisor?.company && supervisor.company !== "N/A" && (
            <div>
              <Text type="secondary" className="text-xs block mb-1">
                Company
              </Text>
              <Text className="text-xs" style={{ color: token.colorText }}>{supervisor.company}</Text>
            </div>
          )}
        </Space>
      </div>
    </Card>
  );
});

IndustrySupervisorCard.displayName = "IndustrySupervisorCard";

// Main Dashboard Component
const StudentDashboard = () => {
  useNotifications({
    showToasts: false,
    showInitialToasts: true,
    maxInitialToasts: 3,
  });

  const navigate = useNavigate();
  const institute = useSelector(selectInstitute);
  const { token } = theme.useToken();

  const {
    isLoading,
    isRevalidating,
    profile,
    grievances,
    stats,
    activeInternships,
    monthlyReports,
    mentor,
    error,
    refresh,
  } = useStudentDashboard();

  // Modal states
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reportUploadModalVisible, setReportUploadModalVisible] =
    useState(false);
  const [reportViewModalVisible, setReportViewModalVisible] = useState(false);
  const [joiningViewModalVisible, setJoiningViewModalVisible] = useState(false);
  const [pendingFieldsModalVisible, setPendingFieldsModalVisible] =
    useState(false);
  const [placementInterestModalVisible, setPlacementInterestModalVisible] =
    useState(false);
  const [placementInterestChecked, setPlacementInterestChecked] = useState(false);

  // Check if placement interest form needs to be shown
  useEffect(() => {
    const checkPlacementInterest = async () => {
      if (placementInterestChecked) return;

      try {
        const response = await studentService.hasFilledPlacementInterest();
        if (!response.isFilled) {
          setPlacementInterestModalVisible(true);
        }
        setPlacementInterestChecked(true);
      } catch (err) {
        console.error('Error checking placement interest:', err);
        setPlacementInterestChecked(true);
      }
    };

    // Only check after profile is loaded
    if (profile && !isLoading) {
      checkPlacementInterest();
    }
  }, [profile, isLoading, placementInterestChecked]);

  // Internship selector state
  const [selectedInternshipIndex, setSelectedInternshipIndex] = useState(0);

  // Get current active internship
  const hasActiveInternship = activeInternships?.length > 0;
  const currentInternship = useMemo(() => {
    if (!hasActiveInternship) return null;
    const internship =
      activeInternships[selectedInternshipIndex] || activeInternships[0];
    return internship;
  }, [activeInternships, selectedInternshipIndex, hasActiveInternship]);

  // Grievances data
  const grievancesList = useMemo(() => {
    return Array.isArray(grievances)
      ? grievances
      : grievances?.grievances || [];
  }, [grievances]);

  const openGrievances = useMemo(() => {
    return grievancesList.filter((g) => {
      const status = (g.status || "").toString().toUpperCase();
      return (
        status !== "RESOLVED" &&
        status !== "CLOSED" &&
        status !== "RESOLVED_BY_STUDENT"
      );
    }).length;
  }, [grievancesList]);

  // Monthly reports for current internship
  const currentInternshipReports = useMemo(() => {
    if (!currentInternship) return [];
    return (monthlyReports || []).filter(
      (r) => r.applicationId === currentInternship.id
    );
  }, [monthlyReports, currentInternship]);

  // Check if internship has started
  const hasInternshipStarted = useMemo(() => {
    if (!currentInternship) return false;
    const startDate = currentInternship.isSelfIdentified
      ? currentInternship.startDate
      : currentInternship.joiningDate ||
        currentInternship.internship?.startDate;
    if (!startDate) return false;
    return dayjs(startDate).isSameOrBefore(dayjs(), "day");
  }, [currentInternship]);

  // Calculate monthly report status using monthly cycle utility
  const monthlyReportStatus = useMemo(() => {
    if (!currentInternship) return { submitted: 0, total: 0, pending: [], overdue: [], pendingCount: 0, dueNowCount: 0, startDateInfo: null, nextDueInfo: null };

    // Get internship dates
    const startDate = currentInternship.isSelfIdentified
      ? currentInternship.startDate
      : currentInternship.joiningDate || currentInternship.internship?.startDate;
    const endDate = currentInternship.isSelfIdentified
      ? currentInternship.endDate
      : currentInternship.internship?.endDate;

    // Use counter fields from API
    const submittedCount = currentInternship.submittedReportsCount ?? 0;
    const totalExpected = currentInternship.totalExpectedReports ?? 0;

    // Generate month-wise pending/overdue reports using monthly cycle logic
    const getReportStatus = () => {
      if (!startDate || !endDate) return { pending: [], overdue: [], dueNowCount: 0, nextDueInfo: null };

      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);
      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) return { pending: [], overdue: [], dueNowCount: 0, nextDueInfo: null };

      const now = new Date();

      // Check if internship hasn't started yet
      if (parsedStartDate > now) return { pending: [], overdue: [], dueNowCount: 0, nextDueInfo: null };

      // Get expected months using monthly cycle utility (skips January for reports)
      const expectedMonths = calculateExpectedReportMonths(parsedStartDate, parsedEndDate);

      // Get submitted reports
      const submittedReports = currentInternshipReports || [];
      const submittedMonthYears = new Set(
        submittedReports.map(r => `${r.reportMonth}-${r.reportYear}`)
      );

      const pendingMonths = [];
      const overdueMonths = [];
      let nextDueInfo = null;

      // Check each expected month
      for (const month of expectedMonths) {
        const monthYear = `${month.monthNumber}-${month.year}`;
        const monthName = month.monthName.substring(0, 3); // Short month name

        // Check if the month has ended (report can be submitted)
        const monthEnd = new Date(month.year, month.monthNumber, 0); // Last day of month
        monthEnd.setHours(23, 59, 59, 999);

        // Check if this month's report is missing
        if (!submittedMonthYears.has(monthYear)) {
          if (monthEnd < now) {
            // Month has ended, report can/should be submitted
            const dueDate = getReportDueDate(month.year, month.monthNumber);

            if (dueDate <= now) {
              // Due date has passed - overdue
              overdueMonths.push(`${monthName} overdue`);
            } else {
              // Month ended but due date not passed yet - due now
              pendingMonths.push(`${monthName} due`);
            }
          } else if (!nextDueInfo) {
            // This is the next upcoming month (not ended yet)
            nextDueInfo = {
              monthName: month.monthName,
              year: month.year,
              dueDate: getReportDueDate(month.year, month.monthNumber),
            };
          }
        }

        // Safety break - don't show more than 5 items total
        if (overdueMonths.length + pendingMonths.length >= 5) break;
      }

      // Count of reports that are actually due now (month ended, not submitted)
      const dueNowCount = overdueMonths.length + pendingMonths.length;

      return { pending: pendingMonths, overdue: overdueMonths, dueNowCount, nextDueInfo };
    };

    const { pending, overdue, dueNowCount, nextDueInfo } = getReportStatus();

    // Check if internship starts in the future and get start date display
    const getStartDateInfo = () => {
      if (!startDate) return null;

      const parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) return null;

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startDateOnly = new Date(parsedStartDate);
      startDateOnly.setHours(0, 0, 0, 0);

      // Show start date if internship hasn't started yet
      if (startDateOnly > now) {
        const startMonth = parsedStartDate.toLocaleString('default', { month: 'short' });
        const monthsUntilStart = Math.ceil((startDateOnly - now) / (1000 * 60 * 60 * 24 * 30));

        return {
          dateStr: `${startMonth} ${parsedStartDate.getDate()}, ${parsedStartDate.getFullYear()}`,
          message: monthsUntilStart <= 1
            ? "Starting soon - Reports will be due monthly"
            : `Starts in ~${monthsUntilStart} month${monthsUntilStart > 1 ? 's' : ''}`
        };
      }

      return null;
    };

    const startDateInfo = getStartDateInfo();

    // Combine overdue and pending for display (overdue first)
    const allPendingItems = [...overdue, ...pending].slice(0, 5);

    return {
      submitted: submittedCount,
      total: totalExpected,
      pending: allPendingItems,
      overdue,
      pendingCount: dueNowCount, // Only count reports that are actually due (month ended)
      dueNowCount,
      startDateInfo,
      nextDueInfo,
    };
  }, [currentInternship, currentInternshipReports]);

  // Internship data status check
  const getInternshipDataStatus = useCallback((application) => {
    if (!application) return { status: "missing", pendingFields: [] };

    if (application.isSelfIdentified) {
      const pendingFields = [];
      if (!application.companyName) pendingFields.push("Company Name");
      if (!application.jobProfile) pendingFields.push("Job Profile");
      if (!application.startDate) pendingFields.push("Start Date");
      if (!application.endDate) pendingFields.push("End Date");

      if (pendingFields.length === 0)
        return { status: "complete", pendingFields: [] };
      return {
        status: pendingFields.length < 4 ? "pending" : "missing",
        pendingFields,
      };
    }

    return application.internship
      ? { status: "complete", pendingFields: [] }
      : { status: "missing", pendingFields: ["Internship Details"] };
  }, []);

  // Joining report status check
  const isJoiningLetterUploaded = currentInternship?.joiningLetterUrl;

  // Faculty mentor info - use ONLY completedVisitsCount from API
  const facultyMentorInfo = useMemo(() => {
    // Use ONLY counter field from API, default to 0 if not available
    const visitsCount = currentInternship?.completedVisitsCount ?? 0;

    if (mentor) {
      const mentorInfo = {
        name: mentor.name || "Not Assigned",
        email: mentor.email || null,
        contact: mentor.phoneNo || mentor.contact || null,
        designation: mentor.designation || "Faculty Mentor",
        visits: visitsCount,
      };
      return mentorInfo;
    }

    if (!currentInternship) {
      return { name: "Not Assigned", email: null, contact: null, visits: 0 };
    }

    if (currentInternship.isSelfIdentified) {
      const mentorInfo = {
        name: currentInternship.facultyMentorName || "Not Provided",
        email: currentInternship.facultyMentorEmail || null,
        contact: currentInternship.facultyMentorContact || null,
        designation: currentInternship.facultyMentorDesignation || "N/A",
        visits: visitsCount,
      };
      return mentorInfo;
    }

    if (currentInternship.mentor) {
      const mentorInfo = {
        name: currentInternship.mentor.name || "Not Assigned",
        email: currentInternship.mentor.email || null,
        contact: currentInternship.mentor.contact || null,
        designation: currentInternship.mentor.designation || "Faculty Mentor",
        visits: visitsCount,
      };
      return mentorInfo;
    }

    return { name: "Not Assigned", email: null, contact: null, visits: 0 };
  }, [mentor, currentInternship]);

  // Industry supervisor info
  const industrySupervisorInfo = useMemo(() => {
    if (!currentInternship) {
      return {
        name: "Not Assigned",
        contact: "N/A",
        email: "N/A",
        designation: "N/A",
      };
    }

    if (currentInternship.isSelfIdentified) {
      const supervisorInfo = {
        name:
          currentInternship.hrName ||
          currentInternship.industrySupervisorName ||
          currentInternship.supervisorName ||
          "Not Provided",
        contact:
          currentInternship.hrContact ||
          currentInternship.hrPhone ||
          currentInternship.industrySupervisorContact ||
          currentInternship.supervisorContact ||
          currentInternship.industrySupervisorPhone ||
          "N/A",
        email:
          currentInternship.hrEmail ||
          currentInternship.industrySupervisorEmail ||
          currentInternship.supervisorEmail ||
          "N/A",
        designation:
          currentInternship.hrDesignation ||
          currentInternship.industrySupervisorDesignation ||
          currentInternship.supervisorDesignation ||
          "N/A",
        company: currentInternship.companyName || "N/A",
      };

      return supervisorInfo;
    }

    const industryData = currentInternship.internship?.industry;

    const supervisorInfo = {
      name:
        industryData?.primaryContactName ||
        industryData?.hrName ||
        industryData?.industrySupervisorName ||
        industryData?.companyName ||
        "Not Provided",
      contact:
        industryData?.primaryPhone ||
        industryData?.contactPhone ||
        industryData?.hrPhone ||
        industryData?.phone ||
        "N/A",
      email:
        industryData?.primaryEmail ||
        industryData?.contactEmail ||
        industryData?.hrEmail ||
        industryData?.email ||
        "N/A",
      designation:
        industryData?.hrDesignation || industryData?.designation || "N/A",
      company: industryData?.companyName || "N/A",
    };

    return supervisorInfo;
  }, [currentInternship]);

  // Company name for display
  const companyName = currentInternship?.companyName ||
    currentInternship?.internship?.industry?.companyName ||
    "N/A";

  // Internship title
  const internshipTitle = currentInternship?.isSelfIdentified
    ? currentInternship.jobProfile
    : currentInternship?.internship?.title || "";

  // Handle joining report upload
  const handleJoiningLetterUpload = async (file) => {
    if (!currentInternship?.id) {
      toast.error("No active internship found");
      return false;
    }

    // Backend only accepts PDF files
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return false;
    }

    // Backend has 5MB limit
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must be less than 5MB");
      return false;
    }

    setUploading(true);
    try {
      await studentService.uploadJoiningLetter(currentInternship.id, file);
      toast.success("Joining report uploaded successfully");
      setUploadModalVisible(false);
      refresh();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to upload joining report"
      );
    } finally {
      setUploading(false);
    }
    return false;
  };

  // Navigation handlers
  // const handleNavigateToGrievances = useCallback(() => navigate('/grievances'), [navigate]);
  const handleNavigateToReports = useCallback(
    () => navigate("/app/reports/submit"),
    [navigate]
  );
  const handleViewReports = useCallback(
    () => setReportViewModalVisible(true),
    []
  );
  const handleViewJoiningLetter = useCallback(() => {
    if (currentInternship?.joiningLetterUrl) {
      openFileWithPresignedUrl(currentInternship.joiningLetterUrl);
    }
  }, [currentInternship?.joiningLetterUrl]);

  // Handle viewing monthly report
  const handleViewReport = useCallback((reportUrl) => {
    if (reportUrl) {
      openFileWithPresignedUrl(reportUrl);
    } else {
      toast.error("Report file not available");
    }
  }, []);

  // Handle downloading monthly report
  const handleDownloadReport = useCallback(async (reportUrl, reportLabel) => {
    if (!reportUrl) {
      toast.error("Report file not available");
      return;
    }
    
    try {
      // Fetch the file as a blob
      const response = await fetch(reportUrl);
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Monthly_Report_${reportLabel.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error('Download error:', error);
      toast.error("Failed to download report");
    }
  }, []);

  // Report status color
  const getReportStatusColor = (status) => {
    const statusMap = {
      DRAFT: "default",
      SUBMITTED: "blue",
      UNDER_REVIEW: "gold",
      APPROVED: "success",
      REJECTED: "error",
      REVISION_REQUIRED: "warning",
    };
    return statusMap[status] || "default";
  };

  // Report period label
  const getReportPeriodLabel = (report) => {
    if (!report) return "Unknown period";
    if (report.monthName && report.reportYear)
      return `${report.monthName} ${report.reportYear}`;
    const monthValue =
      typeof report.reportMonth === "number"
        ? report.reportMonth
        : parseInt(report.reportMonth, 10);
    if (!Number.isNaN(monthValue) && report.reportYear) {
      const date = new Date(report.reportYear, Math.max(0, monthValue - 1), 1);
      return `${date.toLocaleString("default", { month: "long" })} ${
        report.reportYear
      }`;
    }
    return "Unknown period";
  };

  if (error) {
    return (
      <div className="p-4">
        <Alert
          type="error"
          message="Error loading dashboard"
          description={error}
          showIcon
          action={
            <Button onClick={refresh} type="link" size="small">
              Try Again
            </Button>
          }
        />
      </div>
    );
  }

  const internshipDataStatus = getInternshipDataStatus(currentInternship);

  return (
    <Spin spinning={isLoading} tip="Loading...">
      <div 
        className="p-4 md:p-5 min-h-screen"
        style={{ backgroundColor: token.colorBgLayout }}
      >
        {isRevalidating && !isLoading && (
          <div 
            className="fixed top-0 left-0 right-0 z-50 px-3 py-1.5 flex items-center justify-center gap-2 text-xs border-b backdrop-blur-sm"
            style={{ 
              backgroundColor: token.colorInfoBg, 
              borderColor: token.colorInfoBorder,
              color: token.colorInfo 
            }}
          >
            <SyncOutlined spin />
            <span>Updating...</span>
          </div>
        )}

        {/* Header Section */}
        <Card 
          className="!mb-4 rounded-xl shadow-sm border"
          style={{ borderColor: token.colorBorderSecondary }}
          styles={{ body: { padding: '24px' } }}
        >
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Title level={3} className="!mb-1">
                Welcome back, {profile?.user.name || "Student"}!
              </Title>
              <Paragraph type="secondary" className="!mb-0 text-sm">
                Here's a snapshot of your internship journey.
              </Paragraph>
            </Col>
            <Col>
              <Space size="middle">
                <div className="md:block hidden space-x-2">
                  <Button
                    icon={<LaptopOutlined />}
                    onClick={() => navigate("/app/my-applications")}
                    className="rounded-lg"
                  >
                    My Applications
                  </Button>
                  <Button
                    type="text"
                    icon={<SyncOutlined spin={isRevalidating} />}
                    onClick={refresh}
                    className="rounded-lg"
                  />
                </div>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Current Internship Status Section */}
        <Card 
          className="!mb-4 rounded-xl shadow-sm border"
          style={{ borderColor: token.colorBorderSecondary }}
        >
          <div className="mb-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
              <div className="flex items-center">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-3" />
                <Title level={4} className="!mb-0">
                  Current Internship Status
                </Title>
              </div>

              {/* Internship selector for multiple internships */}
              {hasActiveInternship && activeInternships.length > 1 && (
                <Select
                  value={selectedInternshipIndex}
                  onChange={(value) => setSelectedInternshipIndex(value)}
                  className="w-full md:w-auto min-w-[200px]"
                  placeholder="Select internship"
                >
                  {activeInternships.map((internship, index) => (
                    <Select.Option key={internship.id} value={index}>
                      <div className="flex flex-col">
                        <Text strong className="text-sm">
                          {internship.isSelfIdentified
                            ? internship.jobProfile
                            : internship.internship?.title}
                        </Text>
                        <Text type="secondary" className="text-xs">
                          {internship.isSelfIdentified
                            ? internship.companyName
                            : internship.internship?.industry?.companyName}
                        </Text>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}

              {/* Show current internship info when only one */}
              {hasActiveInternship && activeInternships.length === 1 && (
                <div className="text-left md:text-right">
                  <Text strong className="text-sm block">
                    {internshipTitle}
                  </Text>
                  <Text type="secondary" className="text-xs">
                    {companyName}
                  </Text>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Text type="secondary" className="text-sm">
                Track your internship progress and submissions
              </Text>
              {activeInternships?.length > 1 && (
                <Tag color="blue" className="!px-2 !py-0.5 w-fit text-xs">
                  {activeInternships.length} active internships
                </Tag>
              )}
            </div>
          </div>

          {hasActiveInternship ? (
            <Row gutter={[16, 16]}>
              {/* Internship Data Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<CheckCircleOutlined />}
                  iconBgColor={
                    internshipDataStatus.status === "complete"
                      ? token.colorSuccessBg
                      : internshipDataStatus.status === "pending"
                      ? token.colorWarningBg
                      : token.colorErrorBg
                  }
                  iconColor={
                    internshipDataStatus.status === "complete"
                      ? token.colorSuccess
                      : internshipDataStatus.status === "pending"
                      ? token.colorWarning
                      : token.colorError
                  }
                  title="Internship Data"
                  statusTag={internshipDataStatus.status.toUpperCase()}
                  statusColor={
                    internshipDataStatus.status === "complete"
                      ? "success"
                      : internshipDataStatus.status === "pending"
                      ? "warning"
                      : "error"
                  }
                  showViewAction={internshipDataStatus.pendingFields.length > 0}
                  onViewAction={() => setPendingFieldsModalVisible(true)}
                />
              </Col>

              {/* Joining report Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<FileTextOutlined />}
                  iconBgColor={isJoiningLetterUploaded ? token.colorSuccessBg : token.colorWarningBg}
                  iconColor={isJoiningLetterUploaded ? token.colorSuccess : token.colorWarning}
                  title="Joining report"
                  statusTag={isJoiningLetterUploaded ? "UPLOADED" : "PENDING"}
                  statusColor={isJoiningLetterUploaded ? "success" : "warning"}
                  showViewAction={isJoiningLetterUploaded}
                  onViewAction={handleViewJoiningLetter}
                  showAddAction={true}
                  onAddAction={() => setUploadModalVisible(true)}
                />
              </Col>

              {/* Grievances Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<FireOutlined />}
                  iconBgColor={token.colorErrorBg}
                  iconColor={token.colorError}
                  title="Grievances"
                  value={grievancesList.length}
                  statusTag={
                    openGrievances === 0 ? "No open" : `${openGrievances} open`
                  }
                  statusColor={openGrievances === 0 ? "success" : "warning"}
                  // onClick={handleNavigateToGrievances}
                />
              </Col>

              {/* Monthly Reports Status */}
              <Col xs={24} sm={12} md={12} lg={6}>
                <StatusCard
                  icon={<BookOutlined />}
                  iconBgColor={
                    monthlyReportStatus.startDateInfo
                      ? token.colorInfoBg
                      : monthlyReportStatus.overdue.length > 0
                      ? token.colorErrorBg
                      : monthlyReportStatus.pendingCount > 0
                      ? token.colorWarningBg
                      : token.colorSuccessBg
                  }
                  iconColor={
                    monthlyReportStatus.startDateInfo
                      ? token.colorInfo
                      : monthlyReportStatus.overdue.length > 0
                      ? token.colorError
                      : monthlyReportStatus.pendingCount > 0
                      ? token.colorWarning
                      : token.colorSuccess
                  }
                  title="Monthly Reports"
                  value={monthlyReportStatus.submitted}
                  secondaryValue={monthlyReportStatus.total}
                  statusTag={
                    monthlyReportStatus.startDateInfo
                      ? `Starts: ${monthlyReportStatus.startDateInfo.dateStr}`
                      : monthlyReportStatus.overdue.length > 0
                      ? `${monthlyReportStatus.overdue.length} overdue`
                      : monthlyReportStatus.pendingCount > 0
                      ? `${monthlyReportStatus.pendingCount} due`
                      : monthlyReportStatus.submitted >= monthlyReportStatus.total && monthlyReportStatus.total > 0
                      ? "All submitted"
                      : monthlyReportStatus.nextDueInfo
                      ? `Next: ${monthlyReportStatus.nextDueInfo.monthName}`
                      : "Up to date"
                  }
                  statusColor={
                    monthlyReportStatus.startDateInfo
                      ? "blue"
                      : monthlyReportStatus.overdue.length > 0
                      ? "error"
                      : monthlyReportStatus.pendingCount > 0
                      ? "warning"
                      : "success"
                  }
                  pendingItems={monthlyReportStatus.pending}
                  showViewAction={monthlyReportStatus.submitted > 0}
                  onViewAction={handleViewReports}
                  showDownloadAction={true}
                  onDownloadAction={() => {
                    const link = document.createElement('a');
                    link.href = '/Monthly_report.pdf';
                    link.download = 'Monthly_report.pdf';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Monthly report format downloaded');
                  }}
                  showAddAction={hasInternshipStarted}
                  onAddAction={handleNavigateToReports}
                  subtitle={
                    monthlyReportStatus.startDateInfo?.message ||
                    (monthlyReportStatus.pendingCount === 0 && monthlyReportStatus.nextDueInfo
                      ? `Due after ${monthlyReportStatus.nextDueInfo.monthName} ends`
                      : null)
                  }
                />
              </Col>
            </Row>
          ) : (
            <Card
              className="rounded-xl border shadow-sm"
              style={{ borderColor: token.colorBorderSecondary }}
              styles={{ body: { padding: "32px" } }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="text-center">
                    <Text className="text-sm block mb-1" style={{ color: token.colorTextSecondary }}>
                      No active internship
                    </Text>
                    <Text className="text-xs" style={{ color: token.colorTextTertiary }}>
                      Apply for internships to get started
                    </Text>
                  </div>
                }
              >
                <Button
                  type="primary"
                  onClick={() => navigate("/app/internships")}
                  className="rounded-lg"
                >
                  Add Internships
                </Button>
              </Empty>
            </Card>
          )}
        </Card>

        {/* Faculty Mentor & Industry Supervisor */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <FacultyMentorCard
              mentor={facultyMentorInfo}
              visitCount={facultyMentorInfo.visits}
            />
          </Col>
          <Col xs={24} md={12}>
            <IndustrySupervisorCard supervisor={industrySupervisorInfo} />
          </Col>
        </Row>

        {/* Upload Joining report Modal */}
        <Modal
          title="Upload Joining Report"
          open={uploadModalVisible}
          onCancel={() => setUploadModalVisible(false)}
          footer={null}
          width={400}
          className="rounded-xl"
        >
          <div className="py-4">
            <Upload.Dragger
              name="joiningLetter"
              accept=".pdf"
              beforeUpload={handleJoiningLetterUpload}
              showUploadList={false}
              disabled={uploading}
              style={{
                background: token.colorBgContainer,
                borderColor: token.colorBorder
              }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-3xl" style={{ color: token.colorPrimary }} />
              </p>
              <p className="ant-upload-text text-sm font-medium" style={{ color: token.colorText }}>
                Click or drag file to upload
              </p>
              <p className="ant-upload-hint text-xs" style={{ color: token.colorTextTertiary }}>
                PDF files only (Max 5MB)
              </p>
            </Upload.Dragger>
            {uploading && (
              <div className="mt-3 text-center">
                <Spin size="small" />
                <Text className="ml-2 text-xs" style={{ color: token.colorTextSecondary }}>
                  Uploading...
                </Text>
              </div>
            )}
          </div>
        </Modal>

        {/* View Monthly Reports Modal */}
        <Modal
          title="Monthly Reports"
          open={reportViewModalVisible}
          onCancel={() => setReportViewModalVisible(false)}
          footer={null}
          width={600}
          className="rounded-xl"
        >
          <div className="py-2">
            {currentInternshipReports.length > 0 ? (
              <List
                dataSource={currentInternshipReports}
                renderItem={(report) => {
                  const reportUrl = report.reportFileUrl || report.fileUrl;
                  const isSubmitted = report.status && report.status !== 'DRAFT';
                  const canDownload = reportUrl && isSubmitted;
                  
                  return (
                    <List.Item
                      className="!px-0"
                      actions={[
                        <Tag
                          key="status"
                          color={getReportStatusColor(report.status)}
                        >
                          {report.status}
                        </Tag>,
                        canDownload && (
                          <Tooltip title="View Report" key="view">
                            <Button
                              type="text"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => handleViewReport(reportUrl)}
                            />
                          </Tooltip>
                        ),
                        canDownload && (
                          <Tooltip title="Download Report" key="download">
                            <Button
                              type="text"
                              size="small"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownloadReport(reportUrl, getReportPeriodLabel(report))}
                            />
                          </Tooltip>
                        ),
                      ].filter(Boolean)}
                    >
                    <List.Item.Meta
                      avatar={
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: token.colorInfoBg }}
                        >
                          <FileTextOutlined style={{ color: token.colorInfo }} />
                        </div>
                      }
                      title={<Text strong>{getReportPeriodLabel(report)}</Text>}
                      description={
                        <Text type="secondary" className="text-xs">
                          Submitted:{" "}
                          {report.submittedAt
                            ? dayjs(report.submittedAt).format("MMM D, YYYY")
                            : "N/A"}
                        </Text>
                      }
                    />
                  </List.Item>
                  );
                }}
              />
            ) : (
              <Empty
                description="No reports submitted yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </div>
        </Modal>

        {/* Pending Fields Modal */}
        <Modal
          title="Pending Internship Data"
          open={pendingFieldsModalVisible}
          onCancel={() => setPendingFieldsModalVisible(false)}
          footer={[
            <Button
              key="close"
              onClick={() => setPendingFieldsModalVisible(false)}
            >
              Close
            </Button>,
            <Button
              key="view"
              type="primary"
              onClick={() => {
                setPendingFieldsModalVisible(false);
                navigate("/app/my-applications");
              }}
            >
              View Details
            </Button>,
          ]}
          width={400}
          className="rounded-xl"
        >
          <div className="py-2">
            <Text className="block mb-3">
              The following fields need to be completed for your internship:
            </Text>
            <List
              size="small"
              dataSource={internshipDataStatus.pendingFields}
              renderItem={(field) => (
                <List.Item className="!py-2">
                  <div className="flex items-center gap-2">
                    <ExclamationCircleOutlined className="text-warning" />
                    <Text>{field}</Text>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </Modal>

        {/* Placement Interest Form Modal - shown until form is filled */}
        <PlacementInterestModal
          open={placementInterestModalVisible}
          onClose={() => setPlacementInterestModalVisible(false)}
          onSuccess={() => {
            setPlacementInterestModalVisible(false);
            setPlacementInterestChecked(true);
          }}
          closable={false}
        />
      </div>
    </Spin>
  );
};

StudentDashboard.displayName = "StudentDashboard";

export default memo(StudentDashboard);
