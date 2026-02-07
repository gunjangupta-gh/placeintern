import { createSelector } from '@reduxjs/toolkit';

// Default constants for fallback values
const DEFAULT_LIST = [];
const DEFAULT_OBJECT = {};
const DEFAULT_PAGINATION = {
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};
const DEFAULT_STATS = null;
const DEFAULT_LOADING = false;
const DEFAULT_ERROR = null;
const DEFAULT_LAST_FETCHED = {
  dashboard: null,
  students: null,
  studentsKey: null,
  staff: null,
  staffKey: null,
  mentors: null,
  batches: null,
  departments: null,
  mentorAssignments: null,
  mentorStats: null,
  mentorCoverage: null,
  complianceMetrics: null,
  alertsEnhanced: null,
  joiningLetterStats: null,
  joiningLetters: null,
  joiningLetterActivity: null,
  internshipStats: null,
  facultyWorkload: null,
};

// ============= BASE SELECTOR =============

/**
 * Base selector to access the principal state
 */
export const selectPrincipalState = (state) => state.principal || DEFAULT_OBJECT;

// ============= DASHBOARD SELECTORS =============

/**
 * Select the entire dashboard state object
 */
export const selectDashboard = createSelector(
  [selectPrincipalState],
  (principal) => principal.dashboard || DEFAULT_OBJECT
);

/**
 * Select dashboard stats
 */
export const selectDashboardStats = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.stats || DEFAULT_STATS
);

/**
 * Select dashboard loading state
 */
export const selectDashboardLoading = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.loading || DEFAULT_LOADING
);

/**
 * Select dashboard error state
 */
export const selectDashboardError = createSelector(
  [selectDashboard],
  (dashboard) => dashboard.error || DEFAULT_ERROR
);

// ============= STUDENTS SELECTORS =============

/**
 * Select the entire students state object
 */
export const selectStudents = createSelector(
  [selectPrincipalState],
  (principal) => principal.students || DEFAULT_OBJECT
);

/**
 * Select students list
 */
export const selectStudentsList = createSelector(
  [selectStudents],
  (students) => students.list || DEFAULT_LIST
);

/**
 * Select students loading state
 */
export const selectStudentsLoading = createSelector(
  [selectStudents],
  (students) => students.loading || DEFAULT_LOADING
);

/**
 * Select students error state
 */
export const selectStudentsError = createSelector(
  [selectStudents],
  (students) => students.error || DEFAULT_ERROR
);

/**
 * Select students pagination
 */
export const selectStudentsPagination = createSelector(
  [selectStudents],
  (students) => students.pagination || DEFAULT_PAGINATION
);

/**
 * Select selected student
 */
export const selectSelectedStudent = createSelector(
  [selectStudents],
  (students) => students.selected || null
);

// ============= STAFF SELECTORS =============

/**
 * Select the entire staff state object
 */
export const selectStaff = createSelector(
  [selectPrincipalState],
  (principal) => principal.staff || DEFAULT_OBJECT
);

/**
 * Select staff list
 */
export const selectStaffList = createSelector(
  [selectStaff],
  (staff) => staff.list || DEFAULT_LIST
);

/**
 * Select staff loading state
 */
export const selectStaffLoading = createSelector(
  [selectStaff],
  (staff) => staff.loading || DEFAULT_LOADING
);

/**
 * Select staff error state
 */
export const selectStaffError = createSelector(
  [selectStaff],
  (staff) => staff.error || DEFAULT_ERROR
);

/**
 * Select staff pagination
 */
export const selectStaffPagination = createSelector(
  [selectStaff],
  (staff) => staff.pagination || DEFAULT_PAGINATION
);

/**
 * Select selected staff member
 */
export const selectSelectedStaff = createSelector(
  [selectStaff],
  (staff) => staff.selected || null
);

// ============= MENTORS SELECTORS =============

/**
 * Select the entire mentors state object
 */
export const selectMentors = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentors || DEFAULT_OBJECT
);

/**
 * Select mentors list
 */
