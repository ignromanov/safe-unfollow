/**
 * useFilterWorker - Hook for filter operations via Web Worker
 *
 * Runs IndexedDBFilterEngine in a Web Worker to keep main thread responsive.
 * Uses Comlink for seamless async communication.
 *
 * @module useFilterWorker
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as Comlink from 'comlink';

import type { FilterWorkerApi } from '@/workers/filter-worker';
import type { BadgeKey } from '@/core/types';
import { logger } from '@/lib/logger';

interface UseFilterWorkerOptions {
  fileHash: string | null;
  totalAccounts: number;
}

interface UseFilterWorkerResult {
  /** Filter accounts by query and badge filters */
  filterToIndices: (query: string, filters: Set<BadgeKey>) => Promise<number[]>;
  /** Get badge statistics */
  getStats: () => Promise<Record<BadgeKey, number>>;
  /** Whether the worker is initialized and ready */
  isReady: boolean;
  /** Whether the worker failed to initialize */
  hasError: boolean;
  /** Error message if initialization failed */
  error: string | null;
}

/**
 * Hook for running filter operations in a Web Worker
 *
 * @param options - Configuration options
 * @returns Filter methods and status
 */
export function useFilterWorker(options: UseFilterWorkerOptions): UseFilterWorkerResult {
  const { fileHash, totalAccounts } = options;

  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<FilterWorkerApi> | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker when fileHash changes
  useEffect(() => {
    // Skip if no file hash or no accounts
    if (!fileHash || totalAccounts === 0) {
      setIsReady(false);
      return;
    }

    // Clean up previous worker if exists
    if (workerRef.current) {
      apiRef.current?.dispose();
      workerRef.current.terminate();
      workerRef.current = null;
      apiRef.current = null;
    }

    let isActive = true;

    const initWorker = async () => {
      try {
        // Create new worker
        const worker = new Worker(new URL('../workers/filter-worker.ts', import.meta.url), {
          type: 'module',
        });

        workerRef.current = worker;
        const api = Comlink.wrap<FilterWorkerApi>(worker);
        apiRef.current = api;

        // Initialize the engine in the worker
        await api.initialize(fileHash, totalAccounts);

        if (isActive) {
          setIsReady(true);
          setError(null);
        }
      } catch (err) {
        logger.error('[useFilterWorker] Failed to initialize worker:', err);
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Worker initialization failed');
          setIsReady(false);
        }
      }
    };

    initWorker();

    // Cleanup on unmount or when dependencies change
    return () => {
      isActive = false;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsReady(false);
    };
  }, [fileHash]);

  // Filter method that delegates to worker
  const filterToIndices = useCallback(
    async (query: string, filters: Set<BadgeKey>): Promise<number[]> => {
      if (!apiRef.current) {
        // Return empty array if worker not ready (will use fallback)
        return [];
      }

      try {
        // Convert Set to Array for transfer (Sets can't be transferred)
        const filtersArray = Array.from(filters);
        return await apiRef.current.filterToIndices(query, filtersArray);
      } catch (err) {
        logger.error('[useFilterWorker] Filter operation failed:', err);
        throw err;
      }
    },
    []
  );

  // Get stats method that delegates to worker
  const getStats = useCallback(async (): Promise<Record<BadgeKey, number>> => {
    if (!apiRef.current) {
      return {} as Record<BadgeKey, number>;
    }

    try {
      return await apiRef.current.getStats();
    } catch (err) {
      logger.error('[useFilterWorker] getStats failed:', err);
      throw err;
    }
  }, []);

  return {
    filterToIndices,
    getStats,
    isReady,
    hasError: error !== null,
    error,
  };
}
