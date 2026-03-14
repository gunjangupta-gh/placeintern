import React from 'react';
import { Avatar, Tooltip, Typography } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';

const { Text } = Typography;

const avatarColors = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
];

/**
 * Social proof component showing participant count with avatar stack
 */
const ParticipantCount = ({
  count = 0,
  maxAvatars = 3,
  participants = [], // Array of { name, avatar } objects
  label = 'enrolled',
  showLabel = true,
  compact = false,
  className = '',
}) => {
  if (count === 0 && participants.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <TeamOutlined className="text-text-tertiary" />
        <Text className="text-text-tertiary text-sm">Be the first to enroll!</Text>
      </div>
    );
  }

  const displayCount = count || participants.length;
  const displayParticipants = participants.slice(0, maxAvatars);
  const remainingCount = Math.max(0, displayCount - maxAvatars);

  // Generate placeholder avatars if no participant data
  const generateAvatars = () => {
    if (displayParticipants.length > 0) {
      return displayParticipants;
    }
    // Create placeholder avatars based on count
    const placeholderCount = Math.min(displayCount, maxAvatars);
    return Array.from({ length: placeholderCount }, (_, i) => ({
      name: `Participant ${i + 1}`,
      avatar: null,
      colorIndex: i,
    }));
  };

  const avatarsToShow = generateAvatars();

  if (compact) {
    return (
      <Tooltip title={`${displayCount} people ${label}`}>
        <div className={`flex items-center gap-1.5 ${className}`}>
          <Avatar.Group maxCount={3} size="small">
            {avatarsToShow.map((p, idx) => (
              <Avatar
                key={idx}
                src={p.avatar}
                style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
                size="small"
              >
                {!p.avatar && (p.name?.[0] || <UserOutlined />)}
              </Avatar>
            ))}
          </Avatar.Group>
          <Text className="text-xs text-text-secondary font-medium">
            {displayCount}
          </Text>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Avatar.Group
        maxCount={maxAvatars + 1}
        maxStyle={{
          color: '#fff',
          backgroundColor: '#6366F1',
          fontSize: '12px',
        }}
      >
        {avatarsToShow.map((p, idx) => (
          <Tooltip key={idx} title={p.name}>
            <Avatar
              src={p.avatar}
              style={{ backgroundColor: avatarColors[idx % avatarColors.length] }}
            >
              {!p.avatar && (p.name?.[0] || <UserOutlined />)}
            </Avatar>
          </Tooltip>
        ))}
        {remainingCount > 0 && (
          <Avatar style={{ backgroundColor: '#6366F1' }}>
            +{remainingCount}
          </Avatar>
        )}
      </Avatar.Group>

      {showLabel && (
        <div>
          <Text className="font-semibold text-text-primary block">
            {displayCount.toLocaleString()}
          </Text>
          <Text className="text-xs text-text-secondary">
            {displayCount === 1 ? 'person' : 'people'} {label}
          </Text>
        </div>
      )}
    </div>
  );
};

export default ParticipantCount;
