import React from 'react';
import { Typography, Button, Tooltip } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;

const DashboardHeader = ({ studentName, onRefresh, loading, isRevalidating }) => {
  const currentDate = dayjs().format('dddd, MMMM D, YYYY');

  return (
    <div className="flex justify-between items-center mb-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary m-0">
          Welcome, {studentName || 'Student'}
        </h1>
        <Text className="text-xs text-text-tertiary">{currentDate}</Text>
      </div>

      <Tooltip title="Refresh">
        <Button
          type="text"
          icon={<ReloadOutlined spin={loading || isRevalidating} />}
          onClick={onRefresh}
          className="rounded-lg"
        />
      </Tooltip>
    </div>
  );
};

export default DashboardHeader;
