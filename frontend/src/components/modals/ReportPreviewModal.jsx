// ReportPreviewModal Component - View report details and download
import React from "react";
import {
  Modal,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Progress,
  Timeline,
} from "antd";
import {
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  TableOutlined,
  FilterOutlined,
  GroupOutlined,
  SortAscendingOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import {
  getStatusConfig,
  getFormatConfig,
  formatLabel,
  formatDateTime,
  getRelativeTime,
} from "../../utils/reportBuilderUtils";

const { Text, Title } = Typography;

// Format icons mapping
const FORMAT_ICONS = {
  excel: <FileExcelOutlined className="text-[#217346] text-2xl" />,
  csv: <FileTextOutlined className="text-text-secondary text-2xl" />,
  pdf: <FilePdfOutlined className="text-[#f40f02] text-2xl" />,
  json: <CodeOutlined className="text-warning-400 text-2xl" />,
};

/**
 * Sanitize and format a value for safe display
 */
const sanitizeDisplayValue = (value, maxLength = 100) => {
  if (value === null || value === undefined) {
    return "-";
  }

  let displayValue;

  if (typeof value === "object") {
    if (value.from && value.to) {
      displayValue = `${String(value.from)} to ${String(value.to)}`;
    } else if (Array.isArray(value)) {
      displayValue = value.map((v) => String(v)).join(", ");
    } else {
      try {
        displayValue = JSON.stringify(value);
      } catch {
        displayValue = "[Object]";
      }
    }
  } else {
    displayValue = String(value);
  }

  if (displayValue.length > maxLength) {
    displayValue = displayValue.substring(0, maxLength) + "...";
  }

  return displayValue;
};

const ReportPreviewModal = ({
  visible,
  onClose,
  report,
  onDownload,
  downloading,
}) => {
  const { token } = theme.useToken();
  if (!report) return null;

  // Status icons mapping
  const STATUS_ICONS = {
    completed: <CheckCircleOutlined style={{ color: token.colorSuccess }} />,
    failed: <CloseCircleOutlined style={{ color: token.colorError }} />,
    processing: <LoadingOutlined spin style={{ color: token.colorPrimary }} />,
    pending: <ClockCircleOutlined style={{ color: token.colorWarning }} />,
  };

  const statusConfig = getStatusConfig(report.status);
  const formatConfig = getFormatConfig(report.format);

  const renderConfiguration = () => {
    const config = report.configuration || {};

    return (
      <div className="bg-background-tertiary p-4 rounded-xl border border-border/50">
        <Title level={5} className="!mb-3 flex items-center">
          <SettingsIcon className="mr-2" />
          Report Configuration
        </Title>

        <div className="space-y-3">
          {/* Columns */}
          {config.columns && config.columns.length > 0 && (
            <div>
              <Text type="secondary" className="block mb-1">
                <TableOutlined className="mr-2" />
                Columns ({config.columns.length})
              </Text>
              <div className="flex flex-wrap gap-1">
                {config.columns.slice(0, 10).map((col, idx) => (
                  <Tag key={idx} className="text-xs rounded-md">
                    {formatLabel(col)}
                  </Tag>
                ))}
                {config.columns.length > 10 && (
                  <Tag className="text-xs rounded-md">+{config.columns.length - 10} more</Tag>
                )}
              </div>
            </div>
          )}

          {/* Filters */}
          {config.filters && Object.keys(config.filters).length > 0 && (
            <div>
              <Text type="secondary" className="block mb-1">
                <FilterOutlined className="mr-2" />
                Active Filters
              </Text>
              <div className="flex flex-wrap gap-1">
                {Object.entries(config.filters).map(([key, value]) => (
                  <Tag key={key} color="blue" className="text-xs rounded-md">
                    {formatLabel(key)}: {sanitizeDisplayValue(value, 50)}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Group By */}
          {config.groupBy && (
            <div>
              <Text type="secondary" className="mr-2">
                <GroupOutlined className="mr-2" />
                Grouped By:
              </Text>
              <Tag className="rounded-md">{formatLabel(config.groupBy)}</Tag>
            </div>
          )}

          {/* Sort By */}
          {config.sortBy && (
            <div className="mt-2">
              <Text type="secondary" className="mr-2">
                <SortAscendingOutlined className="mr-2" />
                Sorted By:
              </Text>
              <Tag className="rounded-md">
                {formatLabel(config.sortBy)} ({config.sortOrder || "asc"})
              </Tag>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTimeline = () => (
    <Timeline
      items={[
        {
          color: "green",
          dot: <ClockCircleOutlined />,
          children: (
            <div>
              <Text strong className="text-text-primary">Report Created</Text>
              <Text type="secondary" className="block text-xs">
                {formatDateTime(report.generatedAt)}
              </Text>
            </div>
          ),
        },
        report.status === "completed" && {
          color: "green",
          dot: <CheckCircleOutlined />,
          children: (
            <div>
              <Text strong className="text-text-primary">Generation Completed</Text>
              <Text type="secondary" className="block text-xs">
                {report.totalRecords?.toLocaleString()} records processed
              </Text>
            </div>
          ),
        },
        report.status === "failed" && {
          color: "red",
          dot: <CloseCircleOutlined />,
          children: (
            <div>
              <Text strong type="danger">
                Generation Failed
              </Text>
              <Text type="secondary" className="block text-xs">
                {sanitizeDisplayValue(report.errorMessage, 200) || "Unknown error"}
              </Text>
            </div>
          ),
        },
        report.expiresAt && {
          color: "gray",
          dot: <ClockCircleOutlined />,
          children: (
            <div>
              <Text strong className="text-text-primary">Expires</Text>
              <Text type="secondary" className="block text-xs">
                {formatDateTime(report.expiresAt)}
              </Text>
            </div>
          ),
        },
      ].filter(Boolean)}
    />
  );

  return (
    <Modal
      title={
        <Space>
          {FORMAT_ICONS[report.format] || <FileTextOutlined />}
          <span>Report Details</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={640}
      className="rounded-xl overflow-hidden"
      footer={
        <div className="flex justify-between items-center px-2">
          <Button onClick={onClose} className="rounded-lg">Close</Button>
          {report.status === "completed" && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloading}
              onClick={() => onDownload?.(report)}
              className="rounded-lg shadow-md shadow-primary/20"
            >
              Download {formatConfig.label}
            </Button>
          )}
        </div>
      }
    >
      {/* Status Alert */}
      {report.status === "failed" && (
        <Alert
          type="error"
          title="Report Generation Failed"
          description={sanitizeDisplayValue(report.errorMessage, 200) || "An error occurred during generation"}
          showIcon
          className="mb-4"
        />
      )}

      {report.status === "processing" && (
        <Alert
          type="info"
          title="Report In Progress"
          description="Your report is being generated. This may take a few moments."
          showIcon
          icon={<LoadingOutlined spin />}
          className="mb-4"
        />
      )}

      {/* Basic Info */}
      <Descriptions
        bordered
        size="small"
        column={2}
        className="mb-4"
      >
        <Descriptions.Item label="Report Name" span={2}>
          <Text strong>{report.reportName || formatLabel(report.reportType)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Report Type">
          {formatLabel(report.reportType)}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag icon={STATUS_ICONS[report.status]} color={statusConfig.color}>
            {statusConfig.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Format">
          <Tag icon={FORMAT_ICONS[report.format]}>
            {formatConfig.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Records">
          {report.totalRecords !== null && report.totalRecords !== undefined
            ? report.totalRecords.toLocaleString()
            : "-"}
        </Descriptions.Item>
        <Descriptions.Item label="Generated">
          {formatDateTime(report.generatedAt)}
        </Descriptions.Item>
        <Descriptions.Item label="Expires">
          {report.expiresAt ? getRelativeTime(report.expiresAt) : "-"}
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      {/* Configuration */}
      {renderConfiguration()}

      <Divider />

      {/* Timeline */}
      <Title level={5} className="!mb-3">
        Report Timeline
      </Title>
      {renderTimeline()}
    </Modal>
  );
};

// Helper component for settings icon
const SettingsIcon = ({ className }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default ReportPreviewModal;