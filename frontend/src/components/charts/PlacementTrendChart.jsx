// InternshipTrendChart - Line chart showing internship application trends over time
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { Empty, Spin } from 'antd';

const PlacementTrendChart = ({
  data = [],
  loading = false,
  height = 300,
  showArea = true,
  // Support both old and new data keys
  approvedKey = 'approved',
  applicationsKey = 'applications',
  colors = {
    approved: '#52c41a',
    placements: '#52c41a',
    applications: '#1890ff',
    rejections: '#ff4d4f',
  },
}) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: <span className="font-bold">{entry.value.toLocaleString()}</span>
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
        <Empty description="No trend data available" />
      </div>
    );
  }

  const ChartComponent = showArea ? AreaChart : LineChart;
  const DataComponent = showArea ? Area : Line;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#666' }}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#666' }}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: 10 }} />
          {showArea ? (
            <>
              <Area
                type="monotone"
                dataKey={approvedKey}
                name="Approved"
                stroke={colors.approved || colors.placements}
                fill={colors.approved || colors.placements}
                fillOpacity={0.3}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey={applicationsKey}
                name="Applications"
                stroke={colors.applications}
                fill={colors.applications}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey={approvedKey}
                name="Approved"
                stroke={colors.approved || colors.placements}
                strokeWidth={2}
                dot={{ fill: colors.approved || colors.placements, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey={applicationsKey}
                name="Applications"
                stroke={colors.applications}
                strokeWidth={2}
                dot={{ fill: colors.applications, strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};

export default PlacementTrendChart;