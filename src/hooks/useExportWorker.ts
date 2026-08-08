/**
 * useExportWorker - Builds export files via Web Worker
 *
 * The worker is created lazily on the first export, not on mount: most visitors
 * never open the export dialog at all.
 *
 * Falls back to main-thread generation if the worker cannot start or fails —
 * a paid export must not be lost to a blocked worker.
 *
 * @module useExportWorker
 */

import * as Comlink from 'comlink';
import { useCallback, useEffect, useRef } from 'react';

import type { ExportFormat, ExportProgressCallback } from '@/lib/export/types';
import { logger } from '@/lib/logger';
import type { ExportWorkerApi } from '@/workers/export-worker';

export interface UseExportWorkerResult {
  /** Builds the export file, off the main thread when possible */
  buildExport: (
    format: ExportFormat,
    fileHash: string,
    indices: number[] | null,
    totalCount: number,
    onProgress?: ExportProgressCallback
  ) => Promise<Blob>;
}

async function buildOnMainThread(
  format: ExportFormat,
  fileHash: string,
  indices: number[] | null,
  totalCount: number,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  // Dynamic import so the fallback path costs nothing when the worker works
  if (format === 'csv') {
    const { buildExportCsv } = await import('@/lib/export/csv');
    return buildExportCsv(fileHash, indices, totalCount, onProgress);
  }
  const { buildExportJson } = await import('@/lib/export/json');
  return buildExportJson(fileHash, indices, totalCount, onProgress);
}

export function useExportWorker(): UseExportWorkerResult {
  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<Comlink.Remote<ExportWorkerApi> | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      apiRef.current = null;
    };
  }, []);

  const buildExport = useCallback(
    async (
      format: ExportFormat,
      fileHash: string,
      indices: number[] | null,
      totalCount: number,
      onProgress?: ExportProgressCallback
    ): Promise<Blob> => {
      try {
        if (!apiRef.current) {
          const worker = new Worker(new URL('../workers/export-worker.ts', import.meta.url), {
            type: 'module',
          });
          workerRef.current = worker;
          apiRef.current = Comlink.wrap<ExportWorkerApi>(worker);
        }

        return await apiRef.current.buildExport(
          format,
          fileHash,
          indices,
          totalCount,
          onProgress ? Comlink.proxy(onProgress) : undefined
        );
      } catch (err) {
        logger.warn('[useExportWorker] Worker export failed, falling back to main thread:', err);
        return buildOnMainThread(format, fileHash, indices, totalCount, onProgress);
      }
    },
    []
  );

  return { buildExport };
}
