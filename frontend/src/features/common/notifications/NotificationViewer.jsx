import React, { useState, useMemo, useCallback } from 'react';
import {
  Card,
  Button,
  Empty,
  Badge,
  Input,
  Select,
  Space,
  Tooltip,
  Popconfirm,
  Tabs,
  Spin,
  Typography,
  Divider,
  Dropdown,
} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  DeleteOutlined,
  ClearOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SyncOutlined,
  InboxOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useNotifications } from './useNotifications';
import NotificationItem from './NotificationItem';
import {
  NOTIFICATION_CATEGORIES,
  filterByCategory,
  searchNotifications,
  groupNotificationsByDate,
} from './notificationUtils.jsx';

const { Title, Text, Paragraph } = Typography;

/**
 * Get connection status info based on connection state
 */
const getConnectionStatus = (connectionState, isConnected) => {
  switch (connectionState) {
    case 'connected':
      return { color: 'green', icon: <WifiOutlined />, text: 'Connected' };
    case 'connecting':
      return { color: 'blue', icon: <SyncOutlined spin />, text: 'Connecting...' };
    case 'reconnecting':
      return { color: 'orange', icon: <SyncOutlined spin />, text: 'Reconnecting...' };
    case 'error':
      return { color: 'red', icon: <DisconnectOutlined />, text: 'Connection Error' };
    case 'disconnected':
    default:
      return { color: 'gray', icon: <DisconnectOutlined />, text: 'Disconnected' };
  }
};

/**
 * Full-page notification viewer component
 * Provides comprehensive notification management with filtering, search, and bulk actions
 */
