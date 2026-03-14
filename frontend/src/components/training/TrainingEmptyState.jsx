import React from 'react';
import { Button, Typography } from 'antd';
import { PlusOutlined, CalendarOutlined, RightOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

// SVG Illustrations for different empty states
const illustrations = {
  calendar: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#EEF2FF" />
      <rect x="30" y="35" width="60" height="50" rx="4" fill="white" stroke="#6366F1" strokeWidth="2" />
      <rect x="30" y="35" width="60" height="12" rx="4" fill="#6366F1" />
      <circle cx="42" cy="41" r="2" fill="white" />
      <circle cx="78" cy="41" r="2" fill="white" />
      <rect x="38" y="55" width="12" height="8" rx="2" fill="#E0E7FF" />
      <rect x="54" y="55" width="12" height="8" rx="2" fill="#E0E7FF" />
      <rect x="70" y="55" width="12" height="8" rx="2" fill="#6366F1" />
      <rect x="38" y="67" width="12" height="8" rx="2" fill="#E0E7FF" />
      <rect x="54" y="67" width="12" height="8" rx="2" fill="#C7D2FE" />
      <rect x="70" y="67" width="12" height="8" rx="2" fill="#E0E7FF" />
      <path d="M95 75L100 80L110 70" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  applications: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#FEF3C7" />
      <rect x="35" y="30" width="50" height="60" rx="4" fill="white" stroke="#F59E0B" strokeWidth="2" />
      <rect x="42" y="40" width="30" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="42" y="48" width="36" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="42" y="56" width="24" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="42" y="68" width="16" height="16" rx="2" stroke="#F59E0B" strokeWidth="2" fill="none" />
      <path d="M46 76L50 80L56 72" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="90" cy="35" r="15" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
      <path d="M90 28V35H97" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  certificates: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#ECFDF5" />
      <rect x="30" y="35" width="60" height="45" rx="4" fill="white" stroke="#10B981" strokeWidth="2" />
      <rect x="38" y="43" width="44" height="4" rx="2" fill="#D1FAE5" />
      <rect x="45" y="51" width="30" height="3" rx="1.5" fill="#A7F3D0" />
      <circle cx="60" cy="65" r="8" fill="#10B981" />
      <path d="M56 65L59 68L65 62" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M55 80L60 90L65 80" fill="#FCD34D" />
      <path d="M50 80L55 92L60 80" fill="#FBBF24" />
      <path d="M65 80L70 92L75 80" fill="#FBBF24" />
    </svg>
  ),
  feedback: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#F0FDF4" />
      <rect x="30" y="40" width="60" height="45" rx="8" fill="white" stroke="#22C55E" strokeWidth="2" />
      <circle cx="45" cy="58" r="4" fill="#BBF7D0" />
      <circle cx="60" cy="58" r="4" fill="#BBF7D0" />
      <circle cx="75" cy="58" r="4" fill="#22C55E" />
      <rect x="40" y="70" width="40" height="6" rx="3" fill="#DCFCE7" />
      <path d="M85 30L95 35L85 40" fill="#22C55E" />
      <circle cx="95" cy="35" r="8" fill="#22C55E" />
      <path d="M92 35L94 37L99 32" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  lessonPlans: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#EDE9FE" />
      <rect x="35" y="30" width="50" height="60" rx="4" fill="white" stroke="#8B5CF6" strokeWidth="2" />
      <rect x="42" y="38" width="36" height="4" rx="2" fill="#DDD6FE" />
      <rect x="42" y="46" width="28" height="3" rx="1.5" fill="#EDE9FE" />
      <rect x="42" y="53" width="32" height="3" rx="1.5" fill="#EDE9FE" />
      <rect x="42" y="60" width="20" height="3" rx="1.5" fill="#EDE9FE" />
      <rect x="42" y="72" width="36" height="12" rx="2" fill="#F5F3FF" stroke="#8B5CF6" strokeWidth="1" />
      <path d="M48 78L52 82L62 72" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="90" cy="75" r="12" fill="#8B5CF6" />
      <path d="M86 75H94M90 71V79" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  attendance: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#DBEAFE" />
      <circle cx="60" cy="45" r="15" fill="white" stroke="#3B82F6" strokeWidth="2" />
      <path d="M40 85C40 70 50 62 60 62C70 62 80 70 80 85" fill="white" stroke="#3B82F6" strokeWidth="2" />
      <circle cx="60" cy="45" r="8" fill="#BFDBFE" />
      <path d="M85 50L90 55L100 45" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="25" y="75" width="8" height="15" rx="2" fill="#3B82F6" opacity="0.3" />
      <rect x="87" y="75" width="8" height="15" rx="2" fill="#3B82F6" opacity="0.3" />
    </svg>
  ),
  search: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#F1F5F9" />
      <circle cx="55" cy="50" r="20" fill="white" stroke="#64748B" strokeWidth="2" />
      <circle cx="55" cy="50" r="12" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
      <path d="M70 65L85 80" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 45L50 50L55 48" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  default: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="50" fill="#F3F4F6" />
      <rect x="35" y="40" width="50" height="40" rx="4" fill="white" stroke="#9CA3AF" strokeWidth="2" />
      <rect x="42" y="50" width="36" height="4" rx="2" fill="#E5E7EB" />
      <rect x="42" y="58" width="28" height="3" rx="1.5" fill="#E5E7EB" />
      <rect x="42" y="65" width="32" height="3" rx="1.5" fill="#E5E7EB" />
      <circle cx="85" cy="35" r="12" fill="#E5E7EB" />
      <path d="M81 35H89M85 31V39" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
};

