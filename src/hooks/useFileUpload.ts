import type { FileDiscovery, ParseWarning } from '@/core/types';
import { analytics } from '@/lib/analytics';
import { extractErrorCode } from '@/lib/error-classifier';
import { isValidZipFile } from '@/lib/file-validation';
import { dbCache, generateFileHash } from '@/lib/indexeddb/indexeddb-cache';
import { parseOnMainThread, parseWithWorker } from '@/lib/parse-orchestration';
import { useAppStore } from '@/lib/store';
import { useCallback, useRef, useState } from 'react';
import { useParseWorker } from './useParseWorker';

// Upload rate limiting (ms)
const UPLOAD_DEBOUNCE_MS = 1000;

// localStorage key for tracking return uploads
const LAST_UPLOAD_KEY = 'analytics_last_upload';

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
      const _startTime = performance.now();
      const fileSizeMb = file.size / (1024 * 1024);

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
            message: 'Please upload a ZIP archive file, not a folder or other file type.',
            severity: 'error',
            fix: 'Look for a file ending in .zip in your Downloads folder.',
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
          } catch (error) {
            // Extract warnings/discovery from error if available
            if (error instanceof Error && 'warnings' in error) {
              setUploadInfo({
                parseWarnings: (error as { warnings?: ParseWarning[] }).warnings ?? [],
                fileDiscovery: (error as { discovery?: import('@/core/types').FileDiscovery })
                  .discovery,
              });
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
      } catch (err) {
        // Track cancelled uploads but don't show error
        if (abortControllerRef.current?.signal.aborted) {
          analytics.uploadErrorByCode(fileHash, 'UPLOAD_CANCELLED');
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
      }
    },
    [setUploadInfo]
  );

  const abortUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    handleZipUpload,
    abortUpload,
    uploadProgress,
    processedCount,
    totalCount,
  };
}