const NotificationViewer = () => {
  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    connectionState,
    lastSyncTime,
    markAsRead,
    markMultipleAsRead,
    markAllAsRead,
    deleteNotification,
    deleteMultiple,
    clearAll,
    clearRead,
    refresh,
    forceReconnect,
  } = useNotifications();

  // Get connection status info
  const connectionStatus = getConnectionStatus(connectionState, isConnected);

  // Local state
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(NOTIFICATION_CATEGORIES.ALL);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);

  // Filter notifications based on search, category, and tab
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    // Filter by tab (all/unread/read)
    if (activeTab === 'unread') {
      result = result.filter((n) => !n.read);
    } else if (activeTab === 'read') {
      result = result.filter((n) => n.read);
    }

    // Filter by category
    result = filterByCategory(result, selectedCategory);

    // Filter by search text
    result = searchNotifications(result, searchText);

    return result;
  }, [notifications, activeTab, selectedCategory, searchText]);

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(filteredNotifications);
  }, [filteredNotifications]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  }, [filteredNotifications, selectedIds]);

  const handleSelect = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const handleBulkMarkAsRead = useCallback(async () => {
    if (selectedIds.length > 0) {
      await markMultipleAsRead(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
    }
  }, [selectedIds, markMultipleAsRead]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length > 0) {
      await deleteMultiple(selectedIds);
      setSelectedIds([]);
      setSelectionMode(false);
    }
  }, [selectedIds, deleteMultiple]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedIds([]);
  }, []);

  // Category options
  const categoryOptions = [
    { value: NOTIFICATION_CATEGORIES.ALL, label: 'All Categories' },
    { value: NOTIFICATION_CATEGORIES.INTERNSHIP, label: 'Internship' },
    { value: NOTIFICATION_CATEGORIES.PLACEMENT, label: 'Placement' },
    { value: NOTIFICATION_CATEGORIES.ASSIGNMENT, label: 'Assignments' },
    { value: NOTIFICATION_CATEGORIES.ATTENDANCE, label: 'Attendance' },
    { value: NOTIFICATION_CATEGORIES.EXAM, label: 'Exams' },
    { value: NOTIFICATION_CATEGORIES.FEE, label: 'Fees' },
    { value: NOTIFICATION_CATEGORIES.ANNOUNCEMENT, label: 'Announcements' },
    { value: NOTIFICATION_CATEGORIES.GRIEVANCE, label: 'Grievances' },
    { value: NOTIFICATION_CATEGORIES.SYSTEM, label: 'System' },
  ];

  // Tab items
  const tabItems = [
    {
      key: 'all',
      label: (
        <span className="flex items-center gap-2">
          All
          <Badge 
            count={notifications.length} 
            overflowCount={999}
            className="ml-1" 
            size="small" 
            showZero={false} 
            styles={{ indicator: { background: '#94a3b8' } }}
          />
        </span>
      ),
    },
    {
      key: 'unread',
      label: (
        <span className="flex items-center gap-2">
          Unread
          <Badge 
            count={unreadCount} 
            className="ml-1" 
            size="small" 
            showZero={false} 
          />
        </span>
      ),
    },
    {
      key: 'read',
      label: (
        <span className="flex items-center gap-2">
          Read
          <Badge
            count={notifications.length - unreadCount}
            className="ml-1"
            size="small"
            showZero={false}
            styles={{ indicator: { background: '#10b981' } }}
          />
        </span>
      ),
    },
  ];

  // More actions menu
  const moreActionsMenu = {
    items: [
      {
        key: 'select',
        icon: <CheckOutlined />,
        label: selectionMode ? 'Exit Selection' : 'Select Multiple',
        onClick: toggleSelectionMode,
      },
      {
        key: 'clearRead',
        icon: <ClearOutlined />,
        label: 'Clear Read Notifications',
        onClick: clearRead,
        disabled: notifications.filter((n) => n.read).length === 0,
      },
      { type: 'divider' },
      {
        key: 'clearAll',
        icon: <DeleteOutlined />,
        label: 'Clear All Notifications',
        danger: true,
        onClick: clearAll,
        disabled: notifications.length === 0,
      },
    ],
  };

  // Render notification groups
  const renderNotificationGroup = (title, items) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className="mb-8">
        <div className="flex items-center gap-3 mb-4 px-1">
          <div className="h-px flex-1 bg-gray-100 dark:bg-slate-800" />
          <Text className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 whitespace-nowrap">
            {title}
          </Text>
          <div className="h-px flex-1 bg-gray-100 dark:bg-slate-800" />
        </div>
        <Card bordered={false} className="rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900" styles={{ body: { padding: 0 } }}>
          {items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              showType={selectedCategory === NOTIFICATION_CATEGORIES.ALL}
              selectable={selectionMode}
              selected={selectedIds.includes(notification.id)}
              onSelect={handleSelect}
            />
          ))}
        </Card>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-background-secondary min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-blue-600 shadow-sm">
              <BellOutlined className="text-2xl" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Title level={2} className="!m-0 !text-gray-900 dark:!text-white !text-2xl lg:!text-3xl tracking-tight">
                  Notification Inbox
                </Title>
                <Tooltip
                  title={
                    <div>
                      <div className="font-bold">{connectionStatus.text}</div>
                      {lastSyncTime && (
                        <div className="text-[10px] opacity-75 mt-0.5">
                          Synced at {lastSyncTime.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  }
                >
                  <div 
                    className={`w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 shadow-sm cursor-pointer ${connectionState === 'error' ? 'animate-pulse' : ''}`}
                    style={{ background: connectionStatus.color }}
                    onClick={connectionState === 'error' ? forceReconnect : undefined}
                  />
                </Tooltip>
              </div>
              <Paragraph className="!text-gray-500 dark:!text-slate-400 !text-sm !mb-0 font-medium">
                Stay updated with your latest academic and internship activities
              </Paragraph>
            </div>
          </div>

          <Space wrap className="w-full lg:w-auto">
            {selectionMode && selectedIds.length > 0 ? (
              <div className="flex items-center gap-2 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 shadow-sm animate-fade-in">
                <Text className="text-xs font-bold text-blue-600 dark:text-blue-400 px-3">
                  {selectedIds.length} SELECTED
                </Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleBulkMarkAsRead}
                  className="rounded-lg h-8 bg-blue-600 hover:bg-blue-500 font-semibold"
                >
                  Read
                </Button>
                <Popconfirm
                  title={`Delete ${selectedIds.length} notifications?`}
                  onConfirm={handleBulkDelete}
                  okText="Yes"
                  cancelText="No"
                  placement="bottomRight"
                >
                  <Button danger size="small" type="primary" icon={<DeleteOutlined />} className="rounded-lg h-8 font-semibold shadow-red-100" />
                </Popconfirm>
              </div>
            ) : (
              <>
                {!selectionMode && unreadCount > 0 && (
                  <Button 
                    icon={<CheckOutlined />} 
                    onClick={markAllAsRead}
                    className="rounded-xl h-11 border-gray-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    Mark All as Read
                  </Button>
                )}
                
                <Tooltip title="Refresh Inbox">
                  <Button 
                    icon={<ReloadOutlined spin={loading} />} 
                    onClick={refresh} 
                    loading={loading}
                    size="large"
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 shadow-sm hover:text-blue-600 hover:border-blue-200 transition-all duration-200" 
                  />
                </Tooltip>

                <Dropdown menu={moreActionsMenu} placement="bottomRight" arrow={{ pointAtCenter: true }}>
                  <Button 
                    icon={<MoreOutlined />} 
                    size="large"
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 shadow-sm"
                  />
                </Dropdown>
              </>
            )}
          </Space>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
          <div className="md:col-span-8">
            <Input
              placeholder="Search notifications, subjects or content..."
              prefix={<SearchOutlined className="text-gray-400 mr-2" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="rounded-2xl h-12 bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all px-4"
            />
          </div>
          <div className="md:col-span-4">
            <Select
              placeholder="Filter by category"
              value={selectedCategory}
              onChange={setSelectedCategory}
              options={categoryOptions}
              className="w-full h-12 custom-select rounded-2xl"
              suffixIcon={<FilterOutlined className="text-gray-400" />}
              dropdownStyle={{ borderRadius: '16px', padding: '8px' }}
            />
          </div>
        </div>

        {/* Tabs and Content */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="custom-tabs mb-6"
          size="large"
        />

        {/* Main Content Area */}
        <div className="min-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm">
              <Spin size="large" />
              <Text className="text-gray-400 font-medium">Checking your inbox...</Text>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-16 shadow-sm animate-fade-in">
              <Empty
                image={<InboxOutlined className="text-7xl text-gray-200 dark:text-slate-800" />}
                description={
                  <div className="mt-4">
                    <Title level={4} className="!m-0 !text-gray-900 dark:!text-white">
                      Inbox is empty
                    </Title>
                    <Paragraph className="text-gray-400 dark:text-slate-500 mt-2 max-w-sm mx-auto">
                      {searchText || selectedCategory !== NOTIFICATION_CATEGORIES.ALL
                        ? "We couldn't find any notifications matching your current filters."
                        : activeTab === 'unread'
                        ? "You're all caught up! No unread notifications to show."
                        : "You don't have any notifications at the moment. We'll let you know when something new arrives."}
                    </Paragraph>
                    {(searchText || selectedCategory !== NOTIFICATION_CATEGORIES.ALL) && (
                      <Button
                        type="primary"
                        ghost
                        onClick={() => {
                          setSearchText('');
                          setSelectedCategory(NOTIFICATION_CATEGORIES.ALL);
                        }}
                        className="mt-6 rounded-xl font-bold h-10 border-blue-200 text-blue-600"
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Grouped Notifications */}
              {groupedNotifications.today.length > 0 && renderNotificationGroup('Today', groupedNotifications.today)}
              {groupedNotifications.yesterday.length > 0 && renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
              {groupedNotifications.thisWeek.length > 0 && renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
              {groupedNotifications.older.length > 0 && renderNotificationGroup('Earlier', groupedNotifications.older)}

              {/* Fallback for ungrouped */}
              {Object.values(groupedNotifications).every((g) => g.length === 0) &&
                filteredNotifications.length > 0 && (
                  <Card bordered={false} className="rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900" styles={{ body: { padding: 0 } }}>
                    {filteredNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                        onDelete={deleteNotification}
                        showType={selectedCategory === NOTIFICATION_CATEGORIES.ALL}
                        selectable={selectionMode}
                        selected={selectedIds.includes(notification.id)}
                        onSelect={handleSelect}
                      />
                    ))}
                  </Card>
                )}
            </div>
          )}
        </div>

        {/* Footer info */}
        {notifications.length > 0 && (
          <div className="mt-10 mb-16 text-center border-t border-gray-100 dark:border-slate-800 pt-8">
            <Text className="text-gray-400 dark:text-slate-500 font-medium">
              Showing <span className="text-gray-900 dark:text-white font-bold">{filteredNotifications.length}</span> of <span className="text-gray-900 dark:text-white font-bold">{notifications.length}</span> total notifications
              {unreadCount > 0 && <span> (<span className="text-blue-600 dark:text-blue-400 font-bold">{unreadCount} unread</span>)</span>}
            </Text>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationViewer;
