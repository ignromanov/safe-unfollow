import { TrendingDown, AlertTriangle, TrendingUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useCarouselIndex } from '@/hooks/useCarouselIndex';

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
  onToolClick: (tool: RescueTool, e: React.MouseEvent, position: number) => void;
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
  const { scrollRef, cardRefs } = useCarouselIndex(tools.length);

  return (
    <>
      {/* Collapse button */}
      <button
        onClick={onDismiss}
        className="absolute top-4 end-4 p-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        aria-label={t('rescue.dismiss')}
      >
        <X size={18} />
      </button>

      <div className="p-4 md:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3 md:items-start md:gap-4 md:mb-6">
          <div className={`p-2 md:p-4 rounded-xl md:rounded-2xl shrink-0 ${style.bgLightClass}`}>
            <SeverityIcon className={`w-5 h-5 md:w-8 md:h-8 ${style.iconColorClass}`} />
          </div>
          <div className="pe-8">
            <h3 className="text-base md:text-2xl font-display font-bold text-zinc-900 dark:text-white">
              {t(getTitleKey(segment.severity) as any, {
                unfollowedPercent: segment.unfollowedPercent.toFixed(1),
              })}
            </h3>
            <p className="hidden md:block text-zinc-600 dark:text-zinc-400 mt-1 text-sm md:text-base">
              {t(getSubtitleKey(segment.severity, segment.size) as any, {
                count: segment.totalAccounts,
              })}
            </p>
          </div>
        </div>

        {/* Urgency element for critical and warning severity */}
        {segment.severity === 'critical' && (
          <div className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl mb-4 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 text-orange-600 animate-pulse" />
            <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
              {t('rescue.urgency.critical')}
            </span>
          </div>
        )}
        {segment.severity === 'warning' && (
          <div className="hidden md:flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl mb-4 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 animate-pulse" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {t('rescue.urgency.warning')}
            </span>
          </div>
        )}

        {/* Tools: carousel on mobile, grid on desktop */}
        <div className="relative -mx-4 md:mx-0">
          {/* Mobile carousel */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory ps-4 pt-3 pb-2 scroll-ps-4 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tools.map((tool, index) => (
              <div
                key={tool.id}
                ref={el => {
                  cardRefs.current[index] = el;
                }}
                className="shrink-0 snap-start w-[82%]"
              >
                <RescueToolCard tool={tool} index={index} onToolClick={onToolClick} />
              </div>
            ))}
            {/* Right padding spacer — iOS Safari ignores end padding in scroll containers */}
            <div className="shrink-0 w-4" aria-hidden="true" />
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-[1.3fr_1fr_1fr] gap-4 max-w-4xl mx-auto">
            {tools.map((tool, index) => (
              <RescueToolCard key={tool.id} tool={tool} index={index} onToolClick={onToolClick} />
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] md:text-xs text-zinc-400 mt-2 md:mt-4 text-center">
          💡 {t('rescue.disclaimer')}
        </p>
      </div>
    </>
  );
}
