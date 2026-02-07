import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Spin, Select, DatePicker, Tag, Tooltip } from 'antd';
import {
  UserOutlined,
  LoginOutlined,
  RiseOutlined,
  TeamOutlined,
  BankOutlined,
  WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { adminService } from '../../../services/admin.service';

const { RangePicker } = DatePicker;

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [loginAnalytics, setLoginAnalytics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboard, login, systemTrends] = await Promise.all([
        adminService.getDashboardSummary(),
        adminService.getLoginAnalytics(days),
        adminService.getSystemTrends(days),
      ]);
      setDashboardData(dashboard);
      setLoginAnalytics(login);
      setTrends(systemTrends);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [days]);

  const roleColumns = [
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => <Tag color="blue">{role}</Tag>,
    },
    {
      title: 'Logins',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
  ];

  const hourlyColumns = [
    {
      title: 'Hour',
      dataIndex: 'hour',
      key: 'hour',
      render: (hour) => `${hour}:00 - ${hour + 1}:00`,
    },
    {
      title: 'Logins',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
  ];

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
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-500">System-wide analytics and insights</p>
        </div>
        <Select value={days} onChange={setDays} style={{ width: 150 }}>
          <Select.Option value={7}>Last 7 days</Select.Option>
          <Select.Option value={14}>Last 14 days</Select.Option>
          <Select.Option value={30}>Last 30 days</Select.Option>
          <Select.Option value={90}>Last 90 days</Select.Option>
        </Select>
      </div>

      {/* Summary Stats */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={dashboardData?.users?.total || 0}
              prefix={<UserOutlined />}
              suffix={
                <span className="text-green-500 text-sm">
                  +{dashboardData?.users?.newThisMonth || 0} this month
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={dashboardData?.users?.activeToday || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Institutions"
              value={dashboardData?.institutions?.total || 0}
              prefix={<BankOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Logins"
              value={loginAnalytics?.totalLogins || 0}
              prefix={<LoginOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Login Analytics */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={8}>
          <Card title="Login Statistics" className="h-full">
            <div className="space-y-4">
              <Statistic
                title="Unique Users"
                value={loginAnalytics?.uniqueUsers || 0}
                prefix={<UserOutlined />}
              />
              <Statistic
                title="Failed Logins"
                value={loginAnalytics?.failedLogins || 0}
                prefix={<WarningOutlined />}
                valueStyle={{ color: loginAnalytics?.failedLogins > 10 ? '#ff4d4f' : '#000' }}
              />
              <Statistic
                title="Avg Logins/Day"
                value={(loginAnalytics?.totalLogins / days || 0).toFixed(1)}
                prefix={<ClockCircleOutlined />}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Logins by Role">
            <Table
              dataSource={loginAnalytics?.byRole || []}
              columns={roleColumns}
              rowKey="role"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Peak Hours">
            <Table
              dataSource={(loginAnalytics?.byHour || []).slice(0, 5)}
              columns={hourlyColumns}
              rowKey="hour"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* User Distribution */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} md={12}>
          <Card title="Users by Role">
            <div className="space-y-3">
              {dashboardData?.users?.byRole?.map((item) => (
                <div key={item.role} className="flex justify-between items-center">
                  <Tag color="blue">{item.role}</Tag>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="System Trends">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>User Growth</span>
                <Tag color={trends?.userGrowth?.growthRate > 0 ? 'green' : 'red'}>
                  {trends?.userGrowth?.growthRate > 0 ? '+' : ''}
                  {(trends?.userGrowth?.growthRate || 0).toFixed(1)}%
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span>Session Trend</span>
                <Tag color={trends?.sessionTrend?.averageDaily > 0 ? 'green' : 'default'}>
                  {(trends?.sessionTrend?.averageDaily || 0).toFixed(0)} avg/day
                </Tag>
              </div>
              <div className="flex justify-between items-center">
                <span>Activity Trend</span>
                <Tag color="blue">
                  {(trends?.activityTrend?.averageDaily || 0).toFixed(0)} actions/day
                </Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Activity Stats */}
      <Card title="Activity Overview">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Statistic
              title="Total Actions (Period)"
              value={dashboardData?.activity?.totalActions || 0}
              prefix={<RiseOutlined />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="Today's Actions"
              value={dashboardData?.activity?.todayActions || 0}
              prefix={<ClockCircleOutlined />}
            />
          </Col>
          <Col xs={24} sm={8}>
            <Statistic
              title="This Week's Actions"
              value={dashboardData?.activity?.weekActions || 0}
              prefix={<RiseOutlined />}
            />
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
