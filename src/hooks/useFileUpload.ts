import { OPTIONAL_FILE_DRIFT_CODES } from '@/core/parsers/instagram-file-specs';
import type { FileDiscovery, LabelResolutionMode, ParseWarning } from '@/core/types';
import { analytics } from '@/lib/analytics';
import type { ParseOutcome } from '@/lib/analytics';
import { extractErrorCode } from '@/lib/error-classifier';
import { isValidZipFile } from '@/lib/file-validation';
import { dbCache, generateFileHash } from '@/lib/indexeddb/indexeddb-cache';
import { parseOnMainThread, parseWithWorker } from '@/lib/parse-orchestration';
import { useAppStore } from '@/lib/store';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParseWorker } from './useParseWorker';

// Upload rate limiting (ms)
const UPLOAD_DEBOUNCE_MS = 1000;

// Maximum file size: 500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// localStorage key for tracking return uploads
const LAST_UPLOAD_KEY = 'analytics_last_upload';

/**
 * Report optional relationship files whose top-level shape we no longer recognise
 * (GH#21). Those parse to an empty map that is indistinguishable from "the user has
 * none", and severity `'warning'` is rendered nowhere — `UploadZone.tsx` and
 * `DiagnosticErrorScreen.tsx` both read only `'error'` — so this event is the whole
 * detection surface.
 *
 * It must run on the main thread: `enqueueEvent` and `trackEvent` both return early
 * on `typeof window === 'undefined'` (`lib/stats/queue.ts`, `lib/stats/core.ts`), and
 * a Web Worker's global is `self`, so emitting from the parser itself would be a
 * silent no-op. The warnings already cross the boundary inside the parse result.
 *
 * Called on every path that observes warnings, including the failure path: drift is a
 * fact about the export, not about whether the upload finished. A format change would
 * plausibly hit several files at once, so the case where drift accompanies a failure
 * is precisely the one worth seeing.
 */
function reportOptionalFileDrift(warnings: ParseWarning[] | undefined): void {
  for (const warning of warnings ?? []) {
    if (OPTIONAL_FILE_DRIFT_CODES.has(warning.code)) {
      analytics.optionalFileFormatDrift(warning.code);
    }
  }
}

/**
 * Report how this parse resolved the localised username label (GH#21 Task 5).
 * `mode` is `undefined` only when nothing was parsed this call — a genuine
 * exception thrown before `parseInstagramZipFile` ever ran (e.g. the worker's
 * own IndexedDB-quota branch, which never posts `labelResolutionMode`) — and
 * silently no-ops rather than reporting a fabricated mode.
 */
function reportUsernameLabelResolution(mode: LabelResolutionMode | undefined): void {
  if (!mode) return;
  analytics.usernameLabelResolution(mode);
}

/**
 * Check if this is a return upload and track it
 */
function trackReturnUploadIfApplicable(fileHash: string): void {
  const lastUpload = localStorage.getItem(LAST_UPLOAD_KEY);

  if (lastUpload) {
    try {
      const { hash: lastHash, timestamp } = JSON.parse(lastUpload) as {
        hash: string;
        timestamp: number;
      };

      // Only track if different file (hash changed)
      if (lastHash !== fileHash) {
        const daysSince = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
        analytics.returnUpload(fileHash, daysSince);
      }
    } catch {
      // Invalid stored data, ignore
    }
  }

  // Store current upload info
  localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify({ hash: fileHash, timestamp: Date.now() }));
}

