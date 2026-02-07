import React, { useState, useMemo } from 'react';
import {
  Dropdown,
  Badge,
  Button,
  Typography,
  Empty,
  Space,
  Tag,
  Avatar,
  Tooltip,
  Popconfirm,
  Drawer,
  Spin,
  Input,
  List,
} from 'antd';
import {
  BellOutlined,
  DeleteOutlined,
  CheckOutlined,
  EyeOutlined,
  ClearOutlined,
  InboxOutlined,
  SearchOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNotifications } from './useNotifications';
import { getNotificationIcon, getNotificationColor, formatTimeAgo } from './notificationUtils.jsx';

const { Text, Title } = Typography;

const NotificationDropdown = ({ maxItems = 10 }) => {
  const { darkMode } = useTheme();
  const [open, setOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState('');

  const {
    notifications,
    unreadCount,
    loading,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Filter notifications by search
  const filteredNotifications = useMemo(() => {
    if (!searchText) return notifications;
    const search = searchText.toLowerCase();
    return notifications.filter((n) =>
      n.title?.toLowerCase().includes(search) ||
      n.body?.toLowerCase().includes(search)
    );
  }, [notifications, searchText]);

  const recentNotifications = notifications.slice(0, maxItems);

  const handleMarkAsRead = async (id, e) => {
    e?.stopPropagation();
    await markAsRead(id);
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    await deleteNotification(id);
  };

  const dropdownContent = (
    <div
      style={{
        width: '380px',
        maxHeight: '500px',
        background: darkMode ? '#1f2937' : '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${darkMode ? '#374151' : '#f0f0f0'}`,
          background: darkMode ? '#111827' : '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Title level={5} style={{ margin: 0, color: darkMode ? '#ffffff' : '#1f2937', fontWeight: 600 }}>
              Notifications
            </Title>
            {unreadCount > 0 && (
              <Badge count={unreadCount} style={{ backgroundColor: '#3b82f6' }} />
            )}
            {isConnected && (
              <Tooltip title="Real-time connected">
                <span style={{ width: 8, height: 8, backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
              </Tooltip>
            )}
          </div>
          <Space>
            {notifications.length > 0 && (
              <>
                <Tooltip title="Mark all as read">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={markAllAsRead}
                    style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                  />
                </Tooltip>
                <Popconfirm
                  title="Clear all notifications?"
                  description="This action cannot be undone."
                  onConfirm={clearAll}
                  okText="Yes"
                  cancelText="No"
                >
                  <Tooltip title="Clear all">
                    <Button
                      type="text"
                      size="small"
                      icon={<ClearOutlined />}
                      style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}
                    />
                  </Tooltip>
                </Popconfirm>
              </>
            )}
          </Space>
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <Spin size="small" />
            <div style={{ marginTop: 8 }}>
              <Text style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: 12 }}>
                Loading notifications...
              </Text>
            </div>
          </div>
        ) : recentNotifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <InboxOutlined style={{ fontSize: '48px', color: darkMode ? '#4b5563' : '#d1d5db' }} />
            <div style={{ marginTop: 12 }}>
              <Text style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>
                No notifications yet
              </Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={recentNotifications}
            renderItem={(notification) => (
              <div
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  background: notification.read
                    ? darkMode ? '#1f2937' : '#ffffff'
                    : darkMode ? '#374151' : '#eff6ff',
                  borderBottom: `1px solid ${darkMode ? '#374151' : '#f3f4f6'}`,
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = darkMode ? '#374151' : '#f0f9ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = notification.read
                    ? darkMode ? '#1f2937' : '#ffffff'
                    : darkMode ? '#374151' : '#eff6ff';
                }}
                onClick={() => !notification.read && handleMarkAsRead(notification.id)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <Avatar
                    icon={getNotificationIcon(notification.type)}
                    style={{
                      backgroundColor: darkMode ? '#374151' : '#f3f4f6',
                      color: darkMode ? '#9ca3af' : '#6b7280',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <Text
                        strong={!notification.read}
                        style={{
                          color: darkMode ? '#ffffff' : '#1f2937',
                          fontSize: '14px',
                          lineHeight: '1.4',
                        }}
                        ellipsis={{ tooltip: notification.title }}
                      >
                        {notification.title}
                      </Text>
                      {!notification.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: '#3b82f6',
                            borderRadius: '50%',
                            flexShrink: 0,
                            marginLeft: '8px',
                            marginTop: '4px',
                          }}
                        />
                      )}
                    </div>
                    <Text
                      style={{
                        color: darkMode ? '#9ca3af' : '#6b7280',
                        fontSize: '13px',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {notification.body}
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Tag color={getNotificationColor(notification.type)} style={{ fontSize: '10px', margin: 0, borderRadius: '9999px' }}>
                          {notification.type?.replace(/_/g, ' ').toLowerCase()}
                        </Tag>
                        <Text style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '11px' }}>
                          {formatTimeAgo(notification.createdAt)}
                        </Text>
                      </div>
                      <Space size={4}>
                        {!notification.read && (
                          <Tooltip title="Mark as read">
                            <Button
                              type="text"
                              size="small"
                              icon={<EyeOutlined style={{ fontSize: 12 }} />}
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              style={{ color: darkMode ? '#6b7280' : '#9ca3af', padding: '0 4px' }}
                            />
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                            onClick={(e) => handleDelete(notification.id, e)}
                            style={{ color: darkMode ? '#6b7280' : '#9ca3af', padding: '0 4px' }}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > maxItems && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${darkMode ? '#374151' : '#f0f0f0'}`,
            background: darkMode ? '#111827' : '#f9fafb',
            textAlign: 'center',
          }}
        >
          <Button
            type="link"
            style={{ color: '#3b82f6', padding: 0, height: 'auto', fontWeight: 500 }}
            onClick={() => { setOpen(false); setDrawerOpen(true); }}
          >
            View all notifications ({notifications.length})
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dropdown
        popupRender={() => dropdownContent}
        trigger={['click']}
        open={open}
        onOpenChange={setOpen}
        placement="bottomRight"
        styles={{ root: { zIndex: 1050 } }}
      >
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Button
            type="text"
            icon={<BellOutlined style={{ fontSize: 18 }} />}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`,
              background: darkMode ? '#1f2937' : '#ffffff',
              color: darkMode ? '#9ca3af' : '#6b7280',
            }}
          />
        </Badge>
      </Dropdown>

      {/* All Notifications Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: darkMode ? '#ffffff' : '#1f2937' }}>
                All Notifications
              </span>
              {isConnected && (
                <Tooltip title="Real-time connected">
                  <WifiOutlined style={{ color: '#22c55e', fontSize: 14 }} />
                </Tooltip>
              )}
            </div>
            <Space size={4}>
              {notifications.length > 0 && (
                <>
                  <Tooltip title="Mark all as read">
                    <Button type="text" size="small" icon={<CheckOutlined />} onClick={markAllAsRead} />
                  </Tooltip>
                  <Popconfirm
                    title="Clear all notifications?"
                    description="This action cannot be undone."
                    onConfirm={clearAll}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Tooltip title="Clear all">
                      <Button type="text" size="small" icon={<ClearOutlined />} danger />
                    </Tooltip>
                  </Popconfirm>
                </>
              )}
            </Space>
          </div>
        }
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        styles={{
          wrapper: { width: 420 },
          body: { padding: 0, background: darkMode ? '#1f2937' : '#ffffff' },
          header: {
            background: darkMode ? '#111827' : '#f9fafb',
            borderBottom: `1px solid ${darkMode ? '#374151' : '#f0f0f0'}`,
          },
          content: { background: darkMode ? '#1f2937' : '#ffffff' },
        }}
      >
        {/* Search */}
        <div style={{ padding: '16px', borderBottom: `1px solid ${darkMode ? '#374151' : '#f0f0f0'}` }}>
          <Input
            placeholder="Search notifications..."
            prefix={<SearchOutlined style={{ color: darkMode ? '#6b7280' : '#9ca3af' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{
              borderRadius: '8px',
              background: darkMode ? '#374151' : '#f9fafb',
              border: `1px solid ${darkMode ? '#4b5563' : '#e5e7eb'}`,
            }}
          />
        </div>

        {/* Notifications List */}
        <div style={{ overflowY: 'auto', height: 'calc(100vh - 140px)' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text style={{ color: darkMode ? '#9ca3af' : '#6b7280' }}>Loading notifications...</Text>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <InboxOutlined style={{ fontSize: '64px', color: darkMode ? '#4b5563' : '#d1d5db' }} />
              <div style={{ marginTop: 16 }}>
                <Text style={{ color: darkMode ? '#9ca3af' : '#6b7280', fontSize: '16px' }}>
                  {searchText ? 'No matching notifications' : 'No notifications yet'}
                </Text>
              </div>
            </div>
          ) : (
            <List
              dataSource={filteredNotifications}
              renderItem={(notification) => (
                <div
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: notification.read
                      ? 'transparent'
                      : darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                    borderBottom: `1px solid ${darkMode ? '#374151' : '#f3f4f6'}`,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = darkMode ? '#374151' : '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = notification.read
                      ? 'transparent'
                      : darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)';
                  }}
                  onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: darkMode ? '#374151' : '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: darkMode ? '#9ca3af' : '#6b7280',
                      }}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <Text
                          strong={!notification.read}
                          style={{ color: darkMode ? '#ffffff' : '#1f2937', fontSize: '14px', lineHeight: '1.4' }}
                        >
                          {notification.title}
                        </Text>
                        {!notification.read && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#3b82f6',
                              borderRadius: '50%',
                              flexShrink: 0,
                              marginLeft: '8px',
                              marginTop: '4px',
                            }}
                          />
                        )}
                      </div>
                      <Text
                        style={{
                          color: darkMode ? '#9ca3af' : '#6b7280',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          display: 'block',
                          marginBottom: '8px',
                        }}
                      >
                        {notification.body}
                      </Text>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space size={4}>
                          <Tag
                            color={getNotificationColor(notification.type)}
                            style={{ fontSize: '10px', margin: 0, borderRadius: '4px' }}
                          >
                            {notification.type?.replace(/_/g, ' ').toLowerCase()}
                          </Tag>
                          <Text style={{ color: darkMode ? '#6b7280' : '#9ca3af', fontSize: '11px' }}>
                            {formatTimeAgo(notification.createdAt)}
                          </Text>
                        </Space>
                        <Space size={0}>
                          {!notification.read && (
                            <Tooltip title="Mark as read">
                              <Button
                                type="text"
                                size="small"
                                icon={<EyeOutlined style={{ fontSize: 14 }} />}
                                onClick={(e) => handleMarkAsRead(notification.id, e)}
                                style={{ color: darkMode ? '#6b7280' : '#9ca3af', padding: '4px' }}
                              />
                            </Tooltip>
                          )}
                          <Popconfirm
                            title="Delete this notification?"
                            onConfirm={(e) => handleDelete(notification.id, e)}
                            okText="Delete"
                            cancelText="Cancel"
                          >
                            <Tooltip title="Delete">
                              <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: darkMode ? '#6b7280' : '#9ca3af', padding: '4px' }}
                              />
                            </Tooltip>
                          </Popconfirm>
                        </Space>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </Drawer>
    </>
  );
};

export default NotificationDropdown;
