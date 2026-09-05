import { X } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { BADGE_ORDER } from '@/core/badges';
import type { BadgeKey } from '@/core/types';

interface AppliedFiltersProps {
  selectedFilters: Set<BadgeKey>;
  onRemove: (badge: BadgeKey) => void;
  onClearAll: () => void;
}

/**
 * What is currently filtering the list, by name.
 *
 * A lit control in the option space cannot carry this: it lights identically
 * whether the reader tapped it or arrived with it already on, and a state with
 * no transient gives perception nothing to attach to. That is why this row
 * exists separately from the sheet rather than inside it.
 *
 * Ordered by BADGE_ORDER rather than by insertion, so the row does not reshuffle
 * as filters are added and removed.
 */
export const AppliedFilters = memo(function AppliedFilters({
  selectedFilters,
  onRemove,
  onClearAll,
}: AppliedFiltersProps) {
  const { t } = useTranslation('results');

  if (selectedFilters.size === 0) return null;

  const applied = BADGE_ORDER.filter(badge => selectedFilters.has(badge));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
          {t('filters.applied')}
        </h4>
        <button
          onClick={onClearAll}
          className="cursor-pointer text-xs font-black text-rose-500 uppercase tracking-widest hover:underline"
        >
          {t('filters.reset')}
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {applied.map(badge => {
          const label = t(`badges.${badge}`);
          return (
            <li key={badge}>
              <button
                onClick={() => onRemove(badge)}
                aria-label={t('filters.removeOne', { label })}
                className="cursor-pointer flex items-center gap-1.5 ps-3 pe-2 py-1.5 rounded-full text-xs font-bold bg-primary text-primary-foreground border border-primary"
              >
                {label}
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
