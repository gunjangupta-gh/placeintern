import React, { useState, useEffect } from 'react';
import { Typography, Tooltip } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * Deadline countdown component showing time remaining
 */
const DeadlineCountdown = ({
  deadline,
  label = 'Application deadline',
  expiredLabel = 'Deadline passed',
  showIcon = true,
  showLabel = true,
  compact = false,
  className = '',
}) => {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!deadline) return;

    const calculateTimeLeft = () => {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diff = deadlineDate - now;

      if (diff <= 0) {
        return { expired: true };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds, expired: false, diff };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline || !timeLeft) {
    return null;
  }

  if (timeLeft.expired) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {showIcon && <ExclamationCircleOutlined className="text-red-500" />}
        <Text className="text-red-600 font-medium text-sm">{expiredLabel}</Text>
      </div>
    );
  }

  const { days, hours, minutes, seconds, diff } = timeLeft;
  const isUrgent = diff < 24 * 60 * 60 * 1000; // Less than 24 hours
  const isVeryUrgent = diff < 2 * 60 * 60 * 1000; // Less than 2 hours

  const getStatusColor = () => {
    if (isVeryUrgent) return 'text-red-600';
    if (isUrgent) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getBackgroundColor = () => {
    if (isVeryUrgent) return 'bg-red-50';
    if (isUrgent) return 'bg-amber-50';
    return 'bg-emerald-50';
  };

  const getIcon = () => {
    if (isVeryUrgent || isUrgent) {
      return <ClockCircleOutlined className={getStatusColor()} />;
    }
    return <CheckCircleOutlined className="text-emerald-500" />;
  };

  const formatTimeUnit = (value, unit) => {
    if (value === 0 && unit !== 's') return null;
    return (
      <span key={unit} className="inline-flex items-baseline">
        <span className="font-bold text-base">{value}</span>
        <span className="text-xs text-text-tertiary ml-0.5">{unit}</span>
      </span>
    );
  };

  if (compact) {
    let displayText = '';
    if (days > 0) {
      displayText = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      displayText = `${hours}h ${minutes}m left`;
    } else {
      displayText = `${minutes}m ${seconds}s left`;
    }

    return (
      <Tooltip title={`Deadline: ${new Date(deadline).toLocaleString()}`}>
        <div className={`flex items-center gap-1.5 ${className}`}>
          {showIcon && getIcon()}
          <Text className={`text-xs font-medium ${getStatusColor()}`}>
            {displayText}
          </Text>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className={`${getBackgroundColor()} rounded-xl p-4 ${className}`}>
      {showLabel && (
        <div className="flex items-center gap-2 mb-3">
          {showIcon && getIcon()}
          <Text className="text-text-secondary text-sm font-medium">{label}</Text>
        </div>
      )}

      <div className="flex items-center gap-3">
        {days > 0 && (
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>{days}</div>
            <div className="text-xs text-text-tertiary uppercase">Days</div>
          </div>
        )}
        {(days > 0 || hours > 0) && (
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>{hours}</div>
            <div className="text-xs text-text-tertiary uppercase">Hours</div>
          </div>
        )}
        <div className="text-center">
          <div className={`text-2xl font-bold ${getStatusColor()}`}>{minutes}</div>
          <div className="text-xs text-text-tertiary uppercase">Mins</div>
        </div>
        {days === 0 && (
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatusColor()}`}>{seconds}</div>
            <div className="text-xs text-text-tertiary uppercase">Secs</div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-current/10">
        <Text className="text-xs text-text-tertiary">
          {new Date(deadline).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </div>
    </div>
  );
};

export default DeadlineCountdown;
