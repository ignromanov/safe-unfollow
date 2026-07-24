import type { BadgeKey } from '@/core/types';
import { useFileUpload } from '@/hooks/useFileUpload';
import { analytics } from '@/lib/analytics';
import { dbCache, generateFileHash } from '@/lib/indexeddb/indexeddb-cache';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';
import { useAppStore } from '@/lib/store';
import { act, renderHook } from '@testing-library/react';

// Mock dependencies
vi.mock('@/lib/store');
vi.mock('@/lib/indexeddb/indexeddb-cache');
vi.mock('@/lib/indexeddb/indexeddb-service');
vi.mock('@/core/parsers/instagram');
vi.mock('@/core/badges');
// Mock analytics (V9: fileUploadError removed)
vi.mock('@/lib/analytics', () => ({
  analytics: {
    fileUploadStart: vi.fn(),
    fileUploadSuccess: vi.fn(),
    uploadErrorByCode: vi.fn(),
    returnUpload: vi.fn(),
    linkClick: vi.fn(),
    uploadParseDuration: vi.fn(),
  },
}));

const mockUseAppStore = vi.mocked(useAppStore);
const mockDbCache = vi.mocked(dbCache);
const mockGenerateFileHash = vi.mocked(generateFileHash);
const mockIndexedDBService = vi.mocked(indexedDBService);

