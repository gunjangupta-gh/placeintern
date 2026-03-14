import React from 'react';
import { Typography, Tooltip } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatDate = (value, options = {}) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';

  const defaultOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

const formatShortDate = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays === 1 ? '1 day' : `${diffDays} days`;
};

const TrainingDateRange = ({ startDate, endDate, showIcon = true, compact = false }) => {
  const start = compact ? formatShortDate(startDate) : formatDate(startDate);
  const end = compact ? formatShortDate(endDate) : formatDate(endDate);
  const duration = getDuration(startDate, endDate);

  const isSameDay = startDate && endDate &&
    new Date(startDate).toDateString() === new Date(endDate).toDateString();

  const content = (
    <div className="inline-flex items-center gap-1.5">
      {showIcon && <CalendarOutlined className="text-text-secondary" />}
      <Text className={compact ? 'text-xs' : 'text-sm'}>
        {isSameDay ? start : `${start} - ${end}`}
      </Text>
    </div>
  );

  if (duration && !compact) {
    return (
      <Tooltip title={`Duration: ${duration}`}>
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default TrainingDateRange;
