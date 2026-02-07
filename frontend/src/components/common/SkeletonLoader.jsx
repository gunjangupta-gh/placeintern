import React from 'react';
import { Card, Skeleton, Row, Col } from 'antd';

/**
 * Skeleton loader for dashboard stat cards
 */
export const StatCardSkeleton = () => (
  <Card className="h-full border-border shadow-sm rounded-xl">
    <div className="flex items-center gap-4">
      <Skeleton.Avatar active size={48} shape="square" />
      <div className="flex-1">
        <Skeleton.Input active size="small" style={{ width: 60, marginBottom: 8 }} />
        <Skeleton.Input active size="small" style={{ width: 100 }} />
      </div>
    </div>
  </Card>
);

/**
 * Skeleton loader for dashboard charts
 */
export const ChartCardSkeleton = ({ title }) => (
  <Card
    title={title}
    className="border-border shadow-sm rounded-xl"
    styles={{ body: { padding: '20px' } }}
  >
    <div className="h-80">
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  </Card>
);

/**
 * Skeleton loader for metric cards
 */
export const MetricCardSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="text-center p-3 bg-gray-100 rounded-lg">
          <Skeleton.Input active size="small" style={{ width: 60, marginBottom: 4 }} />
          <Skeleton.Input active size="small" style={{ width: 80 }} />
        </div>
      ))}
    </div>
    <Skeleton.Input active style={{ width: '100%', height: 8 }} />
  </div>
);

/**
 * Skeleton loader for list items
 */
export const ListItemSkeleton = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
        <Skeleton.Avatar active size={40} />
        <div className="flex-1">
          <Skeleton.Input active size="small" style={{ width: '60%', marginBottom: 4 }} />
          <Skeleton.Input active size="small" style={{ width: '40%' }} />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for table
 */
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="flex gap-4">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} className="flex-1">
            <Skeleton.Input active style={{ width: '100%' }} />
          </div>
        ))}
      </div>
    ))}
  </div>
);

/**
 * Skeleton loader for dashboard grid layout
 */
export const DashboardGridSkeleton = () => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex justify-between items-center">
      <Skeleton.Input active style={{ width: 250, height: 32 }} />
      <Skeleton.Button active />
    </div>

    {/* Stats Grid */}
    <Row gutter={[16, 16]}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <Col key={idx} xs={24} sm={12} lg={6}>
          <StatCardSkeleton />
        </Col>
      ))}
    </Row>

    {/* Content Grid */}
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card className="border-border shadow-sm rounded-xl">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card className="border-border shadow-sm rounded-xl">
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </Col>
    </Row>
  </div>
);

export default {
  StatCard: StatCardSkeleton,
  ChartCard: ChartCardSkeleton,
  MetricCard: MetricCardSkeleton,
  ListItem: ListItemSkeleton,
  Table: TableSkeleton,
  DashboardGrid: DashboardGridSkeleton,
};
