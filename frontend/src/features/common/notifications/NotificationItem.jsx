import React from 'react';
import { Avatar, Button, Tooltip, Popconfirm, Space, Typography, Tag } from 'antd';
import { CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { getNotificationIcon, getNotificationColor, formatTimeAgo, formatFullDate } from './notificationUtils.jsx';

const { Text } = Typography;

/**
 * Shared notification item component
 * Used in both dropdown and full page views
 */
const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete,
  compact = false,
  showType = false,
  selectable = false,
  selected = false,
  onSelect,
}) => {
  const { id, title, body, type, read, createdAt } = notification;

  const handleClick = () => {
    if (selectable && onSelect) {
      onSelect(id);
    } else if (!read && onMarkAsRead) {
      onMarkAsRead(id);
    }
  };

  const handleMarkAsRead = (e) => {
    e?.stopPropagation();
    onMarkAsRead?.(id);
  };

  const handleDelete = (e) => {
    e?.stopPropagation();
    onDelete?.(id);
  };

  return (
    <div
      onClick={handleClick}
      className={`
        notification-item cursor-pointer transition-all duration-300
        border-b border-gray-100 dark:border-slate-800 last:border-b-0
        flex items-start gap-4 ${compact ? 'p-4' : 'p-5'}
        ${!read 
          ? 'bg-blue-50/40 dark:bg-blue-900/10' 
          : 'bg-surface hover:bg-surface-hover'}
        ${selectable ? 'select-none' : ''}
        ${selected ? 'ring-2 ring-blue-500 ring-inset' : ''}
        group
      `}
    >
      {/* Selection checkbox area */}
      {selectable && (
        <div
          className={`
            w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-1
            transition-all duration-200
            ${selected ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-200' : 'border-border bg-surface group-hover:border-blue-400'}
          `}
        >
          {selected && <CheckOutlined className="text-white text-[10px] font-bold" />}
        </div>
      )}

      {/* Icon */}
      <div className="relative shrink-0">
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300
          ${!read ? 'bg-blue-100 text-blue-600 shadow-sm' : 'bg-background-secondary text-gray-500'}
        `}>
          {getNotificationIcon(type, 18)}
        </div>
        {!read && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1 gap-2">
          <div className="flex flex-col gap-0.5">
            <Text
              className={`${compact ? 'text-sm' : 'text-base'} font-bold leading-snug truncate 
                ${!read ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {title}
            </Text>
            <div className="flex items-center gap-2">
              <Tooltip title={formatFullDate(createdAt)}>
                <Text className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {formatTimeAgo(createdAt)}
                </Text>
              </Tooltip>
              {showType && type && (
                <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-background-secondary text-gray-500 dark:text-slate-400 border border-border`}>
                  {type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {!selectable && (
              <Space size={4}>
                {!read && onMarkAsRead && (
                  <Tooltip title="Mark as read">
                    <Button
                      type="text"
                      size="small"
                      icon={<CheckOutlined className="text-blue-600" />}
                      onClick={handleMarkAsRead}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    />
                  </Tooltip>
                )}
                {onDelete && (
                  <Tooltip title="Delete">
                    <Popconfirm
                      title="Delete this?"
                      onConfirm={handleDelete}
                      okText="Yes"
                      cancelText="No"
                      placement="left"
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      />
                    </Popconfirm>
                  </Tooltip>
                )}
              </Space>
            )}
          </div>
        </div>

        <Text
          className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed block text-gray-500 dark:text-slate-400 
            ${compact ? 'line-clamp-1' : 'line-clamp-2'}`}
        >
          {body}
        </Text>
      </div>
    </div>
  );
};

export default NotificationItem;
