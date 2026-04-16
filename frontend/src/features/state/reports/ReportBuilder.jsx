import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Select,
  Form,
  Button,
  Table,
  Tag,
  Steps,
  Space,
  Typography,
  Empty,
  Spin,
  Tooltip,
  Divider,
  Collapse,
  Badge,
  Tabs,
  Modal,
  Input,
  Switch,
} from 'antd';
import {
  BarChartOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  SettingOutlined,
  SaveOutlined,
  FolderOpenOutlined,
  TableOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  GroupOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  fetchReportCatalog,
  fetchReportConfig,
  generateNewReport,
  fetchReportHistory,
  checkReportStatus,
} from '../store/stateSlice';
import reportService from '../../../services/report.service';
import {
  getActiveReports,
  getFailedReports,
  cancelReport,
  retryReport,
  getQueueStats,
} from '../../../services/reportBuilderApi';
import ColumnSelector from '../../../components/report-builder/ColumnSelector';
import FilterBuilder from '../../../components/report-builder/FilterBuilder';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

// Icon mapping for report categories
const CATEGORY_ICONS = {
  'Student Reports': FileTextOutlined,
  'Mentor Reports': BarChartOutlined,
  'Internship Reports': FileSearchOutlined,
  'Compliance Reports': CheckCircleOutlined,
  'Institute Reports': SettingOutlined,
  'Pending Reports': ClockCircleOutlined,
};

