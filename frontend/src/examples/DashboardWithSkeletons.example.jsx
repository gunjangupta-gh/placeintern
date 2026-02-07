/**
 * Example: Dashboard Component with Skeleton Loading States
 *
 * This example demonstrates how to integrate skeleton loaders
 * into a dashboard component for better UX during data loading.
 */

import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Row, Col, Card } from 'antd';
import SkeletonLoader from '../components/common/SkeletonLoader';

// Example of a dashboard component with proper skeleton loading states
const DashboardWithSkeletons = () => {
  const dispatch = useDispatch();
  const { stats, loading, error } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  // Show error state
  if (error && !loading) {
    return <ErrorDisplay error={error} />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        {loading ? (
          <SkeletonLoader.Input style={{ width: 250, height: 32 }} />
        ) : (
          <h1 className="text-2xl font-bold">Dashboard</h1>
        )}
      </div>

      {/* Stats Grid - Show skeletons when loading */}
      <Row gutter={[16, 16]}>
        {loading && !stats ? (
          // Show skeleton cards while loading
          Array.from({ length: 4 }).map((_, idx) => (
            <Col key={idx} xs={24} sm={12} lg={6}>
              <SkeletonLoader.StatCard />
            </Col>
          ))
        ) : (
          // Show actual data once loaded
          stats?.map((stat, idx) => (
            <Col key={idx} xs={24} sm={12} lg={6}>
              <StatCard data={stat} />
            </Col>
          ))
        )}
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {loading && !stats ? (
            <SkeletonLoader.ChartCard title="Performance Metrics" />
          ) : (
            <ChartCard data={stats?.metrics} />
          )}
        </Col>

        <Col xs={24} lg={12}>
          {loading && !stats ? (
            <SkeletonLoader.ChartCard title="User Activity" />
          ) : (
            <ChartCard data={stats?.activity} />
          )}
        </Col>
      </Row>

      {/* Recent Items List */}
      <Card title="Recent Activity">
        {loading && !stats?.recentItems ? (
          <SkeletonLoader.ListItem count={5} />
        ) : (
          <RecentItemsList items={stats?.recentItems} />
        )}
      </Card>
    </div>
  );
};

export default DashboardWithSkeletons;

/**
 * Best Practices:
 *
 * 1. Check both loading AND data existence
 *    ✓ loading && !stats
 *    ✗ loading (would show skeleton even if data exists)
 *
 * 2. Match skeleton structure to actual content
 *    - Same number of skeleton cards as data cards
 *    - Same grid layout and spacing
 *
 * 3. Use specific skeleton components
 *    - StatCard for dashboard cards
 *    - ChartCard for charts
 *    - ListItem for lists
 *
 * 4. Handle errors separately
 *    - Don't show skeleton on error
 *    - Show error UI instead
 *
 * 5. Progressive enhancement
 *    - Show partial data while rest loads
 *    - Update skeletons section by section
 */
