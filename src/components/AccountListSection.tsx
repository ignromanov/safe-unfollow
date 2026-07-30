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
import { AccountList } from './AccountList';
import { StatCard } from './StatCard';
import { InlineDonationCard } from './InlineDonationCard';
import { AdSlot } from './ads/AdSlot';
import { RescuePlanBanner } from './RescuePlanBanner';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import type { BadgeKey } from '@/core/types';
import { RESCUE_PLAN_BANNER_ENABLED } from '@/config/feature-flags';
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
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
  const { t } = useTranslation('results');
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
      {/* Screen reader announcement for results count */}
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {t('results.liveCount', {
          count: displayCount,
          total: totalCount,
          defaultValue: 'Showing {{count}} of {{total}} accounts',
        })}
      </span>

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

      {/* Top Header & Search */}
      <div className="sticky top-16 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl md:text-5xl font-display font-extrabold mb-2 tracking-tight">
              {t('header.title')}
            </h1>
            <p className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-widest">
              {t('header.fileInfo', { filename, count: totalCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-grow md:w-80">
              <Search
                className="absolute start-4 top-1/2 -translate-y-1/2 text-zinc-400"
                size={18}
              />
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

      {/* Main Content Layout - grid for flexible banner positioning */}
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 md:gap-12">
        {/* The only promo above the list. Takes the grid slot the rescue plan
            banner used to hold — the position, never its styling. The wide gap
            below is policy, not taste: FilterChips are tappable and an ad butted
            against them invites accidental clicks. */}
        {!isSample && (
          <AdSlot
            name="results"
            slot={import.meta.env.VITE_ADSENSE_SLOT_RESULTS}
            className="order-1 mb-4 lg:order-first lg:col-span-2"
          />
        )}

        {RESCUE_PLAN_BANNER_ENABLED && !isSample && (
          <RescuePlanBanner
            filterCounts={filterCounts}
            totalCount={totalCount}
            className="order-2 lg:order-first lg:col-span-2"
          />
        )}

        {/* Filters Sidebar */}
        <div className="order-2 lg:order-none space-y-6">
          <FilterChips
            selectedFilters={filters}
            onFiltersChange={setFilters}
            filterCounts={filterCounts}
            isFiltering={isFiltering}
          />
        </div>

        {/* Account List */}
        <div className="order-3 lg:order-none min-w-0">
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

      {/* Moved below the list: an ask placed before the value is delivered
          inverts the reciprocity that makes it work. BuyMeCoffeeWidget already
          covers the after-the-fact ask, and this card above the list was its
          badly-timed duplicate. */}
      <InlineDonationCard accountCount={accountCount} isSample={isSample} />

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
    </div>
  );
}
