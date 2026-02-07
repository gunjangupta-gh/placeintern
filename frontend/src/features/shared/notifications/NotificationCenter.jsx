import React from 'react';
import { Card, Avatar, Button, Empty, Badge, Flex } from 'antd';
import { BellOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNotifications } from '../../../hooks/useNotifications';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { formatRelativeTime } from '../../../utils/format';

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  if (loading && notifications.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          Notifications
          {unreadCount > 0 && (
            <Badge count={unreadCount} className="ml-3" />
          )}
        </h1>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead}>Mark All as Read</Button>
          )}
          {notifications.length > 0 && (
            <Button danger onClick={clearAll}>
              Clear All
            </Button>
          )}
        </div>
      </div>

      <Card>
        {notifications.length === 0 ? (
          <Empty description="No notifications" />
        ) : (
          <Flex vertical gap={0}>
            {notifications.map((item) => (
              <div
                key={item.id}
                className={`flex items-start gap-4 p-4 border-b border-border last:border-b-0 ${
                  !item.read ? 'bg-blue-50' : ''
                }`}
              >
                <Avatar icon={<BellOutlined />} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary">{item.title}</div>
                  <p className="text-text-secondary mt-1">{item.body || item.message}</p>
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {!item.read && (
                    <Button
                      type="link"
                      icon={<CheckOutlined />}
                      onClick={() => markAsRead(item.id)}
                    >
                      Mark as read
                    </Button>
                  )}
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => deleteNotification(item.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </Flex>
        )}
      </Card>
    </div>
  );
};

export default NotificationCenter;