// Configuration for different empty state types
const typeConfig = {
  calendar: {
    title: 'No trainings scheduled',
    description: 'There are no training sessions scheduled for this period. Check back later or explore other dates.',
    actionText: 'Browse Calendar',
    color: 'primary',
  },
  applications: {
    title: 'No applications yet',
    description: 'You haven\'t applied to any training sessions yet. Discover trainings that match your interests.',
    actionText: 'Explore Trainings',
    color: 'warning',
  },
  certificates: {
    title: 'No certificates earned',
    description: 'Complete trainings with full attendance to earn certificates. Your achievements will appear here.',
    actionText: 'Find Trainings',
    color: 'success',
  },
  feedback: {
    title: 'All caught up!',
    description: 'You have no pending feedback to submit. Great job staying on top of things!',
    actionText: null,
    color: 'success',
  },
  lessonPlans: {
    title: 'No lesson plans yet',
    description: 'Create lesson plans to document how you\'ll apply training knowledge in your teaching.',
    actionText: 'Create Lesson Plan',
    color: 'purple',
  },
  attendance: {
    title: 'No attendance records',
    description: 'Attendance records will appear here once you participate in training sessions.',
    actionText: 'View Trainings',
    color: 'primary',
  },
  search: {
    title: 'No results found',
    description: 'Try adjusting your search terms or filters to find what you\'re looking for.',
    actionText: 'Clear Filters',
    color: 'secondary',
  },
  default: {
    title: 'Nothing here yet',
    description: 'Content will appear here once available.',
    actionText: null,
    color: 'secondary',
  },
};

const TrainingEmptyState = ({
  type = 'default',
  message,
  description,
  icon,
  actionText,
  actionIcon,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  compact = false,
  className = '',
}) => {
  const config = typeConfig[type] || typeConfig.default;
  const illustration = icon || illustrations[type] || illustrations.default;

  const displayTitle = message || config.title;
  const displayDescription = description || config.description;
  const displayActionText = actionText !== undefined ? actionText : config.actionText;

  if (compact) {
    return (
      <div className={`flex items-center gap-4 py-4 ${className}`}>
        <div className="w-12 h-12 flex-shrink-0">
          {React.cloneElement(illustration, { width: 48, height: 48 })}
        </div>
        <div className="flex-1 min-w-0">
          <Text className="font-medium text-text-primary block">{displayTitle}</Text>
          <Text className="text-text-secondary text-sm">{displayDescription}</Text>
        </div>
        {displayActionText && onAction && (
          <Button type="link" onClick={onAction} className="flex-shrink-0">
            {displayActionText} <RightOutlined className="text-xs" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`py-12 px-4 text-center ${className}`}>
      <div className="flex justify-center mb-6">
        {illustration}
      </div>

      <Title level={4} className="!mb-2 !mt-0 text-text-primary">
        {displayTitle}
      </Title>

      <Text className="text-text-secondary block max-w-md mx-auto mb-6">
        {displayDescription}
      </Text>

      <div className="flex items-center justify-center gap-3">
        {displayActionText && onAction && (
          <Button
            type="primary"
            icon={actionIcon || <PlusOutlined />}
            onClick={onAction}
            size="large"
          >
            {displayActionText}
          </Button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <Button onClick={onSecondaryAction} size="large">
            {secondaryActionText}
          </Button>
        )}
      </div>
    </div>
  );
};

// Named exports for illustrations
TrainingEmptyState.illustrations = illustrations;
TrainingEmptyState.typeConfig = typeConfig;

export default TrainingEmptyState;
