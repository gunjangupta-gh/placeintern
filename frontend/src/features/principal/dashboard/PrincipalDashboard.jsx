import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Col,
  Row,
  Typography,
  Spin,
  Button,
  Badge,
  Tooltip,
  Alert,
  Tag,
  Modal,
  Table,
  Empty,
  Tabs,
} from 'antd';
import {
  TeamOutlined,
  ReloadOutlined,
  BankOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNotifications } from '../../common/notifications';
import {
  fetchPrincipalDashboard,
  fetchMentorCoverage,
  fetchInternshipStats,
  fetchFacultyWorkload,
  fetchJoiningLettersByMentor,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  selectMentorCoverage,
  selectMentorCoverageLoading,
  selectMostRecentFetch,
  selectInternshipStats,
  selectInternshipStatsLoading,
} from '../store/principalSlice';
import { fetchPrincipalTrainingDashboard } from '../store/principalTrainingSlice';
import FacultyWorkloadCard from './components/FacultyWorkloadCard';
import { BasicStatisticsGrid, SubmissionStatusGrid, TrainingStatisticsGrid } from './components/DashboardStatCards';
import MonthlyReportsModal from './components/MonthlyReportsModal';
import FacultyVisitsModal from './components/FacultyVisitsModal';
import JoiningLettersModal from './components/JoiningLettersModal';
import DashboardInternshipTable from './components/DashboardInternshipTable';

const { Title, Text, Paragraph } = Typography;

// Helper functions
const getCurrentUser = () => {
  try {
    const loginData = localStorage.getItem('loginResponse');
    if (loginData) {
      return JSON.parse(loginData)?.user;
    }
    const token = localStorage.getItem('token');
    if (token) {
      return JSON.parse(atob(token.split('.')[1]));
    }
  } catch {
    return null;
  }
  return null;
};

// Section Title Component with colored left border
const SectionTitle = ({ title }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="w-1 h-5 bg-primary rounded-full" />
    <Title level={5} className="mb-0! text-text-primary">{title}</Title>
  </div>
);

const PrincipalDashboard = () => {
  useNotifications({
    showToasts: false,
    showInitialToasts: true,
    maxInitialToasts: 3,
  });

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [principalName, setPrincipalName] = useState('Principal');
  const [instituteName, setInstituteName] = useState('');
  const [alertDetailModal, setAlertDetailModal] = useState({ visible: false, type: null, title: '', data: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [studentsModal, setStudentsModal] = useState({ visible: false });
  const [mentorsModal, setMentorsModal] = useState({ visible: false });
  const [companiesModal, setCompaniesModal] = useState({ visible: false });
  const [reportsModal, setReportsModal] = useState({ visible: false });
  const [visitsModal, setVisitsModal] = useState({ visible: false });
  const [joiningLettersModal, setJoiningLettersModal] = useState({ visible: false });
  const [unassignedModal, setUnassignedModal] = useState({ visible: false });
  const [grievancesModal, setGrievancesModal] = useState({ visible: false });

  // Redux selectors for dashboard data
  const dashboardStats = useSelector(selectDashboardStats);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const dashboardError = useSelector(selectDashboardError);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const mentorCoverageLoading = useSelector(selectMentorCoverageLoading);
  const lastFetched = useSelector(selectMostRecentFetch);
  const internshipStats = useSelector(selectInternshipStats);
  const internshipStatsLoading = useSelector(selectInternshipStatsLoading);
  const trainingDashboard = useSelector((state) => state.principalTraining?.reports?.dashboard);
  const trainingDashboardLoading = useSelector((state) => state.principalTraining?.reports?.loading);

  // Memoized stats derived from Redux data
  const stats = useMemo(() => {
    if (!dashboardStats) return null;

    const studentsData = dashboardStats.students || {};
    const staffData = dashboardStats.staff || {};

    return {
      students: {
        total: studentsData.total || 0,
        active: studentsData.active || 0,
        inactive: (studentsData.total || 0) - (studentsData.active || 0),
      },
      staff: {
        total: staffData.total || 0,
        active: staffData.active || 0,
        inactive: (staffData.total || 0) - (staffData.active || 0),
        teachers: staffData.teachers || 0,
        adminStaff: staffData.adminStaff || 0,
      },
      internships: dashboardStats.internships || {},
      pending: dashboardStats.pending || {},
      grievances: dashboardStats.grievances || { total: 0, pending: 0 },
      monthlyReports: dashboardStats.monthlyReports || { submitted: 0, expected: 0, month: null, year: null },
      facultyVisits: dashboardStats.facultyVisits || { completed: 0, expected: 0, month: null, year: null },
      joiningLetterStats: dashboardStats.joiningLetterStats || { total: 0, uploaded: 0, pending: 0, uploadRate: 0 },
      partnerCompanies: dashboardStats.partnerCompanies || 0,
    };
  }, [dashboardStats]);

  // Calculate total pending items from dashboard stats
  const totalPendingItems = useMemo(() => {
    if (!stats?.pending) return 0;
    return (stats.pending.monthlyReports || 0) +
           (stats.pending.grievances || 0) +
           (stats.pending.joiningLetters || 0);
  }, [stats]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    const userName = currentUser?.name || 'Principal';
    setPrincipalName(userName);

    // Fetch main dashboard data - other data fetched on-demand when clicking cards
    dispatch(fetchPrincipalDashboard());
    dispatch(fetchMentorCoverage());
    dispatch(fetchPrincipalTrainingDashboard());
  }, [dispatch]);

  // Update institution name from dashboard stats
  useEffect(() => {
    if (dashboardStats) {
      const institutionName = dashboardStats.institution?.name;
      if (institutionName) {
        setInstituteName(institutionName);
      }
    }
  }, [dashboardStats]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await dispatch(fetchPrincipalDashboard({ forceRefresh: true }));
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  // Memoized data for BasicStatisticsGrid - uses dashboard data, details fetched on-demand
  const basicStatsData = useMemo(() => ({
    totalStudents: stats?.students?.active || 0,
    totalMentors: stats?.staff?.teachers || mentorCoverage?.totalMentors || 0,
    unassignedStudents: dashboardStats?.unassignedStudents || 0,
    partnerCompanies: stats?.partnerCompanies || 0,
    // Staff breakdown for the modal
    staffBreakdown: {
      totalStaff: stats?.staff?.total || 0,
      mentors: stats?.staff?.teachers || 0,
      adminStaff: stats?.staff?.adminStaff || 0,
    },
  }), [stats, mentorCoverage, dashboardStats]);

  // Memoized data for SubmissionStatusGrid
  // Uses CURRENT MONTH specific data from dashboard API response
  const submissionStatusData = useMemo(() => {
    // Get joining Report stats directly from dashboard response
    const joiningStats = stats?.joiningLetterStats || {};
    const joiningTotal = joiningStats.total || 0;
    const joiningUploaded = joiningStats.uploaded || 0;
    const joiningPending = joiningStats.pending || 0;

    // Calculate pending percentage for joining reports
    const pendingPercent = joiningTotal > 0
      ? Math.round((joiningPending / joiningTotal) * 100)
      : 0;

    // Monthly reports - CURRENT MONTH data from dashboard API
    // API returns: monthlyReports: { submitted, expected, month, year }
    const reportsSubmitted = stats?.monthlyReports?.submitted ?? 0;
    const reportsTotal = stats?.monthlyReports?.expected ?? 0;
    const reportsPending = Math.max(0, reportsTotal - reportsSubmitted);

    // Faculty visits - CURRENT MONTH data from dashboard API
    // API returns: facultyVisits: { completed, expected, month, year }
    const visitsCompleted = stats?.facultyVisits?.completed ?? 0;
    const visitsTotal = stats?.facultyVisits?.expected ?? 0;
    const visitsPending = Math.max(0, visitsTotal - visitsCompleted);

    // Get month/year from API response for display (server's current month)
    const reportMonth = stats?.monthlyReports?.month;
    const reportYear = stats?.monthlyReports?.year;
    const visitMonth = stats?.facultyVisits?.month;
    const visitYear = stats?.facultyVisits?.year;

    return {
      monthlyReports: {
        submitted: reportsSubmitted,
        total: reportsTotal,
        pending: reportsPending,
        month: reportMonth,
        year: reportYear,
      },
      joiningLetters: {
        submitted: joiningUploaded,
        total: joiningTotal,
        pendingPercent: pendingPercent,
      },
      facultyVisits: {
        completed: visitsCompleted,
        total: visitsTotal,
        pending: visitsPending,
        month: visitMonth,
        year: visitYear,
      },
      grievances: {
        total: stats?.grievances?.total || 0,
        unaddressed: stats?.grievances?.pending || 0,
      },
    };
  }, [stats]);

  const currentDate = useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), []);

  // Training stats from training dashboard
  const trainingStats = useMemo(() => {
    if (!trainingDashboard) return null;
    const metrics = trainingDashboard.trainingMetrics || {};
    const faculty = trainingDashboard.facultyMetrics || {};
    const completion = trainingDashboard.completionMetrics || {};
    return {
      trainingsConducted: metrics.totalTrainingsConducted || 0,
      facultyRegistered: metrics.totalFacultyRegistered || 0,
      hoursDelivered: metrics.totalTrainingHoursDelivered || 0,
      facultyCompleted: faculty.facultyWithCompletedTrainings || 0,
      facultyOngoing: faculty.facultyWithOngoingTrainings || 0,
      facultyYetToStart: faculty.facultyYetToStart || 0,
      completed40Hours: completion.facultyCompleted40Hours || 0,
    };
  }, [trainingDashboard]);


  // Conditional returns - AFTER all hooks
  if (dashboardLoading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading dashboard...</Text>
      </div>
    );
  }

  if (!stats && dashboardError) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Alert
          type="error"
          message="Failed to load dashboard data"
          description={dashboardError}
          showIcon
          action={
            <Button size="small" danger onClick={refreshData}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center">
        <Text type="danger">Failed to load dashboard data</Text>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="space-y-6">
        {/* Header Section - Compact */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Title level={4} className="mb-0! text-text-primary">
                Principal Dashboard
              </Title>
              {lastFetched && (
                <span className="text-[10px] text-text-tertiary">
                  Updated {new Date(lastFetched).toLocaleTimeString()}
                </span>
              )}
            </div>
            <Text className="text-text-secondary text-xs">
              Welcome back, <span className="font-medium text-primary">{principalName}</span> • {currentDate}
            </Text>
          </div>

          <Tooltip title="Refresh all dashboard data">
            <Button
              size="small"
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={refreshData}
              loading={isRefreshing}
              disabled={dashboardLoading}
            >
              Refresh
            </Button>
          </Tooltip>
        </div>

        {/* Basic Statistics Section */}
        <div>
          <SectionTitle title="Basic Statistics" />
          <BasicStatisticsGrid
            {...basicStatsData}
            loading={dashboardLoading}
            onViewStudents={() => {
              // Uses studentsByBranch data from dashboard response (already loaded)
              setStudentsModal({ visible: true });
            }}
            onViewMentors={() => {
              dispatch(fetchMentorCoverage({ forceRefresh: true }));
              setMentorsModal({ visible: true });
            }}
            onViewUnassigned={() => setUnassignedModal({ visible: true })}
            onViewCompanies={() => {
              dispatch(fetchInternshipStats({ forceRefresh: true }));
              setCompaniesModal({ visible: true });
            }}
          />
        </div>

        {/* Submission & Status Overview Section */}
        <div>
          <SectionTitle title="Submission & Status Overview" />
          <SubmissionStatusGrid
            {...submissionStatusData}
            loading={dashboardLoading}
            onViewReports={() => {
              dispatch(fetchFacultyWorkload());
              dispatch(fetchMentorCoverage());
              setReportsModal({ visible: true });
            }}
            onViewJoiningLetters={() => {
              dispatch(fetchJoiningLettersByMentor({ forceRefresh: true }));
              setJoiningLettersModal({ visible: true });
            }}
            onViewVisits={() => {
              dispatch(fetchFacultyWorkload());
              dispatch(fetchMentorCoverage());
              setVisitsModal({ visible: true });
            }}
            onViewGrievances={() => setGrievancesModal({ visible: true })}
          />
        </div>

        {/* Training Statistics Section */}
        {trainingStats && (
          <div>
            <SectionTitle title="Training Statistics" />
            <TrainingStatisticsGrid
              trainingsConducted={trainingStats.trainingsConducted}
              facultyRegistered={trainingStats.facultyRegistered}
              hoursDelivered={trainingStats.hoursDelivered}
              completed40Hours={trainingStats.completed40Hours}
              facultyCompleted={trainingStats.facultyCompleted}
              facultyOngoing={trainingStats.facultyOngoing}
              facultyYetToStart={trainingStats.facultyYetToStart}
              loading={trainingDashboardLoading}
              onViewTraining={() => navigate('/app/principal/training')}
            />
          </div>
        )}

        {/* Tabs for Internship Details and Faculty Workload */}
        <div className="mt-6">
          <Tabs
            defaultActiveKey="internships"
            items={[
              {
                key: 'internships',
                label: (
                  <span className="flex items-center gap-2">
                    <BankOutlined />
                    Internship Details
                  </span>
                ),
                children: <DashboardInternshipTable />,
              },
              {
                key: 'facultyWorkload',
                label: (
                  <span className="flex items-center gap-2">
                    <TeamOutlined />
                    Faculty Overview
                  </span>
                ),
                children: <FacultyWorkloadCard />,
              },
            ]}
          />
        </div>

        {/* Alert Details Modal */}
        <Modal
          title={alertDetailModal.title}
          open={alertDetailModal.visible}
          onCancel={() => setAlertDetailModal({ visible: false, type: null, title: '', data: [] })}
          footer={null}
          width={800}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          <Table
            dataSource={alertDetailModal.data}
            rowKey={(record) => record.studentId || record.grievanceId || record.id || Math.random()}
            pagination={{ pageSize: 10 }}
            size="small"
            columns={
              alertDetailModal.type === 'grievances' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Grievance', dataIndex: 'title', key: 'title' },
                { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'PENDING' ? 'orange' : 'blue'}>{s}</Tag> },
                { title: 'Days Pending', dataIndex: 'daysPending', key: 'daysPending', render: (d) => <Tag color="red">{d} days</Tag> },
              ] : alertDetailModal.type === 'reports' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Mentor', dataIndex: 'mentorName', key: 'mentorName', render: (m) => m || <Text type="secondary">Not assigned</Text> },
                { title: 'Days Overdue', dataIndex: 'daysOverdue', key: 'daysOverdue', render: (d) => <Tag color="orange">{d} days</Tag> },
              ] : alertDetailModal.type === 'visits' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Last Visit', dataIndex: 'lastVisitDate', key: 'lastVisitDate', render: (d) => d ? new Date(d).toLocaleDateString() : 'Never' },
                { title: 'Days Since Visit', dataIndex: 'daysSinceLastVisit', key: 'daysSinceLastVisit', render: (d) => d ? <Tag color="blue">{d} days</Tag> : <Tag color="red">Never visited</Tag> },
              ] : alertDetailModal.type === 'unassigned' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Batch', dataIndex: 'batchName', key: 'batchName' },
                { title: 'Branch', dataIndex: 'branchName', key: 'branchName' },
              ] : alertDetailModal.type === 'joiningLetters' ? [
                { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
                { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
                { title: 'Mentor', dataIndex: 'mentorName', key: 'mentorName', render: (m) => m || <Text type="secondary">Not assigned</Text> },
                { title: 'Branch', dataIndex: 'branchName', key: 'branchName' },
                { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (c) => c || <Text type="secondary">-</Text> },
                { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
              ] : []
            }
          />
        </Modal>

        {/* Students by Course Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <TeamOutlined className="text-primary" />
              <span>Students by Course</span>
              <Badge
                count={stats?.students?.active || 0}
                showZero
                style={{ backgroundColor: '#3b82f6' }}
                overflowCount={99999}
              />
            </div>
          }
          open={studentsModal.visible}
          onCancel={() => setStudentsModal({ visible: false })}
          footer={
            <Button onClick={() => navigate('/app/students')}>
              View All Students
            </Button>
          }
          width={700}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          {/* Summary Stats */}
          {(() => {
            const branchData = dashboardStats?.studentsByBranch || [];
            const totalWithInternship = branchData.reduce((sum, b) => sum + (b.withInternship || 0), 0);
            return (
              <div className="mb-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-info-light rounded-lg">
                  <div className="text-xl font-bold text-info">{stats?.students?.total || 0}</div>
                  <div className="text-xs text-text-tertiary">Total Students</div>
                </div>
                <div className="text-center p-3 bg-success-light rounded-lg">
                  <div className="text-xl font-bold text-success">{stats?.students?.active || 0}</div>
                  <div className="text-xs text-text-tertiary">Active Students</div>
                </div>
                <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{totalWithInternship}</div>
                  <div className="text-xs text-text-tertiary">With Internship</div>
                </div>
              </div>
            );
          })()}

          <Table
            dataSource={dashboardStats?.studentsByBranch || []}
            rowKey={(record) => record.branchId || record.branch || record.id || Math.random()}
            pagination={false}
            size="small"
            loading={dashboardLoading}
            columns={[
              {
                title: 'Course / Branch',
                dataIndex: 'branchName',
                key: 'branchName',
                render: (text, record) => text || record.branch || record.name || 'Unknown',
              },
              {
                title: 'Total Students',
                dataIndex: 'totalStudents',
                key: 'totalStudents',
                align: 'center',
                render: (val, record) => (
                  <Tag color="blue">{val || record.count || record.total || 0}</Tag>
                ),
              },
              {
                title: 'Active',
                dataIndex: 'activeStudents',
                key: 'activeStudents',
                align: 'center',
                render: (val, record) => (
                  <Tag color="green">{val || record.active || 0}</Tag>
                ),
              },
              {
                title: 'With Internship',
                dataIndex: 'withInternship',
                key: 'withInternship',
                align: 'center',
                render: (val) => (
                  <Tag color="purple">{typeof val === 'number' ? val : 0}</Tag>
                ),
              },
            ]}
            summary={() => {
              // Calculate totals from studentsByBranch data
              const branchData = dashboardStats?.studentsByBranch || [];
              const totalWithInternship = branchData.reduce((sum, b) => sum + (b.withInternship || 0), 0);
              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <Text strong>Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center">
                      <Text strong>{stats?.students?.total || 0}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="center">
                      <Text strong>{stats?.students?.active || 0}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="center">
                      <Text strong>{totalWithInternship}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
          />
        </Modal>

        {/* Mentors Details Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <TeamOutlined className="text-success" />
              <span>Mentor Details</span>
              <Badge count={mentorCoverage?.totalMentors || 0} style={{ backgroundColor: '#22c55e' }} />
            </div>
          }
          open={mentorsModal.visible}
          onCancel={() => setMentorsModal({ visible: false })}
          footer={
            <Button onClick={() => navigate('/app/staff')}>
              View All Staff
            </Button>
          }
          width={800}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-success-light rounded-lg">
              <div className="text-xl font-bold text-success">{mentorCoverage?.totalMentors || 0}</div>
              <div className="text-xs text-text-tertiary">Total Mentors</div>
            </div>
            <div className="text-center p-3 bg-info-light rounded-lg">
              <div className="text-xl font-bold text-info">{mentorCoverage?.studentsWithMentors || 0}</div>
              <div className="text-xs text-text-tertiary">Students Assigned</div>
            </div>
            <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{mentorCoverage?.coveragePercentage || 0}%</div>
              <div className="text-xs text-text-tertiary">Coverage Rate</div>
            </div>
          </div>
          <Table
            dataSource={mentorCoverage?.mentorLoadDistribution || []}
            rowKey={(record) => record.mentorId || record.id || Math.random()}
            pagination={{ pageSize: 10 }}
            size="small"
            loading={mentorCoverageLoading}
            columns={[
              {
                title: 'Mentor Name',
                dataIndex: 'mentorName',
                key: 'mentorName',
                render: (text, record) => text || record.name || 'Unknown',
              },
              {
                title: 'Department',
                dataIndex: 'department',
                key: 'department',
                render: (text) => text || '-',
              },
              {
                title: 'Assigned Students',
                dataIndex: 'assignedStudents',
                key: 'assignedStudents',
                align: 'center',
                sorter: (a, b) => (a.assignedStudents || 0) - (b.assignedStudents || 0),
                render: (val) => {
                  const count = val || 0;
                  let color = 'green';
                  if (count > 15) color = 'orange';
                  else if (count > 5) color = 'blue';
                  return <Tag color={color}>{count}</Tag>;
                },
              },
              {
                title: 'Load Status',
                key: 'loadStatus',
                align: 'center',
                render: (_, record) => {
                  const count = record.assignedStudents || 0;
                  if (count === 0) return <Tag>No Load</Tag>;
                  if (count <= 5) return <Tag color="green">Light</Tag>;
                  if (count <= 15) return <Tag color="blue">Optimal</Tag>;
                  return <Tag color="orange">Heavy</Tag>;
                },
              },
            ]}
          />
        </Modal>

        {/* Partner Companies Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <BankOutlined className="text-blue-500" />
              <span>Partner Companies</span>
              <Badge count={internshipStats?.totalUniqueCompanies || 0} style={{ backgroundColor: '#3b82f6' }} />
            </div>
          }
          open={companiesModal.visible}
          onCancel={() => setCompaniesModal({ visible: false })}
          width={900}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          <div className="mb-4 grid grid-cols-4 gap-3">
            <div className="text-center p-3 bg-info-light rounded-lg">
              <div className="text-xl font-bold text-info">
                {internshipStats?.totalUniqueCompanies || 0}
              </div>
              <div className="text-xs text-text-tertiary">Total Companies</div>
            </div>
            <div className="text-center p-3 bg-success-light rounded-lg">
              <div className="text-xl font-bold text-success">
                {internshipStats?.approved || 0}
              </div>
              <div className="text-xs text-text-tertiary">Approved</div>
            </div>
            <div className="text-center p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {internshipStats?.total || 0}
              </div>
              <div className="text-xs text-text-tertiary">Total Applications</div>
            </div>
            <div className="text-center p-3 bg-warning-light rounded-lg">
              <div className="text-xl font-bold text-warning">
                {internshipStats?.activeRate || 0}%
              </div>
              <div className="text-xs text-text-tertiary">Active Rate</div>
            </div>
          </div>

          <Table
            dataSource={internshipStats?.byCompany || []}
            rowKey={(record, index) => record.name || `company-${index}`}
            pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `Total ${total} companies` }}
            size="small"
            loading={internshipStatsLoading}
            columns={[
              {
                title: 'Company Name',
                dataIndex: 'name',
                key: 'name',
                width: '50%',
                render: (text, record) => (
                  <div>
                    <Text strong className="text-sm">{text || 'Unknown Company'}</Text>
                    {record.location && (
                      <Text type="secondary" className="block text-xs mt-0.5">
                        📍 {record.location}
                      </Text>
                    )}
                  </div>
                ),
              },
              {
                title: 'Students Placed',
                dataIndex: 'count',
                key: 'count',
                width: '25%',
                align: 'center',
                sorter: (a, b) => (a.count || 0) - (b.count || 0),
                defaultSortOrder: 'descend',
                render: (val) => (
                  <Tag color="blue" className="text-sm font-medium px-3 py-1">
                    {val || 0}
                  </Tag>
                ),
              },
              {
                title: 'Location',
                dataIndex: 'location',
                key: 'location',
                width: '25%',
                render: (text) => (
                  <Text type="secondary" className="text-xs">
                    {text || '-'}
                  </Text>
                ),
              },
            ]}
            locale={{
              emptyText: (
                <Empty
                  description={
                    <div className="py-4">
                      <Text type="secondary">No partner companies found</Text>
                      <div className="mt-2 text-xs text-text-tertiary">
                        Companies will appear here once students apply for internships
                      </div>
                    </div>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            }}
          />
        </Modal>

        {/* Monthly Reports Modal */}
        <MonthlyReportsModal
          visible={reportsModal.visible}
          onClose={() => setReportsModal({ visible: false })}
          alertsData={[]}
          complianceData={null}
        />

        {/* Faculty Visits Modal */}
        <FacultyVisitsModal
          visible={visitsModal.visible}
          onClose={() => setVisitsModal({ visible: false })}
          alertsData={[]}
          complianceData={null}
        />

        {/* Joining Report Modal */}
        <JoiningLettersModal
          visible={joiningLettersModal.visible}
          onClose={() => setJoiningLettersModal({ visible: false })}
        />

        {/* Unassigned Students Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <WarningOutlined className="text-error" />
              <span>Unassigned Students</span>
            </div>
          }
          open={unassignedModal.visible}
          onCancel={() => setUnassignedModal({ visible: false })}
          footer={
            <Button onClick={() => { setUnassignedModal({ visible: false }); navigate('/app/mentor-assignments'); }}>
              Go to Mentor Assignments
            </Button>
          }
          width={500}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          {(dashboardStats?.unassignedStudents || 0) === 0 ? (
            <div className="text-center py-8">
              <CheckCircleOutlined className="text-5xl text-success mb-4" />
              <Title level={4} className="mb-2! text-success">All Students Assigned!</Title>
              <Text type="secondary">
                All students with active internships have been assigned to mentors.
              </Text>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl font-bold text-error mb-4">
                {dashboardStats?.unassignedStudents || 0}
              </div>
              <Text className="text-lg">
                students with active internships need mentor assignment
              </Text>
              <div className="mt-4 p-4 bg-warning-light rounded-lg">
                <Text type="secondary">
                  These students have joined internships but have not been assigned a faculty mentor yet.
                </Text>
              </div>
            </div>
          )}
        </Modal>

        {/* Student Grievances Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <ExclamationCircleOutlined className="text-error" />
              <span>Student Grievances</span>
              <Badge count={stats?.grievances?.total || 0} style={{ backgroundColor: '#ef4444' }} />
            </div>
          }
          open={grievancesModal.visible}
          onCancel={() => setGrievancesModal({ visible: false })}
          footer={
            <Button onClick={() => { setGrievancesModal({ visible: false }); navigate('/app/grievances'); }}>
              View All Grievances
            </Button>
          }
          width={500}
          centered
          destroyOnClose
          transitionName=""
          maskTransitionName=""
        >
          {(stats?.grievances?.total || 0) === 0 ? (
            <div className="text-center py-8">
              <CheckCircleOutlined className="text-5xl text-success mb-4" />
              <Title level={4} className="mb-2! text-success">No Grievances!</Title>
              <Text type="secondary">
                There are no student grievances at this time.
              </Text>
            </div>
          ) : (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="text-center p-4 bg-info-light rounded-lg">
                  <div className="text-3xl font-bold text-info">{stats?.grievances?.total || 0}</div>
                  <div className="text-sm text-text-tertiary">Total Grievances</div>
                </div>
                <div className="text-center p-4 bg-error-light rounded-lg">
                  <div className="text-3xl font-bold text-error">{stats?.grievances?.pending || 0}</div>
                  <div className="text-sm text-text-tertiary">Pending / Unaddressed</div>
                </div>
              </div>
              {(stats?.grievances?.pending || 0) > 0 && (
                <div className="p-4 bg-warning-light rounded-lg">
                  <Text type="secondary">
                    {stats?.grievances?.pending} grievance(s) require attention. Please review and address them promptly.
                  </Text>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default React.memo(PrincipalDashboard);
