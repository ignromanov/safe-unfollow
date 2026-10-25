/**
 * Export Worker - Builds CSV/JSON export files off the main thread
 *
 * Generating a 1M-row export means ~1000 sequential IndexedDB reads plus 11
 * bitset lookups per account. On the main thread that freezes the results view;
 * here it leaves the UI responsive and lets us stream progress back.
 *
 * @module export-worker
 */

import * as Comlink from 'comlink';

import { buildExportCsv } from '@/lib/export/csv';
import { buildExportJson } from '@/lib/export/json';
import { assertNever, type ExportProgressCallback, type ExportRequest } from '@/lib/export/types';

/**
 * Export Worker API exposed via Comlink
 * Exported for direct unit testing
 */
export const exportWorkerApi = {
  /**
   * Builds the export file for the given (already filtered) account indices.
   * `indices === null` means "export all accounts".
   */
  async buildExport(
    request: ExportRequest,
    fileHash: string,
    indices: number[] | null,
    totalCount: number,
    onProgress?: ExportProgressCallback
  ): Promise<Blob> {
    switch (request.format) {
      case 'csv':
        return buildExportCsv(fileHash, indices, totalCount, onProgress);
      case 'json':
        return buildExportJson(fileHash, indices, totalCount, onProgress);
      default:
        return assertNever(request);
    }
  },
};

// Export type for use in the hook
export type ExportWorkerApi = typeof exportWorkerApi;

// Expose the API via Comlink only in worker environment
// Check for postMessage which exists in real workers and @vitest/web-worker
// but not when imported directly in Node/test for unit testing
const isWorkerContext = typeof self !== 'undefined' && typeof self.postMessage === 'function';

if (isWorkerContext) {
  Comlink.expose(exportWorkerApi);
}
