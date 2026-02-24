import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Table,
  Button,
  Space,
  Badge,
  Spin,
  Alert,
  Tabs,
  message,
} from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  SyncOutlined,
  CalendarOutlined,
  FileDoneOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import trainingCoordinatorService from '../../../services/training-coordinator.service';
import facultyService from '../../../services/faculty.service';

const { Title, Text } = Typography;

const CoordinatorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [facultyData, setFacultyData] = useState(null);
  const [pendingActions, setPendingActions] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [dashboard, faculty, pending] = await Promise.all([
        trainingCoordinatorService.getDashboard(),
        facultyService.getDashboard(),
        trainingCoordinatorService.getPendingActions(),
      ]);

      setDashboardData(dashboard);
      setFacultyData(faculty);
      setPendingActions(pending);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error Loading Dashboard"
        description={error}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={() => fetchData()}>
            Retry
          </Button>
        }
      />
    );
  }

  const stats = dashboardData || {};
  const facultyStats = facultyData || {};
  const pending = pendingActions || {};

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={3} className="!mb-1">
            Coordinator Dashboard
          </Title>
          <Text type="secondary">
            Welcome back, {user?.name || 'Coordinator'}
          </Text>
        </div>
        <Button
          icon={<SyncOutlined spin={refreshing} />}
          onClick={handleRefresh}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {/* Faculty Stats (My Work) */}
      <Title level={5} className="!mb-4">
        My Faculty Tasks
      </Title>
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/assigned-students')}>
            <Statistic
              title="Assigned Students"
              value={facultyStats.totalStudents || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/visit-logs')}>
            <Statistic
              title="Visit Logs"
              value={facultyStats.totalVisits || 0}
              prefix={<FileDoneOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/monthly-reports')}>
            <Statistic
              title="Reports to Review"
              value={facultyStats.pendingReports || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/training')}>
            <Statistic
              title="My Trainings"
              value={facultyStats.trainings || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Coordination Stats */}
      <Title level={5} className="!mb-4">
        Coordination Overview
      </Title>
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/coordinator/applications')}>
            <Statistic
              title="Pending Applications"
              value={stats.pendingApplications || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <Text type="secondary" className="text-xs">
              Faculty training requests
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/coordinator/lesson-plans')}>
            <Statistic
              title="Pending Lesson Plans"
              value={stats.pendingLessonPlans || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#eb2f96' }}
            />
            <Text type="secondary" className="text-xs">
              Awaiting review
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/coordinator/recommendations')}>
            <Statistic
              title="Recommendations"
              value={stats.pendingRecommendations || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
            <Text type="secondary" className="text-xs">
              Training suggestions
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable onClick={() => navigate('/app/coordinator/reminders')}>
            <Statistic
              title="Faculty with Pending Actions"
              value={pending.facultyWithPendingActions || 0}
              prefix={<BellOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
            <Text type="secondary" className="text-xs">
              May need reminders
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Card title="Quick Actions" className="mb-6">
        <Space wrap>
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => navigate('/app/coordinator/applications')}
          >
            Review Applications
          </Button>
          <Button
            icon={<FileDoneOutlined />}
            onClick={() => navigate('/app/coordinator/lesson-plans')}
          >
            Review Lesson Plans
          </Button>
          <Button
            icon={<SendOutlined />}
            onClick={() => navigate('/app/coordinator/reminders')}
          >
            Send Reminders
          </Button>
          <Button
            icon={<CalendarOutlined />}
            onClick={() => navigate('/app/training/calendar')}
          >
            Training Calendar
          </Button>
        </Space>
      </Card>

      {/* Pending Actions Summary */}
      {pending.faculty && pending.faculty.length > 0 && (
        <Card title="Faculty with Pending Actions" className="mb-6">
          <Table
            dataSource={pending.faculty.slice(0, 5)}
            rowKey={(record) => record.user.id}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Faculty',
                dataIndex: ['user', 'name'],
                key: 'name',
                render: (_, record) => (
                  <div>
                    <Text strong>{record.user.name}</Text>
                    <br />
                    <Text type="secondary" className="text-xs">
                      {record.user.branchName || record.user.email}
                    </Text>
                  </div>
                ),
              },
              {
                title: 'Pending Enrollments',
                key: 'enrollments',
                render: (_, record) => (
                  <Badge
                    count={record.pendingEnrollments?.length || 0}
                    showZero
                    style={{ backgroundColor: record.pendingEnrollments?.length > 0 ? '#faad14' : '#d9d9d9' }}
                  />
                ),
              },
              {
                title: 'Pending Tests',
                key: 'tests',
                render: (_, record) => (
                  <Space>
                    <Badge
                      count={record.pendingPreTests?.length || 0}
                      title="Pre-tests"
                      style={{ backgroundColor: record.pendingPreTests?.length > 0 ? '#722ed1' : '#d9d9d9' }}
                    />
                    <Badge
                      count={record.pendingPostTests?.length || 0}
                      title="Post-tests"
                      style={{ backgroundColor: record.pendingPostTests?.length > 0 ? '#52c41a' : '#d9d9d9' }}
                    />
                  </Space>
                ),
              },
              {
                title: 'Pending Lesson Plans',
                key: 'lessonPlans',
                render: (_, record) => (
                  <Badge
                    count={record.pendingLessonPlans?.length || 0}
                    showZero
                    style={{ backgroundColor: record.pendingLessonPlans?.length > 0 ? '#eb2f96' : '#d9d9d9' }}
                  />
                ),
              },
            ]}
          />
          {pending.faculty.length > 5 && (
            <div className="text-center mt-4">
              <Button type="link" onClick={() => navigate('/app/coordinator/reminders')}>
                View All ({pending.faculty.length} faculty)
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default CoordinatorDashboard;
