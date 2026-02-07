import React, { useState } from 'react';
import { Row, Col, Card, Progress, Tag, Button, Statistic, Typography, Tooltip, Badge, Popconfirm, message } from 'antd';
import {
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  HddOutlined,
  ClockCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const { Text } = Typography;

const SystemOverview = ({ health, metrics, onRefresh, refreshing, connected, lastUpdate }) => {
  const [clearingCache, setClearingCache] = useState(false);

  const handleClearCache = async () => {
    try {
      setClearingCache(true);
      await adminService.clearCache({ refreshConfigCache: true });
      message.success('Cache cleared successfully');
      onRefresh?.();
    } catch (error) {
      message.error('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };
  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircleOutlined className="text-success text-xl" />;
      case 'degraded':
        return <WarningOutlined className="text-warning text-xl" />;
      case 'unhealthy':
      case 'down':
        return <CloseCircleOutlined className="text-error text-xl" />;
      default:
        return <WarningOutlined className="text-text-tertiary text-xl" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatUptime = (seconds) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    const now = new Date();
    const diff = Math.floor((now - new Date(lastUpdate)) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return new Date(lastUpdate).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Header with Connection Status and Refresh */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Tooltip title={connected ? 'Real-time updates active' : 'Using HTTP polling'}>
            <Badge
              status={connected ? 'processing' : 'default'}
              text={
                <span className="flex items-center gap-1 text-text-secondary">
                  {connected ? (
                    <>
                      <WifiOutlined className="text-success" />
                      <span>Live</span>
                    </>
                  ) : (
                    <>
                      <DisconnectOutlined className="text-text-tertiary" />
                      <span>Polling</span>
                    </>
                  )}
                </span>
              }
            />
          </Tooltip>
          <Text className="text-text-secondary">
            Updated: {formatLastUpdate()}
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={onRefresh}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card className="shadow-sm border-border rounded-2xl bg-surface">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon(health?.status)}
            <div>
              <Text strong className="text-lg text-text-primary block">
                System Status
              </Text>
              <Tag color={getStatusColor(health?.status)} className="mt-1">
                {health?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-text-tertiary" />
            <Text className="text-text-secondary">
              Uptime: {formatUptime(health?.uptime || metrics?.application?.uptime)}
            </Text>
          </div>
        </div>
      </Card>

      {/* Service Status Cards */}
      <Row gutter={[16, 16]}>
        {/* MongoDB Status */}
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DatabaseOutlined className="text-green-500 text-xl" />
              </div>
              <Text strong className="text-text-primary">MongoDB</Text>
            </div>
            <div className="flex items-center justify-between">
              {getStatusIcon(health?.services?.mongodb?.status)}
              <Tag color={getStatusColor(health?.services?.mongodb?.status)}>
                {health?.services?.mongodb?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </div>
            {health?.services?.mongodb?.responseTime !== undefined && (
              <Text className="text-text-tertiary text-sm mt-2 block">
                Response: {health.services.mongodb.responseTime}ms
              </Text>
            )}
          </Card>
        </Col>

        {/* Redis Status */}
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <CloudServerOutlined className="text-red-500 text-xl" />
              </div>
              <div className="flex items-center justify-between w-full">
                <Text strong className="text-text-primary">Redis/Cache</Text>
                <Popconfirm
                  title="Clear cache?"
                  description="This will flush Redis and local cache."
                  onConfirm={handleClearCache}
                  okText="Clear"
                  okButtonProps={{ danger: true }}
                >
                  <Button size="small" danger loading={clearingCache}>
                    Clear
                  </Button>
                </Popconfirm>
              </div>
            </div>
            <div className="flex items-center justify-between">
              {getStatusIcon(health?.services?.redis?.status)}
              <Tag color={getStatusColor(health?.services?.redis?.status)}>
                {health?.services?.redis?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </div>
            {health?.services?.redis?.responseTime !== undefined && (
              <Text className="text-text-tertiary text-sm mt-2 block">
                Response: {health.services.redis.responseTime}ms
              </Text>
            )}
          </Card>
        </Col>

        {/* MinIO Status */}
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <HddOutlined className="text-orange-500 text-xl" />
              </div>
              <Text strong className="text-text-primary">MinIO Storage</Text>
            </div>
            <div className="flex items-center justify-between">
              {getStatusIcon(health?.services?.minio?.status)}
              <Tag color={getStatusColor(health?.services?.minio?.status)}>
                {health?.services?.minio?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </div>
            {health?.services?.minio?.responseTime !== undefined && (
              <Text className="text-text-tertiary text-sm mt-2 block">
                Response: {health.services.minio.responseTime}ms
              </Text>
            )}
          </Card>
        </Col>

        {/* System/Server Status */}
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <CloudServerOutlined className="text-blue-500 text-xl" />
              </div>
              <Text strong className="text-text-primary">Server</Text>
            </div>
            <div className="flex items-center justify-between">
              {getStatusIcon(health?.services?.system?.status)}
              <Tag color={getStatusColor(health?.services?.system?.status)}>
                {health?.services?.system?.status?.toUpperCase() || 'UNKNOWN'}
              </Tag>
            </div>
            <Tooltip title={health?.services?.system?.platform || health?.system?.platform}>
              <Text className="text-text-tertiary text-sm mt-2 block truncate">
                {health?.services?.system?.platform || health?.system?.platform || 'N/A'}
              </Text>
            </Tooltip>
          </Card>
        </Col>
      </Row>

      {/* System Metrics */}
      <Row gutter={[16, 16]}>
        {/* CPU Usage */}
        <Col xs={24} md={8}>
          <Card
            title={
              <span className="text-text-primary font-medium">CPU Usage</span>
            }
            className="shadow-sm border-border rounded-xl bg-surface"
          >
            <div className="text-center">
              <Progress
                type="dashboard"
                percent={Math.round(metrics?.cpu?.usage || 0)}
                strokeColor={
                  (metrics?.cpu?.usage || 0) > 80
                    ? 'rgb(var(--color-error))'
                    : (metrics?.cpu?.usage || 0) > 60
                      ? 'rgb(var(--color-warning))'
                      : 'rgb(var(--color-success))'
                }
                size={120}
              />
              <Text className="text-text-secondary block mt-2">
                {metrics?.cpu?.cores || 0} cores
              </Text>
              {metrics?.cpu?.model && (
                <Tooltip title={metrics.cpu.model}>
                  <Text className="text-text-tertiary text-xs block truncate">
                    {metrics.cpu.model.substring(0, 30)}...
                  </Text>
                </Tooltip>
              )}
            </div>
          </Card>
        </Col>

        {/* Memory Usage */}
        <Col xs={24} md={8}>
          <Card
            title={
              <span className="text-text-primary font-medium">Memory Usage</span>
            }
            className="shadow-sm border-border rounded-xl bg-surface"
          >
            <div className="text-center">
              <Progress
                type="dashboard"
                percent={Math.round(metrics?.memory?.usagePercent || 0)}
                strokeColor={
                  (metrics?.memory?.usagePercent || 0) > 80
                    ? 'rgb(var(--color-error))'
                    : (metrics?.memory?.usagePercent || 0) > 60
                      ? 'rgb(var(--color-warning))'
                      : 'rgb(var(--color-success))'
                }
                size={120}
              />
              <Text className="text-text-secondary block mt-2">
                {formatBytes(metrics?.memory?.used)} / {formatBytes(metrics?.memory?.total)}
              </Text>
              <Text className="text-text-tertiary text-xs block">
                Heap: {formatBytes(metrics?.memory?.heapUsed)} / {formatBytes(metrics?.memory?.heapTotal)}
              </Text>
            </div>
          </Card>
        </Col>

        {/* Disk Usage */}
        <Col xs={24} md={8}>
          <Card
            title={
              <span className="text-text-primary font-medium">Disk Usage</span>
            }
            className="shadow-sm border-border rounded-xl bg-surface"
          >
            <div className="text-center">
              <Progress
                type="dashboard"
                percent={Math.round(metrics?.disk?.usagePercent || 0)}
                strokeColor={
                  (metrics?.disk?.usagePercent || 0) > 80
                    ? 'rgb(var(--color-error))'
                    : (metrics?.disk?.usagePercent || 0) > 60
                      ? 'rgb(var(--color-warning))'
                      : 'rgb(var(--color-success))'
                }
                size={120}
              />
              <Text className="text-text-secondary block mt-2">
                {formatBytes(metrics?.disk?.used)} / {formatBytes(metrics?.disk?.total)}
              </Text>
              <Text className="text-text-tertiary text-xs block">
                Free: {formatBytes(metrics?.disk?.free)}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Total Users"
              value={metrics?.database?.totalUsers || 0}
              className="text-text-primary"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Active Sessions"
              value={metrics?.sessions?.active || 0}
              className="text-text-primary"
              suffix={
                <Tooltip title="Sessions in last 24h">
                  <Text className="text-xs text-text-tertiary">
                    ({metrics?.sessions?.last24h || 0} today)
                  </Text>
                </Tooltip>
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Institutions"
              value={metrics?.database?.totalInstitutions || 0}
              className="text-text-primary"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-border rounded-xl bg-surface text-center">
            <Statistic
              title="Students"
              value={metrics?.database?.totalStudents || 0}
              className="text-text-primary"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemOverview;
