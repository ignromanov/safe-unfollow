/**
 * Tests for useFilterWorker hook
 *
 * Tests the React hook that manages Web Worker lifecycle and Comlink communication.
 * Uses complete mocking of Worker and Comlink for reliable testing.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BadgeKey } from '@/core/types';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Create mock API that will be returned by Comlink.wrap
const createMockApi = () => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  isReady: vi.fn().mockReturnValue(true),
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
  reset: vi.fn(),
  dispose: vi.fn(),
});

let mockApi = createMockApi();

// Mock Comlink
vi.mock('comlink', () => ({
  wrap: vi.fn(() => mockApi),
  expose: vi.fn(),
}));

// Import after mocks
import * as Comlink from 'comlink';
import { useFilterWorker } from '@/hooks/useFilterWorker';
import { logger } from '@/lib/logger';

describe('useFilterWorker', () => {
  const mockFileHash = 'test-file-hash';
  const totalAccounts = 1000;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock API for each test
    mockApi = createMockApi();
    vi.mocked(Comlink.wrap).mockReturnValue(mockApi);
  });

  describe('initialization', () => {
    it('should start with isReady=false', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      // Initially not ready (worker is initializing async)
      expect(result.current.isReady).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.error).toBeNull();

      // Wait for async initialization to complete to avoid act() warnings
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
    });

    it('should become ready after worker initialization', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.hasError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockApi.initialize).toHaveBeenCalledWith(mockFileHash, totalAccounts);
    });

    it('should skip initialization when fileHash is null', () => {
      const { result } = renderHook(() => useFilterWorker({ fileHash: null, totalAccounts: 100 }));

      expect(result.current.isReady).toBe(false);
      expect(mockApi.initialize).not.toHaveBeenCalled();
    });

    it('should skip initialization when totalAccounts is 0', () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts: 0 })
      );

      expect(result.current.isReady).toBe(false);
      expect(mockApi.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockApi.initialize.mockRejectedValue(new Error('Init failed'));

      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.error).toBe('Init failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockApi.initialize.mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.hasError).toBe(true);
      });

      expect(result.current.error).toBe('Worker initialization failed');
    });
  });

  describe('re-initialization', () => {
    it('should re-initialize when fileHash changes', async () => {
      const { result, rerender } = renderHook(
        ({ fileHash, totalAccounts }) => useFilterWorker({ fileHash, totalAccounts }),
        { initialProps: { fileHash: mockFileHash, totalAccounts } }
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Reset mock to track new call
      mockApi.initialize.mockClear();

      // Change fileHash
      rerender({ fileHash: 'new-hash', totalAccounts });

      await waitFor(() => {
        expect(mockApi.initialize).toHaveBeenCalledWith('new-hash', totalAccounts);
      });
    });

    it('should NOT re-initialize when only totalAccounts changes', async () => {
      const { result, rerender } = renderHook(
        ({ fileHash, totalAccounts }) => useFilterWorker({ fileHash, totalAccounts }),
        { initialProps: { fileHash: mockFileHash, totalAccounts } }
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      mockApi.initialize.mockClear();

      // Change totalAccounts only — should NOT trigger re-initialization
      rerender({ fileHash: mockFileHash, totalAccounts: 2000 });

      // Wait a tick to ensure no re-initialization happens
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockApi.initialize).not.toHaveBeenCalled();
    });

    it('should become not ready when fileHash becomes null', async () => {
      const { result, rerender } = renderHook(
        ({ fileHash, totalAccounts }) => useFilterWorker({ fileHash, totalAccounts }),
        { initialProps: { fileHash: mockFileHash, totalAccounts } }
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Set fileHash to null
      rerender({ fileHash: null, totalAccounts });

      expect(result.current.isReady).toBe(false);
    });
  });

  describe('filterToIndices', () => {
    it('should return empty array if worker not ready', async () => {
      const { result } = renderHook(() => useFilterWorker({ fileHash: null, totalAccounts: 0 }));

      const indices = await result.current.filterToIndices('query', new Set(['following']));

      expect(indices).toEqual([]);
    });

    it('should call worker filterToIndices when ready', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const filters = new Set<BadgeKey>(['following', 'followers']);
      const indices = await result.current.filterToIndices('test-query', filters);

      expect(indices).toEqual([1, 2, 3]);
      expect(mockApi.filterToIndices).toHaveBeenCalledWith(
        'test-query',
        expect.arrayContaining(['following', 'followers'])
      );
    });

    it('should convert Set to Array for transfer', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const filters = new Set<BadgeKey>(['following', 'mutuals']);
      await result.current.filterToIndices('query', filters);

      // The worker receives an array, not a Set
      const callArgs = mockApi.filterToIndices.mock.calls[0];
      expect(Array.isArray(callArgs[1])).toBe(true);
      expect(callArgs[1]).toContain('following');
      expect(callArgs[1]).toContain('mutuals');
    });

    it('should handle filter errors', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      mockApi.filterToIndices.mockRejectedValue(new Error('Filter failed'));

      await expect(result.current.filterToIndices('query', new Set())).rejects.toThrow(
        'Filter failed'
      );

      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty filters', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      await result.current.filterToIndices('query', new Set());

      expect(mockApi.filterToIndices).toHaveBeenCalledWith('query', []);
    });
  });

  describe('getStats', () => {
    it('should return empty object if worker not ready', async () => {
      const { result } = renderHook(() => useFilterWorker({ fileHash: null, totalAccounts: 0 }));

      const stats = await result.current.getStats();

      expect(stats).toEqual({});
    });

    it('should return stats from worker when ready', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const stats = await result.current.getStats();

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

    it('should handle getStats errors', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      mockApi.getStats.mockRejectedValue(new Error('Stats failed'));

      await expect(result.current.getStats()).rejects.toThrow('Stats failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should call dispose on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      unmount();

      expect(mockApi.dispose).toHaveBeenCalled();
    });

    it('should not update state after unmount', async () => {
      // Simulate slow initialization
      let resolveInit: () => void;
      mockApi.initialize.mockImplementation(
        () =>
          new Promise<void>(resolve => {
            resolveInit = resolve;
          })
      );

      const { result, unmount } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      expect(result.current.isReady).toBe(false);

      // Unmount before init completes
      unmount();

      // Complete init after unmount
      act(() => {
        resolveInit!();
      });

      // Wait a bit - no state update errors should occur
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(true).toBe(true);
    });

    it('should cleanup previous worker when fileHash changes', async () => {
      const { result, rerender } = renderHook(
        ({ fileHash }) => useFilterWorker({ fileHash, totalAccounts }),
        { initialProps: { fileHash: mockFileHash } }
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Change fileHash - should cleanup old worker
      rerender({ fileHash: 'new-hash' });

      // dispose should be called for cleanup
      expect(mockApi.dispose).toHaveBeenCalled();

      // Wait for new worker initialization to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
    });
  });

  describe('return value stability', () => {
    it('should return stable filterToIndices callback', async () => {
      const { result, rerender } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      // Wait for initialization to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const callback1 = result.current.filterToIndices;

      rerender();

      const callback2 = result.current.filterToIndices;

      expect(callback1).toBe(callback2);
    });

    it('should return stable getStats callback', async () => {
      const { result, rerender } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      // Wait for initialization to complete
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const callback1 = result.current.getStats;

      rerender();

      const callback2 = result.current.getStats;

      expect(callback1).toBe(callback2);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent filter calls', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      mockApi.filterToIndices
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3, 4])
        .mockResolvedValueOnce([5, 6]);

      // Fire multiple concurrent calls
      const [result1, result2, result3] = await Promise.all([
        result.current.filterToIndices('q1', new Set(['following'])),
        result.current.filterToIndices('q2', new Set(['followers'])),
        result.current.filterToIndices('q3', new Set(['mutuals'])),
      ]);

      expect(result1).toEqual([1, 2]);
      expect(result2).toEqual([3, 4]);
      expect(result3).toEqual([5, 6]);
    });
  });

  describe('edge cases', () => {
    it('should handle very large totalAccounts', async () => {
      const { result } = renderHook(() =>
        useFilterWorker({ fileHash: mockFileHash, totalAccounts: 1_000_000 })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(mockApi.initialize).toHaveBeenCalledWith(mockFileHash, 1_000_000);
    });

    it('should handle empty fileHash string', () => {
      const { result } = renderHook(() => useFilterWorker({ fileHash: '', totalAccounts: 100 }));

      // Empty string is falsy, should not initialize
      expect(result.current.isReady).toBe(false);
      expect(mockApi.initialize).not.toHaveBeenCalled();
    });

    it('should handle rapid fileHash changes', async () => {
      const { result, rerender } = renderHook(
        ({ fileHash }) => useFilterWorker({ fileHash, totalAccounts }),
        { initialProps: { fileHash: 'hash-1' } }
      );

      // Rapidly change fileHash multiple times
      rerender({ fileHash: 'hash-2' });
      rerender({ fileHash: 'hash-3' });
      rerender({ fileHash: 'hash-4' });

      // Should eventually stabilize
      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });
    });
  });
});
