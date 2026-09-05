import { useAccountDataSource } from '@/hooks/useAccountDataSource';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Ghost } from 'lucide-react';
import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountItem } from './AccountItem';
import { SkeletonItem } from './SkeletonItem';

/**
 * Props for AccountList component
 * Parameterized to support multiple data sources (user data vs sample data)
 */
export interface AccountListProps {
  /** IndexedDB file hash for data lookup */
  fileHash: string;
  /** Total number of accounts in this dataset */
  accountCount: number;
  /** Array of account indices to display (after filtering), or null for "show all" */
  accountIndices: number[] | null;
  /** Whether data has been loaded */
  hasLoadedData: boolean;
  /** Whether filtering is in progress */
  isLoading?: boolean;
  /** The single applied filter, or undefined when zero or several are applied. */
  activeFilter?: { label: string; presentInExport: boolean | null };
  /** Whether a search query is also narrowing the list. */
  searchActive?: boolean;
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
  activeFilter,
  searchActive,
  onClearFilters,
  onAccountClick,
}: AccountListProps) {
  const { t } = useTranslation('results');
  const parentRef = useRef<HTMLDivElement>(null);

  // Initialize data source for lazy loading (uses passed fileHash, not store)
  const { getAccount } = useAccountDataSource({
    fileHash,
    accountCount,
    chunkSize: 500,
    overscan: 20,
  });

  // null = "show all", use accountCount; otherwise use array length
  const displayCount = accountIndices === null ? accountCount : accountIndices.length;

  const getAccountByIndex = useCallback(
    (virtualIndex: number) => {
      // null means "show all" — use raw index directly
      const actualIndex = accountIndices === null ? virtualIndex : accountIndices[virtualIndex];
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

  if (!hasLoadedData) {
    return null;
  }

  if (displayCount === 0) {
    return (
      <div className="flex-grow bg-card rounded-4xl border border-border shadow-sm overflow-hidden flex flex-col max-h-[65dvh] md:max-h-[90vh]">
        {/* No h-full here: the card above is capped, not sized, so its height is
            auto and a percentage height has nothing to resolve against. It used
            to resolve against h-[85dvh] and stretch this box to centre the
            message in a tall panel; the cap left the class inert. */}
        <div className="flex flex-col items-center justify-center py-24 text-center px-12">
          <Ghost size={64} className="mb-8 opacity-10" />
          <p className="text-xl md:text-2xl font-display font-bold text-zinc-300">
            {!activeFilter
              ? t('empty.noUsers')
              : activeFilter.presentInExport === false
                ? t('empty.absentTitle', { filterName: activeFilter.label })
                : t('empty.filteredTitle', { filterName: activeFilter.label })}
          </p>
          {/*
            Three states, not two. `presentInExport === null` means the per-badge
            counts have not resolved yet, and neither explanation has been
            measured: the title above names the filter, which is true either
            way, and no body claims anything about the export.
          */}
          {activeFilter && activeFilter.presentInExport !== null && (
            <p className="mt-3 text-sm text-muted-foreground">
              {activeFilter.presentInExport ? t('empty.filteredBody') : t('empty.absentBody')}
            </p>
          )}
          {onClearFilters && (
            <button
              onClick={onClearFilters}
              className="mt-4 text-primary font-black uppercase text-xs tracking-widest hover:underline"
            >
              {/*
                The specific label only when it is a true description of the tap.
                This button clears the search box as well as the filters, so
                "Remove <filter> filter" is a promise it does not keep whenever a
                query is active.
              */}
              {activeFilter && !searchActive
                ? t('filters.removeOne', { label: activeFilter.label })
                : t('empty.resetFilters')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow bg-card rounded-4xl border border-border shadow-sm overflow-hidden flex flex-col max-h-[65dvh] md:max-h-[90vh]">
      {/* List Header */}
      <div className="px-5 md:px-8 py-4 md:py-5 border-b border-border bg-zinc-50/50 dark:bg-zinc-900/30">
        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">
          {t('list.header', { count: displayCount })}
        </h3>
      </div>
      {/* Virtual List */}
      <div
        ref={parentRef}
        className="flex-grow overflow-auto custom-scrollbar overscroll-contain"
        role="feed"
        aria-busy={false}
      >
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
                {account ? (
                  <AccountItem
                    account={account}
                    index={virtualItem.index}
                    totalCount={displayCount}
                    onAccountClick={onAccountClick}
                  />
                ) : (
                  <SkeletonItem />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
