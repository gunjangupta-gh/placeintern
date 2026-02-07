// ReportHistoryTable Component - View generated reports history
import React from "react";
import {
  Table,
  Tag,
  Space,
  Button,
  Tooltip,
  Typography,
  Empty,
  Dropdown,
} from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  MoreOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getStatusConfig,
  getFormatConfig,
  formatLabel,
  formatDateTime,
  getRelativeTime,
} from "../../utils/reportBuilderUtils";

const { Text } = Typography;

// Format icons mapping
const FORMAT_ICONS = {
  excel: <FileExcelOutlined />,
  csv: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
  json: <CodeOutlined />,
};

// Status icons mapping
const STATUS_ICONS = {
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  processing: <LoadingOutlined spin />,
  pending: <ClockCircleOutlined />,
};

const ReportHistoryTable = ({
  reports = [],
  loading = false,
  onView,
  onDownload,
  onDelete,
  onRefresh,
  onCheckStatus,
  pagination,
  onPaginationChange,
  downloading = {}, // Global downloading state from parent
}) => {
  // Ensure reports is always an array
  const safeReports = Array.isArray(reports) ? reports : [];

  // Check if report is currently downloading
  const isDownloading = (reportId) => downloading[reportId] === true;

  const handleDownload = async (report) => {
    // Prevent double downloads
    if (isDownloading(report.id)) return;
    await onDownload?.(report);
  };

  const getActionMenu = (record) => ({
    items: [
      {
        key: "view",
        label: "View Details",
        icon: <EyeOutlined />,
        onClick: () => onView?.(record),
      },
      record.status === "completed" && {
        key: "download",
        label: "Download",
        icon: <DownloadOutlined />,
        onClick: () => handleDownload(record),
      },
      (record.status === "processing" || record.status === "pending") && {
        key: "refresh",
        label: "Check Status",
        icon: <ReloadOutlined />,
        onClick: () => onCheckStatus?.(record),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "Delete",
        icon: <DeleteOutlined />,
        danger: true,
        onClick: () => onDelete?.(record),
      },
    ].filter(Boolean),
  });

  const columns = [
    {
      title: "Report",
      key: "report",
      width: 280,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100 flex-shrink-0"
          >
            {FORMAT_ICONS[record.format] || <FileTextOutlined />}
          </div>
          <div className="min-w-0">
            <Text strong className="block truncate">
              {record.reportName || formatLabel(record.reportType)}
            </Text>
            <Text type="secondary" className="text-xs block truncate">
              {formatLabel(record.reportType)}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag
            icon={STATUS_ICONS[status]}
            color={config.color}
            className="flex items-center gap-1 w-fit"
          >
            {config.label}
          </Tag>
        );
      },
      filters: [
        { text: "Completed", value: "completed" },
        { text: "Processing", value: "processing" },
        { text: "Pending", value: "pending" },
        { text: "Failed", value: "failed" },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Format",
      dataIndex: "format",
      key: "format",
      width: 100,
      render: (format) => {
        const config = getFormatConfig(format);
        return (
          <Tooltip title={config.description}>
            <Tag icon={FORMAT_ICONS[format]}>
              {config.label}
            </Tag>
          </Tooltip>
        );
      },
      filters: [
        { text: "Excel", value: "excel" },
        { text: "CSV", value: "csv" },
        { text: "PDF", value: "pdf" },
        { text: "JSON", value: "json" },
      ],
      onFilter: (value, record) => record.format === value,
    },
    {
      title: "Records",
      dataIndex: "totalRecords",
      key: "totalRecords",
      width: 100,
      align: "right",
      render: (count) => (
        <Text>{count !== null && count !== undefined ? count.toLocaleString() : "-"}</Text>
      ),
      sorter: (a, b) => (a.totalRecords || 0) - (b.totalRecords || 0),
    },
    {
      title: "Generated",
      dataIndex: "generatedAt",
      key: "generatedAt",
      width: 160,
      render: (date) => (
        <Tooltip title={formatDateTime(date)}>
          <div>
            <Text className="block">{dayjs(date).format("MMM DD, YYYY")}</Text>
            <Text type="secondary" className="text-xs">
              {getRelativeTime(date)}
            </Text>
          </div>
        </Tooltip>
      ),
      sorter: (a, b) => dayjs(a.generatedAt).unix() - dayjs(b.generatedAt).unix(),
      defaultSortOrder: "descend",
    },
    {
      title: "Expires",
      dataIndex: "expiresAt",
      key: "expiresAt",
      width: 120,
      render: (date, record) => {
        if (record.status !== "completed" || !date) return "-";
        const isExpired = dayjs(date).isBefore(dayjs());
        const isExpiringSoon = dayjs(date).diff(dayjs(), "hour") < 6;

        return (
          <Tooltip title={formatDateTime(date)}>
            <Tag
              color={isExpired ? "error" : isExpiringSoon ? "warning" : "default"}
            >
              {isExpired ? "Expired" : getRelativeTime(date)}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 140,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          {record.status === "completed" && (
            <Tooltip title="Download">
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                loading={isDownloading(record.id)}
                disabled={isDownloading(record.id)}
                onClick={() => handleDownload(record)}
              />
            </Tooltip>
          )}

          <Tooltip title="View Details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onView?.(record)}
            />
          </Tooltip>

          <Dropdown menu={getActionMenu(record)} trigger={["click"]}>
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  return (
    <div className="report-history-table">
      <Table
        columns={columns}
        dataSource={safeReports}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
        pagination={
          pagination
            ? {
                total: pagination.total,
                pageSize: pagination.limit || 10,
                current:
                  Math.floor((pagination.offset || 0) / (pagination.limit || 10)) +
                  1,
                onChange: (page, pageSize) => {
                  onPaginationChange?.(page, pageSize);
                },
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => (
                  <Text type="secondary">
                    Showing {range[0]}-{range[1]} of {total} reports
                  </Text>
                ),
              }
            : false
        }
        rowClassName={(record) =>
          record.status === "processing" || record.status === "pending"
            ? "bg-blue-50"
            : ""
        }
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" className="block mb-2">
                    No reports generated yet
                  </Text>
                  <Text type="secondary" className="text-xs">
                    Select a report type and generate your first report
                  </Text>
                </div>
              }
            />
          ),
        }}
      />
    </div>
  );
};

export default ReportHistoryTable;