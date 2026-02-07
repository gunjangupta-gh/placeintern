// Common Notification System
// This module provides a unified notification system for the entire application

// Components
export { default as NotificationViewer } from './NotificationViewer';
export { default as NotificationDropdown } from './NotificationDropdown';
export { default as NotificationItem } from './NotificationItem';

// Hook
export { useNotifications, default as useNotificationsHook } from './useNotifications';

// Utilities
export {
  NOTIFICATION_CATEGORIES,
  TYPE_TO_CATEGORY,
  getNotificationIcon,
  getNotificationColor,
  formatTimeAgo,
  formatFullDate,
  groupNotificationsByDate,
  filterByCategory,
  searchNotifications,
} from './notificationUtils.jsx';

// Default export for convenience
export { default } from './NotificationViewer';
