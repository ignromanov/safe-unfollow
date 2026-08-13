import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/indexeddb/indexeddb-service');

import { useFollowRequestsCaveat } from '@/hooks/useFollowRequestsCaveat';
import { indexedDBService } from '@/lib/indexeddb/indexeddb-service';

/**
 * GH#41. This hook is the returning visitor's half of the fix: they never
 * re-parse, so the only place the caveat can come from is the stored record.
 * Every branch here defaults to "no caveat", because a warning that fires when
 * nothing is wrong names a correct number as unreliable.
 */
describe('useFollowRequestsCaveat', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports the caveat stored with the upload', async () => {
    getFileMetadata.mockResolvedValue(record({ followRequestsUnreadable: true }));

    const { result } = renderHook(() => useFollowRequestsCaveat('hash'));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays quiet for a record written before the field existed', async () => {
    // Absent means "no caveat" — the same default accountsComplete takes.
    getFileMetadata.mockResolvedValue(record());

    const { result } = renderHook(() => useFollowRequestsCaveat('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('stays quiet when the record is gone', async () => {
    getFileMetadata.mockResolvedValue(null);

    const { result } = renderHook(() => useFollowRequestsCaveat('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('stays quiet when IndexedDB is unavailable rather than surfacing the failure', async () => {
    getFileMetadata.mockRejectedValue(new Error('IndexedDB unavailable'));

    const { result } = renderHook(() => useFollowRequestsCaveat('hash'));

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('does not touch storage without a file hash', () => {
    const { result } = renderHook(() => useFollowRequestsCaveat(null));

    expect(getFileMetadata).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
  });
});
