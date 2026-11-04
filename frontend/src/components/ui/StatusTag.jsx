import React from 'react';
import { Tag } from 'antd';
import { statusLabel } from './utils';

/** One status -> colour map for application / opportunity / record statuses. */
export const STATUS_COLOR = {
  // applications
  APPLIED: 'blue',
  UNDER_REVIEW: 'blue',
  SHORTLISTED: 'cyan',
  SELECTED: 'green',
  APPROVED: 'green',
  JOINED: 'green',
  COMPLETED: 'default',
  REJECTED: 'red',
  WITHDRAWN: 'default',
  // opportunities
  OPEN: 'green',
  CLOSED: 'default',
  DRAFT: 'orange',
  FILLED: 'blue',
  // generic
  ACTIVE: 'green',
  INACTIVE: 'default',
  PENDING: 'orange',
  FAILED: 'red',
  SUCCESS: 'green',
};

const StatusTag = ({ status, label, color, style, ...rest }) => (
  <Tag color={color || STATUS_COLOR[String(status).toUpperCase()]} style={{ margin: 0, ...style }} {...rest}>
    {label ?? statusLabel(status)}
  </Tag>
);

export default StatusTag;
