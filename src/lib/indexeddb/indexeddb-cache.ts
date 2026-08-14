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

/** Bytes sampled from each end of the file for hashing */
const HASH_SAMPLE_SIZE = 1024 * 1024;

/**
 * Generate file hash for caching
 *
 * Samples the first and last HASH_SAMPLE_SIZE bytes (plus file.size) instead of
 * loading the whole file into memory — bounded cost even for the 272MB stress
 * fixture. An Instagram export ZIP has stable, alphabetically-early entries up
 * front (e.g. ads_information/…) that don't change between exports, while the
 * data this product actually reads (connections/followers_and_following/…) sits
 * deep in the archive. Hashing the head alone (GH#22) let two different exports
 * collide on the same cache key, silently serving the stale snapshot. A ZIP's
 * central directory — which encodes every entry's name, size and CRC — lives at
 * the end of the file, so the tail sample is where most real differences show up.
 * file.size is folded in too, so a collision now requires agreement on three
 * independent things instead of one.
 *
 * This is not a full-file hash: two files differing only in an unsampled middle
 * region of matching length would still collide. That's an accepted trade-off
 * for staying memory-bounded, not a full integrity guarantee.
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
    const headEnd = Math.min(file.size, HASH_SAMPLE_SIZE);
    // Clamped to headEnd so a file no larger than the sample size (headEnd === file.size)
    // yields an empty tail slice below — it is not hashed twice.
    const tailStart = Math.max(headEnd, file.size - HASH_SAMPLE_SIZE);

    let headBuffer: ArrayBuffer;
    let tailBuffer: ArrayBuffer;
    if (typeof file.slice === 'function') {
      headBuffer = await file.slice(0, headEnd).arrayBuffer();
      tailBuffer =
        tailStart < file.size
          ? await file.slice(tailStart, file.size).arrayBuffer()
          : new ArrayBuffer(0);
    } else {
      // Fallback for environments where slice is not available (e.g., test mocks)
      const fullBuffer = await file.arrayBuffer();
      headBuffer = fullBuffer.slice(0, headEnd);
      tailBuffer =
        tailStart < file.size ? fullBuffer.slice(tailStart, file.size) : new ArrayBuffer(0);
    }

    // Fold file.size into the digest input — two files can share an identical
    // sampled head and tail while differing only in an unsampled middle length.
    const sizeBuffer = new ArrayBuffer(8);
    new DataView(sizeBuffer).setFloat64(0, file.size);

    const combined = new Uint8Array(
      headBuffer.byteLength + tailBuffer.byteLength + sizeBuffer.byteLength
    );
    combined.set(new Uint8Array(headBuffer), 0);
    combined.set(new Uint8Array(tailBuffer), headBuffer.byteLength);
    combined.set(new Uint8Array(sizeBuffer), headBuffer.byteLength + tailBuffer.byteLength);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
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
