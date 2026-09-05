import {
  Users,
  UserPlus,
  Heart,
  TrendingDown,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Ghost,
} from 'lucide-react';
import {
  BADGES_OVERSTATED_BY_UNREADABLE_REQUESTS,
  badgesAffectedByTruncation,
} from '@/core/badges';
import { BADGE_GROUPS } from '@/core/badges/groups';
import type { BadgeGroupId } from '@/core/badges/groups';
import { namesTruncatedFile } from '@/core/types';
import type { BadgeKey, RelationshipSkew } from '@/core/types';
interface FilterChipsProps {
  selectedFilters: Set<BadgeKey>;
  onFiltersChange: (filters: Set<BadgeKey>) => void;
  filterCounts: Record<BadgeKey, number>;
  /**
   * What each option would yield *against the current selection*, as opposed to
   * `filterCounts`, which is the all-time figure the stat cards show.
   *
   * Nullable, and that is the contract rather than a defensive annotation:
   * `useAccountFiltering` initialises it to `null` and sets it back to `null`
   * when the worker cannot answer, so `null` is the state of every first paint.
   * Absence and zero are different facts — a zero is a measurement that
   * disables an option, absence is no measurement at all and disables nothing.
   */
  candidateCounts: Record<BadgeKey, number> | null;
  isFiltering?: boolean;
  /**
   * Marks the notFollowingBack chip as overstated (GH#41). The page-level
   * notice explains why; this is what connects the explanation to the number,
   * since the two are far apart on a phone.
   */
  followRequestsUnreadable?: boolean;
  /**
   * Marks every chip whose count a truncated relationship file corrupts. Unlike
   * the flag above this one is not a single badge: which counts are wrong
   * depends on which file arrived short, so the set comes from
   * `badgesAffectedByTruncation` rather than being named here.
   */
  truncatedRelationshipFile?: RelationshipSkew;
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
  return (
    <IconComponent
      size={18}
      className={isActive ? 'text-primary-foreground' : config.defaultClass}
    />
  );
}

/**
 * The option space, grouped. Membership comes from BADGE_GROUPS and nowhere
 * else — a second list here would be the copy that drifts.
 *
 * Configs rather than raw keys: the option loop and the empty-categories block
 * below both read `cfg.type`, and changing the element type would force an edit
 * in four more places for nothing.
 */
const GROUP_CONFIGS: ReadonlyArray<{
  id: BadgeGroupId;
  configs: Array<{ type: BadgeKey }>;
}> = BADGE_GROUPS.map(group => ({
  id: group.id,
  configs: group.members.map(type => ({ type })),
}));

