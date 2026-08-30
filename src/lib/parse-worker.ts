// Web Worker for parsing Instagram ZIP files
// Runs file parsing in background thread with chunked processing

import { buildAccountBadgeIndex } from '@/core/badges';
import { parseInstagramZipFile } from '@/core/parsers/instagram';
import { classifyErrorMessage } from './error-classifier';
import { generateFileHash } from './indexeddb/indexeddb-cache';
import { indexedDBService } from './indexeddb/indexeddb-service';
import { buildAllSearchIndexes } from './search-index';
import { logger } from './logger';

// Search index build delay (ms) - allows UI to be responsive before background task
const SEARCH_INDEX_BUILD_DELAY_MS = 100;

// Send ready signal to main thread
try {
  self.postMessage({ type: 'ready' });
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  self.postMessage({ type: 'error', error: errorMessage });
}

// Main message handler for file parsing
self.onmessage = async (
  e: MessageEvent<{
    type: string;
    file?: File;
    fileHash?: string;
    port?: MessagePort;
  }>
) => {
  if (e.data?.type !== 'parse') {
    return;
  }

  try {
    const { file, fileHash: providedHash } = e.data;

    // Validate input
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file provided');
    }

    // Generate or use provided file hash
    const fileHash = providedHash || (await generateFileHash(file));

    // Parse the ZIP file
    const parseResult = await parseInstagramZipFile(file);

    // Check if we have enough data to continue
    if (!parseResult.hasMinimalData) {
      const errorWarning = parseResult.warnings.find(w => w.severity === 'error');
      // Send error with code, warnings and discovery for DiagnosticErrorScreen
      self.postMessage({
        type: 'error',
        code: errorWarning?.code ?? 'NO_DATA_FILES',
        error: errorWarning?.message ?? 'Could not parse Instagram data',
        warnings: parseResult.warnings,
        discovery: parseResult.discovery,
        labelResolutionMode: parseResult.labelResolutionMode,
        truncatedRelationshipFile: parseResult.truncatedRelationshipFile,
        datesFitted: parseResult.datesFitted,
      });
      return;
    }

    // Build account badge index from parsed data
    const unified = buildAccountBadgeIndex(parseResult.data);

    // Save file metadata and accounts with IndexedDB error handling
    try {
      await indexedDBService.saveFileMetadata({
        fileHash,
        fileName: file.name,
        fileSize: file.size,
        uploadDate: new Date(),
        accountCount: unified.length,
        lastAccessed: Date.now(),
        version: 2,
        // GH#41: the caveat has to survive the parse — /results reads this
        // record, not the ParseResult that is about to go out of scope.
        followRequestsUnreadable: parseResult.followRequestsUnreadable,
        truncatedRelationshipFile: parseResult.truncatedRelationshipFile,
      });

      // Store all accounts at once (optimized bulk mode)
      await indexedDBService.storeAllAccounts(fileHash, unified);
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Database error';
      let code = 'INDEXEDDB_ERROR';

      if (dbError instanceof DOMException) {
        if (dbError.name === 'QuotaExceededError' || dbError.code === 22) {
          code = 'QUOTA_EXCEEDED';
        } else if (dbError.name === 'NotAllowedError') {
          code = 'IDB_PERMISSION_DENIED';
        }
      }

      self.postMessage({
        type: 'error',
        code,
        error: errorMessage,
      });
      return;
    }

    // Build search indexes in background (optional, non-blocking)
    // This runs after sending the result so UI is responsive
    setTimeout(async () => {
      try {
        const accountsWithIndices = unified.map((account, index) => ({
          username: account.username,
          index,
        }));

        await buildAllSearchIndexes(fileHash, accountsWithIndices);
      } catch (error) {
        // Non-critical error - app will work without indexes (slower search)
        logger.warn('Failed to build search indexes:', error);
      }
    }, SEARCH_INDEX_BUILD_DELAY_MS);

    // Send success result with warnings and discovery info
    self.postMessage({
      type: 'result',
      fileHash,
      // Don't send unified - data is already in IndexedDB for lazy loading
      accountCount: unified.length,
      warnings: parseResult.warnings,
      discovery: parseResult.discovery,
      labelResolutionMode: parseResult.labelResolutionMode,
      truncatedRelationshipFile: parseResult.truncatedRelationshipFile,
      datesFitted: parseResult.datesFitted,
    });
  } catch (error) {
    // Send error result with classified code
    const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
    const errorCode = classifyErrorMessage(errorMessage);

    self.postMessage({
      type: 'error',
      code: errorCode,
      error: errorMessage,
    });
  }
};

// Handle worker errors
self.onerror = (event: string | Event) => {
  logger.error('Parse worker global error:', event);
};

// Handle unhandled promise rejections
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  logger.error('Parse worker unhandled rejection:', event.reason);
  event.preventDefault();
};