const ReportBuilder = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [groupBy, setGroupBy] = useState(null);
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');
  const [pollingReports, setPollingReports] = useState(new Set());
  const [activeTab, setActiveTab] = useState('builder');

  // Template state
  const [templates, setTemplates] = useState([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isPublicTemplate, setIsPublicTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Queue management state
  const [activeReports, setActiveReports] = useState([]);
  const [failedReports, setFailedReportsState] = useState([]);
  const [queueStats, setQueueStats] = useState({ waiting: 0, active: 0, completed: 0, failed: 0 });
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(2000); // Start with 2s
  const pollingIntervalRef = useRef(2000);
  const isMountedRef = useRef(true); // Track mounted state for cleanup

  const { catalog: catalogData, config, history: historyData, generating, loading, error } = useSelector(
    (state) => state.state.reportBuilder
  );

  // Ensure history is always an array
  const history = useMemo(() => {
    if (Array.isArray(historyData)) {
      return historyData;
    }
    if (historyData?.data && Array.isArray(historyData.data)) {
      return historyData.data;
    }
    return [];
  }, [historyData]);

  // Organize catalog by categories
  const catalogByCategory = useMemo(() => {
    if (!catalogData || typeof catalogData !== 'object') return {};

    // If already organized by category, use as-is
    if (!Array.isArray(catalogData)) {
      return catalogData;
    }

    // If it's an array, group by category
    const grouped = {};
    catalogData.forEach((report) => {
      const category = report.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(report);
    });
    return grouped;
  }, [catalogData]);

  // Flatten catalog for easy lookup
  const allReports = useMemo(() => {
    const reports = [];
    Object.values(catalogByCategory).forEach((categoryReports) => {
      reports.push(...categoryReports);
    });
    return reports;
  }, [catalogByCategory]);

  // Get current report definition
  const currentReport = useMemo(() => {
    if (!selectedType) return null;
    return allReports.find((r) => r.type === selectedType) || config;
  }, [selectedType, allReports, config]);

  // Available columns from config
  const availableColumns = useMemo(() => {
    return config?.columns || currentReport?.columns || [];
  }, [config, currentReport]);

  // Available filters from config
  const availableFilters = useMemo(() => {
    return config?.filters || currentReport?.filters || [];
  }, [config, currentReport]);

  // GroupBy options
  const groupByOptions = useMemo(() => {
    return config?.groupBy || currentReport?.groupBy || [];
  }, [config, currentReport]);

  // Sortable columns
  const sortableColumns = useMemo(() => {
    const sortable = config?.sortableColumns || currentReport?.sortableColumns || [];
    if (sortable.length > 0) return sortable;
    // Fall back to columns marked as sortable
    return availableColumns.filter((col) => col.sortable).map((col) => col.id);
  }, [config, currentReport, availableColumns]);

  // Export formats available
  const exportFormats = useMemo(() => {
    return config?.exportFormats || currentReport?.exportFormats || ['excel', 'csv', 'pdf'];
  }, [config, currentReport]);

  useEffect(() => {
    dispatch(fetchReportCatalog());
    dispatch(fetchReportHistory({ page: 1, limit: 10 }));
  }, [dispatch]);

  // Cleanup on unmount - prevent state updates after component is unmounted
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load templates when report type changes
  useEffect(() => {
    if (selectedType) {
      loadTemplates();
    }
  }, [selectedType]);

  // Load queue data
  const loadQueueData = useCallback(async () => {
    try {
      const [activeRes, failedRes, statsRes] = await Promise.all([
        getActiveReports(),
        getFailedReports(),
        getQueueStats(),
      ]);
      setActiveReports(activeRes.data || []);
      setFailedReportsState(failedRes.data || []);
      setQueueStats(statsRes.data || { waiting: 0, active: 0, completed: 0, failed: 0 });
    } catch (err) {
      console.error('Failed to load queue data:', err);
    }
  }, []);

  // Polling for report status with exponential backoff
  useEffect(() => {
    if (pollingReports.size === 0 && activeReports.length === 0) {
      // Reset polling interval when no active reports
      pollingIntervalRef.current = 2000;
      if (isMountedRef.current) {
        setPollingInterval(2000);
      }
      return;
    }

    const poll = async () => {
      // Check if component is still mounted before processing
      if (!isMountedRef.current) return;

      let hasChanges = false;
      const reportIds = Array.from(pollingReports);

      for (const id of reportIds) {
        // Check mounted state before each async operation
        if (!isMountedRef.current) return;

        try {
          const result = await dispatch(checkReportStatus(id)).unwrap();

          // Check mounted state after async operation
          if (!isMountedRef.current) return;

          if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
            hasChanges = true;
            setPollingReports((prev) => {
              const updated = new Set(prev);
              updated.delete(id);
              return updated;
            });
            if (result.status === 'completed') {
              toast.success(`Report completed successfully and available in history tab to download!`);
            } else if (result.status === 'failed') {
              toast.error(`Report generation failed: ${result.errorMessage || 'Unknown error'}`);
            }
          }
        } catch (err) {
          console.error('Failed to check report status:', err);
        }
      }

      // Check mounted state before queue refresh
      if (!isMountedRef.current) return;

      // Refresh queue data
      await loadQueueData();

      // Check mounted state before final state updates
      if (!isMountedRef.current) return;

      if (hasChanges) {
        // Reset interval on changes
        pollingIntervalRef.current = 2000;
        setPollingInterval(2000);
        dispatch(fetchReportHistory({ page: 1, limit: 10 }));
      } else {
        // Exponential backoff: double interval up to 30 seconds
        const newInterval = Math.min(pollingIntervalRef.current * 1.5, 30000);
        pollingIntervalRef.current = newInterval;
        setPollingInterval(newInterval);
      }
    };

    const timeoutId = setTimeout(poll, pollingIntervalRef.current);
    return () => clearTimeout(timeoutId);
  }, [pollingReports, activeReports.length, dispatch, loadQueueData]);

  // Initial load of queue data
  useEffect(() => {
    loadQueueData();
  }, [loadQueueData]);

  const loadTemplates = async () => {
    if (!selectedType) return;
    setLoadingTemplates(true);
    try {
      const data = await reportService.getTemplates(selectedType);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTypeSelect = async (type) => {
    setSelectedType(type);
    setSelectedColumns([]);
    setFilterValues({});
    setGroupBy(null);
    setSortBy(null);
    form.resetFields();
    setCurrentStep(1);

    try {
      const configResult = await dispatch(fetchReportConfig(type)).unwrap();
      // Auto-select default columns
      if (configResult?.columns) {
        const defaultCols = configResult.columns
          .filter((col) => col.default)
          .map((col) => col.id);
        setSelectedColumns(defaultCols);
      }
    } catch (err) {
      toast.error('Failed to load report configuration');
    }
  };

  const handleGenerate = async () => {
    if (!selectedType) {
      toast.error('Please select a report type');
      return;
    }

    if (selectedColumns.length === 0) {
      toast.error('Please select at least one column');
      return;
    }

    setCurrentStep(2);

    const reportData = {
      type: selectedType,
      columns: selectedColumns,
      filters: filterValues,
      groupBy,
      sortBy,
      sortOrder,
      format: selectedFormat,
    };

    try {
      const result = await dispatch(generateNewReport(reportData)).unwrap();
      toast.success('Report generation started!');
      const reportId = result?.reportId || result?.id;
      if (reportId) {
        setPollingReports((prev) => new Set(prev).add(reportId));
      }
      setCurrentStep(3);
      dispatch(fetchReportHistory({ page: 1, limit: 10 }));
    } catch (err) {
      toast.error(err?.message || err || 'Failed to generate report');
      setCurrentStep(1);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }

    try {
      await reportService.saveTemplate({
        name: templateName.trim(),
        description: templateDescription.trim(),
        reportType: selectedType,
        configuration: {
          columns: selectedColumns,
          filters: filterValues,
          groupBy,
          sortBy,
          sortOrder,
        },
        isPublic: isPublicTemplate,
      });
      toast.success('Template saved successfully!');
      setTemplateModalVisible(false);
      setTemplateName('');
      setTemplateDescription('');
      setIsPublicTemplate(false);
      loadTemplates();
    } catch (err) {
      toast.error('Failed to save template');
    }
  };

  const handleLoadTemplate = (template) => {
    const config = template.configuration || template;
    setSelectedColumns(config.columns || []);
    setFilterValues(config.filters || {});
    setGroupBy(config.groupBy || null);
    setSortBy(config.sortBy || null);
    setSortOrder(config.sortOrder || 'asc');
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      await reportService.deleteTemplate(templateId);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleCancelReport = async (reportId) => {
    try {
      await cancelReport(reportId);
      toast.success('Report cancelled successfully');
      // Remove from polling
      setPollingReports((prev) => {
        const updated = new Set(prev);
        updated.delete(reportId);
        return updated;
      });
      // Refresh data
      await loadQueueData();
      dispatch(fetchReportHistory({ page: 1, limit: 10 }));
    } catch (err) {
      toast.error(err.message || 'Failed to cancel report');
    }
  };

  const handleRetryReport = async (reportId) => {
    try {
      const result = await retryReport(reportId);
      toast.success('Report retry queued successfully');
      // Add to polling
      setPollingReports((prev) => new Set(prev).add(reportId));
      // Refresh data
      await loadQueueData();
      dispatch(fetchReportHistory({ page: 1, limit: 10 }));
    } catch (err) {
      toast.error(err.message || 'Failed to retry report');
    }
  };

  const handleDeleteReport = async (reportId) => {
    try {
      await reportService.deleteReport(reportId);
      toast.success('Report deleted successfully');
      await loadQueueData();
      dispatch(fetchReportHistory({ page: 1, limit: 10 }));
    } catch (err) {
      toast.error(err.message || 'Failed to delete report');
    }
  };

  const handleDownload = async (reportId, format) => {
    const toastId = toast.loading('Downloading report...');
    try {
      const blob = await reportService.downloadReport(reportId);

      if (!blob || blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }


      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'excel' ? 'xlsx' : format;
      link.download = `report_${dayjs().format('YYYY-MM-DD_HHmmss')}.${extension}`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.dismiss(toastId);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      console.error('[ReportBuilder] Download error:', err);
      toast.dismiss(toastId);
      toast.error(err.message || 'Failed to download report');
    }
  };

  const getCategoryIcon = (category) => {
    const IconComponent = CATEGORY_ICONS[category] || FileTextOutlined;
    return <IconComponent />;
  };

  const getStatusTag = (status) => {
    const statusConfig = {
      pending: { color: 'blue', icon: <ClockCircleOutlined /> },
      processing: { color: 'orange', icon: <SyncOutlined spin /> },
      completed: { color: 'green', icon: <CheckCircleOutlined /> },
      failed: { color: 'red', icon: <CloseCircleOutlined /> },
    };

    const cfg = statusConfig[status] || statusConfig.pending;
    return (
      <Tag color={cfg.color} icon={cfg.icon}>
        {status?.toUpperCase()}
      </Tag>
    );
  };

  const getFormatIcon = (format) => {
    const icons = {
      pdf: <FilePdfOutlined className="text-red-500" />,
      excel: <FileExcelOutlined className="text-green-500" />,
      csv: <FileTextOutlined className="text-blue-500" />,
      json: <FileTextOutlined className="text-yellow-500" />,
    };
    return icons[format] || icons.excel;
  };

  const historyColumns = [
    {
      title: 'Report',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          {getFormatIcon(record.format)}
          <div>
            <Text strong>{name || record.type?.replace(/-/g, ' ')}</Text>
            <br />
            <Text type="secondary" className="text-xs">{record.type}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY HH:mm'),
    },
    {
      title: 'Action',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'completed' && (
            <>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => handleDownload(record.id, record.format)}
                size="small"
              >
                Download
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteReport(record.id)}
                size="small"
                danger
              />
            </>
          )}
          {(record.status === 'processing' || record.status === 'pending') && (
            <>
              <Tag icon={<SyncOutlined spin />} color="processing">
                Processing...
              </Tag>
              <Button
                icon={<StopOutlined />}
                onClick={() => handleCancelReport(record.id)}
                size="small"
                danger
              >
                Cancel
              </Button>
            </>
          )}
          {(record.status === 'failed' || record.status === 'cancelled') && (
            <>
              <Tooltip title={record.errorMessage || 'Report failed'}>
                <Tag color="error" icon={<ExclamationCircleOutlined />}>
                  {record.status === 'cancelled' ? 'Cancelled' : 'Failed'}
                </Tag>
              </Tooltip>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => handleRetryReport(record.id)}
                size="small"
              >
                Retry
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteReport(record.id)}
                size="small"
                danger
              />
            </>
          )}
        </Space>
      ),
    },
  ];

  const renderCatalog = () => (
    <div className="space-y-4">
      {Object.entries(catalogByCategory).map(([category, reports]) => (
        <Card
          key={category}
          size="small"
          title={
            <Space>
              {getCategoryIcon(category)}
              <span>{category}</span>
              <Badge count={reports.length} style={{ backgroundColor: '#1890ff' }} />
            </Space>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {reports.map((report) => (
              <div
                key={report.type}
                className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:shadow-sm ${
                  selectedType === report.type ? 'border-blue-500 bg-blue-50' : ''
                }`}
                onClick={() => handleTypeSelect(report.type)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Text strong>{report.name}</Text>
                    <Paragraph type="secondary" className="text-xs mb-0 mt-1" ellipsis={{ rows: 2 }}>
                      {report.description}
                    </Paragraph>
                  </div>
                  {selectedType === report.type && (
                    <CheckCircleOutlined className="text-blue-500" />
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <Tag size="small">{report.columnsCount || 0} columns</Tag>
                  <Tag size="small">{report.filtersCount || 0} filters</Tag>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );

  const renderConfiguration = () => {
    if (!selectedType) {
      return (
        <Empty
          description="Select a report type from the catalog"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return (
      <div className="space-y-6">
        {/* Templates */}
        {templates.length > 0 && (
          <Card size="small" title={<><FolderOpenOutlined /> Saved Templates</>}>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Tag
                  key={template.id}
                  className="cursor-pointer"
                  onClick={() => handleLoadTemplate(template)}
                  closable
                  onClose={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteTemplate(template.id);
                  }}
                >
                  {template.name}
                </Tag>
              ))}
            </div>
          </Card>
        )}

        {/* Filters - shown prominently outside collapse */}
        {availableFilters.length > 0 && (
          <Card
            size="small"
            title={
              <Space>
                <FilterOutlined style={{ color: '#1890ff' }} />
                <span style={{ fontWeight: 600 }}>Filters</span>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>(Optional - Select to filter data)</Text>
              </Space>
            }
            style={{ border: '1px solid #d9d9d9', borderRadius: 8 }}
            styles={{ header: { background: '#fafafa', borderBottom: '1px solid #f0f0f0' } }}
          >
            <FilterBuilder
              filters={availableFilters}
              reportType={selectedType}
              values={filterValues}
              onChange={setFilterValues}
              compact={false}
            />
          </Card>
        )}

        {/* Columns */}
        <Collapse defaultActiveKey={['columns']} ghost>
          <Panel
            header={
              <Space>
                <TableOutlined />
                <span>Columns</span>
                <Badge count={selectedColumns.length} style={{ backgroundColor: '#52c41a' }} />
              </Space>
            }
            key="columns"
          >
            <ColumnSelector
              columns={availableColumns}
              selectedColumns={selectedColumns}
              onChange={setSelectedColumns}
              showSort={true}
            />
          </Panel>

          {/* Grouping & Sorting */}
          {(groupByOptions.length > 0 || sortableColumns.length > 0) && (
            <Panel
              header={
                <Space>
                  <GroupOutlined />
                  <span>Grouping & Sorting</span>
                </Space>
              }
              key="grouping"
            >
              <Row gutter={16}>
                {groupByOptions.length > 0 && (
                  <Col xs={24} sm={12}>
                    <Form.Item label="Group By">
                      <Select
                        allowClear
                        placeholder="Select grouping"
                        value={groupBy}
                        onChange={setGroupBy}
                        className="w-full"
                      >
                        {groupByOptions.map((opt) => (
                          <Option key={opt} value={opt}>
                            {opt.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                )}
                {sortableColumns.length > 0 && (
                  <>
                    <Col xs={24} sm={8}>
                      <Form.Item label="Sort By">
                        <Select
                          allowClear
                          placeholder="Select column"
                          value={sortBy}
                          onChange={setSortBy}
                          className="w-full"
                        >
                          {sortableColumns.map((col) => {
                            const colDef = availableColumns.find((c) => c.id === col);
                            return (
                              <Option key={col} value={col}>
                                {colDef?.label || col}
                              </Option>
                            );
                          })}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={4}>
                      <Form.Item label="Order">
                        <Select value={sortOrder} onChange={setSortOrder} className="w-full">
                          <Option value="asc">Asc</Option>
                          <Option value="desc">Desc</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </>
                )}
              </Row>
            </Panel>
          )}
        </Collapse>

        {/* Export Format */}
        <Card size="small" title={<><SettingOutlined /> Export Settings</>}>
          <Row gutter={16} align="middle">
            <Col xs={24} sm={12}>
              <Form.Item label="Format" className="mb-0">
                <Select
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                  className="w-full"
                  size="large"
                >
                  {exportFormats.includes('excel') && (
                    <Option value="excel">
                      <Space>
                        <FileExcelOutlined className="text-green-500" />
                        Excel (.xlsx)
                      </Space>
                    </Option>
                  )}
                  {exportFormats.includes('csv') && (
                    <Option value="csv">
                      <Space>
                        <FileTextOutlined className="text-blue-500" />
                        CSV (.csv)
                      </Space>
                    </Option>
                  )}
                  {exportFormats.includes('pdf') && (
                    <Option value="pdf">
                      <Space>
                        <FilePdfOutlined className="text-red-500" />
                        PDF (.pdf)
                      </Space>
                    </Option>
                  )}
                  {exportFormats.includes('json') && (
                    <Option value="json">
                      <Space>
                        <FileTextOutlined className="text-yellow-500" />
                        JSON (.json)
                      </Space>
                    </Option>
                  )}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Space className="w-full justify-end">
                <Button
                  icon={<SaveOutlined />}
                  onClick={() => setTemplateModalVisible(true)}
                  disabled={selectedColumns.length === 0}
                >
                  Save Template
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Generate Button */}
        <Button
          type="primary"
          size="large"
          block
          loading={generating}
          disabled={!selectedType || selectedColumns.length === 0}
          icon={<BarChartOutlined />}
          onClick={handleGenerate}
        >
          {generating ? 'Generating Report...' : 'Generate Report'}
        </Button>
      </div>
    );
  };

  return (
    <div className="">
      <Card title="Report Builder" variant="borderless">
        <Steps current={currentStep} className="mb-6" size="small">
        <Steps.Step title="Select Type" description="Choose report" />
        <Steps.Step title="Configure" description="Set columns & filters" />
        <Steps.Step title="Generate" description="Queue report" />
        <Steps.Step title="Download" description="Get your report" />
      </Steps>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              Builder
            </span>
          }
          key="builder"
        >
          <Row gutter={24}>
            <Col xs={24} lg={10}>
              <Card
                title={
                  <Space>
                    <FolderOpenOutlined />
                    <span>Report Catalog</span>
                  </Space>
                }
                loading={loading && Object.keys(catalogByCategory).length === 0}
                className="mb-4"
                styles={{ body: { maxHeight: 600, overflow: 'auto' } }}
              >
                {renderCatalog()}
              </Card>
            </Col>

            <Col xs={24} lg={14}>
              <Card
                title={
                  <Space>
                    <SettingOutlined />
                    <span>Configuration</span>
                    {currentReport && (
                      <Tag color="blue">{currentReport.name || selectedType}</Tag>
                    )}
                  </Space>
                }
                loading={loading && selectedType && !config}
              >
                {renderConfiguration()}
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <LoadingOutlined spin={activeReports.length > 0} style={{ display: activeReports.length > 0 ? 'inline' : 'none' }} />
              <ClockCircleOutlined style={{ display: activeReports.length > 0 ? 'none' : 'inline' }} />
              Queue
              {(activeReports.length > 0 || failedReports.length > 0) && (
                <Badge
                  count={activeReports.length + failedReports.length}
                  className="ml-2"
                  size="small"
                  style={{ backgroundColor: activeReports.length > 0 ? '#1890ff' : '#ff4d4f' }}
                />
              )}
            </span>
          }
          key="queue"
        >
          <Row gutter={16}>
            {/* Queue Stats */}
            <Col span={24} className="mb-4">
              <Card size="small">
                <Row gutter={16}>
                  <Col xs={12} sm={6}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">{queueStats.waiting}</div>
                      <Text type="secondary">Waiting</Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">{queueStats.active}</div>
                      <Text type="secondary">Active</Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">{queueStats.completed}</div>
                      <Text type="secondary">Completed</Text>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-500">{queueStats.failed}</div>
                      <Text type="secondary">Failed</Text>
                    </div>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Active Reports */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <SyncOutlined spin={activeReports.length > 0} />
                    <span>Active Reports</span>
                    <Badge count={activeReports.length} style={{ backgroundColor: '#1890ff' }} />
                  </Space>
                }
                extra={
                  <Text type="secondary" className="text-xs">
                    Polling every {Math.round(pollingInterval / 1000)}s
                  </Text>
                }
              >
                {activeReports.length === 0 ? (
                  <Empty description="No active reports" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div className="space-y-3">
                    {activeReports.map((report) => (
                      <div key={report.id} className="p-3 border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getFormatIcon(report.format)}
                          <div>
                            <Text strong>{report.reportName || report.reportType?.replace(/-/g, ' ')}</Text>
                            <br />
                            <Text type="secondary" className="text-xs">
                              {dayjs(report.createdAt).format('MMM DD, HH:mm')}
                            </Text>
                          </div>
                        </div>
                        <Space>
                          <Tag icon={<SyncOutlined spin />} color={report.status === 'processing' ? 'orange' : 'blue'}>
                            {report.status === 'processing' ? 'Processing' : 'Pending'}
                          </Tag>
                          <Button
                            icon={<StopOutlined />}
                            size="small"
                            danger
                            onClick={() => handleCancelReport(report.id)}
                          >
                            Cancel
                          </Button>
                        </Space>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Failed Reports */}
            <Col xs={24} lg={12}>
              <Card
                title={
                  <Space>
                    <ExclamationCircleOutlined />
                    <span>Failed / Cancelled</span>
                    <Badge count={failedReports.length} style={{ backgroundColor: '#ff4d4f' }} />
                  </Space>
                }
              >
                {failedReports.length === 0 ? (
                  <Empty description="No failed reports" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <div className="space-y-3">
                    {failedReports.map((report) => (
                      <div key={report.id} className="p-3 border rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getFormatIcon(report.format)}
                          <div>
                            <Text strong>{report.reportName || report.reportType?.replace(/-/g, ' ')}</Text>
                            <br />
                            <Tooltip title={report.errorMessage}>
                              <Text type="danger" className="text-xs">
                                {report.errorMessage?.slice(0, 40) || 'Unknown error'}
                                {report.errorMessage?.length > 40 && '...'}
                              </Text>
                            </Tooltip>
                          </div>
                        </div>
                        <Space>
                          <Tag color={report.status === 'cancelled' ? 'default' : 'error'}>
                            {report.status === 'cancelled' ? 'Cancelled' : 'Failed'}
                          </Tag>
                          <Button
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={() => handleRetryReport(report.id)}
                          >
                            Retry
                          </Button>
                          <Button
                            icon={<DeleteOutlined />}
                            size="small"
                            danger
                            onClick={() => handleDeleteReport(report.id)}
                          />
                        </Space>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <FileSearchOutlined />
              History
              {history.length > 0 && (
                <Badge count={history.length} className="ml-2" size="small" />
              )}
            </span>
          }
          key="history"
        >
          <Card
            title={
              <Space>
                <FileSearchOutlined />
                <span>Report History</span>
              </Space>
            }
            extra={
              <Button
                icon={<SyncOutlined />}
                onClick={() => dispatch(fetchReportHistory({ page: 1, limit: 10 }))}
                loading={loading}
              >
                Refresh
              </Button>
            }
          >
            {loading && history.length === 0 ? (
              <div className="py-8 text-center">
                <Spin size="large" />
              </div>
            ) : history.length === 0 ? (
              <Empty
                description="No reports generated yet"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                columns={historyColumns}
                dataSource={history}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                }}
              />
            )}
          </Card>
        </TabPane>
      </Tabs>
      </Card>

      {/* Save Template Modal */}
      <Modal
        title="Save Template"
        open={templateModalVisible}
        onOk={handleSaveTemplate}
        onCancel={() => setTemplateModalVisible(false)}
        okText="Save"
      >
        <Form layout="vertical">
          <Form.Item label="Template Name" required>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Enter template name"
            />
          </Form.Item>
          <Form.Item label="Description">
            <Input.TextArea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </Form.Item>
          <Form.Item label="Make Public">
            <Switch
              checked={isPublicTemplate}
              onChange={setIsPublicTemplate}
            />
            <Text type="secondary" className="ml-2">
              Other users can use this template
            </Text>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReportBuilder;