export const FilterChips = memo(function FilterChips({
  selectedFilters,
  onFiltersChange,
  filterCounts,
  candidateCounts,
  isFiltering: _isFiltering = false,
  followRequestsUnreadable = false,
  truncatedRelationshipFile = 'not-applicable',
}: FilterChipsProps) {
  const { t } = useTranslation('results');
  const [showEmptyFilters, setShowEmptyFilters] = useState(false);

  // Derived, never listed here: which counts a short file corrupts is a fact
  // about the badge arithmetic, and a component naming badge keys by hand would
  // be a second copy of it that drifts (`core/badges/index.ts`).
  const affectedByTruncation = badgesAffectedByTruncation(truncatedRelationshipFile);

  // Resolved once, outside the chip loop, and behind the allow-list the typed
  // key union requires: only `followers` and `following` have a `chipHint`, and
  // the key is built by interpolation. Under the truthiness check this replaced,
  // the three quiet verdicts the union gained on 2026-08-25 would each ask
  // i18next for a key that does not exist — `caveat.truncated.no-skew.chipHint`
  // — and i18next answers a missing key with the key string, so the chip's
  // tooltip would read as a raw dotted path in all ten languages (GH#78).
  //
  // The default above is `not-applicable` rather than a verdict: a caller that
  // passes nothing has told us no comparison happened, which is true, where
  // `no-skew` would be a conclusion nobody reached.
  const truncationHint = namesTruncatedFile(truncatedRelationshipFile)
    ? t(`caveat.truncated.${truncatedRelationshipFile}.chipHint`)
    : '';

  const handleFilterToggle = (filter: BadgeKey) => {
    const newFilters = new Set(selectedFilters);
    const action = newFilters.has(filter) ? 'disable' : 'enable';

    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }

    analytics.filterToggle(filter, action, newFilters.size, 'chip');
    onFiltersChange(newFilters);
  };

  const getBadgeCount = (type: BadgeKey) => filterCounts[type] || 0;

  const emptyFilters = GROUP_CONFIGS.flatMap(group => group.configs).filter(
    cfg => getBadgeCount(cfg.type) === 0
  );

  const optionAriaLabel = (option: {
    label: string;
    chipLabel: string;
    isUnavailable: boolean;
    isUnreliable: boolean;
    truncationAffectsChip: boolean;
  }) => {
    // A disabled option says what the selection yields, not that anything is
    // broken — and it says it INSTEAD of the add/remove affordance, which it no
    // longer offers. `filters.unavailable` carries `{{label}}` for exactly this
    // reason, where every hint appended via `chipWithHint` deliberately does
    // not.
    //
    // It replaces the affordance and nothing else. Unavailability and an
    // untrustworthy count are independent facts and they COMPOSE: a truncated
    // file drives `mutuals` and one of the two not-following counts DOWN, so
    // the count that disabled this option may itself be the false one. Returning
    // early on `isUnavailable` dropped the caveat exactly where it matters most
    // — and dropped it only for screen-reader users, who are the ones who cannot
    // see the AlertTriangle rendered beside the label.
    const base = option.isUnavailable
      ? t('filters.unavailable', { label: option.label })
      : option.chipLabel;

    if (!option.isUnreliable) return base;

    // Appended, not a separate element: an aria-label overrides the button's
    // content, so a visually-hidden span inside would never be announced. The
    // join is a translated template, not a hardcoded dash — `ar` and `ja` avoid
    // that character in their own copy and would otherwise get one injected
    // between two non-Latin runs.
    return t('filters.chipWithHint', {
      label: base,
      // One hint, not both, when both causes apply to the same chip. The mark's
      // job is "this number cannot be trusted, read the notice above", and both
      // notices are on the page; reciting two causes inside an aria-label the
      // reader cannot skim would cost more than it explains. Truncation wins
      // because it is the wider damage.
      hint: option.truncationAffectsChip ? truncationHint : t('caveat.followRequests.chipHint'),
    });
  };

  const renderOption = (cfg: { type: BadgeKey }) => {
    const isActive = selectedFilters.has(cfg.type);
    const label = t(`badges.${cfg.type}`);

    // Absence and zero are different facts, and only one of them has a number
    // to show. `undefined` is the state of every first paint, before the first
    // count resolves: no pill, and nothing disabled. A zero is a real
    // measurement — it renders, and it disables.
    const contextual = candidateCounts?.[cfg.type];
    const isUnavailable = !isActive && contextual === 0;

    // The count itself is the thing that is wrong, so the mark goes on the chip,
    // not only in the notice above the list (GH#41).
    //
    // "Unreliable" rather than "overstated": a truncated file drives `mutuals`
    // and one of the two not-following counts DOWN, and calling that
    // overstatement would be a second wrong answer on top of the first.
    const truncationAffectsChip = affectedByTruncation.has(cfg.type);
    const isUnreliable =
      truncationAffectsChip ||
      (followRequestsUnreadable && BADGES_OVERSTATED_BY_UNREADABLE_REQUESTS.has(cfg.type));

    // The contextual figure, never the global one: Task 3 exists because
    // `filterCounts` systematically overstates under grouped OR, so leaving it
    // here would hand a screen-reader user the number this surface removed from
    // the screen.
    const chipLabel =
      contextual === undefined
        ? t(isActive ? 'filters.removeFilterPlain' : 'filters.addFilterPlain', { label })
        : t(isActive ? 'filters.removeFilter' : 'filters.addFilter', {
            label,
            count: contextual,
          });

    return (
      <button
        key={cfg.type}
        onClick={() => handleFilterToggle(cfg.type)}
        disabled={isUnavailable}
        className={`cursor-pointer flex flex-col items-start justify-between p-4 rounded-2xl text-xs font-bold transition-all border min-h-[85px] relative ${
          isActive
            ? 'bg-primary text-primary-foreground border-primary shadow-md'
            : 'text-zinc-600 dark:text-zinc-400 border-border bg-zinc-50/50 dark:bg-zinc-900/20 hover:border-primary/40'
        } ${isUnavailable ? 'opacity-50 cursor-not-allowed hover:border-border' : ''}`}
        aria-label={optionAriaLabel({
          label,
          chipLabel,
          isUnavailable,
          isUnreliable,
          truncationAffectsChip,
        })}
        aria-pressed={isActive}
      >
        <div className="flex items-center justify-between w-full">
          <span>{getBadgeIcon(cfg.type, isActive)}</span>
          {contextual !== undefined && (
            <span
              className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                isActive
                  ? 'bg-white/20 text-primary-foreground'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {numberFormatter.format(contextual)}
            </span>
          )}
        </div>
        <span className="mt-3 flex items-center gap-1.5 leading-snug text-start text-xs">
          {label}
          {isUnreliable && (
            <AlertTriangle
              size={13}
              aria-hidden="true"
              className={isActive ? 'text-primary-foreground shrink-0' : 'text-amber-500 shrink-0'}
            />
          )}
        </span>
      </button>
    );
  };

  return (
    // No card chrome: this is the sheet's content, and the sheet is the card.
    // The title lives once, on SheetContent's accessible name, and the single
    // Reset control lives once, in AppliedFilters.
    <div className="space-y-6">
      {GROUP_CONFIGS.map(group => {
        // Keyed on the all-time count, through the one expression that decides
        // it: an option for a badge this export does not contain belongs in the
        // collapsible block below, not in a section.
        const configs = group.configs.filter(cfg => getBadgeCount(cfg.type) > 0);
        if (configs.length === 0) return null;

        return (
          <section key={group.id} className="mt-6 first:mt-0">
            <h5 className="mb-3 text-xs font-black text-zinc-500 uppercase tracking-widest">
              {t(`filters.groups.${group.id}`)}
            </h5>
            <p className="mb-3 text-xs text-muted-foreground">{t('filters.groupHint')}</p>
            {/* 2-col grid on mobile, 1-col on desktop sidebar */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-2.5">
              {configs.map(renderOption)}
            </div>
          </section>
        );
      })}

      {/* Empty Categories — one block below the three sections, not split per
          group. It is keyed on the GLOBAL count being zero, which is "this
          export does not contain the badge" — a different fact from "your
          current selection excludes it", which is what disables an option
          inside a section. The two must not be merged. */}
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
