import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

// Layout - Using comprehensive Layout with PlaceIntern branding
import Layouts from '../../components/Layout';

// Backend role constants
const ROLES = {
  STATE: 'STATE_DIRECTORATE',
  PRINCIPAL: 'PRINCIPAL',
  FACULTY: ['FACULTY', 'TEACHER', 'FACULTY_SUPERVISOR', 'FACULTY_COORDINATOR'],
  COORDINATOR: 'FACULTY_COORDINATOR',
  STUDENT: 'STUDENT',
  INDUSTRY: ['INDUSTRY', 'INDUSTRY_PARTNER', 'INDUSTRY_SUPERVISOR'],
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
};

// All dashboard-accessible roles
const ALL_ROLES = [
  ROLES.STATE,
  ROLES.PRINCIPAL,
  ...ROLES.FACULTY,
  ROLES.STUDENT,
  ...ROLES.INDUSTRY,
  ROLES.SYSTEM_ADMIN,
];

// Auth
import LoginForm from '../../features/auth/components/LoginForm';
import ForgotPassword from '../../features/auth/components/ForgotPassword';
import ResetPassword from '../../features/auth/components/ResetPassword';
import ChangePassword from '../../features/auth/components/ChangePassword';
import Signup from '../../features/auth/components/Signup';
import StudentSignup from '../../features/auth/components/StudentSignup';
import StudentLogin from '../../features/auth/components/StudentLogin';

// State
import StateDashboard from '../../features/state/dashboard/StateDashboard';
import InstituteManagement from '../../features/state/institutions/InstituteManagement';
import InstitutionBulkUpload from '../../features/state/institutions/BulkUpload';
import { InstitutionOverview, MentorOverview } from '../../features/state/overview';
import { InstitutionPerformance } from '../../features/state/performance';
import PrincipalList from '../../features/state/principals/PrincipalList';
import StateStaffList from '../../features/state/staff/StaffList';
import ReportBuilder from '../../features/state/reports/ReportBuilder';
import ReportBuilderDashboard from '../../features/state/reports/ReportBuilderDashboard';
import AuditLogs from '../../features/state/audit/AuditLogs';
import BulkUserCreate from '../../features/state/users/BulkUserCreate';
import CredentialsReset from '../../features/state/users/CredentialsReset';
import CompaniesOverview from '../../features/state/companies/CompaniesOverview';
import RestoreCenter from '../../features/state/restore/RestoreCenter';
import MasterData from '../../features/state/master-data/MasterData';
import { MonthlyCompliancePage } from '../../features/state/compliance';
import { StudentsList } from '../../features/state/students';
import StateTrainingDashboardPage from '../../features/state/training/TrainingDashboardPage';
import StateTrainingManagementPage from '../../features/state/training/TrainingManagementPage';
import StateTrainingManageFormPage from '../../features/state/training/TrainingManageFormPage';
import StateTrainingDetailsPage from '../../features/state/training/TrainingDetailsPage';
import StateApplicationManagementPage from '../../features/state/training/ApplicationManagementPage';
import StateAttendanceManagementPage from '../../features/state/training/AttendanceManagementPage';
import StateCertificateManagementPage from '../../features/state/training/CertificateManagementPage';
import StateFeedbackFormManagementPage from '../../features/state/training/FeedbackFormManagementPage';
import StateTestFormManagementPage from '../../features/state/training/TestFormManagementPage';
import StateLessonPlanReviewPage from '../../features/state/training/LessonPlanReviewPage';

// Shared
import GrievanceList from '../../features/shared/grievances/GrievanceList';
import { SendNotification } from '../../features/shared';
import SubmitGrievance from '../../features/student/grievances/SubmitGrievance';

// Help & Support
import { HelpCenter, MyTickets, SupportDashboard } from '../../features/help-support';

