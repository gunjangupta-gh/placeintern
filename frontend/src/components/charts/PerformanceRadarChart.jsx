// PerformanceRadarChart - Radar chart for multi-dimensional performance metrics
import React from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Empty, Spin } from 'antd';

const PerformanceRadarChart = ({
  data = [],
  loading = false,
  height = 300,
  colors = {
    current: '#1890ff',
    target: '#52c41a',
    previous: '#faad14',
  },
  showTarget = true,
  showPrevious = false,
  fillOpacity = 0.3,
}) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const metric = payload[0].payload;
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-2">{metric.subject}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-bold">{entry.value}%</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ height }}>
        <Spin size="large" tip="Loading chart..." />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex justify-center items-center" style={{ height }}>
        <Empty description="No performance data available" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={data}
        >
          <PolarGrid stroke="#e0e0e0" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: '#666' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#999' }}
            tickCount={5}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 10 }}
            iconType="circle"
          />
          <Radar
            name="Current"
            dataKey="current"
            stroke={colors.current}
            fill={colors.current}
            fillOpacity={fillOpacity}
            strokeWidth={2}
          />
          {showTarget && (
            <Radar
              name="Target"
              dataKey="target"
              stroke={colors.target}
              fill={colors.target}
              fillOpacity={fillOpacity * 0.5}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          {showPrevious && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke={colors.previous}
              fill={colors.previous}
              fillOpacity={fillOpacity * 0.3}
              strokeWidth={1}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceRadarChart;