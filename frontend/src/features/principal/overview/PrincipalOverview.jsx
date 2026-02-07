import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Spin,
  Button,
  Badge,
  Tooltip,
  Alert,
  Modal,
  Table,
  Tag,
} from 'antd';
import {
  BankOutlined,
  ReloadOutlined,
  RightOutlined,
  TeamOutlined,
  ReadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  AlertOutlined,
  DashboardOutlined,
  LaptopOutlined,
  ClockCircleOutlined,
  SolutionOutlined,
  CarOutlined,
} from '@ant-design/icons';
import {
  fetchPrincipalDashboard,
  fetchMentorCoverage,
  fetchAlertsEnhanced,
  selectDashboardStats,
  selectDashboardLoading,
  selectDashboardError,
  selectMentorCoverage,
  selectMentorCoverageLoading,
  selectAlertsEnhanced,
  selectAlertsEnhancedLoading,
  selectMostRecentFetch,
} from '../store/principalSlice';

const { Title, Text } = Typography;

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

const PrincipalOverview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [principalName, setPrincipalName] = useState('Principal');
  const [alertDetailModal, setAlertDetailModal] = useState({ visible: false, type: null, title: '', data: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redux selectors
  const dashboardStats = useSelector(selectDashboardStats);
  const dashboardLoading = useSelector(selectDashboardLoading);
  const dashboardError = useSelector(selectDashboardError);
  const mentorCoverage = useSelector(selectMentorCoverage);
  const mentorCoverageLoading = useSelector(selectMentorCoverageLoading);
  const alertsEnhanced = useSelector(selectAlertsEnhanced);
  const alertsEnhancedLoading = useSelector(selectAlertsEnhancedLoading);
  const lastFetched = useSelector(selectMostRecentFetch);

  // Memoized stats
  const stats = useMemo(() => {
    if (!dashboardStats) return null;
    const studentsData = dashboardStats.students || {};
    const staffData = dashboardStats.staff || {};
    const internshipsData = dashboardStats.internships || {};
    return {
      students: { total: studentsData.total || 0 },
      staff: { total: staffData.total || 0 },
      internships: {
        total: internshipsData.totalApplications || 0,
        ongoing: internshipsData.ongoingInternships || 0,
      },
    };
  }, [dashboardStats]);

  // Calculate total pending items
  const pendingItems = useMemo(() => {
    if (!alertsEnhanced?.summary) return { total: 0, reports: 0, visits: 0, grievances: 0, joiningLetters: 0 };
    return {
      reports: alertsEnhanced.summary.overdueReportsCount || 0,
      visits: alertsEnhanced.summary.missingVisitsCount || 0,
      grievances: alertsEnhanced.summary.urgentGrievancesCount || 0,
      joiningLetters: alertsEnhanced.summary.pendingJoiningLettersCount || 0,
      total: (alertsEnhanced.summary.overdueReportsCount || 0) +
             (alertsEnhanced.summary.missingVisitsCount || 0) +
             (alertsEnhanced.summary.urgentGrievancesCount || 0) +
             (alertsEnhanced.summary.pendingJoiningLettersCount || 0),
    };
  }, [alertsEnhanced]);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setPrincipalName(currentUser?.name || 'Principal');
    dispatch(fetchPrincipalDashboard());
    dispatch(fetchMentorCoverage());
    dispatch(fetchAlertsEnhanced());
  }, [dispatch]);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchPrincipalDashboard({ forceRefresh: true })),
        dispatch(fetchMentorCoverage({ forceRefresh: true })),
        dispatch(fetchAlertsEnhanced({ forceRefresh: true })),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  const currentDate = useMemo(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }), []);

  const isLoading = dashboardLoading && !stats;

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading overview...</Text>
      </div>
    );
  }

  if (!stats && dashboardError) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <Alert
          type="error"
          message="Failed to load data"
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

  // Action item click handler
  const handleActionItemClick = (type, title, data) => {
    if (data?.length > 0) {
      setAlertDetailModal({ visible: true, type, title, data });
    }
  };

  // Modal columns configuration
  const getModalColumns = (type) => {
    const baseColumns = [
      { title: 'Student', dataIndex: 'studentName', key: 'studentName' },
      { title: 'Roll No', dataIndex: 'rollNumber', key: 'rollNumber' },
    ];

    switch (type) {
      case 'grievances':
        return [
          ...baseColumns,
          { title: 'Grievance', dataIndex: 'title', key: 'title' },
          { title: 'Status', dataIndex: 'status', key: 'status', render: (s) => <Tag color={s === 'PENDING' ? 'orange' : 'blue'}>{s}</Tag> },
          { title: 'Days Pending', dataIndex: 'daysPending', key: 'daysPending', render: (d) => <Tag color="red">{d} days</Tag> },
        ];
      case 'reports':
        return [
          ...baseColumns,
          { title: 'Mentor', dataIndex: 'mentorName', key: 'mentorName', render: (m) => m || <Text type="secondary">Not assigned</Text> },
          { title: 'Days Overdue', dataIndex: 'daysOverdue', key: 'daysOverdue', render: (d) => <Tag color="orange">{d} days</Tag> },
        ];
      case 'visits':
        return [
          ...baseColumns,
          { title: 'Last Visit', dataIndex: 'lastVisitDate', key: 'lastVisitDate', render: (d) => d ? new Date(d).toLocaleDateString() : 'Never' },
          { title: 'Days Since', dataIndex: 'daysSinceLastVisit', key: 'daysSinceLastVisit', render: (d) => d ? <Tag color="blue">{d} days</Tag> : <Tag color="red">Never</Tag> },
        ];
      case 'joiningLetters':
        return [
          ...baseColumns,
          { title: 'Company', dataIndex: 'companyName', key: 'companyName', render: (c) => c || '-' },
          { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', render: (d) => d ? new Date(d).toLocaleDateString() : '-' },
        ];
      default:
        return baseColumns;
    }
  };

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface border border-border shadow-sm text-primary shadow-sm mr-3">
              <BankOutlined className="text-lg" />
            </div>
            <div>
              <Title level={3} className="mb-0 text-text-primary">
                Quick Overview
              </Title>
              <Text className="text-text-secondary text-sm">
                Welcome, <span className="font-semibold text-primary">{principalName}</span> • {currentDate}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastFetched && (
              <span className="text-xs text-text-tertiary hidden sm:inline">
                Updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
            <Tooltip title="Refresh data">
              <Button
                icon={<ReloadOutlined spin={isRefreshing} />}
                onClick={refreshData}
                loading={isRefreshing}
                size="small"
              />
            </Tooltip>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Action Items */}
            <Card
              className="border-border shadow-soft rounded-xl bg-surface"
              styles={{ body: { padding: '20px' } }}
              loading={alertsEnhancedLoading}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertOutlined className="text-warning text-lg" />
                  <Title level={5} className="mb-0">Action Items</Title>
                </div>
                {pendingItems.total > 0 && (
                  <Badge count={pendingItems.total} className="[&_.ant-badge-count]:bg-warning" />
                )}
              </div>

              {pendingItems.total === 0 ? (
                <div className="text-center py-6">
                  <CheckCircleOutlined className="text-4xl text-success mb-2" />
                  <Text className="text-text-secondary block">All caught up! No pending items.</Text>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Tooltip title={pendingItems.reports > 0 ? 'Click to view details' : 'No overdue reports'}>
                    <div
                      className={`text-center p-4 rounded-xl transition-all ${
                        pendingItems.reports > 0
                          ? 'bg-warning/10 cursor-pointer hover:bg-warning/20 hover:shadow-sm'
                          : 'bg-background-tertiary'
                      }`}
                      onClick={() => handleActionItemClick('reports', 'Overdue Reports', alertsEnhanced?.alerts?.overdueReports)}
                    >
                      <FileTextOutlined className={`text-2xl mb-2 ${pendingItems.reports > 0 ? 'text-warning' : 'text-text-tertiary'}`} />
                      <div className={`text-2xl font-bold ${pendingItems.reports > 0 ? 'text-warning' : 'text-text-tertiary'}`}>
                        {pendingItems.reports}
                      </div>
                      <div className="text-xs text-text-secondary font-medium">Overdue Reports</div>
                    </div>
                  </Tooltip>

                  <Tooltip title={pendingItems.visits > 0 ? 'Click to view details' : 'No visits due'}>
                    <div
                      className={`text-center p-4 rounded-xl transition-all ${
                        pendingItems.visits > 0
                          ? 'bg-info/10 cursor-pointer hover:bg-info/20 hover:shadow-sm'
                          : 'bg-background-tertiary'
                      }`}
                      onClick={() => handleActionItemClick('visits', 'Missing Faculty Visits', alertsEnhanced?.alerts?.missingVisits)}
                    >
                      <EyeOutlined className={`text-2xl mb-2 ${pendingItems.visits > 0 ? 'text-info' : 'text-text-tertiary'}`} />
                      <div className={`text-2xl font-bold ${pendingItems.visits > 0 ? 'text-info' : 'text-text-tertiary'}`}>
                        {pendingItems.visits}
                      </div>
                      <div className="text-xs text-text-secondary font-medium">Visits Due</div>
                    </div>
                  </Tooltip>

                  <Tooltip title={pendingItems.grievances > 0 ? 'Click to view details' : 'No urgent grievances'}>
                    <div
                      className={`text-center p-4 rounded-xl transition-all ${
                        pendingItems.grievances > 0
                          ? 'bg-error/10 cursor-pointer hover:bg-error/20 hover:shadow-sm'
                          : 'bg-background-tertiary'
                      }`}
                      onClick={() => handleActionItemClick('grievances', 'Urgent Grievances', alertsEnhanced?.alerts?.urgentGrievances)}
                    >
                      <ExclamationCircleOutlined className={`text-2xl mb-2 ${pendingItems.grievances > 0 ? 'text-error' : 'text-text-tertiary'}`} />
                      <div className={`text-2xl font-bold ${pendingItems.grievances > 0 ? 'text-error' : 'text-text-tertiary'}`}>
                        {pendingItems.grievances}
                      </div>
                      <div className="text-xs text-text-secondary font-medium">Grievances</div>
                    </div>
                  </Tooltip>

                  <Tooltip title={pendingItems.joiningLetters > 0 ? 'Click to view details' : 'No pending letters'}>
                    <div
                      className={`text-center p-4 rounded-xl transition-all ${
                        pendingItems.joiningLetters > 0
                          ? 'bg-purple-500/10 cursor-pointer hover:bg-purple-500/20 hover:shadow-sm'
                          : 'bg-background-tertiary'
                      }`}
                      onClick={() => handleActionItemClick('joiningLetters', 'Pending Joining Reports', alertsEnhanced?.alerts?.pendingJoiningLetters)}
                    >
                      <FileTextOutlined className={`text-2xl mb-2 ${pendingItems.joiningLetters > 0 ? 'text-purple-600' : 'text-text-tertiary'}`} />
                      <div className={`text-2xl font-bold ${pendingItems.joiningLetters > 0 ? 'text-purple-600' : 'text-text-tertiary'}`}>
                        {pendingItems.joiningLetters}
                      </div>
                      <div className="text-xs text-text-secondary font-medium">Joining Reports</div>
                    </div>
                  </Tooltip>
                </div>
              )}
            </Card>

            {/* Institution Health */}
            <Card
              className="border-border shadow-soft rounded-xl bg-surface"
              styles={{ body: { padding: '20px' } }}
              loading={dashboardLoading || mentorCoverageLoading}
            >
              <Title level={5} className="mb-4">Institution Health</Title>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                <Tooltip title="Total number of students registered in your institution">
                  <div className="text-center p-3 bg-primary/5 rounded-xl cursor-help transition-all hover:shadow-sm">
                    <ReadOutlined className="text-xl text-primary mb-1" />
                    <div className="text-2xl font-bold text-primary">{stats?.students?.total || 0}</div>
                    <div className="text-xs text-text-secondary font-medium">Students</div>
                  </div>
                </Tooltip>

                <Tooltip title="Total faculty and administrative staff members">
                  <div className="text-center p-3 bg-success/5 rounded-xl cursor-help transition-all hover:shadow-sm">
                    <TeamOutlined className="text-xl text-success mb-1" />
                    <div className="text-2xl font-bold text-success">{stats?.staff?.total || 0}</div>
                    <div className="text-xs text-text-secondary font-medium">Staff</div>
                  </div>
                </Tooltip>

                <Tooltip title="Students who have registered an internship">
                  <div className="text-center p-3 bg-purple-500/5 rounded-xl cursor-help transition-all hover:shadow-sm">
                    <LaptopOutlined className="text-xl text-purple-600 mb-1" />
                    <div className="text-2xl font-bold text-purple-600">{stats?.internships?.total || 0}</div>
                    <div className="text-xs text-text-secondary font-medium">With Internship</div>
                  </div>
                </Tooltip>

                <Tooltip title="Internships currently in progress">
                  <div className="text-center p-3 bg-warning/5 rounded-xl cursor-help transition-all hover:shadow-sm">
                    <ClockCircleOutlined className="text-xl text-warning mb-1" />
                    <div className="text-2xl font-bold text-warning">{stats?.internships?.ongoing || 0}</div>
                    <div className="text-xs text-text-secondary font-medium">Ongoing</div>
                  </div>
                </Tooltip>

                <Tooltip title="Percentage of students assigned to a faculty mentor">
                  <div className="text-center p-3 bg-info/5 rounded-xl cursor-help transition-all hover:shadow-sm">
                    <TeamOutlined className="text-xl text-info mb-1" />
                    <div className="text-2xl font-bold text-info">{mentorCoverage?.coveragePercentage || 0}%</div>
                    <div className="text-xs text-text-secondary font-medium">Mentor Coverage</div>
                  </div>
                </Tooltip>
              </div>
            </Card>
          </div>

          {/* Right Column - Quick Links Sidebar */}
          <div className="lg:col-span-1">
            <Card
              className="border-border shadow-sm rounded-xl sticky top-6"
              styles={{ body: { padding: '16px' } }}
            >
              <Title level={5} className="mb-4">Quick Links</Title>
              <div className="space-y-2">
                <Tooltip title="View complete dashboard with all metrics and charts" placement="left">
                  <Button
                    type="default"
                    block
                    className="h-12 rounded-lg border-border hover:border-primary hover:text-primary flex items-center justify-start gap-3 px-4 bg-surface hover:bg-surface-hover"
                    onClick={() => navigate('/app/dashboard')}
                  >
                    <DashboardOutlined className="text-lg" />
                    <span>Full Dashboard</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Assign faculty mentors to students" placement="left">
                  <Button
                    type="default"
                    block
                    className="h-12 rounded-lg border-border hover:border-primary hover:text-primary flex items-center justify-start gap-3 px-4 bg-surface hover:bg-surface-hover"
                    onClick={() => navigate('/app/mentors')}
                  >
                    <SolutionOutlined className="text-lg" />
                    <span>Mentor Assignment</span>
                  </Button>
                </Tooltip>
                <Tooltip title="View and manage all student internships" placement="left">
                  <Button
                    type="default"
                    block
                    className="h-12 rounded-lg border-border hover:border-primary hover:text-primary flex items-center justify-start gap-3 px-4 bg-surface hover:bg-surface-hover"
                    onClick={() => navigate('/app/internships')}
                  >
                    <LaptopOutlined className="text-lg" />
                    <span>All Internships</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Track faculty visits and report submissions" placement="left">
                  <Button
                    type="default"
                    block
                    className="h-12 rounded-lg border-border hover:border-primary hover:text-primary flex items-center justify-start gap-3 px-4 bg-surface hover:bg-surface-hover"
                    onClick={() => navigate('/app/faculty-progress')}
                  >
                    <CarOutlined className="text-lg" />
                    <span>Faculty Progress</span>
                  </Button>
                </Tooltip>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Alert Details Modal */}
      <Modal
        title={alertDetailModal.title}
        open={alertDetailModal.visible}
        onCancel={() => setAlertDetailModal({ visible: false, type: null, title: '', data: [] })}
        footer={null}
        width={700}
      >
        <Table className="custom-table"
          dataSource={alertDetailModal.data}
          rowKey={(record) => record.studentId || record.grievanceId || record.id || Math.random()}
          pagination={{ pageSize: 10 }}
          size="small"
          columns={getModalColumns(alertDetailModal.type)}
        />
      </Modal>
    </div>
  );
};

export default React.memo(PrincipalOverview);

