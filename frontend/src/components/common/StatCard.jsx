import React from 'react';
import { Card, theme } from 'antd';
import { gradients } from '../../theme/designTokens';

/**
 * Unified StatCard Component
 * Consistent statistics card across all dashboards
 */
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  variant = 'primary', // primary, success, warning, error, info, purple, cyan, pink
  trend,
  trendLabel,
  className = '',
}) => {
  const { token } = theme.useToken();

  const variantStyles = {
    primary: {
      gradient: gradients.primary,
      iconBg: 'bg-primary/20',
    },
    success: {
      gradient: gradients.success,
      iconBg: 'bg-success/20',
    },
    warning: {
      gradient: gradients.warning,
      iconBg: 'bg-warning/20',
    },
    error: {
      gradient: gradients.error,
      iconBg: 'bg-error/20',
    },
    info: {
      gradient: gradients.info,
      iconBg: 'bg-info/20',
    },
    purple: {
      gradient: gradients.purple,
      iconBg: 'bg-secondary/20',
    },
    cyan: {
      gradient: gradients.cyan,
      iconBg: 'bg-cyan-500/20',
    },
    pink: {
      gradient: gradients.pink,
      iconBg: 'bg-pink-500/20',
    },
  };

  const style = variantStyles[variant] || variantStyles.primary;

  return (
    <Card 
      className={`overflow-hidden h-full border-border ${className}`}
      styles={{ body: { padding: 0 } }}
    >
      {/* Header with gradient */}
      <div
        className="p-4 text-white relative"
        style={{ background: style.gradient }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 bg-white translate-x-1/4 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full opacity-10 bg-white -translate-x-1/4 translate-y-1/4" />

        <div className="flex justify-between items-start relative z-10">
          <div>
            <div className="text-3xl font-bold mb-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-sm font-medium opacity-90">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs opacity-75 mt-1">
                {subtitle}
              </div>
            )}
          </div>
          {icon && (
            <div
              className={`p-3 rounded-xl backdrop-blur-sm ${style.iconBg}`}
            >
              {React.cloneElement(icon, { 
                style: { fontSize: '24px', color: 'white' } 
              })}
            </div>
          )}
        </div>

        {/* Trend indicator */}
        {trend !== undefined && (
          <div className="mt-3 text-xs font-medium opacity-90 flex items-center gap-1">
            <span>{trend >= 0 ? '↑' : '↓'}</span>
            <span>{Math.abs(trend)}%</span>
            {trendLabel && <span className="opacity-75">{trendLabel}</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div 
        className="px-4 py-3 text-sm bg-background-tertiary text-text-secondary"
      >
        {subtitle || 'View Details →'}
      </div>
    </Card>
  );
};

export default StatCard;
