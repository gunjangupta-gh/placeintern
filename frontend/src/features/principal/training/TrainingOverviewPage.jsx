import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Card, Col, Input, List, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  RightOutlined,
  EyeOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { fetchPrincipalTrainings, fetchPrincipalUpcoming, fetchPrincipalTrainingDashboard } from '../store/principalTrainingSlice';

const { Text, Title } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  info: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, tone, suffix }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  return (
    <Card className={`rounded-2xl border-border shadow-none h-full hover:shadow-soft transition-shadow ${styles.card}`}
      styles={{ body: { padding: '16px' } }}
    >
      <div className="flex items-start justify-between">
        <Statistic
          title={<span className="text-text-secondary text-xs">{title}</span>}
          value={value}
          suffix={suffix}
          valueStyle={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)' }}
        />
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
          <Icon className="text-lg" />
        </div>
      </div>
    </Card>
  );
};

const TrainingCard = ({ training, onClick }) => (
  <Card
    className="rounded-xl border-border shadow-none hover:shadow-sm transition-all cursor-pointer group"
    onClick={onClick}
    hoverable
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-start justify-between mb-3">
      <DeliveryModeBadge mode={training.deliveryMode} />
      <DifficultyBadge level={training.difficulty} showTooltip={false} />
    </div>
    <Title level={5} className="!mb-1 group-hover:text-primary transition-colors">
      {training.title}
    </Title>
    <Text type="secondary" className="text-xs line-clamp-2 mb-3 block">
      {training.description || 'No description provided'}
    </Text>
    <div className="space-y-2">
      <TrainingDateRange startDate={training.startDate} endDate={training.endDate} compact />
      {training.capacity && (
        <CapacityIndicator available={training.availableSeats} total={training.capacity} compact />
      )}
    </div>
    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
      <Text type="secondary" className="text-xs">
        {training.providedBy || 'Training Provider'}
      </Text>
      <RightOutlined className="text-xs text-text-secondary group-hover:text-primary transition-colors" />
    </div>
  </Card>
);

const TrainingOverviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings, upcoming, reports } = useSelector((state) => state.principalTraining);
  const [viewMode, setViewMode] = useState('grid');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');

  useEffect(() => {
    dispatch(fetchPrincipalTrainings());
    dispatch(fetchPrincipalUpcoming());
    dispatch(fetchPrincipalTrainingDashboard());
  }, [dispatch]);

  const dashboard = reports?.dashboard || {};

  const stats = [
    { title: 'Available Trainings', value: trainings.list?.length || 0, icon: CalendarOutlined, tone: 'primary' },
    { title: 'Faculty Enrolled', value: dashboard.totalParticipants || 0, icon: TeamOutlined, tone: 'success' },
    { title: 'Pending Applications', value: dashboard.pendingApplications || 0, icon: FileTextOutlined, tone: 'warning' },
    { title: 'Certificates Earned', value: dashboard.certificatesIssued || 0, icon: SafetyCertificateOutlined, tone: 'info' },
  ];

  const filteredTrainings = (trainings.list || []).filter(
    (t) => !searchText || t.title?.toLowerCase().includes(searchText.toLowerCase())
  );

  const upcomingTrainings = (upcoming.list || []).slice(0, 6);

  const columns = [
    {
      title: 'Training',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text
            className="font-medium cursor-pointer hover:text-primary transition-colors"
            onClick={() => navigate(`/app/training/${record.id}`)}
          >
            {text}
          </Text>
          <div className="text-xs text-text-secondary mt-0.5">
            {record.providedBy || 'Training Provider'}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      width: 180,
      render: (_, record) => (
        <TrainingDateRange startDate={record.startDate} endDate={record.endDate} compact />
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'deliveryMode',
      key: 'deliveryMode',
      width: 120,
      filters: [
        { text: 'Online', value: 'ONLINE' },
        { text: 'In-Person', value: 'OFFLINE' },
        { text: 'Hybrid', value: 'HYBRID' },
      ],
      onFilter: (value, record) => record.deliveryMode === value,
      render: (mode) => <DeliveryModeBadge mode={mode} showIcon={false} />,
    },
    {
      title: 'Capacity',
      key: 'capacity',
      width: 120,
      render: (_, record) => (
        record.capacity ? (
          <CapacityIndicator available={record.availableSeats} total={record.capacity} compact />
        ) : '-'
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/app/training/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={CalendarOutlined}
        title={<span className="training-heading">Training Overview</span>}
        description="Monitor faculty training opportunities and participation from your institution."
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
          tabBarExtraContent={
            <Space>
              <Input
                placeholder="Search trainings..."
                prefix={<SearchOutlined className="text-text-secondary" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-64"
                allowClear
              />
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  { value: 'grid', icon: <AppstoreOutlined /> },
                  { value: 'list', icon: <UnorderedListOutlined /> },
                ]}
              />
            </Space>
          }
          items={[
            {
              key: 'upcoming',
              label: (
                <span className="flex items-center gap-2">
                  <ClockCircleOutlined />
                  Upcoming
                  {upcomingTrainings.length > 0 && (
                    <Badge count={upcomingTrainings.length} size="small" />
                  )}
                </span>
              ),
              children: upcomingTrainings.length > 0 ? (
                viewMode === 'grid' ? (
                  <Row gutter={[16, 16]}>
                    {upcomingTrainings.map((training) => (
                      <Col xs={24} sm={12} lg={8} xl={6} key={training.id}>
                        <TrainingCard
                          training={training}
                          onClick={() => navigate(`/app/training/${training.id}`)}
                        />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Table
                    className="custom-table"
                    rowKey="id"
                    columns={columns}
                    dataSource={upcomingTrainings}
                    pagination={false}
                  />
                )
              ) : (
                <TrainingEmptyState
                  message="No upcoming trainings"
                  description="There are no upcoming training sessions at this time."
                />
              ),
            },
            {
              key: 'all',
              label: (
                <span className="flex items-center gap-2">
                  <CalendarOutlined />
                  All Trainings
                </span>
              ),
              children: filteredTrainings.length > 0 ? (
                viewMode === 'grid' ? (
                  <Row gutter={[16, 16]}>
                    {filteredTrainings.map((training) => (
                      <Col xs={24} sm={12} lg={8} xl={6} key={training.id}>
                        <TrainingCard
                          training={training}
                          onClick={() => navigate(`/app/training/${training.id}`)}
                        />
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Table
                    className="custom-table"
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredTrainings}
                    loading={trainings.loading}
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trainings`,
                    }}
                  />
                )
              ) : (
                <TrainingEmptyState
                  message={searchText ? 'No matching trainings' : 'No trainings available'}
                  description={searchText ? 'Try adjusting your search criteria.' : 'Check back later for new training opportunities.'}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default TrainingOverviewPage;
