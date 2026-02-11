import React from 'react';
import { Space, Typography } from 'antd';

const { Text } = Typography;

const legendItems = [
  { color: '#3B82F6', label: 'Online', key: 'online' },
  { color: '#10B981', label: 'In-Person', key: 'offline' },
  { color: '#06B6D4', label: 'Hybrid', key: 'hybrid' },
];

const statusItems = [
  { color: '#22C55E', label: 'Published', key: 'published' },
  { color: '#F59E0B', label: 'Draft', key: 'draft' },
];

const LegendItem = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <span
      className="w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
    <Text className="text-xs text-text-secondary">{label}</Text>
  </div>
);

/**
 * Calendar legend showing color codes for different training types
 */
const CalendarLegend = ({
  showDeliveryModes = true,
  showStatus = false,
  className = '',
  layout = 'horizontal', // 'horizontal' | 'vertical'
}) => {
  const items = [
    ...(showDeliveryModes ? legendItems : []),
    ...(showStatus ? statusItems : []),
  ];

  if (items.length === 0) return null;

  const isVertical = layout === 'vertical';

  return (
    <div className={`${className}`}>
      <Text className="text-xs font-medium text-text-tertiary uppercase tracking-wide block mb-2">
        Legend
      </Text>
      <Space
        direction={isVertical ? 'vertical' : 'horizontal'}
        size={isVertical ? 8 : 16}
        wrap
      >
        {items.map((item) => (
          <LegendItem key={item.key} color={item.color} label={item.label} />
        ))}
      </Space>
    </div>
  );
};

export default CalendarLegend;
