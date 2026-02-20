import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Input, Table, Tag, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchPrincipalTrainings, fetchPrincipalTrainingDashboard } from '../store/principalTrainingSlice';

const { Text } = Typography;

const STAT_VARIANTS = {
  blue:   { iconWrap: 'bg-blue-100',   iconColor: 'text-blue-700'   },
  amber:  { iconWrap: 'bg-amber-100',  iconColor: 'text-amber-700'  },
  purple: { iconWrap: 'bg-purple-100', iconColor: 'text-purple-700' },
  emerald:{ iconWrap: 'bg-emerald-100',iconColor: 'text-emerald-700'},
};

const StatCard = ({ icon: Icon, title, value, valueLabel, subtitle, variant = 'blue', onClick }) => {
  const s = STAT_VARIANTS[variant] || STAT_VARIANTS.blue;
  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 ${onClick ? 'cursor-pointer hover:shadow-sm transition-all' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${s.iconWrap}`}>
          <Icon className={`text-xs ${s.iconColor}`} />
        </span>
        <Text className="text-[11px] text-slate-600 font-medium leading-tight">{title}</Text>
      </div>
      <div className="flex items-baseline gap-1.5 mb-0.5">
        <Text className="text-[26px] leading-none font-bold text-slate-800">{value}</Text>
        {valueLabel && <Text className="text-[11px] text-slate-500 font-medium">{valueLabel}</Text>}
      </div>
      {subtitle && <Text className="block text-[11px] text-slate-500 leading-snug mt-1">{subtitle}</Text>}
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
  }, [dispatch]);

  const dashboard = reports?.dashboard || {};

  const trainingMetrics = dashboard.trainingMetrics || {};
  const facultyMetrics = dashboard.facultyMetrics || {};
  const completionMetrics = dashboard.completionMetrics || {};
  const hoursDistribution = dashboard.hoursDistribution || {};

  const statCards = [
    {
      title: 'Trainings',
      icon: CalendarOutlined,
      variant: 'blue',
      value: trainingMetrics.totalTrainingsConducted ?? 0,
      valueLabel: 'conducted',
      subtitle: `Total Faculty: ${trainingMetrics.totalFacultyRegistered ?? 0} • Hours Delivered: ${trainingMetrics.totalTrainingHoursDelivered ?? 0} hrs`,
    },
    {
      title: 'Faculty',
      icon: TeamOutlined,
      variant: 'amber',
      value: facultyMetrics.facultyWithCompletedTrainings ?? 0,
      valueLabel: 'completed',
      subtitle: `Ongoing: ${facultyMetrics.facultyWithOngoingTrainings ?? 0} • Yet to Start: ${facultyMetrics.facultyYetToStart ?? 0}`,
    },
    {
      title: 'Training Completion Metrics',
      icon: CheckCircleOutlined,
      variant: 'purple',
      value: completionMetrics.facultyCompleted40Hours ?? 0,
      valueLabel: 'completed ≥ 40 hrs',
      subtitle: `Completed < 40 hrs: ${completionMetrics.facultyCompletedUnder40Hours ?? 0} faculty`,
    },
    {
      title: 'Hours Distribution',
      icon: BarChartOutlined,
      variant: 'emerald',
      value: hoursDistribution.averageHoursPerFaculty ?? 0,
      valueLabel: 'hrs avg',
      subtitle: `Highest: ${hoursDistribution.highestHoursSingleFaculty ?? 0} hrs • Lowest: ${hoursDistribution.lowestHoursSingleFaculty ?? 0} hrs`,
    },
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
      title: 'Enrolled Faculty',
      key: 'enrolledFaculty',
      render: (_, record) => {
        const names = record.enrolledFaculty || [];
        if (!names.length) return <Text className="text-xs text-slate-400">—</Text>;
        const visible = names.slice(0, 3);
        const rest = names.slice(3);
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {visible.map((name) => (
              <Tag key={name} className="text-[11px] m-0">{name}</Tag>
            ))}
            {rest.length > 0 && (
              <Tooltip title={rest.join(', ')}>
                <Tag className="text-[11px] m-0 cursor-pointer">+{rest.length} more</Tag>
              </Tooltip>
            )}
          </div>
        );
      },
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

  return (
    <div className="p-4 training-ui">
      {/* Greeting Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
        <TrainingGreeting
          userName={user?.name}
          subtitle="Monitor faculty training opportunities and participation across your institution."
        />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

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