// Principal
import PrincipalDashboard from '../../features/principal/dashboard/PrincipalDashboard';
import PrincipalOverview from '../../features/principal/overview/PrincipalOverview';
import StudentList from '../../features/principal/students/StudentList';
import AllStudents from '../../features/principal/students/AllStudents';
import StaffList from '../../features/principal/staff/StaffList';
import MentorAssignment from '../../features/principal/mentors/MentorAssignment';
import BulkUpload from '../../features/principal/bulk/BulkUpload';
import FacultyProgress from '../../features/principal/faculty/FacultyProgress';
import Grievances from '../../features/principal/grievances/Grievances';
import SelfIdentifiedInternships from '../../features/principal/internships/SelfIdentifiedInternships';
import BulkSelfInternshipUpload from '../../features/principal/bulk/BulkSelfInternshipUpload';
import BulkJobHistory from '../../features/common/bulk/BulkJobHistory';
import PrincipalTrainingOverviewPage from '../../features/principal/training/TrainingOverviewPage';
import PrincipalApplicationReviewPage from '../../features/principal/training/ApplicationReviewPage';
import PrincipalLessonPlanReviewPage from '../../features/principal/training/LessonPlanReviewPage';
import PrincipalParticipationReportPage from '../../features/principal/training/ParticipationReportPage';
import PrincipalTrainingDetailsPage from '../../features/principal/training/TrainingDetailsPage';
import PrincipalRecommendTrainingApprovalPage from '../../features/principal/training/RecommendTrainingApprovalPage';

// Faculty
import FacultyDashboard from '../../features/faculty/dashboard/FacultyDashboard';
import VisitLogList from '../../features/faculty/visits/VisitLogList';
import AssignedStudentsList from '../../features/faculty/students/AssignedStudentsList';
import SelfIdentifiedApproval from '../../features/faculty/approvals/SelfIdentifiedApproval';
import MonthlyReportsPage from '../../features/faculty/reports/MonthlyReportsPage';
import JoiningLettersPage from '../../features/faculty/joining-letters/JoiningLettersPage';
import FacultyGrievances from '../../features/faculty/grievances/FacultyGrievances';
import FacultyTrainingDashboardPage from '../../features/faculty/training/TrainingDashboardPage';
import FacultyTrainingCalendarPage from '../../features/faculty/training/TrainingCalendarPage';
import FacultyTrainingDetailsPage from '../../features/faculty/training/TrainingDetailsPage';
import FacultyMyApplicationsPage from '../../features/faculty/training/MyApplicationsPage';
import FacultyMyLessonPlansPage from '../../features/faculty/training/MyLessonPlansPage';
import FacultyLessonPlanEditorPage from '../../features/faculty/training/LessonPlanEditorPage';
import FacultyMyCertificatesPage from '../../features/faculty/training/MyCertificatesPage';
import FacultyRecommendTrainingPage from '../../features/faculty/training/RecommendTrainingPage';

// Coordinator
import CoordinatorDashboard from '../../features/coordinator/dashboard/CoordinatorDashboard';
import CoordinatorApplicationReviewPage from '../../features/coordinator/training/ApplicationReviewPage';
import CoordinatorLessonPlanReviewPage from '../../features/coordinator/training/LessonPlanReviewPage';
import CoordinatorTestResponsesPage from '../../features/coordinator/training/TestResponsesPage';
import CoordinatorRecommendationsPage from '../../features/coordinator/training/RecommendationsPage';
import CoordinatorRemindersPage from '../../features/coordinator/training/RemindersPage';

// Student
import StudentDashboard from '../../features/student/dashboard/StudentDashboard';
import StudentProfile from '../../features/student/profile/StudentProfile';
import MonthlyReportForm from '../../features/student/reports/MonthlyReportForm';
import StudentReportSubmit from '../../features/student/reports/StudentReportSubmit';
import InternshipList from '../../features/student/internships/InternshipList';
import InternshipDetails from '../../features/student/internships/InternshipDetails';
import MyApplications from '../../features/student/applications/MyApplications';
import SelfIdentifiedInternship from '../../features/student/internships/SelfIdentifiedInternship';

