/**
 * Parse Orchestration
 * Handles ZIP parsing via Web Worker or fallback to main thread
 */

import type {
  FileDiscovery,
  LabelResolutionMode,
  ParseWarning,
  TruncatedRelationshipFile,
} from '@/core/types';
import { buildAccountBadgeIndex } from '@/core/badges';
import { indexedDBService } from './indexeddb/indexeddb-service';
import { logger } from './logger';

/** Extended error with structured data */
export interface ParseErrorData {
  code?: string;
  warnings?: ParseWarning[];
  discovery?: FileDiscovery;
  labelResolutionMode?: LabelResolutionMode;
  truncatedRelationshipFile?: TruncatedRelationshipFile;
}

// Worker timeout constant (ms)
const WORKER_PROCESSING_TIMEOUT_MS = 60000;

export interface ParseResult {
  fileHash: string;
  accountCount: number;
  warnings?: ParseWarning[];
  discovery?: FileDiscovery;
  labelResolutionMode?: LabelResolutionMode;
  truncatedRelationshipFile?: TruncatedRelationshipFile;
}

export interface ProgressCallback {
  (progress: number, processedCount: number, totalCount: number): void;
}

/**
 * Parse ZIP file using Web Worker with progress tracking
 */
export async function parseWithWorker(
  worker: Worker,
  file: File,
  fileHash: string,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<ParseResult> {
  return new Promise<ParseResult>((resolve, reject) => {
    // Add timeout to detect infinite loading
    const timeoutId = setTimeout(() => {
      worker.removeEventListener('message', handleMessage);
      const error = new Error('Worker timeout: Processing took too long') as Error & ParseErrorData;
      error.code = 'WORKER_TIMEOUT';
      reject(error);
    }, WORKER_PROCESSING_TIMEOUT_MS);

    const handleMessage = (e: MessageEvent) => {
      if (abortSignal?.aborted) {
        clearTimeout(timeoutId);
        worker.removeEventListener('message', handleMessage);
        reject(new Error('Upload cancelled'));
        return;
      }

      if (e.data?.type === 'progress') {
        // Progress update from chunked processing
        const { progress, processedCount, totalCount } = e.data;
        onProgress(progress, processedCount, totalCount);
      } else if (e.data?.type === 'result') {
        clearTimeout(timeoutId);
        const {
          fileHash: resultHash,
          accountCount: resultAccountCount,
          warnings,
          discovery,
          labelResolutionMode,
          truncatedRelationshipFile,
        } = e.data;
        worker.removeEventListener('message', handleMessage);
        resolve({
          fileHash: resultHash || fileHash,
          accountCount: resultAccountCount,
          warnings,
          discovery,
          labelResolutionMode,
          truncatedRelationshipFile,
        });
      } else if (e.data?.type === 'error') {
        clearTimeout(timeoutId);
        worker.removeEventListener('message', handleMessage);

        const error = new Error(e.data.error) as Error & ParseErrorData;
        error.code = e.data.code ?? 'UNKNOWN';
        error.warnings = e.data.warnings;
        error.discovery = e.data.discovery;
        error.labelResolutionMode = e.data.labelResolutionMode;
        error.truncatedRelationshipFile = e.data.truncatedRelationshipFile;

        reject(error);
      }
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage({ type: 'parse', file, fileHash });
  });
}

/**
 * Parse ZIP file on main thread (fallback when worker unavailable)
 */
export async function parseOnMainThread(
  file: File,
  fileHash: string,
  abortSignal?: AbortSignal
): Promise<ParseResult> {
  logger.warn('[Upload] Worker not available, falling back to main thread parsing');
  logger.warn('[Upload] This will be slower for large files!');

  // Static at module scope, this dragged JSZip (~96 KB) into the entry bundle of all 80
  // prerendered pages, because parseWithWorker lives in this same module and IS statically
  // reachable from Layout. Dynamic-importing the *call site* in useFileUpload would not
  // have helped, for exactly that reason.
  const { parseInstagramZipFile } = await import('@/core/parsers/instagram');

  const parseResult = await parseInstagramZipFile(file);

  if (abortSignal?.aborted) {
    throw new Error('Upload cancelled');
  }

  // Check if we have enough data to continue
  if (!parseResult.hasMinimalData) {
    const errorWarning = parseResult.warnings.find(w => w.severity === 'error');
    const error = new Error(errorWarning?.message ?? 'Could not parse Instagram data') as Error &
      ParseErrorData;
    error.code = errorWarning?.code ?? 'NO_DATA_FILES';
    error.warnings = parseResult.warnings;
    error.discovery = parseResult.discovery;
    error.labelResolutionMode = parseResult.labelResolutionMode;
    error.truncatedRelationshipFile = parseResult.truncatedRelationshipFile;
    throw error;
  }

  const unified = buildAccountBadgeIndex(parseResult.data);

  if (abortSignal?.aborted) {
    throw new Error('Upload cancelled');
  }

  // Save to IndexedDB with error handling
  try {
    await indexedDBService.saveFileMetadata({
      fileHash: fileHash,
      fileName: file.name,
      fileSize: file.size,
      uploadDate: new Date(),
      accountCount: unified.length,
      lastAccessed: Date.now(),
      version: 2,
      // GH#41 — see parse-worker.ts; the fallback path must persist it too.
      followRequestsUnreadable: parseResult.followRequestsUnreadable,
      truncatedRelationshipFile: parseResult.truncatedRelationshipFile,
    });

    await indexedDBService.storeAllAccounts(fileHash, unified);
  } catch (dbError) {
    const error = new Error(
      dbError instanceof Error ? dbError.message : 'Failed to save data'
    ) as Error & ParseErrorData;

    if (
      dbError instanceof DOMException &&
      (dbError.name === 'QuotaExceededError' || dbError.code === 22)
    ) {
      error.code = 'QUOTA_EXCEEDED';
    } else {
      error.code = 'INDEXEDDB_ERROR';
    }

    throw error;
  }

  return {
    fileHash,
    accountCount: unified.length,
    warnings: parseResult.warnings,
    discovery: parseResult.discovery,
    labelResolutionMode: parseResult.labelResolutionMode,
    truncatedRelationshipFile: parseResult.truncatedRelationshipFile,
  };
}
