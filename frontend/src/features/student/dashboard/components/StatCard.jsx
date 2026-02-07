import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

const StatCard = ({
  icon,
  title,
  value,
  bgClass,
  colorClass,
  borderColorClass,
  suffix,
}) => {
  return (
    <Card
      bordered={false}
      className={`group h-full rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all duration-300 cursor-default ${borderColorClass || ''}`}
      styles={{ body: { padding: '20px' } }}
    >
      <div className="flex items-center gap-5">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${bgClass}`}>
          {React.cloneElement(icon, { className: `text-2xl ${colorClass}` })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <Text className="text-3xl font-bold text-gray-900 leading-none tracking-tight">
              {value ?? 0}
            </Text>
          </div>
          <div className="flex items-center gap-1.5">
            <Text className="text-xs font-bold text-gray-400 uppercase tracking-wider truncate block">
              {title}
            </Text>
            {suffix && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-background-secondary text-gray-400 border border-gray-100`}>
                {suffix}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
