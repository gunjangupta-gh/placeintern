import React from 'react';
import { Tag } from 'antd';
import {
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const STATUS_CONFIG = {
  DRAFT: { color: 'default', icon: <EditOutlined />, label: 'Draft' },
  PUBLISHED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Published' },
  UNPUBLISHED: { color: 'default', icon: <StopOutlined />, label: 'Unpublished' },
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Active' },
  INACTIVE: { color: 'default', icon: <StopOutlined />, label: 'Inactive' },
  UPCOMING: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Upcoming' },
  ONGOING: { color: 'gold', icon: <PlayCircleOutlined />, label: 'Ongoing' },
  COMPLETED: { color: 'purple', icon: <CheckCircleOutlined />, label: 'Completed' },
  CANCELLED: { color: 'red', icon: <CloseCircleOutlined />, label: 'Cancelled' },
};

const TrainingStatusBadge = ({ status, showIcon = true }) => {
  if (!status) return null;
  const config = STATUS_CONFIG[status] || {
    color: 'default',
    label: status.replace(/_/g, ' '),
  };

  return (
    <Tag
      color={config.color}
      icon={showIcon ? config.icon : null}
      className="inline-flex items-center gap-1"
    >
      {config.label}
    </Tag>
  );
};

export default TrainingStatusBadge;
