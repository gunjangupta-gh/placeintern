import React from 'react';
import { Button, Tooltip, Layout, Badge } from 'antd';
import {
  MenuOutlined,
  ArrowRightOutlined,
  SunOutlined,
  MoonOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { NotificationDropdown } from '../../features/common/notifications';

const { Header } = Layout;

const LayoutHeader = ({
  collapsed,
  onToggleCollapse,
  onMobileOpen,
  isDesktop,
  darkMode,
  toggleTheme,
  themeRef,
  onProfileClick,
  onLogoutClick,
}) => {
  const headerStyle = darkMode
    ? {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '52px',
        lineHeight: '52px',
        padding: '0 20px',
        background: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }
    : {
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '56px',
        lineHeight: '56px',
        padding: '0 20px',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      };

  const buttonStyle = {
    width: '36px',
    height: '36px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
  };

  return (
    <Header style={headerStyle} className="flex items-center justify-between shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-2">
        <Button
          type="text"
          icon={isDesktop ? (collapsed ? <ArrowRightOutlined /> : <MenuOutlined />) : <MenuOutlined />}
          onClick={() => (isDesktop ? onToggleCollapse() : onMobileOpen())}
          size="small"
          style={{
            ...buttonStyle,
            width: 36,
            height: 36,
            borderRadius: 8,
          }}
          className={`hover:${darkMode ? 'bg-gray-700' : 'bg-blue-50'} transition-colors`}
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle Button */}
        <Button
          type="text"
          ref={themeRef}
          icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          size="small"
          style={{
            ...buttonStyle,
            width: 36,
            height: 36,
            borderRadius: 10,
            border: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', 
          }}
          className={`
            hover:scale-105 transition-all duration-200 ease-in-out 
            ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-blue-50'}
          `}
        />

        {/* Notifications */}
        <Badge>
          <NotificationDropdown />
        </Badge>

        {/* User Profile Button */}
        <Tooltip title="Profile" placement="bottom">
          <Button
            type="text"
            icon={<UserOutlined />}
            onClick={onProfileClick}
            size="small"
            style={{
              ...buttonStyle,
              width: 36,
              height: 36,
            }}
            className={`
              hover:scale-105 transition-all duration-200 ease-in-out
              ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-blue-50'}
            `}
          />
        </Tooltip>

        {/* Logout Button */}
        <Button
          type="primary"
          danger
          onClick={onLogoutClick}
          size="small"
          icon={<LogoutOutlined />}
          style={{
            borderRadius: 6,
            height: 32,
            fontSize: 13,
            padding: '0 14px',
          }}
          className="hover:scale-105 transition-all duration-200"
        >
          Logout
        </Button>
      </div>
    </Header>
  );
};

export default LayoutHeader;
