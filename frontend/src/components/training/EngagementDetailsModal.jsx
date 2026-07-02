import React, { useMemo } from 'react';
import { Modal, Button, Table, Typography, Empty, Tooltip } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const EngagementDetailsModal = ({
  open,
  onCancel,
  engagementData = [],
}) => {
  // Determine if data is training-wise (has trainingTitle) or item-wise (has item)
  const isTrainingWise = useMemo(() => {
    return (
      Array.isArray(engagementData) &&
      engagementData.length > 0 &&
      engagementData[0]?.trainingTitle !== undefined
    );
  }, [engagementData]);

  const tableData = useMemo(() => {
    if (!Array.isArray(engagementData) || !engagementData.length) {
      return [];
    }

    if (isTrainingWise) {
      // Training-wise format: each row is a training with engagement metrics
      return engagementData.map((item, idx) => {
        const trainingId = item?.trainingId || `training-${idx}`;
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
      });
    } else {
      // Item-wise format: each row is an engagement type with required/done counts
      return engagementData.map((item, idx) => ({
        itemName: item?.item || `Engagement Item ${idx + 1}`,
        required: Number(item?.required ?? 0),
        done: Number(item?.done ?? 0),
      }));
    }
  }, [engagementData, isTrainingWise]);

  // Compute summary totals for training-wise view
  const summaryTotals = useMemo(() => {
    if (!isTrainingWise || !tableData.length) return null;
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
  }, [isTrainingWise, tableData]);

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
      return [
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
        },
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
  }, [isTrainingWise]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
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
              <div className="w-9 h-9 rounded-lg border-2 border-amber-600 flex items-center justify-center shrink-0">
                <CheckCircleOutlined className="text-amber-600 text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-800 mb-0.5 truncate">
                  {isTrainingWise ? 'Training-wise Engagement' : 'Engagement Details'}
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>
                    {isTrainingWise
                      ? 'Training-wise engagement completion tracking'
                      : 'Training engagement completion tracking'}
                  </span>
                </div>
              </div>
            </div>
            <Button
              type="text"
              size="small"
              icon={<span className="text-xl text-slate-400 hover:text-slate-600">&times;</span>}
              onClick={onCancel}
              className="hover:bg-slate-100 shrink-0"
            />
          </div>
        </div>

        {/* Summary row for training-wise view */}
        {isTrainingWise && summaryTotals && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-4 gap-4">
              {[
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
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5">
          {tableData.length > 0 ? (
            <Table
              columns={columns}
              dataSource={tableData}
              rowKey={(record) => isTrainingWise ? record?.trainingId : record?.itemName}
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
              description="No engagement data available"
              style={{ paddingTop: '40px', paddingBottom: '40px' }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EngagementDetailsModal;
