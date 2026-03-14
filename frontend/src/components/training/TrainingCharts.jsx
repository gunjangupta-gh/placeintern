import React from 'react';
import { Card, Typography } from 'antd';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const { Title, Text } = Typography;

// Color palette for charts
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  purple: '#8B5CF6',
  cyan: '#06B6D4',
  pink: '#EC4899',
  slate: '#64748B',
};

const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.cyan];

/**
 * Bar chart for training participation
 */
export const ParticipationBarChart = ({
  data = [],
  title = 'Monthly Participation',
  dataKey = 'value',
  nameKey = 'name',
  height = 300,
  showLegend = true,
}) => {
  if (!data.length) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <div className="h-64 flex items-center justify-center">
          <Text type="secondary">No data available</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border shadow-none">
      <Title level={5} className="!mb-4">{title}</Title>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey={nameKey} tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          {showLegend && <Legend />}
          <Bar dataKey={dataKey} fill={COLORS.primary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Line chart for training trends
 */
export const TrainingTrendChart = ({
  data = [],
  title = 'Training Trends',
  lines = [{ dataKey: 'value', name: 'Value', color: COLORS.primary }],
  height = 300,
}) => {
  if (!data.length) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <div className="h-64 flex items-center justify-center">
          <Text type="secondary">No data available</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border shadow-none">
      <Title level={5} className="!mb-4">{title}</Title>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
          />
          <Legend />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              name={line.name}
              stroke={line.color}
              strokeWidth={2}
              dot={{ fill: line.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Pie/Donut chart for distribution
 */
export const DistributionPieChart = ({
  data = [],
  title = 'Distribution',
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
}) => {
  if (!data.length) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <div className="h-64 flex items-center justify-center">
          <Text type="secondary">No data available</Text>
        </div>
      </Card>
    );
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <Card className="rounded-xl border-border shadow-none">
      <Title level={5} className="!mb-4">{title}</Title>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={{ stroke: '#64748B', strokeWidth: 1 }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
            formatter={(value, name) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, name]}
          />
          {showLegend && <Legend />}
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Stacked bar chart for comparison
 */
export const ComparisonBarChart = ({
  data = [],
  title = 'Comparison',
  bars = [
    { dataKey: 'approved', name: 'Approved', color: COLORS.success },
    { dataKey: 'pending', name: 'Pending', color: COLORS.warning },
    { dataKey: 'rejected', name: 'Rejected', color: COLORS.error },
  ],
  height = 300,
  stacked = true,
}) => {
  if (!data.length) {
    return (
      <Card className="rounded-xl border-border shadow-none">
        <div className="h-64 flex items-center justify-center">
          <Text type="secondary">No data available</Text>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border shadow-none">
      <Title level={5} className="!mb-4">{title}</Title>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748B' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {bars.map((bar) => (
            <Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              stackId={stacked ? 'stack' : undefined}
              radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

/**
 * Simple stat box with mini chart
 */
export const MiniTrendStat = ({
  title,
  value,
  trend,
  trendData = [],
  color = COLORS.primary,
}) => {
  const isPositive = trend >= 0;

  return (
    <Card className="rounded-xl border-border shadow-none" styles={{ body: { padding: 16 } }}>
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-text-secondary text-xs block mb-1">{title}</Text>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">{value}</span>
            {trend !== undefined && (
              <span className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{trend}%
              </span>
            )}
          </div>
        </div>
        {trendData.length > 0 && (
          <div className="w-20 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
};

export default {
  ParticipationBarChart,
  TrainingTrendChart,
  DistributionPieChart,
  ComparisonBarChart,
  MiniTrendStat,
};
