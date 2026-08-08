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
import type { ExportFormat, ExportProgressCallback } from '@/lib/export/types';

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
    format: ExportFormat,
    fileHash: string,
    indices: number[] | null,
    totalCount: number,
    onProgress?: ExportProgressCallback
  ): Promise<Blob> {
    const build = format === 'csv' ? buildExportCsv : buildExportJson;
    return build(fileHash, indices, totalCount, onProgress);
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
