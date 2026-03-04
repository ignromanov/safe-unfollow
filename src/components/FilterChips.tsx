import {
  Users,
  UserPlus,
  Heart,
  TrendingDown,
  Clock,
  XCircle,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ghost,
} from 'lucide-react';
import type { BadgeKey } from '@/core/types';
interface FilterChipsProps {
  selectedFilters: Set<BadgeKey>;
  onFiltersChange: (filters: Set<BadgeKey>) => void;
  filterCounts: Record<BadgeKey, number>;
  isFiltering?: boolean;
}
import { analytics } from '@/lib/analytics';
import type { ReactNode } from 'react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Module-level icon map (outside component, never re-created)
const BADGE_ICON_MAP: Record<BadgeKey, { icon: typeof Users; defaultClass: string }> = {
  following: { icon: Users, defaultClass: 'text-blue-500' },
  followers: { icon: UserPlus, defaultClass: 'text-emerald-500' },
  mutuals: { icon: Heart, defaultClass: 'text-indigo-500' },
  notFollowingBack: { icon: TrendingDown, defaultClass: 'text-rose-500' },
  notFollowedBack: { icon: Ghost, defaultClass: 'text-amber-500' },
  unfollowed: { icon: XCircle, defaultClass: 'text-rose-600' },
  pending: { icon: Clock, defaultClass: 'text-amber-400' },
  permanent: { icon: Clock, defaultClass: 'text-zinc-500' },
  restricted: { icon: AlertCircle, defaultClass: 'text-zinc-400' },
  close: { icon: Heart, defaultClass: 'text-pink-500 fill-current' },
  dismissed: { icon: XCircle, defaultClass: 'text-zinc-400 opacity-50' },
};

// Module-level Intl.NumberFormat instance (created once, reused)
const numberFormatter = new Intl.NumberFormat();

// Get icon with correct color based on active state
function getBadgeIcon(type: BadgeKey, isActive: boolean): ReactNode {
  const config = BADGE_ICON_MAP[type];
  const IconComponent = config.icon;
  return <IconComponent size={18} className={isActive ? 'text-white' : config.defaultClass} />;
}

// Filter configuration with badge types (labels come from i18n)
const FILTER_CONFIGS: Array<{ type: BadgeKey }> = [
  { type: 'followers' },
  { type: 'following' },
  { type: 'unfollowed' },
  { type: 'notFollowingBack' },
  { type: 'mutuals' },
  { type: 'notFollowedBack' },
  { type: 'pending' },
  { type: 'permanent' },
  { type: 'restricted' },
  { type: 'close' },
  { type: 'dismissed' },
];

export const FilterChips = memo(function FilterChips({
  selectedFilters,
  onFiltersChange,
  filterCounts,
  isFiltering: _isFiltering = false,
}: FilterChipsProps) {
  const { t } = useTranslation('results');
  const [showEmptyFilters, setShowEmptyFilters] = useState(false);

  const handleFilterToggle = (filter: BadgeKey) => {
    const newFilters = new Set(selectedFilters);
    const action = newFilters.has(filter) ? 'disable' : 'enable';

    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }

    analytics.filterToggle(filter, action, newFilters.size);
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    analytics.filterClearAll(selectedFilters.size);
    onFiltersChange(new Set());
  };

  const getBadgeCount = (type: BadgeKey) => filterCounts[type] || 0;

  const availableFilters = FILTER_CONFIGS.filter(cfg => getBadgeCount(cfg.type) > 0);
  const emptyFilters = FILTER_CONFIGS.filter(cfg => getBadgeCount(cfg.type) === 0);

  return (
    <div className="bg-card p-5 md:p-6 rounded-4xl border border-border shadow-sm sticky top-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h4 className="flex items-center gap-2 text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
          <Filter size={14} className="text-primary" /> {t('filters.title')}
        </h4>
        {selectedFilters.size > 0 && (
          <button
            onClick={handleClearAll}
            className="cursor-pointer text-xs font-black text-rose-500 uppercase tracking-widest hover:underline"
          >
            {t('filters.reset')}
          </button>
        )}
      </div>

      {/* Available Filters — 2-col grid on mobile, 1-col on desktop sidebar */}
      <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
        {availableFilters.map(cfg => {
          const isActive = selectedFilters.has(cfg.type);
          const count = getBadgeCount(cfg.type);
          const label = t(`badges.${cfg.type}`);
          return (
            <button
              key={cfg.type}
              onClick={() => handleFilterToggle(cfg.type)}
              className={`cursor-pointer flex flex-col items-start justify-between p-4 rounded-2xl text-xs font-bold transition-all border min-h-[85px] relative ${
                isActive
                  ? 'bg-primary text-white border-primary shadow-md'
                  : 'text-zinc-600 dark:text-zinc-400 border-border bg-zinc-50/50 dark:bg-zinc-900/20 hover:border-primary/40'
              }`}
              aria-label={
                isActive
                  ? t('filters.removeFilter', { label, count })
                  : t('filters.addFilter', { label, count })
              }
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between w-full">
                <span>{getBadgeIcon(cfg.type, isActive)}</span>
                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {numberFormatter.format(count)}
                </span>
              </div>
              <span className="mt-3 block leading-snug text-start text-xs">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Empty Categories */}
      {emptyFilters.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border">
          <button
            onClick={() => setShowEmptyFilters(!showEmptyFilters)}
            className="cursor-pointer flex items-center justify-between w-full text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-primary transition-colors"
          >
            <span>{t('filters.emptyCategories', { count: emptyFilters.length })}</span>
            {showEmptyFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showEmptyFilters && (
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5 mt-4 animate-in slide-in-from-top-2 duration-300">
              {emptyFilters.map(cfg => (
                <div
                  key={cfg.type}
                  className="flex flex-col items-start justify-between p-4 rounded-2xl text-xs font-bold border border-border bg-zinc-50/20 dark:bg-zinc-900/10 opacity-60 min-h-[85px]"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{getBadgeIcon(cfg.type, false)}</span>
                    <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                      0
                    </span>
                  </div>
                  <span className="mt-3 block leading-snug text-start text-xs text-zinc-400">
                    {t(`badges.${cfg.type}`)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