// Industry
import IndustryDashboard from '../../features/industry/dashboard/IndustryDashboard';
import InternshipPostingList from '../../features/industry/postings/InternshipPostingList';
import ApplicationsList from '../../features/industry/applications/ApplicationsList';
import IndustryProfile from '../../features/industry/profile/IndustryProfile';

// Admin
import {
  AdminDashboard,
  SystemHealth,
  AdminAnalytics,
  SecurityInsights,
  BackupSchedules,
  SystemSettings,
  FeatureFlags,
  SystemAlerts,
  AlertGenerator,
  UserManagement,
  ActiveSessions,
  DatabaseManagement,
} from '../../features/admin';
import LandingPage from '../home/LandingPage';

// Common Components
import ComingSoon from '../../components/common/ComingSoon';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Routes>
      {/* Landing Page - Must come first */}
      <Route path='/' element={<LandingPage />} />
      
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <LoginForm />
        }
      />
      <Route
        path="/student-login"
        element={
          isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <StudentLogin />
        }
      />
      <Route
        path="/signup"
        element={
          isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <Signup />
        }
      />
      <Route
        path="/student-signup"
        element={
          isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <StudentSignup />
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Protected Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layouts />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />

        {/* State Routes */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <DashboardRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstituteManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions-overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstitutionOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="institution-performance"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstitutionPerformance />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor-overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <MentorOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="companies-overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <CompaniesOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="restore-center"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <RestoreCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="compliance-tracker"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <MonthlyCompliancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="principals"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <PrincipalList />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions/bulk-upload"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <InstitutionBulkUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/builder"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <ReportBuilder />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <ReportBuilderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="grievances"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <Grievances />
            </ProtectedRoute>
          }
        />
        <Route
          path="master-data"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <MasterData />
            </ProtectedRoute>
          }
        />
        <Route
          path="state-staff"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateStaffList />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/bulk-create"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <BulkUserCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="users/reset-credentials"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <CredentialsReset />
            </ProtectedRoute>
          }
        />
        <Route
          path="students-directory"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StudentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="training"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL, ...ROLES.FACULTY]}>
              <TrainingHomeRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/manage"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.COORDINATOR]}>
              <StateTrainingManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/create"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.COORDINATOR]}>
              <StateTrainingManageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/:id/edit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.COORDINATOR]}>
              <StateTrainingManageFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/:id/applications"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateApplicationManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/:id/attendance"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateAttendanceManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/:id/certificates"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateCertificateManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/feedback-forms"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateFeedbackFormManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/test-forms"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <StateTestFormManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/reports"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <TrainingReportsRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/applications"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL, ...ROLES.FACULTY]}>
              <TrainingApplicationsRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/lesson-plans"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL, ...ROLES.FACULTY]}>
              <TrainingLessonPlansRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/recommend-approvals"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <PrincipalRecommendTrainingApprovalPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/lesson-plans/new"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyLessonPlanEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/lesson-plans/new/:trainingId"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyLessonPlanEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/lesson-plans/:id/edit"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyLessonPlanEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/calendar"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyTrainingCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/certificates"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyMyCertificatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/recommend"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyRecommendTrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="training/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL, ...ROLES.FACULTY]}>
              <TrainingDetailsRouter />
            </ProtectedRoute>
          }
        />

        {/* Coordinator Routes */}
        <Route
          path="coordinator/applications"
          element={
            <ProtectedRoute allowedRoles={[ROLES.COORDINATOR]}>
              <CoordinatorApplicationReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="coordinator/lesson-plans"
          element={
            <ProtectedRoute allowedRoles={[ROLES.COORDINATOR]}>
              <CoordinatorLessonPlanReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="coordinator/test-responses"
          element={
            <ProtectedRoute allowedRoles={[ROLES.COORDINATOR]}>
              <CoordinatorTestResponsesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="coordinator/recommendations"
          element={
            <ProtectedRoute allowedRoles={[ROLES.COORDINATOR]}>
              <CoordinatorRecommendationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="coordinator/reminders"
          element={
            <ProtectedRoute allowedRoles={[ROLES.COORDINATOR]}>
              <CoordinatorRemindersPage />
            </ProtectedRoute>
          }
        />

        {/* Principal Routes */}
        <Route
          path="overview"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <PrincipalOverview />
            </ProtectedRoute>
          }
        />
        <Route
          path="students"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <StudentList />
            </ProtectedRoute>
          }
        />
        <Route
          path="all-students"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <AllStudents />
            </ProtectedRoute>
          }
        />
        <Route
          path="staff"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <StaffList />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentors"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <MentorAssignment />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk-upload"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="faculty-progress"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <FacultyProgress />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PRINCIPAL]}>
              <SelfIdentifiedInternships />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk/self-internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkSelfInternshipUpload />
            </ProtectedRoute>
          }
        />
        <Route
          path="bulk/job-history"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE, ROLES.PRINCIPAL]}>
              <BulkJobHistory />
            </ProtectedRoute>
          }
        />

        {/* Faculty Routes */}
        <Route
          path="visit-logs"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <VisitLogList />
            </ProtectedRoute>
          }
        />
        <Route
          path="assigned-students"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <AssignedStudentsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <SelfIdentifiedApproval />
            </ProtectedRoute>
          }
        />
        <Route
          path="monthly-reports"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <MonthlyReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="joining-letters"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <JoiningLettersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="faculty-grievances"
          element={
            <ProtectedRoute allowedRoles={ROLES.FACULTY}>
              <FacultyGrievances />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="profile"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/new"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MonthlyReportForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/submit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <StudentReportSubmit />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports/:id/edit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MonthlyReportForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <ComingSoon
                title="Internship Browsing"
                description="Browse and search for available internships. This feature is currently under development and will be available soon."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="internships/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <ComingSoon
                title="Internship Details"
                description="View detailed information about internships. This feature is currently under development and will be available soon."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="my-applications"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <MyApplications />
            </ProtectedRoute>
          }
        />
        <Route
          path="self-identified-internship"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <SelfIdentifiedInternship />
            </ProtectedRoute>
          }
        />
        <Route
          path="submit-grievance"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STUDENT]}>
              <SubmitGrievance />
            </ProtectedRoute>
          }
        />

        {/* Industry Routes */}
        <Route
          path="postings"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <ComingSoon
                title="Internship Postings"
                description="Create and manage your internship postings. This feature is currently under development and will be available soon."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="applications"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <ComingSoon
                title="Applications Management"
                description="Review and manage student applications for your internships. This feature is currently under development and will be available soon."
              />
            </ProtectedRoute>
          }
        />
        <Route
          path="company/profile"
          element={
            <ProtectedRoute allowedRoles={ROLES.INDUSTRY}>
              <ComingSoon
                title="Company Profile"
                description="Manage your company profile and information. This feature is currently under development and will be available soon."
              />
            </ProtectedRoute>
          }
        />

        {/* Shared Routes */}
        <Route
          path="send-notification"
          element={
            <ProtectedRoute
              allowedRoles={[
                ROLES.PRINCIPAL,
                ROLES.STATE,
                ROLES.SYSTEM_ADMIN,
                ...ROLES.FACULTY,
              ]}
            >
              <SendNotification />
            </ProtectedRoute>
          }
        />
        <Route path="change-password" element={<ChangePassword />} />

        {/* Help & Support Routes - Available to all authenticated users */}
        <Route path="help" element={<HelpCenter />} />
        <Route path="my-tickets" element={<MyTickets />} />
        <Route
          path="support-dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.STATE]}>
              <SupportDashboard />
            </ProtectedRoute>
          }
        />

        {/* System Admin Routes */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/health"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <SystemHealth />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/analytics"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AdminAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/sessions"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <ActiveSessions />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/security"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <SecurityInsights />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/backups"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <DatabaseManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/backup-schedules"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <BackupSchedules />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/settings"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <SystemSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/features"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <FeatureFlags />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/audit-logs"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/queries"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <SupportDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/alerts"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <SystemAlerts />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/alert-generator"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SYSTEM_ADMIN]}>
              <AlertGenerator />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Unauthorized Page */}
      <Route
        path="/unauthorized"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-red-600 mb-4">Unauthorized</h1>
              <p className="text-gray-600 mb-6">You don't have permission to access this page.</p>
              <Button type="primary" onClick={() => window.history.back()}>
                Go Back
              </Button>
            </div>
          </div>
        }
      />

      {/* Fallback for authenticated users */}
      <Route path="*" element={isAuthenticated ? <Navigate to="/app/dashboard" replace /> : <Navigate to="/" replace />} />
    </Routes>
  );
};

