import React, { useMemo } from 'react';
import { Tooltip, Progress } from 'antd';
import {
  CheckCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Text } from 'antd/lib/typography';

const STAT_VARIANTS = {
  primary: {
    iconWrap: 'bg-blue-100',
    iconColor: 'text-blue-700',
  },
  warning: {
    iconWrap: 'bg-amber-100',
    iconColor: 'text-amber-700',
  },
};

const EngagementCard = ({ 
  title, 
  engagementItems = [], 
  onView, 
  infoTooltip 
}) => {
  const stats = useMemo(() => {
    if (!Array.isArray(engagementItems) || !engagementItems.length) {
      return {
        totalRequired: 0,
        totalDone: 0,
        completionPercent: 0,
        items: [],
      };
    }

    const totalRequired = engagementItems.reduce((sum, item) => sum + (item.required || 0), 0);
    const totalDone = engagementItems.reduce((sum, item) => sum + (item.done || 0), 0);
    const completionPercent = totalRequired > 0 ? Math.round((totalDone / totalRequired) * 100) : 0;

    return {
      totalRequired,
      totalDone,
      completionPercent,
      items: engagementItems,
    };
  }, [engagementItems]);

  const variant = STAT_VARIANTS.warning;
  const progressColor = 
    stats.completionPercent === 100 ? '#10b981' :
    stats.completionPercent >= 75 ? '#3b82f6' :
    stats.completionPercent >= 50 ? '#f59e0b' :
    '#ef4444';

  return (
    <div
      className={`rounded-xl p-3 h-full border border-slate-200 bg-slate-50 cursor-pointer hover:shadow-sm transition-all`}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (onView && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onView();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${variant.iconWrap}`}>
            <CheckCircleOutlined className={`text-xs ${variant.iconColor}`} />
          </span>
          <Text className="text-[11px] text-slate-600 font-medium leading-tight line-clamp-1">
            {title}
          </Text>
          {infoTooltip ? (
            <Tooltip title={infoTooltip}>
              <InfoCircleOutlined className="text-[11px] text-slate-400" />
            </Tooltip>
          ) : null}
        </div>
        {onView ? (
          <button
            type="button"
            aria-label={`View ${title}`}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:bg-slate-200/70 transition-colors"
            onClick={(event) => {
              event.stopPropagation();
              onView();
            }}
          >
            <EyeOutlined className="text-xs" />
          </button>
        ) : null}
      </div>

      {/* Overall Progress */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <Text className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{stats.totalDone}</span>
            <span className="text-slate-500"> / {stats.totalRequired}</span>
          </Text>
          <Text className="text-xs font-semibold" style={{ color: progressColor }}>
            {stats.completionPercent}%
          </Text>
        </div>
        <Progress
          percent={stats.completionPercent}
          strokeColor={progressColor}
          size="small"
          showInfo={false}
        />
      </div>

      {/* Item Breakdown */}
      {stats.items.length > 0 && (
        <div className="space-y-1.5">
          {stats.items.map((item, idx) => {
            const itemPercent = item.required > 0 ? Math.round((item.done / item.required) * 100) : 0;
            return (
              <div key={item.item || idx} className="text-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-slate-600 truncate">{item.item}</span>
                  <span className="text-slate-600 font-medium">
                    {item.done}/{item.required}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      itemPercent === 100 ? 'bg-green-500' :
                      itemPercent >= 75 ? 'bg-blue-500' :
                      itemPercent >= 50 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${itemPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EngagementCard;
