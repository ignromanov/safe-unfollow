import {
  Search,
  Users,
  UserPlus,
  XCircle,
  TrendingDown,
  ArrowUpDown,
  Database,
  Upload,
} from 'lucide-react';
import { FilterChips } from './FilterChips';
import { FollowRequestsCaveat } from './FollowRequestsCaveat';
import { AccountList } from './AccountList';
import { StatCard } from './StatCard';
import { InlineDonationCard } from './InlineDonationCard';
import { AdSlot } from './ads/AdSlot';
import { RescuePlanBanner } from './RescuePlanBanner';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { ResultsExportControls } from './export/ResultsExportControls';
import type { BadgeKey } from '@/core/types';
import { RESCUE_PLAN_BANNER_ENABLED } from '@/config/feature-flags';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
import { useFollowRequestsCaveat } from '@/hooks/useFollowRequestsCaveat';
import { useLanguagePrefix } from '@/hooks/useLanguagePrefix';
import { useTimeOnResults } from '@/hooks/useTimeOnResults';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

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
  const prefix = useLanguagePrefix();
  const {
    query,
    setQuery,
    filteredIndices,
    filters,
    setFilters,
    filterCounts,
    isFiltering,
    totalCount,
    hasLoadedData,
  } = useAccountFiltering({ fileHash, accountCount });

  // GH#41: a follow-requests file we could not read inflates notFollowingBack.
  const followRequestsUnreadable = useFollowRequestsCaveat(fileHash);

  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

  const handleClearFilters = () => {
    setFilters(new Set());
    setQuery('');
    trackAction();
  };

  const handleStatCardClick = (badgeType: BadgeKey) => {
    const newFilters = new Set(filters);
    if (newFilters.has(badgeType)) {
      newFilters.delete(badgeType);
    } else {
      newFilters.add(badgeType);
    }
    setFilters(newFilters);
    trackAction();
  };

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
            <Link
              to={`${prefix}/upload`}
              className="font-semibold underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100"
            >
              <Upload className="h-3 w-3 inline align-text-bottom" /> {t('sample.uploadPrompt')}
            </Link>{' '}
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
                ? 'bg-primary text-white border-primary'
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

      {/* Main Content Layout - grid for flexible banner positioning */}
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 md:gap-12">
        {RESCUE_PLAN_BANNER_ENABLED && !isSample && (
          <RescuePlanBanner
            filterCounts={filterCounts}
            totalCount={totalCount}
            className="lg:order-first lg:col-span-2"
          />
        )}

        {/* Filters Sidebar */}
        <div className="space-y-6">
          <FilterChips
            selectedFilters={filters}
            onFiltersChange={setFilters}
            filterCounts={filterCounts}
            isFiltering={isFiltering}
            followRequestsUnreadable={followRequestsUnreadable}
          />
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
              className="text-sm font-semibold text-zinc-500 min-w-0"
            >
              {t('header.showing', {
                filtered: displayCount.toLocaleString(i18n.language),
                total: totalCount.toLocaleString(i18n.language),
              })}
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
          reciprocity that makes it work. BuyMeCoffeeWidget already covers the
          after-the-fact ask, and this card above the list was its badly-timed
          duplicate. Last of the two below-the-list blocks, behind the paid one:
          both are past the reciprocity threshold, and of the pair only the ad
          stops earning when it goes unseen. */}
      <InlineDonationCard accountCount={accountCount} isSample={isSample} />
    </div>
  );
}
