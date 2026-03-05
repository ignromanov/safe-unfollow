/**
 * Bitset Store - Badge bitset read/write operations with caching support
 */

import type { AccountBadges, BadgeKey } from '@/core/types';
import { BitSet } from '../bitset';
import type { BitsetRecord } from '../indexeddb-schema';
import { STORES } from '../indexeddb-schema';
import { executeRead, executeWrite } from '../transaction-helpers';

/**
 * Update badge bitset for a chunk of accounts (read-modify-write within transaction)
 */
export async function updateBadgeBitset(
  tx: IDBTransaction,
  fileHash: string,
  badge: BadgeKey,
  accounts: AccountBadges[],
  startIndex: number
): Promise<void> {
  const store = tx.objectStore(STORES.BITSETS);

  // Get existing bitset or create new
  const existing = await executeRead<BitsetRecord>(store, [fileHash, badge]);

  let bitset: BitSet;
  let count = existing?.accountCount ?? 0;

  if (existing) {
    bitset = BitSet.fromUint8Array(existing.data);
  } else {
    // Estimate total size (will grow as needed)
    bitset = new BitSet(startIndex + accounts.length);
  }

  // Update bits for this chunk
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    if (!account) continue;

    const accountIndex = startIndex + i;

    if (account.badges[badge]) {
      bitset.set(accountIndex);
      count++;
    }
  }

  const record: BitsetRecord = {
    fileHash,
    badge,
    data: bitset.toUint8Array(),
    accountCount: count,
  };

  await executeWrite(store, record);
}

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
