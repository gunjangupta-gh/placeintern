import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const UserDistributionPieChart = ({ facultyCount, studentCount }) => {
  const data = [
    { name: 'Faculty & Staff', value: facultyCount, color: '#1890ff' },
    { name: 'Students', value: studentCount, color: '#fa8c16' },
  ];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total = facultyCount + studentCount;
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <div className="bg-surface p-3 border border-border rounded-xl shadow-lg">
          <p className="font-semibold text-text-primary mb-1">{data.name}</p>
          <p className="text-sm text-text-secondary">Count: <span className="text-text-primary font-medium">{data.value}</span></p>
          <p className="text-sm text-text-secondary">Percentage: <span className="text-text-primary font-medium">{percentage}%</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={100}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        {/* <Legend /> */}
      </PieChart>
    </ResponsiveContainer>
  );
};

export default UserDistributionPieChart;