import React from 'react';
import { Typography, Button, Tooltip, theme } from 'antd';
import {
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const DashboardHeader = ({ facultyName, stats, onRefresh, loading, lastFetched }) => {
  const { token } = theme.useToken();
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center !gap-4 !mb-4">
      <div className="flex items-center">
        <div>
          <div className="flex items-center gap-3">
            <Title level={4} className="!mb-0 !text-xl" style={{ color: token.colorText }}>
              Faculty Dashboard
            </Title>
            {lastFetched && (
              <span className="text-[10px]" style={{ color: token.colorTextDescription }}>
                Updated {new Date(lastFetched).toLocaleTimeString()}
              </span>
            )}
          </div>
          <Paragraph className="!mb-0 !text-xs" style={{ color: token.colorTextSecondary }}>
            Welcome back, <span className="font-semibold" style={{ color: token.colorPrimary }}>{facultyName || 'Faculty'}</span> • {currentDate}
          </Paragraph>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Tooltip title="Refresh Data">
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={onRefresh}
            className="w-8 h-8 flex items-center justify-center !rounded-lg shadow-sm hover:scale-105 active:scale-95 transition-all duration-200"
            style={{ 
              backgroundColor: token.colorBgContainer, 
              borderColor: token.colorBorder,
              color: token.colorTextSecondary
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DashboardHeader;