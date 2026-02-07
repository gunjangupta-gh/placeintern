import React from 'react';
import { Card, Typography, Progress, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ComplianceSummaryCard = ({
  title,
  icon,
  expected = 0,
  submitted = 0,
  missing = 0,
  rate = null,
  submittedLabel = 'Submitted',
  missingLabel = 'Missing',
}) => {
  // Get rate color
  const getRateColor = (rate) => {
    if (rate === null || rate === undefined) return '#d9d9d9';
    if (rate >= 90) return '#52c41a';
    if (rate >= 70) return '#1890ff';
    if (rate >= 50) return '#faad14';
    return '#ff4d4f';
  };

  const rateColor = getRateColor(rate);

  return (
    <Card className="h-full shadow-sm" bodyStyle={{ padding: '16px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: `${rateColor}15`, color: rateColor }}
          >
            {icon}
          </div>
          <Text className="font-semibold text-text-primary">{title}</Text>
        </div>
        <Tooltip title="Compliance Rate">
          <div
            className="text-lg font-bold px-3 py-1 rounded-lg"
            style={{ backgroundColor: `${rateColor}15`, color: rateColor }}
          >
            {rate !== null ? `${rate}%` : 'N/A'}
          </div>
        </Tooltip>
      </div>

      {/* Progress */}
      <Progress
        percent={rate || 0}
        showInfo={false}
        strokeColor={rateColor}
        trailColor="#f0f0f0"
        className="mb-3"
      />

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <Tooltip title={submittedLabel}>
            <span className="flex items-center gap-1 text-success">
              <CheckCircleOutlined className="text-xs" />
              <span className="font-medium">{submitted}</span>
            </span>
          </Tooltip>
          <Tooltip title={missingLabel}>
            <span className="flex items-center gap-1 text-error">
              <CloseCircleOutlined className="text-xs" />
              <span className="font-medium">{missing}</span>
            </span>
          </Tooltip>
        </div>
        <Text className="text-text-tertiary">
          of <span className="font-semibold text-text-secondary">{expected}</span> expected
        </Text>
      </div>
    </Card>
  );
};

export default ComplianceSummaryCard;
