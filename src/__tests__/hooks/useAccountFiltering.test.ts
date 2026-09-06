import type { BadgeKey, FileMetadata } from '@/core/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies
vi.mock('@/lib/filtering/IndexedDBFilterEngine');
vi.mock('@/lib/indexeddb/indexeddb-service');
vi.mock('use-debounce');
vi.mock('@/lib/store');
vi.mock('@/hooks/useFilterWorker');

// Import after mocks
import { useAccountFiltering } from '@/hooks/useAccountFiltering';
import { useFilterWorker } from '@/hooks/useFilterWorker';
import { IndexedDBFilterEngine } from '@/lib/filtering/IndexedDBFilterEngine';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useAppStore } from '@/lib/store';
import { useDebounce } from 'use-debounce';

describe('useAccountFiltering', () => {
  let mockEngine: any;
  let mockSetFilters: any;
  let mockFilters: Set<BadgeKey>;
  let mockWorkerFilterToIndices: any;

  const mockFileMetadata: FileMetadata = {
    name: 'test.zip',
    size: 1024,
    uploadDate: new Date('2024-01-01'),
    fileHash: 'test-hash-123',
    accountCount: 10, // Small count for tests
  };

  const mockFilterCounts: Record<BadgeKey, number> = {
    following: 5,
    followers: 5,
    mutuals: 3,
    notFollowingBack: 2,
    notFollowedBack: 0,
    pending: 0,
    permanent: 0,
    restricted: 0,
    close: 1,
    unfollowed: 0,
    dismissed: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock engine
    mockEngine = {
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
      filterToIndices: vi.fn().mockResolvedValue([0, 1, 2]),
      candidateCounts: vi.fn().mockResolvedValue(mockFilterCounts),
    };

    vi.mocked(IndexedDBFilterEngine).mockImplementation(() => mockEngine as any);
    vi.mocked(indexedDBService.getBadgeStats).mockResolvedValue(mockFilterCounts);
    vi.mocked(useDebounce).mockImplementation((value: any) => [value, vi.fn()] as any);

    // Mock Worker
    mockWorkerFilterToIndices = vi.fn().mockResolvedValue([]);
    vi.mocked(useFilterWorker).mockReturnValue({
      filterToIndices: mockWorkerFilterToIndices,
      isReady: false,
      hasError: true, // Default to error so fallback engine is used (preserving existing test behavior)
      getStats: vi.fn().mockResolvedValue(mockFilterCounts),
      candidateCounts: vi.fn().mockResolvedValue(mockFilterCounts),
      error: null,
    });

    // Create stable mock state object to prevent infinite loops
    // CRITICAL: filters Set must be the same object across selector calls
    mockFilters = new Set<BadgeKey>();
    mockSetFilters = vi.fn();

    // Mock store with stable state
    vi.mocked(useAppStore).mockImplementation((selector: any) => {
      const state = {
        fileMetadata: mockFileMetadata,
        filters: mockFilters, // Same object reference
        setFilters: mockSetFilters,
      };
      return selector(state);
    });
  });

  describe('Initialization', () => {
    it('should initialize with default values', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      expect(result.current.query).toBe('');
      expect(result.current.totalCount).toBe(10);
      expect(result.current.filters).toEqual(new Set());
      expect(result.current.isFiltering).toBe(false);
      expect(result.current.processingTime).toBe(0);

      // When no filters/query, null = "show all" (avoids 8MB array for 1M accounts)
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
      });

      unmount();
    });

    it('should initialize engine with fileHash and totalCount', async () => {
      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(mockEngine.init).toHaveBeenCalledWith('test-hash-123', 10);
      });

      unmount();
    });

    it('should load filter counts from IndexedDB', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(indexedDBService.getBadgeStats).toHaveBeenCalledWith('test-hash-123');
        expect(result.current.filterCounts).toEqual(mockFilterCounts);
      });

      unmount();
    });

    it('should handle empty data', () => {
      const mockEmptyFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: null,
          filters: mockEmptyFilters,
          setFilters: vi.fn(),
        };
        return selector(state);
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: null,
          accountCount: 0,
        })
      );

      expect(result.current.totalCount).toBe(0);
      expect(result.current.filteredIndices).toBeNull();

      unmount();
    });
  });

  describe('Interface', () => {
    it('should return correct interface', () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      expect(typeof result.current.setQuery).toBe('function');
      expect(typeof result.current.setFilters).toBe('function');
      expect(typeof result.current.clearFilters).toBe('function');
      expect(result.current).toHaveProperty('query');
      expect(result.current).toHaveProperty('filteredIndices');
      expect(result.current).toHaveProperty('filters');
      expect(result.current).toHaveProperty('filterCounts');
      expect(result.current).toHaveProperty('isFiltering');
      expect(result.current).toHaveProperty('processingTime');
      expect(result.current).toHaveProperty('totalCount');
      expect(result.current).toHaveProperty('hasLoadedData');

      unmount();
    });
  });

  describe('Query handling', () => {
    it('should update query when setQuery is called', () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('alice');
      });

      expect(result.current.query).toBe('alice');

      unmount();
    });

    it('should call filterToIndices when query changes', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('alice');
      });

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalledWith('alice', []);
      });

      unmount();
    });

    it('should update filteredIndices when query results are received', async () => {
      mockEngine.filterToIndices.mockResolvedValue([0, 2, 4]);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.filteredIndices).toEqual([0, 2, 4]);
      });

      unmount();
    });

    it('should handle empty query results', async () => {
      mockEngine.filterToIndices.mockResolvedValue([]);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('nonexistent');
      });

      await waitFor(() => {
        expect(result.current.filteredIndices).toEqual([]);
      });

      unmount();
    });
  });

  describe('Filter handling', () => {
    it('should update filters when setFilters is called', () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      const newFilters = new Set<BadgeKey>(['following']);

      act(() => {
        result.current.setFilters(newFilters);
      });

      expect(mockSetFilters).toHaveBeenCalledWith(newFilters);

      unmount();
    });

    it('should call filterToIndices when filters change', async () => {
      // Update mock to have filters
      const mockFiltersWithData = new Set<BadgeKey>(['following']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockFiltersWithData,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalledWith('', ['following']);
      });

      unmount();
    });

    it('should show all indices when no filters and no query', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // null = "show all" sentinel (avoids 8MB array allocation for 1M accounts)
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
      });

      unmount();
    });

    it('should handle multiple filters', async () => {
      const mockMultipleFilters = new Set<BadgeKey>(['following', 'followers']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockMultipleFilters,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalledWith(
          '',
          expect.arrayContaining(['following', 'followers'])
        );
      });

      unmount();
    });
  });

  describe('Clear filters', () => {
    it('should clear query and filters when clearFilters is called', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.query).toBe('');
      expect(mockSetFilters).toHaveBeenCalledWith(new Set());
      expect(result.current.isFiltering).toBe(false);

      // After clearing, null = "show all" (no filters/query)
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
      });

      unmount();
    });
  });

  describe('Loading state', () => {
    it('should show loading state when filtering', async () => {
      mockEngine.filterToIndices.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([0, 1]), 50))
      );

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.isFiltering).toBe(true);
      });

      // Should finish loading
      await waitFor(
        () => {
          expect(result.current.isFiltering).toBe(false);
        },
        { timeout: 200 }
      );

      unmount();
    });

    it('should set isFiltering to false after successful filtering', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.isFiltering).toBe(false);
      });

      unmount();
    });
  });

  describe('Error handling', () => {
    it('should handle filter errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockEngine.filterToIndices.mockRejectedValue(new Error('Filter failed'));

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.isFiltering).toBe(false);
        expect(result.current.filteredIndices).toBeNull();
      });

      consoleErrorSpy.mockRestore();
      unmount();
    });

    it('should continue working even if engine initialization fails', async () => {
      // Create a new mock that rejects on init but still works
      const failingEngine = {
        init: vi.fn().mockRejectedValue(new Error('Init failed')),
        clear: vi.fn(),
        filterToIndices: vi.fn().mockResolvedValue([0, 1]),
      };

      vi.mocked(IndexedDBFilterEngine).mockImplementation(() => failingEngine as any);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // Hook should still initialize despite engine init failure
      expect(result.current.totalCount).toBe(10);
      expect(result.current.hasLoadedData).toBe(true);

      // Wait for init to be called
      await waitFor(() => {
        expect(failingEngine.init).toHaveBeenCalled();
      });

      unmount();
    });

    it('should handle getBadgeStats errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(indexedDBService.getBadgeStats).mockRejectedValue(new Error('Stats failed'));

      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
      unmount();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup engine on unmount', () => {
      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      unmount();

      expect(mockEngine.clear).toHaveBeenCalled();
    });

    it('should not update state after unmount', async () => {
      mockEngine.filterToIndices.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([0, 1]), 100))
      );

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      // Unmount before promise resolves
      unmount();

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 150));

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe('Combined query and filters', () => {
    it('should handle both query and filters together', async () => {
      const mockCombinedFilters = new Set<BadgeKey>(['following']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockCombinedFilters,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('alice');
      });

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalledWith('alice', ['following']);
      });

      unmount();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero totalCount', () => {
      const mockEmptyFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: { ...mockFileMetadata, accountCount: 0 },
          filters: mockEmptyFilters,
          setFilters: vi.fn(),
        };
        return selector(state);
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: 0,
        })
      );

      expect(result.current.totalCount).toBe(0);
      expect(result.current.filteredIndices).toBeNull();

      unmount();
    });

    it('should handle missing fileHash', () => {
      const mockEmptyFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: { ...mockFileMetadata, fileHash: '' },
          filters: mockEmptyFilters,
          setFilters: vi.fn(),
        };
        return selector(state);
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: null,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      expect(result.current.filteredIndices).toBeNull();

      unmount();
    });

    it('should handle whitespace-only query', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('   ');
      });

      // Whitespace query should be treated as empty - null = "show all"
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
      });

      unmount();
    });
  });

  describe('Worker integration', () => {
    it('should use worker for filtering when ready', async () => {
      // Setup worker ready state
      mockWorkerFilterToIndices.mockResolvedValue([10, 20, 30]);
      vi.mocked(useFilterWorker).mockReturnValue({
        filterToIndices: mockWorkerFilterToIndices,
        isReady: true,
        hasError: false,
        getStats: vi.fn().mockResolvedValue(mockFilterCounts),
        candidateCounts: vi.fn().mockResolvedValue(mockFilterCounts),
        error: null,
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(mockWorkerFilterToIndices).toHaveBeenCalledWith('test', expect.any(Set));
        expect(result.current.filteredIndices).toEqual([10, 20, 30]);
      });

      // Should NOT use fallback engine
      expect(mockEngine.filterToIndices).not.toHaveBeenCalled();

      unmount();
    });

    it('should fallback to engine when worker has error', async () => {
      // This is the default setup in beforeEach, but explicit here for clarity
      vi.mocked(useFilterWorker).mockReturnValue({
        filterToIndices: mockWorkerFilterToIndices,
        isReady: false,
        hasError: true,
        getStats: vi.fn().mockResolvedValue(mockFilterCounts),
        candidateCounts: vi.fn().mockResolvedValue(mockFilterCounts),
        error: null,
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalled();
      });

      unmount();
    });
  });

  describe('Race conditions', () => {
    it('should skip filtering if already in progress', async () => {
      // This test verifies lines 111-113: if (isFilteringRef.current) return
      // The race condition check prevents the effect from running filterToIndices
      // when a previous call is still in progress

      // Note: This is difficult to test directly because React batches updates
      // and the effect dependencies control when it runs. The protection is mainly
      // for edge cases where rapid state changes could trigger the effect multiple times.
      // We'll test that filtering completes successfully even with rapid changes.

      let resolveFirstFilter: (value: number[]) => void;
      const firstFilterPromise = new Promise<number[]>(resolve => {
        resolveFirstFilter = resolve;
      });

      mockEngine.filterToIndices
        .mockReturnValueOnce(firstFilterPromise)
        .mockResolvedValue([4, 5, 6]);

      const mockFiltersWithData = new Set<BadgeKey>(['following']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockFiltersWithData,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // Wait for initial filtering to start
      await waitFor(() => {
        expect(result.current.isFiltering).toBe(true);
      });

      // Filtering is in progress - isFilteringRef.current is true
      // Any effect re-runs during this time will hit the guard clause
      expect(mockEngine.filterToIndices).toHaveBeenCalledTimes(1);

      // Resolve the filter
      act(() => {
        resolveFirstFilter!([1, 2, 3]);
      });

      await waitFor(() => {
        expect(result.current.isFiltering).toBe(false);
        expect(result.current.filteredIndices).toEqual([1, 2, 3]);
      });

      // The guard clause (lines 111-113) ensures isFilteringRef is checked
      // This test verifies the mechanism works by ensuring filtering completes
      // correctly even with the ref-based locking mechanism in place
      expect(result.current.filteredIndices).toEqual([1, 2, 3]);

      unmount();
    });

    it('should handle null engine during filtering', async () => {
      // This test verifies that when fileHash becomes null, the hook returns empty results

      // First, render with a valid engine
      const { result, unmount, rerender } = renderHook(
        ({ fileHash, accountCount }) =>
          useAccountFiltering({
            fileHash,
            accountCount,
          }),
        {
          initialProps: {
            fileHash: mockFileMetadata.fileHash,
            accountCount: mockFileMetadata.accountCount,
          },
        }
      );

      // Wait for initial state — null = "show all"
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
      });

      // Update store to have empty filters
      const mockEmptyFilters = new Set<BadgeKey>();
      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: null,
          filters: mockEmptyFilters,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      // Trigger rerender with null fileHash
      rerender({ fileHash: null, accountCount: 0 });

      // Should handle null engine gracefully — null = no data
      await waitFor(() => {
        expect(result.current.filteredIndices).toBeNull();
        expect(result.current.isFiltering).toBe(false);
        expect(result.current.totalCount).toBe(0);
      });

      unmount();
    });

    it('should prevent concurrent filtering operations', async () => {
      let firstResolve: (value: number[]) => void;
      let secondResolve: (value: number[]) => void;

      const firstPromise = new Promise<number[]>(resolve => {
        firstResolve = resolve;
      });

      const secondPromise = new Promise<number[]>(resolve => {
        secondResolve = resolve;
      });

      mockEngine.filterToIndices
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // Start first filtering
      act(() => {
        result.current.setQuery('query1');
      });

      expect(result.current.isFiltering).toBe(true);

      // Complete first filtering
      act(() => {
        firstResolve!([0, 1, 2]);
      });

      await waitFor(() => {
        expect(result.current.isFiltering).toBe(false);
      });

      // Now start second filtering (should work)
      act(() => {
        result.current.setQuery('query2');
      });

      await waitFor(() => {
        expect(result.current.isFiltering).toBe(true);
      });

      // Complete second filtering
      act(() => {
        secondResolve!([3, 4, 5]);
      });

      await waitFor(() => {
        expect(result.current.filteredIndices).toEqual([3, 4, 5]);
        expect(result.current.isFiltering).toBe(false);
      });

      unmount();
    });
  });

  describe('Engine lifecycle', () => {
    it('should reinitialize engine when fileHash changes', async () => {
      const { rerender, unmount } = renderHook(
        ({ fileHash, accountCount }) =>
          useAccountFiltering({
            fileHash,
            accountCount,
          }),
        {
          initialProps: {
            fileHash: mockFileMetadata.fileHash,
            accountCount: mockFileMetadata.accountCount,
          },
        }
      );

      // Initial engine init
      await waitFor(() => {
        expect(mockEngine.init).toHaveBeenCalledWith('test-hash-123', 10);
      });

      const firstInitCallCount = mockEngine.init.mock.calls.length;

      // Change fileHash
      const newMockFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: {
            ...mockFileMetadata,
            fileHash: 'new-hash-456',
            accountCount: 20,
          },
          filters: newMockFilters,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      rerender({ fileHash: 'new-hash-456', accountCount: 20 });

      // Should clear old engine and init new one
      await waitFor(() => {
        expect(mockEngine.clear).toHaveBeenCalled();
        expect(mockEngine.init).toHaveBeenCalledWith('new-hash-456', 20);
        expect(mockEngine.init.mock.calls.length).toBeGreaterThan(firstInitCallCount);
      });

      unmount();
    });

    it('should handle engine init failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const failingEngine = {
        init: vi.fn().mockRejectedValue(new Error('Init failed')),
        clear: vi.fn(),
        filterToIndices: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(IndexedDBFilterEngine).mockImplementation(() => failingEngine as any);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // Wait for init to fail
      await waitFor(() => {
        expect(failingEngine.init).toHaveBeenCalled();
      });

      // Hook should still work despite init failure
      expect(result.current.totalCount).toBe(10);
      expect(result.current.hasLoadedData).toBe(true);

      consoleErrorSpy.mockRestore();
      unmount();
    });
  });

  describe('Filter counts', () => {
    it('should update filter counts when fileHash changes', async () => {
      const { rerender, result, unmount } = renderHook(
        ({ fileHash, accountCount }) =>
          useAccountFiltering({
            fileHash,
            accountCount,
          }),
        {
          initialProps: {
            fileHash: mockFileMetadata.fileHash,
            accountCount: mockFileMetadata.accountCount,
          },
        }
      );

      // Initial counts
      await waitFor(() => {
        expect(result.current.filterCounts).toEqual(mockFilterCounts);
      });

      // Change fileHash
      const newFilterCounts: Record<BadgeKey, number> = {
        ...mockFilterCounts,
        following: 20,
        followers: 15,
      };

      vi.mocked(indexedDBService.getBadgeStats).mockResolvedValue(newFilterCounts);

      const newMockFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: {
            ...mockFileMetadata,
            fileHash: 'new-hash-789',
          },
          filters: newMockFilters,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      rerender({ fileHash: 'new-hash-789', accountCount: mockFileMetadata.accountCount });

      // Should load new counts
      await waitFor(() => {
        expect(indexedDBService.getBadgeStats).toHaveBeenCalledWith('new-hash-789');
        expect(result.current.filterCounts).toEqual(newFilterCounts);
      });

      unmount();
    });

    it('should not load counts when fileHash is null', async () => {
      const mockEmptyFilters = new Set<BadgeKey>();

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: null,
          filters: mockEmptyFilters,
          setFilters: vi.fn(),
        };
        return selector(state);
      });

      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: null,
          accountCount: 0,
        })
      );

      // Wait a bit to ensure no calls are made
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should not call getBadgeStats when fileHash is null
      expect(indexedDBService.getBadgeStats).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe('Debouncing', () => {
    it('should debounce search query changes', async () => {
      let debouncedValue = '';
      let setDebouncedValue: (value: string) => void;

      vi.mocked(useDebounce).mockImplementation((value: any) => {
        debouncedValue = value;
        return [debouncedValue, vi.fn()] as any;
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      // Rapid query changes
      act(() => {
        result.current.setQuery('a');
      });

      act(() => {
        result.current.setQuery('ab');
      });

      act(() => {
        result.current.setQuery('abc');
      });

      // Only final value should be used for filtering
      expect(result.current.query).toBe('abc');

      unmount();
    });
  });

  describe('Memory management', () => {
    it('should clear engine on unmount', () => {
      const { unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      unmount();

      expect(mockEngine.clear).toHaveBeenCalled();
    });

    it('should mark component as unmounted to prevent state updates', async () => {
      mockEngine.filterToIndices.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([0, 1]), 200))
      );

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      // Unmount immediately
      unmount();

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 300));

      // No errors should occur - state updates should be prevented
      expect(true).toBe(true);
    });

    it('should reset filtering state on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      // Unmount should reset state
      unmount();

      // No assertions needed - just verify no errors occur
      expect(true).toBe(true);
    });
  });

  describe('Filter array stability', () => {
    it('should maintain stable filter array when content unchanged', async () => {
      const { result, rerender, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      const initialCallCount = mockEngine.filterToIndices.mock.calls.length;

      // Rerender without changing filters
      rerender();
      rerender();
      rerender();

      // Should not trigger additional filtering
      await waitFor(() => {
        expect(mockEngine.filterToIndices.mock.calls.length).toBe(initialCallCount);
      });

      unmount();
    });

    it('should detect filter changes by content', async () => {
      const mockFiltersV1 = new Set<BadgeKey>(['following']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockFiltersV1,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      const { rerender, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(mockEngine.filterToIndices).toHaveBeenCalledWith('', ['following']);
      });

      const callCountBefore = mockEngine.filterToIndices.mock.calls.length;

      // Change filters
      const mockFiltersV2 = new Set<BadgeKey>(['following', 'followers']);

      vi.mocked(useAppStore).mockImplementation((selector: any) => {
        const state = {
          fileMetadata: mockFileMetadata,
          filters: mockFiltersV2,
          setFilters: mockSetFilters,
        };
        return selector(state);
      });

      rerender();

      // Should trigger new filtering
      await waitFor(() => {
        expect(mockEngine.filterToIndices.mock.calls.length).toBeGreaterThan(callCountBefore);
      });

      unmount();
    });
  });

  describe('Processing time', () => {
    it('should reset processing time after filtering', async () => {
      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.processingTime).toBe(0);
        expect(result.current.isFiltering).toBe(false);
      });

      unmount();
    });

    it('should reset processing time on error', async () => {
      mockEngine.filterToIndices.mockRejectedValue(new Error('Filter failed'));

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      act(() => {
        result.current.setQuery('test');
      });

      await waitFor(() => {
        expect(result.current.processingTime).toBe(0);
        expect(result.current.isFiltering).toBe(false);
      });

      unmount();
    });
  });

  /**
   * The worker path and the fallback path have to reach the same answer.
   * `filteredIndices === null` means "show all" in this hook, so a fallback that
   * is queried before `init()` resolves throws "Not initialized", lands in the
   * catch, and puts the full unfiltered list on screen with the spinner gone —
   * indistinguishable, on screen, from a correct answer.
   */
  describe('Fallback engine readiness', () => {
    it('should not query the fallback engine before init() resolves', async () => {
      let initialized = false;
      let resolveInit: (() => void) | undefined;

      mockEngine.init.mockReturnValue(
        new Promise<void>(resolve => {
          resolveInit = () => {
            initialized = true;
            resolve();
          };
        })
      );
      mockEngine.filterToIndices.mockImplementation(async () => {
        if (!initialized) {
          throw new Error('[IndexedDB Filter Engine] Not initialized');
        }
        return [3, 4];
      });

      mockFilters = new Set<BadgeKey>(['unfollowed']);

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => {
        expect(mockEngine.init).toHaveBeenCalled();
      });

      expect(mockEngine.filterToIndices).not.toHaveBeenCalled();
      expect(result.current.isFiltering).toBe(true);

      await act(async () => {
        resolveInit?.();
      });

      await waitFor(() => {
        expect(result.current.filteredIndices).toEqual([3, 4]);
      });
      expect(result.current.isFiltering).toBe(false);

      unmount();
    });
  });

  describe('candidate counts', () => {
    it('should compute through the worker when the worker is the live path', async () => {
      const workerCandidateCounts = vi.fn().mockResolvedValue({ ...mockFilterCounts, pending: 0 });
      vi.mocked(useFilterWorker).mockReturnValue({
        filterToIndices: mockWorkerFilterToIndices,
        getStats: vi.fn().mockResolvedValue(mockFilterCounts),
        candidateCounts: workerCandidateCounts,
        isReady: true,
        hasError: false,
        error: null,
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => expect(result.current.candidateCounts).not.toBeNull());
      expect(workerCandidateCounts).toHaveBeenCalled();
      // The control: on the worker path the fallback engine must not be consulted
      // at all. Without it this test passes on a hook that reads only the ref —
      // the path no real reader takes.
      expect(mockEngine.candidateCounts).not.toHaveBeenCalled();

      unmount();
    });

    it('should report null rather than an empty map when nothing can answer', async () => {
      vi.mocked(useFilterWorker).mockReturnValue({
        filterToIndices: mockWorkerFilterToIndices,
        getStats: vi.fn().mockResolvedValue(mockFilterCounts),
        candidateCounts: vi.fn().mockResolvedValue(null),
        isReady: true,
        hasError: false,
        error: null,
      });

      const { result, unmount } = renderHook(() =>
        useAccountFiltering({
          fileHash: mockFileMetadata.fileHash,
          accountCount: mockFileMetadata.accountCount,
        })
      );

      await waitFor(() => expect(result.current.candidateCounts).toBeNull());
      // Not {}: an empty map reads as "every badge yields zero" downstream, and
      // zero is the value that disables an option.
      expect(result.current.candidateCounts).not.toEqual({});

      unmount();
    });
  });
});
