import React from 'react';
import { Typography } from 'antd';
import { CheckCircleOutlined, BulbOutlined } from '@ant-design/icons';

const { Text } = Typography;

const LearningOutcomesList = ({ outcomes = [], showIcon = true, compact = false }) => {
  if (!outcomes.length) {
    return (
      <div className="flex items-center gap-2 text-text-secondary py-2">
        <BulbOutlined />
        <Text type="secondary">No learning outcomes listed.</Text>
      </div>
    );
  }

  return (
    <ul className={`space-y-${compact ? '1' : '2'} list-none p-0 m-0`}>
      {outcomes.map((item, index) => (
        <li key={index} className="flex items-start gap-2">
          {showIcon && (
            <CheckCircleOutlined className="text-green-500 mt-1 shrink-0" />
          )}
          <Text className={compact ? 'text-xs' : 'text-sm'}>{item}</Text>
        </li>
      ))}
    </ul>
  );
};

export default LearningOutcomesList;
