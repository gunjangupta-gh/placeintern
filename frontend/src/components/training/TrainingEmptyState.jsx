import React from 'react';
import { Button, Empty, Typography } from 'antd';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

const TrainingEmptyState = ({
  message = 'No trainings found.',
  description,
  icon,
  actionText,
  onAction,
  type = 'default',
}) => {
  const getIcon = () => {
    if (icon) return icon;
    return (
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4">
        <CalendarOutlined className="text-3xl text-gray-400" />
      </div>
    );
  };

  const getDescription = () => {
    if (description) return description;
    switch (type) {
      case 'applications':
        return 'You have not applied to any training sessions yet.';
      case 'lesson-plans':
        return 'No lesson plans have been created yet.';
      case 'certificates':
        return 'You have not earned any certificates yet.';
      case 'feedback':
        return 'No feedback responses recorded.';
      default:
        return null;
    }
  };

  return (
    <div className="py-8 text-center">
      {getIcon()}
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div className="space-y-1">
            <Text className="text-text-primary font-medium block">{message}</Text>
            {getDescription() && (
              <Text className="text-text-secondary text-sm block">{getDescription()}</Text>
            )}
          </div>
        }
      >
        {actionText && onAction && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
};

export default TrainingEmptyState;
