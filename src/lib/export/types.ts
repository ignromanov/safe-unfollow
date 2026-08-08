/**
 * Shared export types — used by the builders, the export worker, and the UI.
 */

export type ExportFormat = 'csv' | 'json';

export interface ExportProgress {
  processed: number;
  total: number;
}

/**
 * Reports how many rows have been written so far. Called once per chunk, so a
 * 1M-row export emits ~1000 updates rather than one per row.
 */
export type ExportProgressCallback = (progress: ExportProgress) => void;
