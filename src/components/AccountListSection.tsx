import {
  Search,
  Users,
  UserPlus,
  XCircle,
  TrendingDown,
  ArrowUpDown,
  Database,
  Upload,
  Filter,
} from 'lucide-react';
import { FilterChips } from './FilterChips';
import { AppliedFilters } from './AppliedFilters';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { FollowRequestsCaveat } from './FollowRequestsCaveat';
import { TruncatedFileCaveat } from './TruncatedFileCaveat';
import { AccountList } from './AccountList';
import { StatCard } from './StatCard';
import { InlineDonationCard } from './InlineDonationCard';
import { FeedbackPrompt } from './FeedbackPrompt';
import { PrefixedLink } from './PrefixedLink';
import { AdSlot } from './ads/AdSlot';
import { RescuePlanBanner } from './RescuePlanBanner';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ResultsExportControls } from './export/ResultsExportControls';
import type { BadgeKey } from '@/core/types';
import { BADGE_ORDER } from '@/core/badges';
import { RESCUE_PLAN_BANNER_ENABLED } from '@/config/feature-flags';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
import { useUploadCaveats } from '@/hooks/useUploadCaveats';
import { useTimeOnResults } from '@/hooks/useTimeOnResults';
import { analytics } from '@/lib/analytics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

/** What the applied selection means to a reader, as text and as an empty-state fact. */
interface SelectionSummary {
  /** The rendered state line: one of three, never a dangling separator. */
  stateLine: string;
  /** The single applied filter, or undefined when zero or several are applied. */
  activeFilter?: { label: string; presentInExport: boolean | null };
}

/**
 * Extracted rather than inlined, and the reason is a budget rather than taste:
 * `AccountListSection` sat at exactly ESLint's `complexity` ceiling of 20 before
 * this, and `lint:strict` runs `--max-warnings 0`, so one more branch in the
 * component body fails CI. Complexity is counted per function, so moving the
 * branches out is what buys room — condensing them would not.
 *
 * The name is not decoration either: a control already lit on arrival gives
 * perception no transient to attach to, and `aria-live` does not announce
 * initial content, so the filter's name has to be in the rendered text or it is
 * nowhere.
 */
function describeSelection({
  filters,
  filterCounts,
  displayCount,
  totalCount,
  language,
  t,
}: {
  filters: Set<BadgeKey>;
  filterCounts: Record<BadgeKey, number>;
  displayCount: number;
  totalCount: number;
  language: string;
  t: TFunction<'results'>;
}): SelectionSummary {
  const appliedBadges = BADGE_ORDER.filter(badge => filters.has(badge));
  const appliedLabels = appliedBadges.map(badge => t(`badges.${badge}`));

  const onlyBadge = appliedBadges.length === 1 ? appliedBadges[0] : undefined;
  const onlyCount = onlyBadge ? filterCounts[onlyBadge] : undefined;

  // Present in this export, absent from it, or NOT YET MEASURED. `filterCounts`
  // is the global per-badge count from `getBadgeStats`, and it is `{}` until
  // that promise resolves (`useAccountFiltering.ts:248-256`) — so a missing key
  // means "no answer yet", not "zero". Only a real zero may tell a reader the
  // file that badge is read from was not in their download, which is a
  // different sentence from "you have none of these" and a third one from
  // "we do not know yet".
  //
  // The absence check is per key, not on the map: `noUncheckedIndexedAccess`
  // already types this `number | undefined`, and it stays right if
  // `getBadgeStats` ever returns a partial map, where a check on the map's size
  // would not.
  const activeFilter =
    onlyBadge && appliedLabels[0]
      ? {
          label: appliedLabels[0],
          presentInExport: onlyCount === undefined ? null : onlyCount > 0,
        }
      : undefined;

  const filtered = displayCount.toLocaleString(language);
  const total = totalCount.toLocaleString(language);

  if (appliedLabels.length === 0) {
    return { stateLine: t('header.showingAll', { total }), activeFilter };
  }

  if (appliedLabels.length === 1) {
    return {
      stateLine: t('header.showingOne', { filtered, total, filterName: appliedLabels[0] }),
      activeFilter,
    };
  }

  return {
    stateLine: t('header.showingMany', { filtered, total, count: appliedLabels.length }),
    activeFilter,
  };
}

/**
 * Props for AccountListSection
 * Parameterized to support multiple data sources (user data vs sample data)
 */
