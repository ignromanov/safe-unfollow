import { BADGE_STYLES } from '@/constants/badge-styles';
import type { AccountBadges, BadgeKey } from '@/core/types';
import { useAccountDataSource } from '@/hooks/useAccountDataSource';
import { analytics } from '@/lib/analytics';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ExternalLink, User, Ghost } from 'lucide-react';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Props for AccountList component
 * Parameterized to support multiple data sources (user data vs sample data)
 */
export interface AccountListProps {
  /** IndexedDB file hash for data lookup */
  fileHash: string;
  /** Total number of accounts in this dataset */
  accountCount: number;
  /** Array of account indices to display (after filtering) */
  accountIndices: number[];
  /** Whether data has been loaded */
  hasLoadedData: boolean;
  /** Whether filtering is in progress */
  isLoading?: boolean;
  /** Callback to clear all filters */
  onClearFilters?: () => void;
  /** V7: Callback to track account click with badges for aggregation */
  onAccountClick?: (badges: string[]) => void;
}

export const AccountList = memo(function AccountList({
  fileHash,
  accountCount,
  accountIndices,
  hasLoadedData,
  onClearFilters,
  onAccountClick,
}: AccountListProps) {
  const { t } = useTranslation('results');
  const parentRef = useRef<HTMLDivElement>(null);
  const trackedDepthsRef = useRef<Set<25 | 50 | 75 | 100>>(new Set());

  // Initialize data source for lazy loading (uses passed fileHash, not store)
  const { getAccount } = useAccountDataSource({
    fileHash,
    accountCount,
    chunkSize: 500,
    overscan: 20,
  });

  const displayCount = accountIndices?.length || 0;

  const getAccountByIndex = useCallback(
    (virtualIndex: number) => {
      const actualIndex = accountIndices?.[virtualIndex];
      if (actualIndex === undefined) return undefined;
      return getAccount(actualIndex);
    },
    [accountIndices, getAccount]
  );

  const virtualizer = useVirtualizer({
    count: displayCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 92,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Track scroll depth milestones
  useEffect(() => {
    const scrollElement = parentRef.current;
    if (!scrollElement || displayCount === 0) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const scrollPercent = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);

      const depths = [25, 50, 75, 100] as const;
      for (const depth of depths) {
        if (scrollPercent >= depth && !trackedDepthsRef.current.has(depth)) {
          trackedDepthsRef.current.add(depth);
          analytics.resultsScrollDepth(depth, displayCount);
        }
      }
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [displayCount]);

  // Reset tracked depths when data changes
  useEffect(() => {
    trackedDepthsRef.current.clear();
  }, [fileHash, accountIndices]);

  if (!hasLoadedData) {
    return null;
  }

  if (displayCount === 0) {
    return (
      <div className="flex-grow bg-card rounded-4xl border border-border shadow-sm overflow-hidden flex flex-col h-[85vh] md:h-[90vh]">
        <div className="flex flex-col items-center justify-center h-full py-24 text-center px-12">
          <Ghost size={64} className="mb-8 opacity-10" />
          <p className="text-xl md:text-2xl font-display font-bold text-zinc-300">
            {t('empty.noUsers')}
          </p>
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="mt-4 text-primary font-black uppercase text-xs tracking-widest hover:underline"
            >
              {t('empty.resetFilters')}
            </button>
          )}
        </div>
      </div>
    );
  }

  // V9: Track profile click via aggregation callback only (profileClick event removed)
  const trackAccountClick = (account: AccountBadges) => {
    const activeBadges = (Object.entries(account.badges) as [BadgeKey, boolean][])
      .filter(([, active]) => active)
      .map(([key]) => key);

    onAccountClick?.(activeBadges);
  };

  const SkeletonItem = () => (
    <div className="flex items-center justify-between px-6 py-6 border-b border-border animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-muted" />
        <div className="space-y-2">
          <div className="h-4 md:h-5 bg-muted rounded w-32" />
          <div className="h-3 bg-muted rounded w-20" />
        </div>
      </div>
    </div>
  );

  const AccountItem = ({ account }: { account: AccountBadges }) => {
    const handleLinkClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      trackAccountClick(account);
    };

    return (
      <div
        className="flex items-center justify-between px-5 md:px-8 py-4 md:py-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors border-b border-border last:border-0"
        role="button"
        tabIndex={0}
      >
        {/* Avatar + Info */}
        <div className="flex items-center gap-4 md:gap-6 min-w-0 flex-grow">
          <div className="w-11 h-11 md:w-16 md:h-16 shrink-0 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 border border-border">
            <User size={24} />
          </div>
          <div className="min-w-0 flex-grow">
            <a
              href={`https://instagram.com/${account.username}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              className="font-display font-bold text-base md:text-2xl truncate text-zinc-900 dark:text-white mb-1.5 md:mb-2 leading-tight block hover:text-primary transition-colors"
            >
              @{account.username}
            </a>
            {/* Horizontal Badge Scroll on Mobile */}
            <div className="flex gap-1.5 md:gap-2 overflow-x-auto pb-1 no-scrollbar -mx-1 px-1">
              {Object.entries(account.badges)
                .filter(([, hasBadge]) => hasBadge)
                .map(([badgeKey]) => (
                  <span
                    key={badgeKey}
                    className={`shrink-0 text-xs uppercase tracking-wider font-black px-2.5 py-1 rounded-lg border leading-none ${
                      BADGE_STYLES[badgeKey] || 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {t(`badges.${badgeKey as BadgeKey}`)}
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* External Link Button */}
        <a
          href={`https://instagram.com/${account.username}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          className="ml-4 p-3 md:p-4 rounded-2xl text-zinc-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20 shrink-0"
          title={t('list.viewProfile')}
        >
          <ExternalLink size={18} />
        </a>
      </div>
    );
  };

  return (
    <div className="flex-grow bg-card rounded-4xl border border-border shadow-sm overflow-hidden flex flex-col h-[85vh] md:h-[90vh]">
      {/* List Header */}
      <div className="px-5 md:px-8 py-4 md:py-5 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/30">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
          {t('list.header', { count: displayCount })}
        </h3>
      </div>
      {/* Virtual List */}
      <div ref={parentRef} className="flex-grow overflow-auto custom-scrollbar">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map(virtualItem => {
            const account = getAccountByIndex(virtualItem.index);

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {account ? <AccountItem account={account} /> : <SkeletonItem />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
