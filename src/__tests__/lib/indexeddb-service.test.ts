import type { AccountBadges, BadgeKey } from '@/core/types';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import * as transactionHelpers from '@/lib/indexeddb/transaction-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration tests for IndexedDBService using fake-indexeddb.
 * These tests verify the complete IndexedDB implementation including:
 * - File metadata storage and retrieval
 * - Account data storage in columnar format
 * - Bitset operations for badge filtering
 * - Search index management
 * - Cache behavior
 */

import 'fake-indexeddb/auto';

describe('IndexedDBService (Integration Tests)', () => {
  const mockFileHash = 'test-file-hash';
  const mockFileName = 'test.zip';
  const mockFileSize = 1024;

  // Helper to create badge value (timestamp)
  const badge = (): number => Date.now();

  // Track all file hashes used in tests for cleanup
  const usedFileHashes = new Set<string>([
    mockFileHash,
    'empty-hash',
    'hash1',
    'hash2',
    'hash3',
    'other-hash',
  ]);

  beforeEach(async () => {
    // Clear service caches first
    indexedDBService.clearCaches();

    // Clear only known test file hashes instead of deleting all databases
    // This is much faster than deleteDatabase() for each test
    await Promise.all(
      Array.from(usedFileHashes).map(hash =>
        indexedDBService.clearFile(hash).catch(() => {
          // Ignore errors for non-existent files
        })
      )
    );
  });

  afterEach(() => {
    indexedDBService.clearCaches();
  });

  describe('saveFileMetadata and getFileMetadata', () => {
    // These fixtures pass `accountsComplete: true` explicitly: saveFileMetadata alone
    // (without a following storeAllAccounts) now defaults new records to `false` so
    // getFileMetadata hides them (GH#23, see the "orphaned metadata" describe block
    // below). These tests are exercising metadata round-trip fidelity in isolation,
    // which is a real, separate contract from the completeness flag.
    it('should save and retrieve file metadata', async () => {
      const metadata = {
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
        accountsComplete: true,
      };

      await indexedDBService.saveFileMetadata(metadata);
      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);

      expect(retrieved).toMatchObject({
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        accountCount: 100,
        version: 2,
      });
      expect(retrieved?.uploadDate).toBeInstanceOf(Date);
    });

    it('should return null for nonexistent file', async () => {
      const result = await indexedDBService.getFileMetadata('nonexistent');

      expect(result).toBeNull();
    });

    it('should update existing metadata', async () => {
      const metadata = {
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
        accountsComplete: true,
      };

      await indexedDBService.saveFileMetadata(metadata);

      // Update with new data
      const updatedMetadata = {
        ...metadata,
        accountCount: 200,
        lastAccessed: Date.now() + 1000,
      };

      await indexedDBService.saveFileMetadata(updatedMetadata);
      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);

      expect(retrieved?.accountCount).toBe(200);
    });

    /**
     * GH#41. `/results` is reached long after the parse — a returning visitor
     * never re-parses at all — so the caveat has to live in this store or it
     * shows once and disappears, leaving the returning user with the silent
     * overstatement the issue is about.
     */
    it('should round-trip followRequestsUnreadable so the caveat survives the parse', async () => {
      const caveatHash = 'follow-requests-unreadable-hash';
      usedFileHashes.add(caveatHash);

      await indexedDBService.saveFileMetadata({
        fileHash: caveatHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
        accountsComplete: true,
        followRequestsUnreadable: true,
      });

      expect((await indexedDBService.getFileMetadata(caveatHash))?.followRequestsUnreadable).toBe(
        true
      );

      // The cache-hit re-save (indexeddb-cache.ts bumps lastAccessed on every
      // hit) must not drop it — that path runs far more often than the parse.
      const stored = await indexedDBService.getFileMetadata(caveatHash);
      await indexedDBService.saveFileMetadata({
        ...(stored as NonNullable<typeof stored>),
        lastAccessed: Date.now(),
      });

      expect((await indexedDBService.getFileMetadata(caveatHash))?.followRequestsUnreadable).toBe(
        true
      );
    });

    it('should leave followRequestsUnreadable absent when the parse raised no caveat', async () => {
      // Absent means "no caveat", the same default accountsComplete takes.
      // A record from before this field existed must not start warning people.
      await indexedDBService.saveFileMetadata({
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
        accountsComplete: true,
      });

      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);
      expect(retrieved?.followRequestsUnreadable).toBeUndefined();
    });

    it('should handle Date conversion correctly', async () => {
      const uploadDate = new Date('2024-06-15T10:30:00Z');

      const metadata = {
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate,
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
        accountsComplete: true,
      };

      await indexedDBService.saveFileMetadata(metadata);
      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);

      expect(retrieved?.uploadDate).toBeInstanceOf(Date);
      expect(retrieved?.uploadDate.toISOString()).toBe(uploadDate.toISOString());
    });
  });

  describe('GH#23: orphaned metadata after a failed/incomplete account-data write', () => {
    /**
     * A record written by a build that predates `accountsComplete` has no such key —
     * `getFileMetadata` reads that as complete, which is the decision we want. But
     * `saveFileMetadata` stamps `accountsComplete: false` onto anything arriving
     * without the key, and `indexeddb-cache.ts` re-saves the record on EVERY cache hit
     * just to bump `lastAccessed`. So the two halves of the contract disagree, and a
     * legacy record demotes itself after exactly one read.
     *
     * No fixture can be written for this shape through the public API — an absent key
     * is not a value a caller can pass, it is a shape that exists only in the browsers
     * of people who used an earlier build. Hence the raw connection below.
     */
    it('should not demote a record written before accountsComplete existed', async () => {
      const { DB_CONFIG, STORES } = await import('@/lib/indexeddb/indexeddb-schema');
      const legacyHash = 'legacy-record-hash';
      usedFileHashes.add(legacyHash);

      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORES.FILES], 'readwrite');
        // Deliberately no `accountsComplete` key at all.
        tx.objectStore(STORES.FILES).put({
          fileHash: legacyHash,
          fileName: mockFileName,
          fileSize: mockFileSize,
          uploadDate: new Date(),
          accountCount: 42,
          lastAccessed: Date.now(),
          version: 2,
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();

      const beforeResave = await indexedDBService.getFileMetadata(legacyHash);
      expect(beforeResave).not.toBeNull();

      // Exactly what indexeddb-cache.ts does on a cache hit.
      await indexedDBService.saveFileMetadata({
        ...(beforeResave as NonNullable<typeof beforeResave>),
        lastAccessed: Date.now(),
      });

      expect(await indexedDBService.getFileMetadata(legacyHash)).not.toBeNull();
    });

    it('should hide metadata whose account data was never confirmed (fresh save, no storeAllAccounts yet)', async () => {
      // This is the state a retry sees if the tab closes (or the promise is never
      // awaited to completion) between saveFileMetadata committing and storeAllAccounts
      // starting: metadata exists, but nothing has confirmed the account data landed.
      await indexedDBService.saveFileMetadata({
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date(),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
      });

      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);

      expect(retrieved).toBeNull();
    });

    it('should reveal metadata once storeAllAccounts confirms the account data landed', async () => {
      await indexedDBService.saveFileMetadata({
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date(),
        accountCount: 1,
        lastAccessed: Date.now(),
        version: 2,
      });

      // Not yet visible — this is the assertion the previous test makes on its own;
      // repeating it here pins the "before" half of the before/after this test compares.
      expect(await indexedDBService.getFileMetadata(mockFileHash)).toBeNull();

      await indexedDBService.storeAllAccounts(mockFileHash, [
        { username: 'user1', badges: { following: badge() } },
      ]);

      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.fileHash).toBe(mockFileHash);
    });

    it('should not orphan metadata when the account-data transaction fails', async () => {
      await indexedDBService.saveFileMetadata({
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date(),
        accountCount: 1,
        lastAccessed: Date.now(),
        version: 2,
      });

      const waitSpy = vi
        .spyOn(transactionHelpers, 'waitForTransaction')
        .mockRejectedValueOnce(new Error('simulated transaction failure'));

      await expect(
        indexedDBService.storeAllAccounts(mockFileHash, [
          { username: 'user1', badges: { following: badge() } },
        ])
      ).rejects.toThrow('simulated transaction failure');

      waitSpy.mockRestore();

      // A retry must see this as "no data here" and reparse — not a stale success.
      const retrieved = await indexedDBService.getFileMetadata(mockFileHash);
      expect(retrieved).toBeNull();

      // The failure path also cleans up so the orphan doesn't sit in storage forever.
      const files = await indexedDBService.getAllFiles();
      expect(files.map(f => f.fileHash)).not.toContain(mockFileHash);
    });
  });

  describe('storeAllAccounts', () => {
    it('should store accounts with all badges', async () => {
      const accounts: AccountBadges[] = [
        {
          username: 'user1',
          badges: { following: badge(), followers: badge() },
        },
        { username: 'user2', badges: { following: badge() } },
        { username: 'user3', badges: { followers: badge() } },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);

      // Verify accounts can be retrieved
      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 3);

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0]?.username).toBe('user1');
      expect(retrieved[1]?.username).toBe('user2');
      expect(retrieved[2]?.username).toBe('user3');
    });

    it('should create bitsets for all badge types', async () => {
      const accounts: AccountBadges[] = [
        { username: 'user1', badges: { following: badge(), mutuals: badge() } },
        { username: 'user2', badges: { followers: badge(), mutuals: badge() } },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);

      const followingBitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');
      const followersBitset = await indexedDBService.getBadgeBitset(mockFileHash, 'followers');
      const mutualsBitset = await indexedDBService.getBadgeBitset(mockFileHash, 'mutuals');

      expect(followingBitset).not.toBeNull();
      expect(followersBitset).not.toBeNull();
      expect(mutualsBitset).not.toBeNull();

      expect(followingBitset?.has(0)).toBe(true);
      expect(followingBitset?.has(1)).toBe(false);

      expect(mutualsBitset?.has(0)).toBe(true);
      expect(mutualsBitset?.has(1)).toBe(true);
    });

    it('should handle empty accounts array', async () => {
      await indexedDBService.storeAllAccounts(mockFileHash, []);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 10);

      expect(retrieved).toHaveLength(0);
    });

    it('should handle accounts with no badges', async () => {
      const accounts: AccountBadges[] = [
        { username: 'user1', badges: {} },
        { username: 'user2', badges: {} },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 2);

      expect(retrieved).toHaveLength(2);
    });

    it('should store usernames in lowercase', async () => {
      const accounts: AccountBadges[] = [
        { username: 'UserOne', badges: {} },
        { username: 'UserTwo', badges: {} },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 2);

      expect(retrieved[0]?.username).toBe('userone');
      expect(retrieved[1]?.username).toBe('usertwo');
    });

    it('should handle large datasets efficiently', async () => {
      const largeAccounts: AccountBadges[] = Array.from({ length: 10000 }, (_, i) => ({
        username: `user${i}`,
        badges: {
          ...(i % 2 === 0 ? { following: badge() } : {}),
          ...(i % 3 === 0 ? { followers: badge() } : {}),
        },
      }));

      const start = performance.now();
      await indexedDBService.storeAllAccounts(mockFileHash, largeAccounts);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5000); // Should complete in reasonable time

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 100);
      expect(retrieved).toHaveLength(100);
    });
  });

  describe('appendAccountsChunk', () => {
    it('should append accounts in chunks', async () => {
      const chunk1: AccountBadges[] = [
        { username: 'user1', badges: { following: badge() } },
        { username: 'user2', badges: { following: badge() } },
      ];

      const chunk2: AccountBadges[] = [
        { username: 'user3', badges: { followers: badge() } },
        { username: 'user4', badges: { followers: badge() } },
      ];

      await indexedDBService.appendAccountsChunk(mockFileHash, chunk1, 0);
      await indexedDBService.appendAccountsChunk(mockFileHash, chunk2, 2);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 4);

      expect(retrieved).toHaveLength(4);
      expect(retrieved[0]?.username).toBe('user1');
      expect(retrieved[3]?.username).toBe('user4');
    });

    it('should update bitsets correctly across chunks', async () => {
      const chunk1: AccountBadges[] = [{ username: 'user1', badges: { following: badge() } }];

      const chunk2: AccountBadges[] = [{ username: 'user2', badges: { following: badge() } }];

      await indexedDBService.appendAccountsChunk(mockFileHash, chunk1, 0);
      await indexedDBService.appendAccountsChunk(mockFileHash, chunk2, 1);

      const bitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');

      expect(bitset?.has(0)).toBe(true);
      expect(bitset?.has(1)).toBe(true);
    });

    it('should handle first chunk correctly', async () => {
      const chunk: AccountBadges[] = [{ username: 'user1', badges: { following: badge() } }];

      await indexedDBService.appendAccountsChunk(mockFileHash, chunk, 0);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 1);

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]?.username).toBe('user1');
    });

    it('should handle sequential chunks with gaps in indices', async () => {
      // Note: Columnar storage doesn't support sparse data, so we test sequential appends
      const chunk1: AccountBadges[] = [
        { username: 'user1', badges: {} },
        { username: 'user2', badges: {} },
      ];

      const chunk2: AccountBadges[] = [
        { username: 'user3', badges: {} },
        { username: 'user4', badges: {} },
      ];

      await indexedDBService.appendAccountsChunk(mockFileHash, chunk1, 0);
      await indexedDBService.appendAccountsChunk(mockFileHash, chunk2, 2);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 4);

      expect(retrieved[0]?.username).toBe('user1');
      expect(retrieved[1]?.username).toBe('user2');
      expect(retrieved[2]?.username).toBe('user3');
      expect(retrieved[3]?.username).toBe('user4');
    });
  });

  describe('getAccountsByRange', () => {
    beforeEach(async () => {
      const accounts: AccountBadges[] = Array.from({ length: 100 }, (_, i) => ({
        username: `user${i}`,
        badges: i % 2 === 0 ? { following: badge() } : {},
      }));

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);
    });

    it('should retrieve accounts by range', async () => {
      const accounts = await indexedDBService.getAccountsByRange(mockFileHash, 10, 20);

      expect(accounts).toHaveLength(10);
      expect(accounts[0]?.username).toBe('user10');
      expect(accounts[9]?.username).toBe('user19');
    });

    it('should handle range at start', async () => {
      const accounts = await indexedDBService.getAccountsByRange(mockFileHash, 0, 5);

      expect(accounts).toHaveLength(5);
      expect(accounts[0]?.username).toBe('user0');
    });

    it('should handle range at end', async () => {
      const accounts = await indexedDBService.getAccountsByRange(mockFileHash, 95, 100);

      expect(accounts).toHaveLength(5);
      expect(accounts[4]?.username).toBe('user99');
    });

    it('should handle range beyond data length', async () => {
      const accounts = await indexedDBService.getAccountsByRange(mockFileHash, 90, 200);

      expect(accounts.length).toBeLessThanOrEqual(10);
    });

    it('should return empty array for nonexistent file', async () => {
      const accounts = await indexedDBService.getAccountsByRange('nonexistent', 0, 10);

      expect(accounts).toEqual([]);
    });

    it('should cache column reader for performance', async () => {
      // First call
      await indexedDBService.getAccountsByRange(mockFileHash, 0, 10);

      // Second call should use cached reader
      const start = performance.now();
      await indexedDBService.getAccountsByRange(mockFileHash, 10, 20);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50); // Should be fast with cache
    });
  });

  describe('getBadgeBitset', () => {
    beforeEach(async () => {
      const accounts: AccountBadges[] = [
        { username: 'user1', badges: { following: badge(), mutuals: badge() } },
        { username: 'user2', badges: { followers: badge(), mutuals: badge() } },
        { username: 'user3', badges: { following: badge() } },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);
    });

    it('should retrieve bitset for badge', async () => {
      const bitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');

      expect(bitset).not.toBeNull();
      expect(bitset?.has(0)).toBe(true);
      expect(bitset?.has(1)).toBe(false);
      expect(bitset?.has(2)).toBe(true);
    });

    it('should return null for nonexistent badge', async () => {
      const bitset = await indexedDBService.getBadgeBitset('nonexistent', 'following');

      expect(bitset).toBeNull();
    });

    it('should cache bitsets', async () => {
      // First call
      await indexedDBService.getBadgeBitset(mockFileHash, 'following');

      // Second call should use cache
      const start = performance.now();
      const bitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');
      const duration = performance.now() - start;

      expect(bitset).not.toBeNull();
      expect(duration).toBeLessThan(10); // Should be instant with cache
    });

    it('should handle all badge types', async () => {
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

      for (const badge of badges) {
        const bitset = await indexedDBService.getBadgeBitset(mockFileHash, badge);
        expect(bitset).not.toBeNull();
      }
    });
  });

  describe('getBadgeStats', () => {
    beforeEach(async () => {
      const accounts: AccountBadges[] = [
        { username: 'user1', badges: { following: badge(), mutuals: badge() } },
        { username: 'user2', badges: { followers: badge(), mutuals: badge() } },
        { username: 'user3', badges: { following: badge() } },
        { username: 'user4', badges: { followers: badge() } },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);
    });

    it('should return badge statistics', async () => {
      const stats = await indexedDBService.getBadgeStats(mockFileHash);

      expect(stats.following).toBe(2);
      expect(stats.followers).toBe(2);
      expect(stats.mutuals).toBe(2);
    });

    it('should return 0 for badges with no matches', async () => {
      const stats = await indexedDBService.getBadgeStats(mockFileHash);

      expect(stats.pending).toBe(0);
      expect(stats.restricted).toBe(0);
    });

    it('should handle empty dataset', async () => {
      await indexedDBService.storeAllAccounts('empty-hash', []);

      const stats = await indexedDBService.getBadgeStats('empty-hash');

      expect(Object.values(stats).every(v => v === 0)).toBe(true);
    });
  });

  describe('search indexes', () => {
    it('should save and retrieve search index', async () => {
      const { BitSet } = await import('@/lib/indexeddb/bitset');
      const bitset = new BitSet(100);
      bitset.set(5);
      bitset.set(10);

      await indexedDBService.putSearchIndex(mockFileHash, 'trigram', 'abc', bitset);
      const retrieved = await indexedDBService.getSearchIndex(mockFileHash, 'trigram', 'abc');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.has(5)).toBe(true);
      expect(retrieved?.has(10)).toBe(true);
    });

    it('should return null for nonexistent index', async () => {
      const result = await indexedDBService.getSearchIndex(mockFileHash, 'trigram', 'xyz');

      expect(result).toBeNull();
    });

    it('should handle expired indexes', async () => {
      const { BitSet } = await import('@/lib/indexeddb/bitset');
      const bitset = new BitSet(100);

      // Mock an expired index by directly manipulating the record
      await indexedDBService.putSearchIndex(mockFileHash, 'trigram', 'old', bitset);

      // Wait a bit and check (in real scenario, would need to mock Date.now())
      const retrieved = await indexedDBService.getSearchIndex(mockFileHash, 'trigram', 'old');

      // Should still exist since we just created it
      expect(retrieved).not.toBeNull();
    });

    it('should handle different index types', async () => {
      const { BitSet } = await import('@/lib/indexeddb/bitset');
      const trigramBitset = new BitSet(100);
      const prefixBitset = new BitSet(100);

      trigramBitset.set(1);
      prefixBitset.set(2);

      await indexedDBService.putSearchIndex(mockFileHash, 'trigram', 'abc', trigramBitset);
      await indexedDBService.putSearchIndex(mockFileHash, 'prefix', 'abc', prefixBitset);

      const trigram = await indexedDBService.getSearchIndex(mockFileHash, 'trigram', 'abc');
      const prefix = await indexedDBService.getSearchIndex(mockFileHash, 'prefix', 'abc');

      expect(trigram?.has(1)).toBe(true);
      expect(prefix?.has(2)).toBe(true);
    });
  });

  describe('clearFile', () => {
    beforeEach(async () => {
      const accounts: AccountBadges[] = [
        { username: 'user1', badges: { following: badge() } },
        { username: 'user2', badges: { followers: badge() } },
      ];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);
    });

    it('should clear all data for a file', async () => {
      await indexedDBService.clearFile(mockFileHash);

      const metadata = await indexedDBService.getFileMetadata(mockFileHash);
      const accounts = await indexedDBService.getAccountsByRange(mockFileHash, 0, 10);
      const bitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');

      expect(metadata).toBeNull();
      expect(accounts).toEqual([]);
      expect(bitset).toBeNull();
    });

    it('should clear caches for the file', async () => {
      // Load data into cache
      await indexedDBService.getBadgeBitset(mockFileHash, 'following');
      await indexedDBService.getAccountsByRange(mockFileHash, 0, 10);

      await indexedDBService.clearFile(mockFileHash);

      // Caches should be cleared (we can't directly test this, but it shouldn't error)
      const bitset = await indexedDBService.getBadgeBitset(mockFileHash, 'following');
      expect(bitset).toBeNull();
    });

    it('should not affect other files', async () => {
      const otherHash = 'other-hash';
      const otherAccounts: AccountBadges[] = [
        { username: 'other1', badges: { following: badge() } },
      ];

      await indexedDBService.storeAllAccounts(otherHash, otherAccounts);
      await indexedDBService.clearFile(mockFileHash);

      const otherRetrieved = await indexedDBService.getAccountsByRange(otherHash, 0, 1);
      expect(otherRetrieved).toHaveLength(1);
    });
  });

  describe('clearCaches', () => {
    beforeEach(async () => {
      const accounts: AccountBadges[] = [{ username: 'user1', badges: { following: badge() } }];

      await indexedDBService.storeAllAccounts(mockFileHash, accounts);
    });

    it('should clear all caches', () => {
      // Load into cache
      indexedDBService.getBadgeBitset(mockFileHash, 'following');

      indexedDBService.clearCaches();

      // Cache should be cleared (subsequent calls will reload from DB)
      expect(() => indexedDBService.clearCaches()).not.toThrow();
    });

    it('should clear caches for specific file', async () => {
      const otherHash = 'other-hash';

      await indexedDBService.getBadgeBitset(mockFileHash, 'following');
      await indexedDBService.getBadgeBitset(otherHash, 'following');

      indexedDBService.clearCaches(mockFileHash);

      // Should not throw
      expect(() => indexedDBService.clearCaches(mockFileHash)).not.toThrow();
    });
  });

  describe('getAllFiles', () => {
    it('should return all stored files', async () => {
      const metadata1 = {
        fileHash: 'hash1',
        fileName: 'file1.zip',
        fileSize: 1024,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
      };

      const metadata2 = {
        fileHash: 'hash2',
        fileName: 'file2.zip',
        fileSize: 2048,
        uploadDate: new Date('2024-01-02'),
        accountCount: 200,
        lastAccessed: Date.now(),
        version: 2,
      };

      await indexedDBService.saveFileMetadata(metadata1);
      await indexedDBService.saveFileMetadata(metadata2);

      const files = await indexedDBService.getAllFiles();

      expect(files).toHaveLength(2);
      expect(files.map(f => f.fileHash)).toContain('hash1');
      expect(files.map(f => f.fileHash)).toContain('hash2');
    });

    it('should return empty array when no files exist', async () => {
      const files = await indexedDBService.getAllFiles();

      expect(files).toEqual([]);
    });

    it('should convert uploadDate to Date objects', async () => {
      const metadata = {
        fileHash: mockFileHash,
        fileName: mockFileName,
        fileSize: mockFileSize,
        uploadDate: new Date('2024-01-01'),
        accountCount: 100,
        lastAccessed: Date.now(),
        version: 2,
      };

      await indexedDBService.saveFileMetadata(metadata);
      const files = await indexedDBService.getAllFiles();

      expect(files[0]?.uploadDate).toBeInstanceOf(Date);
    });
  });

  describe('error handling', () => {
    it('should handle database initialization errors gracefully', async () => {
      // This is hard to test without mocking IndexedDB itself
      // But we can ensure the service doesn't crash
      expect(indexedDBService).toBeDefined();
    });

    it('should handle concurrent operations', async () => {
      const accounts: AccountBadges[] = [{ username: 'user1', badges: { following: badge() } }];

      // Run multiple operations concurrently
      await Promise.all([
        indexedDBService.storeAllAccounts(mockFileHash, accounts),
        indexedDBService.storeAllAccounts('hash2', accounts),
        indexedDBService.storeAllAccounts('hash3', accounts),
      ]);

      const retrieved = await indexedDBService.getAccountsByRange(mockFileHash, 0, 1);
      expect(retrieved).toHaveLength(1);
    });
  });
});