describe('useFileUpload', () => {
  // Create a proper mock File
  const createMockFile = (content: string = 'test') => {
    const file = new File([content], 'test.zip', { type: 'application/zip' });
    file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(content).buffer);
    return file;
  };

  const mockFile = createMockFile();
  const mockFileHash = 'abc123hash';

  const mockSetUploadInfo = vi.fn();
  const mockSetFilters = vi.fn();

  beforeEach(async () => {
    vi.clearAllMocks();

    // Disable Worker to force fallback to main thread parsing
    (global as any).Worker = undefined;

    // Mock store
    mockUseAppStore.mockImplementation(selector => {
      const state = {
        currentFileName: null,
        uploadStatus: 'idle' as const,
        uploadError: null,
        fileMetadata: null,
        _hasHydrated: true,
        setUploadInfo: mockSetUploadInfo,
        setFilters: mockSetFilters,
        clearData: vi.fn(),
        filters: new Set<BadgeKey>(),
      };
      return selector(state);
    });

    // Mock file hash generation
    mockGenerateFileHash.mockResolvedValue(mockFileHash);

    // Mock cache check - file not cached
    mockDbCache.get.mockResolvedValue(null);

    // Mock IndexedDB service methods
    mockIndexedDBService.clearFile.mockResolvedValue();
    mockIndexedDBService.saveFileMetadata.mockResolvedValue();
    mockIndexedDBService.storeAllAccounts.mockResolvedValue();

    // Mock parsers for fallback path
    const { parseInstagramZipFile } = await import('@/core/parsers/instagram');
    const { buildAccountBadgeIndex } = await import('@/core/badges');

    vi.mocked(parseInstagramZipFile).mockResolvedValue({
      data: {
        following: new Set(['user1']),
        followers: new Set(['user2']),
        pendingSent: new Map(),
        permanentRequests: new Map(),
        restricted: new Map(),
        closeFriends: new Map(),
        unfollowed: new Map(),
        dismissedSuggestions: new Map(),
        followingTimestamps: new Map(),
        followersTimestamps: new Map(),
      },
      warnings: [],
      discovery: {
        format: 'json',
        isInstagramExport: true,
        basePath: '',
        files: [],
      },
      hasMinimalData: true,
    });

    vi.mocked(buildAccountBadgeIndex).mockReturnValue([
      { username: 'user1', badges: { following: Date.now() } },
      { username: 'user2', badges: { followers: Date.now() } },
    ] as any);
  });

  it('should handle ZIP upload successfully', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    expect(mockGenerateFileHash).toHaveBeenCalledWith(mockFile);
    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        uploadError: null,
        fileHash: mockFileHash,
      })
    );
  });

  it('should not override existing filters', async () => {
    mockUseAppStore.mockImplementation(selector => {
      const state = {
        currentFileName: null,
        uploadStatus: 'idle' as const,
        uploadError: null,
        fileMetadata: null,
        _hasHydrated: true,
        setUploadInfo: mockSetUploadInfo,
        setFilters: mockSetFilters,
        clearData: vi.fn(),
        filters: new Set<BadgeKey>(['mutuals']),
      };
      return selector(state);
    });

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    expect(mockSetFilters).not.toHaveBeenCalled();
  });

  it('should handle upload errors', async () => {
    const errorMessage = 'Invalid ZIP file';
    mockGenerateFileHash.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      try {
        await result.current.handleZipUpload(mockFile);
      } catch (err) {
        // Expected error
      }
    });

    // Verify error state was set (only checking for the error call since loading might be batched)
    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFileName: 'test.zip',
        uploadStatus: 'error',
        uploadError: errorMessage,
      })
    );
  });

  it('should handle non-Error exceptions', async () => {
    mockGenerateFileHash.mockRejectedValueOnce('Failed to parse ZIP');

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      try {
        await result.current.handleZipUpload(mockFile);
      } catch (err) {
        // Expected error
      }
    });

    // Verify error state was set (only checking for the error call since loading might be batched)
    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFileName: 'test.zip',
        uploadStatus: 'error',
        uploadError: 'Failed to parse ZIP',
      })
    );
  });

  it('should set upload info immediately for UI feedback', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    // Should be called with loading state first
    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFileName: 'test.zip',
        uploadStatus: 'loading',
        uploadError: null,
      })
    );
  });

  it('should handle upload cancellation', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Start upload and immediately abort
    const uploadPromise = act(async () => {
      const promise = result.current.handleZipUpload(mockFile).catch(() => {
        // Expected to be cancelled
      });
      result.current.abortUpload();
      return promise;
    });

    await uploadPromise;

    // Should not throw or cause errors
  });

  it('should cancel previous upload when starting new one', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Start first upload (don't await to simulate concurrent uploads)
    let firstUploadComplete = false;
    act(() => {
      result.current
        .handleZipUpload(mockFile)
        .then(() => {
          firstUploadComplete = true;
        })
        .catch(() => {
          // Ignore cancellation errors
        });
    });

    // Start second upload (should cancel first)
    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    // Should have been called multiple times for loading and success
    expect(mockSetUploadInfo.mock.calls.length).toBeGreaterThan(2);
  });

  it('should return correct initial state', () => {
    const { result } = renderHook(() => useFileUpload());

    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.processedCount).toBe(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.handleZipUpload).toBeInstanceOf(Function);
    expect(result.current.abortUpload).toBeInstanceOf(Function);
  });

  it('should handle file metadata correctly', async () => {
    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    // Check the final success call (second call)
    const successCall = mockSetUploadInfo.mock.calls.find(
      call => call[0].uploadStatus === 'success'
    );

    expect(successCall).toBeDefined();
    expect(successCall?.[0]).toMatchObject({
      currentFileName: 'test.zip',
      uploadStatus: 'success',
      uploadError: null,
      fileHash: mockFileHash,
    });
  });

  it('should handle upload cancellation during badge building', async () => {
    const { result } = renderHook(() => useFileUpload());

    // Start upload and abort during processing
    await act(async () => {
      const promise = result.current.handleZipUpload(mockFile).catch(() => {
        // Expected to be cancelled
      });
      result.current.abortUpload();
      return promise;
    });

    // Should not throw
  });

  it('should handle cached file upload', async () => {
    // Mock cached file
    const cachedMetadata = {
      metadata: {
        name: 'test.zip',
        size: 1024,
        uploadDate: new Date('2023-01-01'),
        fileHash: mockFileHash,
        accountCount: 100,
      },
    };
    mockDbCache.get.mockResolvedValue(cachedMetadata as any);

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    // Should use cached data
    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        currentFileName: 'test.zip',
        uploadStatus: 'success',
        uploadError: null,
        fileHash: mockFileHash,
        accountCount: 100,
      })
    );
  });

  it('should handle worker initialization failure', async () => {
    // Worker is already undefined in beforeEach
    const { result } = renderHook(() => useFileUpload());

    // Should handle upload via fallback
    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    expect(mockSetUploadInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadStatus: 'success',
      })
    );
  });

  describe('parse duration tracking', () => {
    // Sizes the audience for anything rendered during processing (LoadingTips).
    // Every terminal path has to report, or the denominator is wrong.
    it('should report a success outcome once parsing finishes', async () => {
      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.handleZipUpload(mockFile);
      });

      expect(analytics.uploadParseDuration).toHaveBeenCalledTimes(1);
      expect(analytics.uploadParseDuration).toHaveBeenCalledWith(expect.any(Number), 'success');
    });

    it('should separate cache hits, which never show the loading state for long', async () => {
      mockDbCache.get.mockResolvedValue({
        metadata: {
          name: 'test.zip',
          size: 1024,
          uploadDate: new Date('2023-01-01'),
          fileHash: mockFileHash,
          accountCount: 100,
        },
      } as any);

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.handleZipUpload(mockFile);
      });

      expect(analytics.uploadParseDuration).toHaveBeenCalledWith(expect.any(Number), 'cached');
    });

    it('should report failures, which is how fast errors are told from fast parses', async () => {
      mockGenerateFileHash.mockRejectedValueOnce(new Error('Invalid ZIP file'));

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        try {
          await result.current.handleZipUpload(mockFile);
        } catch {
          // Expected — the hook rethrows for the caller's error UI
        }
      });

      expect(analytics.uploadParseDuration).toHaveBeenCalledWith(expect.any(Number), 'error');
    });
  });

  describe('Worker initialization', () => {
    let originalWorker: typeof Worker | undefined;
    let originalCreateElement: typeof document.createElement;
    let originalQuerySelector: typeof document.querySelector;

    beforeEach(() => {
      originalWorker = (global as any).Worker;
      originalCreateElement = document.createElement;
      originalQuerySelector = document.querySelector;

      // Mock document.querySelector to return null (no existing script)
      document.querySelector = vi.fn(() => null);

      // Mock document.createElement to handle script creation
      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
          };
          // Simulate script load success after a short delay
          setTimeout(() => {
            if (mockScript.onload) {
              mockScript.onload();
            }
          }, 10);
          return mockScript as any;
        }
        return originalCreateElement.call(document, tagName);
      });

      // Mock document.head.appendChild
      if (!document.head.appendChild) {
        document.head.appendChild = vi.fn((node: any) => node);
      } else {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => node);
      }
    });

    afterEach(() => {
      (global as any).Worker = originalWorker;
      document.createElement = originalCreateElement;
      document.querySelector = originalQuerySelector;
      vi.restoreAllMocks();
    });

    it('should initialize worker with module type', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      const WorkerConstructor = vi.fn(() => mockWorker);
      (global as any).Worker = WorkerConstructor;

      const { unmount } = renderHook(() => useFileUpload());

      // Wait for worker initialization
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(WorkerConstructor).toHaveBeenCalled();

      // Cleanup
      unmount();
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should handle worker ready message', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
          if (event === 'message') {
            // Simulate ready message
            setTimeout(() => handler({ data: { type: 'ready' } } as MessageEvent), 50);
          }
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      renderHook(() => useFileUpload());

      // Wait for worker initialization and ready message
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should timeout if worker does not respond', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      renderHook(() => useFileUpload());

      // Wait for worker initialization
      await new Promise(resolve => setTimeout(resolve, 150));

      // Worker should still be initialized even without ready message
      expect(mockWorker.addEventListener).toHaveBeenCalled();
    });

    it('should handle worker error during initialization', async () => {
      const WorkerConstructor = vi.fn(() => {
        throw new Error('Worker creation failed');
      });
      (global as any).Worker = WorkerConstructor;

      // Should not throw, just fall back to main thread
      const { result } = renderHook(() => useFileUpload());

      expect(result.current).toBeDefined();
    });

    it('should initialize worker', async () => {
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      renderHook(() => useFileUpload());

      // Wait for worker initialization
      await new Promise(resolve => setTimeout(resolve, 150));

      // Worker should be created successfully
      expect((global as any).Worker).toHaveBeenCalled();
    });
  });

  describe('Worker message handling', () => {
    let originalWorker: typeof Worker | undefined;
    let originalCreateElement: typeof document.createElement;
    let originalQuerySelector: typeof document.querySelector;

    beforeEach(() => {
      originalWorker = (global as any).Worker;
      originalCreateElement = document.createElement;
      originalQuerySelector = document.querySelector;

      // Mock document.querySelector to return null (no existing script)
      document.querySelector = vi.fn(() => null);

      // Mock document.createElement to handle script creation
      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'script') {
          const mockScript = {
            src: '',
            onload: null as (() => void) | null,
            onerror: null as (() => void) | null,
          };
          // Simulate script load success after a short delay
          setTimeout(() => {
            if (mockScript.onload) {
              mockScript.onload();
            }
          }, 10);
          return mockScript as any;
        }
        return originalCreateElement.call(document, tagName);
      });

      // Mock document.head.appendChild
      if (!document.head.appendChild) {
        document.head.appendChild = vi.fn((node: any) => node);
      } else {
        vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => node);
      }
    });

    afterEach(() => {
      (global as any).Worker = originalWorker;
      document.createElement = originalCreateElement;
      document.querySelector = originalQuerySelector;
      vi.restoreAllMocks();
    });

    it('should handle progress messages from worker', async () => {
      const messageHandlers: ((e: MessageEvent) => void)[] = [];
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandlers.push(handler);
          }
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      const { result } = renderHook(() => useFileUpload());

      // Wait for worker initialization
      await new Promise(resolve => setTimeout(resolve, 150));

      // Simulate ready message
      messageHandlers.forEach(h => h({ data: { type: 'ready' } } as MessageEvent));

      // Start upload
      const uploadPromise = act(async () => {
        const promise = result.current.handleZipUpload(mockFile);

        // Simulate progress messages
        await new Promise(resolve => setTimeout(resolve, 50));
        messageHandlers.forEach(h =>
          h({
            data: { type: 'progress', progress: 50, processedCount: 5000, totalCount: 10000 },
          } as MessageEvent)
        );

        await new Promise(resolve => setTimeout(resolve, 50));
        messageHandlers.forEach(h =>
          h({
            data: { type: 'result', fileHash: mockFileHash, accountCount: 10000 },
          } as MessageEvent)
        );

        return promise;
      });

      await uploadPromise;

      expect(result.current.uploadProgress).toBe(50);
      expect(result.current.processedCount).toBe(5000);
      expect(result.current.totalCount).toBe(10000);
    });

    it('should handle error messages from worker', async () => {
      const messageHandlers: ((e: MessageEvent) => void)[] = [];
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandlers.push(handler);
          }
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      const { result } = renderHook(() => useFileUpload());

      // Wait for worker initialization
      await new Promise(resolve => setTimeout(resolve, 150));

      // Simulate ready message
      messageHandlers.forEach(h => h({ data: { type: 'ready' } } as MessageEvent));

      // Start upload and simulate error
      await act(async () => {
        const promise = result.current.handleZipUpload(mockFile).catch(() => {
          // Expected error
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        messageHandlers.forEach(h =>
          h({
            data: { type: 'error', error: 'Parse failed' },
          } as MessageEvent)
        );

        return promise;
      });

      expect(mockSetUploadInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadStatus: 'error',
          uploadError: 'Parse failed',
        })
      );
    });

    it('should handle worker timeout', async () => {
      vi.useFakeTimers();

      const messageHandlers: ((e: MessageEvent) => void)[] = [];
      const mockWorker = {
        postMessage: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
          if (event === 'message') {
            messageHandlers.push(handler);
          }
        }),
        removeEventListener: vi.fn(),
        terminate: vi.fn(),
        onerror: null,
      };

      (global as any).Worker = vi.fn(() => mockWorker);

      const { result } = renderHook(() => useFileUpload());

      await vi.advanceTimersByTimeAsync(100);

      // Simulate ready message
      messageHandlers.forEach(h => h({ data: { type: 'ready' } } as MessageEvent));

      // Start upload but don't send result
      const uploadPromise = act(async () => {
        const promise = result.current.handleZipUpload(mockFile).catch(() => {
          // Expected timeout error
        });

        // Advance time to trigger timeout (60 seconds)
        await vi.advanceTimersByTimeAsync(60000);

        return promise;
      });

      await uploadPromise;

      expect(mockSetUploadInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          uploadStatus: 'error',
          uploadError: expect.stringContaining('timeout'),
        })
      );

      vi.useRealTimers();
    });
  });
});
