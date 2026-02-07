import {
  ExperimentOutlined,
  BookOutlined,
  CalendarOutlined,
  TrophyOutlined,
  DollarOutlined,
  TeamOutlined,
  UserOutlined,
  NotificationOutlined,
  BellOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

/**
 * Notification type categories for filtering
 */
export const NOTIFICATION_CATEGORIES = {
  ALL: 'all',
  INTERNSHIP: 'internship',
  PLACEMENT: 'placement',
  ASSIGNMENT: 'assignment',
  ATTENDANCE: 'attendance',
  EXAM: 'exam',
  FEE: 'fee',
  ANNOUNCEMENT: 'announcement',
  GRIEVANCE: 'grievance',
  SYSTEM: 'system',
};

/**
 * Map notification types to categories
 */
export const TYPE_TO_CATEGORY = {
  INTERNSHIP_DEADLINE: NOTIFICATION_CATEGORIES.INTERNSHIP,
  INTERNSHIP_APPLICATION: NOTIFICATION_CATEGORIES.INTERNSHIP,
  INTERNSHIP_ACCEPTED: NOTIFICATION_CATEGORIES.INTERNSHIP,
  INTERNSHIP_REJECTED: NOTIFICATION_CATEGORIES.INTERNSHIP,
  ELIGIBLE_INTERNSHIPS: NOTIFICATION_CATEGORIES.INTERNSHIP,
  PLACEMENT_UPDATE: NOTIFICATION_CATEGORIES.PLACEMENT,
  PLACEMENT_OFFER: NOTIFICATION_CATEGORIES.PLACEMENT,
  MONTHLY_REPORT_REMINDER: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  MONTHLY_REPORT_URGENT: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  ASSIGNMENT_NEW: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  ASSIGNMENT_DUE: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  ATTENDANCE_MARKED: NOTIFICATION_CATEGORIES.ATTENDANCE,
  ATTENDANCE_WARNING: NOTIFICATION_CATEGORIES.ATTENDANCE,
  EXAM_SCHEDULED: NOTIFICATION_CATEGORIES.EXAM,
  EXAM_REMINDER: NOTIFICATION_CATEGORIES.EXAM,
  ANNOUNCEMENT: NOTIFICATION_CATEGORIES.ANNOUNCEMENT,
  WEEKLY_SUMMARY: NOTIFICATION_CATEGORIES.ANNOUNCEMENT,
  GRIEVANCE_ASSIGNED: NOTIFICATION_CATEGORIES.GRIEVANCE,
  GRIEVANCE_UPDATE: NOTIFICATION_CATEGORIES.GRIEVANCE,
  GRIEVANCE_STATUS_CHANGED: NOTIFICATION_CATEGORIES.GRIEVANCE,
  SUPPORT_TICKET_NEW: NOTIFICATION_CATEGORIES.GRIEVANCE,
  FEE_DUE: NOTIFICATION_CATEGORIES.FEE,
  FEE_REMINDER: NOTIFICATION_CATEGORIES.FEE,
  GRADE_PUBLISHED: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  GRADE_UPDATE: NOTIFICATION_CATEGORIES.ASSIGNMENT,
  FACULTY_VISIT_REMINDER: NOTIFICATION_CATEGORIES.SYSTEM,
  SYSTEM_ALERT: NOTIFICATION_CATEGORIES.SYSTEM,
  CUSTOM: NOTIFICATION_CATEGORIES.ANNOUNCEMENT,
};

/**
 * Get icon component for notification type
 */
export const getNotificationIcon = (type, size = 16) => {
  const iconStyle = { fontSize: size };

  switch (type) {
    case 'internship':
    case 'INTERNSHIP_DEADLINE':
    case 'INTERNSHIP_APPLICATION':
    case 'INTERNSHIP_ACCEPTED':
    case 'INTERNSHIP_REJECTED':
    case 'ELIGIBLE_INTERNSHIPS':
      return <ExperimentOutlined style={iconStyle} />;

    case 'assignment':
    case 'MONTHLY_REPORT_REMINDER':
    case 'MONTHLY_REPORT_URGENT':
    case 'ASSIGNMENT_NEW':
    case 'ASSIGNMENT_DUE':
    case 'GRADE_PUBLISHED':
    case 'GRADE_UPDATE':
      return <BookOutlined style={iconStyle} />;

    case 'exam':
    case 'examSchedule':
    case 'EXAM_SCHEDULED':
    case 'EXAM_REMINDER':
      return <CalendarOutlined style={iconStyle} />;

    case 'placement':
    case 'PLACEMENT_UPDATE':
    case 'PLACEMENT_OFFER':
      return <TrophyOutlined style={iconStyle} />;

    case 'fee':
    case 'feeReminder':
    case 'FEE_DUE':
    case 'FEE_REMINDER':
      return <DollarOutlined style={iconStyle} />;

    case 'announcement':
    case 'ANNOUNCEMENT':
    case 'WEEKLY_SUMMARY':
      return <TeamOutlined style={iconStyle} />;

    case 'attendance':
    case 'ATTENDANCE_MARKED':
    case 'ATTENDANCE_WARNING':
      return <UserOutlined style={iconStyle} />;

    case 'GRIEVANCE_ASSIGNED':
    case 'GRIEVANCE_UPDATE':
    case 'GRIEVANCE_STATUS_CHANGED':
    case 'SUPPORT_TICKET_NEW':
      return <NotificationOutlined style={iconStyle} />;

    case 'SYSTEM_ALERT':
      return <WarningOutlined style={iconStyle} />;

    case 'FACULTY_VISIT_REMINDER':
      return <InfoCircleOutlined style={iconStyle} />;

    default:
      return <BellOutlined style={iconStyle} />;
  }
};

/**
 * Get color for notification type
 */
export const getNotificationColor = (type) => {
  const category = TYPE_TO_CATEGORY[type] || NOTIFICATION_CATEGORIES.ANNOUNCEMENT;

  const colorMap = {
    [NOTIFICATION_CATEGORIES.INTERNSHIP]: 'purple',
    [NOTIFICATION_CATEGORIES.PLACEMENT]: 'gold',
    [NOTIFICATION_CATEGORIES.ASSIGNMENT]: 'blue',
    [NOTIFICATION_CATEGORIES.ATTENDANCE]: 'cyan',
    [NOTIFICATION_CATEGORIES.EXAM]: 'orange',
    [NOTIFICATION_CATEGORIES.FEE]: 'red',
    [NOTIFICATION_CATEGORIES.ANNOUNCEMENT]: 'green',
    [NOTIFICATION_CATEGORIES.GRIEVANCE]: 'magenta',
    [NOTIFICATION_CATEGORIES.SYSTEM]: 'volcano',
  };

  return colorMap[category] || 'default';
};

/**
 * Format relative time for notifications
 */
export const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';

  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return time.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format full date for notifications
 */
export const formatFullDate = (timestamp) => {
  if (!timestamp) return '';

  const time = new Date(timestamp);
  return time.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

/**
 * Group notifications by date
 */
export const groupNotificationsByDate = (notifications) => {
  const groups = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  notifications.forEach((notification) => {
    const notifDate = new Date(notification.createdAt);

    if (notifDate >= today) {
      groups.today.push(notification);
    } else if (notifDate >= yesterday) {
      groups.yesterday.push(notification);
    } else if (notifDate >= weekAgo) {
      groups.thisWeek.push(notification);
    } else {
      groups.older.push(notification);
    }
  });

  return groups;
};

/**
 * Filter notifications by category
 */
export const filterByCategory = (notifications, category) => {
  if (category === NOTIFICATION_CATEGORIES.ALL) {
    return notifications;
  }

  return notifications.filter((notification) => {
    const notifCategory = TYPE_TO_CATEGORY[notification.type] || NOTIFICATION_CATEGORIES.ANNOUNCEMENT;
    return notifCategory === category;
  });
};

/**
 * Search notifications by text
 */
export const searchNotifications = (notifications, searchText) => {
  if (!searchText || !searchText.trim()) {
    return notifications;
  }

  const search = searchText.toLowerCase().trim();
  return notifications.filter((n) =>
    n.title?.toLowerCase().includes(search) ||
    n.body?.toLowerCase().includes(search)
  );
};

export default {
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  getNotificationIcon,
  getNotificationColor,
  formatTimeAgo,
  formatFullDate,
  groupNotificationsByDate,
  filterByCategory,
  searchNotifications,
};
