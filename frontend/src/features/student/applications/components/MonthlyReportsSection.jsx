import React, { useState, useCallback, useMemo, useEffect, memo } from 'react';
import {
  Card, Button, Tag, Empty, Spin, Progress, Select, Popconfirm, Switch,
  Typography, Modal, Alert, Tooltip, Upload
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  FileTextOutlined, UploadOutlined, DeleteOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, EyeOutlined, CalendarOutlined,
  WarningOutlined, InboxOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  MONTH_NAMES,
  getReportSubmissionStatus,
  getSubmissionWindow,
} from '../utils/applicationUtils';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';

const { Text } = Typography;

const MonthlyReportsSection = ({
  application,
  reports = [],
  progress = {},
  loading,
  uploading,
  onUpload,
  onDelete,
  onRefresh,
  hasStarted,
}) => {
  const [fileList, setFileList] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);

  // Auto month detection states
  const [autoMonthSelection, setAutoMonthSelection] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());

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
    if (!application) return monthOptions;

    const startDate = application.startDate || application.joiningDate || application.internship?.startDate;
    const endDate = application.endDate || application.internship?.endDate;

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
  }, [application, selectedYear, monthOptions]);

  // Keep selectedMonth in sync when switching to manual selection
  useEffect(() => {
    if (!autoMonthSelection && allowedMonthOptions.length > 0) {
      if (!allowedMonthOptions.some(o => o.value === selectedMonth)) {
        setSelectedMonth(allowedMonthOptions[0].value);
      }
    }
  }, [autoMonthSelection, allowedMonthOptions, selectedMonth]);

  // Calculate progress - use ONLY counter fields from application object (API)
  const calculatedProgress = useMemo(() => {
    // Use ONLY counter fields from application object, default to 0 if not available
    const total = application?.totalExpectedReports ?? 0;
    const approved = application?.submittedReportsCount ?? 0;
    const pending = total - approved;
    const percentage = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, pending, overdue: 0, percentage };
  }, [application?.totalExpectedReports, application?.submittedReportsCount]);

  // Handle file change
  const handleFileChange = useCallback(({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 10 * 1024 * 1024) {
      toast.error('File size should be less than 10MB');
      return;
    }
    setFileList(newFileList.slice(-1));
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (fileList.length === 0) {
      toast('Please select a file', { icon: '⚠️' });
      return;
    }

    const file = fileList[0]?.originFileObj || fileList[0];
    const monthValue = autoMonthSelection ? dayjs().month() + 1 : selectedMonth;
    const yearValue = autoMonthSelection ? dayjs().year() : selectedYear;

    if (!monthValue || !yearValue) {
      toast('Please select report month and year', { icon: '⚠️' });
      return;
    }

    try {
      await onUpload(application.id, file, monthValue, yearValue);
      setFileList([]);
      setUploadModalVisible(false);
      setAutoMonthSelection(true);
      setSelectedMonth(dayjs().month() + 1);
      setSelectedYear(dayjs().year());
      toast.success('Report uploaded successfully!');
      onRefresh?.();
    } catch (error) {
      // Error handled in hook
    }
  }, [application.id, fileList, autoMonthSelection, selectedMonth, selectedYear, onUpload, onRefresh]);

  // Handle delete
  const handleDeleteReport = useCallback(async (reportId, status) => {
    if (status === 'APPROVED') {
      toast('Approved reports cannot be deleted', { icon: '⚠️' });
      return;
    }
    try {
      await onDelete(reportId);
      onRefresh?.();
    } catch (error) {
      // Error handled in hook
    }
  }, [onDelete, onRefresh]);

  // Open upload modal
  const openUploadModal = useCallback((report = null) => {
    if (report) {
      setSelectedMonth(report.reportMonth);
      setSelectedYear(report.reportYear);
      setAutoMonthSelection(false);
    } else {
      setAutoMonthSelection(true);
      setSelectedMonth(dayjs().month() + 1);
      setSelectedYear(dayjs().year());
    }
    setFileList([]);
    setUploadModalVisible(true);
  }, []);

  // Close upload modal
  const handleCloseUploadModal = useCallback(() => {
    setUploadModalVisible(false);
    setFileList([]);
    setAutoMonthSelection(true);
  }, []);

  // View modal
  const openViewModal = useCallback((report) => {
    setSelectedReport(report);
    setViewModalVisible(true);
  }, []);

  const handleCloseViewModal = useCallback(() => {
    setViewModalVisible(false);
    setSelectedReport(null);
  }, []);

  // Status helpers
  const getStatusTag = useCallback((status) => {
    const config = {
      APPROVED: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
      SUBMITTED: { color: 'processing', icon: <ClockCircleOutlined />, text: 'Submitted' },
      DRAFT: { color: 'default', icon: <FileTextOutlined />, text: 'Pending' },
      CAN_SUBMIT: { color: 'blue', icon: <UploadOutlined />, text: 'Submit Now' },
      OVERDUE: { color: 'error', icon: <ExclamationCircleOutlined />, text: 'Overdue' },
      NOT_YET_DUE: { color: 'default', icon: <ClockCircleOutlined />, text: 'Upcoming' },
    };
    const { color, icon, text } = config[status] || config.DRAFT;
    return <Tag color={color} icon={icon} className="rounded-full text-xs">{text}</Tag>;
  }, []);

  if (!hasStarted) {
    return (
      <Card className="rounded-xl border border-gray-100" styles={{ body: { padding: '24px' } }}>
        <Empty
          image={<CalendarOutlined className="text-4xl text-gray-300" />}
          imageStyle={{ height: 50 }}
          description={
            <div className="text-center">
              <Text className="text-sm text-text-secondary block">Internship not started</Text>
              <Text className="text-xs text-text-tertiary">Reports will be available once your internship begins</Text>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Progress Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-primary block">{calculatedProgress.total}</Text>
          <Text className="text-[10px] text-text-tertiary">Total</Text>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-green-500 block">{calculatedProgress.approved}</Text>
          <Text className="text-[10px] text-text-tertiary">Approved</Text>
        </div>
        <div className="bg-background-secondary rounded-lg p-3 text-center">
          <Text className="text-lg font-bold text-orange-500 block">{calculatedProgress.pending}</Text>
          <Text className="text-[10px] text-text-tertiary">Pending</Text>
        </div>
      </div>

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => openUploadModal()}
          size="small"
          className="rounded-lg"
        >
          Upload Report
        </Button>
      </div>

      {/* Reports List */}
      <Card className="rounded-xl border border-gray-100" styles={{ body: { padding: 0 } }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin size="small" />
          </div>
        ) : reports.length === 0 ? (
          <Empty
            image={<FileTextOutlined className="text-3xl text-gray-300" />}
            imageStyle={{ height: 40 }}
            description={
              <Text className="text-xs text-text-tertiary">No reports yet</Text>
            }
            className="py-8"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {reports.map((report) => {
              const submissionStatus = report.submissionStatus || getReportSubmissionStatus(report);
              const window = getSubmissionWindow(report.reportMonth, report.reportYear);

              return (
                <div key={report.id} className="flex items-center justify-between p-3 hover:bg-background-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CalendarOutlined className="text-primary text-sm" />
                    </div>
                    <div>
                      <Text className="text-sm font-medium block">
                        {MONTH_NAMES[report.reportMonth - 1]} {report.reportYear}
                      </Text>
                      <Text className="text-[10px] text-text-tertiary">
                        {submissionStatus.status === 'APPROVED'
                          ? `Approved ${report.approvedAt ? dayjs(report.approvedAt).format('MMM D') : ''}`
                          : `Due: ${window.windowEndFormatted}`
                        }
                      </Text>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusTag(submissionStatus.status)}

                    {/* Submit button */}
                    {submissionStatus.canSubmit && report.status === 'DRAFT' && (
                      <Tooltip title="Upload report">
                        <Button
                          type="primary"
                          size="small"
                          icon={<UploadOutlined />}
                          onClick={() => openUploadModal(report)}
                          className="rounded"
                        />
                      </Tooltip>
                    )}

                    {/* View button */}
                    {report.reportFileUrl && (
                      <Tooltip title="View">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => openViewModal(report)}
                        />
                      </Tooltip>
                    )}

                    {/* Delete button */}
                    {report.status !== 'APPROVED' && report.reportFileUrl && (
                      <Popconfirm
                        title="Delete this report?"
                        onConfirm={() => handleDeleteReport(report.id, report.status)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Tooltip title="Delete">
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Tooltip>
                      </Popconfirm>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-primary" />
            <span>Upload Monthly Report</span>
          </div>
        }
        open={uploadModalVisible}
        onCancel={handleCloseUploadModal}
        footer={[
          <Button key="cancel" onClick={handleCloseUploadModal}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={fileList.length === 0 || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
            icon={<UploadOutlined />}
          >
            Upload
          </Button>,
        ]}
        width={480}
        destroyOnClose
      >
        <div className="py-4 space-y-4">
          {/* File Upload */}
          <div>
            <Text className="text-xs font-medium block mb-2">Select Report File (PDF)</Text>
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              fileList={fileList}
              onChange={handleFileChange}
              beforeUpload={() => false}
              onRemove={() => setFileList([])}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="text-3xl text-primary" />
              </p>
              <p className="ant-upload-text text-sm">Click or drag PDF file to upload</p>
              <p className="ant-upload-hint text-xs text-text-tertiary">Max 10MB</p>
            </Upload.Dragger>
          </div>

          {/* Auto Month Detection Toggle */}
          <div className="bg-background-secondary rounded-lg p-3 flex items-center justify-between">
            <div>
              <Text className="text-sm font-medium block">Auto-detect month</Text>
              <Text className="text-[10px] text-text-tertiary">
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
              size="small"
            />
          </div>

          {/* Manual Month/Year Selection */}
          {!autoMonthSelection && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Text className="text-xs font-medium block mb-1.5">Month</Text>
                <Select
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={allowedMonthOptions}
                  placeholder="Select month"
                  className="w-full"
                  size="small"
                />
              </div>
              <div>
                <Text className="text-xs font-medium block mb-1.5">Year</Text>
                <Select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  options={yearOptions}
                  placeholder="Select year"
                  className="w-full"
                  size="small"
                />
              </div>
            </div>
          )}

          {/* Info Alert */}
          <Alert
            type="info"
            showIcon
            message={
              <Text className="text-xs">
                {autoMonthSelection
                  ? `Report will be uploaded for ${MONTH_NAMES[dayjs().month()]} ${dayjs().year()}`
                  : `Report will be uploaded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                }
              </Text>
            }
            className="!py-2"
          />
        </div>
      </Modal>

      {/* View Report Modal */}
      <Modal
        title={selectedReport ? `${MONTH_NAMES[selectedReport.reportMonth - 1]} ${selectedReport.reportYear} Report` : 'View Report'}
        open={viewModalVisible}
        onCancel={handleCloseViewModal}
        footer={[
          <Button key="close" onClick={handleCloseViewModal}>Close</Button>,
          selectedReport?.reportFileUrl && (
            <Button
              key="open"
              type="primary"
              onClick={() => openFileWithPresignedUrl(selectedReport.reportFileUrl)}
            >
              Open PDF
            </Button>
          ),
        ]}
        width={600}
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-background-secondary rounded-lg">
              <div>
                <Text className="text-[10px] text-text-tertiary block">Status</Text>
                {getStatusTag(selectedReport.status)}
              </div>
              <div>
                <Text className="text-[10px] text-text-tertiary block">Submitted</Text>
                <Text className="text-sm">
                  {selectedReport.submittedAt
                    ? dayjs(selectedReport.submittedAt).format('MMM D, YYYY')
                    : 'Not submitted'}
                </Text>
              </div>
            </div>

            {selectedReport.reportFileUrl && (
              <div className="border rounded-lg overflow-hidden" style={{ height: '350px' }}>
                <iframe
                  src={selectedReport.reportFileUrl}
                  width="100%"
                  height="100%"
                  title="Report Preview"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

MonthlyReportsSection.displayName = 'MonthlyReportsSection';

export default memo(MonthlyReportsSection);
