// GenerateReportDrawer Component - Configure and generate reports
import React, { useState, useEffect } from "react";
import {
  Drawer,
  Button,
  Steps,
  Typography,
  Space,
  Card,
  Select,
  Radio,
  Alert,
  Spin,
  Tag,
  Collapse,
  message,
} from "antd";
import {
  FileTextOutlined,
  FilterOutlined,
  TableOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  SortAscendingOutlined,
  GroupOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import { getReportConfig, generateReport, generateReportSync, exportReport, getFileExtension } from "../../services/reportBuilderApi";
import { downloadBlob } from "../../utils/downloadUtils";
import {
  EXPORT_FORMATS,
  formatLabel,
  validateReportConfig,
} from "../../utils/reportBuilderUtils";
import FilterBuilder from "./FilterBuilder";
import ColumnSelector from "./ColumnSelector";
import TemplateManager from "./TemplateManager";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const FORMAT_ICONS = {
  excel: <FileExcelOutlined />,
  csv: <FileTextOutlined />,
  pdf: <FilePdfOutlined />,
  json: <CodeOutlined />,
};

const GenerateReportDrawer = ({
  open,
  onClose,
  selectedReport,
  onGenerate,
  onGenerateComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [reportConfig, setReportConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [groupBy, setGroupBy] = useState(undefined);
  const [sortBy, setSortBy] = useState(undefined);
  const [sortOrder, setSortOrder] = useState("asc");
  const [format, setFormat] = useState("excel");
  const [asyncMode, setAsyncMode] = useState(true);

  // Load report configuration when report is selected
  useEffect(() => {
    if (open && selectedReport?.id) {
      loadReportConfig(selectedReport.id);
    }
  }, [open, selectedReport?.id]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setCurrentStep(0);
    setReportConfig(null);
    setSelectedColumns([]);
    setFilterValues({});
    setGroupBy(undefined);
    setSortBy(undefined);
    setSortOrder("asc");
    setFormat("excel");
    setAsyncMode(true);
  };

  const loadReportConfig = async (reportType) => {
    setLoadingConfig(true);
    try {
      const response = await getReportConfig(reportType);
      if (response?.data) {
        setReportConfig(response.data);
        // Pre-select default columns
        const defaultColumns = response.data.columns
          ?.filter((c) => c.default)
          .map((c) => c.id);
        setSelectedColumns(defaultColumns || []);
      }
    } catch (error) {
      console.error("Error loading report config:", error);
      message.error("Failed to load report configuration");
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleApplyTemplate = (template) => {
    setSelectedColumns(template.columns || []);
    setFilterValues(template.filters || {});
    setGroupBy(template.groupBy);
    setSortBy(template.sortBy);
    setSortOrder(template.sortOrder || "asc");
    message.success("Template applied");
  };

  const handleGenerate = async () => {
    const payload = {
      type: selectedReport.id,
      columns: selectedColumns,
      filters: filterValues,
      groupBy,
      sortBy,
      sortOrder,
      format,
    };

    const validation = validateReportConfig(payload, reportConfig);
    if (!validation.valid) {
      validation.errors.forEach((err) => message.error(err));
      return;
    }

    setGenerating(true);
    try {
      if (asyncMode) {
        // Async mode - queue in background
        const response = await generateReport(payload);
        if (response?.data) {
          message.success("Report generation started! You can track progress in the history.");
          onGenerateComplete?.(response.data);
          onClose();
        }
      } else {
        // Sync mode - generate immediately and download
        const response = await generateReportSync(payload);
        if (response?.data) {
          // For sync mode, try to download immediately if fileUrl is available
          if (response.data.id) {
            try {
              const exportResponse = await exportReport(response.data.id);
              const filename = `${selectedReport.name || "report"}_${response.data.id.slice(0, 8)}.${getFileExtension(format)}`;
              downloadBlob(exportResponse.data, filename);
              message.success("Report generated and downloaded!");
            } catch (downloadError) {
              console.error("Error downloading report:", downloadError);
              message.success("Report generated! Check history to download.");
            }
          } else {
            message.success("Report generated successfully!");
          }
          onGenerateComplete?.(response.data);
          onClose();
        }
      }
    } catch (error) {
      console.error("Error generating report:", error);
      message.error(error.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const getSortableColumns = () => {
    return reportConfig?.columns?.filter((c) => c.sortable) || [];
  };

  const getGroupableColumns = () => {
    return reportConfig?.columns?.filter((c) => c.groupable) || [];
  };

  const steps = [
    {
      title: "Columns",
      icon: <TableOutlined />,
      description: "Select data columns",
    },
    {
      title: "Filters",
      icon: <FilterOutlined />,
      description: "Apply filters",
    },
    {
      title: "Options",
      icon: <SettingOutlined />,
      description: "Sort & export",
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <Title level={5} className="!mb-4">
              <TableOutlined className="mr-2" />
              Select Columns
            </Title>
            <Paragraph type="secondary" className="!mb-4">
              Choose which columns to include in your report. You can reorder
              them by dragging.
            </Paragraph>

            <ColumnSelector
              columns={reportConfig?.columns || []}
              selectedColumns={selectedColumns}
              onChange={setSelectedColumns}
              showSort
            />
          </div>
        );

      case 1:
        return (
          <div>
            <Title level={5} className="!mb-4">
              <FilterOutlined className="mr-2" />
              Apply Filters
            </Title>
            <Paragraph type="secondary" className="!mb-4">
              Filter your data to get exactly what you need. All filters are
              optional.
            </Paragraph>

            <FilterBuilder
              filters={reportConfig?.filters || []}
              reportType={selectedReport?.id}
              values={filterValues}
              onChange={setFilterValues}
            />
          </div>
        );

      case 2:
        return (
          <div>
            <Title level={5} className="!mb-4">
              <SettingOutlined className="mr-2" />
              Report Options
            </Title>

            {/* Grouping */}
            {getGroupableColumns().length > 0 && (
              <Card size="small" className="mb-4">
                <Space className="w-full" orientation="vertical">
                  <Text strong>
                    <GroupOutlined className="mr-2" />
                    Group By
                  </Text>
                  <Select
                    placeholder="No grouping"
                    allowClear
                    className="w-full"
                    value={groupBy}
                    onChange={setGroupBy}
                  >
                    {getGroupableColumns().map((col) => (
                      <Option key={col.id} value={col.id}>
                        {col.label}
                      </Option>
                    ))}
                  </Select>
                </Space>
              </Card>
            )}

            {/* Sorting */}
            {getSortableColumns().length > 0 && (
              <Card size="small" className="mb-4">
                <Space className="w-full" orientation="vertical">
                  <Text strong>
                    <SortAscendingOutlined className="mr-2" />
                    Sort By
                  </Text>
                  <div className="flex gap-2">
                    <Select
                      placeholder="Select column"
                      allowClear
                      className="flex-1"
                      value={sortBy}
                      onChange={setSortBy}
                    >
                      {getSortableColumns().map((col) => (
                        <Option key={col.id} value={col.id}>
                          {col.label}
                        </Option>
                      ))}
                    </Select>
                    <Select
                      className="w-32"
                      value={sortOrder}
                      onChange={setSortOrder}
                      disabled={!sortBy}
                    >
                      <Option value="asc">Ascending</Option>
                      <Option value="desc">Descending</Option>
                    </Select>
                  </div>
                </Space>
              </Card>
            )}

            {/* Export Format */}
            <Card size="small" className="mb-4">
              <Text strong className="block mb-3">
                <DownloadOutlined className="mr-2" />
                Export Format
              </Text>
              <Radio.Group
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full"
              >
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(EXPORT_FORMATS).map(([key, config]) => (
                    <Radio.Button
                      key={key}
                      value={key}
                      className="!h-auto !py-3 !px-4 text-left"
                    >
                      <div className="flex items-center gap-2">
                        {FORMAT_ICONS[key]}
                        <div>
                          <Text strong>{config.label}</Text>
                          <Text type="secondary" className="text-xs block">
                            .{config.extension}
                          </Text>
                        </div>
                      </div>
                    </Radio.Button>
                  ))}
                </div>
              </Radio.Group>
            </Card>

            {/* Generation Mode */}
            <Card size="small">
              <div className="flex items-center justify-between">
                <div>
                  <Text strong>
                    <ThunderboltOutlined className="mr-2" />
                    Background Generation
                  </Text>
                  <Text type="secondary" className="block text-xs">
                    Generate report in background for large datasets
                  </Text>
                </div>
                <Radio.Group
                  value={asyncMode}
                  onChange={(e) => setAsyncMode(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value={true}>Background</Radio.Button>
                  <Radio.Button value={false}>Immediate</Radio.Button>
                </Radio.Group>
              </div>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  const canGoNext = () => {
    if (currentStep === 0) {
      return selectedColumns.length > 0;
    }
    return true;
  };

  const isLastStep = currentStep === steps.length - 1;

  return (
    <Drawer
      title={
        <Space>
          <FileTextOutlined />
          <span>Generate Report</span>
          {selectedReport && (
            <Tag color="blue">{selectedReport.name}</Tag>
          )}
        </Space>
      }
      placement="right"
      size="large"
      open={open}
      onClose={onClose}
      extra={
        <Button onClick={onClose}>Cancel</Button>
      }
      footer={
        <div className="flex justify-between">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setCurrentStep((s) => s - 1)}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Space>
            {isLastStep ? (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleGenerate}
                loading={generating}
                disabled={!canGoNext() || generating}
              >
                Generate Report
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={() => setCurrentStep((s) => s + 1)}
                disabled={!canGoNext()}
              >
                Next
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {loadingConfig ? (
        <div className="py-12 text-center">
          <Spin size="large" tip="Loading report configuration..." />
        </div>
      ) : (
        <div>
          {/* Report Info */}
          {selectedReport && (
            <Alert
              title={selectedReport.name}
              description={selectedReport.description}
              type="info"
              showIcon
              className="mb-4"
            />
          )}

          {/* Steps */}
          <Steps
            current={currentStep}
            items={steps}
            size="small"
            className="mb-6"
          />

          {/* Step Content */}
          <div className="mb-6">{renderStepContent()}</div>

          {/* Templates Sidebar */}
          <Collapse
            ghost
            className="bg-background-tertiary rounded-lg"
            items={[
              {
                key: "templates",
                label: (
                  <Space>
                    <SaveOutlined />
                    <Text strong>Templates</Text>
                  </Space>
                ),
                children: (
                  <TemplateManager
                    onApplyTemplate={handleApplyTemplate}
                    currentConfig={{
                      groupBy,
                      sortBy,
                      sortOrder,
                    }}
                    reportType={selectedReport?.id}
                    selectedColumns={selectedColumns}
                    filters={filterValues}
                  />
                ),
              },
            ]}
          />

          {/* Summary */}
          <Card size="small" className="mt-4 bg-primary-50 border-primary-200">
            <Title level={5} className="!mb-2 text-primary-800">
              Report Summary
            </Title>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <Text type="secondary">Columns:</Text>{" "}
                <Text strong>{selectedColumns.length}</Text>
              </div>
              <div>
                <Text type="secondary">Filters:</Text>{" "}
                <Text strong>
                  {Object.keys(filterValues).filter((k) => filterValues[k]).length}
                </Text>
              </div>
              <div>
                <Text type="secondary">Format:</Text>{" "}
                <Text strong>{EXPORT_FORMATS[format]?.label}</Text>
              </div>
              <div>
                <Text type="secondary">Mode:</Text>{" "}
                <Text strong>{asyncMode ? "Background" : "Immediate"}</Text>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Drawer>
  );
};

export default GenerateReportDrawer;