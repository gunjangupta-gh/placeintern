import React, { useMemo, useState } from 'react';
import { Modal, Button, Table, Typography, Empty, Tooltip, DatePicker } from 'antd';
import { CheckCircleOutlined, TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const EngagementDetailsModal = ({
  open,
  onCancel,
  engagementData = [],
  type = 'engagement', // 'engagement' or 'faculty'
}) => {
  const [dateRange, setDateRange] = useState(null);

  // Determine if data is training-wise
  const isTrainingWise = useMemo(() => {
    return (
      Array.isArray(engagementData) &&
      engagementData.length > 0 &&
      engagementData[0]?.trainingTitle !== undefined
    );
  }, [engagementData]);

  // Apply date filter
  const filteredData = useMemo(() => {
    if (!Array.isArray(engagementData) || !engagementData.length) {
      return [];
    }

    if (isTrainingWise && dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');

      return engagementData.filter((item) => {
        if (!item.startDate && !item.endDate) return true;
        const itemStart = dayjs(item.startDate);
        const itemEnd = dayjs(item.endDate);
        // Training falls within or overlaps with the selected date range
        return itemStart.isBefore(end) && itemEnd.isAfter(start);
      });
    }

    return engagementData;
  }, [engagementData, isTrainingWise, dateRange]);

  const tableData = useMemo(() => {
    if (!filteredData.length) return [];

    if (isTrainingWise) {
      return filteredData.map((item, idx) => {
        const trainingId = item?.trainingId || `training-${idx}`;
        if (type === 'faculty') {
          return {
            trainingId,
            trainingTitle: item?.trainingTitle || item?.title || `Training ${idx + 1}`,
            totalNominations: Number(item?.totalNominations ?? 0),
            facultyWithFullAttendanceMarked: Number(item?.facultyWithFullAttendanceMarked ?? 0),
            facultyWithNotFullAttendance: Number(item?.facultyWithNotFullAttendance ?? 0),
          };
        } else {
          return {
            trainingId,
            trainingTitle: item?.trainingTitle || item?.title || `Training ${idx + 1}`,
            lessonPlanRequired: Number(item?.lessonPlan?.required ?? item?.lessonPlanRequired ?? 0),
            lessonPlanDone: Number(item?.lessonPlan?.done ?? item?.lessonPlanDone ?? 0),
            preTestRequired: Number(item?.preTest?.required ?? item?.preTestRequired ?? 0),
            preTestDone: Number(item?.preTest?.done ?? item?.preTestDone ?? 0),
            postTestRequired: Number(item?.postTest?.required ?? item?.postTestRequired ?? 0),
            postTestDone: Number(item?.postTest?.done ?? item?.postTestDone ?? 0),
            feedbackRequired: Number(item?.feedback?.required ?? item?.feedbackRequired ?? 0),
            feedbackDone: Number(item?.feedback?.done ?? item?.feedbackDone ?? 0),
          };
        }
      });
    } else {
      if (type === 'faculty') {
         return filteredData.map((item, idx) => ({
           metric: item?.metric || `Metric ${idx + 1}`,
           count: Number(item?.count ?? 0),
         }));
      } else {
        return filteredData.map((item, idx) => ({
          itemName: item?.item || `Engagement Item ${idx + 1}`,
          required: Number(item?.required ?? 0),
          done: Number(item?.done ?? 0),
        }));
      }
    }
  }, [filteredData, isTrainingWise, type]);

  // Compute summary totals for training-wise view
  const summaryTotals = useMemo(() => {
    if (!isTrainingWise || !tableData.length) return null;

    if (type === 'faculty') {
      return {
        totalTrainings: tableData.length,
        totalNominations: tableData.reduce((sum, r) => sum + r.totalNominations, 0),
        fullAttendance: tableData.reduce((sum, r) => sum + r.facultyWithFullAttendanceMarked, 0),
        notFullAttendance: tableData.reduce((sum, r) => sum + r.facultyWithNotFullAttendance, 0),
      };
    } else {
      return {
        lessonPlanRequired: tableData.reduce((sum, r) => sum + r.lessonPlanRequired, 0),
        lessonPlanDone: tableData.reduce((sum, r) => sum + r.lessonPlanDone, 0),
        preTestRequired: tableData.reduce((sum, r) => sum + r.preTestRequired, 0),
        preTestDone: tableData.reduce((sum, r) => sum + r.preTestDone, 0),
        postTestRequired: tableData.reduce((sum, r) => sum + r.postTestRequired, 0),
        postTestDone: tableData.reduce((sum, r) => sum + r.postTestDone, 0),
        feedbackRequired: tableData.reduce((sum, r) => sum + r.feedbackRequired, 0),
        feedbackDone: tableData.reduce((sum, r) => sum + r.feedbackDone, 0),
      };
    }
  }, [isTrainingWise, tableData, type]);

  const getCompletionPercent = (required, done) => {
    if (required === 0) return 0;
    return Math.round((done / required) * 100);
  };

  const getPercentColor = (percent) =>
    percent === 100
      ? 'text-green-700'
      : percent >= 75
        ? 'text-blue-700'
        : percent >= 50
          ? 'text-amber-700'
          : 'text-red-700';

  const renderDoneFraction = (done, required) => {
    const percent = getCompletionPercent(required, done);
    const color = getPercentColor(percent);
    return (
      <Tooltip title={`${percent}% complete`}>
        <Text className={`text-sm font-semibold ${color}`}>
          {done}<span className="text-slate-400 font-normal">/{required}</span>
        </Text>
      </Tooltip>
    );
  };

  const columns = useMemo(() => {
    if (isTrainingWise) {
      const baseColumns = [
        {
          title: 'Training',
          dataIndex: 'trainingTitle',
          key: 'trainingTitle',
          render: (value) => (
            <Tooltip title={String(value || '')}>
              <div
                className="text-sm"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {String(value || '')}
              </div>
            </Tooltip>
          ),
        }
      ];

      if (type === 'faculty') {
        return [
          ...baseColumns,
          {
            title: 'Total Nominations',
            dataIndex: 'totalNominations',
            key: 'totalNominations',
            align: 'right',
            width: 140,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
          {
            title: 'Faculty with Full Attendance',
            dataIndex: 'facultyWithFullAttendanceMarked',
            key: 'facultyWithFullAttendanceMarked',
            align: 'right',
            width: 200,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
          {
            title: 'Faculty with Not Full Attendance',
            dataIndex: 'facultyWithNotFullAttendance',
            key: 'facultyWithNotFullAttendance',
            align: 'right',
            width: 220,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
        ];
      } else {
        return [
          ...baseColumns,
          {
            title: 'Lesson Plan',
            key: 'lessonPlan',
            width: 110,
            align: 'center',
            render: (_, record) => renderDoneFraction(record.lessonPlanDone, record.lessonPlanRequired),
          },
          {
            title: 'Pre-Test',
            key: 'preTest',
            width: 110,
            align: 'center',
            render: (_, record) => renderDoneFraction(record.preTestDone, record.preTestRequired),
          },
          {
            title: 'Post-Test',
            key: 'postTest',
            width: 110,
            align: 'center',
            render: (_, record) => renderDoneFraction(record.postTestDone, record.postTestRequired),
          },
          {
            title: 'Feedback',
            key: 'feedback',
            width: 110,
            align: 'center',
            render: (_, record) => renderDoneFraction(record.feedbackDone, record.feedbackRequired),
          },
        ];
      }
    } else {
      if (type === 'faculty') {
        return [
          {
            title: 'Metric',
            dataIndex: 'metric',
            key: 'metric',
            render: (value) => <Text className="text-sm">{String(value || '')}</Text>,
          },
          {
            title: 'Count',
            dataIndex: 'count',
            key: 'count',
            align: 'right',
            width: 120,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
        ];
      } else {
        return [
          {
            title: 'Engagement Type',
            dataIndex: 'itemName',
            key: 'itemName',
            render: (value) => <Text className="text-sm font-semibold">{String(value || '')}</Text>,
          },
          {
            title: 'Required',
            dataIndex: 'required',
            key: 'required',
            align: 'right',
            width: 100,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
          {
            title: 'Completed',
            dataIndex: 'done',
            key: 'done',
            align: 'right',
            width: 100,
            render: (value) => <Text className="text-sm font-semibold">{Number(value || 0)}</Text>,
          },
          {
            title: 'Completion %',
            key: 'completionPercent',
            align: 'right',
            width: 120,
            render: (_, record) => {
              const percent = getCompletionPercent(record?.required || 0, record?.done || 0);
              const color = getPercentColor(percent);
              return (
                <Text className={`text-sm font-semibold ${color}`}>{percent}%</Text>
              );
            },
          },
        ];
      }
    }
  }, [isTrainingWise, type]);

  const handleModalClose = () => {
    setDateRange(null); // Reset date filter when closed
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleModalClose}
      footer={null}
      width={isTrainingWise ? 900 : 700}
      centered
      closable={false}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: 12 },
      }}
    >
      <div>
        {/* Header */}
        <div className="bg-white px-5 py-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg border-2 ${type === 'faculty' ? 'border-blue-600' : 'border-amber-600'} flex items-center justify-center shrink-0`}>
                {type === 'faculty' ? (
                  <TeamOutlined className="text-blue-600 text-base" />
                ) : (
                  <CheckCircleOutlined className="text-amber-600 text-base" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                  {type === 'faculty'
                    ? (isTrainingWise ? 'Training Wise Summary' : 'Faculty Details')
                    : (isTrainingWise ? 'Training-wise Engagement' : 'Engagement Details')}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>
                    {type === 'faculty'
                      ? 'Faculty training participation tracking'
                      : (isTrainingWise
                        ? 'Training-wise engagement completion tracking'
                        : 'Training engagement completion tracking')}
                  </span>
                </div>
              </div>
            </div>
            {isTrainingWise && (
              <div className="mr-4">
                <RangePicker 
                  size="small" 
                  value={dateRange} 
                  onChange={setDateRange} 
                  placeholder={['Start Date', 'End Date']}
                  allowClear
                />
              </div>
            )}
            <Button
              type="text"
              size="small"
              icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
              onClick={handleModalClose}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>

        {/* Summary row for training-wise view */}
        {isTrainingWise && summaryTotals && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div className={`grid ${type === 'faculty' ? 'grid-cols-4' : 'grid-cols-4'} gap-4`}>
              {type === 'faculty' ? (
                <>
                  <div className="text-center">
                    <Text className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                      Total Trainings
                    </Text>
                    <Text className="text-lg font-bold text-blue-700">
                      {summaryTotals.totalTrainings}
                    </Text>
                  </div>
                  <div className="text-center">
                    <Text className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                      Total Nominations
                    </Text>
                    <Text className="text-lg font-bold text-blue-700">
                      {summaryTotals.totalNominations}
                    </Text>
                  </div>
                  <div className="text-center">
                    <Text className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                      Full Attendance
                    </Text>
                    <Text className="text-lg font-bold text-green-700">
                      {summaryTotals.fullAttendance}
                    </Text>
                  </div>
                  <div className="text-center">
                    <Text className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                      Not Full Attendance
                    </Text>
                    <Text className="text-lg font-bold text-amber-700">
                      {summaryTotals.notFullAttendance}
                    </Text>
                  </div>
                </>
              ) : (
                [
                  { label: 'Lesson Plans', done: summaryTotals.lessonPlanDone, required: summaryTotals.lessonPlanRequired },
                  { label: 'Pre-Test', done: summaryTotals.preTestDone, required: summaryTotals.preTestRequired },
                  { label: 'Post-Test', done: summaryTotals.postTestDone, required: summaryTotals.postTestRequired },
                  { label: 'Feedback', done: summaryTotals.feedbackDone, required: summaryTotals.feedbackRequired },
                ].map((metric) => {
                  const percent = getCompletionPercent(metric.required, metric.done);
                  const color = getPercentColor(percent);
                  return (
                    <div key={metric.label} className="text-center">
                      <Text className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                        {metric.label}
                      </Text>
                      <Text className={`text-lg font-bold ${color}`}>
                        {metric.done}
                      </Text>
                      <Text className="text-xs text-slate-400">
                        {' '}/ {metric.required}
                      </Text>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {tableData.length > 0 ? (
            <Table
              columns={columns}
              dataSource={tableData}
              rowKey={(record) => isTrainingWise ? record?.trainingId : (record?.itemName || record?.metric)}
              pagination={isTrainingWise ? { pageSize: 10, size: 'small', showSizeChanger: false } : false}
              size="small"
              bordered
              className="rounded-lg overflow-hidden [&_.ant-table-thead_th]:bg-gray-50 [&_.ant-table-thead_th]:text-[10px] [&_.ant-table-thead_th]:font-bold [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:text-slate-500"
              style={{
                fontSize: '13px',
              }}
            />
          ) : (
            <Empty
              description="No data available"
              style={{ paddingTop: '40px', paddingBottom: '40px' }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EngagementDetailsModal;
