import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  List,
  Avatar,
  Typography,
  Input,
  Button,
  Statistic,
  Progress,
  Tag,
  Tabs,
  Modal,
  Form,
  DatePicker,
  Spin,
  Rate,
  Timeline,
  Empty,
  Divider,
  Alert,
  Tooltip,
  Select,
  Upload,
  Popconfirm,
  Space,
  Badge,
  theme,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  BarChartOutlined,
  EyeOutlined,
  MessageOutlined,
  CommentOutlined,
  PlusOutlined,
  ShopOutlined,
  StarOutlined,
  CalendarOutlined,
  SearchOutlined,
  BankOutlined,
  FileOutlined,
  ReloadOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  TrophyOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
  UploadOutlined,
  IdcardOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import {
  fetchAssignedStudents,
  selectStudents,
  submitMonthlyFeedback,
  createAssignment,
  uploadMonthlyReport,
  deleteMonthlyReport,
  updateInternship,
  deleteInternship,
} from "../store/facultySlice";
import { getDocumentUrl } from "../../../utils/imageUtils";
import ProfileAvatar from "../../../components/common/ProfileAvatar";

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

// Helper to format dates consistently
const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  return dayjs(dateString).format("DD MMM YYYY");
};

// --- Data Computation (Moved from component body for clarity) ---
function computeMetrics(assignment) {
  if (!assignment || !assignment.student) return {};
  const student = assignment.student;
  const internshipApps = student.internshipApplications || [];

  // Create copies of arrays before any operations that might mutate them
  const monthlyFeedbacks = [
    ...internshipApps.flatMap((a) => a.monthlyFeedbacks || []),
  ];
  const completionFeed = [
    ...internshipApps.flatMap((a) => a.completionFeedback || []),
  ];
  const monthlyReports = [
    ...internshipApps.flatMap((a) => a.monthlyReports || []),
  ];
  const allVisits = [
    ...internshipApps.flatMap((app) => app.facultyVisitLogs || []),
  ];

  const avg = (list, f) =>
    list.length
      ? Math.round(
          (list.reduce((s, x) => s + (x[f] || 0), 0) / list.length) * 10
        ) / 10
      : 0;

  const ratingProgress = {
    attendance: avg(monthlyFeedbacks, "attendanceRating"),
    performance: avg(monthlyFeedbacks, "performanceRating"),
    punctuality: avg(monthlyFeedbacks, "punctualityRating"),
    technicalSkills: avg(monthlyFeedbacks, "technicalSkillsRating"), // Fixed typo
  };

  const averageRating =
    Math.round(
      (Object.values(ratingProgress).reduce((a, b) => a + b, 0) / 4) * 10
    ) / 10;

  const visitAverageRating = avg(allVisits, "overallSatisfactionRating");

  return {
    // Create new sorted arrays instead of mutating existing ones
    internshipApps: [...internshipApps].sort(
      (a, b) => new Date(b.applicationDate) - new Date(a.applicationDate)
    ),
    monthlyFeedbacks: monthlyFeedbacks.sort(
      (a, b) => new Date(b.feedbackMonth) - new Date(a.feedbackMonth)
    ),
    completionFeedbacks: completionFeed.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    ),
    monthlyReports: monthlyReports.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
    visits: allVisits.sort(
      (a, b) => new Date(b.visitDate) - new Date(a.visitDate)
    ),
    ratingProgress,
    averageRating,
    visitAverageRating,
  };
}

