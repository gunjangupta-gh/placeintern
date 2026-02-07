import React from 'react';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';

export const getStatusIcon = (status) => {
  const icons = {
    APPLIED: <ClockCircleOutlined />,
    UNDER_REVIEW: <ClockCircleOutlined />,
    ACCEPTED: <CheckCircleOutlined />,
    REJECTED: <CloseCircleOutlined />,
    JOINED: <CheckCircleOutlined />,
    COMPLETED: <StarOutlined />,
  };
  return icons[status] || <ClockCircleOutlined />;
};
