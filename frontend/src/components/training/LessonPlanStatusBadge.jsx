import React from 'react';
import { Tag } from 'antd';
import {
  EditOutlined,
  SendOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';

const STATUS_CONFIG = {
  DRAFT: {
    color: 'default',
    icon: <EditOutlined />,
    label: 'Draft',
  },
  SUBMITTED: {
    color: 'blue',
    icon: <SendOutlined />,
    label: 'Submitted',
  },
  UNDER_REVIEW: {
    color: 'gold',
    icon: <EyeOutlined />,
    label: 'Under Review',
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
  REVISION_REQUESTED: {
    color: 'orange',
    icon: <SyncOutlined />,
    label: 'Revision Requested',
  },
};

const LessonPlanStatusBadge = ({ status, showIcon = true }) => {
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

export default LessonPlanStatusBadge;
