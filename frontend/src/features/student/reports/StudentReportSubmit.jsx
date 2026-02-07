import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Card, Table, Button, Modal, Upload, Switch, Select, Alert,
  Tag, Typography, Empty, Spin, Tooltip, Popconfirm, theme
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  PlusOutlined, UploadOutlined, EyeOutlined,
  DeleteOutlined, FileTextOutlined, CalendarOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  fetchStudentDashboard,
  fetchApplications,
  fetchMyReports,
  createReport,
  deleteMonthlyReport,
} from '../store/studentSlice';
import {
  selectDashboardStats,
  selectApplicationsList,
  selectReportsList,
  selectReportsLoading,
  selectActiveInternships,
} from '../store/studentSelectors';
import { openFileWithPresignedUrl } from '../../../utils/imageUtils';
import API from '../../../services/api';

const { Text } = Typography;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const StudentReportSubmit = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  // Redux state
  const dashboardStats = useSelector(selectDashboardStats);
  const allApplications = useSelector(selectApplicationsList);
  const activeInternships = useSelector(selectActiveInternships);
  const allReports = useSelector(selectReportsList);
  const reportsLoading = useSelector(selectReportsLoading);

  // Local state
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);

  // Auto month detection states
  const [autoMonthSelection, setAutoMonthSelection] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());

  // Get active applications (APPROVED or JOINED status)
  const applications = useMemo(() => {
    return activeInternships.length > 0
      ? activeInternships
      : allApplications.filter(app => ['APPROVED', 'JOINED', 'ACTIVE', 'SELECTED'].includes(app.status));
  }, [activeInternships, allApplications]);

  // Month options
  const monthOptions = useMemo(() =>
    MONTH_NAMES.map((name, index) => ({
      value: index + 1,
      label: name,
    })), []
  );

  // Year options
  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => ({
      value: currentYear - i + 1,
      label: (currentYear - i + 1).toString(),
    }));
  }, []);

  // Allowed month options based on internship period
  const allowedMonthOptions = useMemo(() => {
    if (!selectedApplication) return monthOptions;

    const startDate = selectedApplication.startDate || selectedApplication.joiningDate;
    const endDate = selectedApplication.endDate;

    if (!startDate || !endDate) return monthOptions;

    const start = dayjs(startDate).startOf('month');
    const end = dayjs(endDate).endOf('month');

    const options = [];
    let cursor = start.clone();
    while (cursor.isBefore(end) || cursor.isSame(end, 'month')) {
      if (cursor.year() === selectedYear) {
        options.push({
          value: cursor.month() + 1,
          label: cursor.format('MMMM')
        });
      }
      cursor = cursor.add(1, 'month');
    }

    return options.length > 0 ? options : monthOptions;
  }, [selectedApplication, selectedYear, monthOptions]);

  // Sync selectedMonth when switching to manual
  useEffect(() => {
    if (!autoMonthSelection && allowedMonthOptions.length > 0) {
      if (!allowedMonthOptions.some(o => o.value === selectedMonth)) {
        setSelectedMonth(allowedMonthOptions[0].value);
      }
    }
  }, [autoMonthSelection, allowedMonthOptions, selectedMonth]);

  // Fetch data on mount using Redux
  useEffect(() => {
    dispatch(fetchStudentDashboard({}));
    dispatch(fetchApplications({}));
  }, [dispatch]);

  // Set selected application from dashboard or applications
  useEffect(() => {
    if (selectedApplication) return;

    // Try to get current internship from dashboard
    if (dashboardStats?.currentInternship) {
      setSelectedApplication(dashboardStats.currentInternship);
    } else if (applications.length > 0) {
      setSelectedApplication(applications[0]);
    }
  }, [dashboardStats, applications, selectedApplication]);

  // Fetch reports for selected application
  const fetchReports = useCallback(async () => {
    if (!selectedApplication?.id) return;

    setLoading(true);
    try {
      // Use API for application-specific reports (not in global store)
      const response = await API.get(`/student/applications/${selectedApplication.id}/reports`);
      const data = response.data?.reports || [];
      setReports(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to fetch reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedApplication?.id]);

  useEffect(() => {
    fetchReports();
      // Refresh dashboard and applications to update report counts
      dispatch(fetchStudentDashboard({ forceRefresh: true }));
      dispatch(fetchApplications({ forceRefresh: true }));
  }, [fetchReports]);

  // Handle file change
  const handleFileChange = useCallback(({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error('File must be smaller than 5MB');
      return;
    }
    setFileList(newFileList.slice(-1));
  }, []);

  // Open modal
  const handleAdd = useCallback(() => {
    if (!selectedApplication) {
      toast('No active internship found', { icon: '⚠️' });
      return;
    }
    setEditingReport(null);
    setFileList([]);
    setAutoMonthSelection(true);
    setSelectedMonth(dayjs().month() + 1);
    setSelectedYear(dayjs().year());
    setModalVisible(true);
  }, [selectedApplication]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingReport(null);
    setFileList([]);
    setAutoMonthSelection(true);
  }, []);

  // Submit file
  const handleSubmit = useCallback(async () => {
    if (!selectedApplication?.id) {
      toast.error('No active internship selected');
      return;
    }

    if (fileList.length === 0) {
      toast.error('Please select a file to upload');
      return;
    }

    const file = fileList[0]?.originFileObj || fileList[0];
    if (!file) {
      toast.error('Invalid file');
      return;
    }

    const monthValue = autoMonthSelection ? dayjs().month() + 1 : selectedMonth;
    const yearValue = autoMonthSelection ? dayjs().year() : selectedYear;

    if (!monthValue || !yearValue) {
      toast.error('Please select report month and year');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', selectedApplication.id);
      formData.append('reportMonth', monthValue.toString());
      formData.append('reportYear', yearValue.toString());

      let fileUrl = null;
      try {
        const uploadResponse = await API.post('/student/monthly-reports/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = uploadResponse.data?.reportFileUrl || uploadResponse.data?.url;
      } catch (uploadErr) {
        // Fallback to shared documents upload
        const genericFormData = new FormData();
        genericFormData.append('file', file);
        const genericUpload = await API.post('/shared/documents/upload', genericFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        fileUrl = genericUpload.data?.url || genericUpload.data?.path;
      }

      // Step 2: Submit report using Redux action
      await dispatch(createReport({
        applicationId: selectedApplication.id,
        reportMonth: monthValue,
        reportYear: yearValue,
        reportFileUrl: fileUrl,
      })).unwrap();

      toast.success('Report uploaded successfully!');
      handleCloseModal();
      fetchReports();
      // Refresh dashboard, applications, and reports to update counts and pending tags
      dispatch(fetchStudentDashboard({ forceRefresh: true }));
      dispatch(fetchApplications({ forceRefresh: true }));
      dispatch(fetchMyReports({ forceRefresh: true }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, selectedApplication?.id, fileList, autoMonthSelection, selectedMonth, selectedYear, handleCloseModal, fetchReports]);

  // Delete report using Redux
  const handleDelete = useCallback(async (id) => {
    try {
      await dispatch(deleteMonthlyReport(id)).unwrap();
      toast.success('Report deleted');
      fetchReports();
      // Refresh dashboard, applications, and reports to update counts and pending tags
      dispatch(fetchStudentDashboard({ forceRefresh: true }));
      dispatch(fetchApplications({ forceRefresh: true }));
      dispatch(fetchMyReports({ forceRefresh: true }));
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete report';
      toast.error(errorMessage);
    }
  }, [dispatch, fetchReports]);

  // View report
  const handleView = useCallback((url) => {
    if (url) openFileWithPresignedUrl(url);
  }, []);

  // Replace report
  const handleReplace = useCallback((report) => {
    setEditingReport(report);
    setFileList([]);
    setAutoMonthSelection(false);
    setSelectedMonth(report.reportMonth);
    setSelectedYear(report.reportYear);
    setModalVisible(true);
  }, []);

  // Status tag
  const getStatusTag = useCallback((status) => {
    const config = {
      APPROVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
      SUBMITTED: { color: 'processing', icon: <ClockCircleOutlined />, text: 'Submitted' },
      PENDING: { color: 'warning', icon: <ExclamationCircleOutlined />, text: 'Pending' },
      DRAFT: { color: 'default', icon: <FileTextOutlined />, text: 'Draft' },
      REJECTED: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Rejected' },
    };
    const { color, icon, text } = config[status] || config.DRAFT;
    return <Tag color={color} icon={icon} className="rounded-full text-xs">{text}</Tag>;
  }, []);

  // Table columns
  const columns = [
    {
      title: 'Period',
      key: 'period',
      width: 160,
      render: (_, record) => (
        <div className="flex items-center gap-3 py-1">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: token.colorPrimaryBg }}
          >
            <CalendarOutlined className="text-base" style={{ color: token.colorPrimary }} />
          </div>
          <div>
            <Text className="text-sm font-medium block" style={{ color: token.colorText }}>
              {MONTH_NAMES[record.reportMonth - 1]?.slice(0, 3) || record.reportMonth}
            </Text>
            <Text className="text-xs" style={{ color: token.colorTextTertiary }}>{record.reportYear}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'File',
      key: 'file',
      ellipsis: true,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          {record.reportFileUrl && (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: token.colorSuccess }}
            />
          )}
          <Text className="text-sm" style={{ color: record.reportFileUrl ? token.colorText : token.colorTextTertiary }}>
            {record.reportFileUrl ? 'Report uploaded' : 'No file'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => getStatusTag(status),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div className="flex items-center justify-center gap-0.5">
          {record.reportFileUrl && (
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleView(record.reportFileUrl)}
                className="hover:bg-transparent"
              />
            </Tooltip>
          )}
          {record.status !== 'APPROVED' && (
            <>
              <Tooltip title="Replace">
                <Button
                  type="text"
                  size="small"
                  icon={<UploadOutlined />}
                  onClick={() => handleReplace(record)}
                  className="hover:bg-transparent"
                />
              </Tooltip>
              <Popconfirm
                title="Delete this report?"
                onConfirm={() => handleDelete(record.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true, className: 'rounded-lg' }}
                cancelButtonProps={{ className: 'rounded-lg' }}
              >
                <Tooltip title="Delete">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="hover:bg-transparent"
                  />
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </div>
      ),
    },
  ];

  // Stats
  const stats = {
    total: reports.length,
    approved: reports.filter(r => r.status === 'APPROVED').length,
    pending: reports.filter(r => r.status === 'PENDING' || r.status === 'SUBMITTED' || r.status === 'DRAFT').length,
  };

  const isLoading = loading || reportsLoading;

  // No application state
  if (!isLoading && !selectedApplication && applications.length === 0) {
    return (
      <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: token.colorPrimary }} />
          <div>
            <h1 className="text-xl font-bold m-0" style={{ color: token.colorText }}>Monthly Reports</h1>
            <Text className="text-xs" style={{ color: token.colorTextTertiary }}>Track your internship progress</Text>
          </div>
        </div>
        <Card
          className="rounded-2xl shadow-sm border"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '48px 24px' } }}
        >
          <Empty
            image={<FileTextOutlined className="text-5xl" style={{ color: token.colorTextQuaternary }} />}
            imageStyle={{ height: 60 }}
            description={
              <div className="text-center py-3">
                <Text className="text-base font-medium block mb-1" style={{ color: token.colorTextSecondary }}>No Active Internship</Text>
                <Text className="text-sm" style={{ color: token.colorTextTertiary }}>You need an active internship to submit reports</Text>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 min-h-screen" style={{ backgroundColor: token.colorBgLayout }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full" style={{ backgroundColor: token.colorPrimary }} />
          <div>
            <h1 className="text-xl font-bold m-0" style={{ color: token.colorText }}>Monthly Reports</h1>
            <Text className="text-xs" style={{ color: token.colorTextTertiary }}>
              {selectedApplication?.companyName || 'Track your internship progress'}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip title="Refresh">
            <Button
              type="text"
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={fetchReports}
              size="middle"
              className="hover:bg-transparent"
              style={{ color: token.colorTextSecondary }}
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="rounded-lg shadow-sm"
          >
            Upload Report
          </Button>
        </div>
      </div>

      {/* Application Selector (if multiple) */}
      {applications.length > 1 && (
        <Card
          className="rounded-xl shadow-sm border mb-4"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '12px 16px' } }}
        >
          <div className="flex items-center justify-between">
            <Text className="text-xs font-medium" style={{ color: token.colorTextSecondary }}>Select Internship</Text>
            <Select
              value={selectedApplication?.id}
              onChange={(id) => setSelectedApplication(applications.find(a => a.id === id))}
              options={applications.map(app => ({
                value: app.id,
                label: app.companyName || 'Internship',
              }))}
              className="w-56"
              size="small"
            />
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card
          className="rounded-xl shadow-sm border text-center"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '16px 12px' } }}
        >
          <Text className="text-2xl font-bold block leading-none mb-2" style={{ color: token.colorPrimary }}>{stats.total}</Text>
          <Text className="text-[10px] uppercase tracking-wide font-medium" style={{ color: token.colorTextTertiary }}>Total Reports</Text>
        </Card>
        <Card
          className="rounded-xl shadow-sm border text-center"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '16px 12px' } }}
        >
          <Text className="text-2xl font-bold block leading-none mb-2" style={{ color: token.colorSuccess }}>{stats.approved}</Text>
          <Text className="text-[10px] uppercase tracking-wide font-medium" style={{ color: token.colorTextTertiary }}>Approved</Text>
        </Card>
        <Card
          className="rounded-xl shadow-sm border text-center"
          style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
          styles={{ body: { padding: '16px 12px' } }}
        >
          <Text className="text-2xl font-bold block leading-none mb-2" style={{ color: token.colorWarning }}>{stats.pending}</Text>
          <Text className="text-[10px] uppercase tracking-wide font-medium" style={{ color: token.colorTextTertiary }}>Pending</Text>
        </Card>
      </div>

      {/* Reports Table */}
      <Card
        className="rounded-2xl shadow-sm border"
        style={{ borderColor: token.colorBorderSecondary, backgroundColor: token.colorBgContainer }}
        styles={{ body: { padding: 0 } }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spin size="large" />
          </div>
        ) : reports.length === 0 ? (
          <Empty
            image={<FileTextOutlined className="text-5xl" style={{ color: token.colorTextQuaternary }} />}
            imageStyle={{ height: 60 }}
            description={
              <div className="text-center">
                <Text className="text-base font-medium block mb-1" style={{ color: token.colorTextSecondary }}>
                  No reports yet
                </Text>
                <Text className="text-sm" style={{ color: token.colorTextTertiary }}>
                  Upload your first monthly report to get started
                </Text>
              </div>
            }
            className="py-16"
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              size="large"
              className="rounded-lg shadow-sm mt-4"
            >
              Upload Report
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={reports}
            columns={columns}
            rowKey="id"
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              className: 'px-4 pb-4',
            }}
            className="[&_.ant-table-thead>tr>th]:!bg-background-secondary [&_.ant-table-thead>tr>th]:!text-xs [&_.ant-table-thead>tr>th]:!font-semibold [&_.ant-table-thead>tr>th]:!py-3 [&_.ant-table-tbody>tr>td]:!py-3"
          />
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined style={{ color: token.colorPrimary }} />
            <span>{editingReport ? 'Replace Report' : 'Upload Monthly Report'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={[
          <Button key="cancel" onClick={handleCloseModal} className="rounded-lg">
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={submitting}
            onClick={handleSubmit}
            disabled={fileList.length === 0 || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
            icon={<UploadOutlined />}
            className="rounded-lg"
          >
            {editingReport ? 'Replace' : 'Upload'}
          </Button>
        ]}
        width={520}
        destroyOnClose
        className="rounded-2xl"
      >
        <div className="pt-4 space-y-4">
          {/* Replacing info */}
          {editingReport && (
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: token.colorInfoBg, borderColor: token.colorInfoBorder, border: '1px solid' }}
            >
              <Text className="text-xs block mb-1" style={{ color: token.colorTextTertiary }}>Replacing report for</Text>
              <Text className="text-sm font-semibold" style={{ color: token.colorText }}>
                {MONTH_NAMES[editingReport.reportMonth - 1]} {editingReport.reportYear}
              </Text>
            </div>
          )}

          {/* File Upload */}
          <div>
            <Text className="text-xs font-semibold block mb-2" style={{ color: token.colorTextSecondary }}>
              Select Report File (PDF)
            </Text>
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false}
              onRemove={() => setFileList([])}
              style={{
                background: token.colorBgContainer,
                borderColor: token.colorBorder,
                borderRadius: '12px',
              }}
            >
              <p className="ant-upload-drag-icon mb-3">
                <InboxOutlined className="text-4xl" style={{ color: token.colorPrimary }} />
              </p>
              <p className="ant-upload-text text-sm font-medium mb-1" style={{ color: token.colorText }}>
                Click or drag PDF file to upload
              </p>
              <p className="ant-upload-hint text-xs" style={{ color: token.colorTextTertiary }}>
                Maximum file size: 5MB
              </p>
            </Upload.Dragger>
          </div>

          {/* Auto Month Detection Toggle */}
          {!editingReport && (
            <>
              <div
                className="rounded-lg p-3 flex items-center justify-between"
                style={{ backgroundColor: token.colorBgLayout, border: `1px solid ${token.colorBorderSecondary}` }}
              >
                <div>
                  <Text className="text-sm font-medium block mb-0.5" style={{ color: token.colorText }}>
                    Auto-detect month
                  </Text>
                  <Text className="text-xs" style={{ color: token.colorTextTertiary }}>
                    Turn off to select month manually
                  </Text>
                </div>
                <Switch
                  checked={autoMonthSelection}
                  onChange={(checked) => {
                    setAutoMonthSelection(checked);
                    if (checked) {
                      setSelectedMonth(dayjs().month() + 1);
                      setSelectedYear(dayjs().year());
                    }
                  }}
                />
              </div>

              {/* Manual Month/Year Selection */}
              {!autoMonthSelection && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Text className="text-xs font-semibold block mb-2" style={{ color: token.colorTextSecondary }}>
                      Month
                    </Text>
                    <Select
                      value={selectedMonth}
                      onChange={setSelectedMonth}
                      options={allowedMonthOptions}
                      placeholder="Select month"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Text className="text-xs font-semibold block mb-2" style={{ color: token.colorTextSecondary }}>
                      Year
                    </Text>
                    <Select
                      value={selectedYear}
                      onChange={setSelectedYear}
                      options={yearOptions}
                      placeholder="Select year"
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Info Alert */}
              <Alert
                type="info"
                showIcon
                message={
                  <Text className="text-xs" style={{ color: token.colorInfo }}>
                    {autoMonthSelection
                      ? `Report will be uploaded for ${MONTH_NAMES[dayjs().month()]} ${dayjs().year()}`
                      : `Report will be uploaded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                    }
                  </Text>
                }
                className="rounded-lg"
                style={{ padding: '10px 12px' }}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default StudentReportSubmit;
