import React, { useState, useMemo } from 'react';
import { Card, Tooltip, Tag } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FileProtectOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import MonthlyReportsOverviewModal from './MonthlyReportsOverviewModal';
import VisitLogsOverviewModal from './VisitLogsOverviewModal';
import JoiningLettersOverviewModal from './JoiningLettersOverviewModal';

// Compact Stat Card Component
const StatCard = ({
  title,
  value,
  secondaryValue,
  icon,
  iconBgColor,
  iconColor,
  valueColor,
  subtitle,
  hasViewMore,
  onViewMore,
}) => {
  return (
    <Card
      className="!rounded-lg border !border-gray-100 hover:shadow-md transition-all duration-200 h-full relative"
      bodyStyle={{ padding: '14px 16px' }}
      size="small"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBgColor }}
        >
          {React.cloneElement(icon, {
            style: { fontSize: '18px', color: iconColor },
          })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5 truncate">
            {title}
          </div>
          <div className="flex items-baseline gap-1">
            {secondaryValue !== undefined ? (
              <>
                <span style={{ fontSize: '20px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
                  {value}
                </span>
                <span style={{ fontSize: '14px', color: '#d1d5db' }}>/</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af' }}>
                  {secondaryValue}
                </span>
              </>
            ) : (
              <span style={{ fontSize: '20px', fontWeight: 700, color: valueColor, lineHeight: 1 }}>
                {value}
              </span>
            )}
          </div>
          {subtitle && (
            <div className="text-[10px] text-gray-400 mt-0.5 truncate">{subtitle}</div>
          )}
        </div>

        {/* Eye Icon for View More */}
        {hasViewMore && (
          <Tooltip title="View Details">
            <button
              onClick={onViewMore}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent flex-shrink-0"
            >
              <EyeOutlined style={{ fontSize: '14px', color: '#9ca3af' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </Card>
  );
};

const StatisticsGrid = ({ stats = {}, monthlyStats = null, students = [], monthlyReports = [], visitLogs = [], joiningLetters = [], onRefresh }) => {
  const [monthlyReportsModalVisible, setMonthlyReportsModalVisible] = useState(false);
  const [visitLogsModalVisible, setVisitLogsModalVisible] = useState(false);
  const [joiningLettersModalVisible, setJoiningLettersModalVisible] = useState(false);

  // Get current month name for display
  const currentMonthName = useMemo(() => dayjs().format('MMMM YYYY'), []);

  // Use backend-calculated monthly stats (follows 10-day rule)
  // Fall back to 0 if data not yet loaded
  const expectedReportsThisMonth = monthlyStats?.expectedReportsThisMonth ?? 0;
  const submittedReportsThisMonth = monthlyStats?.submittedReportsThisMonth ?? 0;
  const expectedVisitsThisMonth = monthlyStats?.expectedVisitsThisMonth ?? 0;
  const completedVisitsThisMonth = monthlyStats?.completedVisitsThisMonth ?? 0;

  // Total students (with breakdown)
  const totalStudents = stats.totalStudents || students.length || 0;
  const internalStudents = stats.internalStudents || 0;
  const externalStudents = stats.externalStudents || 0;

  // Expected for current month comes from backend (uses 10-day rule)
  const expectedThisMonth = expectedReportsThisMonth;

  // Get grievance stats from API
  const pendingGrievances = stats.pendingGrievances || 0;
  const totalGrievances = stats.totalGrievances || 0;

  // Joining letters: uploaded vs expected (active internships)
  const pendingJoiningLetters = stats.pendingJoiningLetters ?? 0;
  const expectedJoiningLetters = stats.totalJoiningLetters ?? 0;
  const uploadedJoiningLetters = expectedJoiningLetters - pendingJoiningLetters;

  const cardConfigs = [
    {
      title: 'Assigned Students',
      value: totalStudents,
      icon: <TeamOutlined />,
      iconBgColor: '#dbeafe',
      iconColor: '#3b82f6',
      valueColor: '#3b82f6',
      subtitle: (() => {
        const activeCount = stats.activeStudents || expectedThisMonth;
        const inactiveCount = totalStudents - activeCount;

        return (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <span className="text-success text-xs"> {activeCount} active internships</span>
              {inactiveCount > 0 && (
                <span className="text-text-tertiary text-xs">{inactiveCount} inactive</span>
              )}
            </div>
            {externalStudents > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span>{internalStudents} internal</span>
                <Tag color="purple" className="m-0 px-1 py-0 text-[9px] leading-[14px] border-0">
                  <GlobalOutlined className="mr-0.5" style={{ fontSize: '8px' }} />
                  {externalStudents} ext
                </Tag>
              </div>
            )}
          </div>
        );
      })(),
    },
    {
      title: 'Monthly Reports (Eligible)',
      value: submittedReportsThisMonth,
      secondaryValue: expectedReportsThisMonth,
      icon: <FileTextOutlined />,
      iconBgColor: '#f3e8ff',
      iconColor: '#9333ea',
      valueColor: '#9333ea',
      subtitle: `Submitted - ${monthlyStats?.monthName || currentMonthName}`,
      hasViewMore: true,
      onViewMore: () => setMonthlyReportsModalVisible(true),
    },
    {
      title: 'Visit Logs (Eligible)',
      value: completedVisitsThisMonth,
      secondaryValue: expectedVisitsThisMonth,
      icon: <VideoCameraOutlined />,
      iconBgColor: '#d1fae5',
      iconColor: '#10b981',
      valueColor: '#10b981',
      subtitle: `Completed - ${monthlyStats?.monthName || currentMonthName}`,
      hasViewMore: true,
      onViewMore: () => setVisitLogsModalVisible(true),
    },
    {
      title: 'Joining Reports',
      value: uploadedJoiningLetters,
      secondaryValue: expectedJoiningLetters,
      icon: <FileProtectOutlined />,
      iconBgColor: '#fef3c7',
      iconColor: '#f59e0b',
      valueColor: '#f59e0b',
      subtitle: pendingJoiningLetters === 0 ? 'All uploaded' : `${pendingJoiningLetters} pending`,
      hasViewMore: true,
      onViewMore: () => setJoiningLettersModalVisible(true),
    },
    {
      title: 'Grievances',
      value: pendingGrievances,
      secondaryValue: totalGrievances,
      icon: <ExclamationCircleOutlined />,
      iconBgColor: '#fee2e2',
      iconColor: '#ef4444',
      valueColor: '#ef4444',
      subtitle: pendingGrievances === 0 ? 'No pending issues' : 'Pending resolution',
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 !gap-3 !mb-6">
        {cardConfigs.map((card, idx) => (
          <StatCard key={idx} {...card} />
        ))}
      </div>

      {/* Monthly Reports Overview Modal */}
      <MonthlyReportsOverviewModal
        visible={monthlyReportsModalVisible}
        onClose={() => setMonthlyReportsModalVisible(false)}
        students={students}
        monthlyReports={monthlyReports}
      />

      {/* Visit Logs Overview Modal */}
      <VisitLogsOverviewModal
        visible={visitLogsModalVisible}
        onClose={() => setVisitLogsModalVisible(false)}
        students={students}
        visitLogs={visitLogs}
      />

      {/* Joining Letters Overview Modal */}
      <JoiningLettersOverviewModal
        visible={joiningLettersModalVisible}
        onClose={() => setJoiningLettersModalVisible(false)}
        letters={joiningLetters}
        onRefresh={onRefresh}
      />
    </>
  );
};

export default StatisticsGrid;
