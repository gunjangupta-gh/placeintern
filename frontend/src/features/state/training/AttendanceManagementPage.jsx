import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Col, DatePicker, Form, Input, Row, Table, Typography, message } from 'antd';
import { useParams } from 'react-router-dom';
import { TeamOutlined, CalendarOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import TrainingEmptyState from '../../../components/training/TrainingEmptyState';
import { TrainingStatSkeleton, TableRowSkeleton } from '../../../components/training/skeletons/TrainingSkeletons';
import { fetchStateTrainingAttendance, markStateBulkAttendance } from '../store/stateTrainingSlice';

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
      className={`rounded-xl border-border shadow-none ${onClick ? 'cursor-pointer hover:shadow-soft' : ''} transition-shadow h-full ${styles.card}`}
      onClick={onClick}
      styles={{ body: { padding: '12px' } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${title}: ${value}. ${subtitle || ''}${hasTrend ? ` Trend: ${isPositiveTrend ? 'up' : 'down'} ${Math.abs(trend)}%` : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-text-secondary text-[10px] uppercase tracking-wider font-semibold opacity-80 block mb-0.5">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-text-primary leading-tight">{value}</span>
            {hasTrend && (
              <span className={`flex items-center text-[10px] font-medium ${isPositiveTrend ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositiveTrend ? <ArrowUpOutlined className="mr-0.5" /> : <ArrowDownOutlined className="mr-0.5" />}
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {subtitle && <Text type="secondary" className="text-[10px]">{subtitle}</Text>}
        </div>
        {Icon && (
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${styles.icon}`}>
            <Icon className="text-sm" />
          </div>
        )}
      </div>
    </Card>
  );
};

const AttendanceManagementPage = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const { attendance } = useSelector((state) => state.stateTraining);
  const { user } = useSelector((state) => state.auth);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    dispatch(fetchStateTrainingAttendance({ trainingId: id }));
  }, [dispatch, id]);

  const isLoading = attendance.loading && !attendance.list;

  const handleMarkAttendance = async () => {
    try {
      const values = await form.validateFields();
      const userIds = values.userIds
        .split(',')
        .map((val) => val.trim())
        .filter(Boolean);

      await dispatch(markStateBulkAttendance({
        trainingId: id,
        data: {
          userIds,
          attendanceDate: values.attendanceDate?.toISOString(),
        },
      })).unwrap();

      message.success('Attendance marked');
      form.resetFields();
      dispatch(fetchStateTrainingAttendance({ trainingId: id }));
    } catch (error) {
      message.error(error || 'Failed to mark attendance');
    }
  };

  const columns = [
    {
      title: 'Faculty',
      dataIndex: ['user', 'name'],
      key: 'user',
      render: (_, record) => record.user?.name || record.user?.email || 'Faculty',
    },
    {
      title: 'Date',
      dataIndex: 'attendanceDate',
      key: 'attendanceDate',
      render: (value) => (value ? new Date(value).toLocaleDateString() : '-'),
    },
  ];

  const stats = useMemo(() => {
    const list = attendance.list || [];
    return {
      total: list.length,
      latest: list[0]?.attendanceDate,
    };
  }, [attendance.list]);

  const filteredAttendance = useMemo(() => {
    if (!searchText) return attendance.list || [];
    const search = searchText.toLowerCase();
    return (attendance.list || []).filter((item) =>
      (item.user?.name || item.user?.email || '').toLowerCase().includes(search)
    );
  }, [attendance.list, searchText]);

  const searchResultCount = searchText ? filteredAttendance.length : null;

  return (
    <div className="p-4 training-ui" role="main" aria-label="Attendance Management">
      <PageHeader
        icon={TeamOutlined}
        title={<span className="training-heading text-lg">Attendance Management</span>}
        description="Record and review attendance for this training."
      />

      <Row gutter={[12, 12]} className="mb-4" role="region" aria-label="Attendance statistics">
        {isLoading ? (
          <>
            <Col xs={24} md={8}><TrainingStatSkeleton /></Col>
            <Col xs={24} md={8}><TrainingStatSkeleton /></Col>
          </>
        ) : (
          <>
            <Col xs={24} md={8}>
              <StatCard
                icon={TeamOutlined}
                title="Attendance Records"
                value={stats.total}
                tone="primary"
              />
            </Col>
            <Col xs={24} md={8}>
              <StatCard
                icon={CalendarOutlined}
                title="Latest Entry"
                value={
                  stats.latest
                    ? new Date(stats.latest).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'N/A'
                }
                tone="secondary"
              />
            </Col>
          </>
        )}
      </Row>

      <Card className="rounded-xl border-border shadow-none mb-4" styles={{ header: { padding: '8px 16px', minHeight: 'auto' }, body: { padding: '16px' } }} title={<span className="text-sm font-semibold">Bulk Mark Attendance</span>}>
        <Form layout="vertical" form={form} size="small">
          <Form.Item
            name="userIds"
            label="User IDs (comma separated)"
            rules={[{ required: true, message: 'Enter at least one user ID' }]}
            className="mb-2"
          >
            <Input.TextArea rows={2} placeholder="user-id-1, user-id-2" aria-label="User IDs for attendance" />
          </Form.Item>
          <Form.Item name="attendanceDate" label="Attendance Date" className="mb-3">
            <DatePicker className="w-full" aria-label="Select attendance date" />
          </Form.Item>
          <Button type="primary" onClick={handleMarkAttendance} aria-label="Mark attendance for selected users">
            Mark Attendance
          </Button>
        </Form>
      </Card>

      <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: '12px' } }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Search faculty"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              className="lg:w-80"
              size="middle"
              allowClear
              aria-label="Search faculty by name"
            />
            {searchResultCount !== null && (
              <Text type="secondary" className="text-xs" aria-live="polite">
                {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} found
              </Text>
            )}
          </div>
        </div>
        {isLoading ? (
          <TableRowSkeleton rows={5} columns={2} />
        ) : filteredAttendance.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto">
            <Table
              className="custom-table"
              rowKey="id"
              columns={columns}
              dataSource={filteredAttendance}
              loading={attendance.loading}
              size="small"
              pagination={{ pageSize: 10, size: 'small' }}
              aria-label="Attendance records table"
              scroll={{ x: 'max-content' }}
            />
          </div>
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'attendance'}
            message={searchText ? 'No attendance records found' : 'No attendance records yet'}
            description={searchText ? 'Try adjusting your search terms.' : 'Records will appear here once marked.'}
            actionText={searchText ? 'Clear Search' : null}
            onAction={searchText ? () => setSearchText('') : null}
          />
        )}
      </Card>
    </div>
  );
};


export default AttendanceManagementPage;
