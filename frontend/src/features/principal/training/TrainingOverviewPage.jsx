import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, Input, Row, Statistic, Table, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  FileTextOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchPrincipalTrainings, fetchPrincipalTrainingDashboard, fetchPrincipalParticipationReport } from '../store/principalTrainingSlice';

const { Text } = Typography;

const StatCard = ({ icon: Icon, title, value, color, onClick }) => {
  const colorClasses = {
    blue: { bg: 'bg-gradient-to-br from-blue-50 to-blue-100/50', icon: 'text-blue-600 bg-blue-100', border: 'border-blue-100', text: 'text-blue-700' },
    emerald: { bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100/50', icon: 'text-emerald-600 bg-emerald-100', border: 'border-emerald-100', text: 'text-emerald-700' },
    amber: { bg: 'bg-gradient-to-br from-amber-50 to-amber-100/50', icon: 'text-amber-600 bg-amber-100', border: 'border-amber-100', text: 'text-amber-700' },
    slate: { bg: 'bg-gradient-to-br from-slate-50 to-slate-100/50', icon: 'text-slate-600 bg-slate-100', border: 'border-slate-200', text: 'text-slate-700' },
    violet: { bg: 'bg-gradient-to-br from-violet-50 to-violet-100/50', icon: 'text-violet-600 bg-violet-100', border: 'border-violet-100', text: 'text-violet-700' },
  };
  const styles = colorClasses[color] || colorClasses.blue;
  
  return (
    <div
      className={`${styles.bg} rounded-xl p-2.5 h-full border ${styles.border} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`${styles.icon} p-1.5 rounded-lg`}>
          <Icon className="text-sm" />
        </span>
      </div>
      <Statistic
        title={<span className={`${styles.text} text-[10px] uppercase tracking-wider font-semibold opacity-80`}>{title}</span>}
        value={value}
        valueStyle={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}
      />
    </div>
  );
};

const TrainingOverviewPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings, reports } = useSelector((state) => state.principalTraining);
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState('');

  const isLoading = trainings.loading && !trainings.list;

  useEffect(() => {
    dispatch(fetchPrincipalTrainings());
    dispatch(fetchPrincipalTrainingDashboard());
    dispatch(fetchPrincipalParticipationReport());
  }, [dispatch]);

  const dashboard = reports?.dashboard || {};
  const participation = reports?.participation || {};

  const stats = [
    { title: 'Available Trainings', value: trainings.list?.length || 0, icon: CalendarOutlined, color: 'blue', onClick: () => navigate('/app/training') },
    { title: 'Total Applications', value: participation.totalApplications || 0, icon: FileTextOutlined, color: 'violet', onClick: () => navigate('/app/training/applications') },
    { title: 'Approved', value: participation.byStatus?.APPROVED || 0, icon: CheckCircleOutlined, color: 'emerald', onClick: () => navigate('/app/training/applications') },
    { title: 'Pending Review', value: (participation.byStatus?.PENDING || 0) + (participation.byStatus?.SUBMITTED || 0), icon: ClockCircleOutlined, color: 'amber', onClick: () => navigate('/app/training/applications') },
    { title: 'Faculty Enrolled', value: dashboard.totalParticipants || 0, icon: TeamOutlined, color: 'slate', onClick: () => navigate('/app/training/reports') },
  ];

  const filteredTrainings = (trainings.list || []).filter(
    (t) => !searchText || t.title?.toLowerCase().includes(searchText.toLowerCase())
  );

  const trainingColumns = [
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
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Tooltip title="View">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/app/training/${record.id}`)}
          />
        </Tooltip>
      ),
    },
  ];

  const renderStatSkeletons = () => (
    <Row gutter={[12, 12]} className="mb-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <Col xs={24} sm={12} lg={6} key={idx}>
          <TrainingStatSkeleton />
        </Col>
      ))}
    </Row>
  );



  return (
    <div className="p-4 training-ui">
      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <TrainingGreeting
          userName={user?.name}
          subtitle="Monitor faculty training opportunities and participation across your institution."
        />
      </div>

      {/* Stats Grid */}
      {isLoading ? renderStatSkeletons() : (
        <Row gutter={[12, 12]} className="mb-4">
          {stats.slice(0, 4).map((stat) => (
            <Col xs={24} sm={12} lg={6} key={stat.title}>
              <StatCard {...stat} />
            </Col>
          ))}
        </Row>
      )}

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 0 } }}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Input
              placeholder="Search trainings..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full max-w-md"
              size="middle"
              allowClear
            />
          </div>
          {isLoading ? (
            <TableRowSkeleton rows={5} columns={4} />
          ) : filteredTrainings.length > 0 ? (
            <div className="custom-scrollbar overflow-x-auto">
              <Table
                className="custom-table"
                rowKey="id"
                columns={trainingColumns}
                dataSource={filteredTrainings}
                loading={trainings.loading}
                size="small"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total, range) => <Text className="text-xs">{range[0]}-{range[1]} of {total}</Text>,
                  size: 'small',
                }}
                scroll={{ x: 'max-content' }}
              />
            </div>
          ) : (
            <TrainingEmptyState
              type={searchText ? 'search' : 'calendar'}
              message={searchText ? 'No matching trainings' : 'No trainings'}
              description={searchText ? 'Try adjusting your search.' : 'No training opportunities available.'}
            />
          )}
        </div>
      </Card>
    </div>
  );
};

export default TrainingOverviewPage;
