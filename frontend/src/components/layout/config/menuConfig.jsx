import {
  DashboardOutlined,
  FileTextOutlined,
  TeamOutlined,
  BankOutlined,
  DatabaseOutlined,
  ShopOutlined,
  LaptopOutlined,
  SolutionOutlined,
  FileDoneOutlined,
  GlobalOutlined,
  BarChartOutlined,
  PieChartOutlined,
  AuditOutlined,
  FileSyncOutlined,
  IdcardOutlined,
  PushpinOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
  AlertOutlined,
  LockOutlined,
  ExclamationCircleOutlined,
  UsergroupAddOutlined,
  LineChartOutlined,
  SafetyOutlined,
  SwapOutlined,
  UploadOutlined,
  SettingOutlined,
  CarOutlined,
  CustomerServiceOutlined,
  QuestionCircleOutlined,
  MessageOutlined,
  HistoryOutlined,
  CloudUploadOutlined,
  SendOutlined,
  CheckSquareOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import React from "react";

export const menuConfig = {
  // ==========================================
  // STATE DIRECTORATE MENUS
  // ==========================================
  STATE_DASHBOARD: {
    key: "state-dashboard",
    title: "Dashboard",
    icon: <DashboardOutlined />,
    path: "/app/dashboard",
  },
  STATE_INSTITUTION_OVERVIEW: {
    key: "compliance-tracker",
    title: "Internships Overview",
    icon: <CheckSquareOutlined />,
    path: "/app/compliance-tracker",
  },
  STATE_REPORT_BUILDER: {
    key: "report-builder",
    title: "Report Builder",
    icon: <BarChartOutlined />,
    path: "/app/reports/builder",
  },
  STATE_INSTITUTIONS: {
    key: "state-institutions",
    title: "Institutions",
    icon: <BankOutlined />,
    items: [
      // {
      //   key: "institution-performance",
      //   label: "Performance",
      //   icon: <BarChartOutlined />,
      //   path: "/app/institution-performance",
      // },
      {
        key: "institutions-list",
        label: "Manage Institution",
        icon: <BankOutlined />,
        path: "/app/institutions",
      },
      {
        key: "principals-list",
        label: "Principals",
        icon: <TeamOutlined />,
        path: "/app/principals",
      },
      {
        key: "students-directory",
        label: "Students Directory",
        icon: <UsergroupAddOutlined />,
        path: "/app/students-directory",
      },
    ],
  },
  STATE_COMPANIES: {
    key: "state-companies",
    title: "Companies",
    icon: <ShopOutlined />,
    items: [
      {
        key: "companies-overview",
        label: "Overview",
        icon: <ShopOutlined />,
        path: "/app/companies-overview",
      },
    ],
  },
  STATE_BULK: {
    key: "state-bulk",
    title: "Bulk Operations",
    icon: <CloudUploadOutlined />,
    items: [
      {
        key: "bulk-institute-upload",
        label: "Institutions",
        icon: <BankOutlined />,
        path: "/app/institutions/bulk-upload",
      },
      {
        key: "bulk-user-create",
        label: "Faculty/Staff",
        icon: <UsergroupAddOutlined />,
        path: "/app/users/bulk-create",
      },
      {
        key: "bulk-staff-upload",
        label: "Staff/Students",
        icon: <TeamOutlined />,
        path: "/app/bulk-upload",
      },
      {
        key: "bulk-internship-upload",
        label: "Internships",
        icon: <LaptopOutlined />,
        path: "/app/bulk/self-internships",
      },
      {
        key: "bulk-job-history",
        label: "Job History",
        icon: <HistoryOutlined />,
        path: "/app/bulk/job-history",
      },
    ],
  },
  STATE_SYSTEM: {
    key: "state-system",
    title: "System",
    icon: <SettingOutlined />,
    items: [
      {
        key: "master-data",
        label: "Master Data",
        icon: <DatabaseOutlined />,
        path: "/app/master-data",
      },
      {
        key: "state-staff-list",
        label: "Staff",
        icon: <SolutionOutlined />,
        path: "/app/state-staff",
      },
      // { key: 'bulk-user-creation', label: 'Bulk Users', icon: <UsergroupAddOutlined />, path: '/app/users/bulk-create' },
      {
        key: "credentials-reset",
        label: "Reset Credentials",
        icon: <LockOutlined />,
        path: "/app/users/reset-credentials",
      },
      {
        key: "restore-center",
        label: "Restore Center",
        icon: <HistoryOutlined />,
        path: "/app/restore-center",
      },
      {
        key: "audit-logs",
        label: "Audit Logs",
        icon: <AuditOutlined />,
        path: "/app/audit-logs",
      },
    ],
  },

  // ==========================================
  // PRINCIPAL MENUS
  // ==========================================
  PRINCIPAL_HOME: {
    key: "principal-home",
    title: "Dashboard",
    icon: <DashboardOutlined />,
    path: "/app/dashboard",
  },
  PRINCIPAL_PEOPLE: {
    key: "principal-people",
    title: "Students",
    icon: <TeamOutlined />,
    path: "/app/students",
  },
  PRINCIPAL_STAFF: {
    key: "principal-staff",
    title: "Staff",
    icon: <SolutionOutlined />,
    path: "/app/staff",
  },
  PRINCIPAL_INTERNSHIP: {
    key: "principal-internship",
    title: "Internship",
    icon: <LaptopOutlined />,
    items: [
      {
        key: "all-students",
        label: "All Students",
        icon: <UsergroupAddOutlined />,
        path: "/app/all-students",
      },
      {
        key: "mentor-assignment",
        label: "Mentor Assignments",
        icon: <SolutionOutlined />,
        path: "/app/mentors",
      },

      {
        key: "faculty-progress",
        label: "Faculty Progress",
        icon: <CarOutlined />,
        path: "/app/faculty-progress",
      },
      // {
      //   key: "principal-visit-logs",
      //   label: "Visit Logs",
      //   icon: <FileDoneOutlined />,
      //   path: "/app/principal-visit-logs",
      // },
      {
        key: "principal-feedback",
        label: "Principal Feedback",
        icon: <FileTextOutlined />,
        path: "/app/principal-feedback",
      },
      {
        key: "student-grievances",
        label: "Grievances",
        icon: <AlertOutlined />,
        path: "/app/grievances",
      },
    ],
  },
  PRINCIPAL_OPERATIONS: {
    key: "principal-operations",
    title: "Operations",
    icon: <CloudUploadOutlined />,
    items: [
      {
        key: "bulk-staff-upload",
        label: "Bulk Upload",
        icon: <UploadOutlined />,
        path: "/app/bulk-upload",
      },
      {
        key: "bulk-internship-upload",
        label: "Bulk Internships",
        icon: <UploadOutlined />,
        path: "/app/bulk/self-internships",
      },
      // { key: 'bulk-job-history', label: 'Job History', icon: <HistoryOutlined />, path: '/app/bulk/job-history' },
    ],
  },

  // ==========================================
  // FACULTY MENUS
  // ==========================================
  FACULTY_HOME: {
    key: "faculty-home",
    title: "Home",
    icon: <DashboardOutlined />,
    items: [
      {
        key: "supervision-dashboard",
        label: "Dashboard",
        icon: <DashboardOutlined />,
        path: "/app/dashboard",
      },
      {
        key: "assigned-students",
        label: "My Students",
        icon: <TeamOutlined />,
        path: "/app/assigned-students",
      },
    ],
  },
  FACULTY_SUPERVISION: {
    key: "faculty-supervision",
    title: "Supervision",
    icon: <SolutionOutlined />,
    items: [
      {
        key: "visit-logs",
        label: "Visit Logs",
        icon: <FileDoneOutlined />,
        path: "/app/visit-logs",
      },
      {
        key: "monthly-reports",
        label: "Monthly Reports",
        icon: <FileTextOutlined />,
        path: "/app/monthly-reports",
      },
      {
        key: "joining-letters",
        label: "Joining Letters",
        icon: <SafetyCertificateOutlined />,
        path: "/app/joining-letters",
      },
      // { key: 'pending-approvals', label: 'Pending Approvals', icon: <AuditOutlined />, path: '/app/approvals' },
    ],
  },
  FACULTY_COMMUNICATION: {
    key: "faculty-communication",
    title: "Communication",
    icon: <SendOutlined />,
    items: [
      {
        key: "faculty-grievances",
        label: "Grievances",
        icon: <AlertOutlined />,
        path: "/app/faculty-grievances",
      },
    ],
  },

  // ==========================================
  // STUDENT MENUS
  // ==========================================
  STUDENT_HOME: {
    key: "student-home",
    title: "Home",
    icon: <DashboardOutlined />,
    items: [
      {
        key: "student-dashboard",
        label: "Dashboard",
        icon: <DashboardOutlined />,
        path: "/app/dashboard",
      },
      {
        key: "profile",
        label: "My Profile",
        icon: <IdcardOutlined />,
        path: "/app/profile",
      },
    ],
  },
  STUDENT_INTERNSHIP: {
    key: "student-internship",
    title: "Internship",
    icon: <LaptopOutlined />,
    items: [
      {
        key: "my-applications",
        label: "My Internship",
        icon: <LaptopOutlined />,
        path: "/app/my-applications",
      },
      {
        key: "self-identified-internship",
        label: "Add Internship",
        icon: <PlusOutlined />,
        path: "/app/self-identified-internship",
      },
      {
        key: "monthly-reports",
        label: "Monthly Reports",
        icon: <FileTextOutlined />,
        path: "/app/reports/submit",
      },
      {
        key: "submit-grievance",
        label: "Submit Grievance",
        icon: <AlertOutlined />,
        path: "/app/submit-grievance",
      },
    ],
  },

  // ==========================================
  // INDUSTRY MENUS
  // ==========================================
  // INDUSTRY_PORTAL: {
  //   key: 'industry-portal',
  //   title: 'Industry Portal',
  //   icon: <ShopOutlined />,
  //   items: [
  //     { key: 'industry-dashboard', label: 'Dashboard', icon: <DashboardOutlined />, path: '/app/dashboard' },
  //     { key: 'postings', label: 'Internship Postings', icon: <PushpinOutlined />, path: '/app/postings' },
  //     { key: 'applications', label: 'Applications', icon: <FileSyncOutlined />, path: '/app/applications' },
  //     { key: 'industry-profile', label: 'Company Profile', icon: <IdcardOutlined />, path: '/app/company/profile' },
  //   ],
  // },

  // ==========================================
  // SYSTEM ADMIN MENUS
  // ==========================================
  SYSTEM_ADMIN_HOME: {
    key: "admin-home",
    title: "Home",
    icon: <DashboardOutlined />,
    items: [
      {
        key: "system-admin-dashboard",
        label: "Dashboard",
        icon: <DashboardOutlined />,
        path: "/app/admin/dashboard",
      },
      {
        key: "system-health",
        label: "System Health",
        icon: <SafetyCertificateOutlined />,
        path: "/app/admin/health",
      },
      {
        key: "analytics",
        label: "Analytics",
        icon: <LineChartOutlined />,
        path: "/app/admin/analytics",
      },
    ],
  },
  SYSTEM_ADMIN_USERS: {
    key: "admin-users",
    title: "Users",
    icon: <TeamOutlined />,
    items: [
      {
        key: "all-users",
        label: "All Users",
        icon: <UsergroupAddOutlined />,
        path: "/app/admin/users",
      },
      {
        key: "active-sessions",
        label: "Sessions",
        icon: <LaptopOutlined />,
        path: "/app/admin/sessions",
      },
      {
        key: "security-insights",
        label: "Security",
        icon: <SafetyOutlined />,
        path: "/app/admin/security",
      },
    ],
  },
  SYSTEM_ADMIN_DATA: {
    key: "admin-data",
    title: "Data & Backups",
    icon: <DatabaseOutlined />,
    items: [
      {
        key: "backup-management",
        label: "Backups",
        icon: <CloudUploadOutlined />,
        path: "/app/admin/backups",
      },
      {
        key: "backup-schedules",
        label: "Schedules",
        icon: <HistoryOutlined />,
        path: "/app/admin/backup-schedules",
      },
      {
        key: "audit-logs",
        label: "Audit Logs",
        icon: <AuditOutlined />,
        path: "/app/admin/audit-logs",
      },
    ],
  },
  SYSTEM_ADMIN_CONFIG: {
    key: "admin-config",
    title: "Settings",
    icon: <SettingOutlined />,
    items: [
      {
        key: "system-settings",
        label: "System Settings",
        icon: <SettingOutlined />,
        path: "/app/admin/settings",
      },
      {
        key: "feature-flags",
        label: "Feature Flags",
        icon: <SwapOutlined />,
        path: "/app/admin/features",
      },
    ],
  },
  SYSTEM_ADMIN_SUPPORT: {
    key: "admin-support",
    title: "Support",
    icon: <CustomerServiceOutlined />,
    items: [
      {
        key: "support-tickets",
        label: "Support Tickets",
        icon: <CustomerServiceOutlined />,
        path: "/app/support-dashboard",
      },
      {
        key: "system-alerts",
        label: "System Alerts",
        icon: <AlertOutlined />,
        path: "/app/admin/alerts",
      },
      {
        key: "alert-generator",
        label: "Alert Generator",
        icon: <SendOutlined />,
        path: "/app/admin/alert-generator",
      },
    ],
  },

  // ==========================================
  // SUPPORT (All Users)
  // ==========================================
  SUPPORT: {
    key: "support",
    title: "Help & Support",
    icon: <CustomerServiceOutlined />,
    items: [
      {
        key: "help-center",
        label: "FAQ",
        icon: <QuestionCircleOutlined />,
        path: "/app/help",
      },
      {
        key: "my-tickets",
        label: "My Tickets",
        icon: <MessageOutlined />,
        path: "/app/my-tickets",
      },
    ],
  },

  // ==========================================
  // SUPPORT ADMIN (STATE_DIRECTORATE Only)
  // ==========================================
  SUPPORT_ADMIN: {
    key: "support-admin",
    title: "Support Management",
    icon: <CustomerServiceOutlined />,
    items: [
      {
        key: "state-grievances",
        label: "Grievances",
        icon: <AlertOutlined />,
        path: "/app/grievances",
      },
      {
        key: "support-dashboard",
        label: "Support Dashboard",
        icon: <DashboardOutlined />,
        path: "/app/support-dashboard",
      },
      {
        key: "help-center",
        label: "Help Center",
        icon: <QuestionCircleOutlined />,
        path: "/app/help",
      },
      {
        key: "my-tickets",
        label: "My Tickets",
        icon: <MessageOutlined />,
        path: "/app/my-tickets",
      },
    ],
  },
};

export const getMenuSectionsForRole = (role) => {
  const sections = [];

  switch (role) {
    case "STATE_DIRECTORATE":
      sections.push(menuConfig.STATE_DASHBOARD);
      sections.push(menuConfig.STATE_INSTITUTION_OVERVIEW);
      sections.push(menuConfig.STATE_INSTITUTIONS);
      sections.push(menuConfig.STATE_COMPANIES);
      sections.push(menuConfig.STATE_REPORT_BUILDER);
      sections.push(menuConfig.STATE_BULK);
      sections.push(menuConfig.STATE_SYSTEM);
      break;

    case "PRINCIPAL":
      sections.push(menuConfig.PRINCIPAL_HOME);
      sections.push(menuConfig.PRINCIPAL_PEOPLE);
      sections.push(menuConfig.PRINCIPAL_STAFF);
      sections.push(menuConfig.PRINCIPAL_INTERNSHIP);
      sections.push(menuConfig.PRINCIPAL_OPERATIONS);
      break;

    case "FACULTY":
    case "TEACHER":
    case "FACULTY_SUPERVISOR":
      sections.push(menuConfig.FACULTY_HOME);
      sections.push(menuConfig.FACULTY_SUPERVISION);
      sections.push(menuConfig.FACULTY_COMMUNICATION);
      break;

    case "STUDENT":
      sections.push(menuConfig.STUDENT_HOME);
      sections.push(menuConfig.STUDENT_INTERNSHIP);
      break;

    // case 'INDUSTRY':
    // case 'INDUSTRY_PARTNER':
    // case 'INDUSTRY_SUPERVISOR':
    //   sections.push(menuConfig.INDUSTRY_PORTAL);
    //   break;

    case "SYSTEM_ADMIN":
      sections.push(menuConfig.SYSTEM_ADMIN_HOME);
      sections.push(menuConfig.SYSTEM_ADMIN_USERS);
      sections.push(menuConfig.SYSTEM_ADMIN_DATA);
      sections.push(menuConfig.SYSTEM_ADMIN_CONFIG);
      sections.push(menuConfig.SYSTEM_ADMIN_SUPPORT);
      break;

    case "ADMISSION_OFFICER":
      sections.push(menuConfig.PRINCIPAL_PEOPLE);
      break;

    default:
      break;
  }

  // Add Support menu for all logged-in users
  // STATE_DIRECTORATE gets the admin version with Support Dashboard
  if (role) {
    if (role === "STATE_DIRECTORATE") {
      sections.push(menuConfig.SUPPORT_ADMIN);
    } else {
      sections.push(menuConfig.SUPPORT);
    }
  }

  return sections;
};