// Dashboard Router based on role
const DashboardRouter = () => {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  // System Admin
  if (role === ROLES.SYSTEM_ADMIN) {
    return <AdminDashboard />;
  }
  // State Directorate
  if (role === ROLES.STATE) {
    return <StateDashboard />;
  }
  // Principal
  if (role === ROLES.PRINCIPAL) {
    return <PrincipalDashboard />;
  }
  // Faculty (includes TEACHER, FACULTY_SUPERVISOR, FACULTY_COORDINATOR)
  if (ROLES.FACULTY.includes(role)) {
    return <FacultyDashboard />;
  }
  // Student
  if (role === ROLES.STUDENT) {
    return <StudentDashboard />;
  }
  // Industry (includes INDUSTRY_PARTNER, INDUSTRY_SUPERVISOR)
  if (ROLES.INDUSTRY.includes(role)) {
    return (
      <ComingSoon
        title="Industry Dashboard"
        description="View your company's dashboard with analytics and insights. This feature is currently under development and will be available soon."
      />
    );
  }

  return <Navigate to="/login" replace />;
};

function TrainingHomeRouter() {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  if (role === ROLES.STATE) return <StateTrainingDashboardPage />;
  if (role === ROLES.PRINCIPAL) return <PrincipalTrainingOverviewPage />;
  if (ROLES.FACULTY.includes(role)) return <FacultyTrainingDashboardPage />;

  return <Navigate to="/unauthorized" replace />;
}

