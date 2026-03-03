import { useEffect, useCallback, useMemo, useRef, useTransition } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchFacultyDashboard,
  fetchMonthlyStats,
  fetchAssignedStudents,
  fetchVisitLogs,
  fetchProfile,
  fetchApplications,
  fetchMonthlyReportsForDashboard,
  fetchJoiningLetters,
  createVisitLog,
  updateVisitLog,
  deleteVisitLog,
  approveApplication,
  rejectApplication,
  submitFeedback,
  selectDashboard,
  selectMonthlyStats,
  selectStudents,
  selectVisitLogs,
  selectProfile,
  selectApplications,
  selectMonthlyReports,
  selectJoiningLetters,
  selectMostRecentFetch,
} from '../store/facultySlice';

/**
 * Custom hook for Faculty Dashboard data management
 * Uses Redux for state management with optimized data fetching
 */
export const useFacultyDashboard = () => {
  const dispatch = useDispatch();
  const hasFetchedRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  // Selectors
  const dashboard = useSelector(selectDashboard);
  const monthlyStats = useSelector(selectMonthlyStats);
  const students = useSelector(selectStudents);
  const visitLogs = useSelector(selectVisitLogs);
  const profile = useSelector(selectProfile);
  const applications = useSelector(selectApplications);
  const monthlyReports = useSelector(selectMonthlyReports);
  const joiningLetters = useSelector(selectJoiningLetters);
  const mostRecentFetch = useSelector(selectMostRecentFetch);

  // Derived loading state from Redux
  const isLoading = useMemo(() => (
    dashboard.loading ||
    monthlyStats.loading ||
    students.loading ||
    visitLogs.loading ||
    monthlyReports.loading ||
    joiningLetters.loading
  ), [dashboard.loading, monthlyStats.loading, students.loading, visitLogs.loading, monthlyReports.loading, joiningLetters.loading]);

  const normalizedMonthlyStats = useMemo(() => {
    const raw = monthlyStats.data;
    if (!raw) return null;
    if (raw.data && typeof raw.data === 'object') {
      return raw.data;
    }
    return raw;
  }, [monthlyStats.data]);

  useEffect(() => {
    if (import.meta.env.DEV && normalizedMonthlyStats) {
      console.debug('[FacultyDashboard] monthly stats', normalizedMonthlyStats);
    }
  }, [normalizedMonthlyStats]);

  // Fetch all dashboard data - using startTransition for non-blocking updates
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    startTransition(() => {
      dispatch(fetchFacultyDashboard({ forceRefresh }));
      dispatch(fetchMonthlyStats({ forceRefresh }));
      dispatch(fetchAssignedStudents({ forceRefresh }));
      dispatch(fetchVisitLogs({ forceRefresh }));
      dispatch(fetchProfile());
      dispatch(fetchApplications({ forceRefresh }));
      dispatch(fetchMonthlyReportsForDashboard({ forceRefresh }));
      dispatch(fetchJoiningLetters({ forceRefresh }));
    });
  }, [dispatch, startTransition]);

  // Initial data fetch on mount
  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchDashboardData(false);
    }
  }, [fetchDashboardData]);

  // Revalidate on window focus (throttled + deferred)
  useEffect(() => {
    let lastFocusTime = 0;
    const THROTTLE_MS = 120000; // 2 minutes

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusTime > THROTTLE_MS) {
        lastFocusTime = now;
        // Defer to avoid blocking the focus event
        requestAnimationFrame(() => {
          fetchDashboardData(false);
        });
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchDashboardData]);

  // Calculate statistics from dashboard data
  // All visit/report counts come from backend (uses ExpectedCycleService calculations)
  const stats = useMemo(() => {
    const dashboardStats = dashboard.stats || {};

    return {
      totalStudents: dashboardStats.totalStudents || students.total || 0,
      activeStudents: dashboardStats.activeInternships || 0,
      activeInternships: dashboardStats.activeInternships || 0,
      totalVisits: dashboardStats.totalVisits || visitLogs.total || 0,
      completedVisits: dashboardStats.completedVisits || 0, // From backend (status: COMPLETED)
      pendingReports: dashboardStats.pendingReports || 0,
      pendingApprovals: dashboardStats.pendingApprovals || applications.total || 0,
      totalApplications: applications.total || 0,
      approvedApplications: applications.list.filter(a => a.status === 'APPROVED').length,
      pendingGrievances: dashboardStats.pendingGrievances || 0,
      totalGrievances: dashboardStats.totalGrievances || 0,
    };
  }, [dashboard.stats, students.total, visitLogs.total, applications.list, applications.total]);

  // Get pending approvals from applications list
  const pendingApprovals = useMemo(() => {
    return applications.list.filter(app =>
      app.status === 'APPLIED' || app.status === 'PENDING' || app.status === 'UNDER_REVIEW'
    );
  }, [applications.list]);

  // Get upcoming visits from dashboard or visit logs
  const upcomingVisits = useMemo(() => {
    if (dashboard.upcomingVisits && dashboard.upcomingVisits.length > 0) {
      return dashboard.upcomingVisits;
    }
    return visitLogs.list
      .filter(v => new Date(v.visitDate) > new Date())
      .sort((a, b) => new Date(a.visitDate) - new Date(b.visitDate))
      .slice(0, 5);
  }, [dashboard.upcomingVisits, visitLogs.list]);

  // Action handlers
  const handleCreateVisitLog = useCallback(async (data) => {
    return dispatch(createVisitLog(data)).unwrap();
  }, [dispatch]);

  const handleUpdateVisitLog = useCallback(async (id, data) => {
    return dispatch(updateVisitLog({ id, data })).unwrap();
  }, [dispatch]);

  const handleDeleteVisitLog = useCallback(async (id) => {
    return dispatch(deleteVisitLog(id)).unwrap();
  }, [dispatch]);

  const handleApproveApplication = useCallback(async (applicationId, data = {}) => {
    return dispatch(approveApplication({ applicationId, data })).unwrap();
  }, [dispatch]);

  const handleRejectApplication = useCallback(async (applicationId, reason) => {
    return dispatch(rejectApplication({ applicationId, reason })).unwrap();
  }, [dispatch]);

  const handleSubmitFeedback = useCallback(async (applicationId, feedbackData) => {
    return dispatch(submitFeedback({ applicationId, feedbackData })).unwrap();
  }, [dispatch]);

  // Note: reviewMonthlyReport removed - auto-approval implemented
  // This function is kept for backwards compatibility but is a no-op
  const handleReviewReport = useCallback(async (reportId, reviewData) => {
    console.warn('handleReviewReport is deprecated - auto-approval is now implemented');
    return Promise.resolve();
  }, []);

  const refresh = useCallback(() => {
    return fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Get pending joining letters
  const pendingJoiningLetters = useMemo(() => {
    return joiningLetters.list.filter(l => !l.reviewedAt);
  }, [joiningLetters.list]);

  // Get pending monthly reports
  // With auto-approval, only DRAFT reports are considered pending
  const pendingMonthlyReports = useMemo(() => {
    return monthlyReports.list.filter(r => r.status === 'DRAFT');
  }, [monthlyReports.list]);

  // Grievance stats from dashboard API
  const grievanceStats = useMemo(() => ({
    pending: dashboard.stats?.pendingGrievances || 0,
    total: dashboard.stats?.totalGrievances || 0,
  }), [dashboard.stats]);

  return {
    // State
    isLoading: isLoading || isPending,
    isRevalidating: isPending, // Shows during background transitions
    lastFetched: mostRecentFetch,
    dashboard: {
      ...dashboard.stats,
      monthlyReports: monthlyReports.list,
      joiningLetters: joiningLetters.list,
    },
    // Monthly stats from backend (uses monthly inclusion rules)
    monthlyStats: normalizedMonthlyStats,
    students: students.list,
    visitLogs: visitLogs.list,
    monthlyReports: monthlyReports.list,
    joiningLetters: joiningLetters.list,
    mentor: profile.data,
    grievances: [],
    grievanceStats,
    applications: applications.list,

    // Computed
    stats: {
      ...stats,
      pendingJoiningLetters: dashboard.stats?.pendingJoiningLetters ?? pendingJoiningLetters.length,
      totalJoiningLetters: dashboard.stats?.totalJoiningLetters ?? joiningLetters.list.length,
      pendingMonthlyReports: pendingMonthlyReports.length,
      pendingGrievances: grievanceStats.pending,
      totalGrievances: grievanceStats.total,
    },
    pendingApprovals,
    pendingJoiningLetters,
    pendingMonthlyReports,
    upcomingVisits,

    // Actions
    refresh,
    fetchDashboardData,
    handleCreateVisitLog,
    handleUpdateVisitLog,
    handleDeleteVisitLog,
    handleApproveApplication,
    handleRejectApplication,
    handleSubmitFeedback,
    handleReviewReport,

    // Errors
    error: dashboard.error || monthlyStats.error || students.error || visitLogs.error || monthlyReports.error || joiningLetters.error,
  };
};

export default useFacultyDashboard;
