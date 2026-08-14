/**
 * IndexedDB Schema v2 - Optimized columnar storage with bitsets
 *
 * Architecture:
 * - files: File metadata and cache registry
 * - columns: Columnar account data (usernames as packed strings)
 * - bitsets: Badge presence stored as typed arrays
 * - timestamps: Sparse timestamp storage for time-based badges
 * - indexes: Search index cache (prefix/trigram bitsets)
 */

import type { BadgeKey, FileMetadata } from '@/core/types';

export const DB_CONFIG = {
  name: 'instagram-tracker-v2',
  version: 2,
} as const;

export const STORES = {
  FILES: 'files',
  COLUMNS: 'columns',
  BITSETS: 'bitsets',
  TIMESTAMPS: 'timestamps',
  INDEXES: 'indexes',
} as const;

// Store definitions for IDB initialization
export interface StoreConfig {
  keyPath: string | string[];
  indexes?: Array<{
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
  }>;
}

export const STORE_CONFIGS: Record<string, StoreConfig> = {
  [STORES.FILES]: {
    keyPath: 'fileHash',
    indexes: [
      { name: 'lastAccessed', keyPath: 'lastAccessed' },
      { name: 'version', keyPath: 'version' },
    ],
  },
  [STORES.COLUMNS]: {
    keyPath: ['fileHash', 'column'],
    indexes: [{ name: 'fileHash', keyPath: 'fileHash' }],
  },
  [STORES.BITSETS]: {
    keyPath: ['fileHash', 'badge'],
    indexes: [{ name: 'fileHash', keyPath: 'fileHash' }],
  },
  [STORES.TIMESTAMPS]: {
    keyPath: ['fileHash', 'username'],
    indexes: [{ name: 'fileHash', keyPath: 'fileHash' }],
  },
  [STORES.INDEXES]: {
    keyPath: ['fileHash', 'type', 'key'],
    indexes: [
      { name: 'fileHash', keyPath: 'fileHash' },
      { name: 'expiresAt', keyPath: 'expiresAt' },
    ],
  },
};

// ===== Type Definitions =====

/**
 * File metadata for IndexedDB storage layer.
 * Uses explicit field names (fileName, fileSize) for clarity in storage.
 * All fields required except processingTime (validated before save).
 *
 * Related: FileMetadata in @/core/types.ts (UI layer, optional fields)
 */
export interface FileMetadataRecord {
  fileHash: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  accountCount: number;
  lastAccessed: number;
  version: number;
  processingTime?: number;
  /**
   * Commit marker for the account-data write (GH#23). `saveFileMetadata` and
   * `storeAllAccounts` are separate IndexedDB transactions with no rollback between
   * them — if the account-data write fails (or the tab closes) after metadata already
   * landed, this flag is what stops the orphaned record from being read back as a
   * finished upload. `false` until `storeAllAccounts` confirms the account data is in;
   * absent (undefined) on records written before this field existed. Those are treated
   * as complete — see `IndexedDBService.getFileMetadata` for the reasoning, and note it
   * is NOT that they cannot be orphans. They can: the split predates this fix, which is
   * what GH#23 is about.
   */
  accountsComplete?: boolean;
  /**
   * True when this upload's follow-requests file was found and could not be read,
   * so its `notFollowingBack` badge is overstated (GH#41). See
   * `ParseResult.followRequestsUnreadable` for how the badge inflates.
   *
   * Stored here because it must outlive the parse. `/results` is reached long
   * after `ParseResult` is gone — a returning visitor never re-parses at all —
   * and this store is the only place the upload's facts survive that gap. Thread
   * it through the live parse alone and the caveat appears once and vanishes on
   * the next visit, leaving the returning user with exactly the silent wrong
   * answer this field exists to prevent.
   *
   * Optional, and absent means "no caveat" — the same default `accountsComplete`
   * takes above, for the same documented reason: GH#22 changed the cache-key
   * derivation, so records written before this field existed are not looked up
   * under their old key again. No DB version bump: object stores here are
   * schemaless (GH#23).
   */
  followRequestsUnreadable?: boolean;
}

// ===== Conversion Utilities =====

/**
 * Convert UI FileMetadata to storage FileMetadataRecord.
 * Throws if required fields are missing.
 */
export function toFileMetadataRecord(
  meta: FileMetadata & { fileHash: string }
): FileMetadataRecord {
  if (!meta.fileHash) throw new Error('fileHash is required');
  if (meta.accountCount === undefined) throw new Error('accountCount is required');

  return {
    fileHash: meta.fileHash,
    fileName: meta.name,
    fileSize: meta.size,
    uploadDate: meta.uploadDate,
    accountCount: meta.accountCount,
    lastAccessed: meta.lastAccessed ?? Date.now(),
    version: meta.version ?? 1,
    processingTime: meta.processingTime,
  };
}

/**
 * Convert storage FileMetadataRecord to UI FileMetadata.
 */
export function fromFileMetadataRecord(record: FileMetadataRecord): FileMetadata {
  return {
    name: record.fileName,
    size: record.fileSize,
    uploadDate: record.uploadDate,
    fileHash: record.fileHash,
    accountCount: record.accountCount,
    lastAccessed: record.lastAccessed,
    version: record.version,
    processingTime: record.processingTime,
  };
}

export interface ColumnRecord {
  fileHash: string;
  column: 'usernames' | 'displayNames' | 'hrefs';
  data: Uint8Array; // Packed data buffer
  offsets: Uint32Array; // Offset table for variable-length data (required)
  length: number; // Number of entries
}

export interface BitsetRecord {
  fileHash: string;
  badge: BadgeKey;
  data: Uint8Array; // Bitset as Uint8Array
  accountCount: number; // Quick stats
}

export interface TimestampRecord {
  fileHash: string;
  username: string;
  following?: number;
  followers?: number;
  pending?: number;
  permanent?: number;
  restricted?: number;
  close?: number;
  unfollowed?: number;
  dismissed?: number;
}

export type SearchIndexType = 'prefix' | 'trigram';

export interface SearchIndexRecord {
  fileHash: string;
  type: SearchIndexType;
  key: string; // prefix/trigram string
  data: Uint8Array; // Bitset
  createdAt: number;
  expiresAt: number; // TTL for eviction
}

// Badge keys that support timestamps
export const TIME_BASED_BADGES: BadgeKey[] = [
  'following',
  'followers',
  'pending',
  'permanent',
  'restricted',
  'close',
  'unfollowed',
  'dismissed',
];

// Badge keys that are boolean (computed)
export const BOOLEAN_BADGES: BadgeKey[] = ['mutuals', 'notFollowingBack', 'notFollowedBack'];

// All supported badges
export const ALL_BADGES: BadgeKey[] = [...TIME_BASED_BADGES, ...BOOLEAN_BADGES];

// Cache TTL configs
export const CACHE_CONFIG = {
  FILE_CACHE_DAYS: 7, // File data valid for 7 days
  INDEX_CACHE_DAYS: 3, // Search indexes valid for 3 days
  MAX_INDEX_ENTRIES: 10000, // Max cached search index entries
} as const;
