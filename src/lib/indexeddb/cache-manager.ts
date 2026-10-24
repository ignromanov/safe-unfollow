/**
 * CacheManager - In-memory cache for BitSets and StringColumnReaders
 *
 * Extracted from IndexedDBService to separate caching concerns.
 * Cache keys use `${fileHash}:${identifier}` format.
 */

import type { DateColumn } from './date-column';
import type { BitSet, StringColumnReader } from './bitset';

export class CacheManager {
  readonly bitsetCache = new Map<string, BitSet>();
  readonly columnCache = new Map<string, StringColumnReader>();
  /** null = "read, no column": absence is cached too, so it is read once. */
  readonly dateColumnCache = new Map<string, DateColumn | null>();

  /**
   * Clear in-memory caches for a specific file or all files
   */
  clearCaches(fileHash?: string): void {
    if (fileHash) {
      const prefix = `${fileHash}:`;
      for (const key of this.bitsetCache.keys()) {
        if (key.startsWith(prefix)) {
          this.bitsetCache.delete(key);
        }
      }
      for (const key of this.columnCache.keys()) {
        if (key.startsWith(prefix)) {
          this.columnCache.delete(key);
        }
      }
      for (const key of this.dateColumnCache.keys()) {
        if (key.startsWith(prefix)) {
          this.dateColumnCache.delete(key);
        }
      }
    } else {
      this.dateColumnCache.clear();
      this.bitsetCache.clear();
      this.columnCache.clear();
    }
  }
}
