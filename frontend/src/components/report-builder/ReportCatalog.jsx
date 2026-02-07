// ReportCatalog Component - Browse available reports by category
import React, { useState, useMemo } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Input,
  Tag,
  Space,
  Button,
  Tooltip,
  Empty,
  Collapse,
  Spin,
} from "antd";
import {
  SearchOutlined,
  FileTextOutlined,
  TeamOutlined,
  UserOutlined,
  LaptopOutlined,
  SafetyOutlined,
  BankOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
  RightOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FilterOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { getCategoryConfig, formatLabel } from "../../utils/reportBuilderUtils";

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

// Category icons mapping
const CATEGORY_ICONS = {
  MENTOR: <TeamOutlined />,
  STUDENT: <UserOutlined />,
  INTERNSHIP: <LaptopOutlined />,
  COMPLIANCE: <SafetyOutlined />,
  INSTITUTE: <BankOutlined />,
  USER_ACTIVITY: <HistoryOutlined />,
  PENDING: <ExclamationCircleOutlined />,
};

const ReportCatalog = ({
  catalog = {},
  loading = false,
  onSelectReport,
  selectedReport,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid | list
  // Expand all categories by default for better discoverability
  const [expandedCategories, setExpandedCategories] = useState(() => Object.keys(catalog));

  // Update expanded categories when catalog loads
  React.useEffect(() => {
    if (Object.keys(catalog).length > 0 && expandedCategories.length === 0) {
      setExpandedCategories(Object.keys(catalog));
    }
  }, [catalog]);

  // Filter catalog based on search
  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return catalog;

    const term = searchTerm.toLowerCase();
    const filtered = {};

    Object.entries(catalog).forEach(([category, reports]) => {
      const filteredReports = reports.filter(
        (report) =>
          report.name?.toLowerCase().includes(term) ||
          report.description?.toLowerCase().includes(term) ||
          report.id?.toLowerCase().includes(term)
      );

      if (filteredReports.length > 0) {
        filtered[category] = filteredReports;
      }
    });

    return filtered;
  }, [catalog, searchTerm]);

  // Get total reports count
  const totalReports = useMemo(() => {
    return Object.values(catalog).reduce(
      (sum, reports) => sum + reports.length,
      0
    );
  }, [catalog]);

  const handleCategoryChange = (keys) => {
    setExpandedCategories(keys);
  };

  const expandAll = () => {
    setExpandedCategories(Object.keys(filteredCatalog));
  };

  const collapseAll = () => {
    setExpandedCategories([]);
  };

  const renderReportCard = (report) => {
    const isSelected = selectedReport?.id === report.id;
    const categoryConfig = getCategoryConfig(report.category);

    return (
      <Card
        key={report.id}
        className={`
          cursor-pointer transition-all duration-200 h-full
          ${isSelected ? "border-blue-500 shadow-md bg-blue-50" : "hover:shadow-md hover:border-blue-300"}
        `}
        onClick={() => onSelectReport?.(report)}
        styles={{ body: { padding: 16 } }}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg"
              style={{ backgroundColor: categoryConfig.color }}
            >
              {CATEGORY_ICONS[report.category] || <FileTextOutlined />}
            </div>
            {report.columns?.length > 0 && (
              <Tooltip title={`${report.columns.length} available columns`}>
                <Tag icon={<TableOutlined />} color="default">
                  {report.columns.length}
                </Tag>
              </Tooltip>
            )}
          </div>

          <Title level={5} className="!mb-1 !mt-2 line-clamp-1">
            {report.name}
          </Title>

          <Paragraph
            type="secondary"
            className="text-sm !mb-3 line-clamp-2 flex-1"
          >
            {report.description || "No description available"}
          </Paragraph>

          <div className="flex items-center justify-between mt-auto">
            <Space size={4} wrap>
              {report.filters?.length > 0 && (
                <Tooltip title={`${report.filters.length} filters available`}>
                  <Tag icon={<FilterOutlined />} className="text-xs">
                    {report.filters.length} filters
                  </Tag>
                </Tooltip>
              )}
            </Space>
            <Button
              type={isSelected ? "primary" : "default"}
              size="small"
              icon={<RightOutlined />}
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  const renderReportList = (report) => {
    const isSelected = selectedReport?.id === report.id;
    const categoryConfig = getCategoryConfig(report.category);

    return (
      <div
        key={report.id}
        className={`
          p-4 rounded-lg border cursor-pointer transition-all duration-200 mb-2
          ${isSelected ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50 hover:border-blue-300"}
        `}
        onClick={() => onSelectReport?.(report)}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: categoryConfig.color }}
          >
            {CATEGORY_ICONS[report.category] || <FileTextOutlined />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text strong className="truncate">
                {report.name}
              </Text>
              {report.columns?.length > 0 && (
                <Tag size="small">{report.columns.length} cols</Tag>
              )}
              {report.filters?.length > 0 && (
                <Tag size="small">{report.filters.length} filters</Tag>
              )}
            </div>
            <Text type="secondary" className="text-sm truncate block">
              {report.description}
            </Text>
          </div>

          <Button
            type={isSelected ? "primary" : "default"}
            size="small"
            icon={<RightOutlined />}
          >
            {isSelected ? "Selected" : "Select"}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Spin size="large" tip="Loading report catalog..." />
      </div>
    );
  }

  const categories = Object.keys(filteredCatalog);

  return (
    <div className="report-catalog">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <Title level={5} className="!mb-1">
            Available Reports
          </Title>
          <Text type="secondary">{totalReports} reports available</Text>
        </div>

        <Space>
          <Tooltip title="Grid view">
            <Button
              type={viewMode === "grid" ? "primary" : "default"}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode("grid")}
            />
          </Tooltip>
          <Tooltip title="List view">
            <Button
              type={viewMode === "list" ? "primary" : "default"}
              icon={<UnorderedListOutlined />}
              onClick={() => setViewMode("list")}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Search */}
      <Search
        placeholder="Search reports by name or description..."
        allowClear
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
        size="large"
        prefix={<SearchOutlined className="text-gray-400" />}
      />

      {/* Expand/Collapse controls */}
      <div className="flex justify-end gap-2 mb-3">
        <Button size="small" onClick={expandAll}>
          Expand All
        </Button>
        <Button size="small" onClick={collapseAll}>
          Collapse All
        </Button>
      </div>

      {/* Categories */}
      {categories.length === 0 ? (
        <Empty
          description="No reports found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Collapse
          activeKey={expandedCategories}
          onChange={handleCategoryChange}
          className="bg-transparent"
          expandIconPosition="start"
          items={categories.map((category) => {
            const categoryConfig = getCategoryConfig(category);
            const reports = filteredCatalog[category];

            return {
              key: category,
              className: "mb-2 bg-white rounded-lg overflow-hidden",
              label: (
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: categoryConfig.color }}
                  >
                    {CATEGORY_ICONS[category] || <FileTextOutlined />}
                  </div>
                  <div>
                    <Text strong>{categoryConfig.label}</Text>
                    <Text type="secondary" className="ml-2">
                      ({reports.length} reports)
                    </Text>
                  </div>
                </div>
              ),
              children: (
                <>
                  {categoryConfig.description && (
                    <Text type="secondary" className="block mb-4 text-sm">
                      {categoryConfig.description}
                    </Text>
                  )}

                  {viewMode === "grid" ? (
                    <Row gutter={[16, 16]}>
                      {reports.map((report) => (
                        <Col xs={24} sm={12} lg={8} key={report.id}>
                          {renderReportCard(report)}
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <div>{reports.map((report) => renderReportList(report))}</div>
                  )}
                </>
              ),
            };
          })}
        />
      )}
    </div>
  );
};

export default ReportCatalog;