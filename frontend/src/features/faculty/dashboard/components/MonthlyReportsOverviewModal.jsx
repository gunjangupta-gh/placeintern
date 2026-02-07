import React, { useMemo, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Modal, Table, Tag, Alert, Typography, Button, Upload, Switch, Select, theme } from 'antd';
import { toast } from 'react-hot-toast';
import {
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusOutlined,
  PlusOutlined,
  UploadOutlined,
  InboxOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { uploadMonthlyReport, fetchMonthlyReports } from '../../store/facultySlice';
import { isMonthIncluded } from '../../../../utils/monthlyCycle';

const { Title, Text } = Typography;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MonthlyReportsOverviewModal = ({ visible, onClose, students = [], monthlyReports = [], onRefresh }) => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();

  // Upload modal states
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

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

  // Student options for selection
  const studentOptions = useMemo(() => {
    return (students || []).map(s => {
      const student = s.student || s;
      return {
        value: student.id,
        label: `${student.user?.name || student.name || 'Unknown'} (${student.user?.rollNumber || student.rollNumber || 'N/A'})`,
      };
    });
  }, [students]);

  // Handle file change
  const handleFileChange = useCallback(({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error('File must be smaller than 5MB');
      return;
    }
    setFileList(newFileList.slice(-1));
  }, []);

  // Open upload modal
  const handleOpenUploadModal = useCallback(() => {
    setFileList([]);
    setSelectedStudentId(null);
    setAutoMonthSelection(true);
    setSelectedMonth(dayjs().month() + 1);
    setSelectedYear(dayjs().year());
    setUploadModalVisible(true);
  }, []);

  // Close upload modal
  const handleCloseUploadModal = useCallback(() => {
    setUploadModalVisible(false);
    setFileList([]);
    setSelectedStudentId(null);
    setAutoMonthSelection(true);
  }, []);

  // Submit uploaded report
  const handleUploadSubmit = useCallback(async () => {
    if (!selectedStudentId) {
      toast.error('Please select a student');
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentId', selectedStudentId);
      formData.append('month', monthValue.toString());
      formData.append('year', yearValue.toString());

      await dispatch(uploadMonthlyReport(formData)).unwrap();

      toast.success('Report uploaded successfully!');
      handleCloseUploadModal();
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Upload failed';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [dispatch, selectedStudentId, fileList, autoMonthSelection, selectedMonth, selectedYear, handleCloseUploadModal, onRefresh]);

  // Generate months for the table (from Nov 2025 to next 6 months)
  const generateMonthColumns = () => {
    const months = [];
    const now = new Date();
    const startMonth = now.getMonth() - 1; // Start from previous month
    const startYear = now.getFullYear();

    for (let i = 0; i < 8; i++) {
      const date = new Date(startYear, startMonth + i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      months.push({
        month: date.getMonth() + 1,
        year,
        label: `${monthName} ${year}`,
        key: `${date.getMonth() + 1}-${year}`,
      });
    }
    return months;
  };

  const monthColumns = generateMonthColumns();

  // Calculate pending reports summary
  const pendingReportsSummary = useMemo(() => {
    const summary = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    monthlyReports.forEach(report => {
      if (report.status === 'DRAFT' || report.status === 'PENDING') {
        const key = `${report.reportMonth}-${report.reportYear}`;
        if (!summary[key]) {
          summary[key] = {
            month: report.reportMonth,
            year: report.reportYear,
            label: `${monthNames[report.reportMonth - 1]} ${report.reportYear}`,
            count: 0,
          };
        }
        summary[key].count++;
      }
    });

    return Object.values(summary);
  }, [monthlyReports]);

  // Build table data with students and their report status per month
  const tableData = useMemo(() => {
    return students.map((studentItem, index) => {
      const student = studentItem.student || studentItem;
      // Get internship from the correct nested path
      const activeApplication = student.internshipApplications?.[0] || studentItem.application;
      const internship = activeApplication?.internship ||
                         student.activeInternship ||
                         studentItem.internship;

      const internshipName = internship?.title || internship?.role || activeApplication?.jobProfile || 'N/A';
      const companyName = internship?.industry?.companyName ||
                          internship?.company?.name ||
                          internship?.companyName ||
                          activeApplication?.companyName ||
                          '';

      const internshipDisplay = companyName
        ? `${internshipName} - ${companyName}`
        : internshipName;

      const internshipType = activeApplication?.applicationType ||
                             (activeApplication?.isSelfIdentified ? 'Self-Identified' : 'Placement') ||
                             internship?.type ||
                             'Self-Identified';

      // Get internship dates from application or internship
      const internshipStartDate = activeApplication?.startDate || internship?.startDate;
      const internshipEndDate = activeApplication?.endDate || internship?.endDate;

      // Get report status for each month
      const monthStatuses = {};
      monthColumns.forEach(col => {
        // Match reports by student ID - check multiple paths for compatibility
        const report = monthlyReports.find(r =>
          (r.studentId === student.id ||
           r.student?.id === student.id ||
           r.application?.studentId === student.id ||
           r.application?.student?.id === student.id) &&
          r.reportMonth === col.month &&
          r.reportYear === col.year
        );

        const monthDate = new Date(col.year, col.month - 1, 1);
        let status = 'future'; // Default: future month

        // Use 10-day rule to check if this month should be included
        const monthIncluded = internshipStartDate && internshipEndDate
          ? isMonthIncluded(internshipStartDate, internshipEndDate, col.year, col.month)
          : false;

        if (!internshipStartDate || !internshipEndDate) {
          // No dates - mark as N/A (internship not properly set up)
          status = 'na';
        } else if (!monthIncluded) {
          // Month doesn't meet 10-day rule - mark as N/A
          status = 'na';
        }

        if (report) {
          status = report.status; // APPROVED, SUBMITTED, DRAFT, REJECTED
        } else if (status !== 'na' && status !== 'future') {
          // Check if this month is in the past (should have a report)
          const now = new Date();
          const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          if (monthDate < currentMonth) {
            status = 'missing';
          }
        }

        monthStatuses[col.key] = status;
      });

      return {
        key: student.id || index,
        studentName: student?.user?.name || student.name || 'Unknown',
        rollNumber: student?.user?.rollNumber || student.rollNumber || student.collegeId || '',
        internship: internshipDisplay,
        internshipType,
        ...monthStatuses,
      };
    });
  }, [students, monthlyReports, monthColumns]);

  // Render status cell
  const renderStatusCell = (status) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircleOutlined style={{ color: '#10b981', fontSize: '18px' }} />;
      case 'SUBMITTED':
        return <CheckCircleOutlined style={{ color: '#3b82f6', fontSize: '18px' }} />;
      case 'DRAFT':
        return <CloseCircleOutlined style={{ color: '#f59e0b', fontSize: '18px' }} />;
      case 'REJECTED':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />;
      case 'missing':
        return <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '18px' }} />;
      case 'na':
        return <Text type="secondary">N/A</Text>;
      case 'future':
        return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;
      default:
        return <MinusOutlined style={{ color: '#d1d5db', fontSize: '14px' }} />;
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      fixed: 'left',
      width: 180,
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
      render: (name, record) => (
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-gray-500">{record.rollNumber}</div>
        </div>
      ),
    },
    {
      title: 'Internship',
      dataIndex: 'internship',
      key: 'internship',
      width: 250,
      render: (text, record) => (
        <div>
          <div className="text-sm">{text}</div>
          <div className="text-xs text-gray-400">({record.internshipType})</div>
        </div>
      ),
    },
    ...monthColumns.map(col => ({
      title: col.label,
      dataIndex: col.key,
      key: col.key,
      width: 100,
      align: 'center',
      render: (status) => renderStatusCell(status),
    })),
  ];

  return (
    <>
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <Title level={4} style={{ margin: 0 }}>Monthly Reports Overview</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenUploadModal}
            className="rounded-lg"
          >
            Upload Report
          </Button>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      centered
      styles={{
        body: { padding: '24px', maxHeight: '70vh', overflowY: 'auto' },
      }}
    >
      {/* Pending Reports Summary */}
      {pendingReportsSummary.length > 0 && (
        <Alert
          type="warning"
          icon={<ExclamationCircleOutlined />}
          message={
            <div>
              <Text strong>Pending Reports Summary</Text>
              <div className="mt-2 flex flex-wrap !gap-2">
                {pendingReportsSummary.map((item, idx) => (
                  <Tag
                    key={idx}
                    style={{
                      borderRadius: '12px',
                      padding: '2px 12px',
                      backgroundColor: '#fef3c7',
                      color: '#f59e0b',
                      border: '1px solid #f59e0b',
                    }}
                  >
                    {item.label}: {item.count} student{item.count > 1 ? 's' : ''}
                  </Tag>
                ))}
              </div>
            </div>
          }
          className="mb-4 rounded-lg"
          style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7' }}
        />
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={tableData}
        pagination={false}
        scroll={{ x: 1200 }}
        size="middle"
        bordered
        className="monthly-reports-table"
      />

      {/* Legend */}
      <div className="mt-4 flex flex-wrap !gap-4 text-sm">
        <div className="flex items-center !gap-2">
          <CheckCircleOutlined style={{ color: '#10b981' }} />
          <span>Approved</span>
        </div>
        <div className="flex items-center !gap-2">
          <CheckCircleOutlined style={{ color: '#3b82f6' }} />
          <span>Submitted</span>
        </div>
        {/* <div className="flex items-center !gap-2">
          <CloseCircleOutlined style={{ color: '#f59e0b' }} />
          <span>Draft/Pending</span>
        </div> */}
        <div className="flex items-center !gap-2">
          <CloseCircleOutlined style={{ color: '#ef4444' }} />
          <span>Missing/Rejected</span>
        </div>
        <div className="flex items-center !gap-2">
          <Text type="secondary">N/A</Text>
          <span>Not Applicable</span>
        </div>
      </div>
    </Modal>

    {/* Upload Modal */}
    <Modal
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined style={{ color: token.colorPrimary }} />
          <span>Upload Monthly Report</span>
        </div>
      }
      open={uploadModalVisible}
      onCancel={handleCloseUploadModal}
      footer={[
        <Button key="cancel" onClick={handleCloseUploadModal} className="rounded-lg">
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          onClick={handleUploadSubmit}
          disabled={fileList.length === 0 || !selectedStudentId || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
          icon={<UploadOutlined />}
          className="rounded-lg"
        >
          Upload
        </Button>
      ]}
      width={520}
      destroyOnClose
      className="rounded-2xl"
    >
      <div className="pt-4 space-y-4">
        {/* Student Selection */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: token.colorTextSecondary }}>
            Select Student
          </div>
          <Select
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            options={studentOptions}
            placeholder="Select a student"
            className="w-full"
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </div>

        {/* File Upload */}
        <div>
          <div className="text-xs font-semibold mb-2" style={{ color: token.colorTextSecondary }}>
            Select Report File (PDF)
          </div>
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
        <div
          className="rounded-lg p-3 flex items-center justify-between"
          style={{ backgroundColor: token.colorBgLayout, border: `1px solid ${token.colorBorderSecondary}` }}
        >
          <div>
            <div className="text-sm font-medium mb-0.5" style={{ color: token.colorText }}>
              Auto-detect month
            </div>
            <div className="text-xs" style={{ color: token.colorTextTertiary }}>
              Turn off to select month manually
            </div>
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
              <div className="text-xs font-semibold mb-2" style={{ color: token.colorTextSecondary }}>
                Month
              </div>
              <Select
                value={selectedMonth}
                onChange={setSelectedMonth}
                options={monthOptions}
                placeholder="Select month"
                className="w-full"
              />
            </div>
            <div>
              <div className="text-xs font-semibold mb-2" style={{ color: token.colorTextSecondary }}>
                Year
              </div>
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
            <span className="text-xs" style={{ color: token.colorInfo }}>
              {autoMonthSelection
                ? `Report will be uploaded for ${MONTH_NAMES[dayjs().month()]} ${dayjs().year()}`
                : `Report will be uploaded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
              }
            </span>
          }
          className="rounded-lg"
          style={{ padding: '10px 12px' }}
        />
      </div>
    </Modal>
    </>
  );
};

export default MonthlyReportsOverviewModal;
