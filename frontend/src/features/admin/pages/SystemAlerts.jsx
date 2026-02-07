import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Spin, Button, Empty, Space, Select, Statistic, Row, Col } from 'antd';
import {
  AlertOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';
import { useWebSocket } from '../../../hooks/useWebSocket';

const SystemAlerts = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [limit, setLimit] = useState(50);
  const { on, off } = useWebSocket();

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAlertHistory(limit);
      setAlerts(data || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Listen for real-time alerts
    const handleNewAlert = (data) => {
      if (data.alerts) {
        setAlerts((prev) => [...data.alerts, ...prev].slice(0, limit));
      }
    };

    on('healthAlert', handleNewAlert);

    return () => {
      off('healthAlert', handleNewAlert);
    };
  }, [limit]);

  const getSeverityConfig = (severity) => {
    switch (severity) {
      case 'critical':
        return { color: 'red', icon: <ExclamationCircleOutlined /> };
      case 'warning':
        return { color: 'orange', icon: <WarningOutlined /> };
      default:
        return { color: 'blue', icon: <AlertOutlined /> };
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'cpu':
        return '🖥️';
      case 'memory':
        return '💾';
      case 'disk':
        return '💿';
      case 'service':
        return '⚙️';
      case 'database':
        return '🗄️';
      case 'cache':
        return '📦';
      default:
        return '⚠️';
    }
  };

  const columns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp) => (
        <span className="text-gray-600">
          <ClockCircleOutlined className="mr-2" />
          {new Date(timestamp).toLocaleString()}
        </span>
      ),
      sorter: (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => (
        <Tag>
          {getTypeIcon(type)} {type.toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'CPU', value: 'cpu' },
        { text: 'Memory', value: 'memory' },
        { text: 'Disk', value: 'disk' },
        { text: 'Service', value: 'service' },
        { text: 'Database', value: 'database' },
        { text: 'Cache', value: 'cache' },
      ],
      onFilter: (value, record) => record.type === value,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 120,
      render: (severity) => {
        const config = getSeverityConfig(severity);
        return (
          <Tag color={config.color} icon={config.icon}>
            {severity.toUpperCase()}
          </Tag>
        );
      },
      filters: [
        { text: 'Critical', value: 'critical' },
        { text: 'Warning', value: 'warning' },
      ],
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (message) => <span>{message}</span>,
    },
    {
      title: 'Value',
      key: 'value',
      width: 120,
      render: (_, record) =>
        record.value !== undefined ? (
          <span>
            {record.value.toFixed(1)}
            {record.threshold && (
              <span className="text-gray-400"> / {record.threshold}</span>
            )}
          </span>
        ) : (
          '-'
        ),
    },
  ];

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Alerts</h1>
          <p className="text-gray-500">View system health alerts and warnings</p>
        </div>
        <Space>
          <Select value={limit} onChange={setLimit} style={{ width: 150 }}>
            <Select.Option value={20}>Last 20 alerts</Select.Option>
            <Select.Option value={50}>Last 50 alerts</Select.Option>
            <Select.Option value={100}>Last 100 alerts</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchAlerts}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Alerts"
              value={alerts.length}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Critical"
              value={criticalCount}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: criticalCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Warnings"
              value={warningCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: warningCount > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Alerts Table */}
      <Card>
        {alerts.length > 0 ? (
          <Table
            dataSource={alerts}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20 }}
            rowClassName={(record) =>
              record.severity === 'critical' ? 'bg-red-50' : ''
            }
          />
        ) : (
          <Empty
            image={<CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
            description={
              <span className="text-gray-500">
                No alerts recorded. System is operating normally.
              </span>
            }
          />
        )}
      </Card>
    </div>
  );
};

export default SystemAlerts;
