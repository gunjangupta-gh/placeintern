import { useEffect, useCallback, useRef, useTransition } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchStudentDashboard,
  fetchStudentProfile,
  fetchMyReports,
  fetchGrievances,
  withdrawApplication,
  updateApplication,
  submitMonthlyReport,
} from '../store/studentSlice';
import {
  selectDashboard,
  selectProfile,
  selectInternships,
  selectApplications,
  selectReports,
  selectMentor,
  selectGrievances,
  selectNormalizedApplicationsList,
  selectNormalizedGrievancesList,
  selectSelfIdentifiedApplications,
  selectPlatformApplications,
  selectActiveInternships,
  selectRecentApplications,
  selectMonthlyReportsWithInfo,
  selectCalculatedStats,
  selectCombinedLoadingStates,
  selectDashboardIsLoading,
  selectCombinedErrors,
  selectHasDashboardError,
  selectMentorWithFallback,
  selectProfileData,
  selectInternshipsList,
  selectReportsList,
  // Profile-based selectors for optimization
  selectApplicationsFromProfile,
  selectActiveInternshipsFromProfile,
  selectSelfIdentifiedFromProfile,
  selectPlatformFromProfile,
  selectStatsFromProfile,
  selectCountsFromProfile,
} from '../store/studentSelectors';

/**
 * Custom hook for Student Dashboard data management
 * Uses Redux for state management with optimized data fetching
 */
export const useStudentDashboard = () => {
  const dispatch = useDispatch();
  const hasFetchedRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  // Redux state - using memoized selectors
  const dashboard = useSelector(selectDashboard);
  const profile = useSelector(selectProfile);
  const internships = useSelector(selectInternships);
  const applications = useSelector(selectApplications);
  const reports = useSelector(selectReports);
  const mentor = useSelector(selectMentor);
  const grievances = useSelector(selectGrievances);

  // Derived selectors
  const loadingStates = useSelector(selectCombinedLoadingStates);
  const isLoading = useSelector(selectDashboardIsLoading);
  const errors = useSelector(selectCombinedErrors);
  const hasError = useSelector(selectHasDashboardError);

  // Fetch all dashboard data - using startTransition for non-blocking updates
  const fetchDashboardData = useCallback((forceRefresh = false) => {
    // Wrap dispatches in startTransition to prevent UI blocking
    startTransition(() => {
      dispatch(fetchStudentDashboard({ forceRefresh }));
      dispatch(fetchStudentProfile({ forceRefresh }));
      dispatch(fetchMyReports({ forceRefresh }));
      dispatch(fetchGrievances());
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

  // Use memoized selectors for derived data
  const normalizedApplications = useSelector(selectNormalizedApplicationsList);
  const normalizedGrievances = useSelector(selectNormalizedGrievancesList);

  // Profile-based selectors (preferred - data from single API call)
  const applicationsFromProfile = useSelector(selectApplicationsFromProfile);
  const selfIdentifiedFromProfile = useSelector(selectSelfIdentifiedFromProfile);
  const platformFromProfile = useSelector(selectPlatformFromProfile);
  const activeInternshipsFromProfile = useSelector(selectActiveInternshipsFromProfile);
  const statsFromProfile = useSelector(selectStatsFromProfile);
  const countsFromProfile = useSelector(selectCountsFromProfile);

  // Fallback selectors
  const selfIdentifiedApplications = useSelector(selectSelfIdentifiedApplications);
  const platformApplications = useSelector(selectPlatformApplications);
  const stats = useSelector(selectCalculatedStats);
  const activeInternships = useSelector(selectActiveInternships);
  const recentApplications = useSelector(selectRecentApplications);
  const monthlyReports = useSelector(selectMonthlyReportsWithInfo);
  const mentorData = useSelector(selectMentorWithFallback);
  const profileData = useSelector(selectProfileData);
  const internshipsList = useSelector(selectInternshipsList);
  const reportsList = useSelector(selectReportsList);

  // Merge stats from profile with calculated stats
  const mergedStats = {
    ...stats,
    ...statsFromProfile,
    totalApplications: countsFromProfile?.internshipApplications || stats?.totalApplications || 0,
    totalMonthlyReports: countsFromProfile?.monthlyReports || 0,
    totalGrievances: countsFromProfile?.grievances || stats?.grievances || 0,
  };

  // Action handlers
  const handleWithdrawApplication = useCallback(async (applicationId) => {
    return dispatch(withdrawApplication(applicationId)).unwrap();
  }, [dispatch]);

  const handleUpdateApplication = useCallback(async (id, data) => {
    return dispatch(updateApplication({ id, data })).unwrap();
  }, [dispatch]);

  const handleSubmitReport = useCallback(async (reportId, data) => {
    return dispatch(submitMonthlyReport({ reportId, data })).unwrap();
  }, [dispatch]);

  const refresh = useCallback(() => {
    return fetchDashboardData(true);
  }, [fetchDashboardData]);

  // Prefer profile data over separate API call data
  const effectiveApplications = applicationsFromProfile.length > 0
    ? applicationsFromProfile
    : normalizedApplications;
  const effectiveSelfIdentified = selfIdentifiedFromProfile.length > 0
    ? selfIdentifiedFromProfile
    : selfIdentifiedApplications;
  const effectivePlatformApplications = platformFromProfile.length > 0
    ? platformFromProfile
    : platformApplications;
  const effectiveActiveInternships = activeInternshipsFromProfile.length > 0
    ? activeInternshipsFromProfile
    : activeInternships;

  return {
    // State
    isLoading: isLoading || isPending,
    isRevalidating: isPending, // Shows during background transitions
    loadingStates,
    dashboard: dashboard.stats,
    profile: profileData,
    mentor: mentorData,
    grievances: normalizedGrievances,
    applications: effectiveApplications,
    selfIdentified: effectiveSelfIdentified,
    platformApplications: effectivePlatformApplications,
    internships: internshipsList,
    reports: reportsList,

    // Computed
    stats: mergedStats,
    activeInternships: effectiveActiveInternships,
    recentApplications,
    monthlyReports,
    counts: countsFromProfile,

    // Actions
    refresh,
    fetchDashboardData,
    handleWithdrawApplication,
    handleUpdateApplication,
    handleSubmitReport,

    // Errors
    errors,
    hasError,
    error: dashboard.error || profile.error || applications.error,
  };
};

export default useStudentDashboard;
