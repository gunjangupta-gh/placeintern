// ReportStatusMonitor Component - Track async report generation via WebSocket
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Modal,
  Progress,
  Typography,
  Space,
  Button,
  Tag,
  Spin,
  Alert,
  Descriptions,
  Result,
} from "antd";
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { getReportStatus, exportReport, getFileExtension } from "../../services/reportBuilderApi";
import { downloadBlob } from "../../utils/downloadUtils";
import { getStatusConfig, formatLabel, formatDateTime } from "../../utils/reportBuilderUtils";
import { useWebSocket } from "../../hooks/useWebSocket";

const { Title, Text } = Typography;

const ReportStatusMonitor = ({
  reportId,
  open,
  onClose,
  onComplete,
  onDownload,
}) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const currentReportIdRef = useRef(reportId);

  // WebSocket connection for real-time updates
  const { on, off, isConnected } = useWebSocket();

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Keep reportId ref in sync
  useEffect(() => {
    currentReportIdRef.current = reportId;
  }, [reportId]);

  // Fetch initial status via HTTP (fallback and initial load)
  const fetchStatus = useCallback(async () => {
    const currentId = currentReportIdRef.current;
    if (!currentId || !mountedRef.current) return;

    try {
      const response = await getReportStatus(currentId);

      // Check if still mounted and same reportId
      if (!mountedRef.current || currentReportIdRef.current !== currentId) return;

      if (response?.data) {
        setStatus(response.data);
        setError(null);

        // Mark as completed if already done
        if (
          (response.data.status === "completed" ||
            response.data.status === "failed") &&
          !completedRef.current
        ) {
          completedRef.current = true;

          if (response.data.status === "completed") {
            onComplete?.(response.data);
          }
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("Error fetching report status:", err);
      setError("Failed to fetch report status");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [onComplete]);

  // Handle WebSocket report status updates
  useEffect(() => {
    if (!open || !reportId) return;

    const handleReportStatus = (data) => {
      // Only process events for our report
      if (data.reportId !== currentReportIdRef.current) return;
      if (!mountedRef.current) return;

      // Update status from WebSocket event
      setStatus((prev) => ({
        ...prev,
        status: data.status,
        reportType: data.reportType || prev?.reportType,
        reportName: data.reportName || prev?.reportName,
        format: data.format || prev?.format,
        totalRecords: data.totalRecords || prev?.totalRecords,
        fileUrl: data.fileUrl || prev?.fileUrl,
        errorMessage: data.errorMessage || prev?.errorMessage,
        generatedAt: data.generatedAt || prev?.generatedAt,
      }));
      setLoading(false);
      setError(null);

      // Handle completion
      if (
        (data.status === "completed" || data.status === "failed") &&
        !completedRef.current
      ) {
        completedRef.current = true;

        if (data.status === "completed") {
          onComplete?.({
            ...data,
            reportType: data.reportType,
            totalRecords: data.totalRecords,
          });
        }
      }
    };

    // Subscribe to WebSocket events
    on("reportStatus", handleReportStatus);

    return () => {
      off("reportStatus", handleReportStatus);
    };
  }, [open, reportId, on, off, onComplete]);

  // Initial fetch when modal opens (WebSocket may miss if report already processing)
  useEffect(() => {
    if (open && reportId) {
      completedRef.current = false;
      setStatus(null);
      setLoading(true);
      setError(null);
      fetchStatus();
    }
  }, [open, reportId, fetchStatus]);

  const handleDownload = async () => {
    if (!reportId || !status) return;

    setDownloading(true);
    try {
      const response = await exportReport(reportId);
      const filename = `${status.reportName || "report"}_${reportId.slice(0, 8)}.${getFileExtension(status.format)}`;
      downloadBlob(response.data, filename);
      onDownload?.(status);
    } catch (err) {
      console.error("Error downloading report:", err);
      setError("Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    completedRef.current = false;
    fetchStatus();
  };

  const getProgressPercent = () => {
    if (!status) return 0;
    switch (status.status) {
      case "pending":
        return 10;
      case "processing":
        return 50;
      case "completed":
        return 100;
      case "failed":
        return 100;
      default:
        return 0;
    }
  };

  const getProgressStatus = () => {
    if (!status) return "active";
    switch (status.status) {
      case "completed":
        return "success";
      case "failed":
        return "exception";
      default:
        return "active";
    }
  };

  const renderStatusIcon = () => {
    if (!status) return <LoadingOutlined spin style={{ fontSize: 48 }} />;

    switch (status.status) {
      case "completed":
        return (
          <CheckCircleOutlined
            style={{ fontSize: 48 }}
          />
        );
      case "failed":
        return (
          <CloseCircleOutlined
            style={{ fontSize: 48 }}
          />
        );
      case "processing":
        return <LoadingOutlined spin style={{ fontSize: 48 }} />;
      default:
        return <ClockCircleOutlined style={{ fontSize: 48 }} />;
    }
  };

  const renderContent = () => {
    if (loading && !status) {
      return (
        <div className="text-center py-12">
          <Spin size="large" tip="Loading report status..." />
        </div>
      );
    }

    if (error && !status) {
      return (
        <Result
          status="error"
          title="Unable to Load Status"
          subTitle={error}
          extra={
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRetry}
            >
              Retry
            </Button>
          }
        />
      );
    }

    if (status?.status === "completed") {
      return (
        <Result
          icon={<CheckCircleOutlined />}
          title="Report Generated Successfully!"
          subTitle={
            <Space orientation="vertical" className="mt-2">
              <Text>
                Your report is ready with{" "}
                <Text strong>{status.totalRecords?.toLocaleString() || 0}</Text>{" "}
                records
              </Text>
              <Text type="secondary">
                Generated at {formatDateTime(status.generatedAt)}
              </Text>
            </Space>
          }
          extra={[
            <Button
              key="download"
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              loading={downloading}
              disabled={downloading}
              onClick={handleDownload}
            >
              Download Report
            </Button>,
            <Button key="close" size="large" onClick={onClose}>
              Close
            </Button>,
          ]}
        />
      );
    }

    if (status?.status === "failed") {
      return (
        <Result
          status="error"
          title="Report Generation Failed"
          subTitle={
            status.errorMessage || "An error occurred during report generation"
          }
          extra={
            <Button key="close" onClick={onClose}>
              Close
            </Button>
          }
        />
      );
    }

    // Processing or pending state
    return (
      <div className="py-8">
        <div className="text-center mb-8">
          {renderStatusIcon()}
          <Title level={4} className="mt-4 !mb-2">
            {status?.status === "processing"
              ? "Generating Report..."
              : "Report Queued"}
          </Title>
          <Text type="secondary">
            {status?.status === "processing"
              ? "Please wait while we process your report"
              : "Your report is in the queue and will be processed shortly"}
          </Text>
        </div>

        <Progress
          percent={getProgressPercent()}
          status={getProgressStatus()}
          className="mb-6"
        />

        <Descriptions
          bordered
          size="small"
          column={1}
          className="bg-gray-50 rounded-lg"
        >
          <Descriptions.Item label="Report Type">
            {formatLabel(status?.reportType || "")}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={getStatusConfig(status?.status).color}>
              {getStatusConfig(status?.status).label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Format">
            {status?.format?.toUpperCase() || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Started">
            {formatDateTime(status?.generatedAt)}
          </Descriptions.Item>
        </Descriptions>

        <Alert
          title="You can close this dialog"
          description="The report will continue generating in the background. You'll be notified when it's ready."
          type="info"
          showIcon
          className="mt-4"
        />
      </div>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
                  Report Status
                </Space>
              }
                open={open}
                onCancel={onClose}
                footer={null}      width={560}
      centered
      destroyOnHidden
    >
      {renderContent()}
    </Modal>
  );
};

export default ReportStatusMonitor;