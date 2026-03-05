import type { ParsedAll } from './instagram-models';

/**
 * File metadata for UI layer.
 * Uses short field names (name, size) for convenience.
 * For IndexedDB storage, see FileMetadataRecord in indexeddb-schema.ts
 */
export interface FileMetadata {
  name: string;
  size: number;
  uploadDate: Date;
  fileHash?: string;
  accountCount?: number;
  lastAccessed?: number;
  version?: number;
  processingTime?: number;
}

/**
 * Required fields for persisted file metadata.
 * Used for validation before saving to IndexedDB.
 */
export type RequiredFileMetadata = Required<Omit<FileMetadata, 'processingTime'>> & {
  processingTime?: number;
};

// === Parse Result Types ===

/** Severity of a parse warning */
export type ParseWarningSeverity = 'info' | 'warning' | 'error';

/** Warning about missing or malformed data during parsing */
export interface ParseWarning {
  /** Warning code for programmatic handling */
  code: string;
  /** Human-readable message */
  message: string;
  /** Severity level */
  severity: ParseWarningSeverity;
  /** How to fix this issue */
  fix?: string;
}

/** Information about an expected file in Instagram export */
export interface FileExpectation {
  /** File name pattern (e.g., "following.json", "followers_*.json") */
  name: string;
  /** Human-readable description of what this file contains */
  description: string;
  /** Is this file required for basic functionality? */
  required: boolean;
  /** Was this file found in the ZIP? */
  found: boolean;
  /** Number of items found (if applicable) */
  itemCount?: number;
  /** Actual path where file was found */
  foundPath?: string;
}

/** Discovery status of expected files */
export interface FileDiscovery {
  /** Format of the export (json or html) */
  format: 'json' | 'html' | 'unknown';
  /** Is this a valid Instagram data export? */
  isInstagramExport: boolean;
  /** Base path where data was found */
  basePath?: string;
  /** All expected files and their status */
  files: FileExpectation[];
}

/** Result of parsing Instagram ZIP file */
export interface ParseResult {
  /** Parsed data (may be partial if some files are missing) */
  data: ParsedAll;
  /** Warnings about missing or malformed data */
  warnings: ParseWarning[];
  /** Information about which files were found */
  discovery: FileDiscovery;
  /** Whether we have enough data for meaningful analysis */
  hasMinimalData: boolean;
}

/**
 * Upload state with discriminated union for type-safe status handling.
 * Each status variant has appropriate fields:
 * - idle: no file, no error
 * - loading: has fileName, no error
 * - success: has fileName, no error
 * - error: has error message, fileName optional
 */
export type UploadState =
  | { status: 'idle'; error: null; fileName: null }
  | { status: 'loading'; error: null; fileName: string }
  | { status: 'success'; error: null; fileName: string }
  | { status: 'error'; error: string; fileName: string | null };

/** Helper to create type-safe UploadState */
export function createUploadState(
  status: 'idle' | 'loading' | 'success' | 'error',
  fileName: string | null,
  error: string | null
): UploadState {
  switch (status) {
    case 'idle':
      return { status: 'idle', error: null, fileName: null };
    case 'loading':
      return { status: 'loading', error: null, fileName: fileName ?? '' };
    case 'success':
      return { status: 'success', error: null, fileName: fileName ?? '' };
    case 'error':
      return { status: 'error', error: error ?? 'Unknown error', fileName };
  }
}