export function useFileUpload() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastUploadRef = useRef<number>(0);

  // Progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Store actions
  const setUploadInfo = useAppStore(s => s.setUploadInfo);
  const { t } = useTranslation('upload');

  // Web Worker for file parsing
  const { workerRef, isWorkerReady } = useParseWorker();

  const handleZipUpload = useCallback(
    // eslint-disable-next-line complexity -- Upload handler has high complexity due to multiple error paths, cache checks, and state management
    async (file: File) => {
      // Debounce rapid uploads
      const now = Date.now();
      if (now - lastUploadRef.current < UPLOAD_DEBOUNCE_MS) {
        return;
      }
      lastUploadRef.current = now;

      const uploadDate = new Date();
      const startTime = performance.now();
      const fileSizeMb = file.size / (1024 * 1024);

      // Reported in the `finally` below. Defaults to 'error' so an exit path
      // added later is counted pessimistically rather than silently dropped.
      let outcome: ParseOutcome = 'error';

      // Reset progress
      setUploadProgress(0);
      setProcessedCount(0);
      setTotalCount(0);

      // Cancel any ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Update store for immediate UI feedback
      setUploadInfo({
        currentFileName: file.name,
        uploadStatus: 'loading',
        uploadError: null,
        fileSize: file.size,
        uploadDate,
      });

      let fileHash: string = '';

      try {
        // Validate ZIP file before processing
        const isZip = await isValidZipFile(file);
        if (!isZip) {
          const notZipWarning: ParseWarning = {
            code: 'NOT_ZIP',
            message: t('diagnostic.errors.NOT_ZIP.message'),
            severity: 'error',
            fix: t('diagnostic.errors.NOT_ZIP.fix'),
          };

          setUploadInfo({
            currentFileName: file.name,
            uploadStatus: 'error',
            uploadError: notZipWarning.message,
            parseWarnings: [notZipWarning],
          });

          analytics.uploadErrorByCode('', 'NOT_ZIP', notZipWarning.message);
          throw new Error(notZipWarning.message);
        }

        // File size guard: reject files over 500MB
        if (file.size > MAX_FILE_SIZE) {
          const sizeMb = Math.round(file.size / (1024 * 1024));
          const tooLargeWarning: ParseWarning = {
            code: 'FILE_TOO_LARGE',
            message: t('diagnostic.errors.FILE_TOO_LARGE.message', { sizeMb }),
            severity: 'error',
            fix: t('diagnostic.errors.FILE_TOO_LARGE.fix'),
          };

          setUploadInfo({
            currentFileName: file.name,
            uploadStatus: 'error',
            uploadError: tooLargeWarning.message,
            parseWarnings: [tooLargeWarning],
          });

          analytics.uploadErrorByCode('', 'FILE_TOO_LARGE', tooLargeWarning.message);
          throw new Error(tooLargeWarning.message);
        }

        // Generate file hash for cache lookup and analytics correlation
        fileHash = await generateFileHash(file);

        // Track upload start with file hash
        analytics.fileUploadStart(fileSizeMb);

        // Check IndexedDB cache first
        const cachedData = await dbCache.get(fileHash);

        if (cachedData) {
          // Restore data from cache
          // Data is in IndexedDB, just update metadata

          setUploadInfo({
            currentFileName: cachedData.metadata.name,
            uploadStatus: 'success',
            uploadError: null,
            fileSize: cachedData.metadata.size,
            uploadDate: cachedData.metadata.uploadDate,
            fileHash: fileHash,
            accountCount: cachedData.metadata.accountCount,
          });

          // Track success from cache
          analytics.fileUploadSuccess(cachedData.metadata.accountCount, true);

          outcome = 'cached';
          return;
        }

        // Use Web Worker for file parsing if available, otherwise fallback to main thread
        let accountCount: number = 0;
        let resultFileHash: string = fileHash;

        const handleProgress = (progress: number, processed: number, total: number) => {
          setUploadProgress(progress);
          setProcessedCount(processed);
          setTotalCount(total);
        };

        if (workerRef.current && isWorkerReady()) {
          // Parse file using Web Worker with progress updates
          try {
            const result = await parseWithWorker(
              workerRef.current,
              file,
              fileHash,
              handleProgress,
              abortControllerRef.current?.signal
            );

            accountCount = result.accountCount;
            resultFileHash = result.fileHash;

            // Store warnings and discovery from worker
            if (result.warnings || result.discovery) {
              setUploadInfo({
                parseWarnings: result.warnings ?? [],
                fileDiscovery: result.discovery,
              });
            }
            reportOptionalFileDrift(result.warnings);
            reportUsernameLabelResolution(result.labelResolutionMode);
          } catch (error) {
            // Extract warnings/discovery from error if available
            if (error instanceof Error && 'warnings' in error) {
              const failureWarnings = (error as { warnings?: ParseWarning[] }).warnings;
              setUploadInfo({
                parseWarnings: failureWarnings ?? [],
                fileDiscovery: (error as { discovery?: import('@/core/types').FileDiscovery })
                  .discovery,
              });
              reportOptionalFileDrift(failureWarnings);
              reportUsernameLabelResolution(
                (error as { labelResolutionMode?: LabelResolutionMode }).labelResolutionMode
              );
            }
            throw error;
          }
        } else {
          // Fallback: parse on main thread
          const result = await parseOnMainThread(
            file,
            fileHash,
            abortControllerRef.current?.signal
          );

          accountCount = result.accountCount;
          resultFileHash = result.fileHash;

          // Store warnings and discovery from main thread parsing
          setUploadInfo({
            parseWarnings: result.warnings ?? [],
            fileDiscovery: result.discovery,
          });
          reportOptionalFileDrift(result.warnings);
          reportUsernameLabelResolution(result.labelResolutionMode);
        }

        // Data already cached in IndexedDB by worker during chunked processing

        setUploadInfo({
          currentFileName: file.name,
          uploadStatus: 'success',
          uploadError: null,
          fileSize: file.size,
          uploadDate,
          fileHash: resultFileHash,
          accountCount: accountCount,
        });

        // Track successful processing
        analytics.fileUploadSuccess(accountCount, false);

        // Track return upload (user uploading new data)
        trackReturnUploadIfApplicable(resultFileHash);

        outcome = 'success';
      } catch (err) {
        // Track cancelled uploads but don't show error
        if (abortControllerRef.current?.signal.aborted) {
          analytics.uploadErrorByCode(fileHash, 'UPLOAD_CANCELLED');
          outcome = 'cancelled';
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Failed to parse ZIP';

        // Extract code from structured error or classify by text
        const errorCode = extractErrorCode(err);

        // Extract warnings and discovery if available
        const warnings = (err as { warnings?: ParseWarning[] }).warnings;
        const discovery = (err as { discovery?: FileDiscovery }).discovery;

        analytics.uploadErrorByCode(fileHash, errorCode, errorMessage);

        setUploadInfo({
          currentFileName: file.name,
          uploadStatus: 'error',
          uploadError: errorMessage,
          parseWarnings: warnings,
          fileDiscovery: discovery,
        });
        throw err;
      } finally {
        // Every terminal path lands here, including the early cache return, so
        // the bucket distribution covers all uploads and not just slow ones.
        analytics.uploadParseDuration(performance.now() - startTime, outcome);
      }
    },
    [setUploadInfo, t]
  );

  const abortUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setUploadInfo({ uploadStatus: 'idle', uploadError: null });
    }
  }, [setUploadInfo]);

  return {
    handleZipUpload,
    abortUpload,
    uploadProgress,
    processedCount,
    totalCount,
  };
}
