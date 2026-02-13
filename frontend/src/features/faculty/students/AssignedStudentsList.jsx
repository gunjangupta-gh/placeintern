import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card,
  List,
  Typography,
  Spin,
  Row,
  Col,
  Tag,
  Input,
  Button,
  Tabs,
  Empty,
  Timeline,
  Upload,
  Tooltip,
  Dropdown,
  Modal,
  Form,
  Select,
  Popconfirm,
  theme,
  Grid,
  Switch,
  Alert,
} from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchAssignedStudents,
  selectStudents,
  uploadJoiningLetter,
  uploadMonthlyReport,
  uploadStudentDocument,
  toggleStudentStatus,
  optimisticallyToggleStudentStatus,
  rollbackStudentOperation,
  viewMonthlyReport,
  deleteMonthlyReport,
} from '../store/facultySlice';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import {
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  TeamOutlined,
  IdcardOutlined,
  BookOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  BulbOutlined,
  LaptopOutlined,
  EnvironmentOutlined,
  BankOutlined,
  UploadOutlined,
  EyeOutlined,
  CalendarOutlined,
  MoreOutlined,
  EditOutlined,
  StopOutlined,
  PlayCircleOutlined,
  InboxOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import StudentDetailsModal from '../dashboard/components/StudentDetailsModal';
import UnifiedVisitLogModal from '../visits/UnifiedVisitLogModal';
import FacultyStudentModal from './FacultyStudentModal';
import MaskedField from '../../../components/common/MaskedField';
import { facultyService } from '../../../services/faculty.service';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const AssignedStudentsList = () => {
  const dispatch = useDispatch();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const studentsState = useSelector(selectStudents);
  const students = studentsState?.list || [];
  const loading = studentsState?.loading || false;

  // Local state
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [visitModalVisible, setVisitModalVisible] = useState(false);
  const [uploadingJoiningLetter, setUploadingJoiningLetter] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);

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

  // Document upload modal state
  const [uploadDocumentModal, setUploadDocumentModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Edit student modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);

  // Unmasked data cache
  const [unmaskedData, setUnmaskedData] = useState(null);

  // Function to reveal masked contact details
  const handleRevealContact = async (fieldName) => {
    // If we already have unmasked data for this student, return the specific field
    if (unmaskedData && unmaskedData.studentId === selectedStudent?.id) {
      return unmaskedData[fieldName] || unmaskedData.internship?.[fieldName] || null;
    }

    // Fetch unmasked data from API
    const studentId = selectedStudent?.id;
    if (!studentId) return null;

    const data = await facultyService.getUnmaskedContactDetails(studentId);
    setUnmaskedData(data);
    return data[fieldName] || data.internship?.[fieldName] || null;
  };

  // Reset unmasked data when selected student changes
  useEffect(() => {
    setUnmaskedData(null);
  }, [selectedStudent?.id]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchAssignedStudents());
  }, [dispatch]);

  // Process students data
  const processedStudents = useMemo(() => {
    if (!Array.isArray(students)) return [];
    return students.map(item => {
      const student = item.student || item;
      return {
        ...student,
        assignmentId: item.id !== student.id ? item.id : null,
        branchName: student.user?.branchName || student.branchName || student.branch?.name || 'N/A',
        activeInternship: student.internshipApplications?.find(
          app => app.internshipPhase === 'ACTIVE' && !app.completionDate
        ),
        hasPendingApps: student.internshipApplications?.some(
          app => app.status === 'APPLIED' || app.status === 'UNDER_REVIEW'
        ),
        internshipApplications: student.internshipApplications || [],
        _original: item,
      };
    });
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return processedStudents.filter(student => {
      const matchSearch =
        !search ||
        student?.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        student?.user?.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
        student?.user?.email?.toLowerCase().includes(search.toLowerCase());

      return matchSearch;
    });
  }, [processedStudents, search]);

  // Select first student when list changes
  useEffect(() => {
    if (filteredStudents.length > 0 && !selectedStudent && screens.md) {
      handleStudentSelect(filteredStudents[0]);
    }
  }, [filteredStudents, screens.md]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    if (!screens.md) {
      setTimeout(() => {
        const element = document.getElementById('student-details-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleRefresh = useCallback(() => {
    dispatch(fetchAssignedStudents({ forceRefresh: true }));
  }, [dispatch]);

  // Get active internship application for the selected student
  const getActiveApplication = useCallback(() => {
    if (!selectedStudent) return null;
    return selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0] || null;
  }, [selectedStudent]);

  // Handle visit log success
  const handleVisitSuccess = useCallback(() => {
    setVisitModalVisible(false);
    handleRefresh();
  }, [handleRefresh]);

  // Handle joining report upload
  const handleJoiningLetterUpload = async (file) => {
    const app = getActiveApplication();
    if (!app?.id) {
      toast.error('No active internship application found');
      return false;
    }

    setUploadingJoiningLetter(true);
    try {
      await dispatch(uploadJoiningLetter({ applicationId: app.id, file })).unwrap();
      toast.success('Joining Report uploaded successfully');
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload joining report';
      toast.error(errorMessage);
    } finally {
      setUploadingJoiningLetter(false);
    }
    return false;
  };

  // Handle report file change
  const handleReportFileChange = ({ fileList: newFileList }) => {
    const file = newFileList[0]?.originFileObj;
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error('File must be smaller than 5MB');
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

  // Handle delete report
  const handleDeleteReport = async (reportId) => {
    try {
      await dispatch(deleteMonthlyReport(reportId)).unwrap();
      toast.success('Report deleted successfully');
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to delete report';
      toast.error(errorMessage);
    }
  };

  // Handle monthly report upload submit
  const handleReportUploadSubmit = async () => {
    const app = getActiveApplication();
    if (!app?.id) {
      toast.error('No active internship application found');
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
      formData.append('applicationId', app.id);
      formData.append('month', monthValue.toString());
      formData.append('year', yearValue.toString());

      await dispatch(uploadMonthlyReport(formData)).unwrap();
      toast.success('Monthly report uploaded successfully');
      handleCloseReportUploadModal();
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload report';
      toast.error(errorMessage);
    } finally {
      setUploadingReport(false);
    }
  };

  // Handle document upload
  const handleDocumentUpload = async () => {
    try {
      const values = await uploadForm.validateFields();
      if (fileList.length === 0) {
        toast.error('Please select a file to upload');
        return;
      }

      setUploading(true);
      const file = fileList[0].originFileObj || fileList[0];

      await dispatch(uploadStudentDocument({
        studentId: selectedStudent.id,
        file: file,
        type: values.documentType
      })).unwrap();
      toast.success('Document uploaded successfully');
      setUploadDocumentModal(false);
      uploadForm.resetFields();
      setFileList([]);
      handleRefresh();
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to upload document';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // Handle activate/deactivate student with optimistic update
  const handleToggleStatus = async () => {
    if (!selectedStudent) return;

    const studentId = selectedStudent.id;
    const newStatus = selectedStudent?.user?.active === false ? true : false;
    const previousList = [...students];

    setTogglingStatus(true);

    // Optimistic update - update UI immediately
    dispatch(optimisticallyToggleStudentStatus({ studentId, isActive: newStatus }));

    // Update selected student locally
    setSelectedStudent(prev => prev ? { ...prev, user: { ...prev.user, active: newStatus } } : null);

    try {
      await dispatch(toggleStudentStatus({
        studentId,
        isActive: newStatus
      })).unwrap();
      toast.success(`Student ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      // Rollback on error
      dispatch(rollbackStudentOperation({ list: previousList }));
      setSelectedStudent(prev => prev ? { ...prev, user: { ...prev.user, active: !newStatus } } : null);
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to update student status';
      toast.error(errorMessage);
    } finally {
      setTogglingStatus(false);
    }
  };

  // Document type options
  const documentTypeOptions = [
    { value: 'MARKSHEET_10TH', label: '10th Marksheet' },
    { value: 'MARKSHEET_12TH', label: '12th Marksheet' },
    { value: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
    { value: 'PHOTO', label: 'Photo' },
    { value: 'OTHER', label: 'Other' },
  ];

  // Edit modal handlers
  const openEditModal = () => {
    const studentId = selectedStudent?.id || selectedStudent?.student?.id;
    setEditingStudentId(studentId);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setEditingStudentId(null);
  };

  const handleEditModalSuccess = (updatedData) => {
    if (updatedData && selectedStudent) {
      setSelectedStudent(prev => prev ? { ...prev, ...updatedData } : null);
    }
    handleRefresh();
  };

  // Three-dot menu items
  const getActionMenuItems = () => [
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: 'Upload Document',
      onClick: () => setUploadDocumentModal(true),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Profile',
      onClick: openEditModal,
    },
    {
      type: 'divider',
    },
    {
      key: 'toggle',
      icon: selectedStudent?.user?.active === false ? <PlayCircleOutlined /> : <StopOutlined />,
      label: selectedStudent?.user?.active === false ? 'Activate Student' : 'Deactivate Student',
      danger: selectedStudent?.user?.active !== false,
      onClick: handleToggleStatus,
    },
  ];

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  const getInternshipStatusTag = (student) => {
    if (student.activeInternship) {
      return <Tag icon={<CheckCircleOutlined />} color="success" bordered={false}>Active Internship</Tag>;
    }
    if (student.hasPendingApps) {
      return <Tag icon={<ClockCircleOutlined />} color="warning" bordered={false}>Pending Approval</Tag>;
    }
    const appCount = student.internshipApplications?.length || 0;
    if (appCount > 0) {
      return <Tag color="blue" bordered={false}>{appCount} Applications</Tag>;
    }
    return <Tag color="default" bordered={false}>No Applications</Tag>;
  };

  // Get visits from selected student
  const getStudentVisits = () => {
    if (!selectedStudent) return [];
    const app = selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0];
    return app?.facultyVisitLogs || [];
  };

  // Get monthly reports from selected student
  const getStudentReports = () => {
    if (!selectedStudent) return [];
    const app = selectedStudent.activeInternship || selectedStudent.internshipApplications?.[0];
    return app?.monthlyReports || [];
  };

  const tabItems = [
    {
      key: '1',
      label: <span><UserOutlined /> Personal Info</span>,
      children: selectedStudent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, padding: 16 }}>
          <Card title="Basic Information" bordered={false} style={{ backgroundColor: token.colorBgLayout }} size="small">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', rowGap: 12 }}>
              <div style={{ color: token.colorTextSecondary }}>Gender</div>
              <div>{selectedStudent.gender || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Category</div>
              <div>
                {selectedStudent.category ? (
                  <Tag color="blue" bordered={false}>{selectedStudent.category}</Tag>
                ) : 'N/A'}
              </div>

              <div style={{ color: token.colorTextSecondary }}>Roll Number</div>
              <div>{selectedStudent?.user?.rollNumber || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Batch</div>
              <div>{selectedStudent.batchName || selectedStudent.batch?.name || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Branch</div>
              <div>{selectedStudent?.user?.branchName || selectedStudent.branchName || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Year / Semester</div>
              <div>
                {selectedStudent.currentYear && selectedStudent.currentSemester
                  ? `Year ${selectedStudent.currentYear} / Sem ${selectedStudent.currentSemester}`
                  : selectedStudent.semester ? `Sem ${selectedStudent.semester}` : 'N/A'}
              </div>

              {/* <div style={{ color: token.colorTextSecondary }}>CGPA</div>
              <div>{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</div> */}
            </div>
          </Card>

          <Card title="Contact Information" bordered={false} style={{ backgroundColor: token.colorBgLayout }} size="small">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', rowGap: 12 }}>
              <div style={{ color: token.colorTextSecondary }}>Email</div>
              <div style={{ wordBreak: 'break-all' }}>
                <MaskedField
                  maskedValue={selectedStudent?.user?.email}
                  fieldName="email"
                  onReveal={handleRevealContact}
                />
              </div>

              <div style={{ color: token.colorTextSecondary }}>Contact</div>
              <div>
                <MaskedField
                  maskedValue={selectedStudent?.user?.phoneNo || selectedStudent.phone || selectedStudent.mobileNumber}
                  fieldName="phoneNo"
                  onReveal={handleRevealContact}
                />
              </div>

              <div style={{ color: token.colorTextSecondary }}>Address</div>
              <div>{selectedStudent.address || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>City</div>
              <div>{selectedStudent.city || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>State</div>
              <div>{selectedStudent.state || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Pin Code</div>
              <div>{selectedStudent.pinCode || selectedStudent.pincode || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Guardian Name</div>
              <div>{selectedStudent.guardianName || selectedStudent.parentName || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Guardian Contact</div>
              <div>{selectedStudent.guardianPhone || selectedStudent.parentContact || 'N/A'}</div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><LaptopOutlined /> Internships ({selectedStudent?.internshipApplications?.length || 0})</span>,
      children: (
        <div style={{ padding: 16 }}>
          {(selectedStudent?.internshipApplications || []).length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {(selectedStudent.internshipApplications || []).map((app, index) => (
                <Card
                  key={app.id || index}
                  style={{
                    borderRadius: token.borderRadiusLG,
                    borderLeft: `4px solid ${
                      app.internshipPhase === 'ACTIVE'
                        ? token.colorSuccess
                        : app.internshipPhase === 'COMPLETED'
                        ? token.colorPrimary
                        : token.colorWarning
                    }`,
                    backgroundColor: token.colorBgContainer
                  }}
                  size="small"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>
                        {app.companyName || app.internship?.industry?.companyName || 'Company'}
                      </div>
                      {app.jobProfile && (
                        <div style={{ fontSize: 13, color: token.colorTextSecondary }}>{app.jobProfile}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                      <Tag color={
                        app.internshipPhase === 'COMPLETED' ? 'success'
                        : app.internshipPhase === 'ACTIVE' ? 'processing'
                        : app.status === 'JOINED' ? 'blue'
                        : 'warning'
                      } bordered={false}>
                        {app.internshipPhase || app.status}
                      </Tag>
                      {app.isSelfIdentified && (
                        <Tag color="purple" icon={<BankOutlined />} bordered={false}>Self Identified</Tag>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    {app.stipend && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>Stipend:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>₹{app.stipend}/mo</span>
                      </div>
                    )}
                    {app.internshipDuration && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>Duration:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>{app.internshipDuration} mos</span>
                      </div>
                    )}
                    {app.startDate && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>Start:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>{formatDate(app.startDate)}</span>
                      </div>
                    )}
                    {app.endDate && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>End:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>{formatDate(app.endDate)}</span>
                      </div>
                    )}
                  </div>

                  {app.companyAddress && (
                    <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextDescription }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />
                      {app.companyAddress}
                    </div>
                  )}

                  {/* Visit and Report counts */}
                  <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, display: 'flex', gap: 16, fontSize: 12 }}>
                    <span>
                      <CheckCircleOutlined style={{ marginRight: 4, color: token.colorSuccess }} />
                      Visits: {app.facultyVisitLogs?.length || 0}
                    </span>
                    <span>
                      <FileTextOutlined style={{ marginRight: 4, color: token.colorPrimary }} />
                      Reports: {app.monthlyReports?.length || 0}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No internship applications yet" style={{ padding: 48 }} />
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: <span><EnvironmentOutlined /> Visits ({getStudentVisits().length})</span>,
      children: (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => setVisitModalVisible(true)}
              disabled={!getActiveApplication()}
            >
              Log Visit
            </Button>
          </div>
          {getStudentVisits().length > 0 ? (
            <Timeline
              style={{ marginTop: 8 }}
              items={getStudentVisits().map((visit, idx) => ({
                key: idx,
                color: visit.status === 'COMPLETED' ? 'green' : 'blue',
                children: (
                  <Card size="small" style={{ borderRadius: token.borderRadiusLG, marginBottom: 8, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Text strong>
                            {dayjs(visit.visitDate).format('DD MMM YYYY, hh:mm A')}
                          </Text>
                          {visit.visitNumber && (
                            <Tag color="default" bordered={false} style={{ fontSize: 11 }}>
                              Visit #{visit.visitNumber}
                            </Tag>
                          )}
                          <Tag
                            color={visit.visitType === 'PHYSICAL' ? 'green' : visit.visitType === 'VIRTUAL' ? 'blue' : 'orange'}
                            bordered={false}
                          >
                            {visit.visitType || 'PHYSICAL'}
                          </Tag>
                        </div>
                      </div>
                      <Tag color={visit.status === 'COMPLETED' ? 'success' : 'processing'} bordered={false}>
                        {visit.status || 'Logged'}
                      </Tag>
                    </div>
                    {visit.visitLocation && (
                      <div style={{ fontSize: 13, marginTop: 4, color: token.colorTextSecondary }}>
                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                        {visit.visitLocation}
                      </div>
                    )}
                    {visit.remarks && (
                      <div style={{ fontSize: 13, marginTop: 8, color: token.colorText }}>
                        {visit.remarks}
                      </div>
                    )}
                  </Card>
                ),
              }))}
            />
          ) : (
            <div style={{ textAlign: 'center', color: token.colorTextDescription, padding: 48, backgroundColor: token.colorBgLayout, borderRadius: token.borderRadiusLG }}>
              <EnvironmentOutlined style={{ fontSize: 32, marginBottom: 12, color: token.colorTextDisabled }} />
              <div>No visits logged yet</div>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: <span><FileTextOutlined /> Reports ({getStudentReports().length})</span>,
      children: (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenReportUploadModal}
              disabled={!getActiveApplication()}
            >
              Upload Report
            </Button>
          </div>
          {getStudentReports().length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
              {getStudentReports().map((report, idx) => (
                <Card
                  key={report.id || idx}
                  size="small"
                  style={{
                    borderRadius: token.borderRadiusLG,
                    borderLeft: `4px solid ${
                      report.status === 'APPROVED' ? token.colorSuccess
                      : report.status === 'DRAFT' ? token.colorWarning
                      : token.colorPrimary
                    }`,
                    backgroundColor: token.colorBgContainer
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Text strong>
                        {dayjs().month(report.reportMonth - 1).format('MMMM')} {report.reportYear}
                      </Text>
                    </div>
                    <Tag color={
                      report.status === 'APPROVED' ? 'success'
                      : report.status === 'DRAFT' ? 'warning'
                      : 'processing'
                    } bordered={false}>
                      {report.status}
                    </Tag>
                  </div>
                  {report.submittedAt && (
                    <Text style={{ fontSize: 12, display: 'block', marginTop: 8, color: token.colorTextDescription }}>
                      Submitted: {formatDate(report.submittedAt)}
                    </Text>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
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
                      title="Delete Report"
                      description="Are you sure you want to delete this report?"
                      onConfirm={() => handleDeleteReport(report.id)}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                      cancelText="Cancel"
                    >
                      <Tooltip title="Delete Report">
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: token.colorTextDescription, padding: 48, backgroundColor: token.colorBgLayout, borderRadius: token.borderRadiusLG }}>
              <FileTextOutlined style={{ fontSize: 32, marginBottom: 12, color: token.colorTextDisabled }} />
              <div>No monthly reports submitted yet</div>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={3} style={{ color: token.colorTextHeading, margin: 0 }}>
            Assigned Students
          </Title>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        {/* Students List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={6} xl={6}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', color: token.colorPrimary }}>
                <TeamOutlined style={{ marginRight: 8 }} /> Students Directory
                <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {filteredStudents.length} / {processedStudents.length}
                </Text>
              </div>
            }
            bordered={false}
            style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary, height: screens.md ? 'calc(100vh - 120px)' : '50vh', minHeight: 400, display: 'flex', flexDirection: 'column' }}
            styles={{
              body: { padding: 0, overflowY: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' },
              header: { backgroundColor: token.colorFillAlter, borderBottom: `1px solid ${token.colorBorderSecondary}` },
            }}
          >
            <div
              style={{ overflowY: 'auto', padding: 8, flex: 1 }}
            >
              <Input
                placeholder="Search Student..."
                style={{ marginBottom: 12 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<SearchOutlined style={{ color: token.colorTextDisabled }} />}
                allowClear
              />

              {loading && processedStudents.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
                  <Spin size="small" tip="Loading students..." />
                </div>
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={filteredStudents}
                  locale={{ emptyText: 'No students found' }}
                  renderItem={(student) => (
                    <List.Item
                      onClick={() => handleStudentSelect(student)}
                      style={{
                        cursor: 'pointer',
                        margin: '4px 0',
                        padding: '8px 12px',
                        borderRadius: token.borderRadiusLG,
                        backgroundColor: selectedStudent?.id === student.id ? token.colorPrimaryBg : 'transparent',
                        borderLeft: `4px solid ${selectedStudent?.id === student.id ? token.colorPrimary : 'transparent'}`,
                        transition: 'none'
                      }}
                    >
                      <List.Item.Meta
                        avatar={
                          <ProfileAvatar
                            profileImage={student.profileImage}
                            size={44}
                            style={{ border: `1px solid ${selectedStudent?.id === student.id ? token.colorPrimary : token.colorBorderSecondary}` }}
                          />
                        }
                        title={
                          <Text style={{ fontWeight: 600, fontSize: 14 }}>
                            {student?.user?.name || student?.name}
                          </Text>
                        }
                        description={
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {(student?.user?.branchName || student.branchName) && (
                                <Tag color="blue" bordered={false} style={{ fontSize: 10, lineHeight: '16px', height: 18 }}>{student?.user?.branchName || student.branchName}</Tag>
                              )}
                              {getInternshipStatusTag(student)}
                            </div>
                            <div style={{ fontSize: 12, color: token.colorTextDescription }}>
                              <IdcardOutlined style={{ marginRight: 4 }} />
                              {student?.user?.rollNumber || student?.rollNumber}
                              {student.semester && (
                                <span style={{ marginLeft: 8 }}>| Sem {student.semester}</span>
                              )}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </Card>
        </Col>

        {/* Student Details - Right Column */}
        <Col xs={24} sm={24} md={16} lg={18} xl={18} id="student-details-section">
          {selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: screens.md ? 'calc(100vh - 120px)' : 'auto', overflowY: 'auto', paddingRight: 4 }}>
              {/* Profile Header */}
              <Card
                bordered={false}
                style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
                    <ProfileAvatar
                      profileImage={selectedStudent.profileImage}
                      size={90}
                      style={{ border: `4px solid ${token.colorBgContainer}`, boxShadow: token.boxShadow }}
                    />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Title level={3} style={{ margin: 0, color: token.colorTextHeading }}>
                          {selectedStudent?.user?.name || selectedStudent?.name}
                        </Title>
                        {/* Three-dot action menu */}
                        <Dropdown
                          menu={{ items: getActionMenuItems() }}
                          trigger={['click']}
                          placement="bottomRight"
                        >
                          <Button
                            type="text"
                            icon={<MoreOutlined style={{ fontSize: 20 }} />}
                            loading={togglingStatus}
                          />
                        </Dropdown>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', color: token.colorTextSecondary, marginBottom: 8 }}>
                        <IdcardOutlined style={{ marginRight: 8 }} />
                        {selectedStudent?.user?.rollNumber || selectedStudent?.rollNumber}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(selectedStudent?.user?.branchName || selectedStudent.branchName) && (
                          <Tag color="blue" bordered={false}>
                            {selectedStudent?.user?.branchName || selectedStudent.branchName}
                          </Tag>
                        )}
                        {selectedStudent.category && (
                          <Tag color="purple" bordered={false}>
                            {selectedStudent.category}
                          </Tag>
                        )}
                        {(selectedStudent.batchName || selectedStudent.batch?.name) && (
                          <Tag color="cyan" bordered={false}>
                            {selectedStudent.batchName || selectedStudent.batch?.name}
                          </Tag>
                        )}
                        {selectedStudent.semester && (
                          <Tag color="geekblue" bordered={false}>
                            <BookOutlined style={{ marginRight: 4 }} />
                            Semester {selectedStudent.semester}
                          </Tag>
                        )}
                        {getInternshipStatusTag(selectedStudent)}
                      </div>
                    </div>
                  </div>

                  {/* Contact Quick Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: 12, borderRadius: token.borderRadius, backgroundColor: token.colorFillAlter }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <MailOutlined style={{ color: token.colorPrimary, fontSize: 18, marginRight: 12 }} />
                      <div>
                        <div style={{ fontSize: 11, color: token.colorTextDescription }}>Email</div>
                        <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-all' }}>
                          <MaskedField
                            maskedValue={selectedStudent?.user?.email}
                            fieldName="email"
                            onReveal={handleRevealContact}
                          />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <PhoneOutlined style={{ color: token.colorSuccess, fontSize: 18, marginRight: 12 }} />
                      <div>
                        <div style={{ fontSize: 11, color: token.colorTextDescription }}>Contact</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          <MaskedField
                            maskedValue={selectedStudent?.user?.phoneNo || selectedStudent.phone || selectedStudent.mobileNumber}
                            fieldName="phoneNo"
                            onReveal={handleRevealContact}
                          />
                        </div>
                      </div>
                    </div>
                    {/* <div style={{ display: 'flex', alignItems: 'center' }}>
                      <BulbOutlined style={{ color: token.colorWarning, fontSize: 18, marginRight: 12 }} />
                      <div>
                        <div style={{ fontSize: 11, color: token.colorTextDescription }}>CGPA</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedStudent.cgpa ? selectedStudent.cgpa.toFixed(2) : 'N/A'}</div>
                      </div>
                    </div> */}
                  </div>
                </div>
              </Card>

              {/* Detailed Information in Tabs */}
              <Card bordered={false} style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary }} styles={{ body: { padding: 0 } }}>
                <Tabs
                  defaultActiveKey="1"
                  items={tabItems}
                  style={{ padding: '0 16px' }}
                />
              </Card>
            </div>
          ) : (
            <Card style={{ height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: token.borderRadiusLG, border: `1px dashed ${token.colorBorder}` }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <UserOutlined style={{ fontSize: 48, color: token.colorTextDisabled, marginBottom: 16 }} />
                <Title level={4} style={{ color: token.colorTextSecondary }}>Select a Student</Title>
                <Text type="secondary">Choose a student from the directory to view detailed information and track their internship progress.</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Student Detail Modal */}
      <StudentDetailsModal
        visible={detailModalVisible}
        student={selectedStudent?._original || selectedStudent}
        onClose={() => setDetailModalVisible(false)}
        onRefresh={handleRefresh}
        loading={loading}
      />

      {/* Unified Visit Log Modal */}
      <UnifiedVisitLogModal
        visible={visitModalVisible}
        onClose={() => setVisitModalVisible(false)}
        onSuccess={handleVisitSuccess}
        selectedStudent={selectedStudent}
        students={[{ student: selectedStudent, ...selectedStudent?._original }]}
      />

      {/* Upload Document Modal */}
      <Modal
        title="Upload Document"
        open={uploadDocumentModal}
        onCancel={() => {
          setUploadDocumentModal(false);
          uploadForm.resetFields();
          setFileList([]);
        }}
        onOk={handleDocumentUpload}
        confirmLoading={uploading}
        okText="Upload"
        centered
        destroyOnClose
        transitionName=""
        maskTransitionName=""
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            name="documentType"
            label="Document Type"
            rules={[{ required: true, message: 'Please select document type' }]}
          >
            <Select placeholder="Select document type" options={documentTypeOptions} />
          </Form.Item>
          <Form.Item
            label="Select File"
            required
          >
            <Upload
              beforeUpload={(file) => {
                const isUnderLimit = file.size / 1024 <= 500;
                if (!isUnderLimit) {
                  toast.error('File must be less than 500KB.');
                  return Upload.LIST_IGNORE;
                }
                setFileList([file]);
                return false;
              }}
              fileList={fileList}
              onRemove={() => setFileList([])}
              maxCount={1}
              listType="picture"
            >
              <Button icon={<UploadOutlined />}>Select File (Max 500KB)</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Student Modal */}
      <FacultyStudentModal
        open={isEditModalOpen}
        onClose={handleEditModalClose}
        studentId={editingStudentId}
        studentData={selectedStudent}
        onSuccess={handleEditModalSuccess}
      />

      {/* Report Upload Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileTextOutlined style={{ color: token.colorPrimary }} />
            <span>Upload Monthly Report</span>
          </div>
        }
        open={reportUploadModalVisible}
        onCancel={handleCloseReportUploadModal}
        footer={[
          <Button key="cancel" onClick={handleCloseReportUploadModal}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={uploadingReport}
            onClick={handleReportUploadSubmit}
            disabled={reportFileList.length === 0 || (!autoMonthSelection && (!selectedMonth || !selectedYear))}
            icon={<UploadOutlined />}
          >
            Upload
          </Button>
        ]}
        width={520}
        destroyOnClose
        centered
      >
        <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* File Upload */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: token.colorTextSecondary }}>
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
                borderRadius: 12,
              }}
            >
              <p style={{ marginBottom: 12 }}>
                <InboxOutlined style={{ fontSize: 32, color: token.colorPrimary }} />
              </p>
              <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, color: token.colorText }}>
                Click or drag PDF file to upload
              </p>
              <p style={{ fontSize: 12, color: token.colorTextTertiary }}>
                Maximum file size: 5MB
              </p>
            </Upload.Dragger>
          </div>

          {/* Auto Month Detection Toggle */}
          <div
            style={{
              borderRadius: 8,
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: token.colorBgLayout,
              border: `1px solid ${token.colorBorderSecondary}`
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, color: token.colorText }}>
                Auto-detect month
              </div>
              <div style={{ fontSize: 12, color: token.colorTextTertiary }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: token.colorTextSecondary }}>
                  Month
                </div>
                <Select
                  value={selectedMonth}
                  onChange={setSelectedMonth}
                  options={monthOptions}
                  placeholder="Select month"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: token.colorTextSecondary }}>
                  Year
                </div>
                <Select
                  value={selectedYear}
                  onChange={setSelectedYear}
                  options={yearOptions}
                  placeholder="Select year"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Info Alert */}
          <Alert
            type="info"
            showIcon
            message={
              <span style={{ fontSize: 12, color: token.colorInfo }}>
                {autoMonthSelection
                  ? `Report will be uploaded for ${MONTH_NAMES[dayjs().month()]} ${dayjs().year()}`
                  : `Report will be uploaded for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`
                }
              </span>
            }
            style={{ borderRadius: 8, padding: '10px 12px' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AssignedStudentsList;