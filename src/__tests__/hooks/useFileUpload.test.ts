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
    optionalFileFormatDrift: vi.fn(),
    usernameLabelResolution: vi.fn(),
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
      labelResolutionMode: 'fast-path',
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

  /**
   * GH#21 — the six optional relationship files parse to an empty map when their
   * top-level shape drifts, which looks exactly like "this user has none". The
   * parser now flags that at severity 'warning', but `'warning'` is rendered
   * NOWHERE (`UploadZone.tsx` and `DiagnosticErrorScreen.tsx` both read only
   * `'error'`), so this event is the entire detection surface. Without it the
   * drift is silent to the user AND to us.
   *
   * The second assertion carries most of the weight: an implementation that fired
   * on every warning would satisfy the first one and flood the event with ordinary
   * empty-file notices, destroying the signal it exists to carry.
   */
  it('should report each drifted optional file and stay silent for ordinary warnings', async () => {
    const { parseInstagramZipFile } = await import('@/core/parsers/instagram');
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
      warnings: [
        {
          code: 'INVALID_UNFOLLOWED_FORMAT',
          message: 'unfollowed shape not recognised',
          severity: 'warning',
        },
        { code: 'EMPTY_FOLLOWING', message: 'following.json is empty', severity: 'info' },
        {
          code: 'INVALID_DISMISSED_FORMAT',
          message: 'dismissed shape not recognised',
          severity: 'warning',
        },
        { code: 'MISSING_PENDING', message: 'pending file absent', severity: 'warning' },
      ],
      discovery: { format: 'json', isInstagramExport: true, basePath: '', files: [] },
      hasMinimalData: true,
    } as any);

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    expect(analytics.optionalFileFormatDrift).toHaveBeenCalledWith('INVALID_UNFOLLOWED_FORMAT');
    expect(analytics.optionalFileFormatDrift).toHaveBeenCalledWith('INVALID_DISMISSED_FORMAT');
    expect(analytics.optionalFileFormatDrift).toHaveBeenCalledTimes(2);
  });

  /**
   * GH#21 Task 5, job 1: `OPTIONAL_FILE_DRIFT_CODES` is derived from
   * `FileSpec.driftCode` AND `FileSpec.entryDriftCode` in the same flatMap
   * (`instagram-file-specs.ts`), so task 3's entry-level codes
   * (`UNRESOLVED_ENTRIES_*`) must reach `optionalFileFormatDrift` with no
   * change in this hook — verified here rather than assumed. A hand-added
   * code anywhere would be a regression in that derived-not-hand-listed
   * design.
   */
  it('reports an entry-level drift code the same way as a file-level one, and nothing else', async () => {
    const { parseInstagramZipFile } = await import('@/core/parsers/instagram');
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
      warnings: [
        {
          code: 'UNRESOLVED_ENTRIES_CLOSE_FRIENDS',
          message: 'close_friends.json was found, but its records could not be read.',
          severity: 'warning',
        },
        { code: 'EMPTY_FOLLOWING', message: 'following.json is empty', severity: 'info' },
      ],
      discovery: { format: 'json', isInstagramExport: true, basePath: '', files: [] },
      hasMinimalData: true,
      labelResolutionMode: 'unresolved',
    } as any);

    const { result } = renderHook(() => useFileUpload());

    await act(async () => {
      await result.current.handleZipUpload(mockFile);
    });

    expect(analytics.optionalFileFormatDrift).toHaveBeenCalledWith(
      'UNRESOLVED_ENTRIES_CLOSE_FRIENDS'
    );
    expect(analytics.optionalFileFormatDrift).toHaveBeenCalledTimes(1);
  });

  /**
   * GH#21 Task 5, job 2: the new event. A clean parse still emits it —
   * unlike the drift event, which stays silent — because a rise in
   * `unresolved` across many uploads is the earliest signal Instagram
   * changed the record shape again, and that comparison needs a value from
   * every parse, not just the drifted ones.
   */
  describe('usernameLabelResolution reporting (GH#21 Task 5)', () => {
    it('reports fast-path for a clean parse and emits no drift event', async () => {
      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.handleZipUpload(mockFile);
      });

      expect(analytics.usernameLabelResolution).toHaveBeenCalledWith('fast-path');
      expect(analytics.usernameLabelResolution).toHaveBeenCalledTimes(1);
      expect(analytics.optionalFileFormatDrift).not.toHaveBeenCalled();
    });

    it('reports whatever mode the parse resolved, not just fast-path', async () => {
      const { parseInstagramZipFile } = await import('@/core/parsers/instagram');
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
        discovery: { format: 'json', isInstagramExport: true, basePath: '', files: [] },
        hasMinimalData: true,
        labelResolutionMode: 'not-applicable',
      } as any);

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        await result.current.handleZipUpload(mockFile);
      });

      expect(analytics.usernameLabelResolution).toHaveBeenCalledWith('not-applicable');
    });

    it('does not report a resolution mode on the cached path — nothing was parsed', async () => {
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

      expect(analytics.usernameLabelResolution).not.toHaveBeenCalled();
    });
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

  /**
   * GH#35 — the two pre-parse guards report the failure themselves and then
   * `throw new Error(message)` to unwind. That plain Error carries no `code` and
   * its message has already been through i18n, so the hook's own catch runs
   * `extractErrorCode` over a translated string, gets `UNKNOWN`, and reports the
   * same failure a second time.
   *
   * Measured 24 Jul – 12 Aug 2026: 296 of the 653 `upload_error_unknown` events
   * carry a translated NOT_ZIP message against 307 `upload_error_not_zip` — a 1:1
   * shadow, not a partial loss. It also explains why `UNKNOWN` shows 6 diagnostic
   * screens against 653 events: the phantom half has no screen behind it because
   * the user saw the NOT_ZIP one, which counted under NOT_ZIP.
   *
   * The count is the whole assertion. An implementation that reported the right
   * code and still double-fired would satisfy a `toHaveBeenCalledWith` check and
   * leave the bucket exactly as wrong as it is now.
   */
  describe('one upload failure reports exactly one code (GH#35)', () => {
    it('should report NOT_ZIP once, not once as itself and once as UNKNOWN', async () => {
      const notZip = createMockFile();
      Object.defineProperty(notZip, 'name', { value: 'my-instagram-data.rar' });

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        try {
          await result.current.handleZipUpload(notZip);
        } catch {
          // Expected — the hook rethrows for the caller's error UI
        }
      });

      expect(analytics.uploadErrorByCode).toHaveBeenCalledTimes(1);
      expect(analytics.uploadErrorByCode).toHaveBeenCalledWith('', 'NOT_ZIP', expect.any(String));
    });

    it('should report FILE_TOO_LARGE once, not once as itself and once as UNKNOWN', async () => {
      const tooLarge = createMockFile();
      Object.defineProperty(tooLarge, 'size', { value: 502 * 1024 * 1024 });

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        try {
          await result.current.handleZipUpload(tooLarge);
        } catch {
          // Expected — the hook rethrows for the caller's error UI
        }
      });

      expect(analytics.uploadErrorByCode).toHaveBeenCalledTimes(1);
      expect(analytics.uploadErrorByCode).toHaveBeenCalledWith(
        '',
        'FILE_TOO_LARGE',
        expect.any(String)
      );
    });

    /**
     * The same one-reporting-point rule applied to the screen, not the event.
     * The guards no longer call `setUploadInfo`; these two tests are what makes
     * that safe to have removed — the first proves the reader still gets the
     * error, the second proves they no longer get one they cancelled.
     */
    it('paints the guard failure once, from the catch every failure passes through', async () => {
      const notZip = createMockFile();
      Object.defineProperty(notZip, 'name', { value: 'my-instagram-data.rar' });

      const { result } = renderHook(() => useFileUpload());

      await act(async () => {
        try {
          await result.current.handleZipUpload(notZip);
        } catch {
          // Expected — the hook rethrows for the caller's error UI
        }
      });

      const errorCalls = mockSetUploadInfo.mock.calls.filter(
        call => call[0].uploadStatus === 'error'
      );

      expect(errorCalls).toHaveLength(1);
      expect(errorCalls[0][0]).toMatchObject({
        currentFileName: 'my-instagram-data.rar',
        parseWarnings: [expect.objectContaining({ code: 'NOT_ZIP', severity: 'error' })],
      });
      // The sentence on screen is the warning's own, not a second one written
      // for the catch — DiagnosticErrorScreen renders both and they must agree.
      expect(errorCalls[0][0].uploadError).toBe(errorCalls[0][0].parseWarnings[0].message);
    });

    it('leaves a cancelled upload cancelled, instead of erroring on a file already given up on', async () => {
      const notZip = createMockFile();
      Object.defineProperty(notZip, 'name', { value: 'my-instagram-data.rar' });

      const { result } = renderHook(() => useFileUpload());

      // Abort lands while handleZipUpload is suspended on `await isValidZipFile`:
      // the extension check decides synchronously, but awaiting it still yields
      // control back here first.
      await act(async () => {
        const promise = result.current.handleZipUpload(notZip).catch(() => {
          // Cancellation is swallowed by design — the catch returns, not rethrows
        });
        result.current.abortUpload();
        return promise;
      });

      expect(mockSetUploadInfo.mock.calls.filter(call => call[0].uploadStatus === 'error')).toEqual(
        []
      );
      expect(analytics.uploadErrorByCode).toHaveBeenCalledTimes(1);
      expect(analytics.uploadErrorByCode).toHaveBeenCalledWith('', 'UPLOAD_CANCELLED');
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

    /**
     * GH#21 Task 5: drift is a fact about the export, not about whether the
     * upload finished — `reportParseDiagnostics` runs on the worker's failure
     * path, carrying the resolution mode and the drift warnings alike. This goes
     * through the real (unmocked) `parseWithWorker`, so it also pins that
     * `labelResolutionMode` survives the worker message boundary on the
     * `hasMinimalData: false` branch, not just the success one.
     */
    it('reports the resolution mode carried on a failed worker parse', async () => {
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

      await new Promise(resolve => setTimeout(resolve, 150));
      messageHandlers.forEach(h => h({ data: { type: 'ready' } } as MessageEvent));

      await act(async () => {
        const promise = result.current.handleZipUpload(mockFile).catch(() => {
          // Expected error
        });

        await new Promise(resolve => setTimeout(resolve, 50));
        messageHandlers.forEach(h =>
          h({
            data: {
              type: 'error',
              code: 'NO_DATA_FILES',
              error: 'Could not parse Instagram data',
              warnings: [],
              labelResolutionMode: 'unresolved',
            },
          } as MessageEvent)
        );

        return promise;
      });

      expect(analytics.usernameLabelResolution).toHaveBeenCalledWith('unresolved');
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
