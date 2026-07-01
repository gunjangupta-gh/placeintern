import React, { useMemo } from 'react';
import { Modal, Button, Table, Typography, Empty } from 'antd';
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
      return engagementData.map((item, idx) => ({
        key: item?.trainingId || `training-${idx}`,
        trainingTitle: item?.trainingTitle || item?.title || `Training ${idx + 1}`,
        lessonPlanRequired: item?.lessonPlan?.required ?? item?.lessonPlanRequired ?? 0,
        lessonPlanDone: item?.lessonPlan?.done ?? item?.lessonPlanDone ?? 0,
        preTestRequired: item?.preTest?.required ?? item?.preTestRequired ?? 0,
        preTestDone: item?.preTest?.done ?? item?.preTestDone ?? 0,
        postTestRequired: item?.postTest?.required ?? item?.postTestRequired ?? 0,
        postTestDone: item?.postTest?.done ?? item?.postTestDone ?? 0,
        feedbackRequired: item?.feedback?.required ?? item?.feedbackRequired ?? 0,
        feedbackDone: item?.feedback?.done ?? item?.feedbackDone ?? 0,
      }));
    } else {
      // Item-wise format: each row is an engagement type with required/done counts
      return engagementData.map((item, idx) => ({
        key: item?.item ? `${item.item}-${idx}` : `item-${idx}`,
        item: item?.item || `Engagement Item ${idx + 1}`,
        required: item?.required ?? 0,
        done: item?.done ?? 0,
      }));
    }
  }, [engagementData, isTrainingWise]);

  const getCompletionPercent = (required, done) => {
    if (required === 0) return 0;
    return Math.round((done / required) * 100);
  };

  const columns = useMemo(() => {
    if (isTrainingWise) {
      return [
        {
          title: 'Training',
          dataIndex: 'trainingTitle',
          key: 'trainingTitle',
          render: (value) => <Text className="text-sm">{value}</Text>,
        },
        {
          title: 'Lesson Plan',
          key: 'lessonPlan',
          width: 110,
          align: 'center',
          render: (_, record) => (
            <Text className="text-sm font-semibold">
              {record.lessonPlanDone}/{record.lessonPlanRequired}
            </Text>
          ),
        },
        {
          title: 'Pre-Test',
          key: 'preTest',
          width: 110,
          align: 'center',
          render: (_, record) => (
            <Text className="text-sm font-semibold">
              {record.preTestDone}/{record.preTestRequired}
            </Text>
          ),
        },
        {
          title: 'Post-Test',
          key: 'postTest',
          width: 110,
          align: 'center',
          render: (_, record) => (
            <Text className="text-sm font-semibold">
              {record.postTestDone}/{record.postTestRequired}
            </Text>
          ),
        },
        {
          title: 'Feedback',
          key: 'feedback',
          width: 110,
          align: 'center',
          render: (_, record) => (
            <Text className="text-sm font-semibold">
              {record.feedbackDone}/{record.feedbackRequired}
            </Text>
          ),
        },
      ];
    } else {
      return [
        {
          title: 'Engagement Type',
          dataIndex: 'item',
          key: 'item',
          render: (value) => <Text className="text-sm font-semibold">{value}</Text>,
        },
        {
          title: 'Required',
          dataIndex: 'required',
          key: 'required',
          align: 'right',
          width: 100,
          render: (value) => <Text className="text-sm font-semibold">{value ?? 0}</Text>,
        },
        {
          title: 'Completed',
          dataIndex: 'done',
          key: 'done',
          align: 'right',
          width: 100,
          render: (value) => <Text className="text-sm font-semibold">{value ?? 0}</Text>,
        },
        {
          title: 'Completion %',
          key: 'completionPercent',
          align: 'right',
          width: 120,
          render: (_, record) => {
            const percent = getCompletionPercent(record.required, record.done);
            const color =
              percent === 100
                ? 'text-green-700'
                : percent >= 75
                  ? 'text-blue-700'
                  : percent >= 50
                    ? 'text-amber-700'
                    : 'text-red-700';
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

        {/* Content */}
        <div className="p-5">
          {tableData.length > 0 ? (
            <Table
              columns={columns}
              dataSource={tableData}
              pagination={false}
              size="small"
              bordered
              className="rounded-lg overflow-hidden"
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
