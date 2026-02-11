import React from 'react';
import { Card, Progress, Tooltip, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';

const { Text } = Typography;

const VARIANTS = {
  primary: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    cardBg: 'bg-gradient-to-br from-blue-50 via-white to-slate-50',
    trendUp: 'text-emerald-600 bg-emerald-50',
    trendDown: 'text-red-600 bg-red-50',
    progressColor: '#3B82F6',
  },
  success: {
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    cardBg: 'bg-gradient-to-br from-emerald-50 via-white to-slate-50',
    trendUp: 'text-emerald-600 bg-emerald-50',
    trendDown: 'text-red-600 bg-red-50',
    progressColor: '#10B981',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    cardBg: 'bg-gradient-to-br from-amber-50 via-white to-slate-50',
    trendUp: 'text-emerald-600 bg-emerald-50',
    trendDown: 'text-red-600 bg-red-50',
    progressColor: '#F59E0B',
  },
  purple: {
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    cardBg: 'bg-gradient-to-br from-purple-50 via-white to-slate-50',
    trendUp: 'text-emerald-600 bg-emerald-50',
    trendDown: 'text-red-600 bg-red-50',
    progressColor: '#8B5CF6',
  },
  secondary: {
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    cardBg: 'bg-gradient-to-br from-slate-50 via-white to-blue-50',
    trendUp: 'text-emerald-600 bg-emerald-50',
    trendDown: 'text-red-600 bg-red-50',
    progressColor: '#64748B',
  },
};

/**
 * Enhanced stat card with trend indicator and optional progress bar
 */
const TrainingStatCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  trendInverse = false, // For cases where decrease is good (e.g., pending items)
  progress,
  progressLabel,
  variant = 'primary',
  onClick,
  className = '',
  loading = false,
}) => {
  const styles = VARIANTS[variant] || VARIANTS.primary;

  const getTrendDisplay = () => {
    if (trend === undefined || trend === null) return null;

    const isPositive = trendInverse ? trend < 0 : trend > 0;
    const isNegative = trendInverse ? trend > 0 : trend < 0;
    const isNeutral = trend === 0;

    let icon = <MinusOutlined />;
    let colorClass = 'text-slate-500 bg-slate-50';

    if (isPositive) {
      icon = <ArrowUpOutlined />;
      colorClass = styles.trendUp;
    } else if (isNegative) {
      icon = <ArrowDownOutlined />;
      colorClass = styles.trendDown;
    }

    return (
      <Tooltip title={trendLabel || 'Compared to last period'}>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {icon}
          <span>{Math.abs(trend)}%</span>
        </span>
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <Card
        className={`rounded-2xl border-border shadow-none h-full ${styles.cardBg} ${className}`}
        styles={{ body: { padding: 18 } }}
      >
        <div className="flex items-center gap-4">
          <div className={`w-11 h-11 rounded-xl ${styles.iconBg} animate-pulse`} />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-slate-200 rounded animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`rounded-2xl border-border shadow-none h-full ${styles.cardBg} ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${className}`}
      onClick={onClick}
      styles={{ body: { padding: 18 } }}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${styles.iconBg}`}>
            <Icon className={`text-lg ${styles.iconColor}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <Text className="text-text-secondary text-xs block truncate">{title}</Text>
            {getTrendDisplay()}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {subtitle && (
              <Text className="text-text-tertiary text-xs">{subtitle}</Text>
            )}
          </div>

          {progress !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <Text className="text-xs text-text-tertiary">{progressLabel || 'Progress'}</Text>
                <Text className="text-xs font-medium text-text-secondary">{progress}%</Text>
              </div>
              <Progress
                percent={progress}
                showInfo={false}
                strokeColor={styles.progressColor}
                trailColor="#E5E7EB"
                size="small"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default TrainingStatCard;
