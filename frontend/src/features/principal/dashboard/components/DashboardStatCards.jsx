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
  compact = false,
}) => {
  const compactTitleBar = (
    <div className="w-full flex items-start justify-between mb-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${iconBgClass}`}>
          {React.cloneElement(icon, {
            className: `text-xs ${iconColorClass}`,
          })}
        </div>
        <Text className="text-[11px] font-medium text-text-secondary leading-tight truncate">{title}</Text>
      </div>
      {hasViewMore && (
        <Tooltip title="View Details">
          <button
            onClick={onViewMore}
            className={`w-6 h-6 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors cursor-pointer border-0 bg-transparent ${isWarning ? "text-error" : "text-text-tertiary"}`}
          >
            <EyeOutlined style={{ fontSize: '13px' }} />
          </button>
        </Tooltip>
      )}
    </div>
  );

  return (
    <Card
      className="h-full border border-border shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
      styles={{ body: { padding: compact ? '14px 12px' : '20px 16px' } }}
    >
      <div className={`flex flex-col ${compact ? 'items-start text-left' : 'items-center text-center'}`}>
        {compact ? (
          compactTitleBar
        ) : (
          <>
            {/* Top row: Icon centered, Eye on right */}
            <div className={`w-full flex justify-center relative ${compact ? 'mb-2' : 'mb-3'}`}>
              <div
                className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-full flex items-center justify-center ${iconBgClass}`}
              >
                {React.cloneElement(icon, {
                  className: `${compact ? 'text-lg' : 'text-2xl'} ${iconColorClass}`,
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
            <Text className={`${compact ? 'text-xs mb-1' : 'text-sm mb-2'} font-medium text-text-secondary`}>{title}</Text>
          </>
        )}

        {/* Value */}
        <div className={`flex items-baseline gap-1 mb-1 ${compact ? '' : 'justify-center'}`}>
          <span
            className={`${valueColorClass}`}
            style={{
              fontSize: compact ? '24px' : '32px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          {secondaryValue !== undefined && (
            <>
              <span className="text-text-tertiary opacity-40 font-medium" style={{ fontSize: compact ? '16px' : '20px' }}>/</span>
              <span className="text-text-tertiary font-semibold" style={{ fontSize: compact ? '16px' : '20px' }}>
                {secondaryValue}
              </span>
            </>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <Text className={`${compact ? 'text-[11px]' : 'text-xs'} text-text-tertiary`}>{subtitle}</Text>
        )}
      </div>
    </Card>
  );
};

const TRAINING_VARIANTS = {
  blue: { iconWrap: 'bg-blue-100', iconColor: 'text-blue-700' },
  amber: { iconWrap: 'bg-amber-100', iconColor: 'text-amber-700' },
  purple: { iconWrap: 'bg-purple-100', iconColor: 'text-purple-700' },
  emerald: { iconWrap: 'bg-emerald-100', iconColor: 'text-emerald-700' },
};

const TrainingStatCard = ({ icon: Icon, title, lines = [], variant = 'blue' }) => {
  const s = TRAINING_VARIANTS[variant] || TRAINING_VARIANTS.blue;

  return (
    <div
      className="rounded-xl p-3 h-full border border-slate-200"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${s.iconWrap}`}>
          <Icon className={`text-xs ${s.iconColor}`} />
        </span>
        <Text className="text-[11px] text-slate-600 font-medium leading-tight">{title}</Text>
      </div>
      <div className="space-y-1 mt-1">
        {lines.map((line) => (
          <Text key={line.label} className="block text-[12px] leading-snug text-slate-600">
            {line.label}: <span className="font-semibold text-slate-800">{line.value}</span>
          </Text>
        ))}
      </div>
    </div>
  );
};

// Basic Statistics Grid (First Row)
export const BasicStatisticsGrid = ({
  totalStudents = 0,
  totalMentors = 0,
  unassignedStudents = 0,
  partnerCompanies = 0,
  staffBreakdown = { totalStaff: 0, mentors: 0, adminStaff: 0 },
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
      title: 'Total Staff',
      value: staffBreakdown.totalStaff,
      subtitle: (
        <span>
          Mentor: {staffBreakdown.mentors || totalMentors} | Admin: {staffBreakdown.adminStaff}
        </span>
      ),
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
        <DashboardStatCard key={idx} compact {...card} />
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
        <DashboardStatCard key={idx} compact {...card} />
      ))}
    </div>
  );
};

