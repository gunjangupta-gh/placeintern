import React, { useState } from 'react';
import { Tabs, Spin, Typography } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import SystemOverview from './components/SystemOverview';
import DatabaseManagement from './components/DatabaseManagement';
import UserManagement from './components/UserManagement';
import ActiveSessions from './components/ActiveSessions';
import { useMetricsSocket } from './hooks/useMetricsSocket';

const { Text } = Typography;

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  // Use WebSocket hook for real-time metrics with HTTP polling fallback
  const {
    health,
    metrics,
    sessionStats,
    backupProgress,
    restoreProgress,
    bulkOperationProgress,
    connected,
    loading,
    lastUpdate,
    refresh,
    refreshSessions,
  } = useMetricsSocket({ autoConnect: true, fallbackToPolling: true });

  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    // Brief delay to show refresh animation
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-background-secondary gap-4">
        <Spin size="large" />
        <Text className="text-text-secondary animate-pulse">Loading admin dashboard...</Text>
      </div>
    );
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span className="flex items-center gap-2">
          <DashboardOutlined />
          System Overview
        </span>
      ),
      children: (
        <SystemOverview
          health={health}
          metrics={metrics}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          connected={connected}
          lastUpdate={lastUpdate}
        />
      ),
    },
    {
      key: 'database',
      label: (
        <span className="flex items-center gap-2">
          <DatabaseOutlined />
          Database Management
        </span>
      ),
      children: <DatabaseManagement backupProgress={backupProgress} restoreProgress={restoreProgress} connected={connected} />,
    },
    {
      key: 'users',
      label: (
        <span className="flex items-center gap-2">
          <TeamOutlined />
          User Management
        </span>
      ),
      children: <UserManagement bulkOperationProgress={bulkOperationProgress} connected={connected} />,
    },
    {
      key: 'sessions',
      label: (
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined />
          Active Sessions
        </span>
      ),
      children: (
        <ActiveSessions
          realtimeStats={sessionStats}
          connected={connected}
          onRefreshSessions={refreshSessions}
        />
      ),
    },
  ];

  return (
    <div className="admin-dashboard p-4 md:p-6 bg-background-secondary min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary mb-2">System Administration</h1>
        <p className="text-text-secondary">
          Monitor system health, manage backups, users, and active sessions
        </p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="admin-tabs"
        size="large"
      />
    </div>
  );
};

export default AdminDashboard;
