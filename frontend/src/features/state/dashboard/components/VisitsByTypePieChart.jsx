import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Spin, Empty, Typography } from 'antd';
import { PieChartOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  fetchVisitsByType,
  selectVisitsByType,
  selectVisitsByTypeLoading,
} from '../../store/stateSlice';

const { Text } = Typography;

const VisitsByTypePieChart = ({ selectedMonth }) => {
  const dispatch = useDispatch();
  const visitsByType = useSelector(selectVisitsByType);
  const loading = useSelector(selectVisitsByTypeLoading);

  // Fetch data when component mounts or selectedMonth changes
  useEffect(() => {
    const params = {};
    if (selectedMonth) {
      params.month = selectedMonth.month() + 1;
      params.year = selectedMonth.year();
      params.forceRefresh = true;
    }
    dispatch(fetchVisitsByType(params));
  }, [dispatch, selectedMonth]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({
    cx, cy, midAngle, innerRadius, outerRadius, percent
  }) => {
    if (percent === 0) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const total = visitsByType?.total || 0;
      const percentage = total > 0 ? ((data.count / total) * 100).toFixed(1) : 0;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800 mb-1">{data.label}</p>
          <p className="text-sm text-gray-600">
            Count: <span className="text-gray-800 font-medium">{data.count}</span>
          </p>
          <p className="text-sm text-gray-600">
            Percentage: <span className="text-gray-800 font-medium">{percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div className="flex justify-center gap-4 mt-2">
        {payload.map((entry, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-gray-600">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="rounded-xl border border-gray-100 shadow-sm bg-white h-full">
        <div className="flex justify-center items-center h-full min-h-[150px]">
          <Spin />
        </div>
      </Card>
    );
  }

  const chartData = visitsByType?.data || [];
  const total = visitsByType?.total || 0;
  const hasData = total > 0;

  return (
    <Card
      className="rounded-xl border border-gray-100 shadow-sm bg-white h-full"
      styles={{ body: { padding: '0', height: '100%', display: 'flex', flexDirection: 'column' } }}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <PieChartOutlined className="text-blue-500" />
          </div>
          <div>
            <Text className="font-semibold text-gray-800 block">Visits by Type</Text>
            <Text className="text-xs text-gray-500">
              Total: {total} visit{total !== 1 ? 's' : ''}
            </Text>
          </div>
        </div>
      </div>

      <div className="p-4 flex-1 flex items-center justify-center">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={150}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={70}
                innerRadius={35}
                fill="#8884d8"
                dataKey="count"
                nameKey="label"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Empty description="No visit data available" className="!my-8" />
        )}
      </div>
    </Card>
  );
};

export default VisitsByTypePieChart;
