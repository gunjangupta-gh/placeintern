import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Spin, Typography } from 'antd';
import { toast } from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDashboardStats,
  fetchTopPerformers,
  fetchMonthlyAnalytics,
  fetchTopIndustries,
  fetchVisitsByType,
  selectDashboardStats,
  selectDashboardLoading,
  selectTopPerformers,
  selectBottomPerformers,
  selectTopIndustries,
  selectTopPerformersLoading,
  selectTopIndustriesLoading,
} from '../store/stateSlice';
import { fetchStateTrainingDashboard } from '../store/stateTrainingSlice';
import {
  DashboardHeader,
  StatisticsCards,
  TopPerformers,
  JoiningLetterTracker,
  VisitsByTypePieChart,
  TopIndustriesList,
  CourseWiseFacultyTable,
} from './components';

const { Text } = Typography;

const StateDashboard = () => {
  const dispatch = useDispatch();

  // Use Redux selectors for data
  const stats = useSelector(selectDashboardStats);
  const loading = useSelector(selectDashboardLoading);

  // Analytics selectors
  const topPerformers = useSelector(selectTopPerformers);
  const bottomPerformers = useSelector(selectBottomPerformers);
  const topIndustries = useSelector(selectTopIndustries);
  const performersLoading = useSelector(selectTopPerformersLoading);
  const industriesLoading = useSelector(selectTopIndustriesLoading);
  const trainingDashboard = useSelector((state) => state.stateTraining?.reports?.dashboard);
  const trainingDashboardLoading = useSelector((state) => state.stateTraining?.reports?.loading);

  const [selectedMonth, setSelectedMonth] = useState(null);

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchDashboardStats());
    dispatch(fetchTopPerformers());
    dispatch(fetchMonthlyAnalytics());
    dispatch(fetchTopIndustries({ limit: 10 }));
    dispatch(fetchVisitsByType());
    dispatch(fetchStateTrainingDashboard());
  }, [dispatch]);

  // Refresh handler
  const handleRefresh = useCallback(() => {
    dispatch(fetchDashboardStats({ forceRefresh: true }));
    dispatch(fetchTopPerformers({ forceRefresh: true }));
    dispatch(fetchMonthlyAnalytics({ forceRefresh: true }));
    dispatch(fetchTopIndustries({ limit: 10, forceRefresh: true }));
    dispatch(fetchVisitsByType({ forceRefresh: true }));
    dispatch(fetchStateTrainingDashboard());
    toast.success('Dashboard refreshed');
  }, [dispatch]);

  // Month filter handler
  const handleMonthChange = useCallback(
    (date) => {
      setSelectedMonth(date);
      if (date) {
        const month = date.month() + 1;
        const year = date.year();
        const filterParams = { month, year, forceRefresh: true };

        dispatch(fetchDashboardStats(filterParams));
        dispatch(fetchMonthlyAnalytics(filterParams));
        dispatch(fetchTopPerformers(filterParams));
        dispatch(fetchTopIndustries({ ...filterParams, limit: 10 }));
        dispatch(fetchVisitsByType(filterParams));

        toast(`Filtering data for ${date.format('MMMM YYYY')}`);
      } else {
        const refreshParams = { forceRefresh: true };
        dispatch(fetchDashboardStats(refreshParams));
        dispatch(fetchMonthlyAnalytics(refreshParams));
        dispatch(fetchTopPerformers(refreshParams));
        dispatch(fetchTopIndustries({ ...refreshParams, limit: 10 }));
        dispatch(fetchVisitsByType(refreshParams));

        toast('Showing all-time data');
      }
    },
    [dispatch]
  );

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 gap-4">
        <Spin size="large" />
        <Text className="text-gray-500 animate-pulse">Loading dashboard...</Text>
      </div>
    );
  }

  return (
    <div className="state-dashboard p-4 md:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <DashboardHeader
        onRefresh={handleRefresh}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
      />

      {/* Statistics Cards */}
      <div className="mb-6">
        <StatisticsCards
          stats={stats}
          selectedMonth={selectedMonth}
          trainingDashboard={trainingDashboard}
          trainingLoading={trainingDashboardLoading}
        />
      </div>

      {/* Performance Tables */}
      <div className="mb-6">
        <TopPerformers
          topPerformers={topPerformers}
          bottomPerformers={bottomPerformers}
          loading={performersLoading}
        />
      </div>

      {/* Bottom Section: Industries + Joining Report + Visits by Type */}
      <Row gutter={[16, 16]} className="items-stretch">
        <Col xs={24} lg={12} className="flex">
          <div className="w-full" style={{ height: '520px' }}>
            <TopIndustriesList
              industries={topIndustries}
              loading={industriesLoading}
            />
          </div>
        </Col>
        <Col xs={24} lg={12} className="flex">
          <div className="flex flex-col gap-4 w-full" style={{ height: '520px' }}>
            <JoiningLetterTracker selectedMonth={selectedMonth} />
            <div className="flex-1">
              <VisitsByTypePieChart selectedMonth={selectedMonth} />
            </div>
          </div>
        </Col>
      </Row>

      <div className="mt-4">
        <CourseWiseFacultyTable
          rows={trainingDashboard?.courseWiseFaculty || []}
          loading={trainingDashboardLoading}
        />
      </div>
    </div>
  );
};

export default StateDashboard;
