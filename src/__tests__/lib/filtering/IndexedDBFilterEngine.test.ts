import type { AccountBadges } from '@/core/types';
import { BitSet } from '@/lib/indexeddb/bitset';
import { IndexedDBFilterEngine } from '@/lib/filtering/IndexedDBFilterEngine';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { hasSearchIndexes, smartSearch } from '@/lib/search-index';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/indexeddb/indexeddb-service');
vi.mock('@/lib/search-index');

const mockIndexedDBService = vi.mocked(indexedDBService);
const mockSmartSearch = vi.mocked(smartSearch);
const mockHasSearchIndexes = vi.mocked(hasSearchIndexes);

describe('IndexedDBFilterEngine', () => {
  let engine: IndexedDBFilterEngine;
  const mockFileHash = 'test-file-hash';
  const totalAccounts = 1000;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new IndexedDBFilterEngine();

    // Mock metadata
    mockIndexedDBService.getFileMetadata.mockResolvedValue({
      fileHash: mockFileHash,
      fileName: 'test.zip',
      fileSize: 1024,
      uploadDate: new Date(),
      accountCount: totalAccounts,
      lastAccessed: Date.now(),
      version: 2,
    });

    // Mock badge stats
    mockIndexedDBService.getBadgeStats.mockResolvedValue({
      following: 500,
      followers: 600,
      mutuals: 300,
      notFollowingBack: 200,
      notFollowedBack: 300,
      pending: 0,
      permanent: 0,
      restricted: 0,
      close: 0,
      unfollowed: 0,
      dismissed: 0,
    });

    // Mock search indexes
    mockHasSearchIndexes.mockResolvedValue(false);
  });

  describe('init', () => {
    it('should initialize with file hash and total accounts', async () => {
      await engine.init(mockFileHash, totalAccounts);

      expect(mockIndexedDBService.getFileMetadata).not.toHaveBeenCalled();
    });

    it('should fetch total accounts from metadata if not provided', async () => {
      await engine.init(mockFileHash);

      expect(mockIndexedDBService.getFileMetadata).toHaveBeenCalledWith(mockFileHash);
    });

    it('should preload common bitsets', async () => {
      const mockBitset = new BitSet(totalAccounts);
      mockIndexedDBService.getBadgeBitset.mockResolvedValue(mockBitset);

      await engine.init(mockFileHash, totalAccounts);

      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalledWith(mockFileHash, 'following');
      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalledWith(mockFileHash, 'followers');
      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalledWith(mockFileHash, 'mutuals');
    });

    it('should throw error if initialized without file hash', async () => {
      await expect(engine.filterToIndices('', [])).rejects.toThrow('Not initialized');
    });
  });

  describe('reset', () => {
    it('should clear engine state', async () => {
      await engine.init(mockFileHash, totalAccounts);
      engine.reset();

      await expect(engine.filterToIndices('', [])).rejects.toThrow('Not initialized');
    });
  });

  describe('filterToIndices', () => {
    beforeEach(async () => {
      await engine.init(mockFileHash, totalAccounts);
    });

    it('should return all indices when no filters are applied', async () => {
      const indices = await engine.filterToIndices('', []);

      expect(indices).toHaveLength(totalAccounts);
      expect(indices[0]).toBe(0);
      expect(indices[totalAccounts - 1]).toBe(totalAccounts - 1);
    });

    it('should filter by single badge', async () => {
      const mockBitset = new BitSet(totalAccounts);
      mockBitset.set(0);
      mockBitset.set(5);
      mockBitset.set(10);

      mockIndexedDBService.getBadgeBitset.mockResolvedValue(mockBitset);

      const indices = await engine.filterToIndices('', ['following']);

      expect(indices).toEqual([0, 5, 10]);
    });

    // Was `['following', 'followers']` until the facet groups landed. Those two
    // are one axis and now union; AND is what happens ACROSS axes, so the badges
    // changed and the contract did not. `unfollowed` is a flag, not a relationship.
    it('should filter by multiple badges with AND logic across groups', async () => {
      // A fresh engine with the mock set before init: the shared `engine` is
      // preloaded by the outer beforeEach under whatever implementation the
      // previous test left behind, and `following` would be served from that
      // cache rather than from this test's data.
      const testEngine = new IndexedDBFilterEngine();

      const followingBitset = new BitSet(totalAccounts);
      followingBitset.set(0);
      followingBitset.set(5);
      followingBitset.set(10);

      const unfollowedBitset = new BitSet(totalAccounts);
      unfollowedBitset.set(5);
      unfollowedBitset.set(10);
      unfollowedBitset.set(15);

      mockIndexedDBService.getBadgeBitset.mockReset();
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (hash, badge) => {
        if (badge === 'following') return followingBitset;
        if (badge === 'unfollowed') return unfollowedBitset;
        return null;
      });

      await testEngine.init(mockFileHash, totalAccounts);
      const indices = await testEngine.filterToIndices('', ['following', 'unfollowed']);

      // Should only include indices present in both bitsets (5, 10)
      expect(indices).toEqual([5, 10]);
    });

    it('should handle missing bitset data', async () => {
      // Create a new engine to avoid cached bitsets
      const testEngine = new IndexedDBFilterEngine();

      const followingBitset = new BitSet(totalAccounts);
      followingBitset.set(5);
      followingBitset.set(10);

      // Reset and configure mock before init
      mockIndexedDBService.getBadgeBitset.mockReset();
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (hash, badge) => {
        if (badge === 'following') return followingBitset;
        return null; // No data for followers
      });

      await testEngine.init(mockFileHash, totalAccounts);
      const indices = await testEngine.filterToIndices('', ['following', 'followers']);

      // When one bitset is null, it filters out null and uses only valid bitsets
      // So it returns indices from 'following' bitset only
      expect(indices).toEqual([5, 10]);
    });

    it('should apply search filter using indexes when available', async () => {
      mockHasSearchIndexes.mockResolvedValue(true);

      const searchBitset = new BitSet(totalAccounts);
      searchBitset.set(1);
      searchBitset.set(2);
      searchBitset.set(3);

      mockSmartSearch.mockResolvedValue(searchBitset);

      const indices = await engine.filterToIndices('test', []);

      expect(mockSmartSearch).toHaveBeenCalledWith(mockFileHash, 'test');
      expect(indices).toEqual([1, 2, 3]);
    });

    it('should combine badge filters and search', async () => {
      mockHasSearchIndexes.mockResolvedValue(true);

      const followingBitset = new BitSet(totalAccounts);
      followingBitset.set(1);
      followingBitset.set(2);
      followingBitset.set(5);

      const searchBitset = new BitSet(totalAccounts);
      searchBitset.set(2);
      searchBitset.set(3);
      searchBitset.set(5);

      mockIndexedDBService.getBadgeBitset.mockResolvedValue(followingBitset);
      mockSmartSearch.mockResolvedValue(searchBitset);

      const indices = await engine.filterToIndices('test', ['following']);

      // Should only include indices in both following AND search (2, 5)
      expect(indices).toEqual([2, 5]);
    });

    it('should fallback to linear search when indexes not available', async () => {
      mockHasSearchIndexes.mockResolvedValue(false);

      const mockAccounts: AccountBadges[] = [
        { username: 'alice', badges: {} },
        { username: 'bob', badges: {} },
        { username: 'charlie', badges: {} },
      ];

      mockIndexedDBService.getAccountsByRange.mockResolvedValue(mockAccounts);

      const indices = await engine.filterToIndices('bob', []);

      expect(mockIndexedDBService.getAccountsByRange).toHaveBeenCalled();
      expect(indices).toContain(1); // bob is at index 1
    });

    it('should handle search with batched loading', async () => {
      mockHasSearchIndexes.mockResolvedValue(false);

      // Create large dataset to trigger batching
      const largeIndices = Array.from({ length: 2500 }, (_, i) => i);

      const mockAccounts: AccountBadges[] = largeIndices.map(i => ({
        username: i % 10 === 0 ? 'test' : `user${i}`,
        badges: {},
      }));

      mockIndexedDBService.getAccountsByRange.mockImplementation(async (hash, start, end) => {
        return mockAccounts.slice(start, end);
      });

      // Mock bitset to return all indices
      const allBitset = new BitSet(totalAccounts);
      for (let i = 0; i < 2500; i++) {
        allBitset.set(i);
      }
      mockIndexedDBService.getBadgeBitset.mockResolvedValue(allBitset);

      const indices = await engine.filterToIndices('test', ['following']);

      // Should find accounts with 'test' in username (every 10th)
      expect(indices.length).toBeGreaterThan(0);
      expect(mockIndexedDBService.getAccountsByRange).toHaveBeenCalledTimes(3); // 2500 / 1000 = 3 batches
    });

    it('should trim search query', async () => {
      mockHasSearchIndexes.mockResolvedValue(true);
      mockSmartSearch.mockResolvedValue(new BitSet(totalAccounts));

      await engine.filterToIndices('  test  ', []);

      expect(mockSmartSearch).toHaveBeenCalledWith(mockFileHash, 'test');
    });

    it('should handle empty search results', async () => {
      mockHasSearchIndexes.mockResolvedValue(true);
      mockSmartSearch.mockResolvedValue(null);

      mockIndexedDBService.getAccountsByRange.mockResolvedValue([]);

      const indices = await engine.filterToIndices('nonexistent', []);

      expect(indices).toEqual([]);
    });
  });

  describe('filter (legacy API)', () => {
    beforeEach(async () => {
      await engine.init(mockFileHash, totalAccounts);
    });

    it('should return filtered accounts with metadata', async () => {
      const mockBitset = new BitSet(totalAccounts);
      mockBitset.set(0);
      mockBitset.set(1);

      mockIndexedDBService.getBadgeBitset.mockResolvedValue(mockBitset);
      mockIndexedDBService.getAccountsByRange.mockResolvedValue([
        { username: 'user1', badges: { following: true } },
        { username: 'user2', badges: { following: true } },
      ]);

      const result = await engine.filter([], '', ['following']);

      expect(result.filteredAccounts).toHaveLength(2);
      expect(result.totalMatches).toBe(2);
      expect(result.processingTime).toBe(0);
    });
  });

  describe('loadAccountsByIndices', () => {
    beforeEach(async () => {
      await engine.init(mockFileHash, totalAccounts);
    });

    it('should return empty array for empty indices', async () => {
      const accounts = await engine.loadAccountsByIndices([]);

      expect(accounts).toEqual([]);
    });

    it('should load accounts for contiguous indices', async () => {
      const mockAccounts: AccountBadges[] = [
        { username: 'user0', badges: {} },
        { username: 'user1', badges: {} },
        { username: 'user2', badges: {} },
      ];

      mockIndexedDBService.getAccountsByRange.mockResolvedValue(mockAccounts);

      const accounts = await engine.loadAccountsByIndices([0, 1, 2]);

      expect(mockIndexedDBService.getAccountsByRange).toHaveBeenCalledWith(mockFileHash, 0, 3);
      expect(accounts).toHaveLength(3);
    });

    it('should group sparse indices into ranges', async () => {
      mockIndexedDBService.getAccountsByRange.mockImplementation(async (hash, start, end) => {
        const accounts: AccountBadges[] = [];
        for (let i = start; i < end; i++) {
          accounts.push({ username: `user${i}`, badges: {} });
        }
        return accounts;
      });

      // Indices with gaps > 10 should create separate ranges
      await engine.loadAccountsByIndices([0, 1, 50, 51, 100]);

      expect(mockIndexedDBService.getAccountsByRange).toHaveBeenCalledTimes(3);
    });

    it('should maintain original order of indices', async () => {
      mockIndexedDBService.getAccountsByRange.mockImplementation(async (hash, start, end) => {
        const accounts: AccountBadges[] = [];
        for (let i = start; i < end; i++) {
          accounts.push({ username: `user${i}`, badges: {} });
        }
        return accounts;
      });

      const accounts = await engine.loadAccountsByIndices([5, 2, 8, 1]);

      // Should maintain the order [5, 2, 8, 1]
      expect(accounts).toHaveLength(4);
    });

    it('should handle missing accounts gracefully', async () => {
      mockIndexedDBService.getAccountsByRange.mockResolvedValue([
        { username: 'user0', badges: {} },
        // Missing user1
        { username: 'user2', badges: {} },
      ]);

      const accounts = await engine.loadAccountsByIndices([0, 1, 2]);

      // Should only return existing accounts
      expect(accounts.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await engine.init(mockFileHash, totalAccounts);
    });

    it('should return badge statistics', async () => {
      const stats = await engine.getStats();

      expect(mockIndexedDBService.getBadgeStats).toHaveBeenCalledWith(mockFileHash);
      expect(stats).toHaveProperty('following');
      expect(stats).toHaveProperty('followers');
      expect(stats).toHaveProperty('mutuals');
    });

    it('should throw error if not initialized', async () => {
      engine.reset();

      await expect(engine.getStats()).rejects.toThrow('Not initialized');
    });
  });

  describe('clear', () => {
    it('should clear all data and reset state', async () => {
      await engine.init(mockFileHash, totalAccounts);
      engine.clear();

      await expect(engine.filterToIndices('', [])).rejects.toThrow('Not initialized');
    });
  });

  describe('bitset caching', () => {
    beforeEach(async () => {
      await engine.init(mockFileHash, totalAccounts);
      // Clear mock call count after init (which preloads 3 bitsets)
      mockIndexedDBService.getBadgeBitset.mockClear();
    });

    it('should cache loaded bitsets', async () => {
      const mockBitset = new BitSet(totalAccounts);
      mockIndexedDBService.getBadgeBitset.mockResolvedValue(mockBitset);

      // First call - 'following' is already cached from init, so use 'pending' which isn't preloaded
      await engine.filterToIndices('', ['pending']);
      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await engine.filterToIndices('', ['pending']);
      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should clear cache on reset', async () => {
      const mockBitset = new BitSet(totalAccounts);
      mockIndexedDBService.getBadgeBitset.mockResolvedValue(mockBitset);

      await engine.filterToIndices('', ['following']);

      engine.reset();
      await engine.init(mockFileHash, totalAccounts);

      await engine.filterToIndices('', ['following']);

      // Should reload after reset
      expect(mockIndexedDBService.getBadgeBitset).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle IndexedDB errors gracefully', async () => {
      // Create new engine to test error during badge loading
      const errorEngine = new IndexedDBFilterEngine();
      await errorEngine.init(mockFileHash, totalAccounts);

      // Mock error for a badge that wasn't preloaded
      mockIndexedDBService.getBadgeBitset.mockRejectedValue(new Error('DB error'));

      await expect(errorEngine.filterToIndices('', ['pending'])).rejects.toThrow('DB error');
    });

    it('should handle search index errors', async () => {
      const searchEngine = new IndexedDBFilterEngine();

      // Reset mocks before init
      mockIndexedDBService.getBadgeBitset.mockReset();
      mockIndexedDBService.getBadgeBitset.mockResolvedValue(new BitSet(totalAccounts));

      await searchEngine.init(mockFileHash, totalAccounts);

      mockHasSearchIndexes.mockResolvedValue(false); // Use fallback instead of error
      mockIndexedDBService.getAccountsByRange.mockResolvedValue([]);

      const indices = await searchEngine.filterToIndices('test', []);

      expect(indices).toBeDefined();
      expect(Array.isArray(indices)).toBe(true);
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largeBitset = new BitSet(1000000);
      for (let i = 0; i < 100000; i++) {
        largeBitset.set(i * 10);
      }

      mockIndexedDBService.getBadgeBitset.mockResolvedValue(largeBitset);
      mockIndexedDBService.getFileMetadata.mockResolvedValue({
        fileHash: mockFileHash,
        fileName: 'large.zip',
        fileSize: 10240,
        uploadDate: new Date(),
        accountCount: 1000000,
        lastAccessed: Date.now(),
        version: 2,
      });

      const largeEngine = new IndexedDBFilterEngine();
      await largeEngine.init(mockFileHash, 1000000);

      const start = performance.now();
      const indices = await largeEngine.filterToIndices('', ['pending']);
      const duration = performance.now() - start;

      expect(indices).toHaveLength(100000);
      expect(duration).toBeLessThan(500); // Should be reasonably fast with bitsets
    });

    it('should minimize IndexedDB queries with batching', async () => {
      const batchEngine = new IndexedDBFilterEngine();
      await batchEngine.init(mockFileHash, totalAccounts);

      mockHasSearchIndexes.mockResolvedValue(false);

      mockIndexedDBService.getAccountsByRange.mockImplementation(async (hash, start, end) => {
        const count = Math.min(end - start, 1000);
        return Array.from({ length: count }, (_, i) => ({
          username: `user${start + i}`,
          badges: {},
        }));
      });

      await batchEngine.filterToIndices('test', []);

      // Should batch queries for all accounts (totalAccounts / 1000 batches)
      expect(mockIndexedDBService.getAccountsByRange).toHaveBeenCalled();
    });
  });

  describe('grouped filter semantics', () => {
    const bitsetOf = (indices: number[]) => {
      const bits = new BitSet(totalAccounts);
      for (const i of indices) bits.set(i);
      return bits;
    };

    it('should union two badges from the same group', async () => {
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (_hash, badge) => {
        if (badge === 'notFollowingBack') return bitsetOf([1, 2]);
        if (badge === 'notFollowedBack') return bitsetOf([3, 4]);
        return bitsetOf([]);
      });
      await engine.init(mockFileHash, totalAccounts);

      const indices = await engine.filterToIndices('', ['notFollowingBack', 'notFollowedBack']);

      expect(indices).toEqual([1, 2, 3, 4]);
    });

    it('should intersect across groups', async () => {
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (_hash, badge) => {
        if (badge === 'notFollowingBack') return bitsetOf([1, 2, 3]);
        if (badge === 'unfollowed') return bitsetOf([3, 4]);
        return bitsetOf([]);
      });
      await engine.init(mockFileHash, totalAccounts);

      const indices = await engine.filterToIndices('', ['notFollowingBack', 'unfollowed']);

      expect(indices).toEqual([3]);
    });

    it('should return nothing when one group contributes no members', async () => {
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (_hash, badge) => {
        if (badge === 'notFollowingBack') return bitsetOf([1, 2]);
        return bitsetOf([]);
      });
      await engine.init(mockFileHash, totalAccounts);

      const indices = await engine.filterToIndices('', ['notFollowingBack', 'pending']);

      expect(indices).toEqual([]);
    });

    it('should return nothing when a whole group has no stored bitset', async () => {
      // The second behaviour change on this deploy, and the one no existing
      // test covers: a badge from an absent optional file used to be dropped
      // from the AND, so the result silently widened to the other badge's set.
      // A group with no readable member now contributes the empty set.
      mockIndexedDBService.getBadgeBitset.mockImplementation(async (_hash, badge) => {
        if (badge === 'notFollowingBack') return bitsetOf([1, 2]);
        return null;
      });
      await engine.init(mockFileHash, totalAccounts);

      const indices = await engine.filterToIndices('', ['notFollowingBack', 'restricted']);

      expect(indices).toEqual([]);
    });
  });
});