export const selectMentorsList = createSelector(
  [selectMentors],
  (mentors) => mentors.list || DEFAULT_LIST
);

/**
 * Select mentors loading state
 */
export const selectMentorsLoading = createSelector(
  [selectMentors],
  (mentors) => mentors.loading || DEFAULT_LOADING
);

/**
 * Select mentors error state
 */
export const selectMentorsError = createSelector(
  [selectMentors],
  (mentors) => mentors.error || DEFAULT_ERROR
);

// ============= BATCHES & DEPARTMENTS SELECTORS =============
// NOTE: Batches and Departments are now managed by lookupSlice
// Use useBatches() and useDepartments() hooks from shared/hooks/useLookup

// ============= MENTOR ASSIGNMENTS SELECTORS =============

/**
 * Select mentor assignments list
 */
export const selectMentorAssignments = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorAssignments || DEFAULT_LIST
);

/**
 * Select active mentor assignments (filter out inactive ones)
 */
export const selectActiveMentorAssignments = createSelector(
  [selectMentorAssignments],
  (assignments) => assignments.filter(
    (assignment) => assignment.isActive !== false && assignment.status !== 'INACTIVE'
  )
);

/**
 * Select mentor stats object
 */
export const selectMentorStats = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorStats?.data || DEFAULT_STATS
);

/**
 * Select mentor stats loading state
 */
export const selectMentorStatsLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorStats?.loading || DEFAULT_LOADING
);

/**
 * Select mentor stats error state
 */
export const selectMentorStatsError = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorStats?.error || DEFAULT_ERROR
);

// ============= MENTOR COVERAGE SELECTORS =============

/**
 * Select mentor coverage data
 */
export const selectMentorCoverage = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorCoverage?.data || DEFAULT_STATS
);

/**
 * Select mentor coverage loading state
 */
export const selectMentorCoverageLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorCoverage?.loading || DEFAULT_LOADING
);

/**
 * Select mentor coverage error state
 */
export const selectMentorCoverageError = createSelector(
  [selectPrincipalState],
  (principal) => principal.mentorCoverage?.error || DEFAULT_ERROR
);

// ============= COMPLIANCE METRICS SELECTORS =============

/**
 * Select compliance metrics data
 */
export const selectComplianceMetrics = createSelector(
  [selectPrincipalState],
  (principal) => principal.complianceMetrics?.data || DEFAULT_STATS
);

/**
 * Select compliance metrics loading state
 */
export const selectComplianceMetricsLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.complianceMetrics?.loading || DEFAULT_LOADING
);

/**
 * Select compliance metrics error state
 */
export const selectComplianceMetricsError = createSelector(
  [selectPrincipalState],
  (principal) => principal.complianceMetrics?.error || DEFAULT_ERROR
);

// ============= ALERTS ENHANCED SELECTORS =============

/**
 * Select alerts enhanced data
 */
export const selectAlertsEnhanced = createSelector(
  [selectPrincipalState],
  (principal) => principal.alertsEnhanced?.data || DEFAULT_STATS
);

/**
 * Select alerts enhanced loading state
 */
export const selectAlertsEnhancedLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.alertsEnhanced?.loading || DEFAULT_LOADING
);

/**
 * Select alerts enhanced error state
 */
export const selectAlertsEnhancedError = createSelector(
  [selectPrincipalState],
  (principal) => principal.alertsEnhanced?.error || DEFAULT_ERROR
);

// ============= JOINING REPORT SELECTORS =============

/**
 * Select the entire joining report state object
 */
export const selectJoiningLetters = createSelector(
  [selectPrincipalState],
  (principal) => principal.joiningLetters || DEFAULT_OBJECT
);

/**
 * Select joining Report list
 */
export const selectJoiningLettersList = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.list || DEFAULT_LIST
);

/**
 * Select joining report stats
 */
export const selectJoiningLetterStats = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.stats || DEFAULT_STATS
);

/**
 * Select joining report activity
 */
export const selectJoiningLetterActivity = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.activity || DEFAULT_LIST
);

/**
 * Select joining report pagination
 */
