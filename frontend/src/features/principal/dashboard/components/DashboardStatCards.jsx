import React from 'react';
import { Card, Tooltip, Typography } from 'antd';
import {
  EyeOutlined,
  TeamOutlined,
  UserOutlined,
  WarningOutlined,
  BankOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

// Stat Card Component matching the design
const DashboardStatCard = ({
  title,
  value,
  secondaryValue,
  subtitle,
  icon,
  iconBgClass,
  iconColorClass,
  valueColorClass,
  hasViewMore = false,
  onViewMore,
  isWarning = false,
}) => {
  return (
    <Card
      className="h-full border border-border shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: '20px 16px' } }}
    >
      <div className="flex flex-col items-center text-center">
        {/* Top row: Icon centered, Eye on right */}
        <div className="w-full flex justify-center relative mb-3">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center ${iconBgClass}`}
            
          >
            {React.cloneElement(icon, {
              className: `text-2xl ${iconColorClass}`,
            })}
          </div>
          {hasViewMore && (
            <Tooltip title="View Details">
              <button
                onClick={onViewMore}
                className={`absolute right-0 top-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors cursor-pointer border-0 bg-transparent ${isWarning ? "text-error" : "text-text-tertiary"}`}
              >
                <EyeOutlined style={{ fontSize: '14px' }} />
              </button>
            </Tooltip>
          )}
        </div>

        {/* Title */}
        <Text className="text-sm font-medium text-text-secondary mb-2">{title}</Text>

        {/* Value */}
        <div className="flex items-baseline justify-center gap-1 mb-1">
          <span
            className={`${valueColorClass}`}
            style={{
              fontSize: '32px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {secondaryValue !== undefined && (
            <>
              <span className="text-text-tertiary opacity-40 font-medium" style={{ fontSize: '20px' }}>/</span>
              <span className="text-text-tertiary font-semibold" style={{ fontSize: '20px' }}>
                {secondaryValue}
              </span>
            </>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <Text className="text-xs text-text-tertiary">{subtitle}</Text>
        )}
      </div>
    </Card>
  );
};

// Basic Statistics Grid (First Row)
export const BasicStatisticsGrid = ({
  totalStudents = 0,
  totalMentors = 0,
  unassignedStudents = 0,
  partnerCompanies = 0,
  loading = false,
  onViewStudents,
  onViewMentors,
  onViewUnassigned,
  onViewCompanies,
}) => {
  const cards = [
    {
      title: 'Total Students',
      value: totalStudents,
      subtitle: 'Overall enrolled strength',
      icon: <TeamOutlined />,
      iconBgClass: 'bg-info-light',
      iconColorClass: '',
      valueColorClass: 'text-info',
      hasViewMore: true,
      onViewMore: onViewStudents,
    },
    {
      title: 'Total Mentors',
      value: totalMentors,
      subtitle: 'Active mentor profiles',
      icon: <UserOutlined />,
      iconBgClass: 'bg-success-light',
      iconColorClass: '',
      valueColorClass: 'text-success',
      hasViewMore: true,
      onViewMore: onViewMentors,
    },
    {
      title: 'Un-assigned Students',
      value: unassignedStudents,
      subtitle: 'Awaiting mentor assignment',
      icon: <WarningOutlined />,
      iconBgClass: 'bg-error-light',
      iconColorClass: '',
      valueColorClass: 'text-error',
      hasViewMore: true,
      onViewMore: onViewUnassigned,
      isWarning: true,
    },
    {
      title: 'Partner Companies',
      value: partnerCompanies,
      subtitle: 'Active industry engagements',
      icon: <BankOutlined />,
      iconBgClass: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      iconColorClass: '',
      valueColorClass: 'text-purple-600 dark:text-purple-400',
      hasViewMore: true,
      onViewMore: onViewCompanies,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="h-32 border-border shadow-sm rounded-xl bg-surface" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <DashboardStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

// Submission & Status Overview Grid (Second Row)
export const SubmissionStatusGrid = ({
  monthlyReports = { submitted: 0, total: 0, pending: 0, month: null, year: null },
  joiningLetters = { submitted: 0, total: 0, pendingPercent: 0 },
  facultyVisits = { completed: 0, total: 0, pending: 0, month: null, year: null },
  grievances = { total: 0, unaddressed: 0 },
  loading = false,
  onViewReports,
  onViewJoiningLetters,
  onViewVisits,
  onViewGrievances,
}) => {
  // Use month/year from API if available, otherwise use client's current date
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getMonthLabel = (month, year) => {
    if (month && year) {
      return `${MONTH_NAMES[month - 1]} ${year}`;
    }
    return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const reportsMonthLabel = getMonthLabel(monthlyReports.month, monthlyReports.year);
  const visitsMonthLabel = getMonthLabel(facultyVisits.month, facultyVisits.year);

  const completionPercent = (submitted, total) => {
    if (total === 0) return 0;
    return Math.round((submitted / total) * 100);
  };

  const cards = [
    {
      title: `Monthly Reports - ${reportsMonthLabel}`,
      value: monthlyReports.submitted,
      secondaryValue: monthlyReports.total,
      subtitle: (
        <div className="flex flex-col items-center gap-0.5">
          {monthlyReports.pending > 0 && (
            <span className="text-error font-medium">{monthlyReports.pending} pending</span>
          )}
          <span>{completionPercent(monthlyReports.submitted, monthlyReports.total)}% completion</span>
        </div>
      ),
      icon: <BarChartOutlined />,
      iconBgClass: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      iconColorClass: '',
      valueColorClass: 'text-purple-600 dark:text-purple-400',
      hasViewMore: true,
      onViewMore: onViewReports,
    },
    {
      title: 'Joining Reports',
      value: joiningLetters.submitted,
      secondaryValue: joiningLetters.total,
      subtitle: `${joiningLetters.pendingPercent}% pending`,
      icon: <FileTextOutlined />,
      iconBgClass: 'bg-info-light',
      iconColorClass: '',
      valueColorClass: 'text-info',
      hasViewMore: true,
      onViewMore: onViewJoiningLetters,
    },
    {
      title: `Faculty Visits - ${visitsMonthLabel}`,
      value: facultyVisits.completed,
      secondaryValue: facultyVisits.total,
      subtitle: (
        <div className="flex flex-col items-center gap-0.5">
          {facultyVisits.pending > 0 && (
            <span className="text-error font-medium">{facultyVisits.pending} pending</span>
          )}
          <span>{completionPercent(facultyVisits.completed, facultyVisits.total)}% completion</span>
        </div>
      ),
      icon: <CheckCircleOutlined />,
      iconBgClass: 'bg-warning-light',
      iconColorClass: '',
      valueColorClass: 'text-warning',
      hasViewMore: true,
      onViewMore: onViewVisits,
    },
    {
      title: 'Student Grievances',
      value: (
        <span>
          {grievances.total}
          <span className="text-lg text-text-tertiary ml-1">({grievances.unaddressed})</span>
        </span>
      ),
      subtitle: 'Total (Unaddressed)',
      icon: <ExclamationCircleOutlined />,
      iconBgClass: 'bg-error-light',
      iconColorClass: '',
      valueColorClass: 'text-error',
      hasViewMore: true,
      onViewMore: onViewGrievances,
      isWarning: grievances.unaddressed > 0,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2  lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="h-40 border-border shadow-sm rounded-xl bg-surface" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <DashboardStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

export default DashboardStatCard;