export interface AccountListSectionProps {
  /** IndexedDB file hash for data lookup */
  fileHash: string;
  /** Total number of accounts in this dataset */
  accountCount: number;
  /** Display name for the dataset (e.g., "instagram_data.zip" or "Sample Data (Demo)") */
  filename: string;
  /** Whether this is sample/demo data (shows indicator banner) */
  isSample?: boolean;
}

export function AccountListSection({
  fileHash,
  accountCount,
  filename,
  isSample = false,
}: AccountListSectionProps) {
  const { t, i18n } = useTranslation('results');
  const {
    query,
    setQuery,
    filteredIndices,
    filters,
    setFilters,
    filterCounts,
    candidateCounts,
    isFiltering,
    totalCount,
    hasLoadedData,
  } = useAccountFiltering({ fileHash, accountCount });

  // Two independent reasons a count on this page can be wrong: a
  // follow-requests file we could not read (GH#41), and a required file that
  // arrived short because a date range was chosen when the export was
  // requested. One read answers both.
  const { followRequestsUnreadable, truncatedRelationshipFile } = useUploadCaveats(fileHash);

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);

  // Track time on results for engagement analytics
  // V7: trackClick collects badge click data for aggregated summary event
  const { trackAction, trackClick } = useTimeOnResults(accountCount, hasLoadedData);

  // Apply sort order to filtered indices (null = show all)
  const sortedIndices =
    filteredIndices === null
      ? null
      : sortOrder === 'desc'
        ? [...filteredIndices].reverse()
        : filteredIndices;

  // Display count: null means "show all" so use totalCount
  const displayCount = sortedIndices === null ? totalCount : sortedIndices.length;

  // The only clear-all in the shipped surface after the filter card lost its
  // Reset button, so it is the only `filter_clear_all` call site in `src/`.
  // This emit is written fresh rather than moved: FilterChips' `handleClearAll`
  // called `onFiltersChange` and never reached this function, so there was
  // nothing to reroute.
  //
  // Note what this control actually does — it empties the search box too, not
  // only the filters.
  const handleClearFilters = () => {
    analytics.filterClearAll(filters.size);
    setFilters(new Set());
    setQuery('');
    trackAction();
  };

  const handleRemoveFilter = (badgeType: BadgeKey) => {
    const newFilters = new Set(filters);
    newFilters.delete(badgeType);
    analytics.filterToggle(badgeType, 'disable', newFilters.size, 'chip');
    setFilters(newFilters);
    trackAction();
  };

  const handleStatCardClick = (badgeType: BadgeKey) => {
    const newFilters = new Set(filters);
    const action = newFilters.has(badgeType) ? 'disable' : 'enable';

    if (newFilters.has(badgeType)) {
      newFilters.delete(badgeType);
    } else {
      newFilters.add(badgeType);
    }

    analytics.filterToggle(badgeType, action, newFilters.size, 'stat_card');
    setFilters(newFilters);
    trackAction();
  };

  const { stateLine, activeFilter } = describeSelection({
    filters,
    filterCounts,
    displayCount,
    totalCount,
    language: i18n.language,
    t,
  });

  // Calculate stat card values
  const followersCount = filterCounts.followers || 0;
  const followingCount = filterCounts.following || 0;
  const unfollowedCount = filterCounts.unfollowed || 0;
  const notFollowingBackCount = filterCounts.notFollowingBack || 0;

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-16 space-y-6 md:space-y-12 animate-in fade-in duration-500 mb-12 px-4">
      {/* Sample Data Indicator Banner */}
      {isSample && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/50">
          <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">{t('sample.banner')}</AlertTitle>
          <AlertDescription className="block text-blue-700 dark:text-blue-300">
            {t('sample.hint')}{' '}
            <PrefixedLink
              to="/upload"
              className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
            >
              <Upload className="h-3 w-3 inline align-text-bottom" /> {t('sample.uploadPrompt')}
            </PrefixedLink>{' '}
            {t('sample.toSeeReal')}
          </AlertDescription>
        </Alert>
      )}

      {/* Heading in normal flow. It used to live in the sticky container, where
          on mobile it stacked into a column and pinned ~176px under the 64px app
          header — about a third of the viewport, permanently. */}
      <div>
        <h1 className="text-3xl md:text-5xl font-display font-extrabold mb-2 tracking-tight">
          {t('header.title')}
        </h1>
        <p className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-widest">
          {t('header.fileInfo', { filename, count: totalCount })}
        </p>
      </div>

      {/* Sticky: search and sort only. */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-grow md:w-80">
            <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <label htmlFor="account-search" className="sr-only">
              {t('search.placeholder')}
            </label>
            <input
              id="account-search"
              type="text"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoCorrect="off"
              autoCapitalize="none"
              inputMode="search"
              className="w-full ps-11 pe-4 py-3.5 rounded-2xl border border-border bg-card focus:ring-2 focus:ring-primary outline-none transition-all font-semibold text-base shadow-sm"
            />
          </div>
          <button
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            className={`cursor-pointer p-3.5 rounded-2xl border transition-all shadow-sm shrink-0 ${
              sortOrder === 'desc'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border text-zinc-500 hover:text-primary'
            }`}
            title={sortOrder === 'asc' ? t('sort.desc') : t('sort.asc')}
            aria-label={t('sort.ariaLabel', { defaultValue: 'Sort accounts' })}
            aria-pressed={sortOrder === 'desc'}
          >
            <ArrowUpDown size={20} />
          </button>
        </div>
      </div>

      {/* Top Cards - Priority View */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <StatCard
          icon={<UserPlus size={24} />}
          label={t('stats.followers')}
          value={followersCount}
          colorClass="bg-emerald-500/10 text-emerald-500"
          badgeType="followers"
          isActive={filters.has('followers')}
          onClick={handleStatCardClick}
        />
        <StatCard
          icon={<Users size={24} />}
          label={t('stats.following')}
          value={followingCount}
          colorClass="bg-blue-500/10 text-blue-500"
          badgeType="following"
          isActive={filters.has('following')}
          onClick={handleStatCardClick}
        />
        <StatCard
          icon={<XCircle size={24} />}
          label={t('stats.unfollowed')}
          value={unfollowedCount}
          colorClass="bg-rose-500/10 text-rose-500"
          badgeType="unfollowed"
          isActive={filters.has('unfollowed')}
          onClick={handleStatCardClick}
        />
        <StatCard
          icon={<TrendingDown size={24} />}
          label={t('stats.notFollowing')}
          value={notFollowingBackCount}
          colorClass="bg-amber-500/10 text-amber-500"
          badgeType="notFollowingBack"
          isActive={filters.has('notFollowingBack')}
          onClick={handleStatCardClick}
        />
      </div>

      {/* Between the "Not Following" stat card and the filter chips — the two
          places the overstated number is read — and full width in both layouts,
          because the sidebar it would otherwise sit in is 20rem on desktop. */}
      {followRequestsUnreadable && <FollowRequestsCaveat />}
      <TruncatedFileCaveat truncated={truncatedRelationshipFile} />

      {/* Main Content Layout - grid for flexible banner positioning */}
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 md:gap-12">
        {RESCUE_PLAN_BANNER_ENABLED && !isSample && (
          <RescuePlanBanner
            filterCounts={filterCounts}
            totalCount={totalCount}
            className="lg:order-first lg:col-span-2"
          />
        )}

        {/* Filters Sidebar: what is applied stays on the page; choosing is a
            sheet on every viewport. A lit control in the option space cannot
            carry applied state — it lights identically whether the reader
            tapped it or arrived with it already on from localStorage.

            `lg:sticky lg:top-24` belongs on this card and only this card: the
            declaration it replaces sat inside what is now a `fixed` sheet,
            where it did nothing. */}
        <div className="space-y-6">
          <div className="bg-card p-5 md:p-6 rounded-4xl border border-border shadow-sm space-y-5 lg:sticky lg:top-24">
            <AppliedFilters
              selectedFilters={filters}
              onRemove={handleRemoveFilter}
              onClearAll={handleClearFilters}
            />
            <Sheet open={isFilterSheetOpen} onOpenChange={setFilterSheetOpen}>
              <SheetTrigger asChild>
                <button className="cursor-pointer w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-border bg-zinc-50/50 dark:bg-zinc-900/20 text-xs font-black uppercase tracking-widest hover:border-primary/40">
                  <Filter size={14} className="text-primary" />
                  {filters.size > 0
                    ? t('filters.openSheetWithCount', { count: filters.size })
                    : t('filters.openSheet')}
                </button>
              </SheetTrigger>
              <SheetContent aria-label={t('filters.title')}>
                <FilterChips
                  selectedFilters={filters}
                  onFiltersChange={setFilters}
                  filterCounts={filterCounts}
                  candidateCounts={candidateCounts}
                  isFiltering={isFiltering}
                  followRequestsUnreadable={followRequestsUnreadable}
                  truncatedRelationshipFile={truncatedRelationshipFile}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* The only promo above the list. On desktop it takes the full-width
            row the rescue plan banner used to hold — the position, never its
            styling. In the single column it stays where it sits in the DOM,
            between the filters and the list: the reader has just narrowed their
            results and is about to look at them, which is the one moment on this
            page they are neither typing nor scanning rows.

            Order comes from the DOM, not from `order-*` utilities, so it is also
            the order a screen reader announces; `lg:order-first` is the single
            documented exception. The margins are policy, not taste: FilterChips
            are tappable on one side and account rows on the other, and an ad
            butted against either invites accidental clicks. */}
        {!isSample && (
          <AdSlot
            name="results"
            slot={import.meta.env.VITE_ADSENSE_SLOT_RESULTS}
            className="my-4 lg:order-first lg:col-span-2 lg:mt-0"
          />
        )}

        {/* Account List */}
        <div className="min-w-0">
          {/* Content header for the list: what you are looking at on the left,
              what it costs to take it with you on the right. Deliberately
              outside the list card — the card is the virtualiser's measured
              box, and the trigger sits where every reviewed competitor puts
              export, at the top of the content area rather than in a toolbar.

              The count carries the live region that used to be a separate
              sr-only span. Two elements saying the same thing read it twice to
              a screen reader; one visible element that also announces is both
              cheaper and honest about what sighted users can see. */}
          <div className="flex items-center justify-between gap-3 mb-3 md:mb-4">
            <p
              aria-live="polite"
              aria-atomic="true"
              // `text-zinc-500` had no dark variant and measured 4.20:1 on the
              // dark background — under the 4.5:1 floor. The semantic token is
              // 4.72:1 light / 9.12:1 dark, and it is what the export caption
              // opposite it in this row uses, so the two sides of the row stop
              // reading from different grey systems.
              className="text-sm font-semibold text-muted-foreground min-w-0"
            >
              {stateLine}
            </p>
            {/* Sample data is demo content — never worth paying to export */}
            {!isSample && (
              <ResultsExportControls
                fileHash={fileHash}
                indices={sortedIndices}
                totalCount={totalCount}
                filename={filename.replace(/\.[^/.]+$/, '') || 'safeunfollow-export'}
              />
            )}
          </div>

          <AccountList
            fileHash={fileHash}
            accountCount={accountCount}
            accountIndices={sortedIndices}
            hasLoadedData={hasLoadedData}
            isLoading={isFiltering}
            activeFilter={activeFilter}
            searchActive={query.length > 0}
            onClearFilters={handleClearFilters}
            onAccountClick={trackClick}
          />
        </div>
      </div>

      {/* Tail unit. Better Ads measures density over the main content and
          excludes ads below it, so the position keeps this one out of the
          worst-case reading. `display` at 100px rather than multiplex: the fixed
          height preserves the zero-CLS path, and at 26.4% worst-case mobile
          density there is no slack for a unit that sizes itself. */}
      {!isSample && (
        <AdSlot
          name="results_end"
          slot={import.meta.env.VITE_ADSENSE_SLOT_RESULTS_END}
          minHeight={100}
        />
      )}

      {/* Below the list: an ask placed before the value is delivered inverts the
          reciprocity that makes it work, which is why this card is not above it.
          It used to share the after-the-fact ask with a floating BuyMeACoffee
          widget; that widget was removed 2026-08-19 because its clicks were
          unattributable by construction, so this card and the footer link are
          now the whole ask. Last of the two below-the-list blocks, behind the paid one:
          both are past the reciprocity threshold, and of the pair only the ad
          stops earning when it goes unseen. */}
      <InlineDonationCard accountCount={accountCount} isSample={isSample} />

      {/* Same reciprocity ordering as the donation card above it: after the
          value, not before. Unlike the ask above, this one has no dismiss —
          asking what to build next isn't a repeatable annoyance the way a
          donation nudge can become, and it carries its own disclosure notice
          instead of a close control.

          It is also deliberately a tier below that card rather than a match
          for it: unfilled against its bg-muted, no icon tile, lighter
          headline. The two blocks are adjacent, so anything they share
          verbatim reads as one block printed twice — and of the pair only the
          one above earns money. */}
      <FeedbackPrompt isSample={isSample} />
    </div>
  );
}
