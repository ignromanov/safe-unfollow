import type { BadgeKey } from '@/core/types';
import { analytics } from '@/lib/analytics';
import { IndexedDBFilterEngine } from '@/lib/filtering/IndexedDBFilterEngine';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useAppStore } from '@/lib/store';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';

import { useFilterWorker } from './useFilterWorker';

/**
 * Options for useAccountFiltering hook
 * fileHash and accountCount are now passed as parameters
 * to support multiple data sources (user data vs sample data)
 */
export interface UseAccountFilteringOptions {
  fileHash: string | null;
  accountCount: number;
}

export function useAccountFiltering(options: UseAccountFilteringOptions) {
  const { fileHash, accountCount: totalCount } = options;

  const [query, setQuery] = useState('');
  // null = "show all" (no filters active, no search query) — avoids 8MB array for 1M accounts
  const [filteredIndices, setFilteredIndices] = useState<number[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [processingTime, setProcessingTime] = useState<number>(0);

  // Get filters from store (shared across all data sources)
  const filters = useAppStore(s => s.filters);
  const setStoreFilters = useAppStore(s => s.setFilters);

  // Convert filters Set to stable sorted array for comparison
  // We only recreate when size changes or content changes
  const filtersArray = useMemo(() => {
    return Array.from(filters).sort();
  }, [filters]);

  // Use Web Worker for filtering (keeps main thread responsive)
  const {
    filterToIndices: workerFilterToIndices,
    isReady: isWorkerReady,
    hasError: workerHasError,
  } = useFilterWorker({ fileHash, totalAccounts: totalCount });

  // Fallback filter engine for SSR/testing or when worker fails
  const filterEngineRef = useRef<IndexedDBFilterEngine | null>(null);

  // Debounce search query
  const [debouncedQuery] = useDebounce(query, 300);

  // Track previous filter array value to detect changes by content
  const prevFiltersArrayRef = useRef<string>('');

  // Show loading IMMEDIATELY when filters change (chips)
  useEffect(() => {
    const currentFiltersStr = filtersArray.join(',');
    const filtersChanged = currentFiltersStr !== prevFiltersArrayRef.current;

    if (filtersChanged) {
      setIsFiltering(true);
      prevFiltersArrayRef.current = currentFiltersStr;
    }
  }, [filtersArray]);

  // Show loading when debounced query is ready (after 300ms delay for search)
  useEffect(() => {
    // Only set loading if there's actually a query or filters
    if (debouncedQuery.trim() || filters.size > 0) {
      setIsFiltering(true);
    }
  }, [debouncedQuery, filters]);

  // Track ongoing filtering to prevent duplicates
  const isFilteringRef = useRef(false);
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track last search query for analytics deduplication
  const lastTrackedQueryRef = useRef<string>('');
  // AbortController to cancel previous filter requests (fixes race condition)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize fallback filter engine when fileHash changes (only if worker fails)
  useEffect(() => {
    // Only initialize fallback engine if worker has error or not supported
    if (workerHasError && fileHash && totalCount > 0) {
      const engine = new IndexedDBFilterEngine();
      engine.init(fileHash, totalCount).catch(error => {
        console.error('[useAccountFiltering] Failed to initialize fallback engine:', error);
      });
      filterEngineRef.current = engine;
    }

    return () => {
      if (filterEngineRef.current) {
        filterEngineRef.current.clear();
        filterEngineRef.current = null;
      }
    };
  }, [fileHash, totalCount, workerHasError]);

  // Stable reference to filters string for dependency tracking
  const filtersKey = filtersArray.join(',');

  // Effect to perform filtering when dependencies change
  useEffect(() => {
    // Early exit if no data
    if (!fileHash || totalCount === 0) {
      setFilteredIndices(null);
      setIsFiltering(false);
      isFilteringRef.current = false;
      return;
    }

    const activeFilters = filtersArray as BadgeKey[];

    // Fast path: no filters and no search — use null sentinel ("show all")
    if (activeFilters.length === 0 && !debouncedQuery.trim()) {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // null means "show all" — no 8MB array allocation
      setFilteredIndices(null);
      setIsFiltering(false);
      isFilteringRef.current = false;
      return;
    }

    // Wait for worker to be ready (or fallback if worker failed)
    if (!isWorkerReady && !workerHasError) {
      // Worker still initializing, wait
      return;
    }

    // If already filtering, cancel previous request and start new one
    if (isFilteringRef.current && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    isFilteringRef.current = true;

    // Choose filter method: worker (preferred) or fallback engine
    const performFilter = async (): Promise<number[]> => {
      if (isWorkerReady) {
        // Use Web Worker (off main thread)
        return workerFilterToIndices(debouncedQuery, new Set(activeFilters));
      } else if (filterEngineRef.current) {
        // Fallback to sync engine (main thread)
        return filterEngineRef.current.filterToIndices(debouncedQuery, activeFilters);
      }
      return [];
    };

    performFilter()
      .then(indices => {
        // Check if this request was cancelled
        if (abortController.signal.aborted) {
          return;
        }

        // Only update state if component is still mounted and request not cancelled
        if (isMountedRef.current) {
          // Wrap in startTransition to keep UI responsive during large updates
          startTransition(() => {
            setFilteredIndices(indices);
          });
          setProcessingTime(0);
          setIsFiltering(false);
          isFilteringRef.current = false;
          abortControllerRef.current = null;

          // Track search only if query changed and is non-empty
          const trimmedQuery = debouncedQuery.trim();
          if (trimmedQuery && trimmedQuery !== lastTrackedQueryRef.current) {
            analytics.searchPerform(
              trimmedQuery.length,
              indices.length,
              totalCount,
              activeFilters.length > 0
            );
            lastTrackedQueryRef.current = trimmedQuery;
          }
        }
      })
      .catch(error => {
        // Ignore abort errors (expected when cancelling)
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        console.error('[useAccountFiltering] Filter failed:', error);

        // Only update state if component is still mounted and request not cancelled
        if (isMountedRef.current && !abortController.signal.aborted) {
          setFilteredIndices(null);
          setProcessingTime(0);
          setIsFiltering(false);
          isFilteringRef.current = false;
          abortControllerRef.current = null;
        }
      });

    // Cleanup function to cancel request on unmount or when dependencies change
    return () => {
      if (abortController) {
        abortController.abort();
      }
      isFilteringRef.current = false;
    };
    // Use filtersKey (string) instead of filtersArray (array) to prevent reruns
  }, [
    fileHash,
    totalCount,
    filtersKey,
    debouncedQuery,
    isWorkerReady,
    workerHasError,
    workerFilterToIndices,
    filtersArray,
  ]);

  // Calculate filter counts from IndexedDB
  const [filterCounts, setFilterCounts] = useState<Record<BadgeKey, number>>(
    {} as Record<BadgeKey, number>
  );

  useEffect(() => {
    if (fileHash) {
      indexedDBService.getBadgeStats(fileHash).then(setFilterCounts).catch(console.error);
    }
  }, [fileHash]);

  const clearFilters = useCallback(() => {
    // Cancel any pending filter requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setQuery('');
    setStoreFilters(new Set());
    setFilteredIndices(null);
    setIsFiltering(false);
    isFilteringRef.current = false;
  }, [setStoreFilters]);

  // Cleanup effect to properly unmount
  useEffect(() => {
    // Mark component as mounted
    isMountedRef.current = true;

    // Cleanup function to run when component unmounts
    return () => {
      // Cancel any pending filter requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // Mark component as unmounted to prevent state updates
      isMountedRef.current = false;

      // Reset filtering state
      isFilteringRef.current = false;
    };
  }, []);

  return {
    query,
    setQuery,
    filteredIndices,
    filters,
    setFilters: setStoreFilters,
    filterCounts,
    isFiltering,
    processingTime,
    clearFilters,
    totalCount,
    hasLoadedData: totalCount > 0,
  };
}
