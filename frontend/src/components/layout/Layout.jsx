import React, { useState, useEffect, useMemo } from 'react';
import { Layout, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import useBreakpoint from 'antd/es/grid/hooks/useBreakpoint';

// Layout Components
import SidebarLogo from './SidebarLogo';
import SidebarMenu from './SidebarMenu';
import LayoutHeader from './LayoutHeader';
import LogoutModal from './LogoutModal';
import SessionExpiryModal from './SessionExpiryModal';
import SystemAlertModal from './SystemAlertModal';
import UserProfile from '../UserProfile';

// Config
import { getMenuSectionsForRole } from './config/menuConfig.jsx';

// Hooks & Utils
import { useTheme } from '../../contexts/ThemeContext';
import { useTokenMonitor } from '../../hooks/useTokenMonitor';
import { LogoutReason } from '../../utils/authUtils';
import { getTokenPayload, tokenStorage } from '../../utils/tokenManager';

const { Sider, Content } = Layout;

const Layouts = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const screens = useBreakpoint();
  const { darkMode, toggleTheme, ref } = useTheme();
  const { logout, sessionInfo, isExpiring, extendSession } = useTokenMonitor({
    enabled: true,
    warningMinutes: 5,
    showWarning: true,
    trackActivity: true,
  });

  // Get user from token - memoized to avoid parsing localStorage/JWT on every render
  const userInfo = useMemo(() => {
    try {
      const token = tokenStorage.getToken();
      if (!token) return { role: null, name: 'User' };
      const payload = getTokenPayload(token);
      return {
        role: payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null),
        name: payload?.name || payload?.email || 'User',
      };
    } catch {
      return { role: null, name: 'User' };
    }
  }, [sessionInfo?.token]); // Recalculate when token changes

  const { role, name } = userInfo;
  const sections = getMenuSectionsForRole(role);

  // Logout handlers
  const showLogoutConfirm = () => setLogoutModalVisible(true);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout(LogoutReason.MANUAL);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleLogoutCancel = () => setLogoutModalVisible(false);

  return (
    <Layout className="h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      {screens.lg ? (
        <Sider
          width={250}
          collapsedWidth={72}
          collapsible
          theme="dark"
          className="hide-scrollbar sidebar-enhanced h-full z-50 overflow-hidden"
          collapsed={collapsed}
          trigger={null}
          style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            position: 'sticky',
            top: 0,
            left: 0,
            height: '100vh',
          }}
        >
          <div className="flex flex-col h-full">
            <SidebarLogo collapsed={collapsed} role={role} />
            <SidebarMenu sections={sections} collapsed={collapsed} isMobile={false} />
          </div>
        </Sider>
      ) : (
        /* Mobile Drawer */
        <Drawer
          placement="left"
          closable
          onClose={() => setMobileOpen(false)}
          open={mobileOpen}
          styles={{
            wrapper: { width: 260 },
            body: {
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, #001529 0%, #002140 100%)',
            },
            header: {
              background: '#001529',
              borderBottom: 'none',
            },
            content: { maxWidth: '85vw' },
          }}
          classNames={{
            wrapper: 'shadow-2xl',
          }}
          title={
            <span className="font-bold text-base text-white">Navigation</span>
          }
        >
          <div className="flex flex-col h-full">
            <SidebarLogo collapsed={false} role={role} />
            <SidebarMenu
              sections={sections}
              collapsed={false}
              isMobile={true}
              onMobileClose={() => setMobileOpen(false)}
            />
          </div>
        </Drawer>
      )}

      <Layout
        className={`
          transition-all duration-300 ease-in-out
          bg-background
          min-h-screen
        `}
      >
        {/* Header */
          }
        <LayoutHeader
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onMobileOpen={() => setMobileOpen(true)}
          isDesktop={screens.lg}
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          themeRef={ref}
          onProfileClick={() => setProfileModalVisible(true)}
          onLogoutClick={showLogoutConfirm}
        />

        {/* Main Content */}
        <Content
          className="overflow-auto hide-scrollbar transition-colors duration-300"
          style={{
            minHeight: 'calc(100vh - 52px)',
          }}
        >
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* User Profile Modal */}
      <UserProfile visible={profileModalVisible} onClose={() => setProfileModalVisible(false)} />

      {/* Logout Confirmation Modal */}
      <LogoutModal
        visible={logoutModalVisible}
        onCancel={handleLogoutCancel}
        onConfirm={handleLogout}
        loading={loggingOut}
        userName={name}
        role={role}
        sessionInfo={sessionInfo}
        darkMode={darkMode}
      />

      {/* Session Expiry Warning Modal */}
      <SessionExpiryModal
        visible={isExpiring}
        sessionInfo={sessionInfo}
        onExtend={extendSession}
        onLogout={() => logout(LogoutReason.MANUAL)}
      />

      {/* System Alert Modal */}
      <SystemAlertModal />
    </Layout>
  );
};

export default Layouts;