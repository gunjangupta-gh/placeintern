import React from 'react';
import { Progress, Typography, Tooltip } from 'antd';
import { TeamOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const CapacityIndicator = ({ available, total, compact = false }) => {
  if (total == null) return null;

  const used = total - (available ?? 0);
  const percent = total > 0 ? Math.round((used / total) * 100) : 0;
  const isFull = available === 0;
  const isLow = available > 0 && available <= Math.ceil(total * 0.1);

  const getStatus = () => {
    if (isFull) return 'exception';
    if (percent >= 80) return 'normal';
    return 'active';
  };

  const getColor = () => {
    if (isFull) return '#ff4d4f';
    if (isLow) return '#faad14';
    return '#52c41a';
  };

  if (compact) {
    return (
      <Tooltip title={`${available ?? 0} of ${total} seats available`}>
        <div className="flex items-center gap-1.5">
          <TeamOutlined className="text-text-secondary" />
          <Text
            className="text-xs font-medium"
            style={{ color: getColor() }}
          >
            {available ?? 0}/{total}
          </Text>
          {isFull && <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TeamOutlined className="text-text-secondary text-sm" />
          <Text className="text-xs text-text-secondary">Capacity</Text>
        </div>
        <Text className="text-xs font-medium" style={{ color: getColor() }}>
          {available ?? 0} available
        </Text>
      </div>
      <Progress
        percent={percent}
        size="small"
        status={getStatus()}
        strokeColor={getColor()}
        showInfo={false}
      />
      <div className="flex items-center justify-between">
        <Text className="text-xs text-text-secondary">{used} enrolled</Text>
        <Text className="text-xs text-text-secondary">of {total}</Text>
      </div>
      {isFull && (
        <Text className="text-xs text-red-500 flex items-center gap-1">
          <ExclamationCircleOutlined /> Training is full
        </Text>
      )}
      {isLow && !isFull && (
        <Text className="text-xs text-orange-500 flex items-center gap-1">
          <ExclamationCircleOutlined /> Limited seats remaining
        </Text>
      )}
    </div>
  );
};

export default CapacityIndicator;
