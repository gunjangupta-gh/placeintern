import React, { memo } from 'react';
import { Card, Typography, Tag, Button, Avatar, Progress, Spin, Empty, theme } from 'antd';
import {
  BankOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ClockCircleOutlined,
  RightOutlined,
  LoadingOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ActiveInternshipCard = ({
  internship,
  onViewDetails,
  loading = false,
  studentMentor = null, // Fallback mentor from student's mentorAssignments
}) => {
  const { token } = theme.useToken();

  // Show loading state
  if (loading) {
    return (
      <Card bordered={false} className="h-full rounded-2xl shadow-sm" style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}>
        <div className="flex flex-col items-center justify-center py-20">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 40, color: token.colorPrimary }} spin />} />
          <Text className="mt-4 font-medium" style={{ color: token.colorTextTertiary }}>Loading internship details...</Text>
        </div>
      </Card>
    );
  }

  // Show empty state
  if (!internship) {
    return (
      <Card 
        bordered={false} 
        className="h-full rounded-2xl shadow-sm hover:shadow-md transition-all duration-300"
        style={{ backgroundColor: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div className="flex flex-col items-center justify-center h-full py-12 px-6">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: token.colorBgLayout }}
          >
            <TrophyOutlined className="text-3xl" style={{ color: token.colorTextQuaternary }} />
          </div>
          <Title level={4} className="!mb-2 text-center" style={{ color: token.colorText }}>No Active Internship</Title>
          <Text className="text-center mb-8 max-w-xs" style={{ color: token.colorTextSecondary }}>
            Start your career journey by applying for internships or adding a self-identified one.
          </Text>
          <Button 
            type="primary" 
            size="large"
            onClick={() => window.location.href = '/internships'}
            className="rounded-xl px-8 h-11 shadow-lg"
            style={{ boxShadow: `0 4px 14px 0 ${token.colorPrimary}40` }}
          >
            Browse Opportunities
          </Button>
        </div>
      </Card>
    );
  }

  // Handle self-identified vs regular internships
  const isSelfIdentified = internship.isSelfIdentified || !internship.internshipId;

  const company = isSelfIdentified
    ? { companyName: internship.companyName, city: internship.companyAddress?.split(',')[0] }
    : (internship.internship?.industry || internship.industry || {});

  const startDate = internship.joiningDate || internship.startDate || internship.internship?.startDate;
  const endDate = internship.endDate || internship.internship?.endDate;
  const duration = internship.internshipDuration || internship.internship?.duration;

  // Calculate progress
  const totalDays = endDate && startDate ? dayjs(endDate).diff(dayjs(startDate), 'day') : 0;
  const daysCompleted = startDate ? Math.max(0, dayjs().diff(dayjs(startDate), 'day')) : 0;
  const daysRemaining = totalDays > 0 ? Math.max(0, totalDays - daysCompleted) : 0;
  const progressPercent = totalDays > 0 ? Math.min(Math.round((daysCompleted / totalDays) * 100), 100) : 0;

  const getStatusConfig = (status) => {
    const configs = {
      SELECTED: { 
        label: 'Selected', 
        bg: token.colorSuccessBg, 
        text: token.colorSuccessText, 
        border: token.colorSuccessBorder 
      },
      APPROVED: { 
        label: isSelfIdentified ? 'Active' : 'Approved', 
        bg: token.colorSuccessBg, 
        text: token.colorSuccessText, 
        border: token.colorSuccessBorder 
      },
      JOINED: { 
        label: 'Ongoing', 
        bg: token.colorInfoBg, // Use Info (Blue/Purple-ish) for Ongoing
        text: token.colorInfoText, 
        border: token.colorInfoBorder 
      },
      COMPLETED: { 
        label: 'Completed', 
        bg: token.colorSuccessBg, // Could use specific color, but success fits
        text: token.colorSuccessText, 
        border: token.colorSuccessBorder 
      },
    };
    return configs[status] || { 
      label: status, 
      bg: token.colorPrimaryBg, 
      text: token.colorPrimaryText, 
      border: token.colorPrimaryBorder 
    };
  };

  const statusConfig = getStatusConfig(internship.status);

  return (
    <Card
      bordered={false}
      className="h-full rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group"
      style={{ 
        backgroundColor: token.colorBgContainer, 
        border: `1px solid ${token.colorBorderSecondary}` 
      }}
      styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ 
              backgroundColor: token.colorPrimaryBg, 
              border: `1px solid ${token.colorPrimaryBorder}`,
              color: token.colorPrimary 
            }}
          >
            {company.logo ? (
              <img src={company.logo} alt={company.companyName} className="w-full h-full object-contain p-2" />
            ) : (
              <BankOutlined className="text-2xl" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Title level={4} className="!m-0 !text-lg !font-bold leading-tight" style={{ color: token.colorText }}>
                {company.companyName || 'Company Name'}
              </Title>
              {isSelfIdentified && (
                <Tag color="purple" className="m-0 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border-0">
                  Self-Identified
                </Tag>
              )}
            </div>
            <Text className="font-medium block" style={{ color: token.colorTextSecondary }}>
              {internship.jobProfile || internship.internship?.title || 'Internship Position'}
            </Text>
          </div>
        </div>
        <div 
          className="px-3 py-1 rounded-lg"
          style={{ 
            backgroundColor: statusConfig.bg, 
            border: `1px solid ${statusConfig.border}` 
          }}
        >
          <Text className="text-xs font-bold uppercase tracking-wider" style={{ color: statusConfig.text }}>
            {statusConfig.label}
          </Text>
        </div>
      </div>

      {/* Progress Section */}
      <div 
        className="rounded-xl p-5 mb-6"
        style={{ 
          backgroundColor: token.colorBgLayout, // Secondary background
          border: `1px solid ${token.colorBorderSecondary}`
        }}
      >
        <div className="flex justify-between items-end mb-3">
          <div>
            <Text className="text-xs font-bold uppercase tracking-wider block mb-1" style={{ color: token.colorTextTertiary }}>Progress</Text>
            <Text className="text-base font-bold" style={{ color: token.colorText }}>
              {daysCompleted} <span className="text-sm font-normal" style={{ color: token.colorTextSecondary }}>days completed</span>
            </Text>
          </div>
          <Text className="text-xl font-bold" style={{ color: token.colorPrimary }}>{progressPercent}%</Text>
        </div>
        <Progress
          percent={progressPercent}
          showInfo={false}
          strokeColor={{
            '0%': token.colorPrimary,
            '100%': token.colorSuccess,
          }}
          trailColor={token.colorBorderSecondary}
          className="mb-3"
          size="small"
        />
        <div className="flex justify-between text-xs font-medium" style={{ color: token.colorTextTertiary }}>
          <span>Start: {startDate ? dayjs(startDate).format('MMM DD, YYYY') : 'N/A'}</span>
          <span>End: {endDate ? dayjs(endDate).format('MMM DD, YYYY') : 'N/A'}</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-6 flex-grow">
        <div className="flex items-start gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: token.colorInfoBg, color: token.colorInfo }}
          >
            <CalendarOutlined />
          </div>
          <div>
            <Text className="text-[10px] uppercase font-bold block mb-0.5 tracking-wide" style={{ color: token.colorTextQuaternary }}>Duration</Text>
            <Text className="text-sm font-semibold" style={{ color: token.colorTextSecondary }}>{duration || 'N/A'}</Text>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: token.colorSuccessBg, color: token.colorSuccess }}
          >
            <EnvironmentOutlined />
          </div>
          <div>
            <Text className="text-[10px] uppercase font-bold block mb-0.5 tracking-wide" style={{ color: token.colorTextQuaternary }}>Location</Text>
            <Text className="text-sm font-semibold" style={{ color: token.colorTextSecondary }}>{company.city || 'N/A'}</Text>
          </div>
        </div>
        <div className="flex items-start gap-3 col-span-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: token.colorWarningBg, color: token.colorWarning }}
          >
            <UserOutlined />
          </div>
          <div className="flex-1 min-w-0">
            <Text className="text-[10px] uppercase font-bold block mb-0.5 tracking-wide" style={{ color: token.colorTextQuaternary }}>Mentor</Text>
            <Text className="text-sm font-semibold truncate block" style={{ color: token.colorTextSecondary }}>
              {internship.mentor?.name || internship.facultyMentorName || studentMentor?.name || 'Not assigned'}
            </Text>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <Button
        type="primary"
        size="large"
        block
        onClick={onViewDetails}
        className="rounded-xl h-11 border-0 font-medium shadow-lg mt-auto group-hover:translate-y-[-2px] transition-transform duration-300"
        style={{ 
          backgroundColor: token.colorText, // Using dark text color for button bg usually creates contrast 
          boxShadow: `0 10px 15px -3px ${token.colorText}40`
        }}
      >
        View Full Details <RightOutlined className="ml-1" />
      </Button>
    </Card>
  );
};

ActiveInternshipCard.displayName = 'ActiveInternshipCard';

export default memo(ActiveInternshipCard);
