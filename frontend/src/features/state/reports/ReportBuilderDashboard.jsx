// Report Builder Dashboard - Main Page Component
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Card,
  Button,
  Typography,
  Tabs,
  Space,
  Badge,
  Tooltip,
  Modal,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  HistoryOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { toast } from "react-hot-toast";
import {
  ReportCatalog,
  ReportHistoryTable,
  GenerateReportDrawer,
  ReportStatusMonitor,
  ReportPreviewModal,
  ActiveReportsBadge,
  ReportBuilderErrorBoundary,
} from "../../../components/report-builder";
import {
  getReportCatalog,
  getReportHistory,
  exportReport,
  downloadBlob,
  getFileExtension,
  deleteReport,
} from "../../../services/reportBuilderApi";
import {
  getActiveReports,
  addActiveReport,
  removeActiveReport,
  formatLabel,
} from "../../../utils/reportBuilderUtils";

const { Title, Paragraph } = Typography;

// Debounce helper
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

const ReportBuilderDashboard = () => {
  // Data state
  const [catalog, setCatalog] = useState({});
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState("catalog");

  // Loading states
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloading, setDownloading] = useState({});

  // UI state
  const [selectedReport, setSelectedReport] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [statusMonitorVisible, setStatusMonitorVisible] = useState(false);
  const [monitoringReportId, setMonitoringReportId] = useState(null);

  // Active reports tracking
  const [activeReportIds, setActiveReportIds] = useState(() => getActiveReports());
  const notifiedReports = useRef(new Set());
  const loadHistoryTimeoutRef = useRef(null);
  const isLoadingHistoryRef = useRef(false);

  // Pagination
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 10,
    offset: 0,
  });

  // Load initial data
  useEffect(() => {
    loadCatalog();
    loadHistory();
  }, []);

  // Persist active reports
  useEffect(() => {
    localStorage.setItem("reportBuilder_activeReports", JSON.stringify(activeReportIds));
  }, [activeReportIds]);

  const loadCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const response = await getReportCatalog();
      if (response?.data) {
        setCatalog(response.data);
      }
    } catch (error) {
      console.error("Error loading catalog:", error);
      toast.error("Failed to load report catalog");
    } finally {
      setLoadingCatalog(false);
    }
  };

  // Debounced history loader to prevent multiple rapid calls
  const loadHistory = useCallback(async (showLoading = true) => {
    // Prevent concurrent loads
    if (isLoadingHistoryRef.current) return;

    // Clear any pending debounced calls
    if (loadHistoryTimeoutRef.current) {
      clearTimeout(loadHistoryTimeoutRef.current);
    }

    isLoadingHistoryRef.current = true;
    if (showLoading) setLoadingHistory(true);

    try {
      const response = await getReportHistory(pagination.limit, pagination.offset);
      if (response?.data) {
        setReports(response.data);
        setPagination((prev) => ({
          ...prev,
          total: response.total || response.data.length,
        }));
      }
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Failed to load report history");
    } finally {
      isLoadingHistoryRef.current = false;
      setLoadingHistory(false);
    }
  }, [pagination.limit, pagination.offset]);

  // Debounced version for callbacks
  const debouncedLoadHistory = useMemo(
    () => debounce(() => loadHistory(false), 500),
    [loadHistory]
  );

  const handleSelectReport = (report) => {
    setSelectedReport(report);
    setDrawerVisible(true);
  };

  const handleGenerateComplete = useCallback((reportData) => {
    // Add to active reports for tracking
    if (reportData?.id) {
      setActiveReportIds((prev) => {
        // Prevent duplicates
        if (prev.includes(reportData.id)) return prev;
        return [...prev, reportData.id];
      });
      addActiveReport(reportData.id);

      // Show status monitor
      setMonitoringReportId(reportData.id);
      setStatusMonitorVisible(true);
    }

    // Reload history with debounce
    debouncedLoadHistory();
  }, [debouncedLoadHistory]);

  // Unified handler for report completion - prevents double notifications
  const handleReportComplete = useCallback((reportId, statusData) => {
    // Strict deduplication check
    if (notifiedReports.current.has(reportId)) return;
    notifiedReports.current.add(reportId);

    toast.success(`Report "${statusData.reportName || formatLabel(statusData.reportType)}" is ready!`);

    // Use debounced load to prevent multiple rapid calls
    debouncedLoadHistory();

    // Remove from active after delay
    setTimeout(() => {
      setActiveReportIds((prev) => prev.filter((id) => id !== reportId));
      removeActiveReport(reportId);
    }, 3000);
  }, [debouncedLoadHistory]);

  const handleReportFailed = useCallback((reportId, statusData) => {
    if (notifiedReports.current.has(reportId)) return;
    notifiedReports.current.add(reportId);

    toast.error(`Report generation failed: ${statusData.errorMessage || "Unknown error"}`);

    // Remove from active immediately for failed reports
    setTimeout(() => {
      setActiveReportIds((prev) => prev.filter((id) => id !== reportId));
      removeActiveReport(reportId);
    }, 2000);
  }, []);

  const handleViewReport = (report) => {
    setPreviewReport(report);
    setPreviewModalVisible(true);
  };

  // Protected download handler - prevents double downloads
  const handleDownload = useCallback(async (report) => {
    if (!report?.id) return;

    // Check if already downloading
    if (downloading[report.id]) {
      return;
    }

    setDownloading((prev) => ({ ...prev, [report.id]: true }));
    try {
      const response = await exportReport(report.id);
      const filename = `${report.reportName || formatLabel(report.reportType)}_${report.id.slice(0, 8)}.${getFileExtension(report.format)}`;
      downloadBlob(response.data, filename);
      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading report:", error);
      toast.error("Failed to download report");
    } finally {
      setDownloading((prev) => ({ ...prev, [report.id]: false }));
    }
  }, [downloading]);

  const handleDeleteReport = useCallback((report) => {
    Modal.confirm({
      title: "Delete Report",
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${report.reportName || formatLabel(report.reportType)}"?`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await deleteReport(report.id);
          toast.success("Report deleted");
          loadHistory(true);
        } catch (error) {
          console.error("Error deleting report:", error);
          toast.error("Failed to delete report");
        }
      },
    });
  }, [loadHistory]);

  const handleCheckStatus = useCallback((report) => {
    setMonitoringReportId(report.id);
    setStatusMonitorVisible(true);
  }, []);

  const handleViewActiveReport = useCallback((reportId) => {
    setMonitoringReportId(reportId);
    setStatusMonitorVisible(true);
  }, []);

  // StatusMonitor completion handler - only refreshes data, notification handled by ActiveReportsBadge
  const handleStatusMonitorComplete = useCallback((statusData) => {
    // Only refresh if not already notified (ActiveReportsBadge may have already handled it)
    if (monitoringReportId && !notifiedReports.current.has(monitoringReportId)) {
      handleReportComplete(monitoringReportId, statusData);
    } else {
      // Just refresh history without notification
      debouncedLoadHistory();
    }
  }, [monitoringReportId, handleReportComplete, debouncedLoadHistory]);

  const handlePaginationChange = async (page, pageSize) => {
    const newOffset = (page - 1) * pageSize;
    const newLimit = pageSize;

    setPagination((prev) => ({
      ...prev,
      offset: newOffset,
      limit: newLimit,
    }));

    // Load with new pagination values directly
    setLoadingHistory(true);
    try {
      const response = await getReportHistory(newLimit, newOffset);
      if (response?.data) {
        setReports(response.data);
        setPagination((prev) => ({
          ...prev,
          total: response.total || response.data.length,
        }));
      }
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Failed to load report history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Memoize tab items to prevent unnecessary re-renders
  const tabItems = useMemo(() => [
    {
      key: "catalog",
      label: (
        <Space>
          <AppstoreOutlined />
          Report Catalog
        </Space>
      ),
      children: (
        <ReportCatalog
          catalog={catalog}
          loading={loadingCatalog}
          onSelectReport={handleSelectReport}
          selectedReport={selectedReport}
        />
      ),
    },
    {
      key: "history",
      label: (
        <Space>
          <HistoryOutlined />
          Report History
          {reports.length > 0 && (
            <Badge count={pagination.total} className="bg-blue-600" />
          )}
        </Space>
      ),
      children: (
        <ReportHistoryTable
          reports={reports}
          loading={loadingHistory}
          onView={handleViewReport}
          onDownload={handleDownload}
          onDelete={handleDeleteReport}
          onRefresh={() => loadHistory(true)}
          onCheckStatus={handleCheckStatus}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
          downloading={downloading}
        />
      ),
    },
  ], [
    catalog,
    loadingCatalog,
    selectedReport,
    reports,
    loadingHistory,
    pagination,
    downloading,
    handleSelectReport,
    handleViewReport,
    handleDownload,
    handleDeleteReport,
    handleCheckStatus,
    handlePaginationChange,
    loadHistory,
  ]);

  // Count stats
  const statsData = useMemo(() => ({
    availableReports: Object.values(catalog).flat().length,
    completedReports: reports.filter((r) => r.status === "completed").length,
    inProgress: activeReportIds.length,
    categories: Object.keys(catalog).length,
  }), [catalog, reports, activeReportIds]);

  return (
    <ReportBuilderErrorBoundary onReset={() => { loadCatalog(); loadHistory(true); }}>
      <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-primary shadow-sm mr-3">
                <BarChartOutlined className="text-lg" />
              </div>
              <div>
                <Title level={2} className="mb-0 text-text-primary text-2xl">
                  Report Builder
                </Title>
                <Paragraph className="text-text-secondary text-sm mb-0">
                  Create custom reports with flexible filtering and exports
                </Paragraph>
              </div>
            </div>

            <div className="flex lg:flex-nowrap flex-wrap gap-3 items-center">
              {/* Active Reports Badge - pause when status monitor is open */}
              <ActiveReportsBadge
                activeReports={activeReportIds}
                onViewReport={handleViewActiveReport}
                onReportComplete={handleReportComplete}
                onReportFailed={handleReportFailed}
                pausePolling={statusMonitorVisible}
              />

              <Tooltip title="Refresh Data">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    loadCatalog();
                    loadHistory(true);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border text-text-secondary shadow-sm hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all duration-200"
                />
              </Tooltip>

              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setSelectedReport(null);
                  setActiveTab("catalog");
                }}
                className="h-10 rounded-xl font-bold shadow-lg shadow-primary/20"
              >
                New Report
              </Button>
            </div>
          </div>

          {/* Stats Cards - Consistent color scheme */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <AppstoreOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statsData.availableReports}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Available</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-success/10 text-success">
                  <FileTextOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statsData.completedReports}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Completed</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-warning/10 text-warning">
                  <HistoryOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statsData.inProgress}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">In Progress</div>
                </div>
              </div>
            </Card>

            <Card size="small" className="rounded-xl border-border hover:shadow-md transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10 text-secondary">
                  <DownloadOutlined className="text-lg" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-text-primary">
                    {statsData.categories}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-text-tertiary">Categories</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content */}
          <Card className="rounded-2xl border-border shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              size="large"
              className="px-6"
            />
          </Card>
        </div>

        {/* Generate Report Drawer */}
        <GenerateReportDrawer
          open={drawerVisible}
          onClose={() => {
            setDrawerVisible(false);
            setSelectedReport(null);
          }}
          selectedReport={selectedReport}
          onGenerateComplete={handleGenerateComplete}
        />

        {/* Report Preview Modal */}
        <ReportPreviewModal
          open={previewModalVisible}
          onClose={() => {
            setPreviewModalVisible(false);
            setPreviewReport(null);
          }}
          report={previewReport}
          onDownload={handleDownload}
          downloading={downloading[previewReport?.id]}
        />

        {/* Report Status Monitor */}
        <ReportStatusMonitor
          reportId={monitoringReportId}
          open={statusMonitorVisible}
          onClose={() => {
            setStatusMonitorVisible(false);
            setMonitoringReportId(null);
          }}
          onComplete={handleStatusMonitorComplete}
          onDownload={handleDownload}
        />
      </div>
    </ReportBuilderErrorBoundary>
  );
};

export default ReportBuilderDashboard;