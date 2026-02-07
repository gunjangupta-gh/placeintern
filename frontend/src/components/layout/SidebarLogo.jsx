import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

const SidebarLogo = ({ collapsed, role }) => {
  const formatRole = (roleStr) => {
    if (!roleStr) return 'Guest';
    return roleStr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="relative">
      {/* Logo Area */}
      <div
        className={`
          flex items-center h-[52px] px-4
          transition-all duration-300
          ${collapsed ? 'justify-center' : 'justify-start gap-3'}
        `}
        style={{ background: 'rgba(255,255,255,0.02)' }}
      >
        {/* Logo Icon */}
        <div
          className={`
            flex items-center justify-center
            rounded-lg
            transition-all duration-300
            ${collapsed ? 'w-[34px] h-[34px]' : 'w-[34px] h-[34px]'}
          `}
          style={{ background: '#3b82f6' }}
        >
          <span className="text-white font-bold text-[15px]">
            P
          </span>
        </div>

        {/* Logo Text - Only show when not collapsed */}
        {!collapsed && (
          <span
            style={{
              color: '#fff',
              fontSize: '17px',
              fontWeight: 600,
              letterSpacing: '-0.3px',
            }}
          >
            PlaceIntern
          </span>
        )}
      </div>

      {/* Role Badge - Only show when not collapsed */}
      {!collapsed && (
        <div style={{ padding: '8px 18px', marginBottom: 6 }}>
          <Text
            style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              fontWeight: 500,
            }}
          >
            {formatRole(role)}
          </Text>
        </div>
      )}
    </div>
  );
};

export default SidebarLogo;
