import { TrendingDown, AlertTriangle, TrendingUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { getTitleKey, type LossSeverity, type SeverityStyle } from '@/lib/rescue-plan';

/**
 * Collapsed state of Rescue Plan Banner
 *
 * Shows a compact 40px bar with severity icon and title.
 * Clicking expands to full banner view.
 */

const SEVERITY_ICONS = {
  alert: TrendingDown,
  warning: AlertTriangle,
  growth: TrendingUp,
} as const;

interface CollapsedBannerProps {
  style: SeverityStyle;
  severity: LossSeverity;
  unfollowedPercent: number;
  onExpand: () => void;
}

export function CollapsedBanner({
  style,
  severity,
  unfollowedPercent,
  onExpand,
}: CollapsedBannerProps) {
  const { t } = useTranslation('results');
  const SeverityIcon = SEVERITY_ICONS[style.iconType];

  return (
    <button
      onClick={onExpand}
      className="w-full flex items-center justify-between p-2 gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-3xl"
    >
      {/* Left: Icon + Text */}
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg shrink-0 ${style.bgLightClass}`}>
          <SeverityIcon className={`w-4 h-4 ${style.iconColorClass}`} />
        </div>
        <div className="text-start">
          <p className="font-semibold text-xs text-zinc-900 dark:text-white">
            {t(getTitleKey(severity) as any, {
              unfollowedPercent: unfollowedPercent.toFixed(1),
            })}
          </p>
        </div>
      </div>

      {/* Right: Expand icon */}
      <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
    </button>
  );
}
