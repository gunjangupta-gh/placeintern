import React from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const LoadingSpinner = ({ size = 'large', fullScreen = false, tip = 'Loading...' }) => {
  const antIcon = <LoadingOutlined style={{ fontSize: size === 'large' ? 48 : 24 }} spin />;

  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background-secondary gap-4">
        <Spin indicator={antIcon} size={size} />
        <div className="text-text-secondary font-medium animate-pulse">{tip}</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Spin indicator={antIcon} size={size} tip={tip} />
    </div>
  );
};

export default LoadingSpinner;