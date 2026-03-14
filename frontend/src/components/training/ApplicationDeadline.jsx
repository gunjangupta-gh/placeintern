import React from 'react';
import { Tag, Typography, Tooltip } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const formatDate = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getDaysRemaining = (deadline) => {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const ApplicationDeadline = ({ deadline, showLabel = true, compact = false }) => {
  const date = deadline ? new Date(deadline) : null;
  const daysRemaining = getDaysRemaining(deadline);
  const isPast = daysRemaining !== null && daysRemaining < 0;
  const isToday = daysRemaining === 0;
  const isUrgent = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;

  const getStatusConfig = () => {
    if (isPast) {
      return {
        color: 'red',
        icon: <CloseCircleOutlined />,
        label: 'Closed',
        description: 'Application period has ended',
      };
    }
    if (isToday) {
      return {
        color: 'gold',
        icon: <ExclamationCircleOutlined />,
        label: 'Last Day',
        description: 'Applications close today',
      };
    }
    if (isUrgent) {
      return {
        color: 'orange',
        icon: <ClockCircleOutlined />,
        label: `${daysRemaining} days left`,
        description: 'Application deadline approaching',
      };
    }
    return {
      color: 'green',
      icon: <CheckCircleOutlined />,
      label: 'Open',
      description: daysRemaining !== null ? `${daysRemaining} days remaining` : 'Applications open',
    };
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <Tooltip title={`Deadline: ${formatDate(deadline)} - ${config.description}`}>
        <Tag color={config.color} icon={config.icon}>
          {config.label}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <Text className="text-xs text-text-secondary flex items-center gap-1">
          <ClockCircleOutlined /> Application Deadline
        </Text>
      )}
      <div className="flex items-center gap-2">
        <Text className="text-sm font-medium">{formatDate(deadline)}</Text>
        <Tag color={config.color} icon={config.icon} className="inline-flex items-center">
          {config.label}
        </Tag>
      </div>
      {!isPast && daysRemaining !== null && (
        <Text className={`text-xs ${isUrgent || isToday ? 'text-orange-500' : 'text-text-secondary'}`}>
          {config.description}
        </Text>
      )}
    </div>
  );
};

export default ApplicationDeadline;
