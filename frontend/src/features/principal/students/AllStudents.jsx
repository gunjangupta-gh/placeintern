import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  List,
  Typography,
  Spin,
  Row,
  Col,
  Tag,
  Input,
  Modal,
  Upload,
  Form,
  Button,
  Select,
  Tabs,
  Empty,
  Dropdown,
  theme,
  Grid,
} from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStudents,
  fetchPrincipalDashboard,
  updateStudent,
  uploadStudentDocument,
  fetchStudentDocuments,
  fetchStudentById,
  toggleStudentStatus,
} from '../store/principalSlice';
import {
  selectStudentsList,
  selectStudentsLoading,
  selectStudentsPagination,
} from '../store/principalSelectors';
import ProfileAvatar from '../../../components/common/ProfileAvatar';
import {
  SearchOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  EditOutlined,
  StopOutlined,
  TeamOutlined,
  IdcardOutlined,
  BookOutlined,
  FileTextOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  BulbOutlined,
  LaptopOutlined,
  SettingOutlined,
  LoadingOutlined,
  KeyOutlined,
  MoreOutlined,
  DeleteOutlined,
  BranchesOutlined,
  CarOutlined,
  FileDoneOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { credentialsService } from '../../../services/credentials.service';
import principalService from '../../../services/principal.service';
import { useBranches } from '../../shared/hooks/useLookup';
import StudentModal from './StudentModal';
import dayjs from 'dayjs';
import { getPresignedUrl } from '../../../utils/imageUtils';

const { Title, Text } = Typography;
const { Option } = Select;
const { useBreakpoint } = Grid;

const AllStudents = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const students = useSelector(selectStudentsList);
  const loading = useSelector(selectStudentsLoading);
  const pagination = useSelector(selectStudentsPagination);

  // Use global lookup data for branches (cached)
  const { activeBranches: branches } = useBranches();

  // Local state
  const [search, setSearch] = useState('');
  const [activeStatusFilter, setActiveStatusFilter] = useState('active');
  const [branchFilter, setBranchFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedStudentFull, setSelectedStudentFull] = useState(null);
  const [loadingStudentDetails, setLoadingStudentDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [studentDocuments, setStudentDocuments] = useState([]);
  const [documentUrls, setDocumentUrls] = useState({});
  const [reportUrls, setReportUrls] = useState({});
  const [visitDocUrls, setVisitDocUrls] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [resettingCredential, setResettingCredential] = useState(false);
  const [deletingInternship, setDeletingInternship] = useState(null);
  const listRef = useRef(null);
  const PAGE_SIZE = 50;

  // Build filter params
  const buildFilterParams = useCallback((page = 1) => {
    const params = {
      page,
      limit: PAGE_SIZE,
    };
    if (search.trim()) params.search = search.trim();
    if (activeStatusFilter === 'active') params.isActive = true;
    if (activeStatusFilter === 'inactive') params.isActive = false;
    if (branchFilter !== 'all') params.branchId = branchFilter;
    return params;
  }, [search, activeStatusFilter, branchFilter]);


  // Initial fetch and filter change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      setAllStudents([]);
      setHasMore(true);
      dispatch(fetchStudents(buildFilterParams(1)));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [dispatch, search, activeStatusFilter, branchFilter]);

  // Update allStudents when students list changes
  useEffect(() => {
    if (currentPage === 1) {
      setAllStudents(students);
    } else {
      setAllStudents(prev => {
        const existingIds = new Set(prev.map(s => s.id));
        const newStudents = students.filter(s => !existingIds.has(s.id));
        return [...prev, ...newStudents];
      });
    }
    if (pagination?.total) {
      setHasMore(allStudents.length + students.length < pagination.total);
    }
    setLoadingMore(false);
  }, [students, pagination?.total]);

  // Select first student when list changes
  useEffect(() => {
    if (allStudents.length > 0 && !selectedStudent && screens.md) {
      handleStudentSelect(allStudents[0]);
    }
  }, [allStudents, screens.md]);

  // Handle studentId from URL params
  useEffect(() => {
    const studentId = searchParams.get('studentId');
    if (studentId && allStudents.length > 0) {
      const student = allStudents.find(s => s.id === studentId);
      if (student) {
        handleStudentSelect(student);
      }
    }
  }, [searchParams, allStudents]);

  // Load full student details when selected student changes
  const loadFullStudentDetails = async (studentId) => {
    setLoadingStudentDetails(true);
    try {
      const result = await dispatch(fetchStudentById(studentId)).unwrap();
      setSelectedStudentFull(result);
    } catch (error) {
      console.error('Failed to load student details:', error);
      setSelectedStudentFull(null);
    } finally {
      setLoadingStudentDetails(false);
    }
  };

  // Load documents when student changes
  useEffect(() => {
    if (selectedStudent?.id) {
      loadStudentDocuments(selectedStudent.id);
    }
  }, [selectedStudent?.id]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom < 100 && hasMore && !loadingMore && !loading) {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      dispatch(fetchStudents(buildFilterParams(nextPage)));
    }
  }, [loadingMore, hasMore, loading, currentPage, dispatch, buildFilterParams]);

  const handleStudentSelect = (student) => {
    setSelectedStudent(student);
    setSelectedStudentFull(null);
    loadFullStudentDetails(student.id);
    // On mobile, scroll to details
    if (!screens.md) {
      setTimeout(() => {
        const element = document.getElementById('student-details-section');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  const handleRefresh = () => {
    setCurrentPage(1);
    setAllStudents([]);
    dispatch(fetchStudents({ ...buildFilterParams(1), forceRefresh: true }));
    if (selectedStudent?.id) {
      loadFullStudentDetails(selectedStudent.id);
    }
  };

  const openEditModal = () => {
    setEditingStudentId(selectedStudent?.id);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingStudentId(null);
  };

  const handleModalSuccess = () => {
    handleRefresh();
  };

  // Handle active state toggle
  const handleActiveStateToggle = async () => {
    if (!selectedStudent) return;

    try {
      const result = await dispatch(
        toggleStudentStatus({ studentId: selectedStudent.id })
      ).unwrap();
      toast.success(result.message || `Student ${result.active ? 'activated' : 'deactivated'} successfully`);
      setSelectedStudent(prev => ({ ...prev, user: { ...prev.user, active: result.active } }));
      setSelectedStudentFull(prev => prev ? { ...prev, user: { ...prev.user, active: result.active } } : null);
      // Refresh dashboard stats to update Active Students count
      dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } catch (error) {
      toast.error(error || 'Failed to toggle student status');
    }
  };

  const handleClearanceStatusChange = async (newStatus) => {
    if (!selectedStudent) return;

    try {
      await dispatch(
        updateStudent({
          id: selectedStudent.id,
          data: { clearanceStatus: newStatus },
        })
      ).unwrap();
      toast.success(`Clearance status updated to ${newStatus}`);
      setSelectedStudent(prev => ({ ...prev, clearanceStatus: newStatus }));
      handleRefresh();
    } catch (error) {
      toast.error(error || 'Failed to update clearance status');
    }
  };

  const handleResetCredential = async () => {
    const userId = selectedStudent?.userId || selectedStudent?.user?.id;
    if (!userId) {
      toast.error('Student user ID not found');
      return;
    }

    setResettingCredential(true);
    try {
      const result = await credentialsService.resetUserPassword(userId);
      toast.success(
        `Password reset successfully. New password: ${result.temporaryPassword || result.newPassword || 'Check email'}`,
        { duration: 10000 }
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to reset credential');
    } finally {
      setResettingCredential(false);
    }
  };


  const openUploadModal = () => {
    uploadForm.resetFields();
    setFileList([]);
    setUploadModal(true);
  };

  const handleUpload = async (values) => {
    if (!fileList.length) {
      toast.error('Please select a file.');
      return;
    }

    setUploading(true);
    try {
      await dispatch(
        uploadStudentDocument({
          studentId: selectedStudent.id,
          file: fileList[0],
          type: values.type,
        })
      ).unwrap();
      toast.success('Document uploaded successfully');
      setUploadModal(false);
      loadStudentDocuments(selectedStudent.id);
    } catch (error) {
      toast.error(error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const loadStudentDocuments = async (studentId) => {
    try {
      const result = await dispatch(fetchStudentDocuments(studentId)).unwrap();
      setStudentDocuments(result || []);
      loadDocumentUrls(result || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
      setStudentDocuments([]);
      setDocumentUrls({});
    }
  };

  const loadDocumentUrls = async (docs) => {
    const urls = {};
    for (const doc of docs) {
      if (doc.fileUrl) {
        try {
          const presignedUrl = await getPresignedUrl(doc.fileUrl);
          urls[doc.id] = presignedUrl;
        } catch (error) {
          console.error('Failed to get presigned URL for document:', error);
          urls[doc.id] = doc.fileUrl;
        }
      }
    }
    setDocumentUrls(urls);
  };

  // Load presigned URLs for monthly reports
  const loadReportUrls = async (reports) => {
    const urls = {};
    for (const report of reports) {
      if (report.reportFileUrl) {
        try {
          const presignedUrl = await getPresignedUrl(report.reportFileUrl);
          urls[report.id] = presignedUrl;
        } catch (error) {
          console.error('Failed to get presigned URL for report:', error);
          urls[report.id] = report.reportFileUrl;
        }
      }
    }
    setReportUrls(urls);
  };

  // Load presigned URLs for visit documents
  const loadVisitDocUrls = async (visits) => {
    const urls = {};
    for (const visit of visits) {
      if (visit.signedDocumentUrl) {
        try {
          const presignedUrl = await getPresignedUrl(visit.signedDocumentUrl);
          urls[visit.id] = presignedUrl;
        } catch (error) {
          console.error('Failed to get presigned URL for visit document:', error);
          urls[visit.id] = visit.signedDocumentUrl;
        }
      }
    }
    setVisitDocUrls(urls);
  };

  const getCategoryColor = (category) => {
    const colors = {
      GENERAL: 'blue',
      SC: 'green',
      ST: 'purple',
      OBC: 'orange',
    };
    return colors[category] || 'default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return dayjs(dateString).format('DD MMM YYYY');
  };

  const displayStudent = selectedStudentFull || selectedStudent;
  const internshipApplications = selectedStudentFull?.internshipApplications || [];

  // Extract all monthly reports and visits from all internship applications
  const allMonthlyReports = internshipApplications.flatMap(app =>
    (app.monthlyReports || []).map(report => ({ ...report, applicationId: app.id, companyName: app.companyName }))
  );
  const allFacultyVisits = internshipApplications.flatMap(app =>
    (app.facultyVisitLogs || []).map(visit => ({ ...visit, applicationId: app.id, companyName: app.companyName }))
  );

  // Load presigned URLs when student data is loaded
  useEffect(() => {
    if (allMonthlyReports.length > 0) {
      loadReportUrls(allMonthlyReports);
    } else {
      setReportUrls({});
    }
  }, [selectedStudentFull?.id, allMonthlyReports.length]);

  useEffect(() => {
    if (allFacultyVisits.length > 0) {
      loadVisitDocUrls(allFacultyVisits);
    } else {
      setVisitDocUrls({});
    }
  }, [selectedStudentFull?.id, allFacultyVisits.length]);

  const tabItems = [
    {
      key: '1',
      label: <span><UserOutlined /> Personal Info</span>,
      children: displayStudent && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, padding: 16 }}>
          <Card title="Basic Information" bordered={false} style={{ backgroundColor: token.colorBgLayout }} size="small">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', rowGap: 12 }}>
              <div style={{ color: token.colorTextSecondary }}>Gender</div>
              <div>{displayStudent.gender || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Category</div>
              <div>
                {displayStudent.category ? (
                  <Tag color={getCategoryColor(displayStudent.category)} bordered={false}>
                    {displayStudent.category}
                  </Tag>
                ) : 'N/A'}
              </div>

              <div style={{ color: token.colorTextSecondary }}>Admission Type</div>
              <div>{displayStudent.admissionType || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Roll Number</div>
              <div>{displayStudent?.user?.rollNumber || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Batch</div>
              <div>{displayStudent.batchName || displayStudent.batch?.name || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Branch</div>
              <div>{displayStudent?.user?.branchName || displayStudent.branchName || displayStudent.branch?.name || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Year / Semester</div>
              <div>
                {displayStudent.currentYear && displayStudent.currentSemester
                  ? `Year ${displayStudent.currentYear} / Sem ${displayStudent.currentSemester}`
                  : 'N/A'}
              </div>
            </div>
          </Card>

          <Card title="Contact Information" bordered={false} style={{ backgroundColor: token.colorBgLayout }} size="small">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', rowGap: 12 }}>
              <div style={{ color: token.colorTextSecondary }}>Email</div>
              <div style={{ wordBreak: 'break-all' }}>{displayStudent?.user?.email || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Contact</div>
              <div>{displayStudent?.user?.phoneNo || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Address</div>
              <div>{displayStudent.address || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>City</div>
              <div>{displayStudent.city || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>State</div>
              <div>{displayStudent.state || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Pin Code</div>
              <div>{displayStudent.pinCode || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Parent Name</div>
              <div>{displayStudent.parentName || 'N/A'}</div>

              <div style={{ color: token.colorTextSecondary }}>Parent Contact</div>
              <div>{displayStudent.parentContact || 'N/A'}</div>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: '2',
      label: <span><FileTextOutlined /> Documents</span>,
      children: (
        <div style={{ padding: 16 }}>
          {studentDocuments?.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16 }}>
              {studentDocuments.map((doc) => (
                <Card
                  key={doc.id}
                  hoverable
                  style={{ borderRadius: token.borderRadiusLG, overflow: 'hidden', border: `1px solid ${token.colorBorderSecondary}` }}
                  cover={
                    <div style={{ height: 160, backgroundColor: token.colorBgLayout, padding: 8, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
                      {documentUrls[doc.id] ? (
                        <img
                          src={documentUrls[doc.id]}
                          alt={doc.fileName}
                          style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : (
                        <Spin />
                      )}
                      <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: token.colorTextDescription }}>
                        <FileTextOutlined style={{ fontSize: 32 }} />
                        <span style={{ marginTop: 8, fontSize: 12 }}>Preview unavailable</span>
                      </div>
                    </div>
                  }
                  onClick={() => {
                    if (documentUrls[doc.id]) {
                      window.open(documentUrls[doc.id], '_blank');
                    }
                  }}
                >
                  <Card.Meta
                    title={<div style={{ textAlign: 'center', fontSize: 14 }}>{doc.type?.replaceAll('_', ' ')}</div>}
                    description={<div style={{ textAlign: 'center', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.fileName}</div>}
                  />
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: token.colorTextDescription, padding: 48, backgroundColor: token.colorBgLayout, borderRadius: token.borderRadiusLG }}>
              <FileTextOutlined style={{ fontSize: 32, marginBottom: 12, color: token.colorTextDisabled }} />
              <div>No documents uploaded</div>
              <Button type="link" onClick={openUploadModal}>
                Upload a document
              </Button>
            </div>
          )}
        </div>
      ),
    },
    {
      key: '3',
      label: (
        <span>
          <LaptopOutlined /> Internships
          {loadingStudentDetails && <LoadingOutlined style={{ marginLeft: 8 }} />}
          {internshipApplications.length > 0 && (
            <Tag color="blue" bordered={false} style={{ marginLeft: 8 }}>{internshipApplications.length}</Tag>
          )}
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          {loadingStudentDetails ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
              <Spin tip="Loading internship details..." />
            </div>
          ) : internshipApplications.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {internshipApplications.map((app, index) => (
                <Card
                  key={app.id || index}
                  style={{
                    borderRadius: token.borderRadiusLG,
                    borderLeft: `4px solid ${
                      app.status === 'JOINED' || app.internshipPhase === 'COMPLETED'
                        ? token.colorSuccess
                        : app.internshipPhase === 'ACTIVE'
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
                        <Tag color="purple" bordered={false}>Self Identified</Tag>
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
                      <span style={{ fontWeight: 500 }}>Location:</span> {app.companyAddress}
                    </div>
                  )}

                  {app.facultyMentorName && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, fontSize: 12 }}>
                      <span style={{ color: token.colorTextSecondary }}>Faculty Mentor:</span>
                      <span style={{ marginLeft: 4, fontWeight: 500 }}>{app.facultyMentorName}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No internship applications yet" className="py-8" />
          )}
        </div>
      ),
    },
    {
      key: '4',
      label: (
        <span>
          <CarOutlined /> Faculty Visits
          {loadingStudentDetails && <LoadingOutlined style={{ marginLeft: 8 }} />}
          {allFacultyVisits.length > 0 && (
            <Tag color="green" bordered={false} style={{ marginLeft: 8 }}>{allFacultyVisits.length}</Tag>
          )}
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          {loadingStudentDetails ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
              <Spin tip="Loading visit details..." />
            </div>
          ) : allFacultyVisits.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {allFacultyVisits.map((visit, index) => (
                <Card
                  key={visit.id || index}
                  style={{
                    borderRadius: token.borderRadiusLG,
                    borderLeft: `4px solid ${token.colorSuccess}`,
                    backgroundColor: token.colorBgContainer
                  }}
                  size="small"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        Visit #{visit.visitNumber || index + 1}
                      </div>
                      <div style={{ fontSize: 13, color: token.colorTextSecondary }}>
                        <CalendarOutlined style={{ marginRight: 4 }} />
                        {visit.visitDate ? formatDate(visit.visitDate) : 'Date not set'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Tag color={visit.attendanceStatus === 'PRESENT' ? 'success' : visit.attendanceStatus === 'ABSENT' ? 'error' : 'default'} bordered={false}>
                        {visit.attendanceStatus || 'N/A'}
                      </Tag>
                      {visit.status && (
                        <Tag color={visit.status === 'COMPLETED' ? 'success' : visit.status === 'SCHEDULED' ? 'processing' : 'default'} bordered={false}>
                          {visit.status}
                        </Tag>
                      )}
                    </div>
                  </div>

                  {/* View Documents Row */}
                  {(visit.signedDocumentUrl || visit.filesUrl) && (() => {
                    // Parse filesUrl - it can be a JSON array string
                    let filesList = [];
                    if (visit.filesUrl) {
                      try {
                        filesList = JSON.parse(visit.filesUrl);
                        if (!Array.isArray(filesList)) filesList = [filesList];
                      } catch {
                        filesList = [visit.filesUrl];
                      }
                    }
                    return (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {visit.signedDocumentUrl && visitDocUrls[visit.id] && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => window.open(visitDocUrls[visit.id], '_blank')}
                          >
                            Signed Document
                          </Button>
                        )}
                        {filesList.map((fileUrl, fileIndex) => (
                          <Button
                            key={fileIndex}
                            type="default"
                            size="small"
                            icon={<FileTextOutlined />}
                            onClick={async () => {
                              try {
                                const url = await getPresignedUrl(fileUrl);
                                window.open(url, '_blank');
                              } catch (e) {
                                window.open(fileUrl, '_blank');
                              }
                            }}
                          >
                            {filesList.length > 1 ? `File ${fileIndex + 1}` : 'View File'}
                          </Button>
                        ))}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 8 }}>
                    {visit.visitType && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>Type:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>{visit.visitType}</span>
                      </div>
                    )}
                    {visit.visitDuration && (
                      <div>
                        <span style={{ color: token.colorTextSecondary }}>Duration:</span>
                        <span style={{ marginLeft: 4, fontWeight: 500 }}>{visit.visitDuration} mins</span>
                      </div>
                    )}
                  </div>

                  {visit.visitLocation && (
                    <div style={{ fontSize: 12, color: token.colorTextDescription, marginBottom: 8 }}>
                      <EnvironmentOutlined style={{ marginRight: 4 }} />
                      {visit.visitLocation}
                    </div>
                  )}

                  {visit.faculty?.name && (
                    <div style={{ fontSize: 12, color: token.colorTextSecondary, marginBottom: 8 }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      Visited by: <span style={{ fontWeight: 500 }}>{visit.faculty.name}</span>
                    </div>
                  )}

                  {visit.titleOfProjectWork && (
                    <div style={{ fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: token.colorTextSecondary }}>Project:</span>
                      <span style={{ marginLeft: 4, fontWeight: 500 }}>{visit.titleOfProjectWork}</span>
                    </div>
                  )}

                  {visit.observationsAboutStudent && (
                    <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorFillAlter, borderRadius: token.borderRadius, marginTop: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>Observations about Student:</div>
                      <div style={{ color: token.colorTextSecondary }}>{visit.observationsAboutStudent}</div>
                    </div>
                  )}

                  {visit.studentPerformance && (
                    <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorSuccessBg, borderRadius: token.borderRadius, marginTop: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4, color: token.colorSuccess }}>Student Performance:</div>
                      <div style={{ color: token.colorTextSecondary }}>{visit.studentPerformance}</div>
                    </div>
                  )}

                  {visit.feedbackSharedWithStudent && (
                    <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorInfoBg, borderRadius: token.borderRadius, marginTop: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4, color: token.colorInfo }}>Feedback Shared:</div>
                      <div style={{ color: token.colorTextSecondary }}>{visit.feedbackSharedWithStudent}</div>
                    </div>
                  )}

                  {visit.issuesIdentified && (
                    <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorWarningBg, borderRadius: token.borderRadius, marginTop: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4, color: token.colorWarning }}>Issues Identified:</div>
                      <div style={{ color: token.colorTextSecondary }}>{visit.issuesIdentified}</div>
                    </div>
                  )}

                  {visit.recommendations && (
                    <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorFillAlter, borderRadius: token.borderRadius, marginTop: 8 }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>Recommendations:</div>
                      <div style={{ color: token.colorTextSecondary }}>{visit.recommendations}</div>
                    </div>
                  )}

                  {(visit.studentProgressRating || visit.overallSatisfactionRating) && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                      {visit.studentProgressRating && (
                        <div>
                          <span style={{ color: token.colorTextSecondary }}>Progress:</span>
                          <span style={{ marginLeft: 4, fontWeight: 500 }}>{visit.studentProgressRating}/5</span>
                        </div>
                      )}
                      {visit.overallSatisfactionRating && (
                        <div>
                          <span style={{ color: token.colorTextSecondary }}>Overall:</span>
                          <span style={{ marginLeft: 4, fontWeight: 500 }}>{visit.overallSatisfactionRating}/5</span>
                        </div>
                      )}
                    </div>
                  )}

                  {visit.companyName && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, fontSize: 11, color: token.colorTextDescription }}>
                      Company: {visit.companyName}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="No faculty visits recorded yet" className="py-8" />
          )}
        </div>
      ),
    },
    {
      key: '5',
      label: (
        <span>
          <FileDoneOutlined /> Monthly Reports
          {loadingStudentDetails && <LoadingOutlined style={{ marginLeft: 8 }} />}
          {allMonthlyReports.length > 0 && (
            <Tag color="purple" bordered={false} style={{ marginLeft: 8 }}>{allMonthlyReports.length}</Tag>
          )}
        </span>
      ),
      children: (
        <div style={{ padding: 16 }}>
          {loadingStudentDetails ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
              <Spin tip="Loading report details..." />
            </div>
          ) : allMonthlyReports.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {allMonthlyReports.map((report, index) => {
                const statusColors = {
                  DRAFT: 'default',
                  SUBMITTED: 'processing',
                  UNDER_REVIEW: 'warning',
                  APPROVED: 'success',
                  REJECTED: 'error',
                  REVISION_REQUIRED: 'orange',
                };
                return (
                  <Card
                    key={report.id || index}
                    style={{
                      borderRadius: token.borderRadiusLG,
                      borderLeft: `4px solid ${
                        report.status === 'APPROVED' ? token.colorSuccess
                        : report.status === 'REJECTED' ? token.colorError
                        : report.status === 'SUBMITTED' ? token.colorPrimary
                        : token.colorWarning
                      }`,
                      backgroundColor: token.colorBgContainer
                    }}
                    size="small"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>
                          {report.monthName || `Month ${report.reportMonth}`} {report.reportYear}
                        </div>
                        {report.submittedAt && (
                          <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            Submitted: {formatDate(report.submittedAt)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Tag color={statusColors[report.status] || 'default'} bordered={false}>
                          {report.status?.replace(/_/g, ' ')}
                        </Tag>
                        {report.reportFileUrl && reportUrls[report.id] && (
                          <Button
                            type="primary"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => window.open(reportUrls[report.id], '_blank')}
                            title="View Report"
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>

                    {report.isLateSubmission && (
                      <div style={{ fontSize: 12, color: token.colorWarning, marginBottom: 8 }}>
                        <ExclamationCircleOutlined style={{ marginRight: 4 }} />
                        Late Submission
                      </div>
                    )}

                    {report.isFinalReport && (
                      <Tag color="blue" bordered={false} style={{ marginBottom: 8 }}>Final Report</Tag>
                    )}

                    {report.isApproved && report.approvedAt && (
                      <div style={{ fontSize: 12, color: token.colorSuccess, marginBottom: 8 }}>
                        <CheckCircleOutlined style={{ marginRight: 4 }} />
                        Approved on {formatDate(report.approvedAt)}
                      </div>
                    )}

                    {report.reviewComments && (
                      <div style={{ fontSize: 12, padding: 8, backgroundColor: token.colorFillAlter, borderRadius: token.borderRadius, marginTop: 8 }}>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>Review Comments:</div>
                        <div style={{ color: token.colorTextSecondary }}>{report.reviewComments}</div>
                      </div>
                    )}

                    {report.companyName && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${token.colorBorderSecondary}`, fontSize: 11, color: token.colorTextDescription }}>
                        Company: {report.companyName}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Empty description="No monthly reports submitted yet" className="py-8" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, backgroundColor: token.colorBgLayout, minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <Title level={3} style={{ color: token.colorTextHeading, margin: 0 }}>
          Student Management
        </Title>
      </div>

      <Row gutter={[16, 16]}>
        {/* Students List - Left Column */}
        <Col xs={24} sm={24} md={8} lg={7} xl={6}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', color: token.colorPrimary }}>
                <TeamOutlined style={{ marginRight: 8 }} /> Students Directory
                <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>
                  {allStudents.length} / {pagination?.total || 0}
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
            <div style={{ padding: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <Input
                placeholder="Search Student..."
                style={{ marginBottom: 12 }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefix={<UserOutlined style={{ color: token.colorTextDisabled }} />}
                allowClear
              />

              <Select
                placeholder="Filter by Status"
                style={{ width: '100%' }}
                value={activeStatusFilter}
                onChange={setActiveStatusFilter}
              >
                <Option value="all">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <TeamOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                    All Students
                  </div>
                </Option>
                <Option value="active">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircleOutlined style={{ marginRight: 8, color: token.colorSuccess }} />
                    Active Only
                  </div>
                </Option>
                <Option value="inactive">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <StopOutlined style={{ marginRight: 8, color: token.colorError }} />
                    Inactive Only
                  </div>
                </Option>
              </Select>

              <Select
                placeholder="Filter by Branch"
                style={{ width: '100%', marginTop: 12 }}
                value={branchFilter}
                onChange={setBranchFilter}
                showSearch
                optionFilterProp="children"
                filterOption={(input, option) =>
                  option?.children?.props?.children?.[1]?.toLowerCase().includes(input.toLowerCase())
                }
              >
                <Option value="all">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <BranchesOutlined style={{ marginRight: 8, color: token.colorPrimary }} />
                    All Branches
                  </div>
                </Option>
                {Array.isArray(branches) && branches.map((branch) => (
                  <Option key={branch.id} value={branch.id}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <BranchesOutlined style={{ marginRight: 8, color: token.colorTextSecondary }} />
                      {branch.name}
                    </div>
                  </Option>
                ))}
              </Select>
            </div>

            <div
              onScroll={handleScroll}
              style={{ overflowY: 'auto', padding: 8, flex: 1 }}
            >
              {loading && allStudents.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 160 }}>
                  <Spin size="small" tip="Loading students..." />
                </div>
              ) : (
                <>
                  <List
                    itemLayout="horizontal"
                    dataSource={allStudents}
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
                              {student?.user?.name}
                            </Text>
                          }
                          description={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                {student.category && (
                                  <Tag color={getCategoryColor(student.category)} bordered={false} style={{ fontSize: 10, lineHeight: '16px', height: 18 }}>
                                    {student.category}
                                  </Tag>
                                )}
                                <Tag color={student?.user?.active ? 'success' : 'error'} bordered={false} style={{ fontSize: 10, lineHeight: '16px', height: 18 }}>
                                  {student?.user?.active ? 'Active' : 'Inactive'}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 12, color: token.colorTextDescription }}>
                                <IdcardOutlined style={{ marginRight: 4 }} />
                                {student?.user?.rollNumber}
                              </div>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />

                  {loadingMore && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                      <Spin size="small" />
                    </div>
                  )}

                  {!hasMore && allStudents.length > 0 && (
                    <div style={{ textAlign: 'center', padding: 16, color: token.colorTextDisabled, fontSize: 12 }}>
                      All students loaded
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        </Col>

        {/* Student Details - Right Column */}
        <Col xs={24} sm={24} md={16} lg={17} xl={18} id="student-details-section">
          {displayStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: screens.md ? 'calc(100vh - 120px)' : 'auto', overflowY: 'auto', paddingRight: 4 }}>
              {/* Profile Header */}
              <Card
                bordered={false}
                style={{ borderRadius: token.borderRadiusLG, boxShadow: token.boxShadowTertiary, position: 'relative' }}
              >
                <div style={{ position: 'absolute', top: 16, right: 16 }}>
                  <Dropdown
                    menu={{
                      items: [
                        { key: 'edit', icon: <EditOutlined />, label: 'Edit Profile', onClick: openEditModal },
                        { key: 'upload', icon: <UploadOutlined />, label: 'Add Document', onClick: openUploadModal },
                        {
                          key: 'reset',
                          icon: <KeyOutlined />,
                          label: resettingCredential ? 'Resetting...' : 'Reset Credential',
                          disabled: resettingCredential,
                          onClick: () => {
                            Modal.confirm({
                              title: 'Reset Student Credential',
                              content: `Are you sure you want to reset the password for ${selectedStudent?.name}?`,
                              okText: 'Reset',
                              okButtonProps: { danger: true },
                              onOk: handleResetCredential,
                            });
                          },
                        },
                        { type: 'divider' },
                        {
                          key: 'toggle',
                          icon: selectedStudent?.user?.active ? <StopOutlined /> : <PlayCircleOutlined />,
                          label: selectedStudent?.user?.active ? 'Deactivate' : 'Activate',
                          danger: selectedStudent?.user?.active,
                          onClick: () => {
                            Modal.confirm({
                              title: `${selectedStudent?.user?.active ? 'Deactivate' : 'Activate'} Student`,
                              content: `Are you sure you want to ${selectedStudent?.user?.active ? 'deactivate' : 'activate'} ${selectedStudent?.user?.name}?`,
                              okText: selectedStudent?.user?.active ? 'Deactivate' : 'Activate',
                              okButtonProps: { danger: selectedStudent?.user?.active },
                              onOk: handleActiveStateToggle,
                            });
                          },
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button type="text" icon={<MoreOutlined style={{ fontSize: 20 }} />} />
                  </Dropdown>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
                  <ProfileAvatar
                    profileImage={displayStudent.profileImage}
                    size={90}
                    style={{ border: `4px solid ${token.colorBgContainer}`, boxShadow: token.boxShadow }}
                  />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <Title level={3} style={{ margin: 0, color: token.colorTextHeading }}>
                      {displayStudent?.user?.name}
                    </Title>
                    <div style={{ display: 'flex', alignItems: 'center', color: token.colorTextSecondary, marginBottom: 8 }}>
                      <IdcardOutlined style={{ marginRight: 8 }} />
                      {displayStudent?.user?.rollNumber}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Tag color="blue" bordered={false}>{displayStudent?.user?.branchName || displayStudent.branchName}</Tag>
                      <Tag color={getCategoryColor(displayStudent.category)} bordered={false}>{displayStudent.category}</Tag>
                      <Tag color={displayStudent?.user?.active ? 'success' : 'error'} bordered={false}>
                        {displayStudent?.user?.active ? 'Active' : 'Inactive'}
                      </Tag>
                    </div>
                  </div>
                </div>

                {/* Contact Quick Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24, padding: 12, borderRadius: token.borderRadius, backgroundColor: token.colorFillAlter }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <MailOutlined style={{ color: token.colorPrimary, fontSize: 18, marginRight: 12 }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextDescription }}>Email</div>
                      <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-all' }}>{displayStudent?.user?.email || 'N/A'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <PhoneOutlined style={{ color: token.colorSuccess, fontSize: 18, marginRight: 12 }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextDescription }}>Contact</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{displayStudent?.user?.phoneNo || 'N/A'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CalendarOutlined style={{ color: token.colorWarning, fontSize: 18, marginRight: 12 }} />
                    <div>
                      <div style={{ fontSize: 11, color: token.colorTextDescription }}>Date of Birth</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{displayStudent?.user?.dob ? formatDate(displayStudent?.user?.dob) : 'N/A'}</div>
                    </div>
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
                <Text type="secondary">Choose a student from the directory to view detailed information and track progress.</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Edit Student Modal */}
      <StudentModal
        open={isModalOpen}
        onClose={handleModalClose}
        studentId={editingStudentId}
        onSuccess={handleModalSuccess}
      />

      {/* Upload Document Modal */}
      <Modal
        title="Upload Document"
        open={uploadModal}
        onCancel={() => setUploadModal(false)}
        onOk={() => uploadForm.submit()}
        confirmLoading={uploading}
        centered
      >
        <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="type" label="Document Type" rules={[{ required: true, message: 'Please select document type' }]}>
            <Select placeholder="Select type">
              <Option value="MARKSHEET_10TH">10th Marksheet</Option>
              <Option value="MARKSHEET_12TH">12th Marksheet</Option>
              <Option value="CASTE_CERTIFICATE">Caste Certificate</Option>
              <Option value="PHOTO">Photo</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Upload File" required>
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
            >
              <Button icon={<UploadOutlined />} style={{ width: '100%' }}>
                Select File (Max 500KB)
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AllStudents;