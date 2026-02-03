'use client';

import { TrendingDown, AlertTriangle, TrendingUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  getTitleKey,
  getSubtitleKey,
  type SeverityStyle,
  type UserSegment,
  type RescueTool,
} from '@/lib/rescue-plan';

import { RescueToolCard } from './RescueToolCard';

/**
 * Expanded state of Rescue Plan Banner
 *
 * Shows full banner with:
 * - Header with severity icon and messaging
 * - Grid of tool cards (3 columns on desktop)
 * - Disclaimer text
 */

const SEVERITY_ICONS = {
  alert: TrendingDown,
  warning: AlertTriangle,
  growth: TrendingUp,
} as const;

interface ExpandedBannerProps {
  style: SeverityStyle;
  segment: UserSegment;
  tools: RescueTool[];
  onDismiss: () => void;
  onToolClick: (tool: RescueTool, e: React.MouseEvent) => void;
}

export function ExpandedBanner({
  style,
  segment,
  tools,
  onDismiss,
  onToolClick,
}: ExpandedBannerProps) {
  const { t } = useTranslation('results');
  const SeverityIcon = SEVERITY_ICONS[style.iconType];

  return (
    <>
      {/* Collapse button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        aria-label={t('rescue.dismiss')}
      >
        <ChevronDown size={20} className="rotate-180" />
      </button>

      <div className="p-6 md:p-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className={`p-4 rounded-2xl shrink-0 ${style.bgLightClass}`}>
            <SeverityIcon className={`w-8 h-8 ${style.iconColorClass}`} />
          </div>
          <div className="pr-8">
            <h3 className="text-xl md:text-2xl font-display font-bold text-zinc-900 dark:text-white">
              {t(getTitleKey(segment.severity) as any, {
                unfollowedPercent: segment.unfollowedPercent.toFixed(1),
              })}
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1 text-sm md:text-base">
              {t(getSubtitleKey(segment.severity, segment.size) as any, {
                count: segment.totalAccounts,
              })}
            </p>
          </div>
        </div>

        {/* Urgency element for critical severity */}
        {segment.severity === 'critical' && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl mb-4 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 text-orange-600 animate-pulse" />
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {t('rescue.urgency.critical')}
            </span>
          </div>
        )}

        {/* Tools grid */}
        <div className="grid md:grid-cols-[1.3fr_1fr_1fr] gap-4 max-w-4xl mx-auto">
          {tools.map((tool, index) => (
            <RescueToolCard key={tool.id} tool={tool} index={index} onToolClick={onToolClick} />
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-zinc-400 mt-4 text-center">💡 {t('rescue.disclaimer')}</p>
      </div>
    </>
  );
}
