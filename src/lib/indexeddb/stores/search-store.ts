/**
 * Search Store - Search index (prefix/trigram) persistence with TTL
 */

import { BitSet } from '../bitset';
import type { SearchIndexRecord, SearchIndexType } from '../indexeddb-schema';
import { CACHE_CONFIG, STORES } from '../indexeddb-schema';
import { executeRead, executeWrite } from '../transaction-helpers';

/**
 * Save a search index entry with TTL
 */
export async function putSearchIndex(
  db: IDBDatabase,
  fileHash: string,
  type: SearchIndexType,
  key: string,
  bitset: BitSet
): Promise<void> {
  const tx = db.transaction([STORES.INDEXES], 'readwrite');
  const store = tx.objectStore(STORES.INDEXES);

  const now = Date.now();
  const ttl = CACHE_CONFIG.INDEX_CACHE_DAYS * 24 * 60 * 60 * 1000;

  const record: SearchIndexRecord = {
    fileHash,
    type,
    key,
    data: bitset.toUint8Array(),
    createdAt: now,
    expiresAt: now + ttl,
  };

  await executeWrite(store, record);
}

/**
 * Get a search index entry, returning null if expired (and deleting it)
 */
export async function getSearchIndex(
  db: IDBDatabase,
  fileHash: string,
  type: SearchIndexType,
  key: string
): Promise<BitSet | null> {
  const tx = db.transaction([STORES.INDEXES], 'readonly');
  const store = tx.objectStore(STORES.INDEXES);

  const record = await executeRead<SearchIndexRecord>(store, [fileHash, type, key]);

  if (!record) return null;

  // Check expiration
  if (Date.now() > record.expiresAt) {
    // Delete expired index
    const delTx = db.transaction([STORES.INDEXES], 'readwrite');
    delTx.objectStore(STORES.INDEXES).delete([fileHash, type, key]);
    return null;
  }

  return BitSet.fromUint8Array(record.data);
}
