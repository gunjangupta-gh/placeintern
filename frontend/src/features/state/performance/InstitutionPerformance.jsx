import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Button, DatePicker, Space, Tooltip, Card } from 'antd';
import { ReloadOutlined, FilterOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import {
  fetchInstitutionsWithStats,
  selectInstitutionsWithStats,
  selectInstitutionsWithStatsLoading,
  selectInstitutionsWithStatsMonth,
  selectInstitutionsWithStatsYear,
} from '../store/stateSlice';
import InstitutionsTable from '../dashboard/components/InstitutionsTable';

const { Title, Text } = Typography;

const InstitutionPerformance = () => {
  const dispatch = useDispatch();
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redux selectors
  const institutionsWithStats = useSelector(selectInstitutionsWithStats);
  const institutionsLoading = useSelector(selectInstitutionsWithStatsLoading);
  const institutionsMonth = useSelector(selectInstitutionsWithStatsMonth);
  const institutionsYear = useSelector(selectInstitutionsWithStatsYear);

  // Fetch initial data
  useEffect(() => {
    dispatch(fetchInstitutionsWithStats({}));
  }, [dispatch]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (selectedMonth) {
        const month = selectedMonth.month() + 1;
        const year = selectedMonth.year();
        await dispatch(fetchInstitutionsWithStats({ month, year, forceRefresh: true }));
      } else {
        await dispatch(fetchInstitutionsWithStats({ forceRefresh: true }));
      }
      toast.success('Data refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, selectedMonth]);

  // Month filter handler
  const handleMonthChange = useCallback(
    (date) => {
      setSelectedMonth(date);
      if (date) {
        const month = date.month() + 1;
        const year = date.year();
        dispatch(fetchInstitutionsWithStats({ month, year, forceRefresh: true }));
        toast(`Filtering data for ${date.format('MMMM YYYY')}`);
      } else {
        dispatch(fetchInstitutionsWithStats({ forceRefresh: true }));
        toast('Showing all-time data');
      }
    },
    [dispatch]
  );

  return (
    <div className="p-4 md:p-6 bg-background-secondary min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <Title level={4} className="!mb-1 text-text-primary">
            Institution Performance
          </Title>
          <Text className="text-text-secondary text-sm">
            Monitor and compare performance metrics across all institutions
          </Text>
        </div>

        <Space wrap>
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            placeholder="Filter by month"
            allowClear
            className="w-40"
            suffixIcon={<FilterOutlined />}
          />
          <Tooltip title="Refresh data">
            <Button
              icon={<ReloadOutlined spin={isRefreshing} />}
              onClick={handleRefresh}
              loading={isRefreshing}
            >
              Refresh
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Institution Performance Table */}
      <InstitutionsTable
        institutions={institutionsWithStats}
        loading={institutionsLoading}
        month={institutionsMonth}
        year={institutionsYear}
      />
    </div>
  );
};

export default InstitutionPerformance;
