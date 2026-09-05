/**
 * Tests for Filter Worker API
 *
 * Tests the filterWorkerApi directly (unit tests) and verifies proper behavior.
 * The API is exported for direct testing without Comlink overhead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BadgeKey } from '@/core/types';
import { IndexedDBFilterEngine } from '@/lib/filtering/IndexedDBFilterEngine';

// Mock IndexedDBFilterEngine before importing worker
vi.mock('@/lib/filtering/IndexedDBFilterEngine');

// Import after mocks are set up
import { filterWorkerApi, resetWorkerState } from '@/workers/filter-worker';

describe('filter-worker', () => {
  const mockFileHash = 'test-file-hash';
  const totalAccounts = 1000;

  let mockEngine: {
    init: ReturnType<typeof vi.fn>;
    filterToIndices: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
    candidateCounts: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset worker state between tests
    resetWorkerState();

    // Create mock engine with all methods
    mockEngine = {
      init: vi.fn().mockResolvedValue(undefined),
      filterToIndices: vi.fn().mockResolvedValue([1, 2, 3]),
      getStats: vi.fn().mockResolvedValue({
        following: 100,
        followers: 200,
        mutuals: 50,
        notFollowingBack: 50,
        notFollowedBack: 100,
        pending: 0,
        permanent: 0,
        restricted: 0,
        close: 0,
        unfollowed: 0,
        dismissed: 0,
      }),
      candidateCounts: vi.fn().mockResolvedValue({ following: 1 }),
      reset: vi.fn(),
      clear: vi.fn(),
    };

    // Mock the IndexedDBFilterEngine constructor
    vi.mocked(IndexedDBFilterEngine).mockImplementation(
      () => mockEngine as unknown as IndexedDBFilterEngine
    );
  });

  describe('initialize', () => {
    it('should create engine and call init with correct parameters', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      expect(IndexedDBFilterEngine).toHaveBeenCalledTimes(1);
      expect(mockEngine.init).toHaveBeenCalledWith(mockFileHash, totalAccounts);
    });

    it('should set isReady to true after initialization', async () => {
      expect(filterWorkerApi.isReady()).toBe(false);

      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      expect(filterWorkerApi.isReady()).toBe(true);
    });

    it('should handle initialization errors', async () => {
      mockEngine.init.mockRejectedValue(new Error('Init failed'));

      await expect(filterWorkerApi.initialize(mockFileHash, totalAccounts)).rejects.toThrow(
        'Init failed'
      );
      expect(filterWorkerApi.isReady()).toBe(false);
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      expect(filterWorkerApi.isReady()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      expect(filterWorkerApi.isReady()).toBe(true);
    });

    it('should return false after reset', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      filterWorkerApi.reset();

      expect(filterWorkerApi.isReady()).toBe(false);
    });

    it('should return false after dispose', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      filterWorkerApi.dispose();

      expect(filterWorkerApi.isReady()).toBe(false);
    });
  });

  describe('filterToIndices', () => {
    it('should throw error if not initialized', async () => {
      await expect(filterWorkerApi.filterToIndices('test', ['following'])).rejects.toThrow(
        '[FilterWorker] Engine not initialized'
      );
    });

    it('should call engine.filterToIndices with correct parameters', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      const query = 'test';
      const filters: BadgeKey[] = ['following', 'followers'];

      await filterWorkerApi.filterToIndices(query, filters);

      expect(mockEngine.filterToIndices).toHaveBeenCalledWith(query, filters);
    });

    it('should return filtered indices from engine', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      mockEngine.filterToIndices.mockResolvedValue([10, 20, 30]);

      const result = await filterWorkerApi.filterToIndices('query', ['following']);

      expect(result).toEqual([10, 20, 30]);
    });

    it('should handle empty query', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      await filterWorkerApi.filterToIndices('', ['following']);

      expect(mockEngine.filterToIndices).toHaveBeenCalledWith('', ['following']);
    });

    it('should handle empty filters', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      await filterWorkerApi.filterToIndices('query', []);

      expect(mockEngine.filterToIndices).toHaveBeenCalledWith('query', []);
    });

    it('should handle multiple filters', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      const filters: BadgeKey[] = ['following', 'followers', 'mutuals', 'notFollowingBack'];
      await filterWorkerApi.filterToIndices('test', filters);

      expect(mockEngine.filterToIndices).toHaveBeenCalledWith('test', filters);
    });

    it('should propagate engine errors', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      mockEngine.filterToIndices.mockRejectedValue(new Error('Filter error'));

      await expect(filterWorkerApi.filterToIndices('test', [])).rejects.toThrow('Filter error');
    });
  });

  describe('candidateCounts', () => {
    it('should throw error if not initialized', async () => {
      await expect(filterWorkerApi.candidateCounts([])).rejects.toThrow(
        '[FilterWorker] Engine not initialized'
      );
    });

    it('should delegate to the engine with the selection', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      const counts = await filterWorkerApi.candidateCounts(['following']);

      expect(mockEngine.candidateCounts).toHaveBeenCalledWith(['following']);
      expect(counts).toEqual({ following: 1 });
    });
  });

  describe('getStats', () => {
    it('should throw error if not initialized', async () => {
      await expect(filterWorkerApi.getStats()).rejects.toThrow(
        '[FilterWorker] Engine not initialized'
      );
    });

    it('should return stats from engine', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      const stats = await filterWorkerApi.getStats();

      expect(stats).toEqual({
        following: 100,
        followers: 200,
        mutuals: 50,
        notFollowingBack: 50,
        notFollowedBack: 100,
        pending: 0,
        permanent: 0,
        restricted: 0,
        close: 0,
        unfollowed: 0,
        dismissed: 0,
      });
    });

    it('should call engine.getStats', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      await filterWorkerApi.getStats();

      expect(mockEngine.getStats).toHaveBeenCalledTimes(1);
    });

    it('should propagate engine errors', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      mockEngine.getStats.mockRejectedValue(new Error('Stats error'));

      await expect(filterWorkerApi.getStats()).rejects.toThrow('Stats error');
    });
  });

  describe('reset', () => {
    it('should call engine.reset if engine exists', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      filterWorkerApi.reset();

      expect(mockEngine.reset).toHaveBeenCalledTimes(1);
    });

    it('should set isInitialized to false', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      expect(filterWorkerApi.isReady()).toBe(true);

      filterWorkerApi.reset();

      expect(filterWorkerApi.isReady()).toBe(false);
    });

    it('should not throw if engine is null', () => {
      expect(() => filterWorkerApi.reset()).not.toThrow();
    });

    it('should allow re-initialization after reset', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      filterWorkerApi.reset();

      await filterWorkerApi.initialize('new-hash', 500);

      expect(mockEngine.init).toHaveBeenCalledWith('new-hash', 500);
      expect(filterWorkerApi.isReady()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should call engine.clear if engine exists', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      filterWorkerApi.dispose();

      expect(mockEngine.clear).toHaveBeenCalledTimes(1);
    });

    it('should set isInitialized to false', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      expect(filterWorkerApi.isReady()).toBe(true);

      filterWorkerApi.dispose();

      expect(filterWorkerApi.isReady()).toBe(false);
    });

    it('should not throw if engine is null', () => {
      expect(() => filterWorkerApi.dispose()).not.toThrow();
    });

    it('should allow re-initialization after dispose', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      filterWorkerApi.dispose();

      // Need to reset mock to count new constructor call
      vi.mocked(IndexedDBFilterEngine).mockClear();

      await filterWorkerApi.initialize('another-hash', 2000);

      expect(IndexedDBFilterEngine).toHaveBeenCalledTimes(1);
      expect(filterWorkerApi.isReady()).toBe(true);
    });
  });

  describe('workflow scenarios', () => {
    it('should handle full lifecycle: init -> filter -> stats -> dispose', async () => {
      // Initialize
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      expect(filterWorkerApi.isReady()).toBe(true);

      // Filter
      const indices = await filterWorkerApi.filterToIndices('test', ['following']);
      expect(indices).toEqual([1, 2, 3]);

      // Get stats
      const stats = await filterWorkerApi.getStats();
      expect(stats.following).toBe(100);

      // Dispose
      filterWorkerApi.dispose();
      expect(filterWorkerApi.isReady()).toBe(false);

      // Should throw after dispose
      await expect(filterWorkerApi.filterToIndices('test', [])).rejects.toThrow();
    });

    it('should handle multiple filter calls', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);

      mockEngine.filterToIndices
        .mockResolvedValueOnce([1, 2, 3])
        .mockResolvedValueOnce([4, 5])
        .mockResolvedValueOnce([]);

      const result1 = await filterWorkerApi.filterToIndices('query1', ['following']);
      const result2 = await filterWorkerApi.filterToIndices('query2', ['followers']);
      const result3 = await filterWorkerApi.filterToIndices('query3', ['mutuals']);

      expect(result1).toEqual([1, 2, 3]);
      expect(result2).toEqual([4, 5]);
      expect(result3).toEqual([]);
      expect(mockEngine.filterToIndices).toHaveBeenCalledTimes(3);
    });

    it('should handle reset and re-initialize', async () => {
      await filterWorkerApi.initialize(mockFileHash, totalAccounts);
      await filterWorkerApi.filterToIndices('test', []);

      filterWorkerApi.reset();

      // Clear mocks to verify new initialization
      mockEngine.init.mockClear();
      mockEngine.filterToIndices.mockClear();

      await filterWorkerApi.initialize('new-hash', 2000);
      await filterWorkerApi.filterToIndices('new-query', ['following']);

      expect(mockEngine.init).toHaveBeenCalledWith('new-hash', 2000);
      expect(mockEngine.filterToIndices).toHaveBeenCalledWith('new-query', ['following']);
    });
  });

  describe('type exports', () => {
    it('should export FilterWorkerApi type', () => {
      // Type check - validates the export exists and has correct shape
      type TestType = import('@/workers/filter-worker').FilterWorkerApi;
      const api: TestType = filterWorkerApi;

      expect(typeof api.initialize).toBe('function');
      expect(typeof api.isReady).toBe('function');
      expect(typeof api.filterToIndices).toBe('function');
      expect(typeof api.getStats).toBe('function');
      expect(typeof api.reset).toBe('function');
      expect(typeof api.dispose).toBe('function');
    });
  });
});
