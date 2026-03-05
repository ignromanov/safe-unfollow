/**
 * IndexedDB Cache - Compatibility layer for v1 API
 *
 * This module provides backward compatibility with the old cache API
 * while using the new optimized v2 storage system under the hood.
 *
 * For new code, use indexeddb-service.ts directly.
 */

import { indexedDBService } from './indexeddb-service';

interface CachedData {
  fileHash: string;
  metadata: {
    name: string;
    size: number;
    uploadDate: Date;
    accountCount: number;
  };
  timestamp: number;
}

class IndexedDBCache {
  /**
   * Get cached data (legacy API)
   * Note: Returns null - new system uses chunked loading
   */
  async get(fileHash: string): Promise<CachedData | null> {
    // Check if file exists in v2 storage
    const metadata = await indexedDBService.getFileMetadata(fileHash);

    if (!metadata) {
      return null;
    }

    // Check if cache is still valid (7 days)
    const cacheAge = Date.now() - metadata.lastAccessed;
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    if (cacheAge > maxAge) {
      return null;
    }

    // Update last accessed time
    await indexedDBService.saveFileMetadata({
      ...metadata,
      lastAccessed: Date.now(),
    });

    // Return cache info (data is loaded on-demand from IndexedDB)
    return {
      fileHash,
      metadata: {
        name: metadata.fileName,
        size: metadata.fileSize,
        uploadDate: metadata.uploadDate,
        accountCount: metadata.accountCount,
      },
      timestamp: metadata.lastAccessed,
    };
  }

  /**
   * Set cached data (legacy API)
   * Note: This is now handled by chunked ingestion
   */
  async set(_data: CachedData): Promise<void> {
    // Legacy method - data is now stored via appendAccountsChunk
    console.warn('[IndexedDB] set() is deprecated - use indexedDBService.appendAccountsChunk()');
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    const files = await indexedDBService.getAllFiles();

    for (const file of files) {
      await indexedDBService.clearFile(file.fileHash);
    }

    indexedDBService.clearCaches();
  }
}

export const dbCache = new IndexedDBCache();

/** Error with diagnostic code for structured error handling */
interface CodedError extends Error {
  code?: string;
}

/**
 * Generate file hash for caching
 * Uses first 1MB of file for fast hash generation
 */
export async function generateFileHash(file: File): Promise<string> {
  // Check crypto API availability
  if (!globalThis.crypto?.subtle?.digest) {
    const error: CodedError = new Error('Crypto API not available');
    error.code = 'CRYPTO_NOT_AVAILABLE';
    throw error;
  }

  // Check for empty file
  if (file.size === 0) {
    const error: CodedError = new Error('File is empty');
    error.code = 'EMPTY_FILE';
    throw error;
  }

  try {
    // Read only first 1MB for hashing — avoids loading entire file into memory
    const hashSize = Math.min(file.size, 1024 * 1024);
    let buffer: ArrayBuffer;
    if (typeof file.slice === 'function') {
      buffer = await file.slice(0, hashSize).arrayBuffer();
    } else {
      // Fallback for environments where slice is not available (e.g., test mocks)
      const fullBuffer = await file.arrayBuffer();
      buffer = fullBuffer.slice(0, hashSize);
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (err) {
    const error: CodedError = new Error(
      `Failed to hash file: ${err instanceof Error ? err.message : 'Unknown'}`
    );
    error.code = 'CORRUPTED_ZIP';
    throw error;
  }
}
