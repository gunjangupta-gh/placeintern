import React, { useMemo } from 'react';
import { Modal, Button, Row, Col, Typography, Progress } from 'antd';
import { CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';

const { Text } = Typography;

const EngagementDetailsModal = ({
  open,
  onCancel,
  engagementData = [],
}) => {
  const stats = useMemo(() => {
    if (!Array.isArray(engagementData) || !engagementData.length) {
      return {
        totalRequired: 0,
        totalDone: 0,
        completionPercent: 0,
        items: [],
      };
    }

    const totalRequired = engagementData.reduce((sum, item) => sum + (item.required || 0), 0);
    const totalDone = engagementData.reduce((sum, item) => sum + (item.done || 0), 0);
    const completionPercent = totalRequired > 0 ? Math.round((totalDone / totalRequired) * 100) : 0;

    return {
      totalRequired,
      totalDone,
      completionPercent,
      items: engagementData,
    };
  }, [engagementData]);

  const getItemColor = (required, done) => {
    if (required === 0) return 'bg-slate-50';
    const percent = (done / required) * 100;
    if (percent === 100) return 'bg-green-50';
    if (percent >= 75) return 'bg-blue-50';
    if (percent >= 50) return 'bg-amber-50';
    return 'bg-red-50';
  };

  const getProgressColor = (required, done) => {
    if (required === 0) return '#cbd5e1';
    const percent = (done / required) * 100;
    if (percent === 100) return '#10b981';
    if (percent >= 75) return '#3b82f6';
    if (percent >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
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
                  Engagement Details
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>Training engagement completion tracking</span>
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
          {/* Overall Stats */}
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <Text className="text-xs text-slate-500 block mb-1">Total Required</Text>
                <div className="text-2xl font-bold text-slate-800">{stats.totalRequired}</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <Text className="text-xs text-emerald-600 block mb-1">Completed</Text>
                <div className="text-2xl font-bold text-emerald-700">{stats.totalDone}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <Text className="text-xs text-blue-600 block mb-1">Completion %</Text>
                <div className="text-2xl font-bold text-blue-700">{stats.completionPercent}%</div>
              </div>
            </div>

            {/* Overall Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Text className="text-xs font-semibold text-slate-700">Overall Progress</Text>
                <Text className="text-xs text-slate-600">
                  {stats.totalDone} of {stats.totalRequired}
                </Text>
              </div>
              <Progress
                percent={stats.completionPercent}
                strokeColor={{
                  '0%': '#ef4444',
                  '50%': '#f59e0b',
                  '100%': '#10b981',
                }}
                size="large"
                format={(percent) => `${percent}%`}
              />
            </div>
          </div>

          {/* Engagement Items */}
          <div>
            <Text className="text-xs font-semibold text-slate-700 block mb-3">
              Item-wise Breakdown
            </Text>
            <div className="space-y-2">
              {stats.items.map((item, idx) => {
                const itemPercent = item.required > 0 ? Math.round((item.done / item.required) * 100) : 0;
                return (
                  <div
                    key={item.item || idx}
                    className={`${getItemColor(item.required, item.done)} border border-slate-200 rounded-lg p-3`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Text className="text-sm font-semibold text-slate-800">{item.item}</Text>
                      <Text className="text-xs text-slate-600">
                        {item.done}/{item.required}
                      </Text>
                    </div>
                    <Progress
                      percent={itemPercent}
                      strokeColor={getProgressColor(item.required, item.done)}
                      size="small"
                      format={(percent) => `${percent}%`}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty State */}
          {!stats.items.length && (
            <div className="text-center py-8">
              <FileTextOutlined className="text-4xl text-slate-300 block mb-2" />
              <Text className="text-sm text-slate-500">No engagement data available</Text>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default EngagementDetailsModal;
