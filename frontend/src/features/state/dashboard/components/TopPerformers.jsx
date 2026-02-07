import React from 'react';
import { Card, Typography, Tag, Empty } from 'antd';
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons';

const { Text } = Typography;

// Performance item row for Monthly Reports
const ReportsPerformanceRow = ({ rank, item, isBottom }) => {
  const stats = item.stats || {};

  // Get reports data - matching InstitutionsTable field names
  const reportsSubmitted = stats.reportsSubmitted ?? 0;
  const reportsExpected = stats.reportsExpected ?? 0;

  // Use pre-calculated rate from backend, or calculate if not available
  const reportsRate = stats.monthlyReportRate ?? (
    reportsExpected > 0 ? Math.round((reportsSubmitted / reportsExpected) * 100) : 0
  );

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-500 font-bold';
    if (rank === 2) return 'text-gray-400 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return isBottom ? 'text-red-500' : 'text-gray-500';
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`w-5 text-sm ${getRankColor(rank)}`}>{rank}</span>
        <Text className="text-sm text-gray-700 truncate" title={item.name}>
          {item.shortName || item.name || item.institutionName || 'Unknown Institution'}
        </Text>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Text className="text-sm text-gray-500">
          {reportsSubmitted}/{reportsExpected}
        </Text>
        <Tag
          className={`m-0 text-xs px-2 py-0 rounded border-0 min-w-[40px] text-center ${
            reportsRate >= 80 ? 'bg-green-50 text-green-600' :
            reportsRate >= 50 ? 'bg-amber-50 text-amber-600' :
            'bg-red-50 text-red-500'
          }`}
        >
          {reportsRate}%
        </Tag>
      </div>
    </div>
  );
};

// Performance item row for Faculty Visits
const VisitsPerformanceRow = ({ rank, item, isBottom }) => {
  const stats = item.stats || {};

  // Get visits data - matching InstitutionsTable field names
  const facultyVisits = stats.facultyVisits ?? 0;
  const visitsExpected = stats.visitsExpected ?? 0;

  // Use pre-calculated rate from backend, or calculate if not available
  const visitsRate = stats.visitCompletionRate ?? (
    visitsExpected > 0 ? Math.round((facultyVisits / visitsExpected) * 100) : 0
  );

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-500 font-bold';
    if (rank === 2) return 'text-gray-400 font-bold';
    if (rank === 3) return 'text-amber-600 font-bold';
    return isBottom ? 'text-red-500' : 'text-gray-500';
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className={`w-5 text-sm ${getRankColor(rank)}`}>{rank}</span>
        <Text className="text-sm text-gray-700 truncate" title={item.name}>
          {item.shortName || item.name || item.institutionName || 'Unknown Institution'}
        </Text>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Text className="text-sm text-gray-500">
          {facultyVisits}/{visitsExpected}
        </Text>
        <Tag
          className={`m-0 text-xs px-2 py-0 rounded border-0 min-w-[40px] text-center ${
            visitsRate >= 80 ? 'bg-green-50 text-green-600' :
            visitsRate >= 50 ? 'bg-amber-50 text-amber-600' :
            'bg-red-50 text-red-500'
          }`}
        >
          {visitsRate}%
        </Tag>
      </div>
    </div>
  );
};

// Section header
const SectionHeader = ({ children }) => (
  <Text className="text-xs text-gray-400 font-medium block mt-4 mb-2">{children}</Text>
);

// Performance card component
const PerformanceCard = ({ title, icon, topPerformers, bottomPerformers, loading, renderRow }) => (
  <Card
    className="rounded-xl border border-gray-100 shadow-sm bg-white h-full"
    styles={{ body: { padding: '0' } }}
    loading={loading}
  >
    <div className="flex items-center gap-3 p-4 border-b border-gray-100">
      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
        {icon}
      </div>
      <Text className="font-semibold text-gray-800">{title}</Text>
    </div>

    <div className="p-4">
      <SectionHeader>Top 5 Performers</SectionHeader>
      {topPerformers?.length > 0 ? (
        <div>
          {topPerformers.slice(0, 5).map((item, index) =>
            renderRow(item, index + 1, false)
          )}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" className="!my-4" />
      )}

      {/* <SectionHeader>Bottom 5 Performers</SectionHeader>
      {bottomPerformers?.length > 0 ? (
        <div>
          {bottomPerformers.slice(0, 5).map((item, index) =>
            renderRow(item, index + 1, true)
          )}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" className="!my-4" />
      )} */}
    </div>
  </Card>
);

const TopPerformers = ({
  topPerformers = [],
  bottomPerformers = [],
  loading
}) => {
  // Sort by monthly report rate (highest first for top, lowest first for bottom)
  const sortedTopByReports = [...topPerformers]
    .filter(p => p.stats?.monthlyReportRate !== null && p.stats?.monthlyReportRate !== undefined)
    .sort((a, b) => (b.stats?.monthlyReportRate ?? 0) - (a.stats?.monthlyReportRate ?? 0));
  const sortedBottomByReports = [...bottomPerformers]
    .filter(p => p.stats?.monthlyReportRate !== null && p.stats?.monthlyReportRate !== undefined)
    .sort((a, b) => (a.stats?.monthlyReportRate ?? 0) - (b.stats?.monthlyReportRate ?? 0));

  // Sort by visit completion rate (highest first for top, lowest first for bottom)
  const sortedTopByVisits = [...topPerformers]
    .filter(p => p.stats?.visitCompletionRate !== null && p.stats?.visitCompletionRate !== undefined)
    .sort((a, b) => (b.stats?.visitCompletionRate ?? 0) - (a.stats?.visitCompletionRate ?? 0));
  const sortedBottomByVisits = [...bottomPerformers]
    .filter(p => p.stats?.visitCompletionRate !== null && p.stats?.visitCompletionRate !== undefined)
    .sort((a, b) => (a.stats?.visitCompletionRate ?? 0) - (b.stats?.visitCompletionRate ?? 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PerformanceCard
        title="Monthly Reports Performance"
        icon={<FileTextOutlined className="text-green-500" />}
        topPerformers={sortedTopByReports}
        // bottomPerformers={sortedBottomByReports}
        loading={loading}
        renderRow={(item, rank, isBottom) => (
          <ReportsPerformanceRow
            key={item.id || item.institutionId || rank}
            rank={rank}
            item={item}
            isBottom={isBottom}
          />
        )}
      />
      <PerformanceCard
        title="Faculty Visits Performance"
        icon={<EyeOutlined className="text-pink-500" />}
        topPerformers={sortedTopByVisits}
        // bottomPerformers={sortedBottomByVisits}
        loading={loading}
        renderRow={(item, rank, isBottom) => (
          <VisitsPerformanceRow
            key={item.id || item.institutionId || rank}
            rank={rank}
            item={item}
            isBottom={isBottom}
          />
        )}
      />
    </div>
  );
};

export default TopPerformers;
