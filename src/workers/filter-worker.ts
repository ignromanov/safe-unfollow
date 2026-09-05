/**
 * Filter Worker - Runs IndexedDBFilterEngine off the main thread
 *
 * This worker handles all filter operations to keep the main thread responsive.
 * Uses Comlink for seamless async communication.
 *
 * @module filter-worker
 */

import * as Comlink from 'comlink';

import { IndexedDBFilterEngine } from '@/lib/filtering/IndexedDBFilterEngine';
import type { BadgeKey } from '@/core/types';

// Single engine instance per worker
let engineInstance: IndexedDBFilterEngine | null = null;
let isInitialized = false;

/**
 * Reset worker state (for testing purposes)
 */
export function resetWorkerState(): void {
  engineInstance = null;
  isInitialized = false;
}

/**
 * Filter Worker API exposed via Comlink
 * Exported for direct unit testing
 */
export const filterWorkerApi = {
  /**
   * Initialize the filter engine with file hash and account count
   */
  async initialize(fileHash: string, totalAccounts: number): Promise<void> {
    engineInstance = new IndexedDBFilterEngine();
    await engineInstance.init(fileHash, totalAccounts);
    isInitialized = true;
  },

  /**
   * Check if the worker is initialized
   */
  isReady(): boolean {
    return isInitialized && engineInstance !== null;
  },

  /**
   * Filter accounts by search query and badge filters
   * Returns array of matching account indices
   */
  async filterToIndices(query: string, filters: string[]): Promise<number[]> {
    if (!engineInstance) {
      throw new Error('[FilterWorker] Engine not initialized');
    }
    return engineInstance.filterToIndices(query, filters as BadgeKey[]);
  },

  /**
   * Get badge statistics (counts per badge type)
   */
  async getStats(): Promise<Record<BadgeKey, number>> {
    if (!engineInstance) {
      throw new Error('[FilterWorker] Engine not initialized');
    }
    return engineInstance.getStats();
  },

  /**
   * Per-option counts against the live selection. Same reason as getStats: the
   * bitsets are resident here, and shipping them to the main thread to count
   * them would move ~125 KB per badge per selection change.
   */
  async candidateCounts(filters: string[]): Promise<Record<BadgeKey, number>> {
    if (!engineInstance) {
      throw new Error('[FilterWorker] Engine not initialized');
    }
    return engineInstance.candidateCounts(filters as BadgeKey[]);
  },

  /**
   * Reset the engine (clear caches and state)
   */
  reset(): void {
    if (engineInstance) {
      engineInstance.reset();
    }
    isInitialized = false;
  },

  /**
   * Dispose of the engine instance
   */
  dispose(): void {
    if (engineInstance) {
      engineInstance.clear();
      engineInstance = null;
    }
    isInitialized = false;
  },
};

// Export type for use in the hook
export type FilterWorkerApi = typeof filterWorkerApi;

// Expose the API via Comlink only in worker environment
// Check for postMessage which exists in real workers and @vitest/web-worker
// but not when imported directly in Node/test for unit testing
const isWorkerContext = typeof self !== 'undefined' && typeof self.postMessage === 'function';

if (isWorkerContext) {
  Comlink.expose(filterWorkerApi);
}