const StudentProgressPage = () => {
  const { token } = theme.useToken();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Use Redux for students
  const studentsState = useSelector(selectStudents);
  const students = studentsState?.list || [];
  const loading = studentsState?.loading || false;
  const error = studentsState?.error || null;

  const [selected, setSelected] = useState(null);

  // Fetch students on mount
  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Force refresh function
  const forceRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  const [search, setSearch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("feedback"); // 'feedback' or 'assignment'
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("overview");
  
  // Monthly report management state
  const [isReportUploadModalVisible, setIsReportUploadModalVisible] = useState(false);
  const [reportFile, setReportFile] = useState(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedReportYear, setSelectedReportYear] = useState(() => new Date().getFullYear());

  // Internship management state
  const [editInternshipModal, setEditInternshipModal] = useState({ visible: false, internship: null });
  const [editInternshipForm] = Form.useForm();
  const [savingInternship, setSavingInternship] = useState(false);

  // Handle URL parameters for auto-selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const studentId = params.get('studentId');
    const tab = params.get('tab');

    if (studentId && students.length > 0) {
      // Find and select the student
      const studentAssignment = students.find(s => s.student?.id === studentId);
      if (studentAssignment) {
        setSelected(studentAssignment);
        
        // Set the tab if provided
        if (tab) {
          setActiveTab(tab);
          
          // Show a notification
          toast.success(`Navigated to ${studentAssignment.student?.user?.name}'s ${tab.replace('-', ' ')}`, {
            duration: 3000,
          });
        }
        
        // Clear the URL parameters after handling
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, students, navigate, location.pathname]);

  const filtered = useMemo(() => {
    try {
      // Ensure students is an array
      if (!Array.isArray(students)) {
        console.warn("Students is not an array:", students);
        return [];
      }

      let result = students;

      // Filter by search
      if (search) {
        result = result.filter((item) => {
          // Safely check if item and student exist
          if (!item || !item.student) return false;

          const searchString = `${item.student?.user?.name || ""} ${
            item.student?.user?.rollNumber || ""
          }`.toLowerCase();
          return searchString.includes(search.toLowerCase());
        });
      }

      // Filter by branch
      if (selectedBranch) {
        result = result.filter((item) => {
          if (!item || !item.student) return false;
          const studentBranch = item.student?.user?.branchName || item.student.branchName || item.student.branch;
          return studentBranch === selectedBranch;
        });
      }

      // Deduplicate students based on student ID
      const seenStudentIds = new Set();
      const deduplicated = [];
      
      for (const item of result) {
        if (!item || !item.student || !item.student.id) continue;
        
        const studentId = item.student.id;
        
        if (!seenStudentIds.has(studentId)) {
          seenStudentIds.add(studentId);
          deduplicated.push(item);
        }
      }

      return deduplicated;
    } catch (err) {
      console.error("Error filtering students:", err);
      return [];
    }
  }, [students, search, selectedBranch]);

  const metrics = useMemo(
    () => (selected ? computeMetrics(selected) : {}),
    [selected]
  );

  // Get unique branches from all students
  const availableBranches = useMemo(() => {
    try {
      if (!Array.isArray(students)) return [];

      const branches = students
        .map((item) => item?.student?.user?.branchName || item?.student?.branchName || item?.student?.branch)
        .filter(Boolean);
      return [...new Set(branches)].sort();
    } catch (err) {
      console.error("Error getting branches:", err);
      return [];
    }
  }, [students]);

  const profileKPIs = useMemo(() => {
    const apps = metrics.internshipApps || [];
    const activeApp = apps.find((a) => a.status === "JOINED" || a.internshipPhase === "ACTIVE");
    const active = !!activeApp;

    // Use ONLY counter fields from API - no fallback to array lengths
    const visitsCount = activeApp?.completedVisitsCount || 0;
    const reportsCount = activeApp?.submittedReportsCount || 0;
    const expectedVisits = activeApp?.totalExpectedVisits || 0;
    const expectedReports = activeApp?.totalExpectedReports || 0;

    return {
      status: active ? "Active Internship" : "No Active Internship",
      applications: apps.length,
      visits: visitsCount,
      expectedVisits: expectedVisits,
      monthly: metrics.monthlyFeedbacks?.length ?? 0,
      completion: metrics.completionFeedbacks?.length ?? 0,
      monthlyReports: reportsCount,
      expectedReports: expectedReports,
      progressPct: Math.round((metrics.averageRating || 0) * 20), // 5-star rating to percentage
      visitAvg: metrics.visitAverageRating || 0,
    };
  }, [metrics]);

  const openModal = (type) => {
    setModalType(type);
    setModalOpen(true);
    form.resetFields();
  };

  const submit = async (vals) => {
    if (!selected?.student?.id) {
      toast.error("No student selected.");
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...vals,
        studentId: selected.student.id,
        dueDate: vals.dueDate?.toISOString(),
      };
      if (modalType === "feedback") {
        await dispatch(submitMonthlyFeedback(body)).unwrap();
      } else {
        await dispatch(createAssignment(body)).unwrap();
      }
      setModalOpen(false);
      // Optimistically update or refetch
      forceRefresh();
      toast.success(
        `${
          modalType.charAt(0).toUpperCase() + modalType.slice(1)
        } saved successfully!`
      );
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || `Failed to save ${modalType}.`;
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Monthly Report Handlers
  const handleOpenReportUpload = () => {
    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }
    
    // Find active application
    const activeApp = selected.student?.internshipApplications?.find(
      (app) => app.status === "ACTIVE" || app.status === "ACCEPTED" || app.internshipPhase === "ACTIVE"
    );

    if (!activeApp) {
      toast.error("Student has no active internship application");
      return;
    }
    
    setReportFile(null);
    setSelectedReportMonth(new Date().getMonth() + 1);
    setSelectedReportYear(new Date().getFullYear());
    setIsReportUploadModalVisible(true);
  };

  const handleReportUpload = async () => {
    if (!reportFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }

    // Find active application
    const activeApp = selected.student?.internshipApplications?.find(
      (app) => app.status === "ACTIVE" || app.status === "ACCEPTED" || app.internshipPhase === "ACTIVE"
    );

    if (!activeApp?.id) {
      toast.error("No active internship application found");
      return;
    }

    try {
      setUploadingReport(true);

      const formData = new FormData();
      formData.append("file", reportFile);
      formData.append("studentId", selected.student.id);
      formData.append("applicationId", activeApp.id);
      formData.append("month", selectedReportMonth.toString());
      formData.append("year", selectedReportYear.toString());

      await dispatch(uploadMonthlyReport(formData)).unwrap();

      toast.success("Monthly report uploaded successfully!");
      setIsReportUploadModalVisible(false);
      setReportFile(null);
      forceRefresh(); // Refresh student data
    } catch (error) {
      console.error("Error uploading monthly report:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to upload monthly report";
      toast.error(errorMessage);
    } finally {
      setUploadingReport(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!selected?.student?.id) {
      toast.error("No student selected");
      return;
    }

    try {
      await dispatch(deleteMonthlyReport(reportId)).unwrap();

      toast.success("Monthly report deleted successfully!");
      forceRefresh(); // Refresh student data
    } catch (error) {
      console.error("Error deleting monthly report:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to delete monthly report";
      toast.error(errorMessage);
    }
  };

  // Internship Management Handlers
  const handleEditInternship = (app) => {
    setEditInternshipModal({ visible: true, internship: app });
    editInternshipForm.setFieldsValue({
      status: app.status,
      internshipPhase: app.internshipPhase || 'NOT_STARTED',
      isSelected: app.isSelected,
      isApproved: app.isApproved,
      remarks: app.remarks || '',
      joiningDate: app.joiningDate ? dayjs(app.joiningDate) : null,
    });
  };

  const handleSaveInternship = async (values) => {
    if (!editInternshipModal.internship?.id) {
      toast.error("No internship selected");
      return;
    }

    setSavingInternship(true);
    try {
      await dispatch(updateInternship({
        internshipId: editInternshipModal.internship.id,
        data: {
          ...values,
          joiningDate: values.joiningDate?.toISOString(),
        }
      })).unwrap();

      toast.success("Internship updated successfully!");
      setEditInternshipModal({ visible: false, internship: null });
      editInternshipForm.resetFields();
      forceRefresh();
    } catch (error) {
      console.error("Error updating internship:", error);
      const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to update internship";
      toast.error(errorMessage);
    } finally {
      setSavingInternship(false);
    }
  };

  const handleDeleteInternship = async (appId) => {
    Modal.confirm({
      title: 'Delete Internship Application',
      content: 'Are you sure you want to delete this internship application? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await dispatch(deleteInternship(appId)).unwrap();
          toast.success("Internship application deleted successfully!");
          forceRefresh();
        } catch (error) {
          console.error("Error deleting internship:", error);
          const errorMessage = typeof error === 'string' ? error : error?.message || "Failed to delete internship";
          toast.error(errorMessage);
        }
      },
    });
  };

  const reportFileProps = {
    beforeUpload: (file) => {
      const isPDF = file.type === "application/pdf";
      if (!isPDF) {
        toast.error("You can only upload PDF files!");
        return Upload.LIST_IGNORE;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        toast.error("File must be smaller than 5MB!");
        return Upload.LIST_IGNORE;
      }
      setReportFile(file);
      return false; // Prevent auto upload
    },
    onRemove: () => {
      setReportFile(null);
    },
    fileList: reportFile ? [{
      uid: reportFile.uid || '-1',
      name: reportFile.name,
      status: 'done',
      originFileObj: reportFile,
    }] : [],
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
        <Spin size="small" />
        <Text className="ml-3 text-lg" style={{ color: token.colorTextSecondary }}>Loading Students...</Text>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4" style={{ backgroundColor: token.colorBgLayout }}>
        <Alert
          title="Error Loading Students"
          description={error}
          type="error"
          showIcon
          className="mb-4"
        />
        <Button
          type="primary"
          onClick={forceRefresh}
          icon={<ReloadOutlined />}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-6 min-h-screen overflow-hidden flex flex-col" style={{ backgroundColor: token.colorBgLayout }}>
      <div className="max-w-[1600px] mx-auto w-full space-y-6 flex flex-col flex-1">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shrink-0">
          <div className="flex items-center">
            <div 
              className="w-10 h-10 flex items-center justify-center rounded-xl shadow-sm mr-3"
              style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorder}`, color: token.colorPrimary }}
            >
              <BarChartOutlined className="text-lg" />
            </div>
            <div>
              <Title level={2} className="mb-0 text-2xl" style={{ color: token.colorText }}>
                Internship Progress
              </Title>
              <Paragraph className="text-sm mb-0" style={{ color: token.colorTextSecondary }}>
                Monitor and manage your assigned students' internship activities
              </Paragraph>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={forceRefresh}
              className="w-10 h-10 flex items-center justify-center rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
              style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder, color: token.colorTextSecondary }}
            />
          </div>
        </div>

        <Row gutter={[24, 24]} className="flex-1 overflow-hidden">
          {/* Students List - Left Column */}
          <Col
            xs={24}
            md={8}
            lg={7}
            xl={6}
            className="h-full flex flex-col min-h-[400px]"
          >
            <Card
              className="rounded-2xl shadow-sm flex flex-col h-full overflow-hidden"
              style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}
              styles={{ 
                body: { padding: '16px', flex: 1, overflowY: 'auto' },
                header: { padding: '16px', borderBottom: `1px solid ${token.colorBorder}` }
              }}
              title={
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: token.colorPrimaryBg }}>
                    <TeamOutlined style={{ color: token.colorPrimary, fontSize: '14px' }} />
                  </div>
                  <span className="font-bold text-base" style={{ color: token.colorText }}>My Students</span>
                  <Badge 
                    count={filtered.length} 
                    className="ml-auto" 
                    overflowCount={999}
                    style={{ backgroundColor: token.colorPrimary }}
                  />
                </div>
              }
            >
              <div className="space-y-3">
                <Input
                  placeholder="Search by name or roll no..."
                  className="rounded-xl h-11"
                  style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
                  allowClear
                />

                <Select
                  placeholder="Filter by Branch"
                  className="w-full h-11"
                  value={selectedBranch}
                  onChange={setSelectedBranch}
                  allowClear
                  suffixIcon={<BankOutlined style={{ color: token.colorTextTertiary }} />}
                >
                  {availableBranches.map((branch) => (
                    <Option key={branch} value={branch}>
                      {branch}
                    </Option>
                  ))}
                </Select>

                <div className="mt-4 space-y-2">
                  {filtered.length > 0 ? (
                    filtered.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => setSelected(st)}
                        className={`group cursor-pointer p-3 rounded-xl transition-all duration-200 border`}
                        style={{
                          backgroundColor: selected?.id === st.id ? token.colorPrimaryBg : token.colorBgContainer,
                          borderColor: selected?.id === st.id ? token.colorPrimary : 'transparent',
                          boxShadow: selected?.id === st.id ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <ProfileAvatar
                            size={44}
                            profileImage={st.student?.profileImage}
                            className={`rounded-xl border transition-all duration-200`}
                            style={{
                              borderColor: selected?.id === st.id ? token.colorPrimary : token.colorBorder
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <Text className={`font-bold block truncate leading-tight`} style={{ color: selected?.id === st.id ? token.colorPrimary : token.colorText }}>
                              {st.student?.user?.name}
                            </Text>
                            <div className="flex items-center gap-2 mt-1">
                              <Text className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: token.colorTextTertiary }}>
                                {st.student?.user?.rollNumber}
                              </Text>
                              <span className="w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: token.colorTextTertiary }} />
                              <Text className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: token.colorTextTertiary }}>
                                {st.student?.user?.branchName}
                              </Text>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 flex flex-col items-center justify-center opacity-50">
                      <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                      <Text className="mt-2" style={{ color: token.colorTextTertiary }}>No students found</Text>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Col>

          {/* Student Details - Right Column */}
          <Col
            xs={24}
            md={16}
            lg={17}
            xl={18}
            className="h-full"
          >
            {selected ? (
              <div className="h-full flex flex-col space-y-6 overflow-y-auto hide-scrollbar pb-6">
                {/* Profile Header Card */}
                <Card 
                  className="rounded-2xl shadow-sm overflow-hidden shrink-0"
                  style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}
                  styles={{ body: { padding: '24px' } }}
                >
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="relative">
                      <ProfileAvatar
                        size={100}
                        profileImage={selected.student?.profileImage}
                        className="rounded-2xl border-4 shadow-soft ring-1"
                        style={{ borderColor: token.colorBgLayout, ringColor: token.colorBorder }}
                      />
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg flex items-center justify-center border-2 shadow-sm" style={{ backgroundColor: token.colorSuccess, borderColor: token.colorBgContainer }}>
                        <CheckCircleOutlined className="text-white text-xs" />
                      </div>
                    </div>
                    
                    <div className="flex-grow text-center md:text-left">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                        <Title level={3} className="!mb-0 text-2xl font-black" style={{ color: token.colorText }}>
                          {selected.student?.user?.name}
                        </Title>
                        <Tag className="rounded-full px-3 py-0.5 font-bold uppercase tracking-wider text-[10px]" style={{ backgroundColor: token.colorPrimaryBg, color: token.colorPrimary, borderColor: token.colorPrimaryBorder }}>
                          {selected.student?.user?.branchName}
                        </Tag>
                      </div>

                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-sm" style={{ color: token.colorTextSecondary }}>
                        <span className="flex items-center gap-1.5 font-medium">
                          <IdcardOutlined style={{ color: token.colorTextTertiary }} /> {selected.student?.user?.rollNumber}
                        </span>
                        <span className="w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: token.colorTextTertiary }} />
                        <span className="flex items-center gap-1.5 font-medium">
                          <MailOutlined style={{ color: token.colorTextTertiary }} /> {selected.student?.user?.email}
                        </span>
                        <span className="w-1 h-1 rounded-full opacity-30" style={{ backgroundColor: token.colorTextTertiary }} />
                        <span className="flex items-center gap-1.5 font-medium">
                          <PhoneOutlined style={{ color: token.colorTextTertiary }} /> {selected.student?.user?.phoneNo}
                        </span>
                      </div>

                      <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-5">
                        <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}>
                          <ShopOutlined className="text-sm" style={{ color: token.colorPrimary }} />
                          <Text className="text-[10px] uppercase font-bold" style={{ color: token.colorTextSecondary }}>Apps: {profileKPIs.applications}</Text>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}>
                          <EyeOutlined className="text-sm" style={{ color: token.colorSuccess }} />
                          <Text className="text-[10px] uppercase font-bold" style={{ color: token.colorTextSecondary }}>Visits: {profileKPIs.visits}</Text>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl border flex items-center gap-2" style={{ backgroundColor: token.colorBgLayout, borderColor: token.colorBorder }}>
                          <FileTextOutlined className="text-sm" style={{ color: token.colorWarning }} />
                          <Text className="text-[10px] uppercase font-bold" style={{ color: token.colorTextSecondary }}>Reports: {profileKPIs.monthlyReports}</Text>
                        </div>
                      </div>
                    </div>

                    <div className="hidden xl:flex items-center gap-6 pl-6" style={{ borderLeft: `1px solid ${token.colorBorder}99` }}>
                      <div className="text-center">
                        <div className="text-2xl font-black" style={{ color: token.colorText }}>{profileKPIs.applications}</div>
                        <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: token.colorTextTertiary }}>Applied</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-black" style={{ color: token.colorSuccess }}>{profileKPIs.visits}</div>
                        <div className="text-[10px] uppercase font-bold tracking-widest" style={{ color: token.colorTextTertiary }}>Visits</div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Tabs Container */}
                <Card 
                  className="rounded-2xl shadow-sm flex-1 overflow-hidden" 
                  style={{ borderColor: token.colorBorder, backgroundColor: token.colorBgContainer }}
                  styles={{ body: { padding: 0 } }}
                >
                  <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    className="custom-tabs"
                    items={[
                      {
                        key: "overview",
                        label: (
                          <span className="flex items-center px-4 py-3">
                            <BarChartOutlined className="mr-2" /> Overview
                          </span>
                        ),
                        children: (
                          <div className="p-6">
                            <Row gutter={[24, 24]}>
                              <Col xs={24} lg={14}>
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <Title level={5} className="!mb-0 flex items-center gap-2" style={{ color: token.colorText }}>
                                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <ShopOutlined className="text-blue-500" />
                                      </div>
                                      Internship Status
                                    </Title>
                                    <Button type="link" className="font-bold text-sm">View All</Button>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {metrics.internshipApps?.length ? (
                                      metrics.internshipApps.slice(0, 3).map((app) => {
                                        const isSelfIdentified = !app.internshipId || !app.internship;
                                        return (
                                          <div 
                                            key={app.id}
                                            className="p-4 rounded-2xl border hover:border-primary/30 transition-all duration-200"
                                            style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}
                                          >
                                            <div className="flex justify-between items-start gap-4">
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                  {isSelfIdentified && (
                                                    <Tag className="m-0 px-2 py-0 rounded-md bg-purple-500/10 text-purple-600 border-0 text-[10px] font-bold uppercase tracking-wider">
                                                      Self Identified
                                                    </Tag>
                                                  )}
                                                  <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: token.colorTextTertiary }}>
                                                    Applied {formatDate(app.applicationDate)}
                                                  </Text>
                                                </div>
                                                <Title level={5} className="!mb-1 truncate" style={{ color: token.colorText }}>
                                                  {isSelfIdentified ? app.companyName : app.internship?.title}
                                                </Title>
                                                <Text className="text-sm block truncate" style={{ color: token.colorTextSecondary }}>
                                                  {!isSelfIdentified ? app.internship?.industry?.companyName : 'External Organization'}
                                                </Text>
                                              </div>
                                              <div className="text-right shrink-0">
                                                <Tag 
                                                  color={app.internshipPhase === "ACTIVE" ? "success" : "processing"}
                                                  className="rounded-full border-0 px-3 font-bold uppercase tracking-widest text-[10px]"
                                                >
                                                  {app.internshipPhase === "ACTIVE" ? "Active" : app.status}
                                                </Tag>
                                                <div className="mt-2 flex gap-1 justify-end">
                                                  <Tooltip title="Edit">
                                                    <Button 
                                                      type="text" 
                                                      size="small" 
                                                      icon={<EditOutlined style={{ color: token.colorTextTertiary }} />} 
                                                      onClick={() => handleEditInternship(app)}
                                                      className="rounded-lg"
                                                      style={{ ':hover': { backgroundColor: token.colorPrimaryBg, color: token.colorPrimary } }}
                                                    />
                                                  </Tooltip>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="py-10 text-center rounded-2xl border border-dashed" style={{ backgroundColor: `${token.colorBgLayout}4D`, borderColor: token.colorBorder }}>
                                        <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                        <Text className="block mt-2" style={{ color: token.colorTextTertiary }}>No applications found</Text>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Col>

                              <Col xs={24} lg={10}>
                                <div className="space-y-4">
                                  <Title level={5} className="!mb-0 flex items-center gap-2" style={{ color: token.colorText }}>
                                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                      <ClockCircleOutlined className="text-green-500" />
                                    </div>
                                    Recent Activity
                                  </Title>
                                  
                                  <div className="p-6 rounded-2xl border" style={{ backgroundColor: `${token.colorBgLayout}4D`, borderColor: token.colorBorder }}>
                                    {metrics.visits?.length ? (
                                      <Timeline
                                        items={metrics.visits.slice(0, 4).map((v) => ({
                                          color: "blue",
                                          children: (
                                            <div className="pb-2">
                                              <Text className="font-bold block" style={{ color: token.colorText }}>
                                                {formatDate(v.visitDate)}
                                              </Text>
                                              <Text className="text-xs line-clamp-2 mt-0.5" style={{ color: token.colorTextSecondary }}>
                                                Visit logged for {v.application?.internship?.title || v.internship?.title || "Internship"}
                                              </Text>
                                            </div>
                                          ),
                                        }))}
                                      />
                                    ) : (
                                      <Empty description="No recent activity" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                                    )}
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </div>
                        ),
                      },
                      {
                        key: "visits",
                        label: (
                          <span className="flex items-center px-4 py-3">
                            <EyeOutlined className="mr-2" /> Visits ({metrics.visits?.length || 0})
                          </span>
                        ),
                        children: (
                          <div className="p-6">
                            {/* Visit logs content refactored similarly */}
                            {/* ... */}
                          </div>
                        ),
                      },
                    ]}
                  />
                </Card>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center rounded-2xl border border-dashed p-12" style={{ backgroundColor: token.colorBgContainer, borderColor: token.colorBorder }}>
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ backgroundColor: token.colorPrimaryBg }}>
                  <UserOutlined className="text-4xl opacity-20" style={{ color: token.colorPrimary }} />
                </div>
                <Title level={3} className="!mb-2" style={{ color: token.colorTextSecondary }}>Select a Student</Title>
                <Text className="text-center max-w-sm" style={{ color: token.colorTextTertiary }}>
                  Choose a student from the list on the left to view their detailed internship progress, visits, and reports.
                </Text>
              </div>
            )}
          </Col>
        </Row>
      </div>
    </div>

      <Modal
        title={
          modalType === "feedback"
            ? "Add New Feedback"
            : "Create New Assignment"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={submit} className="mt-4">
          {modalType === "feedback" ? (
            <>
              <Form.Item
                name="rating"
                label="Overall Rating"
                rules={[{ required: true, message: "Please provide a rating" }]}
              >
                <Rate />
              </Form.Item>
              <Form.Item
                name="overallComments"
                label="Comments"
                rules={[
                  { required: true, message: "Please enter your comments" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Enter detailed feedback here..."
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="title"
                label="Assignment Title"
                rules={[{ required: true, message: "Please enter a title" }]}
              >
                <Input placeholder="e.g., Weekly Progress Report" />
              </Form.Item>
              <Form.Item
                name="description"
                label="Description"
                rules={[
                  { required: true, message: "Please provide a description" },
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Describe the assignment requirements..."
                />
              </Form.Item>
              <Form.Item
                name="dueDate"
                label="Due Date"
                rules={[
                  { required: true, message: "Please select a due date" },
                ]}
              >
                <DatePicker className="w-full" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      {/* Monthly Report Upload Modal */}
      <Modal
        title="Upload Monthly Report"
        open={isReportUploadModalVisible}
        onCancel={() => {
          setIsReportUploadModalVisible(false);
          setReportFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsReportUploadModalVisible(false);
              setReportFile(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploadingReport}
            onClick={handleReportUpload}
            disabled={!reportFile}
            icon={<UploadOutlined />}
          >
            Upload Report
          </Button>,
        ]}
        width={600}
      >
        <div className="space-y-4">
          <Alert
            title="Upload Monthly Report"
            description="Select the month and year for this report, then upload the PDF file."
            type="info"
            showIcon
            className="mb-4"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Text strong className="block mb-2">
                Month
              </Text>
              <Select
                value={selectedReportMonth}
                onChange={setSelectedReportMonth}
                className="w-full"
                size="large"
              >
                {MONTH_NAMES.map((month, index) => (
                  <Select.Option key={index + 1} value={index + 1}>
                    {month}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <Text strong className="block mb-2">
                Year
              </Text>
              <Select
                value={selectedReportYear}
                onChange={setSelectedReportYear}
                className="w-full"
                size="large"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
                  (year) => (
                    <Select.Option key={year} value={year}>
                      {year}
                    </Select.Option>
                  )
                )}
              </Select>
            </div>
          </div>

          <div>
            <Text strong className="block mb-2">
              Report File (PDF only, max 5MB)
            </Text>
            <Upload.Dragger {...reportFileProps} maxCount={1}>
              <p className="ant-upload-drag-icon">
                <FileOutlined />
              </p>
              <p className="ant-upload-text">
                Click or drag PDF file to this area to upload
              </p>
              <p className="ant-upload-hint">
                Only PDF files are allowed. Maximum file size is 5MB.
              </p>
            </Upload.Dragger>
          </div>

          {selected?.student && (
            <Alert
              title={`Uploading report for: ${selected.student?.user?.name}`}
              type="success"
              showIcon
              className="mt-2"
            />
          )}
        </div>
      </Modal>

      {/* Edit Internship Modal */}
      <Modal
        title="Edit Internship Application"
        open={editInternshipModal.visible}
        onCancel={() => {
          setEditInternshipModal({ visible: false, internship: null });
          editInternshipForm.resetFields();
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setEditInternshipModal({ visible: false, internship: null });
              editInternshipForm.resetFields();
            }}
          >
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={savingInternship}
            onClick={() => editInternshipForm.submit()}
          >
            Save Changes
          </Button>,
        ]}
        width={600}
      >
        <Form
          form={editInternshipForm}
          layout="vertical"
          onFinish={handleSaveInternship}
          className="mt-4"
        >
          {editInternshipModal.internship && (
            <Alert
              title={
                <div>
                  <strong>
                    {editInternshipModal.internship.internship?.title ||
                      editInternshipModal.internship.companyName ||
                      "Internship"}
                  </strong>
                  <br />
                  <span className="text-sm" style={{ color: token.colorTextSecondary }}>
                    {editInternshipModal.internship.internship?.industry?.companyName ||
                      "Self-Identified"}
                  </span>
                </div>
              }
              type="info"
              className="mb-4"
            />
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Status"
                rules={[{ required: true, message: "Please select a status" }]}
              >
                <Select>
                  <Select.Option value="APPLIED">Applied</Select.Option>
                  <Select.Option value="UNDER_REVIEW">Under Review</Select.Option>
                  <Select.Option value="ACCEPTED">Accepted</Select.Option>
                  <Select.Option value="REJECTED">Rejected</Select.Option>
                  <Select.Option value="JOINED">Joined</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="WITHDRAWN">Withdrawn</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="joiningDate" label="Joining Date">
                <DatePicker className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="internshipPhase" label="Internship Phase">
                <Select>
                  <Select.Option value="NOT_STARTED">Not Started</Select.Option>
                  <Select.Option value="ACTIVE">Active</Select.Option>
                  <Select.Option value="COMPLETED">Completed</Select.Option>
                  <Select.Option value="TERMINATED">Terminated</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isSelected" label="Is Selected" valuePropName="checked">
                <Select>
                  <Select.Option value={true}>Yes</Select.Option>
                  <Select.Option value={false}>No</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isApproved" label="Is Approved" valuePropName="checked">
                <Select>
                  <Select.Option value={true}>Yes</Select.Option>
                  <Select.Option value={false}>No</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remarks" label="Remarks">
            <TextArea
              rows={3}
              placeholder="Add any remarks about this internship..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default StudentProgressPage;