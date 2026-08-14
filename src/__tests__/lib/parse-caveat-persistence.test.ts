import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/parsers/instagram');
vi.mock('@/core/badges');
vi.mock('@/lib/indexeddb/indexeddb-service');
vi.mock('@/lib/indexeddb/indexeddb-cache');
vi.mock('@/lib/search-index');

/**
 * GH#41. `followRequestsUnreadable` is optional on `FileMetadataRecord`, so a
 * writer that forgets it still compiles and still saves — it just saves a
 * record that says "no caveat" about an upload that has one. There are exactly
 * two writers, the worker and the main-thread fallback, and nothing but these
 * tests notices when one of them drops the field.
 */
describe('the follow-requests caveat reaches IndexedDB (GH#41)', () => {
  const parseResultWithCaveat = {
    data: {
      following: new Set(['sample_user_a']),
      followers: new Set<string>(),
      pendingSent: new Map<string, number>(),
      permanentRequests: new Map<string, number>(),
      restricted: new Map<string, number>(),
      closeFriends: new Map<string, number>(),
      unfollowed: new Map<string, number>(),
      dismissedSuggestions: new Map<string, number>(),
      followingTimestamps: new Map<string, number>(),
      followersTimestamps: new Map<string, number>(),
    },
    warnings: [],
    discovery: { format: 'json' as const, isInstagramExport: true, files: [] },
    hasMinimalData: true,
    labelResolutionMode: 'fast-path' as const,
    followRequestsUnreadable: true,
  };

  let saveFileMetadata: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    const parsers = await import('@/core/parsers/instagram');
    const badges = await import('@/core/badges');
    const cache = await import('@/lib/indexeddb/indexeddb-cache');
    const service = await import('@/lib/indexeddb/indexeddb-service');

    vi.mocked(parsers.parseInstagramZipFile).mockResolvedValue(parseResultWithCaveat);
    vi.mocked(badges.buildAccountBadgeIndex).mockReturnValue([
      { username: 'sample_user_a', badges: { notFollowingBack: true } },
    ]);
    vi.mocked(cache.generateFileHash).mockResolvedValue('caveat-hash');

    const mockService = vi.mocked(service.indexedDBService);
    saveFileMetadata = vi.mocked(mockService.saveFileMetadata);
    saveFileMetadata.mockResolvedValue(undefined);
    vi.mocked(mockService.storeAllAccounts).mockResolvedValue(undefined);
  });

  const zipFile = () => new File(['mock zip'], 'export.zip', { type: 'application/zip' });

  it('the main-thread fallback persists it', async () => {
    const { parseOnMainThread } = await import('@/lib/parse-orchestration');

    await parseOnMainThread(zipFile(), 'caveat-hash');

    expect(saveFileMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ followRequestsUnreadable: true })
    );
  });

  it('the worker persists it', async () => {
    // The worker module installs its handler on `self` at import time; in jsdom
    // `self` is the window, so the handler can be invoked directly. Importing
    // the module IS the setup here — there is no exported entry point.
    //
    // `postMessage` has to be replaced first: jsdom's window version demands a
    // `targetOrigin` a worker never passes, and the module posts a ready signal
    // during import.
    vi.stubGlobal('postMessage', vi.fn());
    await import('@/lib/parse-worker');

    const handler = (self as unknown as { onmessage: (e: MessageEvent) => Promise<void> })
      .onmessage;
    await handler({
      data: { type: 'parse', file: zipFile(), fileHash: 'caveat-hash' },
    } as MessageEvent);

    expect(saveFileMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ followRequestsUnreadable: true })
    );
  });
});
