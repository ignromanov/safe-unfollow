/**
 * IndexedDB Service v2 - High-level API for optimized columnar storage
 *
 * Features:
 * - Chunked account ingestion with progress tracking
 * - Bitset-based badge storage for fast filtering
 * - Lazy loading support for virtualization
 * - Search index caching with TTL
 *
 * Store-specific logic is extracted into:
 * - stores/file-store.ts    (file metadata CRUD)
 * - stores/column-store.ts  (columnar data append)
 * - stores/bitset-store.ts  (badge bitset operations)
 * - stores/search-store.ts  (search index persistence)
 * - cache-manager.ts        (in-memory caching)
 */

import type { AccountBadges, BadgeKey } from '@/core/types';
import { BitSet, StringColumnBuilder, StringColumnReader } from './bitset';
import { CacheManager } from './cache-manager';
import {
  DB_CONFIG,
  STORES,
  STORE_CONFIGS,
  type ColumnRecord,
  type FileMetadataRecord,
  type SearchIndexType,
} from './indexeddb-schema';
import {
  executeDelete,
  executeRead,
  executeWrite,
  getAllKeysFromIndex,
  waitForTransaction,
} from './transaction-helpers';
import * as fileStore from './stores/file-store';
import * as columnStore from './stores/column-store';
import * as bitsetStore from './stores/bitset-store';
import * as searchStore from './stores/search-store';

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;
  private cache = new CacheManager();

  /**
   * Initialize database connection
   */
  private async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

      request.onerror = () => {
        // Reset so a later call retries with a fresh open() instead of replaying
        // this same rejection forever (open() itself may succeed next time).
        this.initPromise = null;
        reject(request.error);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      // GH#24: without this handler, a version-change request blocked by another tab's
      // open connection never fires any event — init() hangs with no error and no
      // timeout. No artificial timeout is added alongside it: onblocked already fires
      // as soon as the browser detects the block, so a timer would only race a signal
      // we already have, and picking an arbitrary duration would either cut off a tab
      // that was about to close on its own or leave the user waiting regardless.
      // Known, accepted gap: the browser gives no way to cancel this request. If the
      // blocking tab closes later on its own, onsuccess can still fire for it after we've
      // already rejected and moved on, silently adopting a second connection as `this.db`.
      // Benign in practice (a retry finds a working connection either way) — not worth the
      // teardown complexity to close it out explicitly.
      request.onblocked = () => {
        this.initPromise = null;
        reject(
          new Error(
            'Database upgrade blocked: another tab has this app open. Close other tabs of this app and try again.'
          )
        );
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores if they don't exist
        for (const [storeName, config] of Object.entries(STORE_CONFIGS)) {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, {
              keyPath: config.keyPath,
            });

            // Create indexes
            if (config.indexes) {
              for (const index of config.indexes) {
                store.createIndex(index.name, index.keyPath, index.options);
              }
            }
          }
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save file metadata
   *
   * GH#23: metadata and account data are separate transactions with no rollback
   * between them, so a record freshly written here starts `accountsComplete: false`
   * — "not yet confirmed" — until `storeAllAccounts` flips it.
   *
   * The default applies only to a hash with no record yet. Defaulting unconditionally
   * would demote a record written before this field existed: such a record has no
   * `accountsComplete` key at all, so a spread cannot carry a value through, and
   * `indexeddb-cache.ts` re-saves the record on every cache hit just to bump
   * `lastAccessed`. `getFileMetadata` reads an absent field as complete, so the two
   * halves of the contract would disagree and a legacy record would hide itself after
   * exactly one read. Legacy records are materialised as complete rather than left
   * absent, so the decision is recorded in the data instead of re-derived every read.
   */
  async saveFileMetadata(metadata: FileMetadataRecord): Promise<void> {
    const db = await this.init();
    let record = metadata;
    if (metadata.accountsComplete === undefined) {
      const existing = await fileStore.getFileMetadata(db, metadata.fileHash);
      record = {
        ...metadata,
        accountsComplete: existing ? existing.accountsComplete !== false : false,
      };
    }
    await fileStore.saveFileMetadata(db, record);
  }

  /**
   * Get file metadata
   *
   * GH#23: hides records whose account-data write never completed. Every real caller
   * (cache-hit check, sample-data idempotency check, filter engine) is asking "is this
   * file's data usable" — returning a record with no matching account data behind it
   * is wrong for all of them, not just the one that first reported the bug.
   *
   * Records with no `accountsComplete` field are treated as complete. Not because
   * they could not be orphans — they can: the two transactions were already split
   * before this fix, which is exactly what GH#23 is about, so genuine orphans predate
   * this field and this default hides none of them. The reason is that GH#22 changes
   * the cache-key derivation in this same change, so a pre-fix record is not looked up
   * under its old key again; treating it as incomplete would force a re-parse the new
   * key already forces, at the cost of a wrong answer for anyone whose key does survive.
   */
  async getFileMetadata(fileHash: string): Promise<FileMetadataRecord | null> {
    const db = await this.init();
    const record = await fileStore.getFileMetadata(db, fileHash);
    if (record && record.accountsComplete === false) {
      return null;
    }
    return record;
  }

  /**
   * Mark a file's account data as durably present, so `getFileMetadata` stops
   * hiding it. No-op if metadata was never saved for this hash (e.g. `storeAllAccounts`
   * called directly, without a preceding `saveFileMetadata` — there is nothing to flip).
   */
  private async markAccountsComplete(db: IDBDatabase, fileHash: string): Promise<void> {
    const existing = await fileStore.getFileMetadata(db, fileHash);
    if (!existing) return;
    await fileStore.saveFileMetadata(db, { ...existing, accountsComplete: true });
  }

  /**
   * Store all accounts at once (optimized - build bitsets once, write once)
   */
  async storeAllAccounts(fileHash: string, accounts: AccountBadges[]): Promise<void> {
    const db = await this.init();

    // Build all columns
    const usernameBuilder = new StringColumnBuilder();
    const displayNameBuilder = new StringColumnBuilder();

    for (const account of accounts) {
      usernameBuilder.push(account.username.toLowerCase());
      displayNameBuilder.push(account.username);
    }

    const usernameColumn = usernameBuilder.build();
    const displayNameColumn = displayNameBuilder.build();

    // Build all bitsets at once
    const badges: BadgeKey[] = [
      'following',
      'followers',
      'mutuals',
      'notFollowingBack',
      'notFollowedBack',
      'pending',
      'permanent',
      'restricted',
      'close',
      'unfollowed',
      'dismissed',
    ];

    const bitsets = new Map<BadgeKey, { bitset: BitSet; count: number }>();

    // Initialize bitsets
    for (const badge of badges) {
      bitsets.set(badge, {
        bitset: new BitSet(accounts.length),
        count: 0,
      });
    }

    // Single pass through accounts to set all bits
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      if (!account) continue;

      for (const badge of badges) {
        if (account.badges[badge]) {
          const entry = bitsets.get(badge);
          if (entry) {
            entry.bitset.set(i);
            entry.count++;
          }
        }
      }
    }

    // Write everything in one transaction
    const tx = db.transaction([STORES.COLUMNS, STORES.BITSETS], 'readwrite');

    // Write columns
    const columnsStore = tx.objectStore(STORES.COLUMNS);

    await Promise.all([
      executeWrite(columnsStore, {
        fileHash,
        column: 'usernames',
        data: usernameColumn.data,
        offsets: usernameColumn.offsets,
        length: usernameColumn.length,
      }),
      executeWrite(columnsStore, {
        fileHash,
        column: 'displayNames',
        data: displayNameColumn.data,
        offsets: displayNameColumn.offsets,
        length: displayNameColumn.length,
      }),
    ]);

    // Write all bitsets
    const bitsetsStore = tx.objectStore(STORES.BITSETS);
    const bitsetPromises = Array.from(bitsets.entries()).map(([badge, { bitset, count }]) =>
      executeWrite(bitsetsStore, {
        fileHash,
        badge,
        data: bitset.toUint8Array(),
        accountCount: count,
      })
    );

    await Promise.all(bitsetPromises);

    // Wait for transaction to complete
    try {
      await waitForTransaction(tx);
    } catch (error) {
      // GH#23: this write failed after `saveFileMetadata` (if the caller made that call)
      // already committed in its own transaction — with no cleanup, that record would
      // survive as an orphan: `getFileMetadata` already hides it via `accountsComplete`,
      // but leaving it and any partial column/bitset rows behind would still leak
      // storage forever. Best-effort: drop everything for this hash so a retry starts
      // from a clean slate. Best-effort because a second failure here must not shadow
      // the original error — that's what the caller (and the user's error message)
      // needs to see.
      await this.clearFile(fileHash).catch(() => {});
      throw error;
    }

    await this.markAccountsComplete(db, fileHash);
  }

  /**
   * Append account chunk (called during streaming ingestion)
   */
  async appendAccountsChunk(
    fileHash: string,
    accounts: AccountBadges[],
    startIndex: number
  ): Promise<void> {
    const db = await this.init();

    // Use single transaction for all stores - faster with proper batching
    const tx = db.transaction([STORES.COLUMNS, STORES.BITSETS], 'readwrite');

    // Build username column
    const usernameBuilder = new StringColumnBuilder();
    const displayNameBuilder = new StringColumnBuilder();

    for (const account of accounts) {
      usernameBuilder.push(account.username.toLowerCase());
      displayNameBuilder.push(account.username);
    }

    const usernameColumn = usernameBuilder.build();
    const displayNameColumn = displayNameBuilder.build();

    // Store columns first (sequential writes, no blocking)
    const columnsPromise = Promise.all([
      columnStore.appendColumn(tx, fileHash, 'usernames', usernameColumn, startIndex),
      columnStore.appendColumn(tx, fileHash, 'displayNames', displayNameColumn, startIndex),
    ]);

    // Update badge bitsets in parallel (read-modify-write operations)
    const badges: BadgeKey[] = [
      'following',
      'followers',
      'mutuals',
      'notFollowingBack',
      'notFollowedBack',
      'pending',
      'permanent',
      'restricted',
      'close',
      'unfollowed',
      'dismissed',
    ];

    const bitsetsPromise = Promise.all(
      badges.map(badge => bitsetStore.updateBadgeBitset(tx, fileHash, badge, accounts, startIndex))
    );

    // Wait for both columns and bitsets to complete
    await Promise.all([columnsPromise, bitsetsPromise]);

    // Wait for transaction to complete
    await waitForTransaction(tx);
  }

  /**
   * Get accounts by index range (for virtualization)
   * Loads both usernames and badges for the specified range
   */
  async getAccountsByRange(fileHash: string, start: number, end: number): Promise<AccountBadges[]> {
    // Get username column
    const cacheKey = `${fileHash}:usernames`;
    let reader = this.cache.columnCache.get(cacheKey);

    if (!reader) {
      const db = await this.init();
      const tx = db.transaction([STORES.COLUMNS], 'readonly');
      const store = tx.objectStore(STORES.COLUMNS);

      const column = await executeRead<ColumnRecord>(store, [fileHash, 'usernames']);

      if (!column) return [];

      // Validate offsets before creating reader
      if (!column.offsets) {
        throw new Error(`Column ${cacheKey} missing required offsets array`);
      }
      reader = new StringColumnReader(column.data, column.offsets);
      this.cache.columnCache.set(cacheKey, reader);
    }

    // Get usernames for range
    const actualEnd = Math.min(end, reader.length);
    const usernames = reader.getRange(start, actualEnd);

    // Load all badge bitsets (they are cached after first load)
    const allBadgeKeys: BadgeKey[] = [
      'following',
      'followers',
      'pending',
      'permanent',
      'restricted',
      'close',
      'unfollowed',
      'dismissed',
      'notFollowingBack',
      'notFollowedBack',
      'mutuals',
    ];

    // Load bitsets in parallel (uses cache if already loaded)
    const bitsetEntries = await Promise.all(
      allBadgeKeys.map(async badge => {
        const bitset = await this.getBadgeBitset(fileHash, badge);
        return [badge, bitset] as const;
      })
    );

    // Filter out null bitsets and create map
    const bitsets = new Map<BadgeKey, BitSet>();
    for (const [badge, bitset] of bitsetEntries) {
      if (bitset) {
        bitsets.set(badge, bitset);
      }
    }

    // Build account objects with badges
    const accounts: AccountBadges[] = usernames.map((username, localIndex) => {
      const globalIndex = start + localIndex;
      const badges: Record<string, number | true> = {};

      // Check each bitset for this account
      for (const [badge, bitset] of bitsets) {
        if (bitset.has(globalIndex)) {
          badges[badge] = true;
        }
      }

      return { username, badges: badges as AccountBadges['badges'] };
    });

    return accounts;
  }

  /**
   * Get badge bitset (with caching)
   */
  async getBadgeBitset(fileHash: string, badge: BadgeKey): Promise<BitSet | null> {
    const db = await this.init();
    return bitsetStore.getBadgeBitset(db, fileHash, badge, this.cache.bitsetCache);
  }

  /**
   * Get badge statistics (fast - from metadata)
   */
  async getBadgeStats(fileHash: string): Promise<Record<BadgeKey, number>> {
    const db = await this.init();
    return bitsetStore.getBadgeStats(db, fileHash);
  }

  /**
   * Save search index
   */
  async putSearchIndex(
    fileHash: string,
    type: SearchIndexType,
    key: string,
    bitset: BitSet
  ): Promise<void> {
    const db = await this.init();
    await searchStore.putSearchIndex(db, fileHash, type, key, bitset);
  }

  /**
   * Get search index
   */
  async getSearchIndex(
    fileHash: string,
    type: SearchIndexType,
    key: string
  ): Promise<BitSet | null> {
    const db = await this.init();
    return searchStore.getSearchIndex(db, fileHash, type, key);
  }

  /**
   * Clear all data for a file
   * Optimized: uses getAllKeys + batch delete instead of cursor-based deletion
   */
  async clearFile(fileHash: string): Promise<void> {
    const db = await this.init();
    const tx = db.transaction(Object.values(STORES), 'readwrite');

    // Clear from each store
    for (const storeName of Object.values(STORES)) {
      const store = tx.objectStore(storeName);

      if (storeName === STORES.FILES) {
        await executeDelete(store, fileHash);
      } else {
        // Use getAllKeys for batch deletion (much faster than cursor-based)
        const index = store.index('fileHash');
        const range = IDBKeyRange.only(fileHash);

        const keys = await getAllKeysFromIndex(index, range);
        // Delete all keys in batch (within same transaction)
        for (const key of keys) {
          store.delete(key);
        }
      }
    }

    // Clear caches
    this.clearCaches(fileHash);
  }

  /**
   * Clear in-memory caches
   */
  clearCaches(fileHash?: string): void {
    this.cache.clearCaches(fileHash);
  }

  /**
   * Get all files (for file picker/management)
   */
  async getAllFiles(): Promise<FileMetadataRecord[]> {
    const db = await this.init();
    return fileStore.getAllFiles(db);
  }
}

// Export singleton instance
export const indexedDBService = new IndexedDBService();
