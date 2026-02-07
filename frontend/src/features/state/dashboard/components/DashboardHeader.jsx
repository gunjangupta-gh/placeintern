import React from 'react';
import { Typography, Button, DatePicker } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const DashboardHeader = ({
  onRefresh,
  selectedMonth,
  onMonthChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <Title level={3} className="!mb-0 text-gray-900 !text-xl font-bold">
          State Directorate Dashboard
        </Title>
        <Text className="text-gray-500 text-sm">
          Comprehensive analytics and monitoring for statewide educational programs
        </Text>
      </div>

      <div className="flex items-center gap-3">
        <DatePicker.MonthPicker
          placeholder="Select Month"
          onChange={onMonthChange}
          value={selectedMonth}
          format="MMMM YYYY [(Current Month)]"
          className="w-56 h-9 rounded-lg"
          allowClear
        />

        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          className="h-9 rounded-lg font-medium"
        >
          Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default DashboardHeader;
