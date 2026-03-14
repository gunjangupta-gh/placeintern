import React from 'react';
import { Tag } from 'antd';
import { GlobalOutlined, EnvironmentOutlined, SwapOutlined } from '@ant-design/icons';

const MODE_CONFIG = {
  ONLINE: { color: 'blue', icon: <GlobalOutlined />, label: 'Online' },
  OFFLINE: { color: 'green', icon: <EnvironmentOutlined />, label: 'In-Person' },
  HYBRID: { color: 'purple', icon: <SwapOutlined />, label: 'Hybrid' },
};

const DeliveryModeBadge = ({ mode, showIcon = true }) => {
  if (!mode) return null;
  const config = MODE_CONFIG[mode] || { color: 'default', label: mode };

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

export default DeliveryModeBadge;
