import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Tag, Alert, Spin, Select, Statistic, Timeline, Empty } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const SecurityInsights = () => {
  const [loading, setLoading] = useState(true);
  const [suspiciousActivities, setSuspiciousActivities] = useState([]);
  const [loginAnalytics, setLoginAnalytics] = useState(null);
  const [days, setDays] = useState(7);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [suspicious, login] = await Promise.all([
        adminService.getSuspiciousActivities(days),
        adminService.getLoginAnalytics(days),
      ]);
      setSuspiciousActivities(suspicious || []);
      setLoginAnalytics(login);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const getSeverityColor = (type) => {
    switch (type) {
      case 'MULTIPLE_FAILED_LOGINS':
        return 'red';
      case 'UNUSUAL_LOGIN_TIME':
        return 'orange';
      case 'SUSPICIOUS_IP':
        return 'volcano';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (type) => {
    switch (type) {
      case 'MULTIPLE_FAILED_LOGINS':
        return <LockOutlined />;
      case 'UNUSUAL_LOGIN_TIME':
        return <ClockCircleOutlined />;
      default:
        return <WarningOutlined />;
    }
  };

  const columns = [
    {
      title: 'User',
      dataIndex: 'userId',
      key: 'userId',
      render: (userId, record) => (
        <div>
          <UserOutlined className="mr-2" />
          <span className="font-medium">{record.email || userId}</span>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={getSeverityColor(type)} icon={getSeverityIcon(type)}>
          {type.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'details',
      key: 'details',
      render: (details) => (
        <span className="text-gray-600">{details}</span>
      ),
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      render: (count) => (
        <Tag color={count > 5 ? 'red' : count > 3 ? 'orange' : 'default'}>
          {count} occurrences
        </Tag>
      ),
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      render: (lastSeen) => new Date(lastSeen).toLocaleString(),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spin size="large" />
      </div>
    );
  }

  const criticalCount = suspiciousActivities.filter(a => a.type === 'MULTIPLE_FAILED_LOGINS').length;
  const warningCount = suspiciousActivities.filter(a => a.type === 'UNUSUAL_LOGIN_TIME').length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Security Insights</h1>
          <p className="text-gray-500">Monitor suspicious activities and security events</p>
        </div>
        <Select value={days} onChange={setDays} style={{ width: 150 }}>
          <Select.Option value={1}>Last 24 hours</Select.Option>
          <Select.Option value={7}>Last 7 days</Select.Option>
          <Select.Option value={14}>Last 14 days</Select.Option>
          <Select.Option value={30}>Last 30 days</Select.Option>
        </Select>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Suspicious Activities"
              value={suspiciousActivities.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: suspiciousActivities.length > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Critical (Failed Logins)"
              value={criticalCount}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: criticalCount > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Warnings (Unusual Time)"
              value={warningCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: warningCount > 0 ? '#faad14' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Login Stats */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={12}>
          <Card title="Login Overview">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Total Logins"
                  value={loginAnalytics?.totalLogins || 0}
                  prefix={<SafetyOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Failed Logins"
                  value={loginAnalytics?.failedLogins || 0}
                  prefix={<LockOutlined />}
                  valueStyle={{ color: loginAnalytics?.failedLogins > 10 ? '#ff4d4f' : '#000' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Security Status">
            {suspiciousActivities.length === 0 ? (
              <Alert
                title="No Suspicious Activities"
                description="No suspicious activities detected in the selected time period."
                type="success"
                showIcon
                icon={<SafetyOutlined />}
              />
            ) : (
              <Alert
                title={`${suspiciousActivities.length} Suspicious Activities Detected`}
                description="Review the activities below and take appropriate action."
                type="warning"
                showIcon
                icon={<WarningOutlined />}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Suspicious Activities Table */}
      <Card title="Suspicious Activities">
        {suspiciousActivities.length > 0 ? (
          <Table
            dataSource={suspiciousActivities}
            columns={columns}
            rowKey={(record) => `${record.userId}-${record.type}`}
            pagination={{ pageSize: 10 }}
          />
        ) : (
          <Empty
            image={<SafetyOutlined style={{ fontSize: 64, color: '#52c41a' }} />}
            description={
              <span className="text-gray-500">
                No suspicious activities detected in the last {days} days
              </span>
            }
          />
        )}
      </Card>
    </div>
  );
};

export default SecurityInsights;
