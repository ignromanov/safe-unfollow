/**
 * Tests for useExportWorker hook
 *
 * Comlink is mocked (as in useFilterWorker.test.ts); Worker itself comes from
 * @vitest/web-worker.
 */

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const workerBlob = new Blob(['worker'], { type: 'text/csv;charset=utf-8' });
const fallbackBlob = new Blob(['fallback'], { type: 'text/csv;charset=utf-8' });

const createMockApi = () => ({
  buildExport: vi.fn().mockResolvedValue(workerBlob),
});

let mockApi = createMockApi();

vi.mock('comlink', () => ({
  wrap: vi.fn(() => mockApi),
  expose: vi.fn(),
  proxy: vi.fn((value: unknown) => value),
}));

vi.mock('@/lib/export/csv', () => ({
  buildExportCsv: vi.fn(async () => fallbackBlob),
}));
vi.mock('@/lib/export/json', () => ({
  buildExportJson: vi.fn(async () => fallbackBlob),
}));

import * as Comlink from 'comlink';
import { useExportWorker } from '@/hooks/useExportWorker';
import { buildExportCsv } from '@/lib/export/csv';

describe('useExportWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
    vi.mocked(Comlink.wrap).mockReturnValue(mockApi as never);
  });

  it('should build the export through the worker', async () => {
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport('csv', 'hash1', null, 100);

    expect(blob).toBe(workerBlob);
    expect(mockApi.buildExport).toHaveBeenCalledWith('csv', 'hash1', null, 100, undefined);
    expect(buildExportCsv).not.toHaveBeenCalled();
  });

  it('should forward the progress callback through Comlink.proxy', async () => {
    const onProgress = vi.fn();
    const { result } = renderHook(() => useExportWorker());

    await result.current.buildExport('csv', 'hash1', null, 100, onProgress);

    expect(vi.mocked(Comlink.proxy)).toHaveBeenCalledWith(onProgress);
  });

  // A paid export must not fail just because the worker could not start
  // (strict CSP, blocked blob: workers, older browser).
  it('should fall back to main-thread generation when the worker rejects', async () => {
    mockApi.buildExport.mockRejectedValueOnce(new Error('worker exploded'));
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport('csv', 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
    expect(buildExportCsv).toHaveBeenCalledWith('hash1', null, 100, undefined);
  });

  it('should fall back when the worker cannot be constructed', async () => {
    vi.mocked(Comlink.wrap).mockImplementationOnce(() => {
      throw new Error('no worker support');
    });
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport('csv', 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
  });

  it('should reuse a single worker across calls', async () => {
    const { result } = renderHook(() => useExportWorker());

    await result.current.buildExport('csv', 'hash1', null, 100);
    await result.current.buildExport('json', 'hash1', null, 100);

    expect(vi.mocked(Comlink.wrap)).toHaveBeenCalledTimes(1);
  });

  it('should terminate the worker on unmount', async () => {
    const { result, unmount } = renderHook(() => useExportWorker());
    await result.current.buildExport('csv', 'hash1', null, 100);

    expect(() => unmount()).not.toThrow();
  });
});