function TrainingApplicationsRouter() {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  if (role === ROLES.PRINCIPAL) return <PrincipalApplicationReviewPage />;
  if (ROLES.FACULTY.includes(role)) return <FacultyMyApplicationsPage />;

  return <Navigate to="/unauthorized" replace />;
}

function TrainingLessonPlansRouter() {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  if (role === ROLES.STATE) return <StateLessonPlanReviewPage />;
  if (role === ROLES.PRINCIPAL) return <PrincipalLessonPlanReviewPage />;
  if (ROLES.FACULTY.includes(role)) return <FacultyMyLessonPlansPage />;

  return <Navigate to="/unauthorized" replace />;
}

function TrainingReportsRouter() {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  // State users now see stats in modal from management page
  if (role === ROLES.STATE) return <Navigate to="/app/training/manage" replace />;
  if (role === ROLES.PRINCIPAL) return <PrincipalParticipationReportPage />;

  return <Navigate to="/unauthorized" replace />;
}

function TrainingDetailsRouter() {
  const { user } = useSelector((state) => state.auth);
  const role = user?.role;

  if (role === ROLES.STATE) return <StateTrainingDetailsPage />;
  if (role === ROLES.COORDINATOR) return <StateTrainingDetailsPage />;
  if (role === ROLES.PRINCIPAL) return <PrincipalTrainingDetailsPage />;
  if (ROLES.FACULTY.includes(role)) return <FacultyTrainingDetailsPage />;

  return <Navigate to="/unauthorized" replace />;
}

export default AppRoutes;