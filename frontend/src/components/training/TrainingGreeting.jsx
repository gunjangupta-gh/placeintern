import React from 'react';
import { Typography } from 'antd';
import {
  SunOutlined,
  CloudOutlined,
  MoonOutlined,
  CoffeeOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * Time-based greeting component for dashboards
 */
const TrainingGreeting = ({
  userName,
  subtitle,
  showIcon = true,
  className = ''
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
      return {
        text: 'Good morning',
        icon: <SunOutlined className="text-amber-500" />,
        emoji: null,
      };
    } else if (hour >= 12 && hour < 17) {
      return {
        text: 'Good afternoon',
        icon: <CloudOutlined className="text-blue-500" />,
        emoji: null,
      };
    } else if (hour >= 17 && hour < 21) {
      return {
        text: 'Good evening',
        icon: <CoffeeOutlined className="text-orange-500" />,
        emoji: null,
      };
    } else {
      return {
        text: 'Good evening',
        icon: <MoonOutlined className="text-indigo-500" />,
        emoji: null,
      };
    }
  };

  const greeting = getGreeting();
  const displayName = userName ? `, ${userName.split(' ')[0]}` : '';

  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {showIcon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-xl">
          {greeting.icon}
        </div>
      )}
      <div>
        <Title level={3} className="!mb-1 !mt-0">
          {greeting.text}{displayName}!
        </Title>
        {subtitle && (
          <Text className="text-text-secondary">
            {subtitle}
          </Text>
        )}
      </div>
    </div>
  );
};

export default TrainingGreeting;
