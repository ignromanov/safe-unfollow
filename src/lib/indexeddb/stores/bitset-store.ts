/**
 * Bitset Store - Badge bitset read operations with caching support
 */

import type { BadgeKey } from '@/core/types';
import { BitSet } from '../bitset';
import type { BitsetRecord } from '../indexeddb-schema';
import { STORES } from '../indexeddb-schema';
import { executeRead } from '../transaction-helpers';

/**
 * Get badge bitset with in-memory caching
 */
export async function getBadgeBitset(
  db: IDBDatabase,
  fileHash: string,
  badge: BadgeKey,
  cache: Map<string, BitSet>
): Promise<BitSet | null> {
  const cacheKey = `${fileHash}:${badge}`;
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const tx = db.transaction([STORES.BITSETS], 'readonly');
  const store = tx.objectStore(STORES.BITSETS);

  const record = await executeRead<BitsetRecord>(store, [fileHash, badge]);

  if (!record) {
    return null;
  }

  const bitset = BitSet.fromUint8Array(record.data);
  cache.set(cacheKey, bitset);

  return bitset;
}

/**
 * Get badge statistics (count per badge) using cursor over index
 */
export async function getBadgeStats(
  db: IDBDatabase,
  fileHash: string
): Promise<Record<BadgeKey, number>> {
  const tx = db.transaction([STORES.BITSETS], 'readonly');
  const store = tx.objectStore(STORES.BITSETS);
  const index = store.index('fileHash');

  const stats: Partial<Record<BadgeKey, number>> = {};

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(fileHash));

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const record = cursor.value as BitsetRecord;
        stats[record.badge] = record.accountCount;
        cursor.continue();
      } else {
        resolve(stats as Record<BadgeKey, number>);
      }
    };

    request.onerror = () => reject(request.error);
  });
}
