import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Badge, Button, Calendar, Card, Col, DatePicker, Input, Row, Segmented, Select, Space, Table, Tooltip, Typography } from 'antd';
import {
  CalendarOutlined,
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  RightOutlined,
  ClockCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import TrainingDateRange from '../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../components/training/DeliveryModeBadge';
import DifficultyBadge from '../../../components/training/DifficultyBadge';
import CapacityIndicator from '../../../components/training/CapacityIndicator';
import ApplicationDeadline from '../../../components/training/ApplicationDeadline';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { fetchCalendar, fetchTrainings } from '../store/facultyTrainingSlice';
import { useBranches } from '../../../hooks';

const { Text, Title } = Typography;

const getCapacityValues = (item) => {
  if (item?.capacity && typeof item.capacity === 'object') {
    return {
      available: item.capacity.available ?? 0,
      total: item.capacity.total ?? 0,
    };
  }
  const availableRaw = item?.availableSeats;
  if (availableRaw && typeof availableRaw === 'object') {
    return {
      available: availableRaw.available ?? 0,
      total: availableRaw.total ?? 0,
    };
  }
  return {
    available: item?.availableSeats ?? 0,
    total: item?.capacity ?? 0,
  };
};

const TrainingCard = ({ training, onClick }) => (
  <Card
    className="rounded-xl border-border shadow-none hover:shadow-sm transition-all cursor-pointer group h-full"
    onClick={onClick}
    hoverable
    styles={{ body: { padding: '16px' } }}
  >
    <div className="flex items-start justify-between mb-3">
      <DeliveryModeBadge mode={training.deliveryMode} />
      <DifficultyBadge level={training.difficulty} showTooltip={false} />
    </div>

    <Title level={5} className="!mb-1 group-hover:text-primary transition-colors line-clamp-2">
      {training.title}
    </Title>
    <Text type="secondary" className="text-xs line-clamp-2 mb-4 block h-8">
      {training.description || 'No description provided'}
    </Text>

    <div className="space-y-3">
      <TrainingDateRange startDate={training.startDate} endDate={training.endDate} compact />

      <div className="flex items-center justify-between">
        <CapacityIndicator
          available={getCapacityValues(training).available}
          total={getCapacityValues(training).total}
          compact
        />
        <ApplicationDeadline deadline={training.applicationDeadline} compact />
      </div>
    </div>

    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
      <Text type="secondary" className="text-xs">
        {training.providedBy || 'Training Provider'}
      </Text>
      <Button type="link" size="small" className="p-0 flex items-center gap-1">
        View Details <RightOutlined className="text-xs" />
      </Button>
    </div>
  </Card>
);

const TrainingCalendarPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { activeBranches } = useBranches(true);
  const { trainings, calendar } = useSelector((state) => state.facultyTraining);

  const [viewMode, setViewMode] = useState('calendar');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [filters, setFilters] = useState({
    year: null,
    month: null,
    branchIds: [],
    deliveryMode: null,
    difficulty: null,
  });

  useEffect(() => {
    dispatch(fetchTrainings(filters));
    dispatch(fetchCalendar(filters));
  }, [dispatch, filters]);

  const branchOptions = useMemo(
    () => activeBranches.map((b) => ({ value: b.id, label: b.name })),
    [activeBranches]
  );

  const filteredTrainings = useMemo(() => {
    let result = trainings.list || [];
    if (searchText) {
      const search = searchText.toLowerCase();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(search) ||
          t.description?.toLowerCase().includes(search) ||
          t.providedBy?.toLowerCase().includes(search)
      );
    }
    return result;
  }, [trainings.list, searchText]);

  const calendarTrainings = useMemo(() => {
    if (Array.isArray(calendar.list)) return calendar.list;
    if (calendar.list?.trainings) return calendar.list.trainings;
    return [];
  }, [calendar.list]);

  const getTrainingsForDate = (dateValue) => {
    if (!calendarTrainings.length) return [];
    return calendarTrainings.filter((training) => {
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
    [selectedDate, calendarTrainings]
  );

  const hasActiveFilters = filters.year || filters.month || filters.branchIds.length || filters.deliveryMode || filters.difficulty;

  const clearFilters = () => {
    setFilters({
      year: null,
      month: null,
      branchIds: [],
      deliveryMode: null,
      difficulty: null,
    });
    setSearchText('');
  };

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
          <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">
            {record.description || 'No description'}
          </div>
        </div>
      ),
    },
    {
      title: 'Dates',
      key: 'dates',
      width: 180,
      sorter: (a, b) => new Date(a.startDate) - new Date(b.startDate),
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
      title: 'Level',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 120,
      filters: [
        { text: 'Beginner', value: 'BEGINNER' },
        { text: 'Intermediate', value: 'INTERMEDIATE' },
        { text: 'Advanced', value: 'ADVANCED' },
      ],
      onFilter: (value, record) => record.difficulty === value,
      render: (level) => <DifficultyBadge level={level} showTooltip={false} />,
    },
    {
      title: 'Capacity',
      key: 'capacity',
      width: 100,
      render: (_, record) => {
        const capacity = getCapacityValues(record);
        return <CapacityIndicator available={capacity.available} total={capacity.total} compact />;
      },
    },
    {
      title: 'Deadline',
      key: 'deadline',
      width: 120,
      render: (_, record) => (
        <ApplicationDeadline deadline={record.applicationDeadline} compact />
      ),
    },
  ];

  return (
    <div className="p-6 training-ui">
      <PageHeader
        icon={CalendarOutlined}
        title={<span className="training-heading">Training Calendar</span>}
        description="Discover and apply for professional development trainings."
      />

      <Card className="rounded-2xl border-border shadow-none mb-6 bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <Input
            placeholder="Search trainings by title, description, or provider..."
            prefix={<SearchOutlined className="text-text-secondary" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="lg:w-96"
            allowClear
            size="large"
          />
          <Space>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowFilters(!showFilters)}
              type={showFilters ? 'primary' : 'default'}
              ghost={showFilters}
            >
              Filters
              {hasActiveFilters && <Badge count={Object.values(filters).filter(Boolean).length} size="small" className="ml-2" />}
            </Button>
            <Segmented
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'calendar', icon: <CalendarOutlined /> },
                { value: 'grid', icon: <AppstoreOutlined /> },
                { value: 'list', icon: <UnorderedListOutlined /> },
              ]}
            />
          </Space>
        </div>

        {showFilters && (
          <div className="pt-4 border-t border-border">
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={6} lg={4}>
                <DatePicker
                  picker="year"
                  className="w-full"
                  placeholder="Year"
                  onChange={(value) => setFilters((prev) => ({ ...prev, year: value ? value.year() : null }))}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <DatePicker
                  picker="month"
                  className="w-full"
                  placeholder="Month"
                  onChange={(value) => setFilters((prev) => ({ ...prev, month: value ? value.month() + 1 : null }))}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  mode="multiple"
                  allowClear
                  placeholder="Branches"
                  className="w-full"
                  options={branchOptions}
                  value={filters.branchIds}
                  onChange={(value) => setFilters((prev) => ({ ...prev, branchIds: value }))}
                  maxTagCount="responsive"
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  allowClear
                  placeholder="Delivery Mode"
                  className="w-full"
                  value={filters.deliveryMode}
                  onChange={(value) => setFilters((prev) => ({ ...prev, deliveryMode: value }))}
                  options={[
                    { value: 'ONLINE', label: 'Online' },
                    { value: 'OFFLINE', label: 'In-Person' },
                    { value: 'HYBRID', label: 'Hybrid' },
                  ]}
                />
              </Col>
              <Col xs={24} sm={12} md={6} lg={4}>
                <Select
                  allowClear
                  placeholder="Difficulty"
                  className="w-full"
                  value={filters.difficulty}
                  onChange={(value) => setFilters((prev) => ({ ...prev, difficulty: value }))}
                  options={[
                    { value: 'BEGINNER', label: 'Beginner' },
                    { value: 'INTERMEDIATE', label: 'Intermediate' },
                    { value: 'ADVANCED', label: 'Advanced' },
                  ]}
                />
              </Col>
              {hasActiveFilters && (
                <Col xs={24} sm={12} md={6} lg={4}>
                  <Button icon={<ClearOutlined />} onClick={clearFilters} block>
                    Clear Filters
                  </Button>
                </Col>
              )}
            </Row>
            <div className="flex items-center justify-between mt-4">
              <Text type="secondary" className="text-xs flex items-center gap-2">
                <ClockCircleOutlined />
                {filteredTrainings.length} training{filteredTrainings.length !== 1 ? 's' : ''} found
                {calendarTrainings.length > 0 && ` • ${calendarTrainings.length} sessions in calendar`}
              </Text>
            </div>
          </div>
        )}
      </Card>

      {filteredTrainings.length > 0 ? (
        viewMode === 'calendar' ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={16}>
              <Card className="rounded-2xl border-slate-200/80 shadow-lg shadow-blue-100/50 overflow-hidden backdrop-blur-sm">
                <Calendar
                  className="training-calendar"
                  value={selectedDate}
                  onSelect={setSelectedDate}
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
                                color={training.deliveryMode === 'ONLINE' ? 'blue' : training.deliveryMode === 'HYBRID' ? 'cyan' : 'green'}
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
            </Col>
            <Col xs={24} lg={8}>
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
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
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
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <TrainingEmptyState
                      message="No trainings on this day"
                      description="Select another date or browse the list view."
                    />
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        ) : viewMode === 'grid' ? (
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
          <Card className="rounded-xl border-border shadow-none">
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
              onRow={(record) => ({
                onClick: () => navigate(`/app/training/${record.id}`),
                className: 'cursor-pointer',
              })}
            />
          </Card>
        )
      ) : (
        <Card className="rounded-xl border-border shadow-none">
          <TrainingEmptyState
            message={searchText || hasActiveFilters ? 'No matching trainings' : 'No trainings available'}
            description={
              searchText || hasActiveFilters
                ? 'Try adjusting your search or filter criteria.'
                : 'Check back later for new training opportunities.'
            }
            actionText={hasActiveFilters ? 'Clear Filters' : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        </Card>
      )}
    </div>
  );
};

export default TrainingCalendarPage;