export const selectJoiningLettersPagination = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.pagination || DEFAULT_PAGINATION
);

/**
 * Select joining report loading state
 */
export const selectJoiningLettersLoading = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.loading || DEFAULT_LOADING
);

/**
 * Select joining report stats loading state
 */
export const selectJoiningLetterStatsLoading = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.statsLoading || DEFAULT_LOADING
);

/**
 * Select joining report activity loading state
 */
export const selectJoiningLetterActivityLoading = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.activityLoading || DEFAULT_LOADING
);

/**
 * Select joining report error state
 */
export const selectJoiningLettersError = createSelector(
  [selectJoiningLetters],
  (joiningLetters) => joiningLetters.error || DEFAULT_ERROR
);

/**
 * Select pending joining report (status: PENDING or AWAITING_VERIFICATION)
 */
export const selectPendingJoiningLetters = createSelector(
  [selectJoiningLettersList],
  (letters) => letters.filter(
    (letter) => letter.status === 'PENDING' ||
                letter.status === 'AWAITING_VERIFICATION' ||
                letter.verificationStatus === 'PENDING'
  )
);

// ============= INTERNSHIP STATS SELECTORS =============

/**
 * Select internship stats data
 */
export const selectInternshipStats = createSelector(
  [selectPrincipalState],
  (principal) => principal.internshipStats?.data || DEFAULT_STATS
);

/**
 * Select internship stats loading state
 */
export const selectInternshipStatsLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.internshipStats?.loading || DEFAULT_LOADING
);

/**
 * Select internship stats error state
 */
export const selectInternshipStatsError = createSelector(
  [selectPrincipalState],
  (principal) => principal.internshipStats?.error || DEFAULT_ERROR
);

// ============= FACULTY WORKLOAD SELECTORS =============

/**
 * Select faculty workload list
 */
export const selectFacultyWorkload = createSelector(
  [selectPrincipalState],
  (principal) => principal.facultyWorkload?.list || DEFAULT_LIST
);

/**
 * Select faculty workload loading state
 */
export const selectFacultyWorkloadLoading = createSelector(
  [selectPrincipalState],
  (principal) => principal.facultyWorkload?.loading || DEFAULT_LOADING
);

/**
 * Select faculty workload error state
 */
export const selectFacultyWorkloadError = createSelector(
  [selectPrincipalState],
  (principal) => principal.facultyWorkload?.error || DEFAULT_ERROR
);

// ============= LAST FETCHED SELECTORS =============

/**
 * Select last fetched timestamps
 */
export const selectLastFetched = createSelector(
  [selectPrincipalState],
  (principal) => principal.lastFetched || DEFAULT_LAST_FETCHED
);

/**
 * Select most recent fetch timestamp
 */
export const selectMostRecentFetch = createSelector(
  [selectLastFetched],
  (lastFetched) => {
    const timestamps = Object.values(lastFetched).filter(t => typeof t === 'number');
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }
);

// ============= DERIVED/COMPUTED SELECTORS =============

/**
 * Select students with their mentor assignment status
 * Joins students list with mentor assignments to add mentor information
 */
export const selectStudentsWithMentorStatus = createSelector(
  [selectStudentsList, selectMentorAssignments],
  (students, assignments) => {
    // Create a map of student ID to mentor assignment for quick lookup
    const assignmentMap = assignments.reduce((acc, assignment) => {
      if (assignment.studentId) {
        acc[assignment.studentId] = assignment;
      }
      return acc;
    }, {});

    // Map students with their mentor status
    return students.map((student) => ({
      ...student,
      mentorAssignment: assignmentMap[student.id] || null,
      hasMentor: !!assignmentMap[student.id],
      mentorId: assignmentMap[student.id]?.mentorId || null,
      mentorName: assignmentMap[student.id]?.mentorName || null,
    }));
  }
);

/**
 * Select students grouped by department
 * Returns an object with department names as keys and student arrays as values
 */
