import React from 'react';
import {
  LaptopOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import StatCard from './StatCard';

const StatisticsGrid = ({ stats, counts }) => {
  const safeStats = stats || {};
  // counts comes from profile._count for accurate server-side values
  const safeCounts = counts || {};

  const cardConfigs = [
    {
      title: 'Total Applications',
      value: safeCounts.internshipApplications ?? safeStats.totalApplications ?? 0,
      icon: <LaptopOutlined />,
      bgClass: 'bg-blue-50',
      colorClass: 'text-blue-600',
      borderColorClass: 'group-hover:border-blue-200',
      suffix: 'Applied'
    },
    {
      title: 'Active Internships',
      value: safeStats.ongoingInternships ?? safeStats.selectedApplications ?? 0,
      icon: <CheckCircleOutlined />,
      bgClass: 'bg-emerald-50',
      colorClass: 'text-emerald-600',
      borderColorClass: 'group-hover:border-emerald-200',
      suffix: 'Ongoing'
    },
    {
      title: 'Monthly Reports',
      value: safeCounts.monthlyReports ?? safeStats.totalMonthlyReports ?? 0,
      icon: <FileTextOutlined />,
      bgClass: 'bg-violet-50',
      colorClass: 'text-violet-600',
      borderColorClass: 'group-hover:border-violet-200',
      suffix: 'Submitted'
    },
    {
      title: 'Self-Identified',
      value: safeStats.selfIdentifiedCount ?? 0,
      icon: <RocketOutlined />,
      bgClass: 'bg-amber-50',
      colorClass: 'text-amber-600',
      borderColorClass: 'group-hover:border-amber-200',
      suffix: 'Initiated'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
      {cardConfigs.map((card, idx) => (
        <StatCard key={idx} {...card} />
      ))}
    </div>
  );
};

export default StatisticsGrid;
