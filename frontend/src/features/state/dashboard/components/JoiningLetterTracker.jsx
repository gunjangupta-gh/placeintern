import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card, Progress, Spin, Empty, Typography } from 'antd';
import { BankOutlined, EyeOutlined } from '@ant-design/icons';
import {
  fetchJoiningLetterStats,
  selectJoiningLetterStats,
  selectJoiningLettersLoading,
  selectDashboardStats,
} from '../../store/stateSlice';

const { Text } = Typography;

// Progress metric component
const ProgressMetric = ({ label, current, total, color }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex-1">
      <Text className="text-xs text-text-tertiary block mb-1">{label}</Text>
      <div className="flex items-baseline gap-2 mb-2">
        <Text className="text-lg font-bold text-text-primary">
          {current.toLocaleString()} / {total.toLocaleString()}
        </Text>
        <Text className={`text-lg font-bold ${color}`}>{percent}%</Text>
      </div>
      <Progress
        percent={percent}
        showInfo={false}
        strokeColor={color === 'text-green-600 dark:text-green-400' ? '#22c55e' : color === 'text-blue-600 dark:text-blue-400' ? '#3b82f6' : '#f59e0b'}
        trailColor="rgb(var(--color-border))"
        size="small"
        className="!m-0"
      />
    </div>
  );
};

const JoiningLetterTracker = ({ selectedMonth }) => {
  const dispatch = useDispatch();
  const stats = useSelector(selectJoiningLetterStats);
  const dashboardStats = useSelector(selectDashboardStats);
  const loading = useSelector(selectJoiningLettersLoading);

  // Fetch data when component mounts or selectedMonth changes
  useEffect(() => {
    const params = {};
    if (selectedMonth) {
      params.month = selectedMonth.month() + 1;
      params.year = selectedMonth.year();
      params.forceRefresh = true;
    }
    dispatch(fetchJoiningLetterStats(params));
  }, [dispatch, selectedMonth]);

  if (loading) {
    return (
      <Card className="rounded-xl border border-border/50 shadow-sm bg-background">
        <div className="flex justify-center items-center h-16">
          <Spin />
        </div>
      </Card>
    );
  }

  const { summary } = stats || {};

  // Joining Report data
  const lettersUploaded = summary?.uploaded || 0;
  const lettersTotal = summary?.total || 0;
  const uploadRate = summary?.uploadRate || 0;

  // Student mapping data (using dashboard stats which is already filtered)
  const assignments = dashboardStats?.assignments || {};
  const studentsWithMentors = assignments?.activeStudentsWithMentors || assignments?.assigned || 0;
  const totalActiveStudents = assignments?.activeStudents || dashboardStats?.students?.active || 0;

  return (
    <Card
      className="rounded-xl border border-border/50 shadow-sm bg-background"
      styles={{ body: { padding: '0' } }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <BankOutlined className="text-amber-500" />
          </div>
          <Text className="font-semibold text-text-primary">Joining Report & Student Mapping</Text>
        </div>
        <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-background-tertiary transition-colors">
          <EyeOutlined className="text-text-tertiary text-sm" />
        </button>
      </div>

      <div className="p-4">
        {lettersTotal > 0 || totalActiveStudents > 0 ? (
          <div className="flex gap-8">
            <ProgressMetric
              label="Joining Reports Submitted"
              current={lettersUploaded}
              total={lettersTotal}
              color={uploadRate >= 80 ? 'text-green-600 dark:text-green-400' : uploadRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500'}
            />
            <ProgressMetric
              label="Students Mapped to Faculty"
              current={studentsWithMentors}
              total={totalActiveStudents}
              color="text-blue-600 dark:text-blue-400"
            />
          </div>
        ) : (
          <Empty description="No data available" className="!my-4" />
        )}
      </div>
    </Card>
  );
};

export default JoiningLetterTracker;
