import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Typography,
  Spin,
  Row,
  Col,
  Tag,
  Input,
  Select,
  Tabs,
  Empty,
  theme,
  Grid,
  DatePicker,
  Button,
  Progress,
  Tooltip,
  Table,
  message,
  Modal,
  Breadcrumb,
  Alert,
} from "antd";
import { toast } from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  SearchOutlined,
  BankOutlined,
  TeamOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  FolderOutlined,
  SafetyCertificateOutlined,
  DownloadOutlined,
  PieChartOutlined,
  UserOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  ExclamationCircleOutlined,
  LinkOutlined,
  HomeOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileUnknownOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import {
  fetchMonthlyCompliance,
  fetchAvailableComplianceMonths,
  fetchInstitutionComplianceDetails,
  setSelectedComplianceInstitution,
  selectMonthlyComplianceInstitutions,
  selectMonthlyComplianceStateWideSummary,
  selectMonthlyComplianceSelectedInstitutionId,
  selectMonthlyComplianceSelectedDetails,
  selectMonthlyComplianceLoading,
  selectMonthlyComplianceDetailsLoading,
  selectMonthlyComplianceMonth,
  selectMonthlyComplianceYear,
  selectMonthlyComplianceError,
} from "../store/stateSlice";
import { stateService } from "../../../services/state.service";

dayjs.extend(relativeTime);

const { Text } = Typography;
const { useBreakpoint } = Grid;

// File type configurations
const FILE_TYPE_CONFIG = {
  "joining-letters": {
    name: "Joining Report",
    icon: <SafetyCertificateOutlined />,
    color: "#52c41a",
    bgColor: "#f6ffed",
    fileType: "joining-letter",
  },
  "monthly-reports": {
    name: "Monthly Reports",
    icon: <FileTextOutlined />,
    color: "#1890ff",
    bgColor: "#e6f7ff",
    fileType: "monthly-report",
  },
  "visit-logs": {
    name: "Visit Logs",
    icon: <EyeOutlined />,
    color: "#10b981",
    bgColor: "#ecfdf5",
    fileType: "visit-document",
  },
  documents: {
    name: "Documents",
    icon: <FolderOutlined />,
    color: "#722ed1",
    bgColor: "#f9f0ff",
    fileType: "document",
  },
};

const getFileIcon = (type, fileName) => {
  if (type === "JOINING_REPORT") {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) {
      return <FileImageOutlined style={{ color: "#13c2c2", fontSize: 14 }} />;
    }
    return (
      <SafetyCertificateOutlined style={{ color: "#13c2c2", fontSize: 14 }} />
    );
  }
  if (type === "MONTHLY_REPORT")
    return <FileTextOutlined style={{ color: "#1890ff", fontSize: 14 }} />;
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (["pdf"].includes(ext))
    return <FilePdfOutlined style={{ color: "#ff4d4f", fontSize: 14 }} />;
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext))
    return <FileImageOutlined style={{ color: "#722ed1", fontSize: 14 }} />;
  return <FileUnknownOutlined style={{ color: "#8c8c8c", fontSize: 14 }} />;
};

