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
  SettingOutlined,
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
  excel: <FileExcelOutlined style={{ fontSize: 24 }} />,
  csv: <FileTextOutlined style={{ fontSize: 24 }} />,
  pdf: <FilePdfOutlined style={{ fontSize: 24 }} />,
  json: <CodeOutlined style={{ fontSize: 24 }} />,
};

/**
 * Sanitize and format a value for safe display
 * Handles objects, arrays, and primitive values
 * Truncates long strings to prevent UI issues
 * @param {any} value - Value to sanitize
 * @param {number} maxLength - Maximum string length
 * @returns {string} Safe display string
 */
const sanitizeDisplayValue = (value, maxLength = 100) => {
  if (value === null || value === undefined) {
    return "-";
  }

  let displayValue;

  if (typeof value === "object") {
    // For date range objects, format nicely
    if (value.from && value.to) {
      displayValue = `${String(value.from)} to ${String(value.to)}`;
    } else if (Array.isArray(value)) {
      displayValue = value.map((v) => String(v)).join(", ");
    } else {
      // Fallback to JSON for complex objects
      try {
        displayValue = JSON.stringify(value);
      } catch {
        displayValue = "[Object]";
      }
    }
  } else {
    displayValue = String(value);
  }

  // Truncate long strings
  if (displayValue.length > maxLength) {
    displayValue = displayValue.substring(0, maxLength) + "...";
  }

  return displayValue;
};

// Status icons mapping
const STATUS_ICONS = {
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  processing: <LoadingOutlined spin />,
  pending: <ClockCircleOutlined />,
};

const ReportPreviewModal = ({
  open,
  onClose,
  report,
  onDownload,
  downloading,
}) => {
  if (!report) return null;

  const statusConfig = getStatusConfig(report.status);
  const formatConfig = getFormatConfig(report.format);

  const renderConfiguration = () => {
    const config = report.configuration || {};

    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <Title level={5} className="!mb-3">
          <SettingOutlined className="mr-2" />
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
                  <Tag key={idx} className="text-xs">
                    {formatLabel(col)}
                  </Tag>
                ))}
                {config.columns.length > 10 && (
                  <Tag className="text-xs">+{config.columns.length - 10} more</Tag>
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
                  <Tag key={key} color="blue" className="text-xs">
                    {formatLabel(key)}: {sanitizeDisplayValue(value, 50)}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Group By */}
          {config.groupBy && (
            <div>
              <Text type="secondary">
                <GroupOutlined className="mr-2" />
                Grouped By:{" "}
              </Text>
              <Tag>{formatLabel(config.groupBy)}</Tag>
            </div>
          )}

          {/* Sort By */}
          {config.sortBy && (
            <div>
              <Text type="secondary">
                <SortAscendingOutlined className="mr-2" />
                Sorted By:{" "}
              </Text>
              <Tag>
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
              <Text strong>Report Created</Text>
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
              <Text strong>Generation Completed</Text>
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
              <Text strong>Expires</Text>
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
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <div className="flex justify-between">
          <Button onClick={onClose}>Close</Button>
          {report.status === "completed" && (
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              loading={downloading}
              onClick={() => onDownload?.(report)}
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

export default ReportPreviewModal;