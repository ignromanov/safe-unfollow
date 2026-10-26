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
vi.mock('@/lib/export/html', () => ({
  buildExportHtml: vi.fn(async () => fallbackBlob),
}));

import * as Comlink from 'comlink';
import { useExportWorker } from '@/hooks/useExportWorker';
import { buildExportCsv } from '@/lib/export/csv';
import { buildExportHtml } from '@/lib/export/html';
import { buildExportJson } from '@/lib/export/json';
import { makeReport } from '../utils/report-context-fixture';

describe('useExportWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi();
    vi.mocked(Comlink.wrap).mockReturnValue(mockApi as never);
  });

  it('should build the export through the worker', async () => {
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    expect(blob).toBe(workerBlob);
    expect(mockApi.buildExport).toHaveBeenCalledWith(
      { format: 'csv' },
      'hash1',
      null,
      100,
      undefined
    );
    expect(buildExportCsv).not.toHaveBeenCalled();
  });

  it('should forward the progress callback through Comlink.proxy', async () => {
    const onProgress = vi.fn();
    const { result } = renderHook(() => useExportWorker());

    await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100, onProgress);

    expect(vi.mocked(Comlink.proxy)).toHaveBeenCalledWith(onProgress);
  });

  // A paid export must not fail just because the worker could not start
  // (strict CSP, blocked blob: workers, older browser).
  it('should fall back to main-thread generation when the worker rejects', async () => {
    mockApi.buildExport.mockRejectedValueOnce(new Error('worker exploded'));
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
    expect(buildExportCsv).toHaveBeenCalledWith('hash1', null, 100, undefined);
  });

  it('should fall back to the json builder for a json request', async () => {
    mockApi.buildExport.mockRejectedValueOnce(new Error('worker exploded'));
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport({ format: 'json' }, 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
    expect(buildExportJson).toHaveBeenCalledWith('hash1', null, 100, undefined);
    expect(buildExportCsv).not.toHaveBeenCalled();
  });

  it('should fall back to the html builder, carrying the request report', async () => {
    mockApi.buildExport.mockRejectedValueOnce(new Error('worker exploded'));
    const report = makeReport();
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport({ format: 'html', report }, 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
    expect(buildExportHtml).toHaveBeenCalledWith('hash1', null, 100, report, undefined);
    expect(buildExportJson).not.toHaveBeenCalled();
  });

  it('should reject an unknown format on the fallback path instead of building another', async () => {
    mockApi.buildExport.mockRejectedValueOnce(new Error('worker exploded'));
    const { result } = renderHook(() => useExportWorker());

    await expect(
      result.current.buildExport({ format: 'xml' } as never, 'hash1', null, 100)
    ).rejects.toThrow('Unhandled export format: xml');
  });

  it('should fall back when the worker cannot be constructed', async () => {
    vi.mocked(Comlink.wrap).mockImplementationOnce(() => {
      throw new Error('no worker support');
    });
    const { result } = renderHook(() => useExportWorker());

    const blob = await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    expect(blob).toBe(fallbackBlob);
  });

  it('should reuse a single worker across calls', async () => {
    const { result } = renderHook(() => useExportWorker());

    await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);
    await result.current.buildExport({ format: 'json' }, 'hash1', null, 100);

    expect(vi.mocked(Comlink.wrap)).toHaveBeenCalledTimes(1);
  });

  it('should terminate the worker on unmount', async () => {
    const { result, unmount } = renderHook(() => useExportWorker());
    await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    expect(() => unmount()).not.toThrow();
  });

  it('should fall back to the main thread when the worker script never loads', async () => {
    // A worker that fails to load answers nothing, so Comlink's call stays
    // pending: without the error guard this export would never settle at all
    // and the dialog would spin forever on a path the user has paid for.
    mockApi.buildExport.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useExportWorker());
    const pending = result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    const worker = vi.mocked(Comlink.wrap).mock.calls[0][0] as Worker;
    worker.dispatchEvent(new ErrorEvent('error', { message: 'Failed to fetch chunk' }));

    await expect(pending).resolves.toBe(fallbackBlob);
    expect(buildExportCsv).toHaveBeenCalled();

    // The dead worker must not be reused, or the next export hangs on it again
    mockApi.buildExport.mockResolvedValue(workerBlob);
    await result.current.buildExport({ format: 'csv' }, 'hash1', null, 100);

    expect(vi.mocked(Comlink.wrap)).toHaveBeenCalledTimes(2);
  });
});
