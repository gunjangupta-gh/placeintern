import React from 'react';
import { Tag, Tooltip } from 'antd';
import { StarOutlined, StarFilled, ThunderboltOutlined } from '@ant-design/icons';

const DIFFICULTY_CONFIG = {
  BEGINNER: {
    color: 'green',
    icon: <StarOutlined />,
    label: 'Beginner',
    description: 'No prior experience required',
  },
  INTERMEDIATE: {
    color: 'orange',
    icon: <StarFilled />,
    label: 'Intermediate',
    description: 'Some experience recommended',
  },
  ADVANCED: {
    color: 'red',
    icon: <ThunderboltOutlined />,
    label: 'Advanced',
    description: 'Expert-level content',
  },
};

const DifficultyBadge = ({ level, showTooltip = true }) => {
  if (!level) return null;
  const config = DIFFICULTY_CONFIG[level] || { color: 'default', label: level };

  const badge = (
    <Tag
      color={config.color}
      icon={config.icon}
      className="inline-flex items-center gap-1"
    >
      {config.label}
    </Tag>
  );

  if (showTooltip && config.description) {
    return <Tooltip title={config.description}>{badge}</Tooltip>;
  }

  return badge;
};

export default DifficultyBadge;
