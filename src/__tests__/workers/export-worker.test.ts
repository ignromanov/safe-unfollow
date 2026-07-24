/**
 * Tests for Export Worker API
 *
 * Tests exportWorkerApi directly (unit tests), mirroring filter-worker.test.ts.
 * The API object is exported so it can be exercised without Comlink overhead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildExportCsv } from '@/lib/export/csv';
import { buildExportJson } from '@/lib/export/json';

vi.mock('@/lib/export/csv', () => ({ buildExportCsv: vi.fn() }));
vi.mock('@/lib/export/json', () => ({ buildExportJson: vi.fn() }));

import { exportWorkerApi } from '@/workers/export-worker';

const csvBlob = new Blob(['csv'], { type: 'text/csv;charset=utf-8' });
const jsonBlob = new Blob(['[]'], { type: 'application/json;charset=utf-8' });

describe('export-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildExportCsv).mockResolvedValue(csvBlob);
    vi.mocked(buildExportJson).mockResolvedValue(jsonBlob);
  });

  it('should build a CSV blob for the csv format', async () => {
    const result = await exportWorkerApi.buildExport('csv', 'hash1', null, 100);

    expect(result).toBe(csvBlob);
    expect(buildExportCsv).toHaveBeenCalledWith('hash1', null, 100, undefined);
    expect(buildExportJson).not.toHaveBeenCalled();
  });

  it('should build a JSON blob for the json format', async () => {
    const result = await exportWorkerApi.buildExport('json', 'hash1', [1, 2], 100);

    expect(result).toBe(jsonBlob);
    expect(buildExportJson).toHaveBeenCalledWith('hash1', [1, 2], 100, undefined);
    expect(buildExportCsv).not.toHaveBeenCalled();
  });

  it('should forward the progress callback to the builder', async () => {
    const onProgress = vi.fn();
    vi.mocked(buildExportCsv).mockImplementation(async (_hash, _indices, _total, cb) => {
      cb?.({ processed: 500, total: 1000 });
      return csvBlob;
    });

    await exportWorkerApi.buildExport('csv', 'hash1', null, 1000, onProgress);

    expect(onProgress).toHaveBeenCalledWith({ processed: 500, total: 1000 });
  });
});