// Staff Summary Grid (Total Staff, Mentors, Admin Staff)
export const StaffSummaryGrid = ({
  totalStaff = 0,
  totalMentors = 0,
  totalAdminStaff = 0,
  loading = false,
  onViewStaff,
}) => {
  const cards = [
    {
      title: 'Total Staff',
      value: totalStaff,
      subtitle: 'All staff members',
      icon: <TeamOutlined />,
      iconBgClass: 'bg-info-light',
      iconColorClass: '',
      valueColorClass: 'text-info',
      hasViewMore: true,
      onViewMore: onViewStaff,
    },
    {
      title: 'Mentors',
      value: totalMentors,
      subtitle: 'Teaching faculty',
      icon: <UserOutlined />,
      iconBgClass: 'bg-success-light',
      iconColorClass: '',
      valueColorClass: 'text-success',
      hasViewMore: true,
      onViewMore: onViewStaff,
    },
    {
      title: 'Admin Staff',
      value: totalAdminStaff,
      subtitle: 'Administrative personnel',
      icon: <BankOutlined />,
      iconBgClass: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
      iconColorClass: '',
      valueColorClass: 'text-purple-600 dark:text-purple-400',
      hasViewMore: true,
      onViewMore: onViewStaff,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx} className="h-32 border-border shadow-sm rounded-xl bg-surface" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card, idx) => (
        <DashboardStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

// Training Statistics Grid (4 cards for training metrics)
export const TrainingStatisticsGrid = ({
  trainingsConducted = 0,
  facultyRegistered = 0,
  hoursDelivered = 0,
  completed40Hours = 0,
  completedUnder40Hours = 0,
  facultyCompleted = 0,
  facultyOngoing = 0,
  facultyYetToStart = 0,
  averageHoursPerFaculty = 0,
  highestHoursSingleFaculty = 0,
  lowestHoursSingleFaculty = 0,
  loading = false,
  onViewTraining,
}) => {
  const cards = [
    {
      title: 'Trainings',
      icon: BarChartOutlined,
      variant: 'blue',
      lines: [
        { label: 'Trainings Conducted', value: trainingsConducted },
        { label: 'Total Faculty Registered', value: facultyRegistered },
        { label: 'Hours Delivered', value: hoursDelivered },
      ],
    },
    {
      title: 'Faculty',
      icon: TeamOutlined,
      variant: 'amber',
      lines: [
        { label: 'Completed', value: facultyCompleted },
        { label: 'Ongoing', value: facultyOngoing },
        { label: 'Yet to Start', value: facultyYetToStart },
      ],
    },
    {
      title: 'Completion Metrics',
      icon: CheckCircleOutlined,
      variant: 'purple',
      lines: [
        { label: 'Completed ≥ 40 Hours', value: completed40Hours },
        { label: 'Completed < 40 Hours', value: completedUnder40Hours },
      ],
    },
    {
      title: 'Hours Distribution',
      icon: FileTextOutlined,
      variant: 'emerald',
      lines: [
        { label: 'Avg. Hours per Faculty', value: averageHoursPerFaculty },
        { label: 'Highest Hours (Single Faculty)', value: highestHoursSingleFaculty },
        { label: 'Lowest Hours', value: lowestHoursSingleFaculty },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="h-32 border-border shadow-sm rounded-xl bg-surface" loading />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <TrainingStatCard key={idx} {...card} />
      ))}
    </div>
  );
};

export default DashboardStatCard;


