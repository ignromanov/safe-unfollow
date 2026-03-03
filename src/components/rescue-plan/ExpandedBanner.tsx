'use client';

import { TrendingDown, AlertTriangle, TrendingUp, ChevronDown } from 'lucide-react';
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
  const { scrollRef, cardRefs, activeIndex, scrollToCard } = useCarouselIndex(tools.length);

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

        {/* Tools: carousel on mobile, grid on desktop */}
        <div className="relative -mx-6 md:mx-0">
          {/* Mobile carousel */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto overscroll-x-contain scroll-smooth snap-x snap-mandatory pl-6 pt-3 pb-2 scroll-pl-6 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tools.map((tool, index) => (
              <div
                key={tool.id}
                ref={el => {
                  cardRefs.current[index] = el;
                }}
                className="shrink-0 snap-start w-[calc(100%-24px)]"
              >
                <RescueToolCard tool={tool} index={index} onToolClick={onToolClick} />
              </div>
            ))}
            {/* Right padding spacer — iOS Safari ignores end padding in scroll containers */}
            <div className="shrink-0 w-6" aria-hidden="true" />
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-[1.3fr_1fr_1fr] gap-4 max-w-4xl mx-auto">
            {tools.map((tool, index) => (
              <RescueToolCard key={tool.id} tool={tool} index={index} onToolClick={onToolClick} />
            ))}
          </div>
        </div>

        {/* Dot indicators — mobile only */}
        <div className="flex justify-center gap-2 mt-3 md:hidden">
          {tools.map((tool, index) => (
            <button
              key={tool.id}
              onClick={() => scrollToCard(index)}
              aria-label={tool.name}
              className={`h-2 rounded-full transition-all duration-200 ${
                activeIndex === index
                  ? 'w-4 bg-zinc-700 dark:bg-zinc-200'
                  : 'w-2 bg-zinc-300 dark:bg-zinc-600'
              }`}
            />
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-zinc-400 mt-4 text-center">💡 {t('rescue.disclaimer')}</p>
      </div>
    </>
  );
}