const MonthlyCompliancePage = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const screens = useBreakpoint();

  // Redux state
  const institutions = useSelector(selectMonthlyComplianceInstitutions);
  const stateWideSummary = useSelector(selectMonthlyComplianceStateWideSummary);
  const selectedInstitutionId = useSelector(
    selectMonthlyComplianceSelectedInstitutionId,
  );
  const selectedDetails = useSelector(selectMonthlyComplianceSelectedDetails);
  const loading = useSelector(selectMonthlyComplianceLoading);
  const detailsLoading = useSelector(selectMonthlyComplianceDetailsLoading);
  const currentMonth = useSelector(selectMonthlyComplianceMonth);
  const currentYear = useSelector(selectMonthlyComplianceYear);
  const error = useSelector(selectMonthlyComplianceError);

  // Local state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(() => dayjs());
  const [activeTab, setActiveTab] = useState("overview");

  // Files explorer state
  const [fileTree, setFileTree] = useState(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [fileSearchTerm, setFileSearchTerm] = useState("");
  const [refreshingFile, setRefreshingFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewFileName, setPreviewFileName] = useState("");

  // Load compliance data
  useEffect(() => {
    dispatch(fetchAvailableComplianceMonths());
  }, [dispatch]);

  useEffect(() => {
    if (selectedDate) {
      dispatch(
        fetchMonthlyCompliance({
          month: selectedDate.month() + 1,
          year: selectedDate.year(),
        }),
      );
    }
  }, [dispatch, selectedDate]);

  useEffect(() => {
    if (institutions.length > 0 && !selectedInstitutionId && screens.md) {
      handleInstitutionSelect(institutions[0].institutionId);
    }
  }, [institutions, selectedInstitutionId, screens.md]);

  useEffect(() => {
    if (selectedInstitutionId && activeTab === "files") fetchFileExplorer();
  }, [selectedInstitutionId, activeTab]);

  // Filters
  const filteredInstitutions = useMemo(() => {
    let result = institutions;
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.shortName?.toLowerCase().includes(s) ||
          i.institutionName?.toLowerCase().includes(s) ||
          i.institutionCode?.toLowerCase().includes(s),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((i) => {
        const r = i.overallCompliance;
        if (statusFilter === "excellent") return r >= 90;
        if (statusFilter === "attention") return r >= 50 && r < 90;
        if (statusFilter === "critical") return r < 50;
        return true;
      });
    }
    return result;
  }, [institutions, search, statusFilter]);

  const statusCounts = useMemo(
    () =>
      institutions.reduce(
        (a, i) => {
          const r = i.overallCompliance;
          if (r >= 90) a.excellent++;
          else if (r >= 50) a.attention++;
          else a.critical++;
          return a;
        },
        { excellent: 0, attention: 0, critical: 0 },
      ),
    [institutions],
  );

  // Handlers
  const handleInstitutionSelect = useCallback(
    (id) => {
      dispatch(setSelectedComplianceInstitution(id));
      if (currentMonth && currentYear)
        dispatch(
          fetchInstitutionComplianceDetails({
            institutionId: id,
            month: currentMonth,
            year: currentYear,
          }),
        );
      setFileTree(null);
      setCurrentFolder(null);
      setFileSearchTerm("");
      if (!screens.md)
        setTimeout(
          () =>
            document
              .getElementById("compliance-details")
              ?.scrollIntoView({ behavior: "smooth" }),
          100,
        );
    },
    [dispatch, currentMonth, currentYear, screens.md],
  );

  const handleMonthChange = useCallback(
    (date) => {
      setSelectedDate(date);
      dispatch(setSelectedComplianceInstitution(null));
      setActiveTab("overview");
    },
    [dispatch],
  );

  const handleRefresh = useCallback(() => {
    if (selectedDate) {
      dispatch(
        fetchMonthlyCompliance({
          month: selectedDate.month() + 1,
          year: selectedDate.year(),
          forceRefresh: true,
        }),
      );
      toast.success("Refreshed");
    }
  }, [dispatch, selectedDate]);

  // File explorer
  const fetchFileExplorer = useCallback(
    async (showMsg = false) => {
      if (!selectedInstitutionId) return;
      setFilesLoading(true);
      setFilesError(null);
      try {
        const res = await stateService.getInstitutionFileExplorer(
          selectedInstitutionId,
        );
        if (res.error) throw new Error(res.error);
        setFileTree(res);
        if (showMsg) message.success("Files refreshed");
      } catch (e) {
        setFilesError(e.message || "Failed");
        setFileTree(null);
      } finally {
        setFilesLoading(false);
      }
    },
    [selectedInstitutionId],
  );

  const handleFileAction = useCallback(
    async (file, action = "view") => {
      if (file.downloadUrl) {
        const ext = file.name?.split(".").pop()?.toLowerCase();
        if (
          action === "view" &&
          ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)
        ) {
          setPreviewUrl(file.downloadUrl);
          setPreviewFileName(file.name);
        } else window.open(file.downloadUrl, "_blank");
        return;
      }
      setRefreshingFile(file.id);
      try {
        const cfg = FILE_TYPE_CONFIG[currentFolder];
        if (!cfg) return message.error("Unknown type");
        const res = await stateService.getFilePresignedUrl(
          cfg.fileType,
          file.id,
        );
        if (res.downloadUrl) {
          setFileTree((p) => ({
            ...p,
            folders: p.folders.map((f) =>
              f.type !== currentFolder
                ? f
                : {
                    ...f,
                    files: f.files.map((x) =>
                      x.id === file.id
                        ? { ...x, downloadUrl: res.downloadUrl, urlError: null }
                        : x,
                    ),
                  },
            ),
          }));
          const ext = file.name?.split(".").pop()?.toLowerCase();
          if (
            action === "view" &&
            ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(ext)
          ) {
            setPreviewUrl(res.downloadUrl);
            setPreviewFileName(file.name);
          } else window.open(res.downloadUrl, "_blank");
        } else message.error(res.error || "Failed");
      } catch {
        message.error("Failed");
      } finally {
        setRefreshingFile(null);
      }
    },
    [currentFolder],
  );

  // Helpers
  const getColor = (r) =>
    r >= 90
      ? token.colorSuccess
      : r >= 50
        ? token.colorWarning
        : token.colorError;
  const getTagColor = (r) =>
    r >= 90 ? "success" : r >= 50 ? "warning" : "error";
  const getStudentStatus = (s) =>
    s.reportStatus === "submitted" && s.visitStatus === "completed"
      ? "complete"
      : s.reportStatus === "not_submitted"
        ? "critical"
        : "partial";

  const studentStats = useMemo(
    () =>
      (selectedDetails?.students || []).reduce(
        (a, s) => {
          a[getStudentStatus(s)]++;
          return a;
        },
        { complete: 0, partial: 0, critical: 0 },
      ),
    [selectedDetails],
  );
  const summaryData = useMemo(() => {
    if (!selectedDetails?.summary) return null;
    const s = selectedDetails.summary;
    return {
      reports: {
        expected: s.expectedReports || 0,
        submitted: s.submittedReports || 0,
        rate: s.reportComplianceRate,
      },
      visits: {
        expected: s.expectedVisits || 0,
        completed: s.completedVisits || 0,
        rate: s.visitComplianceRate,
      },
      overall: s.overallCompliance,
      students: s.studentsInTraining || 0,
    };
  }, [selectedDetails]);

  const inst = selectedDetails?.institution;
  const currentFolderData = useMemo(() => {
    if (!fileTree?.folders) return null;
    if (!currentFolder) return null;

    // Define the expected folder types
    const expectedTypes = [
      "documents",
      "visit-logs",
      "monthly-reports",
      "joining-letters",
    ];

    const normalizeType = (folder) => {
      const rawType = (folder.type || "").toString().trim();
      const normalizedType = rawType.toLowerCase().replace(/_/g, "-");
      if (FILE_TYPE_CONFIG[normalizedType]) return normalizedType;
      if (FILE_TYPE_CONFIG[rawType]) return rawType;

      const name = (folder.name || "").toLowerCase();
      if (normalizedType.includes("joining") || name.includes("joining"))
        return "joining-letters";
      if (normalizedType.includes("monthly") || name.includes("monthly"))
        return "monthly-reports";
      if (normalizedType.includes("visit") || name.includes("visit"))
        return "visit-logs";
      if (normalizedType.includes("document") || name.includes("document"))
        return "documents";
      return "documents"; // Default fallback
    };

    // Group files by expected folder types
    const folderGroups = new Map();

    // Initialize expected folders
    expectedTypes.forEach((type) => {
      folderGroups.set(type, {
        type,
        name: FILE_TYPE_CONFIG[type].name,
        count: 0,
        files: [],
      });
    });

    // Process actual folders from backend
    fileTree.folders.forEach((folder) => {
      const normalizedType = normalizeType(folder);
      const existing = folderGroups.get(normalizedType);

      if (existing) {
        existing.count = (existing.count || 0) + (folder.count || 0);
        existing.files = [...(existing.files || []), ...(folder.files || [])];
      }
    });

    return (
      Array.from(folderGroups.values()).find((f) => f.type === currentFolder) ||
      null
    );
  }, [fileTree, currentFolder]);
  const filteredFiles = useMemo(() => {
    if (!currentFolderData?.files) return [];
    if (!fileSearchTerm) return currentFolderData.files;
    const s = fileSearchTerm.toLowerCase();
    return currentFolderData.files.filter(
      (f) =>
        f.name?.toLowerCase().includes(s) ||
        f.studentName?.toLowerCase().includes(s) ||
        f.rollNumber?.toLowerCase().includes(s),
    );
  }, [currentFolderData, fileSearchTerm]);

  // Compact styles
  const compactCard = {
    borderRadius: 8,
    boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
  };
  const smallText = { fontSize: 11, color: token.colorTextSecondary };
  const tinyText = { fontSize: 10, color: token.colorTextTertiary };

  // Tab Contents
  const OverviewTab = () => (
    <div style={{ padding: 10 }}>
      <Row gutter={[6, 6]}>
        {[
          {
            label: "Reports",
            val: summaryData?.reports.submitted,
            total: summaryData?.reports.expected,
            rate: summaryData?.reports.rate,
            color: token.colorPrimary,
          },
          {
            label: "Visits",
            val: summaryData?.visits.completed,
            total: summaryData?.visits.expected,
            rate: summaryData?.visits.rate,
            color: token.colorSuccess,
          },
          {
            label: "Overall",
            val: `${summaryData?.overall ?? 0}%`,
            rate: summaryData?.overall,
            color: token.colorWarning,
            isPercent: true,
          },
        ].map((item, i) => (
          <Col xs={24} sm={8} key={i}>
            <div
              style={{
                padding: "8px 10px",
                background: token.colorFillQuaternary,
                borderRadius: 4,
                borderLeft: `3px solid ${item.color}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={tinyText}>{item.label}</div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: token.colorText,
                    }}
                  >
                    {item.isPercent ? (
                      item.val
                    ) : (
                      <>
                        {item.val}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 400,
                            color: token.colorTextSecondary,
                          }}
                        >
                          /{item.total}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Progress
                  type="circle"
                  percent={item.rate || 0}
                  size={30}
                  strokeWidth={10}
                  strokeColor={getColor(item.rate)}
                  format={(p) => (
                    <span style={{ fontSize: 8, fontWeight: 600 }}>{p}%</span>
                  )}
                />
              </div>
            </div>
          </Col>
        ))}
      </Row>
      <div
        style={{
          marginTop: 10,
          padding: 10,
          background: token.colorFillQuaternary,
          borderRadius: 4,
        }}
      >
        <div style={{ ...smallText, marginBottom: 6, fontSize: 10 }}>
          <TeamOutlined style={{ marginRight: 4 }} />
          Student Status
        </div>
        <Row gutter={6}>
          {[
            {
              label: "Compliant",
              val: studentStats.complete,
              color: token.colorSuccess,
              icon: <CheckCircleFilled />,
            },
            {
              label: "Partial",
              val: studentStats.partial,
              color: token.colorWarning,
              icon: <WarningFilled />,
            },
            {
              label: "Non-Compliant",
              val: studentStats.critical,
              color: token.colorError,
              icon: <CloseCircleFilled />,
            },
          ].map((s, i) => (
            <Col span={8} key={i}>
              <div
                style={{
                  textAlign: "center",
                  padding: 6,
                  background: `${s.color}08`,
                  borderRadius: 4,
                }}
              >
                <div style={{ color: s.color, fontSize: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>
                  {s.val}
                </div>
                <div style={{ ...tinyText, fontSize: 9 }}>{s.label}</div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
      {/* Visit Type Breakdown */}
      {selectedDetails?.visitsByType &&
        selectedDetails.visitsByType.total > 0 && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: token.colorFillQuaternary,
              borderRadius: 4,
            }}
          >
            <div style={{ ...smallText, marginBottom: 6, fontSize: 10 }}>
              <EyeOutlined style={{ marginRight: 4 }} />
              Visits by Type
            </div>
            <Row gutter={6}>
              {[
                {
                  label: "In-Person",
                  val: selectedDetails.visitsByType.inPerson,
                  color: "#22c55e",
                  icon: <EnvironmentOutlined />,
                },
                {
                  label: "Online",
                  val: selectedDetails.visitsByType.online,
                  color: "#3b82f6",
                  icon: <EyeOutlined />,
                },
              ].map((item, i) => (
                <Col span={12} key={i}>
                  <div
                    style={{
                      textAlign: "center",
                      padding: 6,
                      background: `${item.color}14`,
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ color: item.color, fontSize: 10 }}>
                      {item.icon}
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: item.color,
                      }}
                    >
                      {item.val}
                    </div>
                    <div style={{ ...tinyText, fontSize: 9 }}>{item.label}</div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        )}
    </div>
  );

  const StudentsTab = () => {
    const [sSearch, setSSearch] = useState("");
    const [sFilter, setSFilter] = useState("all");
    const filtered = useMemo(() => {
      let r = selectedDetails?.students || [];
      if (sSearch) {
        const s = sSearch.toLowerCase();
        r = r.filter(
          (x) =>
            x.studentName?.toLowerCase().includes(s) ||
            x.rollNumber?.toLowerCase().includes(s) ||
            x.companyName?.toLowerCase().includes(s),
        );
      }
      if (sFilter !== "all")
        r = r.filter((x) => getStudentStatus(x) === sFilter);
      return r;
    }, [selectedDetails?.students, sSearch, sFilter]);

    const cols = [
      {
        title: "Student",
        key: "s",
        render: (_, r) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: token.colorFillSecondary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: token.colorTextSecondary,
              }}
            >
              {r.studentName?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>
                {r.studentName}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: token.colorTextSecondary,
                  fontFamily: "monospace",
                }}
              >
                {r.rollNumber}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Company",
        dataIndex: "companyName",
        ellipsis: true,
        render: (t) => (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t || "-"}
          </Text>
        ),
      },
      {
        title: "Report",
        key: "r",
        width: 80,
        render: (_, r) => (
          <Tag
            style={{ fontSize: 10, padding: "0 4px", margin: 0 }}
            color={
              r.reportStatus === "submitted"
                ? "success"
                : r.reportStatus === "pending"
                  ? "warning"
                  : "error"
            }
          >
            {r.reportStatus === "submitted"
              ? "Done"
              : r.reportStatus === "pending"
                ? "Review"
                : "Missing"}
          </Tag>
        ),
      },
      {
        title: "Visit",
        key: "v",
        width: 70,
        render: (_, r) => (
          <Tag
            style={{ fontSize: 10, padding: "0 4px", margin: 0 }}
            color={r.visitStatus === "completed" ? "success" : "warning"}
          >
            {r.visitStatus === "completed" ? "Done" : "Pending"}
          </Tag>
        ),
      },
    ];

    return (
      <div style={{ padding: 10 }}>
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 8,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Input
            placeholder="Search..."
            prefix={
              <SearchOutlined
                style={{ color: token.colorTextDisabled, fontSize: 10 }}
              />
            }
            value={sSearch}
            onChange={(e) => setSSearch(e.target.value)}
            allowClear
            size="small"
            style={{ width: 140 }}
          />
          <div style={{ display: "flex", gap: 3 }}>
            {[
              {
                key: "all",
                label: `All (${selectedDetails?.students?.length || 0})`,
              },
              {
                key: "complete",
                label: studentStats.complete,
                icon: <CheckCircleFilled />,
                color: "success",
              },
              {
                key: "partial",
                label: studentStats.partial,
                icon: <WarningFilled />,
                color: "warning",
              },
              {
                key: "critical",
                label: studentStats.critical,
                icon: <CloseCircleFilled />,
                color: "error",
              },
            ].map((f) => (
              <Tag
                key={f.key}
                style={{
                  cursor: "pointer",
                  margin: 0,
                  fontSize: 9,
                  padding: "0 4px",
                }}
                color={sFilter === f.key ? f.color || "blue" : undefined}
                onClick={() =>
                  setSFilter(
                    sFilter === f.key && f.key !== "all" ? "all" : f.key,
                  )
                }
              >
                {f.icon} {f.label}
              </Tag>
            ))}
          </div>
          <Text type="secondary" style={{ marginLeft: "auto", fontSize: 9 }}>
            {filtered.length} students
          </Text>
        </div>
        <Table
          columns={cols}
          dataSource={filtered}
          rowKey="studentId"
          size="small"
          pagination={false}
          scroll={{ y: "calc(100vh - 380px)" }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No students"
              />
            ),
          }}
        />
      </div>
    );
  };

  const FilesTab = () => {
    useEffect(() => {
      if (selectedInstitutionId && !fileTree && !filesLoading)
        fetchFileExplorer();
    }, []);

    // Get unique folders for display
    const uniqueFolders = useMemo(() => {
      if (!fileTree?.folders) return [];

      // Define the expected folder types
      const expectedTypes = [
        "documents",
        "visit-logs",
        "monthly-reports",
        "joining-letters",
      ];

      const normalizeType = (folder) => {
        const rawType = (folder.type || "").toString().trim();
        const normalizedType = rawType.toLowerCase().replace(/_/g, "-");
        if (FILE_TYPE_CONFIG[normalizedType]) return normalizedType;
        if (FILE_TYPE_CONFIG[rawType]) return rawType;

        const name = (folder.name || "").toLowerCase();
        if (normalizedType.includes("joining") || name.includes("joining"))
          return "joining-letters";
        if (normalizedType.includes("monthly") || name.includes("monthly"))
          return "monthly-reports";
        if (normalizedType.includes("visit") || name.includes("visit"))
          return "visit-logs";
        if (normalizedType.includes("document") || name.includes("document"))
          return "documents";
        return "documents"; // Default fallback
      };

      // Group files by expected folder types
      const folderGroups = new Map();

      // Initialize expected folders
      expectedTypes.forEach((type) => {
        folderGroups.set(type, {
          type,
          name: FILE_TYPE_CONFIG[type].name,
          count: 0,
          files: [],
        });
      });

      // Process actual folders from backend
      fileTree.folders.forEach((folder) => {
        const normalizedType = normalizeType(folder);
        const existing = folderGroups.get(normalizedType);

        if (existing) {
          existing.count = (existing.count || 0) + (folder.count || 0);
          existing.files = [...(existing.files || []), ...(folder.files || [])];
        }
      });

      // Return all expected folders, even if they have no files
      return Array.from(folderGroups.values());
    }, [fileTree]);

    const fileCols = [
      {
        title: "Name",
        key: "n",
        render: (_, r) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {getFileIcon(r.type, r.name)}
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  maxWidth: 160,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </div>
              <div style={tinyText}>
                {r.studentName} ({r.rollNumber})
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Details",
        key: "d",
        width: 120,
        render: (_, r) => (
          <div style={tinyText}>
            {r.companyName && (
              <div
                style={{
                  maxWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.companyName}
              </div>
            )}
            {r.month && r.year && (
              <div>
                {dayjs()
                  .month(r.month - 1)
                  .format("MMM")}{" "}
                {r.year}
              </div>
            )}
          </div>
        ),
      },
      {
        title: "Date",
        dataIndex: "uploadedAt",
        width: 70,
        render: (d) => (
          <Text type="secondary" style={{ fontSize: 10 }}>
            {d ? dayjs(d).format("DD MMM") : "-"}
          </Text>
        ),
      },
      {
        title: "",
        key: "a",
        width: 60,
        render: (_, r) => (
          <div style={{ display: "flex", gap: 2 }}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 12 }} />}
              loading={refreshingFile === r.id}
              onClick={() => handleFileAction(r, "view")}
              style={{ padding: "0 4px", height: 22 }}
            />
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined style={{ fontSize: 12 }} />}
              loading={refreshingFile === r.id}
              onClick={() => handleFileAction(r, "download")}
              style={{ padding: "0 4px", height: 22 }}
            />
          </div>
        ),
      },
    ];

    if (filesLoading)
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            gap: 8,
          }}
        >
          <Spin />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Loading...
          </Text>
        </div>
      );
    if (filesError)
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            gap: 8,
          }}
        >
          <ExclamationCircleOutlined
            style={{ fontSize: 24, color: token.colorError }}
          />
          <Text type="danger" style={{ fontSize: 11 }}>
            {filesError}
          </Text>
          <Button size="small" onClick={() => fetchFileExplorer()}>
            Retry
          </Button>
        </div>
      );

    return (
      <div style={{ padding: 10 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Breadcrumb
            items={[
              {
                title: (
                  <span
                    style={{ cursor: "pointer", fontSize: 10 }}
                    onClick={() => {
                      setCurrentFolder(null);
                      setFileSearchTerm("");
                    }}
                  >
                    <HomeOutlined /> Files
                  </span>
                ),
              },
              ...(currentFolder
                ? [
                    {
                      title: (
                        <span style={{ fontSize: 10 }}>
                          {FILE_TYPE_CONFIG[currentFolder]?.name}
                        </span>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {fileTree?.summary && (
              <Text type="secondary" style={{ fontSize: 9 }}>
                {fileTree.summary.totalFiles} files
              </Text>
            )}
            <Button
              type="text"
              size="small"
              icon={
                <ReloadOutlined style={{ fontSize: 10 }} spin={filesLoading} />
              }
              onClick={() => fetchFileExplorer(true)}
              style={{ padding: "0 4px", height: 18 }}
            />
          </div>
        </div>
        {!currentFolder ? (
          <Row gutter={[6, 6]}>
            {uniqueFolders.map((f) => {
              const cfg =
                FILE_TYPE_CONFIG[f.type] || FILE_TYPE_CONFIG.documents;
              return (
                <Col xs={24} sm={8} key={f.type}>
                  <div
                    onClick={() => setCurrentFolder(f.type)}
                    style={{
                      padding: 10,
                      background: cfg.bgColor,
                      borderRadius: 4,
                      cursor: "pointer",
                      transition: "all 0.2s",
                      border: "1px solid transparent",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = cfg.color)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "transparent")
                    }
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 4,
                          background: cfg.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 12,
                        }}
                      >
                        {cfg.icon}
                      </div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: cfg.color,
                        }}
                      >
                        {f.count}
                      </div>
                    </div>
                    <div
                      style={{ marginTop: 6, fontSize: 11, fontWeight: 600 }}
                    >
                      {cfg.name}
                    </div>
                    <div style={{ ...tinyText, fontSize: 9 }}>
                      {f.count} file{f.count !== 1 ? "s" : ""}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        ) : (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    background: FILE_TYPE_CONFIG[currentFolder]?.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: 10,
                  }}
                >
                  {FILE_TYPE_CONFIG[currentFolder]?.icon}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    {FILE_TYPE_CONFIG[currentFolder]?.name}
                  </div>
                </div>
              </div>
              <Input
                placeholder="Search..."
                prefix={
                  <SearchOutlined
                    style={{ color: token.colorTextDisabled, fontSize: 10 }}
                  />
                }
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
                allowClear
                size="small"
                style={{ width: 140 }}
              />
            </div>
            <Table
              columns={fileCols}
              dataSource={filteredFiles}
              rowKey="id"
              size="small"
              pagination={
                filteredFiles.length > 15
                  ? { pageSize: 15, size: "small" }
                  : false
              }
              scroll={{ y: "calc(100vh - 420px)" }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No files"
                  />
                ),
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: "overview",
      label: (
        <span style={{ fontSize: 12 }}>
          <PieChartOutlined /> Overview
        </span>
      ),
      children: <OverviewTab />,
    },
    {
      key: "students",
      label: (
        <span style={{ fontSize: 12 }}>
          <UserOutlined /> Students{" "}
          <Tag style={{ fontSize: 9, padding: "0 4px", marginLeft: 4 }}>
            {selectedDetails?.students?.length || 0}
          </Tag>
        </span>
      ),
      children: <StudentsTab />,
    },
    {
      key: "files",
      label: (
        <span style={{ fontSize: 12 }}>
          <FolderOutlined /> Files
        </span>
      ),
      children: <FilesTab />,
    },
  ];

  return (
    <div
      style={{
        padding: screens.md ? "12px 16px" : "8px",
        background: token.colorBgLayout,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PieChartOutlined style={{ color: "white", fontSize: 14 }} />
          </div>
          <div>
            <div
              style={{ fontSize: 15, fontWeight: 600, color: token.colorText }}
            >
              Internships Overview
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {error && (
            <Tag
              color="error"
              style={{ fontSize: 9, padding: "0 4px", margin: 0 }}
            >
              Error
            </Tag>
          )}
          <Tooltip title="Refresh">
            <Button
              size="small"
              icon={<ReloadOutlined style={{ fontSize: 11 }} spin={loading} />}
              onClick={handleRefresh}
              disabled={loading}
              style={{ height: 24 }}
            />
          </Tooltip>
        </div>
      </div>

      {/* Summary Bar */}
      {/* {stateWideSummary && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: token.colorFillQuaternary, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {[
              { icon: <TeamOutlined />, label: 'Students', val: stateWideSummary.totalStudentsInTraining },
              { icon: <FileTextOutlined />, label: 'Reports', val: `${stateWideSummary.totalSubmittedReports}/${stateWideSummary.totalExpectedReports}`, rate: stateWideSummary.reportComplianceRate },
              { icon: <EyeOutlined />, label: 'Visits', val: `${stateWideSummary.totalCompletedVisits}/${stateWideSummary.totalExpectedVisits}`, rate: stateWideSummary.visitComplianceRate },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: token.colorPrimary, fontSize: 12 }}>{s.icon}</span>
                <div>
                  <div style={tinyText}>{s.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {s.val}
                    {s.rate !== undefined && <Tag style={{ fontSize: 9, padding: '0 3px', marginLeft: 4 }} color={getTagColor(s.rate)}>{s.rate}%</Tag>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: token.colorBgContainer, borderRadius: 4 }}>
            <div><div style={tinyText}>Overall</div><div style={{ fontSize: 18, fontWeight: 700, color: getColor(stateWideSummary.overallComplianceRate) }}>{stateWideSummary.overallComplianceRate ?? 0}%</div></div>
            <Progress type="circle" percent={stateWideSummary.overallComplianceRate || 0} size={32} strokeWidth={10} strokeColor={getColor(stateWideSummary.overallComplianceRate)} format={() => null} />
          </div>
        </div>
      )} */}

      <Row gutter={[10, 10]}>
        {/* Left Panel */}
        <Col xs={24} md={7} lg={6} xl={5}>
          <Card
            size="small"
            title={
              <div
                style={{ display: "flex", alignItems: "center", fontSize: 11 }}
              >
                <BankOutlined
                  style={{ marginRight: 6, color: token.colorPrimary }}
                />
                Institutions
                <Text
                  type="secondary"
                  style={{ marginLeft: "auto", fontSize: 9 }}
                >
                  {filteredInstitutions.length}
                </Text>
              </div>
            }
            bordered={false}
            style={{
              ...compactCard,
              height: screens.md ? "calc(100vh - 120px)" : "45vh",
              display: "flex",
              flexDirection: "column",
            }}
            styles={{
              body: {
                padding: 0,
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              },
              header: {
                padding: "4px 10px",
                minHeight: 32,
                background: token.colorFillQuaternary,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              },
            }}
          >
            <div
              style={{
                padding: 6,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Input
                placeholder="Search..."
                prefix={
                  <BankOutlined
                    style={{ color: token.colorTextDisabled, fontSize: 10 }}
                  />
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                size="small"
                style={{ marginBottom: 4 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {[
                  { key: "all", label: `All` },
                  {
                    key: "excellent",
                    icon: <CheckCircleFilled />,
                    label: statusCounts.excellent,
                    color: "success",
                  },
                  {
                    key: "attention",
                    icon: <WarningFilled />,
                    label: statusCounts.attention,
                    color: "warning",
                  },
                  {
                    key: "critical",
                    icon: <CloseCircleFilled />,
                    label: statusCounts.critical,
                    color: "error",
                  },
                ].map((f) => (
                  <Tag
                    key={f.key}
                    style={{
                      cursor: "pointer",
                      margin: 0,
                      fontSize: 9,
                      padding: "0 4px",
                    }}
                    color={
                      statusFilter === f.key ? f.color || "blue" : undefined
                    }
                    onClick={() =>
                      setStatusFilter(
                        statusFilter === f.key && f.key !== "all"
                          ? "all"
                          : f.key,
                      )
                    }
                  >
                    {f.icon} {f.label}
                  </Tag>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {loading && !institutions.length ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <Spin size="small" />
                </div>
              ) : filteredInstitutions.length === 0 ? (
                <Empty
                  description="No results"
                  style={{ marginTop: 32 }}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  {filteredInstitutions.map((i) => {
                    const sel = selectedInstitutionId === i.institutionId;
                    const r = i.overallCompliance;
                    return (
                      <div
                        key={i.institutionId}
                        onClick={() => handleInstitutionSelect(i.institutionId)}
                        style={{
                          cursor: "pointer",
                          padding: "8px 10px",
                          borderRadius: token.borderRadius,
                          borderLeft: `3px solid ${sel ? token.colorPrimary : "transparent"}`,
                          backgroundColor: sel
                            ? token.colorPrimaryBg
                            : "transparent",
                          transition: "all 0.2s",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onMouseEnter={(e) => {
                          if (!sel)
                            e.currentTarget.style.backgroundColor =
                              token.colorFillAlter;
                        }}
                        onMouseLeave={(e) => {
                          if (!sel)
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                        }}
                      >
                        <Text
                          strong={sel}
                          style={{
                            fontSize: 13,
                            color: sel ? token.colorPrimary : token.colorText,
                            flex: 1,
                            minWidth: 0,
                          }}
                          ellipsis
                        >
                          {i.shortName || i.institutionName}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Right Panel */}
        <Col xs={24} md={17} lg={18} xl={19} id="compliance-details">
          {detailsLoading ? (
            <Card
              style={{
                height: "calc(100vh - 120px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                ...compactCard,
              }}
            >
              <Spin size="small" />
            </Card>
          ) : selectedDetails && inst ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                height: screens.md ? "calc(100vh - 120px)" : "auto",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {/* Header Card */}
              <Card size="small" bordered={false} style={compactCard}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: `linear-gradient(135deg, ${token.colorPrimary}, ${token.colorPrimaryActive})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BankOutlined style={{ fontSize: 18, color: "white" }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: token.colorText,
                      }}
                    >
                      {inst.name}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 1,
                      }}
                    >
                      {inst.city && (
                        <Text type="secondary" style={{ fontSize: 9 }}>
                          <EnvironmentOutlined style={{ fontSize: 8 }} />{" "}
                          {inst.address}
                        </Text>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={tinyText}>Overall</div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: getColor(summaryData?.overall),
                        lineHeight: 1,
                      }}
                    >
                      {summaryData?.overall ?? 0}%
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 8,
                    padding: "6px 10px",
                    background: token.colorFillQuaternary,
                    borderRadius: 4,
                  }}
                >
                  {[
                    {
                      icon: <TeamOutlined />,
                      label: "Students",
                      val: summaryData?.students,
                    },
                    {
                      icon: <FileTextOutlined />,
                      label: "Reports",
                      val: `${summaryData?.reports.submitted}/${summaryData?.reports.expected}`,
                      rate: summaryData?.reports.rate,
                    },
                    {
                      icon: <EyeOutlined />,
                      label: "Visits",
                      val: `${summaryData?.visits.completed}/${summaryData?.visits.expected}`,
                      rate: summaryData?.visits.rate,
                    },
                  ].map((s, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <span style={{ color: token.colorPrimary, fontSize: 13 }}>
                        {s.icon}
                      </span>
                      <div>
                        <div style={tinyText}>{s.label}</div>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>
                          {s.val}
                          {s.rate !== undefined && (
                            <Tag
                              style={{
                                fontSize: 8,
                                padding: "0 2px",
                                marginLeft: 4,
                                lineHeight: "12px",
                              }}
                              color={getTagColor(s.rate)}
                            >
                              {s.rate}%
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              {/* Tabs */}
              <Card
                size="small"
                bordered={false}
                style={{ ...compactCard, flex: 1 }}
                styles={{ body: { padding: 0 } }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  size="small"
                  style={{ height: "100%" }}
                  tabBarStyle={{ padding: "0 10px", marginBottom: 0 }}
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
                ...compactCard,
                border: `1px dashed ${token.colorBorder}`,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <BankOutlined
                  style={{
                    fontSize: 32,
                    color: token.colorTextDisabled,
                    marginBottom: 6,
                  }}
                />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: token.colorTextSecondary,
                  }}
                >
                  Select Institution
                </div>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Preview Modal */}
      <Modal
        title={<span style={{ fontSize: 13 }}>{previewFileName}</span>}
        open={!!previewUrl}
        onCancel={() => {
          setPreviewUrl(null);
          setPreviewFileName("");
        }}
        footer={[
          <Button
            key="d"
            size="small"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => window.open(previewUrl, "_blank")}
          >
            Download
          </Button>,
        ]}
        width={700}
        styles={{ body: { padding: 0, height: "65vh" } }}
      >
        {previewUrl && (
          <iframe
            src={previewUrl}
            title={previewFileName}
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        )}
      </Modal>
    </div>
  );
};

export default MonthlyCompliancePage;
