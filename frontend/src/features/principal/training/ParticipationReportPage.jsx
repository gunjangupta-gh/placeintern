import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, Card, Col, DatePicker, Empty, Progress, Row, Select, Space, Statistic, Table, Tabs, Typography } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  RiseOutlined,
  UserOutlined,
  BookOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import {
  fetchPrincipalTrainingDashboard,
  fetchPrincipalParticipationReport,
} from '../store/principalTrainingSlice';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, subtitle, tone, trend }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <Card className={`rounded-2xl border-border shadow-none h-full hover:shadow-soft transition-shadow ${styles.card}`}
      styles={{ body: { padding: '16px' } }}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <Title level={2} className="!mb-0 !mt-0" style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</Title>
            {trend && (
              <span className={`text-xs flex items-center ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                <RiseOutlined style={{ transform: trend < 0 ? 'rotate(180deg)' : 'none' }} />
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
          <Icon className="text-lg" />
        </div>
      </div>
    </Card>
  );
};

const TopPerformerCard = ({ rank, name, branch, trainings, certificates }) => (
  <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors">
    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
      rank === 1 ? 'bg-yellow-100 text-yellow-600' :
      rank === 2 ? 'bg-gray-100 text-gray-600' :
      rank === 3 ? 'bg-orange-100 text-orange-600' :
      'bg-gray-50 text-gray-500'
    }`}>
      {rank}
    </div>
    <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-700" />
    <div className="flex-1">
      <div className="font-medium">{name}</div>
      <Text type="secondary" className="text-xs">{branch}</Text>
    </div>
    <div className="text-right">
      <div className="text-sm font-medium">{trainings} trainings</div>
      <Text type="secondary" className="text-xs">{certificates} certificates</Text>
    </div>
  </div>
);

const ParticipationReportPage = () => {
  const dispatch = useDispatch();
  const { reports } = useSelector((state) => state.principalTraining);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    dispatch(fetchPrincipalTrainingDashboard());
    dispatch(fetchPrincipalParticipationReport());
  }, [dispatch]);

  const dashboard = reports.dashboard || {};
  const participation = reports.participation || {};

  const stats = [
    {
      title: 'Total Trainings Attended',
      value: dashboard.totalTrainings || 0,
      icon: CalendarOutlined,
      tone: 'primary',
      subtitle: 'by faculty members',
    },
    {
      title: 'Active Participants',
      value: participation.totalParticipants || 0,
      icon: TeamOutlined,
      tone: 'success',
      subtitle: 'unique faculty enrolled',
      trend: 12,
    },
    {
      title: 'Completion Rate',
      value: `${participation.completionRate || 0}%`,
      icon: CheckCircleOutlined,
      tone: 'secondary',
      subtitle: 'of enrolled trainings',
    },
    {
      title: 'Certificates Earned',
      value: participation.certificatesIssued || 0,
      icon: SafetyCertificateOutlined,
      tone: 'warning',
      subtitle: 'total certifications',
    },
  ];

  const branchParticipation = participation.byBranch || [];
  const topPerformers = participation.topPerformers || [];
  const recentActivity = participation.recentActivity || [];

  const branchColumns = [
    {
      title: 'Branch',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <div className="flex items-center gap-2">
          <BookOutlined className="text-blue-700" />
          <span className="font-medium">{name}</span>
        </div>
      ),
    },
    {
      title: 'Faculty Count',
      dataIndex: 'facultyCount',
      key: 'facultyCount',
      width: 120,
      sorter: (a, b) => (a.facultyCount || 0) - (b.facultyCount || 0),
    },
    {
      title: 'Trainings Attended',
      dataIndex: 'trainingsAttended',
      key: 'trainingsAttended',
      width: 160,
      sorter: (a, b) => (a.trainingsAttended || 0) - (b.trainingsAttended || 0),
    },
    {
      title: 'Participation Rate',
      dataIndex: 'participationRate',
      key: 'participationRate',
      width: 200,
      sorter: (a, b) => (a.participationRate || 0) - (b.participationRate || 0),
      render: (rate) => (
        <div className="flex items-center gap-3">
          <Progress
            percent={rate || 0}
            size="small"
            strokeColor={
              rate >= 80 ? '#52c41a' :
              rate >= 50 ? '#faad14' :
              '#ff4d4f'
            }
            showInfo={false}
            className="flex-1"
          />
          <span className="text-xs font-medium w-10">{rate || 0}%</span>
        </div>
      ),
    },
    {
      title: 'Certificates',
      dataIndex: 'certificates',
      key: 'certificates',
      width: 100,
      render: (count) => (
        <span className="flex items-center gap-1">
          <SafetyCertificateOutlined className="text-secondary-700" />
          {count || 0}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={BarChartOutlined}
        title={<span className="training-heading">Participation Report</span>}
        description="Comprehensive analytics on faculty training participation across your institution."
      />

      <Row gutter={[16, 16]} className="mb-6">
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <Tabs
          className="custom-tabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: (
                <span className="flex items-center gap-2">
                  <BarChartOutlined />
                  Overview
                </span>
              ),
              children: (
                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={16}>
                    <Card
                      className="rounded-xl border-border shadow-none"
                      title={
                        <div className="flex items-center gap-2">
                          <BookOutlined className="text-blue-500" />
                          Participation by Branch
                        </div>
                      }
                      styles={{ body: { padding: '16px' } }}
                    >
                      {branchParticipation.length > 0 ? (
                        <Table
                          className="custom-table"
                          rowKey="id"
                          columns={branchColumns}
                          dataSource={branchParticipation}
                          pagination={false}
                          size="small"
                        />
                      ) : (
                        <Empty
                          description="Branch participation data will appear as faculty enroll in trainings"
                          className="py-8"
                        />
                      )}
                    </Card>
                  </Col>
                  <Col xs={24} lg={8}>
                    <Card
                      className="rounded-xl border-border h-full shadow-none"
                      title={
                        <div className="flex items-center gap-2">
                          <TrophyOutlined className="text-yellow-500" />
                          Top Performers
                        </div>
                      }
                      styles={{ body: { padding: '16px' } }}
                    >
                      {topPerformers.length > 0 ? (
                        <div className="space-y-2">
                          {topPerformers.slice(0, 5).map((performer, index) => (
                            <TopPerformerCard
                              key={performer.id}
                              rank={index + 1}
                              name={performer.name}
                              branch={performer.branchName}
                              trainings={performer.trainingsCompleted}
                              certificates={performer.certificates}
                            />
                          ))}
                        </div>
                      ) : (
                        <Empty
                          description="Top performers will appear as faculty complete trainings"
                          className="py-8"
                        />
                      )}
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'activity',
              label: (
                <span className="flex items-center gap-2">
                  <CalendarOutlined />
                  Recent Activity
                </span>
              ),
              children: (
                <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '16px' } }}>
                  {recentActivity.length > 0 ? (
                    <Table
                      className="custom-table"
                      rowKey="id"
                      dataSource={recentActivity}
                      columns={[
                        {
                          title: 'Faculty',
                          key: 'faculty',
                          render: (_, record) => (
                            <div className="flex items-center gap-3">
                              <Avatar icon={<UserOutlined />} className="bg-blue-100 text-blue-700" />
                              <div>
                                <div className="font-medium">{record.userName}</div>
                                <Text type="secondary" className="text-xs">{record.branchName}</Text>
                              </div>
                            </div>
                          ),
                        },
                        {
                          title: 'Training',
                          dataIndex: 'trainingTitle',
                          key: 'training',
                        },
                        {
                          title: 'Activity',
                          dataIndex: 'activityType',
                          key: 'activity',
                          render: (type) => {
                            const config = {
                              ENROLLED: { color: 'blue', label: 'Enrolled' },
                              ATTENDED: { color: 'green', label: 'Attended' },
                              COMPLETED: { color: 'purple', label: 'Completed' },
                              CERTIFIED: { color: 'gold', label: 'Certified' },
                            };
                            const { color, label } = config[type] || { color: 'default', label: type };
                            return <span className={`text-${color}-500`}>{label}</span>;
                          },
                        },
                        {
                          title: 'Date',
                          dataIndex: 'date',
                          key: 'date',
                          render: (date) => new Date(date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }),
                        },
                      ]}
                      pagination={{ pageSize: 10 }}
                    />
                  ) : (
                    <Empty
                      description="Recent training activity will appear here"
                      className="py-12"
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ParticipationReportPage;
