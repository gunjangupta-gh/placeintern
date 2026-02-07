// IndustryDistributionChart - Horizontal bar chart showing industry partner distribution
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Empty, Spin } from 'antd';

const COLORS = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa541c',
  '#2f54eb',
  '#a0d911',
  '#f5222d',
];

const IndustryDistributionChart = ({
  data = [],
  loading = false,
  height = 300,
  horizontal = true,
  maxItems = 10,
  valueKey = 'count',
  nameKey = 'name',
  showLabels = true,
}) => {
  // Limit data to maxItems
  const displayData = data.slice(0, maxItems);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-1">{item[nameKey]}</p>
          <p className="text-sm text-primary">
            Count: <span className="font-bold">{item[valueKey].toLocaleString()}</span>
          </p>
          {item.sector && (
            <p className="text-xs text-text-tertiary mt-1">Sector: {item.sector}</p>
          )}
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

  if (!displayData || displayData.length === 0) {
    return (
      <div className="flex justify-center items-center" style={{ height }}>
        <Empty description="No industry data available" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={displayData}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{
            top: 5,
            right: showLabels ? 80 : 30,
            left: horizontal ? 120 : 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 12, fill: 'rgb(var(--color-text-secondary))' }} />
              <YAxis
                type="category"
                dataKey={nameKey}
                tick={{ fontSize: 11, fill: 'rgb(var(--color-text-secondary))' }}
                width={110}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                tick={{ fontSize: 11, fill: 'rgb(var(--color-text-secondary))', angle: -45, textAnchor: 'end' }}
                height={80}
              />
              <YAxis type="number" tick={{ fontSize: 12, fill: 'rgb(var(--color-text-secondary))' }} />
            </>
          )}
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey={valueKey}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            barSize={20}
          >
            {displayData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
            {showLabels && (
              <LabelList
                dataKey={valueKey}
                position={horizontal ? 'right' : 'top'}
                style={{ fontSize: 11, fill: 'rgb(var(--color-text-secondary))' }}
                formatter={(value) => value.toLocaleString()}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IndustryDistributionChart;