import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Tabs,
  Descriptions,
  Tag,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Spin,
  Empty,
  Timeline,
  Card,
  Space,
  Divider,
  Avatar,
  Typography,
  Tooltip,
  Upload,
  Popconfirm,
  theme,
  Row,
  Col,
  Switch,
  Alert,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  UserOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined,
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
  LinkOutlined,
  InboxOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDispatch, useSelector } from 'react-redux';
import {
  updateInternship,
  uploadJoiningLetter,
  deleteJoiningLetter,
  deleteMonthlyReport,
  uploadMonthlyReport,
  viewMonthlyReport,
  selectStudents,
} from '../../store/facultySlice';
import { openFileWithPresignedUrl } from '../../../../utils/imageUtils';
import ProfileAvatar from '../../../../components/common/ProfileAvatar';
import MaskedField from '../../../../components/common/MaskedField';
import { getTotalExpectedCount } from '../../../../utils/monthlyCycle';
import UnifiedVisitLogModal from '../../visits/UnifiedVisitLogModal';
import { facultyService } from '../../../../services/faculty.service';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const StudentDetailsModal = ({
  visible,
  student,
  onClose,
  onScheduleVisit,
  onRefresh,
  loading = false,
}) => {
  const { token } = theme.useToken();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditingInternship, setIsEditingInternship] = useState(false);
  const [editForm] = Form.useForm();
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingJoiningLetter, setUploadingJoiningLetter] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [unmaskedData, setUnmaskedData] = useState(null);
  const [deletedReportIds, setDeletedReportIds] = useState([]);
  const { list: studentsList = [] } = useSelector(selectStudents);

  // Report upload modal states
  const [reportUploadModalVisible, setReportUploadModalVisible] = useState(false);
  const [reportFileList, setReportFileList] = useState([]);
  const [autoMonthSelection, setAutoMonthSelection] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(() => dayjs().year());

  // Month options
  const monthOptions = MONTH_NAMES.map((name, index) => ({
    value: index + 1,
    label: name,
  }));

  // Year options
  const yearOptions = (() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => ({
      value: currentYear - i + 1,
      label: (currentYear - i + 1).toString(),
    }));
  })();

  // Function to reveal masked contact details
  const handleRevealContact = async (fieldName) => {
    // If we already have unmasked data, return the specific field
    if (unmaskedData) {
      return unmaskedData[fieldName] || unmaskedData.internship?.[fieldName] || null;
    }

    // Fetch unmasked data from API
    const studentId = studentData?.id || studentData?.student?.id;
    if (!studentId) return null;

    const data = await facultyService.getUnmaskedContactDetails(studentId);
    setUnmaskedData(data);
    return data[fieldName] || data.internship?.[fieldName] || null;
  };

  // Watch start and end dates to auto-calculate duration
  const watchedStartDate = Form.useWatch('startDate', editForm);
  const watchedEndDate = Form.useWatch('endDate', editForm);

  // Calculate duration text from dates
  const calculateDurationText = (start, end) => {
    if (!start || !end) return '';
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    if (!startDate.isValid() || !endDate.isValid() || endDate.isBefore(startDate)) return '';

    const months = endDate.diff(startDate, 'month');
    const days = endDate.diff(startDate.add(months, 'month'), 'day');

    if (months > 0 && days > 0) return `${months} months ${days} days`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''}`;
    const totalDays = endDate.diff(startDate, 'day');
    return `${totalDays} day${totalDays > 1 ? 's' : ''}`;
  };

  // Auto-update duration when dates change
  useEffect(() => {
    if (isEditingInternship && watchedStartDate && watchedEndDate) {
      const duration = calculateDurationText(watchedStartDate, watchedEndDate);
      editForm.setFieldValue('internshipDuration', duration);
    }
  }, [watchedStartDate, watchedEndDate, isEditingInternship, editForm]);

  // Reset state when modal opens/closes or student changes
  useEffect(() => {
    if (visible) {
      setActiveTab('overview');
      setIsEditingInternship(false);
      setUnmaskedData(null); // Reset unmasked data cache
      setDeletedReportIds([]);
    }
  }, [visible, student?.id, student?.student?.id]);

  const currentStudentId = student?.student?.id || student?.id;

  const liveStudentFromStore = useMemo(() => {
    if (!currentStudentId) return null;
    const matched = studentsList.find((item) => {
      const itemStudent = item?.student || item;
      return itemStudent?.id === currentStudentId || item?.id === currentStudentId;
    });
    return matched || null;
  }, [studentsList, currentStudentId]);

  // Helper to get nested data
  const getStudentData = () => {
    const source = liveStudentFromStore || student;
    if (!source) return null;
    return source.student || source;
  };

  const getInternshipApp = () => {
    const s = getStudentData();
    return s?.internshipApplications?.[0] ||
           student?.internshipApplications?.[0] ||
           student?.activeInternship ||
           null;
  };

  const studentData = getStudentData();
  const internshipApp = getInternshipApp();

  // Get visits from nested structure
  const visits = internshipApp?.facultyVisitLogs ||
                 student?.visits ||
                 student?.visitLogs ||
                 [];

  // Get monthly reports from nested structure
  const rawMonthlyReports = internshipApp?.monthlyReports ||
                            studentData?.monthlyReports ||
                            student?.monthlyReports ||
                            [];

  const monthlyReports = rawMonthlyReports.filter((report) => !deletedReportIds.includes(report.id));

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      APPROVED: 'green',
      VERIFIED: 'green',
      ACTIVE: 'green',
      DRAFT: 'default',
    };
    return colors[status] || 'default';
  };

  // Calculate duration (use effectiveInternship for optimistic updates)
  const getDuration = () => {
    const app = localInternshipData || internshipApp;
    if (!app?.startDate || !app?.endDate) return 'N/A';
    const start = dayjs(app.startDate);
    const end = dayjs(app.endDate);
    const months = end.diff(start, 'month');
    const days = end.diff(start.add(months, 'month'), 'day');
    if (months > 0 && days > 0) return `${months} m ${days} d`;
    if (months > 0) return `${months} months`;
    return `${end.diff(start, 'day')} days`;
  };

  /**
   * Calculate total expected reports using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const getExpectedReports = () => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  /**
   * Calculate total expected visits using monthly cycles.
   * Returns total for entire internship period (not just as of today).
   * Always calculates dynamically based on dates to reflect date changes.
   */
  const getExpectedVisits = () => {
    if (!internshipApp?.startDate || !internshipApp?.endDate) return 0;

    const startDate = new Date(internshipApp.startDate);
    const endDate = new Date(internshipApp.endDate);

    return getTotalExpectedCount(startDate, endDate);
  };

  // Local state for optimistic updates
  const [localInternshipData, setLocalInternshipData] = useState(null);

  // Reset local state when modal opens with new student
  useEffect(() => {
    if (visible && internshipApp) {
      setLocalInternshipData(null); // Reset to use original data
    }
  }, [visible, internshipApp?.id]);

  // Get effective internship data (local optimistic or original)
  const effectiveInternship = localInternshipData || internshipApp;

  // Handle edit internship
  const handleEditInternship = () => {
    const app = effectiveInternship;
    if (!app?.id) {
      toast.warning('No internship application found for this student.');
      return;
    }
    editForm.setFieldsValue({
      // Company Info
      companyName: app?.companyName,
      companyAddress: app?.companyAddress || app?.location,
      companyContact: app?.companyContact,
      companyEmail: app?.companyEmail,
      // HR/Supervisor Info
      hrName: app?.hrName,
      hrDesignation: app?.hrDesignation,
      hrContact: app?.hrContact,
      hrEmail: app?.hrEmail,
      // Internship Details
      startDate: app?.startDate ? dayjs(app.startDate) : null,
      endDate: app?.endDate ? dayjs(app.endDate) : null,
      stipend: app?.stipend ? Number(app.stipend) : null,
      internshipDuration: app?.internshipDuration,
      jobProfile: app?.jobProfile,
      // Notes
      notes: app?.notes,
    });
    setIsEditingInternship(true);
  };

  // Save internship changes with optimistic update
  const handleSaveInternship = async () => {
    try {
      const values = await editForm.validateFields();

      // Get the internship ID - check multiple possible sources
      const internshipId = effectiveInternship?.id || internshipApp?.id;
      if (!internshipId) {
        toast.error('No internship application found. Cannot save changes.');
        return;
      }

      setSaving(true);

      const updateData = {
        // Company Information
        companyName: values.companyName,
        companyAddress: values.companyAddress,
        companyContact: values.companyContact,
        companyEmail: values.companyEmail,
        // HR/Supervisor Information
        hrName: values.hrName,
        hrDesignation: values.hrDesignation,
        hrContact: values.hrContact,
        hrEmail: values.hrEmail,
        // Internship Duration & Compensation
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        stipend: values.stipend,
        // Note: internshipDuration is not sent - it's auto-calculated from start/end dates
        jobProfile: values.jobProfile,
        // Notes
        notes: values.notes,
        location: values.companyAddress, // Alias for backend compatibility
      };

      // Optimistic update - immediately update local state
      const optimisticData = {
        ...effectiveInternship,
        ...updateData,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        _isOptimistic: true,
      };
      setLocalInternshipData(optimisticData);
      setIsEditingInternship(false);
      toast.success('Internship details updated successfully');

      // API call in background
      try {
        const response = await dispatch(updateInternship({ internshipId, data: updateData })).unwrap();
        // Update with server response
        if (response?.data) {
          setLocalInternshipData(response.data);
        }
        // Refresh parent data in background (non-blocking)
        onRefresh?.();
      } catch (apiError) {
        // Revert optimistic update on failure
        setLocalInternshipData(null);
        const errorMessage = typeof apiError === 'string' ? apiError : apiError?.message || 'Failed to save changes. Please try again.';
        toast.error(errorMessage);
        setIsEditingInternship(true); // Re-open edit form
      }
    } catch (error) {
      toast.error(error.message || 'Please fill in required fields');
    } finally {
      setSaving(false);
    }
  };

  // Handle visit log success (from UnifiedVisitLogModal)
  const handleVisitSuccess = () => {
    setVisitModalVisible(false);
    onRefresh?.();
  };

  // Handle joining letter upload
  const handleJoiningLetterUpload = async (file) => {
    const applicationId = effectiveInternship?.id || internshipApp?.id;
    if (!applicationId) {
      toast.error('No internship application found. Cannot upload.');
      return false;
    }
    setUploadingJoiningLetter(true);
    try {
      await dispatch(uploadJoiningLetter({ applicationId, file })).unwrap();
      toast.success('Joining report uploaded successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload joining report';
      toast.error(errorMessage);
    } finally {
      setUploadingJoiningLetter(false);
    }
    return false; // Prevent default upload
  };

  // Handle joining letter delete
  const handleDeleteJoiningLetter = async () => {
    const applicationId = effectiveInternship?.id || internshipApp?.id;
    if (!applicationId) {
      toast.error('No internship application found. Cannot delete.');
      return;
    }
    try {
      await dispatch(deleteJoiningLetter(applicationId)).unwrap();
      toast.success('Joining report deleted successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete joining report';
      toast.error(errorMessage);
    }
  };

  // Handle monthly report delete
  const handleDeleteReport = async (reportId) => {
    try {
      await dispatch(deleteMonthlyReport(reportId)).unwrap();
      setDeletedReportIds((prev) => (prev.includes(reportId) ? prev : [...prev, reportId]));
      toast.success('Report deleted successfully');
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete report';
      toast.error(errorMessage);
    }
  };

  // Handle report file change
  const handleReportFileChange = ({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 1 * 1024 * 1024) {
      toast.error('File must be smaller than 1MB');
      return;
    }
    setReportFileList(newFileList.slice(-1));
  };

  // Open report upload modal
  const handleOpenReportUploadModal = () => {
    setReportFileList([]);
    setAutoMonthSelection(true);
    setSelectedMonth(dayjs().month() + 1);
    setSelectedYear(dayjs().year());
    setReportUploadModalVisible(true);
  };

  // Close report upload modal
  const handleCloseReportUploadModal = () => {
    setReportUploadModalVisible(false);
    setReportFileList([]);
    setAutoMonthSelection(true);
  };

  // Handle view report
  const handleViewReport = async (reportId) => {
    try {
      const result = await dispatch(viewMonthlyReport(reportId)).unwrap();
      if (result?.url) {
        window.open(result.url, '_blank');
      } else {
        toast.error('No file available for this report');
      }
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to view report';
      toast.error(errorMessage);
    }
  };

  // Handle monthly report upload submit
  const handleReportUploadSubmit = async () => {
    const applicationId = effectiveInternship?.id || internshipApp?.id;
    if (!applicationId) {
      toast.error('No internship application found. Cannot upload report.');
      return;
    }

    if (reportFileList.length === 0) {
      toast.error('Please select a file to upload');
      return;
    }

    const file = reportFileList[0]?.originFileObj || reportFileList[0];
    if (!file) {
      toast.error('Invalid file');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('File must be smaller than 1MB');
      return;
    }

    const monthValue = autoMonthSelection ? dayjs().month() + 1 : selectedMonth;
    const yearValue = autoMonthSelection ? dayjs().year() : selectedYear;

    if (!monthValue || !yearValue) {
      toast.error('Please select report month and year');
      return;
    }

    setUploadingReport(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('applicationId', applicationId);
      formData.append('month', monthValue.toString());
      formData.append('year', yearValue.toString());

      await dispatch(uploadMonthlyReport(formData)).unwrap();
      toast.success('Monthly report uploaded successfully');
      handleCloseReportUploadModal();
      onRefresh?.();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload report';
      toast.error(errorMessage);
    } finally {
      setUploadingReport(false);
    }
  };

  // View document
  const handleViewDocument = async (url) => {
    if (url) {
      await openFileWithPresignedUrl(url);
    } else {
      toast.info('Document not available');
    }
  };

  // Tab items
  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorPrimary }}>
                {visits.length}<span className="text-xs font-normal" style={{ color: token.colorTextSecondary }}>/{getExpectedVisits()}</span>
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Visits Logged</Text>
            </Card>
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorSuccess }}>
                {monthlyReports.length}<span className="text-xs font-normal" style={{ color: token.colorTextSecondary }}>/{getExpectedReports()}</span>
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Reports Submitted</Text>
            </Card>
            <Card size="small" className="text-center border shadow-sm" style={{ borderColor: token.colorBorder }}>
              <div className="text-xl font-bold" style={{ color: token.colorWarning }}>
                {monthlyReports.filter(r => r.status === 'DRAFT').length}
              </div>
              <Text style={{ color: token.colorTextSecondary }} className="text-xs">Pending Review</Text>
            </Card>
          </div>

          <Row gutter={[16, 16]}>
            {/* Student Info - Left Column */}
            <Col xs={24} md={8}>
              <Card 
                size="small" 
                title={<span className="font-semibold text-sm">Contact Info</span>}
                className="h-full border shadow-sm" 
                style={{ borderColor: token.colorBorder }}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MailOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Email</Text>
                      <MaskedField
                        maskedValue={studentData?.user?.email || studentData?.email}
                        fieldName="email"
                        onReveal={handleRevealContact}
                        className="text-sm break-all"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <PhoneOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Phone</Text>
                      <MaskedField
                        maskedValue={studentData?.user?.phoneNo || studentData?.phone || studentData?.mobileNumber}
                        fieldName="phoneNo"
                        onReveal={handleRevealContact}
                        className="text-sm"
                      />
                    </div>
                  </div>
                  <Divider className="my-2" />
                  <div className="flex items-start gap-2">
                    <BankOutlined className="mt-1" style={{ color: token.colorTextTertiary }} />
                    <div>
                      <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>College & Branch</Text>
                      <Text className="text-sm block">{studentData?.collegeName || studentData?.college?.name || 'N/A'}</Text>
                      <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{studentData?.user?.branchName || studentData?.branchName || studentData?.branch?.name || 'N/A'}</Text>
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Internship Info - Right Column */}
            <Col xs={24} md={16}>
              <Card
                size="small"
                title={
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">Internship Details</span>
                    {!isEditingInternship && effectiveInternship?.id && (
                      <Button type="text" size="small" icon={<EditOutlined />} onClick={handleEditInternship} className="text-xs">Edit</Button>
                    )}
                  </div>
                }
                className="h-full border shadow-sm"
                style={{ borderColor: token.colorBorder }}
              >
                {isEditingInternship ? (
                  <Form form={editForm} layout="vertical" size="small" className="max-h-[60vh] overflow-y-auto pr-2">
                    {/* Company Information */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>Company Information</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="companyName" label="Company Name" rules={[{ required: true }]} className="mb-2">
                        <Input placeholder="Enter company name" />
                      </Form.Item>
                      <Form.Item name="jobProfile" label="Job Profile / Role" className="mb-2">
                        <Input placeholder="e.g., Software Developer Intern" />
                      </Form.Item>
                      <Form.Item name="companyAddress" label="Company Address" className="mb-2 col-span-2">
                        <Input placeholder="Enter company address" />
                      </Form.Item>
                      <Form.Item name="companyContact" label="Company Phone" className="mb-2">
                        <Input placeholder="e.g., +91 9876543210" />
                      </Form.Item>
                      <Form.Item name="companyEmail" label="Company Email" className="mb-2">
                        <Input placeholder="e.g., hr@company.com" type="email" />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* HR/Supervisor Information */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>HR / Supervisor Details</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="hrName" label="HR/Supervisor Name" className="mb-2">
                        <Input placeholder="Enter HR name" />
                      </Form.Item>
                      <Form.Item name="hrDesignation" label="Designation" className="mb-2">
                        <Input placeholder="e.g., HR Manager" />
                      </Form.Item>
                      <Form.Item name="hrContact" label="Contact Number" className="mb-2">
                        <Input placeholder="e.g., +91 9876543210" />
                      </Form.Item>
                      <Form.Item name="hrEmail" label="Email Address" className="mb-2">
                        <Input placeholder="e.g., hr@company.com" type="email" />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* Internship Duration & Stipend */}
                    <Text strong className="text-xs block mb-2" style={{ color: token.colorPrimary }}>Internship Duration & Compensation</Text>
                    <div className="grid grid-cols-2 gap-3">
                      <Form.Item name="startDate" label="Start Date" rules={[{ required: true }]} className="mb-2">
                        <DatePicker className="w-full" format="DD MMM YYYY" />
                      </Form.Item>
                      <Form.Item name="endDate" label="End Date" rules={[{ required: true }]} className="mb-2">
                        <DatePicker className="w-full" format="DD MMM YYYY" />
                      </Form.Item>
                      <Form.Item name="stipend" label="Stipend (₹/month)" className="mb-2">
                        <InputNumber className="w-full" placeholder="e.g., 15000" min={0} />
                      </Form.Item>
                      <Form.Item name="internshipDuration" label="Duration (Auto-calculated)" className="mb-2">
                        <Input placeholder="Select start & end dates" disabled />
                      </Form.Item>
                    </div>

                    <Divider className="my-3" />

                    {/* Notes */}
                    {/* <Form.Item name="notes" label="Notes / Additional Information" className="mb-2">
                      <TextArea rows={2} placeholder="Any additional notes about the internship..." />
                    </Form.Item> */}

                    <div className="flex justify-end gap-2 mt-3 pt-2 border-t" style={{ borderColor: token.colorBorderSecondary }}>
                      <Button size="small" onClick={() => setIsEditingInternship(false)}>Cancel</Button>
                      <Button type="primary" size="small" onClick={handleSaveInternship} loading={saving}>Save Changes</Button>
                    </div>
                  </Form>
                ) : (
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                    {/* Company Name & Status */}
                    <div className="flex justify-between">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Company</Text>
                        <Text strong className="text-sm">{effectiveInternship?.companyName || 'Not Assigned'}</Text>
                      </div>
                      <div className="text-right">
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Status</Text>
                        <Tag color={getStatusColor(effectiveInternship?.status)} className="mr-0">
                          {effectiveInternship?.status || 'N/A'}
                        </Tag>
                      </div>
                    </div>

                    {/* Job Profile & Stipend */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Job Profile / Role</Text>
                        <Text className="text-sm">{effectiveInternship?.jobProfile || 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Stipend (₹/month)</Text>
                        <Text className="text-sm">{effectiveInternship?.stipend ? `₹${Number(effectiveInternship.stipend).toLocaleString('en-IN')}` : 'N/A'}</Text>
                      </div>
                    </div>

                    {/* Duration Details */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Start Date</Text>
                        <Text className="text-sm">{effectiveInternship?.startDate ? dayjs(effectiveInternship.startDate).format('DD MMM YYYY') : 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>End Date</Text>
                        <Text className="text-sm">{effectiveInternship?.endDate ? dayjs(effectiveInternship.endDate).format('DD MMM YYYY') : 'N/A'}</Text>
                      </div>
                      <div>
                        <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Duration</Text>
                        <Text className="text-sm">{getDuration()}</Text>
                      </div>
                    </div>

                    {/* Company Contact Details */}
                    {(effectiveInternship?.companyAddress || effectiveInternship?.companyContact || effectiveInternship?.companyEmail) && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-2" style={{ color: token.colorPrimary }}>Company Contact</Text>
                        <div className="grid grid-cols-1 gap-1">
                          {(effectiveInternship?.companyAddress || effectiveInternship?.location) && (
                            <div className="flex items-start gap-2">
                              <EnvironmentOutlined className="text-xs mt-0.5" style={{ color: token.colorTextTertiary }} />
                              <Text className="text-xs" style={{ color: token.colorTextSecondary }}>
                                {effectiveInternship?.companyAddress || effectiveInternship?.location}
                              </Text>
                            </div>
                          )}
                          {effectiveInternship?.companyContact && (
                            <div className="flex items-center gap-2">
                              <PhoneOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                              <MaskedField
                                maskedValue={effectiveInternship.companyContact}
                                fieldName="companyContact"
                                onReveal={handleRevealContact}
                                className="text-xs"
                                style={{ color: token.colorTextSecondary }}
                              />
                            </div>
                          )}
                          {effectiveInternship?.companyEmail && (
                            <div className="flex items-center gap-2">
                              <MailOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                              <MaskedField
                                maskedValue={effectiveInternship.companyEmail}
                                fieldName="companyEmail"
                                onReveal={handleRevealContact}
                                className="text-xs"
                                style={{ color: token.colorTextSecondary }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* HR/Supervisor Details */}
                    {(effectiveInternship?.hrName || effectiveInternship?.hrContact || effectiveInternship?.hrEmail || effectiveInternship?.hrDesignation) && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-2" style={{ color: token.colorPrimary }}>HR / Supervisor</Text>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Name</Text>
                            <Text className="text-sm">{effectiveInternship?.hrName || 'N/A'}</Text>
                          </div>
                          {effectiveInternship?.hrDesignation && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Designation</Text>
                              <Text className="text-sm">{effectiveInternship.hrDesignation}</Text>
                            </div>
                          )}
                          {effectiveInternship?.hrContact && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Contact</Text>
                              <div className="flex items-center gap-1">
                                <PhoneOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                                <MaskedField
                                  maskedValue={effectiveInternship.hrContact}
                                  fieldName="hrContact"
                                  onReveal={handleRevealContact}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          )}
                          {effectiveInternship?.hrEmail && (
                            <div>
                              <Text className="text-xs block" style={{ color: token.colorTextTertiary }}>Email</Text>
                              <div className="flex items-center gap-1">
                                <MailOutlined className="text-xs" style={{ color: token.colorTextTertiary }} />
                                <MaskedField
                                  maskedValue={effectiveInternship.hrEmail}
                                  fieldName="hrEmail"
                                  onReveal={handleRevealContact}
                                  className="text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {/* {effectiveInternship?.notes && (
                      <div className="pt-2 border-t border-dashed" style={{ borderColor: token.colorBorder }}>
                        <Text className="text-xs font-medium block mb-1" style={{ color: token.colorPrimary }}>Notes</Text>
                        <Text className="text-xs" style={{ color: token.colorTextSecondary }}>{effectiveInternship.notes}</Text>
                      </div>
                    )} */}
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* Joining Letter Section - Compact */}
          <Card size="small" className="border shadow-sm" style={{ borderColor: token.colorBorder }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileTextOutlined style={{ fontSize: '16px', color: token.colorPrimary }} />
                <div>
                  <Text className="font-medium">Joining Report</Text>
                  <div className="text-xs mt-0.5">
                    {effectiveInternship?.joiningLetterUrl ? (
                      <Space size={4}>
                        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
                        <span style={{ color: token.colorSuccess }}>Uploaded</span>
                        <span style={{ color: token.colorTextTertiary }}>•</span>
                        <a
                          onClick={(e) => { e.preventDefault(); handleViewDocument(effectiveInternship.joiningLetterUrl); }}
                          className="hover:underline"
                        >
                          View Document
                        </a>
                      </Space>
                    ) : (
                      <span style={{ color: token.colorTextTertiary }}>Not uploaded yet</span>
                    )}
                  </div>
                </div>
              </div>
              {effectiveInternship?.id && (
                <Space>
                  <Upload
                    showUploadList={false}
                    beforeUpload={handleJoiningLetterUpload}
                    accept=".pdf,.jpg,.jpeg,.png"
                  >
                    <Button
                      size="small"
                      icon={<UploadOutlined />}
                      loading={uploadingJoiningLetter}
                    >
                      {effectiveInternship?.joiningLetterUrl ? 'Replace' : 'Upload'}
                    </Button>
                  </Upload>
                  {effectiveInternship?.joiningLetterUrl && (
                    <Popconfirm
                      title="Delete joining report?"
                      onConfirm={handleDeleteJoiningLetter}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              )}
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: 'visits',
      label: `Visits (${visits.length})`,
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              type="primary"
              icon={<EnvironmentOutlined />}
              onClick={() => setVisitModalVisible(true)}
            >
              Log New Visit
            </Button>
          </div>
          {visits.length > 0 ? (
            <Timeline
              className="mt-2"
              items={visits.map((visit, idx) => ({
                key: idx,
                color: dayjs(visit.visitDate).isAfter(dayjs()) ? 'blue' : 'green',
                children: (
                  <div className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <Text strong>
                          {dayjs(visit.visitDate).format('DD MMM YYYY, hh:mm A')}
                        </Text>
                        <Tag color={visit.visitType === 'PHYSICAL' ? 'green' : visit.visitType === 'VIRTUAL' ? 'blue' : 'orange'} className="ml-2">
                          {visit.visitType || 'PHYSICAL'}
                        </Tag>
                      </div>
                    </div>
                    {visit.visitLocation && (
                      <div className="text-sm mt-1" style={{ color: token.colorTextSecondary }}>
                        <EnvironmentOutlined className="mr-1" />
                        {visit.visitLocation}
                      </div>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="No visits recorded yet" />
          )}
        </div>
      ),
    },
    {
      key: 'reports',
      label: `Reports (${monthlyReports.length})`,
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenReportUploadModal}
            >
              Upload Report
            </Button>
          </div>
          {monthlyReports.length > 0 ? (
            <div className="space-y-3">
              {monthlyReports.map((report, idx) => (
                <Card key={report.id || idx} size="small" className="border shadow-sm" style={{ borderColor: token.colorBorder }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <Text strong>
                        {dayjs().month(report.reportMonth - 1).format('MMMM')} {report.reportYear}
                      </Text>
                      <Tag color={getStatusColor(report.status)} className="ml-2">
                        {report.status}
                      </Tag>
                    </div>
                    <Space size={4}>
                      {report.reportFileUrl && (
                        <Tooltip title="View Report">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewReport(report.id)}
                          />
                        </Tooltip>
                      )}
                      <Popconfirm
                        title="Delete this report?"
                        description="This action cannot be undone."
                        onConfirm={() => handleDeleteReport(report.id)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                      >
                        <Tooltip title="Delete">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </Space>
                  </div>
                  {report.submittedAt && (
                    <Text className="text-xs block mt-1" style={{ color: token.colorTextSecondary }}>
                      Submitted: {dayjs(report.submittedAt).format('DD MMM YYYY')}
                    </Text>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No monthly reports submitted yet" />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-3">
            <ProfileAvatar size={40} profileImage={studentData?.profileImage} className="bg-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Title level={5} className="m-0 truncate">
                  {studentData?.user?.name || studentData?.name || 'Student Details'}
                </Title>
                <Tag className="m-0 text-[10px] uppercase">{studentData?.user?.rollNumber || studentData?.rollNumber}</Tag>
              </div>
              <Text className="text-xs truncate block" style={{ color: token.colorTextSecondary }}>
                {internshipApp?.companyName ? internshipApp.companyName : 'No Active Internship'}
              </Text>
            </div>
          </div>
        }
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>
            Close
          </Button>,
          <Button
            key="visit"
            type="primary"
            icon={<EnvironmentOutlined />}
            onClick={() => setVisitModalVisible(true)}
          >
            Log Visit
          </Button>,
        ]}
        className="student-details-modal"
        styles={{ body: { padding: '16px 24px' } }}
      >
        <Spin spinning={loading}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="small"
            className="mb-0"
          />
        </Spin>
      </Modal>

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        selectedStudent={studentData}
        students={[{ student: studentData, ...student }]}
      />

      {/* Report Upload Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined style={{ color: token.colorPrimary }} />
            <span>Upload Monthly Report</span>
          </div>
        }
        open={reportUploadModalVisible}
        onCancel={handleCloseReportUploadModal}
        footer={[
          <Button key="cancel" onClick={handleCloseReportUploadModal} className="rounded-lg">
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploadingReport}
            onClick={handleReportUploadSubmit}
            disabled={reportFileList.length === 0 || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
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
          {/* File Upload */}
          <div>
            <div className="text-xs font-semibold mb-2" style={{ color: token.colorTextSecondary }}>
              Select Report File (PDF)
            </div>
            <Upload.Dragger
              accept=".pdf"
              maxCount={1}
              fileList={reportFileList}
              onChange={handleReportFileChange}
              beforeUpload={() => false}
              onRemove={() => setReportFileList([])}
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
                Maximum file size: 1MB
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

export default StudentDetailsModal;