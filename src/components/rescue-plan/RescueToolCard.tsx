import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { RescueTool, ToolBadge } from '@/lib/rescue-plan';

/**
 * Tool Card for Rescue Plan Banner
 *
 * Displays a single affiliate tool with:
 * - Badge (popular/trial/new)
 * - Icon and name
 * - Description
 * - Trust signals (price + social proof)
 * - CTA button
 */

const BADGE_STYLES: Record<ToolBadge, string> = {
  popular: 'bg-orange-500 text-white',
  trial: 'bg-emerald-500 text-white',
  new: 'bg-blue-500 text-white',
};

interface RescueToolCardProps {
  tool: RescueTool;
  index: number;
  onToolClick: (tool: RescueTool, e: React.MouseEvent, position: number) => void;
}

export function RescueToolCard({ tool, index, onToolClick }: RescueToolCardProps) {
  const { t } = useTranslation('results');
  const isFirst = index === 0;

  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => onToolClick(tool, e, index)}
      className={`group relative p-4 bg-white dark:bg-zinc-900 rounded-2xl border-2 transition-all duration-200 hover:scale-[1.02] active:scale-100 flex flex-col ${
        isFirst
          ? 'border-zinc-300 dark:border-zinc-700 hover:border-primary hover:ring-2 hover:ring-primary/20 hover:shadow-xl'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-primary hover:shadow-lg'
      }`}
    >
      {/* Badge */}
      {tool.badge && (
        <span
          className={`absolute -top-2 -end-2 px-2 py-0.5 text-xs font-bold rounded-full ${BADGE_STYLES[tool.badge]}`}
        >
          {tool.badge === 'popular'
            ? `🔥 ${t('rescue.badges.popular')}`
            : tool.badge === 'trial'
              ? `✨ ${t('rescue.badges.trial')}`
              : `🆕 ${t('rescue.badges.new')}`}
        </span>
      )}

      {/* Recommended label for first item */}
      {isFirst && (
        <span className="absolute -top-2 start-3 px-2 py-0.5 text-xs font-bold rounded-full bg-primary text-white">
          ⭐ {t('rescue.recommended')}
        </span>
      )}

      {/* Content area - grows to fill space */}
      <div className="flex-grow">
        {/* Tool header with pricing inline */}
        <div className="flex items-center gap-3 mb-1 mt-2">
          <tool.icon
            className={`w-5 h-5 ${tool.color} group-hover:scale-110 transition-transform`}
          />
          <span className="font-bold text-zinc-900 dark:text-white group-hover:text-primary transition-colors">
            {tool.name}
          </span>
        </div>

        {/* Trust signals - moved up for visibility */}
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            {t(tool.priceKey as any)}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">•</span>
          <span className="text-zinc-400">{t(tool.socialKey as any)}</span>
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2 md:line-clamp-none">
          {t(tool.descKey as any)}
        </p>
      </div>

      {/* CTA Button - always at bottom */}
      <div
        className={`w-full py-1.5 md:py-2 px-3 rounded-xl text-center text-sm font-semibold transition-all mt-auto ${
          isFirst
            ? 'bg-primary text-white group-hover:bg-primary/90'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:bg-primary group-hover:text-white'
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          {t('rescue.tryTool', { name: tool.name })}
          <ExternalLink className="w-3.5 h-3.5 opacity-70 shrink-0" />
        </span>
      </div>
    </a>
  );
}
