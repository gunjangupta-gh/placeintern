import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
  Input,
  Modal,
  Tooltip,
  Badge,
} from 'antd';
import { toast } from 'react-hot-toast';
import {
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  DesktopOutlined,
  MobileOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  SearchOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const { Text } = Typography;

const ActiveSessions = ({ realtimeStats, connected, onRefreshSessions }) => {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filters, setFilters] = useState({ userId: '', institutionId: '' });
  const [terminateAllModalOpen, setTerminateAllModalOpen] = useState(false);
  const [terminatingAll, setTerminatingAll] = useState(false);

  const fetchSessions = useCallback(async (page = 1, limit = 50) => {
    try {
      setLoading(true);
      const [sessionsData, statsData] = await Promise.all([
        adminService.getActiveSessions({ page, limit, ...filters }),
        adminService.getSessionStats(),
      ]);
      setSessions(sessionsData.sessions || []);
      setStats(statsData);
      setPagination({
        current: sessionsData.page || 1,
        pageSize: sessionsData.limit || 50,
        total: sessionsData.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleTableChange = (paginationConfig) => {
    fetchSessions(paginationConfig.current, paginationConfig.pageSize);
  };

  const handleTerminateSession = async (id) => {
    try {
      await adminService.terminateSession(id);
      toast.success('Session terminated');
      fetchSessions();
      // Trigger real-time update via WebSocket
      if (onRefreshSessions) onRefreshSessions();
    } catch (error) {
      console.error('Failed to terminate session:', error);
      toast.error('Failed to terminate session');
    }
  };

  const handleTerminateUserSessions = async (userId) => {
    try {
      await adminService.terminateUserSessions(userId);
      toast.success('All user sessions terminated');
      fetchSessions();
      // Trigger real-time update via WebSocket
      if (onRefreshSessions) onRefreshSessions();
    } catch (error) {
      console.error('Failed to terminate user sessions:', error);
      toast.error('Failed to terminate user sessions');
    }
  };

  const handleTerminateAllSessions = async () => {
    try {
      setTerminatingAll(true);
      await adminService.terminateAllSessions({ exceptCurrent: true });
      toast.success('All sessions terminated');
      setTerminateAllModalOpen(false);
      fetchSessions();
      // Trigger real-time update via WebSocket
      if (onRefreshSessions) onRefreshSessions();
    } catch (error) {
      console.error('Failed to terminate all sessions:', error);
      toast.error('Failed to terminate all sessions');
    } finally {
      setTerminatingAll(false);
    }
  };

  const getDeviceIcon = (userAgent) => {
    if (!userAgent) return <DesktopOutlined />;
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return <MobileOutlined />;
    }
    return <DesktopOutlined />;
  };

  const getRoleColor = (role) => {
    const colors = {
      SYSTEM_ADMIN: 'red',
      STATE_DIRECTORATE: 'purple',
      PRINCIPAL: 'blue',
      FACULTY: 'cyan',
      FACULTY_SUPERVISOR: 'cyan',
      TEACHER: 'geekblue',
      STUDENT: 'green',
      INDUSTRY: 'orange',
      INDUSTRY_PARTNER: 'orange',
    };
    return colors[role] || 'default';
  };

  const formatRelativeTime = (date) => {
    if (!date) return 'N/A';
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <UserOutlined className="text-primary" />
          </div>
          <div>
            <Text strong className="block">{record.userName}</Text>
            <Text className="text-text-tertiary text-sm">{record.userEmail}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'userRole',
      key: 'userRole',
      width: 140,
      render: (role) => <Tag color={getRoleColor(role)}>{role}</Tag>,
    },
    {
      title: 'Institution',
      dataIndex: 'institutionName',
      key: 'institutionName',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Device',
      key: 'device',
      width: 150,
      render: (_, record) => (
        <div className="flex items-center gap-2">
          {getDeviceIcon(record.userAgent)}
          <div className="flex flex-col">
            <Text className="text-xs text-text-tertiary">
              {record.deviceInfo?.browser || 'Unknown'}
            </Text>
            <Text className="text-xs text-text-tertiary">
              {record.deviceInfo?.os || 'Unknown OS'}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 130,
      render: (ip) => (
        <span className="flex items-center gap-1">
          <GlobalOutlined className="text-text-tertiary" />
          <Text className="text-sm">{ip || 'N/A'}</Text>
        </span>
      ),
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      width: 120,
      render: (date) => (
        <span className="flex items-center gap-1">
          <ClockCircleOutlined className="text-text-tertiary" />
          <Text className="text-sm">{formatRelativeTime(date)}</Text>
        </span>
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 140,
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Popconfirm
            title="Terminate this session?"
            description="The user will be logged out immediately."
            onConfirm={() => handleTerminateSession(record.id)}
            okText="Terminate"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Terminate
            </Button>
          </Popconfirm>
          <Popconfirm
            title="Terminate all sessions for this user?"
            description="The user will be logged out from all devices."
            onConfirm={() => handleTerminateUserSessions(record.userId)}
            okText="Terminate All"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger>
              All
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Use real-time stats when available, fall back to HTTP fetched stats
  const displayStats = realtimeStats || stats;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex justify-between items-center">
        <Tooltip title={connected ? 'Real-time updates active' : 'Using HTTP polling'}>
          <Badge
            status={connected ? 'processing' : 'default'}
            text={
              <span className="flex items-center gap-1 text-text-secondary">
                {connected ? (
                  <>
                    <WifiOutlined className="text-success" />
                    <span>Live Updates</span>
                  </>
                ) : (
                  <>
                    <DisconnectOutlined className="text-text-tertiary" />
                    <span>Manual Refresh</span>
                  </>
                )}
              </span>
            }
          />
        </Tooltip>
      </div>

      {/* Stats Row */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Total Active"
              value={displayStats?.totalActive || 0}
              valueStyle={{ color: 'rgb(var(--color-success))' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Last 24 Hours"
              value={displayStats?.sessionsLast24h || 0}
              valueStyle={{ color: 'rgb(var(--color-primary))' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Last 7 Days"
              value={displayStats?.sessionsLast7d || 0}
              valueStyle={{ color: 'rgb(var(--color-info))' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Active Users"
              value={pagination.total}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and Actions */}
      <Card className="shadow-sm border-border rounded-xl bg-surface">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Filter by User ID"
              allowClear
              onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
              style={{ width: 200 }}
              prefix={<SearchOutlined className="text-text-tertiary" />}
            />
            <Input
              placeholder="Filter by Institution ID"
              allowClear
              onChange={(e) => setFilters((prev) => ({ ...prev, institutionId: e.target.value }))}
              style={{ width: 200 }}
            />
            <Button onClick={() => fetchSessions()}>Apply Filters</Button>
          </div>
          <div className="flex gap-2">
            <Button
              danger
              icon={<WarningOutlined />}
              onClick={() => setTerminateAllModalOpen(true)}
            >
              Terminate All Sessions
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => fetchSessions()}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Sessions Table */}
      <Card className="shadow-sm border-border rounded-2xl bg-surface">
        <Table
          columns={columns}
          dataSource={sessions}
          loading={loading}
          rowKey="id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} active sessions`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* Terminate All Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-error">
            <WarningOutlined />
            <span>Terminate All Sessions</span>
          </div>
        }
        open={terminateAllModalOpen}
        onCancel={() => setTerminateAllModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setTerminateAllModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="terminate"
            type="primary"
            danger
            loading={terminatingAll}
            onClick={handleTerminateAllSessions}
          >
            Confirm Terminate All
          </Button>,
        ]}
      >
        <div className="py-4">
          <Text className="text-text-primary block mb-4">
            Are you sure you want to terminate all active sessions?
          </Text>
          <Text type="danger" className="block">
            <strong>Warning:</strong> This will log out all users from the system except your
            current session. This action cannot be undone.
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default ActiveSessions;
