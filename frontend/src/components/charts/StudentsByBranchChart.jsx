// StudentsByBranchChart - Bar chart showing student distribution by branch/department
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Empty, Spin } from 'antd';

const COLORS = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
  '#a0d911',
  '#2f54eb',
];

const StudentsByBranchChart = ({
  data = [],
  loading = false,
  height = 350,
  showLegend = true,
  barSize = 40,
}) => {
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface p-3 shadow-lg rounded-xl border border-border">
          <p className="font-semibold text-text-primary mb-1">{label}</p>
          <p className="text-primary text-sm">
            Students: <span className="font-bold">{payload[0].value.toLocaleString()}</span>
          </p>
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
        <Empty description="No data available" />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={60}
            interval={0}
            tick={{ fontSize: 12, fill: '#666' }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#666' }}
            label={{
              value: 'Number of Students',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#666' },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend wrapperStyle={{ paddingTop: 20 }} />}
          <Bar
            dataKey="value"
            name="Student Count"
            radius={[4, 4, 0, 0]}
            barSize={barSize}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color || COLORS[index % COLORS.length]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StudentsByBranchChart;