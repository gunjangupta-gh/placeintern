import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Calendar, Card, Col, Input, Row, Table, Tag, Tooltip, Typography } from 'antd';
import { PlusOutlined, SettingOutlined, CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import TrainingGreeting from '../../../components/training/TrainingGreeting';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, CalendarSkeleton, SelectedDaySkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import {
  fetchStateTrainings,
} from '../store/stateTrainingSlice';

const { Text } = Typography;

const STAT_TONES = {
  primary: { icon: 'bg-blue-100 text-blue-700', card: 'bg-gradient-to-br from-blue-50 via-white to-slate-50' },
  success: { icon: 'bg-emerald-100 text-emerald-700', card: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50' },
  warning: { icon: 'bg-amber-100 text-amber-700', card: 'bg-gradient-to-br from-amber-50 via-white to-slate-50' },
  secondary: { icon: 'bg-slate-100 text-slate-700', card: 'bg-gradient-to-br from-slate-50 via-white to-blue-50' },
};

const StatCard = ({ icon: Icon, title, value, subtitle, tone, trend, onClick }) => {
  const styles = STAT_TONES[tone] || STAT_TONES.primary;
  const hasTrend = trend !== undefined && trend !== null;
  const isPositiveTrend = hasTrend && trend >= 0;

  return (
    <Card
      className={`rounded-2xl border-border shadow-none cursor-pointer hover:shadow-soft transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '16px' } }}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value}. ${subtitle || ''}${hasTrend ? ` Trend: ${isPositiveTrend ? 'up' : 'down'} ${Math.abs(trend)}%` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{value}</span>
            {hasTrend && (
              <span className={`flex items-center text-xs font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-xs">{subtitle}</Text>}
        </div>
        {Icon && (
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${styles.icon}`}>
            <Icon className="text-lg" />
          </div>
        )}
      </div>
    </Card>
  );
};

const TrainingManagementPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs());

  useEffect(() => {
    dispatch(fetchStateTrainings());
  }, [dispatch]);

  const isLoading = trainings.loading && !trainings.list;

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Button type="link" onClick={() => navigate(`/app/training/${record.id}`)} aria-label={`View training: ${text}`}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_, record) => (
        <TrainingDateRange startDate={record.startDate} endDate={record.endDate} />
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'deliveryMode',
      key: 'deliveryMode',
      render: (mode) => <DeliveryModeBadge mode={mode} />,
    },
    {
      title: 'Published',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (value) => (value ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button size="small" onClick={() => navigate(`/app/training/${record.id}/edit`)} aria-label={`Edit ${record.title}`}>
          Edit
        </Button>
      ),
    },
  ];

  const stats = useMemo(() => {
    const list = trainings.list || [];
    return {
      total: list.length,
      published: list.filter((item) => item.isPublished).length,
      draft: list.filter((item) => !item.isPublished).length,
    };
  }, [trainings.list]);

  const filteredTrainings = useMemo(() => {
    if (!searchText) return trainings.list || [];
    const search = searchText.toLowerCase();
    return (trainings.list || []).filter((item) =>
      (item.title || '').toLowerCase().includes(search) ||
      (item.providedBy || '').toLowerCase().includes(search)
    );
  }, [trainings.list, searchText]);

  const searchResultCount = searchText ? filteredTrainings.length : null;

  const getTrainingsForDate = (dateValue) => {
    if (!filteredTrainings.length) return [];
    return filteredTrainings.filter((training) => {
      const start = dayjs(training.startDate);
      const end = dayjs(training.endDate);
      return (
        dateValue.isSame(start, 'day') ||
        dateValue.isSame(end, 'day') ||
        (dateValue.isAfter(start, 'day') && dateValue.isBefore(end, 'day'))
      );
    });
  };

  const selectedDayTrainings = useMemo(
    () => getTrainingsForDate(selectedDate),
    [selectedDate, filteredTrainings]
  );

  return (
    <div className="p-6 training-ui" role="main" aria-label="Training Management">
      <PageHeader
        icon={SettingOutlined}
        title={<span className="training-heading">Training Management</span>}
        description="Create and manage trainings for the state."
        actions={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/app/training/create')}
            aria-label="Create new training"
          >
            Create Training
          </Button>,
        ]}
      />

      <Row gutter={[16, 16]} className="mb-6" role="region" aria-label="Training statistics">
        {isLoading ? (
          <>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
            <Col xs={12} lg={6}><TrainingStatSkeleton /></Col>
          </>
        ) : (
          <>
            <Col xs={12} lg={6}>
              <StatCard
                icon={CalendarOutlined}
                title="Total"
                value={stats.total}
                tone="primary"
                onClick={() => setSearchText('')}
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                title="Published"
                value={stats.published}
                tone="success"
              />
            </Col>
            <Col xs={12} lg={6}>
              <StatCard
                title="Drafts"
                value={stats.draft}
                tone="warning"
              />
            </Col>
          </>
        )}
      </Row>

      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} lg={16}>
          {isLoading ? (
            <CalendarSkeleton />
          ) : (
            <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-blue-100/50 overflow-hidden backdrop-blur-sm">
              <Calendar
                className="training-calendar"
                value={selectedDate}
                onSelect={setSelectedDate}
                aria-label="Training calendar"
                fullCellRender={(dateValue, info) => {
                  if (info.type !== 'date') return info.originNode;
                  const dayTrainings = getTrainingsForDate(dateValue);
                  const isSelected = dateValue.isSame(selectedDate, 'day');
                  const hasTrainings = dayTrainings.length > 0;
                  return (
                    <div
                      className={
                        `h-full rounded-xl p-2 border transition-all duration-300 ` +
                        (isSelected
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-300 shadow-md ring-2 ring-blue-200/50'
                          : hasTrainings
                          ? 'border-slate-200 hover:border-blue-200 hover:shadow-sm'
                          : 'border-transparent hover:border-slate-200')
                      }
                      role="button"
                      aria-label={`${dateValue.format('MMMM D, YYYY')}${hasTrainings ? `, ${dayTrainings.length} training${dayTrainings.length > 1 ? 's' : ''}` : ''}`}
                    >
                      <div className={
                        `text-xs font-bold mb-1.5 transition-colors ` +
                        (isSelected ? 'text-blue-700' : 'text-text-primary')
                      }>
                        {dateValue.date()}
                      </div>
                      <div className="space-y-1">
                        {dayTrainings.slice(0, 2).map((training) => (
                          <Tooltip
                            key={training.id}
                            title={training.title}
                            placement="topLeft"
                          >
                            <Badge
                              color={training.isPublished ? 'green' : 'orange'}
                              text={
                                <span className="text-[10px] font-medium text-text-secondary line-clamp-1">
                                  {training.title}
                                </span>
                              }
                            />
                          </Tooltip>
                        ))}
                        {dayTrainings.length > 2 && (
                          <div className="text-[10px] font-semibold text-blue-600 bg-blue-50 rounded px-2 py-0.5 inline-block">
                            +{dayTrainings.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </Card>
          )}
        </Col>
        <Col xs={24} lg={8}>
          {isLoading ? (
            <SelectedDaySkeleton />
          ) : (
            <Card className="rounded-2xl border-border shadow-md bg-gradient-to-br from-white to-slate-50/30">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <div>
                  <Text className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">Selected Day</Text>
                  <Text className="font-bold text-lg block mt-0.5 bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    {selectedDate.format('DD MMM, YYYY')}
                  </Text>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                  {selectedDate.format('DD')}
                </div>
              </div>
              {selectedDayTrainings.length ? (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1" role="list" aria-label="Trainings on selected date">
                  {selectedDayTrainings.map((training, index) => (
                    <Card
                      key={training.id}
                      className="rounded-xl border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:-translate-y-1 bg-white"
                      style={{
                        body: { padding: '14px' },
                        animation: 'card-slide-up 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                        animationDelay: `${index * 0.1}s`,
                        opacity: 0
                      }}
                      onClick={() => navigate(`/app/training/${training.id}`)}
                      role="listitem"
                      aria-label={`Training: ${training.title}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <Text className="font-semibold text-sm block mb-1 text-text-primary leading-tight">{training.title}</Text>
                          <Text type="secondary" className="text-xs flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {training.providedBy || 'Training Provider'}
                          </Text>
                        </div>
                        <DeliveryModeBadge mode={training.deliveryMode} showIcon={false} />
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <TrainingDateRange startDate={training.startDate} endDate={training.endDate} compact />
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <TrainingEmptyState
                  type="calendar"
                  message="No trainings on this date"
                  description="Select another date or create a new training."
                  compact
                />
              )}
            </Card>
          )}
        </Col>
      </Row>

      <Card className="rounded-2xl border-border shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search trainings"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              allowClear
              aria-label="Search trainings"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-sm" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} found
              </Text>
            )}
          </div>
        </div>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={5} />
        ) : filteredTrainings.length > 0 ? (
          <Table
            className="custom-table"
            rowKey="id"
            columns={columns}
            dataSource={filteredTrainings}
            loading={trainings.loading}
            pagination={{ pageSize: 10 }}
            aria-label="Trainings table"
          />
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'calendar'}
            message={searchText ? 'No trainings found' : 'No trainings yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Create your first training to get started.'}
            actionText={searchText ? 'Clear Search' : 'Create Training'}
            onAction={() => searchText ? setSearchText('') : navigate('/app/training/create')}
          />
        )}
      </Card>
    </div>
  );
};

export default TrainingManagementPage;