export const selectStudentsByDepartment = createSelector(
  [selectStudentsList],
  (students) => {
    return students.reduce((acc, student) => {
      const department = student.department || student.branch?.name || 'Unassigned';

      if (!acc[department]) {
        acc[department] = [];
      }

      acc[department].push(student);
      return acc;
    }, {});
  }
);

/**
 * Select students grouped by batch
 * Returns an object with batch IDs as keys and student arrays as values
 */
export const selectStudentsByBatch = createSelector(
  [selectStudentsList],
  (students) => {
    return students.reduce((acc, student) => {
      const batchId = student.batchId || 'Unassigned';

      if (!acc[batchId]) {
        acc[batchId] = [];
      }

      acc[batchId].push(student);
      return acc;
    }, {});
  }
);

/**
 * Select staff grouped by department
 * Returns an object with department names as keys and staff arrays as values
 */
export const selectStaffByDepartment = createSelector(
  [selectStaffList],
  (staff) => {
    return staff.reduce((acc, member) => {
      const department = member.department || member.branch?.name || 'Unassigned';

      if (!acc[department]) {
        acc[department] = [];
      }

      acc[department].push(member);
      return acc;
    }, {});
  }
);

/**
 * Select staff grouped by role
 * Returns an object with role names as keys and staff arrays as values
 */
export const selectStaffByRole = createSelector(
  [selectStaffList],
  (staff) => {
    return staff.reduce((acc, member) => {
      const role = member.role || 'Unassigned';

      if (!acc[role]) {
        acc[role] = [];
      }

      acc[role].push(member);
      return acc;
    }, {});
  }
);

/**
 * Select students without mentor assignments
 */
export const selectStudentsWithoutMentor = createSelector(
  [selectStudentsWithMentorStatus],
  (studentsWithStatus) => studentsWithStatus.filter((student) => !student.hasMentor)
);

/**
 * Select students with mentor assignments
 */
export const selectStudentsWithMentor = createSelector(
  [selectStudentsWithMentorStatus],
  (studentsWithStatus) => studentsWithStatus.filter((student) => student.hasMentor)
);

/**
 * Combined loading selector - true if any major operation is loading
 * Note: Batches and Departments loading now handled by lookupSlice
 */
export const selectAnyLoading = createSelector(
  [
    selectDashboardLoading,
    selectStudentsLoading,
    selectStaffLoading,
    selectMentorsLoading,
  ],
  (
    dashboardLoading,
    studentsLoading,
    staffLoading,
    mentorsLoading
  ) =>
    dashboardLoading ||
    studentsLoading ||
    staffLoading ||
    mentorsLoading
);

/**
 * Combined error selector - returns first non-null error
 * Note: Batches and Departments errors now handled by lookupSlice
 */
export const selectFirstError = createSelector(
  [
    selectDashboardError,
    selectStudentsError,
    selectStaffError,
    selectMentorsError,
  ],
  (
    dashboardError,
    studentsError,
    staffError,
    mentorsError
  ) =>
    dashboardError ||
    studentsError ||
    staffError ||
    mentorsError ||
    null
);

/**
 * Select total count of students
 */
export const selectStudentsTotalCount = createSelector(
  [selectStudentsPagination],
  (pagination) => pagination.total || 0
);

/**
 * Select total count of staff
 */
export const selectStaffTotalCount = createSelector(
  [selectStaffPagination],
  (pagination) => pagination.total || 0
);

/**
 * Select summary statistics
 * Note: Batches and Departments counts should be obtained from lookupSlice
 */
export const selectSummaryStats = createSelector(
  [
    selectStudentsTotalCount,
    selectStaffTotalCount,
    selectStudentsWithMentor,
    selectStudentsWithoutMentor,
  ],
  (
    totalStudents,
    totalStaff,
    studentsWithMentor,
    studentsWithoutMentor
  ) => ({
    totalStudents,
    totalStaff,
    studentsWithMentor: studentsWithMentor.length,
    studentsWithoutMentor: studentsWithoutMentor.length,
    mentorCoveragePercentage: totalStudents > 0
      ? Math.round((studentsWithMentor.length / totalStudents) * 100)
      : 0,
  })
);
