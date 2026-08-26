import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/indexeddb/indexeddb-service');

import { useUploadCaveats } from '@/hooks/useUploadCaveats';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

/**
 * This hook is the returning visitor's half of both caveats: they never
 * re-parse, so the only place either can come from is the stored record. Every
 * branch here defaults to "no caveat", because a warning that fires when
 * nothing is wrong names a correct number as unreliable.
 */
describe('useUploadCaveats', () => {
  const getFileMetadata = vi.mocked(indexedDBService.getFileMetadata);

  const record = (overrides: Record<string, unknown> = {}) =>
    ({
      fileHash: 'hash',
      fileName: 'export.zip',
      fileSize: 1024,
      uploadDate: new Date(),
      accountCount: 10,
      lastAccessed: Date.now(),
      version: 2,
      ...overrides,
    }) as never;

  /**
   * What the hook reports when there is nothing to warn about — its own
   * NO_CAVEATS.
   *
   * `not-applicable` rather than a verdict, because every case that lands here
   * is a record that never told us one: absent field, missing record, or
   * IndexedDB unavailable. Reading those as `no-skew` would report a clean
   * comparison that no parse performed.
   */
  const QUIET = { followRequestsUnreadable: false, truncatedRelationshipFile: 'not-applicable' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the caveat stored with the upload', async () => {
    getFileMetadata.mockResolvedValue(record({ followRequestsUnreadable: true }));

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() => expect(result.current.followRequestsUnreadable).toBe(true));
  });

  it('stays quiet for a record written before the field existed', async () => {
    // Absent means "no caveat" — the same default accountsComplete takes.
    getFileMetadata.mockResolvedValue(record());

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toEqual(QUIET);
  });

  it('stays quiet when the record is gone', async () => {
    getFileMetadata.mockResolvedValue(null);

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toEqual(QUIET);
  });

  it('stays quiet when IndexedDB is unavailable rather than surfacing the failure', async () => {
    getFileMetadata.mockRejectedValue(new Error('IndexedDB unavailable'));

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toEqual(QUIET);
  });

  it('reports which file was truncated', async () => {
    getFileMetadata.mockResolvedValue(record({ truncatedRelationshipFile: 'followers' }));

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() => expect(result.current.truncatedRelationshipFile).toBe('followers'));
    expect(result.current.followRequestsUnreadable).toBe(false);
  });

  it('reports both caveats at once, because they are not alternatives', async () => {
    getFileMetadata.mockResolvedValue(
      record({ followRequestsUnreadable: true, truncatedRelationshipFile: 'following' })
    );

    const { result } = renderHook(() => useUploadCaveats('hash'));

    await waitFor(() =>
      expect(result.current).toEqual({
        followRequestsUnreadable: true,
        truncatedRelationshipFile: 'following',
      })
    );
  });

  it('does not touch storage without a file hash', () => {
    const { result } = renderHook(() => useUploadCaveats(null));

    expect(getFileMetadata).not.toHaveBeenCalled();
    expect(result.current).toEqual(QUIET);
  });
});
