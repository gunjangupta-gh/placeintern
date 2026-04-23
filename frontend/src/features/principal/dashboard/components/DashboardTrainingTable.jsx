import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Card, Input, Modal, Space, Table, Tag, Tooltip, Typography } from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import TrainingDateRange from '../../../../components/training/TrainingDateRange';
import DeliveryModeBadge from '../../../../components/training/DeliveryModeBadge';
import TrainingEmptyState from '../../../../components/training/TrainingEmptyState';
import { TableRowSkeleton } from '../../../../components/training/skeletons/TrainingSkeletons';
import trainingPrincipalService from '../../../../services/training-principal.service';
import { fetchPrincipalTrainings } from '../../store/principalTrainingSlice';

const { Text } = Typography;

const DashboardTrainingTable = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { trainings } = useSelector((state) => state.principalTraining);

  const [searchText, setSearchText] = useState('');
  const [tablePagination, setTablePagination] = useState({ page: 1, limit: 10 });
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);

  useEffect(() => {
    dispatch(
      fetchPrincipalTrainings({
        page: tablePagination.page,
        limit: tablePagination.limit,
        forceRefresh: true,
      })
    );
  }, [dispatch, tablePagination.page, tablePagination.limit]);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const filteredTrainings = useMemo(
    () =>
      (trainings.list || [])
        .filter((t) => {
          const enrolledFaculty = Array.isArray(t.enrolledFaculty) ? t.enrolledFaculty : [];
          const isEnrolledTraining = enrolledFaculty.length > 0;
          const isNotPastTraining = !t.endDate || new Date(t.endDate) >= today;
          return isEnrolledTraining && isNotPastTraining;
        })
        .filter(
          (t) => !searchText || t.title?.toLowerCase().includes(searchText.toLowerCase())
        ),
    [trainings.list, searchText, today]
  );

  const isLoading = trainings.loading && !(trainings.list || []).length;

  const trainingDates = useMemo(() => {
    if (!selectedTraining?.startDate || !selectedTraining?.endDate) return [];

    const dates = [];
    const start = dayjs(selectedTraining.startDate);
    const end = dayjs(selectedTraining.endDate);
    let current = start;

    while (current.isSameOrBefore(end, 'day')) {
      dates.push(current.toDate());
      current = current.add(1, 'day');
    }

    return dates;
  }, [selectedTraining]);

  const attendanceTableData = useMemo(() => {
    if (!attendanceData?.attendanceByUser || !attendanceData?.records) return [];

    return attendanceData.attendanceByUser.map((userData) => {
      const userAttendanceRecords = attendanceData.records.filter(
        (record) => record.userId === userData.user.id
      );

      const attendedDates = new Set(
        userAttendanceRecords.map((record) => dayjs(record.attendanceDate).format('YYYY-MM-DD'))
      );

      return {
        ...userData,
        attendedDates,
        institution:
          userData.user?.Institution || userAttendanceRecords[0]?.user?.Institution || null,
      };
    });
  }, [attendanceData]);

  const columns = [
    {
      title: 'Training',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Tooltip title={text || 'Training'}>
            <div
              className="font-medium cursor-pointer hover:text-primary transition-colors truncate max-w-72"
              title={text || 'Training'}
              onClick={() => navigate(`/app/training/${record.id}`)}
            >
              {text || 'Training'}
            </div>
          </Tooltip>
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
      sorter: (a, b) =>
        new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime(),
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
        if (!names.length) return <Text className="text-xs text-slate-400">-</Text>;

        const visible = names.slice(0, 3);
        const rest = names.slice(3);
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {visible.map((name) => (
              <Tag key={name} className="text-[11px] m-0">
                {name}
              </Tag>
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Attendance">
            <Button
              type="text"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={async () => {
                try {
                  setSelectedTraining(record);
                  setAttendanceModalOpen(true);
                  setAttendanceLoading(true);
                  const response = await trainingPrincipalService.getTrainingAttendance(record.id);
                  setAttendanceData(response?.data || response || null);
                } catch (error) {
                  setAttendanceData(null);
                } finally {
                  setAttendanceLoading(false);
                }
              }}
            />
          </Tooltip>
          <Tooltip title="View Test Responses">
            <Button
              type="text"
              size="small"
              icon={<SafetyCertificateOutlined />}
              onClick={() => navigate(`/app/principal/test-responses?trainingId=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="View Feedback Responses">
            <Button
              type="text"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => navigate(`/app/principal/feedback-responses?trainingId=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="View Lesson Plans">
            <Button
              type="text"
              size="small"
              icon={<BookOutlined />}
              onClick={() => navigate('/app/training/lesson-plans')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
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
              columns={columns}
              dataSource={filteredTrainings}
              loading={trainings.loading}
              size="small"
              onChange={(pagination) => {
                setTablePagination({ page: pagination.current, limit: pagination.pageSize });
              }}
              pagination={{
                current: tablePagination.page,
                pageSize: tablePagination.limit,
                total: searchText
                  ? filteredTrainings.length
                  : trainings.pagination?.total || trainings.list?.length || 0,
                showSizeChanger: true,
                showTotal: (total, range) => (
                  <Text className="text-xs">
                    {range[0]}-{range[1]} of {total}
                  </Text>
                ),
                size: 'small',
              }}
              scroll={{ x: 'max-content' }}
            />
          </div>
        ) : (
          <TrainingEmptyState
            type={searchText ? 'search' : 'calendar'}
            message={searchText ? 'No matching trainings' : 'No trainings'}
            description={
              searchText ? 'Try adjusting your search.' : 'No training opportunities available.'
            }
          />
        )}
      </div>

      <Modal
        open={attendanceModalOpen}
        onCancel={() => {
          setAttendanceModalOpen(false);
          setSelectedTraining(null);
          setAttendanceData(null);
        }}
        footer={null}
        width={900}
        centered
        closable={false}
        styles={{
          body: { padding: 0 },
          content: { borderRadius: 12 },
        }}
      >
        <div className="bg-white px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-800 mb-1 truncate">
                {selectedTraining?.title || 'Training'}
              </h3>
              <div className="flex items-center gap-2.5 text-xs text-slate-600">
                {selectedTraining && (
                  <TrainingDateRange
                    startDate={selectedTraining.startDate}
                    endDate={selectedTraining.endDate}
                    compact
                  />
                )}
                {attendanceData?.summary && (
                  <>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-800">{attendanceData.summary.totalApproved}</strong>{' '}
                      enrolled
                    </span>
                    <span>•</span>
                    <span>
                      <strong className="text-slate-800">{attendanceData.summary.uniqueAttendees}</strong>{' '}
                      attended
                    </span>
                  </>
                )}
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
              onClick={() => {
                setAttendanceModalOpen(false);
                setSelectedTraining(null);
                setAttendanceData(null);
              }}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>

        <div className="p-3">
          {attendanceLoading ? (
            <div className="p-12 text-center">
              <Text type="secondary">Loading attendance data...</Text>
            </div>
          ) : attendanceTableData.length > 0 ? (
            <div className="overflow-auto border border-slate-200 rounded-md max-h-[65vh]">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white px-2 py-2 border-b border-slate-200 text-left text-xs font-semibold text-slate-700 min-w-45">
                      Faculty
                    </th>
                    <th className="sticky left-45 z-10 bg-white px-2 py-2 border-b border-slate-200 text-left text-xs font-semibold text-slate-700 min-w-37.5">
                      Institution
                    </th>
                    {trainingDates.map((date) => (
                      <th
                        key={dayjs(date).format('YYYY-MM-DD')}
                        className="px-2 py-2 border-b border-slate-200 text-center text-[11px] font-semibold text-slate-700 min-w-15"
                      >
                        <div className="leading-tight">
                          <div>{dayjs(date).format('DD')}</div>
                          <div className="text-[9px] text-slate-500">{dayjs(date).format('MMM')}</div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendanceTableData.map((record) => (
                    <tr key={record.user.id}>
                      <td className="sticky left-0 z-5 bg-white px-2 py-2 border-b border-slate-100">
                        <div className="font-medium text-slate-800 text-xs">{record.user.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{record.user.email}</div>
                      </td>
                      <td className="sticky left-45 z-5 bg-white px-2 py-2 border-b border-slate-100">
                        <div className="font-medium text-slate-700 text-xs truncate" title={record.institution?.name}>
                          {record.institution?.shortName || record.institution?.name || 'N/A'}
                        </div>
                      </td>
                      {trainingDates.map((date) => {
                        const dateStr = dayjs(date).format('YYYY-MM-DD');
                        const isPresent = record.attendedDates.has(dateStr);
                        return (
                          <td
                            key={`${record.user.id}-${dateStr}`}
                            className="px-2 py-2 border-b border-slate-100 text-center"
                          >
                            {isPresent ? (
                              <CheckCircleFilled className="text-base text-green-500" />
                            ) : (
                              <CloseCircleOutlined className="text-base text-slate-300" />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TrainingEmptyState
              type="search"
              message="No attendance records found"
              description="No attendance data available for this training."
            />
          )}
        </div>
      </Modal>
    </Card>
  );
};

export default DashboardTrainingTable;