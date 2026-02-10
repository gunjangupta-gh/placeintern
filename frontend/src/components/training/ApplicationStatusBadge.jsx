import React from 'react';
import { Tag } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';

const STATUS_CONFIG = {
  PENDING: {
    color: 'gold',
    icon: <ClockCircleOutlined />,
    label: 'Pending',
  },
  SUBMITTED: {
    color: 'blue',
    icon: <ClockCircleOutlined />,
    label: 'Submitted',
  },
  APPROVED: {
    color: 'green',
    icon: <CheckCircleOutlined />,
    label: 'Approved',
  },
  REJECTED: {
    color: 'red',
    icon: <CloseCircleOutlined />,
    label: 'Rejected',
  },
  WAITLISTED: {
    color: 'orange',
    icon: <ExclamationCircleOutlined />,
    label: 'Waitlisted',
  },
  WITHDRAWN: {
    color: 'default',
    icon: <MinusCircleOutlined />,
    label: 'Withdrawn',
  },
  CANCELLED: {
    color: 'default',
    icon: <CloseCircleOutlined />,
    label: 'Cancelled',
  },
};

const ApplicationStatusBadge = ({ status, showIcon = true }) => {
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

export default ApplicationStatusBadge;
