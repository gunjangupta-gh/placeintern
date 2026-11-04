import React from 'react';
import { Card, Typography, Tag, Empty, Badge } from 'antd';
import { ShopOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Industry item row
const IndustryRow = ({ rank, item }) => {
  const getRankBg = (rank) => {
    if (rank === 1) return 'bg-yellow-400';
    if (rank === 2) return 'bg-gray-400';
    if (rank === 3) return 'bg-amber-600';
    return 'bg-background-tertiary';
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-6 h-6 rounded-full ${getRankBg(rank)} flex items-center justify-center shrink-0`}>
          <span className={`text-xs font-bold ${rank <= 3 ? 'text-white' : 'text-text-secondary'}`}>{rank}</span>
        </div>
        <div className="min-w-0">
          <Text className="text-sm font-medium text-text-primary block truncate">{item.name}</Text>
          <Text className="text-xs text-text-tertiary">
            Total: {item.internsHired || item.total || 0}  Active: {item.activeInterns || item.active || item.internsHired || 0}
          </Text>
        </div>
      </div>
      <Tag className="m-0 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-0 text-xs px-2 rounded">
        Active
      </Tag>
    </div>
  );
};

const TopIndustriesList = ({ industries = [], loading }) => {
  const totalCount = industries?.length || 0;

  return (
    <Card
      className="rounded-xl border border-border shadow-sm bg-background h-full"
      styles={{ body: { padding: '0', height: '100%', display: 'flex', flexDirection: 'column' } }}
      loading={loading}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <ShopOutlined className="text-blue-500" />
          </div>
          <Text className="font-semibold text-text-primary">Top Industries</Text>
        </div>
        <Badge
          count={totalCount}
          showZero
          style={{ backgroundColor: '#3b82f6' }}
        />
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {industries?.length > 0 ? (
          <div>
            {industries.map((item, index) => (
              <IndustryRow
                key={item.id || index}
                rank={index + 1}
                item={item}
              />
            ))}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No industries data"
            className="!my-8"
          />
        )}
      </div>
    </Card>
  );
};

export default TopIndustriesList;
