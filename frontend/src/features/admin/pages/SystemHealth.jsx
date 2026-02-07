import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Progress, Tag, Table, Alert, Spin, Button, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  CloudServerOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const SystemHealth = () => {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      setRefreshing(true);
      const [report, uptime, alerts] = await Promise.all([
        adminService.getHealthReport(),
        adminService.getUptimeStats(),
        adminService.getAlertHistory(20),
      ]);
      setHealthData({ report, uptime, alerts });
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleOutlined className="text-green-500" />;
      case 'degraded':
        return <WarningOutlined className="text-yellow-500" />;
      case 'unhealthy':
        return <CloseCircleOutlined className="text-red-500" />;
      default:
        return <ClockCircleOutlined className="text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'unhealthy':
        return 'error';
      default:
        return 'default';
    }
  };

  const serviceColumns = [
    {
      title: 'Service',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <span className="font-medium">
          {name.includes('Database') && <DatabaseOutlined className="mr-2" />}
          {name.includes('Cache') && <CloudServerOutlined className="mr-2" />}
          {name.includes('WebSocket') && <ApiOutlined className="mr-2" />}
          {name}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Latency',
      dataIndex: 'latency',
      key: 'latency',
      render: (latency) => (latency ? `${latency}ms` : '-'),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
  ];

  const alertColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag>{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity) => (
        <Tag color={severity === 'critical' ? 'red' : 'orange'}>
          {severity.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp) => new Date(timestamp).toLocaleString(),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  const { report, uptime, alerts } = healthData || {};

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Health</h1>
          <p className="text-gray-500">Monitor system status and performance</p>
        </div>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={fetchHealthData}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="System Status"
              value={report?.status?.toUpperCase() || 'UNKNOWN'}
              prefix={getStatusIcon(report?.status)}
              styles={{
                content: {
                  color:
                    report?.status === 'healthy'
                      ? '#52c41a'
                      : report?.status === 'degraded'
                      ? '#faad14'
                      : '#ff4d4f',
                },
              }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={uptime?.formatted || 'N/A'}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Active Alerts"
              value={report?.alerts?.length || 0}
              prefix={<WarningOutlined />}
              styles={{
                content: { color: report?.alerts?.length > 0 ? '#ff4d4f' : '#52c41a' },
              }}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Services Up"
              value={`${report?.services?.filter((s) => s.status === 'healthy').length || 0}/${
                report?.services?.length || 0
              }`}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Resource Usage */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card title="CPU Usage">
            <Progress
              type="dashboard"
              percent={Math.round(report?.metrics?.cpu?.usage || 0)}
              status={
                report?.metrics?.cpu?.usage > 90
                  ? 'exception'
                  : report?.metrics?.cpu?.usage > 70
                  ? 'active'
                  : 'success'
              }
            />
            <div className="text-center mt-2 text-gray-500">
              {report?.metrics?.cpu?.cores} cores - {report?.metrics?.cpu?.model?.substring(0, 30)}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Memory Usage">
            <Progress
              type="dashboard"
              percent={Math.round(report?.metrics?.memory?.usagePercent || 0)}
              status={
                report?.metrics?.memory?.usagePercent > 90
                  ? 'exception'
                  : report?.metrics?.memory?.usagePercent > 75
                  ? 'active'
                  : 'success'
              }
            />
            <div className="text-center mt-2 text-gray-500">
              {((report?.metrics?.memory?.used || 0) / 1024 / 1024 / 1024).toFixed(1)} GB /{' '}
              {((report?.metrics?.memory?.total || 0) / 1024 / 1024 / 1024).toFixed(1)} GB
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Process Memory">
            <Progress
              type="dashboard"
              percent={Math.round(
                ((report?.metrics?.process?.memoryUsage?.heapUsed || 0) /
                  (report?.metrics?.process?.memoryUsage?.heapTotal || 1)) *
                  100
              )}
              status="success"
            />
            <div className="text-center mt-2 text-gray-500">
              Heap: {((report?.metrics?.process?.memoryUsage?.heapUsed || 0) / 1024 / 1024).toFixed(0)} MB
            </div>
          </Card>
        </Col>
      </Row>

      {/* Services Status */}
      <Card title="Service Status" className="mb-6">
        <Table
          dataSource={report?.services || []}
          columns={serviceColumns}
          rowKey="name"
          pagination={false}
        />
      </Card>

      {/* Recent Alerts */}
      <Card title="Recent Alerts">
        {alerts?.length > 0 ? (
          <Table
            dataSource={alerts}
            columns={alertColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Alert
            title="No Recent Alerts"
            description="System is operating normally with no recent alerts."
            type="success"
            showIcon
          />
        )}
      </Card>
    </div>
  );
};

export default SystemHealth;
